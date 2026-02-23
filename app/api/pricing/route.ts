import { NextResponse } from 'next/server';
import { AIRPORTS, buildDefaultAirportSurcharges } from '@/lib/airports';
import { getDbPool, type DbRow } from '@/lib/db';

const pool = getDbPool();

type ZoneRingRow = DbRow<{
  id: number;
  name: string | null;
  radius_miles: number | null;
}>;

type PricingVehicleRow = DbRow<{
  id: number;
  code: string;
  label: string;
  as_directed_rate: number;
  tier1_rate: number;
  tier2_rate: number;
  tier3_rate: number;
  inner_zone_override_rate: number;
}>;

type PricingVehicle = {
  id: number;
  code: string;
  label: string;
  asDirectedRate: number;
  mileage: { tier1: number; tier2: number; tier3: number };
  innerZoneOverride: number;
};

type SurchargeRuleRow = DbRow<{ code: string; amount: number }>;

type PricingSettingRow = DbRow<{ night_surcharge: number }>;

type PricingPayload = {
  vehicles: PricingVehicle[];
  surcharges: {
    congestion: number;
    airports: ReturnType<typeof buildDefaultAirportSurcharges>;
  };
  nightSurcharge: number;
  zoneRings: Array<{ id: number; name: string; radiusMiles: number }>;
};

const fallbackZoneRings = [
  { id: 1, name: 'Zone 1', radiusMiles: 3 },
  { id: 2, name: 'Zone 2', radiusMiles: 6 },
  { id: 3, name: 'Zone 3', radiusMiles: 9 },
  { id: 4, name: 'Zone 4', radiusMiles: 12 },
];

const fallbackPayload: PricingPayload = {
  vehicles: [
    { id: 3, code: 'mpv', label: 'Luxury MPV', asDirectedRate: 60, mileage: { tier1: 20, tier2: 4, tier3: 3.5 }, innerZoneOverride: 20 },
    { id: 2, code: 'luxury', label: 'Luxury', asDirectedRate: 60, mileage: { tier1: 8.75, tier2: 3.5, tier3: 3 }, innerZoneOverride: 8.75 },
    { id: 1, code: 'executive', label: 'Executive', asDirectedRate: 40, mileage: { tier1: 6.25, tier2: 2.5, tier3: 2 }, innerZoneOverride: 6.25 },
  ],
  surcharges: { congestion: 15, airports: buildDefaultAirportSurcharges(15, 7) },
  nightSurcharge: 30,
  zoneRings: fallbackZoneRings,
};

export async function GET() {
  try {
    const [vehiclesRows] = await pool.query<PricingVehicleRow[]>('SELECT * FROM pricing_vehicles ORDER BY id');
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
    const [settingsRows] = await pool.query<PricingSettingRow[]>(
      'SELECT night_surcharge FROM pricing_settings WHERE id = 1 LIMIT 1'
    );
    const [zoneRingRows] = await pool
      .query<ZoneRingRow[]>('SELECT id, name, radius_miles FROM zone_rings ORDER BY id')
      .catch(() => [[], []] as unknown as [ZoneRingRow[], unknown]);

    const vehicles: PricingVehicle[] = vehiclesRows.length
      ? vehiclesRows.map((v) => ({
      id: Number(v.id),
      code: v.code,
      label: v.label,
      asDirectedRate: Number(v.as_directed_rate),
      mileage: {
        tier1: Number(v.tier1_rate),
        tier2: Number(v.tier2_rate),
        tier3: Number(v.tier3_rate),
      },
      innerZoneOverride: Number(v.inner_zone_override_rate),
    }))
      : fallbackPayload.vehicles;

    const basePickup = Number(surchargeRows.find((s) => s.code === 'AIRPORT_PICKUP')?.amount ?? fallbackPayload.surcharges.airports.heathrow.pickup);
    const baseDropoff = Number(surchargeRows.find((s) => s.code === 'AIRPORT_DROPOFF')?.amount ?? fallbackPayload.surcharges.airports.heathrow.dropoff);
    const airports = buildDefaultAirportSurcharges(basePickup, baseDropoff);
    for (const airport of AIRPORTS) {
      const pickupAmount = surchargeRows.find((s) => s.code === airport.pickupRuleCode)?.amount;
      const dropoffAmount = surchargeRows.find((s) => s.code === airport.dropoffRuleCode)?.amount;
      if (pickupAmount != null) airports[airport.code].pickup = Number(pickupAmount);
      if (dropoffAmount != null) airports[airport.code].dropoff = Number(dropoffAmount);
    }
    const surcharges = {
      congestion: Number(surchargeRows.find((s) => s.code === 'CONGESTION')?.amount ?? fallbackPayload.surcharges.congestion),
      airports,
    };

    const nightSurcharge = Number(settingsRows[0]?.night_surcharge ?? fallbackPayload.nightSurcharge);

    const zoneRings =
      zoneRingRows?.length
        ? zoneRingRows
            .map((z) => ({
              id: Number(z.id),
              name: z.name ?? `Zone ${z.id}`,
              radiusMiles: Number(z.radius_miles ?? 0),
            }))
            .filter((z) => z.radiusMiles > 0)
        : fallbackZoneRings;

    return NextResponse.json({ vehicles, surcharges, nightSurcharge, zoneRings });
  } catch (err) {
    console.error('Error fetching pricing', err);
    return NextResponse.json(fallbackPayload, { status: 200 });
  }
}
