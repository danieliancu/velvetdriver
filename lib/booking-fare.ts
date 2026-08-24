import mysql from 'mysql2/promise';
import { AIRPORTS, buildDefaultAirportSurcharges, detectAirportCodeFromText, type AirportCode } from '@/lib/airports';
import { computeGoogleRoute } from '@/lib/google-routes';
import {
  DEFAULT_AIRPORT_DROPOFF_SURCHARGE,
  DEFAULT_AIRPORT_PICKUP_SURCHARGE,
  DEFAULT_CONGESTION_SURCHARGE,
  DEFAULT_MINIMUM_PRICE_ACTIVE,
  DEFAULT_NIGHT_SURCHARGE,
  DEFAULT_PRICING_VEHICLES,
  DEFAULT_ZONE_RINGS,
  type DefaultPricingVehicle,
} from '@/lib/pricing-defaults';

// Server-side replica of the client quote calculation in app/booking/page.tsx.
// Both sides consume the same Google route and the same pricing tables, so the
// results match apart from floating-point noise; callers compare with a tolerance.

type LatLngPoint = { lat: number; lng: number };
type ZoneSegment = { zoneId: number | null; miles: number };

const LONDON_CENTER: LatLngPoint = { lat: 51.509865, lng: -0.118092 }; // Charing Cross

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const haversineMiles = (a: LatLngPoint, b: LatLngPoint) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const aHarv = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
  return R * c * 0.621371;
};

const decodeEncodedPolyline = (encoded: string): LatLngPoint[] => {
  const points: LatLngPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
};

type ZoneRing = { id: number; name: string; radiusMiles: number };

const getZoneForCoords = (coords: LatLngPoint, zoneRings: ZoneRing[]) => {
  if (!zoneRings.length) return null;
  const milesFromCenter = haversineMiles(coords, LONDON_CENTER);
  const furthestRing = zoneRings[zoneRings.length - 1];
  if (!furthestRing || milesFromCenter > furthestRing.radiusMiles) return null;
  return zoneRings.find((z) => milesFromCenter <= z.radiusMiles) ?? null;
};

const zoneSegmentsFromPath = (
  path: LatLngPoint[],
  zoneRings: ZoneRing[],
  targetMiles?: number
): ZoneSegment[] | null => {
  if (!Array.isArray(path) || path.length < 2) return null;
  let straightMiles = 0;
  const rawSegments: ZoneSegment[] = [];
  const sampleMiles = 0.25;

  for (let i = 0; i < path.length - 1; i += 1) {
    const startCoords = path[i];
    const endCoords = path[i + 1];
    if (!startCoords || !endCoords) continue;
    const segmentMiles = haversineMiles(startCoords, endCoords);
    if (segmentMiles <= 0) continue;
    straightMiles += segmentMiles;
    const sampleCount = Math.max(1, Math.ceil(segmentMiles / sampleMiles));
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const startRatio = sampleIndex / sampleCount;
      const endRatio = (sampleIndex + 1) / sampleCount;
      const midRatio = (startRatio + endRatio) / 2;
      const mid = {
        lat: startCoords.lat + (endCoords.lat - startCoords.lat) * midRatio,
        lng: startCoords.lng + (endCoords.lng - startCoords.lng) * midRatio,
      };
      const zoneId = getZoneForCoords(mid, zoneRings)?.id ?? null;
      rawSegments.push({ zoneId, miles: segmentMiles / sampleCount });
    }
  }

  if (straightMiles <= 0 || !rawSegments.length) return null;
  const scale = targetMiles && targetMiles > 0 ? targetMiles / straightMiles : 1;
  const totals = new Map<string, number>();
  rawSegments.forEach((segment) => {
    const scaledMiles = segment.miles * scale;
    if (scaledMiles <= 0) return;
    const key = segment.zoneId == null ? 'none' : String(segment.zoneId);
    totals.set(key, (totals.get(key) || 0) + scaledMiles);
  });

  return Array.from(totals.entries()).map(([key, miles]) => ({
    zoneId: key === 'none' ? null : Number(key),
    miles,
  }));
};

