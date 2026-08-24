import mysql from 'mysql2/promise';
import { AIRPORTS, buildDefaultAirportSurcharges, detectAirportCodeFromText, type AirportCode } from '@/lib/airports';
import { computeGoogleRoute } from '@/lib/google-routes';
import { DEFAULT_PRICING_VEHICLES } from '@/lib/pricing-defaults';

type PricingVehicle = {
  id: number;
  code: string;
  label: string;
  as_directed_rate: number;
  tier1_rate: number;
  tier2_rate: number;
  tier3_rate: number;
  min_price: number | null;
};
type PricingVehicleRow = mysql.RowDataPacket & PricingVehicle;

type SurchargeRuleRow = mysql.RowDataPacket & { code: string; amount: number };
type SettingsRow = mysql.RowDataPacket & { night_surcharge: number; min_price_active: number };

export type FareInput = {
  pickup: string;
  dropOffs: string[];
  serviceType?: string | null;
  vehicleTypeId?: number | null;
  waitingMinutes?: number | null;
  tolls?: number | null;
  surcharge?: number | null;
  manualFareAdjustment?: number | null;
  routeMilesOverride?: number | null;
  journeyTime?: string | null;
};

export type FareResult = {
  estimatedFare: number;
  baseFare: number;
  distanceMiles: number;
  hasTolls: boolean;
  extras: Array<{ code: string; amount: number; label: string }>;
};

const defaultVehicleSource =
  DEFAULT_PRICING_VEHICLES.find((v) => v.code === 'executive') ?? DEFAULT_PRICING_VEHICLES[0];
