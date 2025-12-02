import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

type PricingVehicle = {
  code: string;
  label: string;
  as_directed_rate: number;
  tier1_rate: number;
  tier2_rate: number;
  tier3_rate: number;
  inner_zone_override_rate: number;
};

type SurchargeRule = { code: string; amount: number };

export async function GET() {
  try {
    const [vehiclesRows] = await pool.query<PricingVehicle[]>('SELECT * FROM pricing_vehicles ORDER BY id');
    const [surchargeRows] = await pool.query<SurchargeRule[]>(
      'SELECT code, amount FROM surcharge_rules WHERE code IN ("AIRPORT_PICKUP","AIRPORT_DROPOFF","CONGESTION")'
    );
    const [settingsRows] = await pool.query<{ night_surcharge: number }[]>(
      'SELECT night_surcharge FROM pricing_settings WHERE id = 1 LIMIT 1'
    );

    const vehicles = vehiclesRows.map((v) => ({
      code: v.code,
      label: v.label,
      asDirectedRate: Number(v.as_directed_rate),
      mileage: {
        tier1: Number(v.tier1_rate),
        tier2: Number(v.tier2_rate),
        tier3: Number(v.tier3_rate),
      },
      innerZoneOverride: Number(v.inner_zone_override_rate),
    }));

    const surcharges = {
      airportPickup: Number(surchargeRows.find((s) => s.code === 'AIRPORT_PICKUP')?.amount ?? 0),
      airportDropoff: Number(surchargeRows.find((s) => s.code === 'AIRPORT_DROPOFF')?.amount ?? 0),
      congestion: Number(surchargeRows.find((s) => s.code === 'CONGESTION')?.amount ?? 0),
    };

    const nightSurcharge = Number(settingsRows[0]?.night_surcharge ?? 0);

    return NextResponse.json({ vehicles, surcharges, nightSurcharge });
  } catch (err) {
    console.error('Error fetching pricing', err);
    return NextResponse.json({ error: 'Failed to load pricing' }, { status: 500 });
  }
}
