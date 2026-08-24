import { NextResponse } from 'next/server';
import { AIRPORTS, buildDefaultAirportSurcharges } from '@/lib/airports';
import { getDbPool, type DbRow } from '@/lib/db';
import {
  DEFAULT_AIRPORT_DROPOFF_SURCHARGE,
  DEFAULT_AIRPORT_PICKUP_SURCHARGE,
  DEFAULT_CONGESTION_SURCHARGE,
  DEFAULT_MINIMUM_PRICE_ACTIVE,
  DEFAULT_NIGHT_SURCHARGE,
  DEFAULT_PRICING_VEHICLES,
  DEFAULT_ZONE_RINGS,
} from '@/lib/pricing-defaults';

export const dynamic = 'force-dynamic';

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
  min_price: number;
}>;

type PricingVehicle = {
  id: number;
  code: string;
  label: string;
  asDirectedRate: number;
  mileage: { tier1: number; tier2: number; tier3: number };
  innerZoneOverride: number;
  minPrice: number;
};

type SurchargeRuleRow = DbRow<{ code: string; amount: number }>;

type PricingSettingRow = DbRow<{ night_surcharge: number; min_price_active: number }>;

type PricingPayload = {
  vehicles: PricingVehicle[];
  surcharges: {
    congestion: number;
    airports: ReturnType<typeof buildDefaultAirportSurcharges>;
  };
  nightSurcharge: number;
  minimumPriceActive: boolean;
  zoneRings: Array<{ id: number; name: string; radiusMiles: number }>;
};

const fallbackZoneRings = DEFAULT_ZONE_RINGS;

const fallbackPayload: PricingPayload = {
  vehicles: DEFAULT_PRICING_VEHICLES,
  surcharges: {
    congestion: DEFAULT_CONGESTION_SURCHARGE,
    airports: buildDefaultAirportSurcharges(DEFAULT_AIRPORT_PICKUP_SURCHARGE, DEFAULT_AIRPORT_DROPOFF_SURCHARGE),
  },
  nightSurcharge: DEFAULT_NIGHT_SURCHARGE,
  minimumPriceActive: DEFAULT_MINIMUM_PRICE_ACTIVE,
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
      'SELECT night_surcharge, min_price_active FROM pricing_settings WHERE id = 1 LIMIT 1'
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
      minPrice: Number(v.min_price ?? 0),
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
    const minimumPriceActive = Boolean(
      settingsRows[0]?.min_price_active ?? (fallbackPayload.minimumPriceActive ? 1 : 0)
    );

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

    return NextResponse.json({ vehicles, surcharges, nightSurcharge, minimumPriceActive, zoneRings });
  } catch (err) {
    console.error('Error fetching pricing', err);
    return NextResponse.json(fallbackPayload, { status: 200 });
  }
}