const hasInnerZoneSegments = (segments: ZoneSegment[] | null | undefined) =>
  Boolean(segments?.some((segment) => segment.zoneId != null && segment.zoneId <= 3 && segment.miles > 0));

const pickAppliedZone = (originZone: number | null, destinationZone: number | null) => {
  const zones = [originZone, destinationZone].filter((z): z is number => z != null);
  if (!zones.length) return null;
  const touchesInner = zones.some((z) => z <= 3);
  if (touchesInner) return Math.min(...zones);
  return Math.max(...zones);
};

const isNightTime = (time: string) => {
  const [hoursStr] = String(time || '').split(':');
  const hours = Number(hoursStr);
  return Number.isFinite(hours) && (hours >= 23 || hours < 4);
};

type PricingVehicleRow = mysql.RowDataPacket & {
  id: number;
  code: string;
  label: string;
  as_directed_rate: number;
  tier1_rate: number;
  tier2_rate: number;
  tier3_rate: number;
  inner_zone_override_rate: number;
  min_price: number;
};
type SurchargeRuleRow = mysql.RowDataPacket & { code: string; amount: number };
type PricingSettingRow = mysql.RowDataPacket & { night_surcharge: number; min_price_active: number };
type ZoneRingRow = mysql.RowDataPacket & { id: number; name: string | null; radius_miles: number | null };
type DiscountRow = mysql.RowDataPacket & { code: string; amount: number; discount_type: 'fixed' | 'percent' };

type Db = mysql.Pool | mysql.PoolConnection;

async function loadPricingData(db: Db) {
  const [vehicleRows] = await db.query<PricingVehicleRow[]>(
    'SELECT id, code, label, as_directed_rate, tier1_rate, tier2_rate, tier3_rate, inner_zone_override_rate, min_price FROM pricing_vehicles ORDER BY id'
  );
  const surchargeCodes = [
    'AIRPORT_PICKUP',
    'AIRPORT_DROPOFF',
    'CONGESTION',
    ...AIRPORTS.flatMap((airport) => [airport.pickupRuleCode, airport.dropoffRuleCode]),
  ];
  const [surchargeRows] = await db.query<SurchargeRuleRow[]>(
    `SELECT code, amount FROM surcharge_rules WHERE code IN (${surchargeCodes.map(() => '?').join(',')})`,
    surchargeCodes
  );
  const [settingsRows] = await db
    .query<PricingSettingRow[]>('SELECT night_surcharge, min_price_active FROM pricing_settings WHERE id = 1 LIMIT 1')
    .catch(() => [[], []] as unknown as [PricingSettingRow[], unknown]);
  const [zoneRingRows] = await db
    .query<ZoneRingRow[]>('SELECT id, name, radius_miles FROM zone_rings ORDER BY id')
    .catch(() => [[], []] as unknown as [ZoneRingRow[], unknown]);

  const vehicles: DefaultPricingVehicle[] = vehicleRows.length
    ? vehicleRows.map((v) => ({
        id: Number(v.id),
        code: v.code,
        label: v.label,
        asDirectedRate: Number(v.as_directed_rate),
        mileage: { tier1: Number(v.tier1_rate), tier2: Number(v.tier2_rate), tier3: Number(v.tier3_rate) },
        innerZoneOverride: Number(v.inner_zone_override_rate),
        minPrice: Number(v.min_price ?? 0),
      }))
    : DEFAULT_PRICING_VEHICLES;

  const basePickup = Number(surchargeRows.find((s) => s.code === 'AIRPORT_PICKUP')?.amount ?? DEFAULT_AIRPORT_PICKUP_SURCHARGE);
  const baseDropoff = Number(surchargeRows.find((s) => s.code === 'AIRPORT_DROPOFF')?.amount ?? DEFAULT_AIRPORT_DROPOFF_SURCHARGE);
  const airports = buildDefaultAirportSurcharges(basePickup, baseDropoff);
  for (const airport of AIRPORTS) {
    const pickupAmount = surchargeRows.find((s) => s.code === airport.pickupRuleCode)?.amount;
    const dropoffAmount = surchargeRows.find((s) => s.code === airport.dropoffRuleCode)?.amount;
    if (pickupAmount != null) airports[airport.code].pickup = Number(pickupAmount);
    if (dropoffAmount != null) airports[airport.code].dropoff = Number(dropoffAmount);
  }

  const zoneRings: ZoneRing[] = (zoneRingRows?.length
    ? zoneRingRows.map((z) => ({ id: Number(z.id), name: z.name ?? `Zone ${z.id}`, radiusMiles: Number(z.radius_miles ?? 0) }))
    : DEFAULT_ZONE_RINGS
  )
    .filter((z) => z.radiusMiles > 0)
    .sort((a, b) => a.radiusMiles - b.radiusMiles);

  return {
    vehicles,
    congestion: Number(surchargeRows.find((s) => s.code === 'CONGESTION')?.amount ?? DEFAULT_CONGESTION_SURCHARGE),
    airports,
    nightSurcharge: Number(settingsRows[0]?.night_surcharge ?? DEFAULT_NIGHT_SURCHARGE),
    minimumPriceActive: Boolean(settingsRows[0]?.min_price_active ?? (DEFAULT_MINIMUM_PRICE_ACTIVE ? 1 : 0)),
    zoneRings,
  };
}