const defaultVehicle = {
  id: defaultVehicleSource.id,
  code: defaultVehicleSource.code,
  label: defaultVehicleSource.label,
  as_directed_rate: defaultVehicleSource.asDirectedRate,
  tier1_rate: defaultVehicleSource.mileage.tier1,
  tier2_rate: defaultVehicleSource.mileage.tier2,
  tier3_rate: defaultVehicleSource.mileage.tier3,
  min_price: defaultVehicleSource.minPrice,
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const isNightTime = (time: string) => {
  const [hoursStr] = String(time || '').split(':');
  const hours = Number(hoursStr);
  return Number.isFinite(hours) && (hours >= 23 || hours < 4);
};

const getMileageRate = (vehicle: PricingVehicle, miles: number) => {
  if (miles <= 10) return Number(vehicle.tier1_rate);
  if (miles <= 40) return Number(vehicle.tier2_rate);
  return Number(vehicle.tier3_rate);
};

async function loadPricing(pool: mysql.Pool | mysql.PoolConnection) {
  const [vehicleRows] = await pool.query<PricingVehicleRow[]>(
    'SELECT id, code, label, as_directed_rate, tier1_rate, tier2_rate, tier3_rate, min_price FROM pricing_vehicles ORDER BY id'
  );
  const surchargeCodes = [
    'AIRPORT_PICKUP',
    'AIRPORT_DROPOFF',
    'CONGESTION',
    ...AIRPORTS.flatMap((airport) => [airport.pickupRuleCode, airport.dropoffRuleCode]),
  ];
  const [surchargeRows] = await pool.query<SurchargeRuleRow[]>(
    `SELECT code, amount FROM surcharge_rules WHERE code IN (${surchargeCodes.map(() => '?').join(',')})`,
    surchargeCodes
  );
  const [settingsRows] = await pool
    .query<SettingsRow[]>('SELECT night_surcharge, min_price_active FROM pricing_settings WHERE id = 1 LIMIT 1')
    .catch(() => [[], []] as unknown as [SettingsRow[], unknown]);

  const basePickup = Number(surchargeRows.find((s) => s.code === 'AIRPORT_PICKUP')?.amount ?? 15);
  const baseDropoff = Number(surchargeRows.find((s) => s.code === 'AIRPORT_DROPOFF')?.amount ?? 7);
  const airportSurcharges = buildDefaultAirportSurcharges(basePickup, baseDropoff);
  for (const airport of AIRPORTS) {
    const pickupAmount = surchargeRows.find((s) => s.code === airport.pickupRuleCode)?.amount;
    const dropoffAmount = surchargeRows.find((s) => s.code === airport.dropoffRuleCode)?.amount;
    if (pickupAmount != null) airportSurcharges[airport.code].pickup = Number(pickupAmount);
    if (dropoffAmount != null) airportSurcharges[airport.code].dropoff = Number(dropoffAmount);
  }

  return {
    vehicles: vehicleRows.length ? vehicleRows : [defaultVehicle],
    nightSurcharge: Number(settingsRows[0]?.night_surcharge ?? 30),
    minimumPriceActive: Boolean(settingsRows[0]?.min_price_active ?? 1),
    airportSurcharges,
  };
}

export async function calculateRideFare(
  pool: mysql.Pool | mysql.PoolConnection,
  input: FareInput
): Promise<FareResult> {
  const pickup = String(input.pickup || '').trim();
  const dropOffs = Array.isArray(input.dropOffs)
    ? input.dropOffs.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  if (!pickup || !dropOffs.length) {
    throw new Error('Pickup and at least one drop-off are required');
  }

  const pricing = await loadPricing(pool);
  const vehicle =
    pricing.vehicles.find((item) => Number(item.id) === Number(input.vehicleTypeId || 0)) ||
    pricing.vehicles[0] ||
    defaultVehicle;

  let distanceMiles = Number(input.routeMilesOverride || 0);
  let hasTolls = false;
  if (!(distanceMiles > 0)) {
    const finalDropOff = dropOffs[dropOffs.length - 1];
    const intermediates = dropOffs.slice(0, -1);
    const route = await computeGoogleRoute({
      origin: pickup,
      destination: finalDropOff,
      intermediates,
    }).catch(() => null);
    if (route?.distanceMeters) {
      distanceMiles = route.distanceMeters * 0.000621371;
      hasTolls = Boolean(route.hasTolls);
    }
  }

  let baseFare = String(input.serviceType || 'Transfer') === 'As Directed'
    ? Number(vehicle.as_directed_rate) * Math.max(1, Math.ceil((Number(input.waitingMinutes || 0) || 60) / 60))
    : distanceMiles * getMileageRate(vehicle, distanceMiles);

  if (pricing.minimumPriceActive && Number(vehicle.min_price || 0) > 0) {
    baseFare = Math.max(baseFare, Number(vehicle.min_price || 0));
  }

  const extras: Array<{ code: string; amount: number; label: string }> = [];
  const pickupAirport = detectAirportCodeFromText(pickup);
  const dropAirports = dropOffs
    .map((stop) => detectAirportCodeFromText(stop))
    .filter((value): value is AirportCode => Boolean(value));
  if (pickupAirport) {
    const amount = Number(pricing.airportSurcharges[pickupAirport]?.pickup ?? 0);
    if (amount > 0) extras.push({ code: `airport_pickup_${pickupAirport}`, amount, label: `${pickupAirport} pickup` });
  }
  for (const airport of dropAirports) {
    const amount = Number(pricing.airportSurcharges[airport]?.dropoff ?? 0);
    if (amount > 0) extras.push({ code: `airport_dropoff_${airport}`, amount, label: `${airport} drop-off` });
  }
  if (input.journeyTime && isNightTime(input.journeyTime)) {
    extras.push({ code: 'night_surcharge', amount: pricing.nightSurcharge, label: 'night surcharge' });
  }
  if (Number(input.waitingMinutes || 0) > 0 && String(input.serviceType || 'Transfer') !== 'As Directed') {
    extras.push({
      code: 'waiting_time',
      amount: roundMoney((Number(input.waitingMinutes || 0) / 15) * 7.5),
      label: 'waiting time',
    });
  }
  if (Number(input.tolls || 0) > 0) extras.push({ code: 'tolls', amount: Number(input.tolls || 0), label: 'tolls' });
  if (Number(input.surcharge || 0) > 0) extras.push({ code: 'surcharge', amount: Number(input.surcharge || 0), label: 'manual surcharge' });
  if (Number(input.manualFareAdjustment || 0) !== 0) {
    extras.push({ code: 'manual_adjustment', amount: Number(input.manualFareAdjustment || 0), label: 'manual fare adjustment' });
  }

  return {
    estimatedFare: Math.max(0, roundMoney(baseFare + extras.reduce((sum, item) => sum + Number(item.amount || 0), 0))),
    baseFare: roundMoney(baseFare),
    distanceMiles: roundMoney(distanceMiles),
    hasTolls,
    extras,
  };
}
