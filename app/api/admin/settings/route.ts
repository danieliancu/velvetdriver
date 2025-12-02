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

type PricingPayload = {
  vehicles: Array<{
    code: string;
    label: string;
    asDirectedRate: number;
    mileage: { tier1: number; tier2: number; tier3: number };
    innerZoneOverride: number;
  }>;
  surcharges: { airportPickup: number; airportDropoff: number; congestion: number };
  nightSurcharge: number;
};

const fallbackPayload: PricingPayload = {
  vehicles: [
    { code: 'mpv', label: 'Luxury MPV', asDirectedRate: 60, mileage: { tier1: 20, tier2: 4, tier3: 3.5 }, innerZoneOverride: 20 },
    { code: 'luxury', label: 'Luxury', asDirectedRate: 60, mileage: { tier1: 8.75, tier2: 3.5, tier3: 3 }, innerZoneOverride: 8.75 },
    { code: 'executive', label: 'Executive', asDirectedRate: 40, mileage: { tier1: 6.25, tier2: 2.5, tier3: 2 }, innerZoneOverride: 6.25 },
  ],
  surcharges: { airportPickup: 15, airportDropoff: 7, congestion: 15 },
  nightSurcharge: 30,
};

export async function GET() {
  try {
    const [vehicleRows] = await pool.query<PricingVehicle[]>(
      'SELECT code, label, as_directed_rate, tier1_rate, tier2_rate, tier3_rate, inner_zone_override_rate FROM pricing_vehicles ORDER BY id'
    );
    const [surchargeRows] = await pool.query<{ code: string; amount: number }[]>(
      'SELECT code, amount FROM surcharge_rules WHERE code IN ("AIRPORT_PICKUP","AIRPORT_DROPOFF","CONGESTION")'
    );
    const [settingRows] = await pool.query<{ night_surcharge: number }[]>(
      'SELECT night_surcharge FROM pricing_settings WHERE id = 1 LIMIT 1'
    );

    if (!vehicleRows.length) {
      return NextResponse.json(fallbackPayload);
    }

    const vehicles = vehicleRows.map((v) => ({
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
      airportPickup: Number(surchargeRows.find((s) => s.code === 'AIRPORT_PICKUP')?.amount ?? fallbackPayload.surcharges.airportPickup),
      airportDropoff: Number(surchargeRows.find((s) => s.code === 'AIRPORT_DROPOFF')?.amount ?? fallbackPayload.surcharges.airportDropoff),
      congestion: Number(surchargeRows.find((s) => s.code === 'CONGESTION')?.amount ?? fallbackPayload.surcharges.congestion),
    };

    const nightSurcharge = Number(settingRows[0]?.night_surcharge ?? fallbackPayload.nightSurcharge);

    return NextResponse.json({ vehicles, surcharges, nightSurcharge });
  } catch (err) {
    console.error('Error loading pricing settings', err);
    return NextResponse.json(fallbackPayload, { status: 200 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as PricingPayload;
    const vehicles = body.vehicles ?? [];
    const surcharges = body.surcharges ?? fallbackPayload.surcharges;
    const nightSurcharge = body.nightSurcharge ?? fallbackPayload.nightSurcharge;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const v of vehicles) {
        await conn.execute(
          `INSERT INTO pricing_vehicles (code, label, as_directed_rate, tier1_rate, tier2_rate, tier3_rate, inner_zone_override_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             label = VALUES(label),
             as_directed_rate = VALUES(as_directed_rate),
             tier1_rate = VALUES(tier1_rate),
             tier2_rate = VALUES(tier2_rate),
             tier3_rate = VALUES(tier3_rate),
             inner_zone_override_rate = VALUES(inner_zone_override_rate)`,
          [
            v.code,
            v.label,
            v.asDirectedRate,
            v.mileage.tier1,
            v.mileage.tier2,
            v.mileage.tier3,
            v.innerZoneOverride,
          ]
        );
      }

      await conn.execute(
        `INSERT INTO pricing_settings (id, night_surcharge) VALUES (1, ?) ON DUPLICATE KEY UPDATE night_surcharge = VALUES(night_surcharge)`,
        [nightSurcharge]
      );

      const surchargeEntries: Array<[string, string, number]> = [
        ['AIRPORT_PICKUP', 'Airport pickup', surcharges.airportPickup],
        ['AIRPORT_DROPOFF', 'Airport drop-off', surcharges.airportDropoff],
        ['CONGESTION', 'Central London (Congestion)', surcharges.congestion],
      ];
      for (const [code, label, amount] of surchargeEntries) {
        await conn.execute(
          `INSERT INTO surcharge_rules (code, label, amount)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE label = VALUES(label), amount = VALUES(amount)`,
          [code, label, amount]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error saving pricing settings', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
