import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { AIRPORTS, buildDefaultAirportSurcharges, type AirportCode, type AirportSurcharge } from '@/lib/airports';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

type PricingVehicleRow = mysql.RowDataPacket & {
  code: string;
  label: string;
  as_directed_rate: number;
  tier1_rate: number;
  tier2_rate: number;
  tier3_rate: number;
  inner_zone_override_rate: number;
  min_price: number;
};

type PricingVehicle = {
  code: string;
  label: string;
  asDirectedRate: number;
  mileage: { tier1: number; tier2: number; tier3: number };
  innerZoneOverride: number;
  minPrice: number;
};

type SurchargeRow = mysql.RowDataPacket & { code: string; amount: number };

type PricingSettingRow = mysql.RowDataPacket & { night_surcharge: number; min_price_active: number };

type PricingPayload = {
  vehicles: Array<{
    code: string;
    label: string;
    asDirectedRate: number;
    mileage: { tier1: number; tier2: number; tier3: number };
    innerZoneOverride: number;
    minPrice: number;
  }>;
  surcharges: { congestion: number; airports: Record<AirportCode, AirportSurcharge> };
  nightSurcharge: number;
  minimumPriceActive: boolean;
};

const fallbackPayload: PricingPayload = {
  vehicles: [
    { code: 'mpv', label: 'Luxury MPV', asDirectedRate: 60, mileage: { tier1: 20, tier2: 4, tier3: 3.5 }, innerZoneOverride: 20, minPrice: 50 },
    { code: 'luxury', label: 'Luxury', asDirectedRate: 60, mileage: { tier1: 8.75, tier2: 3.5, tier3: 3 }, innerZoneOverride: 8.75, minPrice: 40 },
    { code: 'executive', label: 'Executive', asDirectedRate: 40, mileage: { tier1: 6.25, tier2: 2.5, tier3: 2 }, innerZoneOverride: 6.25, minPrice: 30 },
  ],
  surcharges: { congestion: 15, airports: buildDefaultAirportSurcharges(15, 7) },
  nightSurcharge: 30,
  minimumPriceActive: true,
};

export async function GET() {
  try {
    const [vehicleRows] = await pool.query<PricingVehicleRow[]>(
      'SELECT code, label, as_directed_rate, tier1_rate, tier2_rate, tier3_rate, inner_zone_override_rate, min_price FROM pricing_vehicles ORDER BY id'
    );
    const surchargeCodes = [
      'AIRPORT_PICKUP',
      'AIRPORT_DROPOFF',
      'CONGESTION',
      ...AIRPORTS.flatMap((airport) => [airport.pickupRuleCode, airport.dropoffRuleCode]),
    ];
    const [surchargeRows] = await pool.query<SurchargeRow[]>(
      `SELECT code, amount FROM surcharge_rules WHERE code IN (${surchargeCodes.map(() => '?').join(',')})`,
      surchargeCodes
    );
    const [settingRows] = await pool.query<PricingSettingRow[]>(
      'SELECT night_surcharge, min_price_active FROM pricing_settings WHERE id = 1 LIMIT 1'
    );

    if (!vehicleRows.length) {
      return NextResponse.json(fallbackPayload);
    }

    const vehicles: PricingVehicle[] = vehicleRows.map((v) => ({
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
    }));

    const basePickup = Number(
      surchargeRows.find((s) => s.code === 'AIRPORT_PICKUP')?.amount ??
        fallbackPayload.surcharges.airports.heathrow.pickup
    );
    const baseDropoff = Number(
      surchargeRows.find((s) => s.code === 'AIRPORT_DROPOFF')?.amount ??
        fallbackPayload.surcharges.airports.heathrow.dropoff
    );
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

    const nightSurcharge = Number(settingRows[0]?.night_surcharge ?? fallbackPayload.nightSurcharge);
    const minimumPriceActive = Boolean(settingRows[0]?.min_price_active ?? (fallbackPayload.minimumPriceActive ? 1 : 0));

    return NextResponse.json({ vehicles, surcharges, nightSurcharge, minimumPriceActive });
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
    const airports = surcharges.airports ?? fallbackPayload.surcharges.airports;
    const nightSurcharge = body.nightSurcharge ?? fallbackPayload.nightSurcharge;
    const minimumPriceActive = body.minimumPriceActive ?? fallbackPayload.minimumPriceActive;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const v of vehicles) {
        await conn.execute(
          `INSERT INTO pricing_vehicles (code, label, as_directed_rate, tier1_rate, tier2_rate, tier3_rate, inner_zone_override_rate, min_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             label = VALUES(label),
             as_directed_rate = VALUES(as_directed_rate),
             tier1_rate = VALUES(tier1_rate),
             tier2_rate = VALUES(tier2_rate),
             tier3_rate = VALUES(tier3_rate),
             inner_zone_override_rate = VALUES(inner_zone_override_rate),
             min_price = VALUES(min_price)`,
          [
            v.code,
            v.label,
            v.asDirectedRate,
            v.mileage.tier1,
            v.mileage.tier2,
            v.mileage.tier3,
            v.innerZoneOverride,
            v.minPrice ?? 0,
          ]
        );
      }

      await conn.execute(
        `INSERT INTO pricing_settings (id, night_surcharge, min_price_active)
         VALUES (1, ?, ?)
         ON DUPLICATE KEY UPDATE
           night_surcharge = VALUES(night_surcharge),
           min_price_active = VALUES(min_price_active)`,
        [nightSurcharge, minimumPriceActive ? 1 : 0]
      );

      const airportEntries = AIRPORTS.flatMap(
        (airport) =>
          [
            [airport.pickupRuleCode, `${airport.label} pickup`, airports[airport.code]?.pickup ?? 0],
            [airport.dropoffRuleCode, `${airport.label} drop-off`, airports[airport.code]?.dropoff ?? 0],
          ] as Array<[string, string, number]>
      );
      const surchargeEntries: Array<[string, string, number]> = [
        ['CONGESTION', 'Central London (Congestion)', surcharges.congestion],
        ...airportEntries,
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

export async function POST(request: Request) {
  return PUT(request);
}