export type BookingFareInput = {
  pickup: string;
  dropOffs: string[];
  time: string;
  serviceType?: string | null;
  vehicleTypeId?: number | null;
  vehicleLabel?: string | null;
  waitingMinutes?: number | null;
  discountCode?: string | null;
};

export type BookingFareResult = {
  totalFare: number;
  baseTotalFare: number;
  discountAmount: number;
  distanceMiles: number;
};

export async function calculateBookingFare(db: Db, input: BookingFareInput): Promise<BookingFareResult> {
  const pickup = String(input.pickup || '').trim();
  const dropOffs = (input.dropOffs || []).map((d) => String(d || '').trim()).filter(Boolean);
  if (!pickup || !dropOffs.length) {
    throw new Error('Pickup and at least one drop-off are required');
  }
  const serviceType = String(input.serviceType || 'Transfer');
  const waitingMinutes = Math.max(0, Number(input.waitingMinutes) || 0);

  const pricing = await loadPricingData(db);
  const vehicle =
    pricing.vehicles.find((v) => Number(v.id) === Number(input.vehicleTypeId || 0)) ||
    pricing.vehicles.find((v) => v.label === input.vehicleLabel) ||
    pricing.vehicles[0];

  const getMileageRate = (dist: number) => {
    if (dist <= 10) return vehicle.mileage.tier1;
    if (dist <= 40) return vehicle.mileage.tier2;
    return vehicle.mileage.tier3;
  };

  let milesValue = 0;
  let segmentedMilesTotal = 0;
  let zoneInnerMiles = 0;
  let congestionDetected = false;

  if (serviceType !== 'As Directed') {
    const route = await computeGoogleRoute({
      origin: pickup,
      destination: dropOffs[dropOffs.length - 1],
      intermediates: dropOffs.slice(0, -1),
    });
    if (!route.distanceMeters) {
      throw new Error('Unable to compute route distance');
    }
    const totalMiles = route.distanceMeters / 1609.34;
    // The client displays miles rounded to 1 dp and charges off that value.
    milesValue = Number(totalMiles.toFixed(1));
    congestionDetected = Boolean(route.hasTolls);

    const routePath = route.encodedPolyline ? decodeEncodedPolyline(route.encodedPolyline) : [];
    const startCoords = routePath[0] || null;
    const endCoords = routePath[routePath.length - 1] || null;
    const originZone = startCoords ? getZoneForCoords(startCoords, pricing.zoneRings) : null;
    const destinationZone = endCoords ? getZoneForCoords(endCoords, pricing.zoneRings) : null;
    const appliedZone = pickAppliedZone(originZone?.id ?? null, destinationZone?.id ?? null);
    const routeSegments =
      zoneSegmentsFromPath(routePath, pricing.zoneRings, totalMiles) ?? [{ zoneId: appliedZone, miles: totalMiles }];
    const zoneSegments =
      appliedZone != null && appliedZone <= 3 && !hasInnerZoneSegments(routeSegments)
        ? [{ zoneId: appliedZone, miles: totalMiles }]
        : routeSegments;

    segmentedMilesTotal = zoneSegments.reduce((sum, s) => sum + s.miles, 0);
    zoneInnerMiles = zoneSegments.reduce(
      (sum, s) => sum + (s.zoneId != null && s.zoneId <= 3 ? s.miles : 0),
      0
    );
  }

  const chargeableMiles = milesValue > 0 ? milesValue : segmentedMilesTotal;
  const standardMileageRate = getMileageRate(chargeableMiles);
  const zoneOuterMiles = Math.max(0, segmentedMilesTotal - zoneInnerMiles);
  const hasZoneOverride = serviceType !== 'As Directed' && zoneInnerMiles > 0;
  const zoneMileageFare = hasZoneOverride
    ? zoneInnerMiles * vehicle.innerZoneOverride + zoneOuterMiles * standardMileageRate
    : null;

  const hourlyRate = vehicle.asDirectedRate;
  const mileageFare =
    serviceType === 'As Directed' ? hourlyRate : (zoneMileageFare ?? milesValue * getMileageRate(milesValue));
  const minimumFareForVehicle = Number(vehicle.minPrice ?? 0);
  const minimumFareApplies =
    serviceType !== 'As Directed' &&
    pricing.minimumPriceActive &&
    minimumFareForVehicle > 0 &&
    mileageFare < minimumFareForVehicle;
  const baseFare = minimumFareApplies ? minimumFareForVehicle : mileageFare;

  let totalFare = baseFare;

  if (serviceType !== 'As Directed') {
    totalFare += waitingMinutes * (vehicle.asDirectedRate / 60);
  }
  if (isNightTime(input.time)) {
    totalFare += pricing.nightSurcharge;
  }
  if (serviceType === 'Wait and Return') {
    totalFare *= 2;
  }
  if (congestionDetected && pricing.congestion > 0) {
    totalFare += pricing.congestion;
  }
  const pickupAirport = detectAirportCodeFromText(pickup);
  if (pickupAirport) {
    totalFare += Number(pricing.airports[pickupAirport]?.pickup ?? 0);
  }
  for (const stop of dropOffs) {
    const code = detectAirportCodeFromText(stop);
    if (code) totalFare += Number(pricing.airports[code as AirportCode]?.dropoff ?? 0);
  }

  const baseTotalFare = roundMoney(totalFare);

  let discountAmount = 0;
  const discountCode = String(input.discountCode || '').trim().toUpperCase();
  if (discountCode) {
    const [rows] = await db.query<DiscountRow[]>(
      `SELECT code, amount, discount_type
       FROM discount_codes
       WHERE UPPER(code) = ?
         AND is_active = 1
         AND (starts_at IS NULL OR starts_at <= CURRENT_DATE())
         AND (ends_at IS NULL OR ends_at >= CURRENT_DATE())
       LIMIT 1`,
      [discountCode]
    );
    const row = rows[0];
    if (row) {
      const raw = row.discount_type === 'percent' ? (baseTotalFare * Number(row.amount)) / 100 : Number(row.amount);
      discountAmount = roundMoney(Math.min(raw, baseTotalFare));
    }
  }

  return {
    totalFare: Math.max(0, roundMoney(baseTotalFare - discountAmount)),
    baseTotalFare,
    discountAmount,
    distanceMiles: roundMoney(chargeableMiles),
  };
}

// How far a client-submitted fare may drift from the server recomputation before
// the booking is rejected. Covers float noise and minor route changes between
// quote time and booking time.
export const fareTolerance = (serverFare: number) => Math.max(2, roundMoney(serverFare * 0.03));
