import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { detectAirportCodeFromText, type AirportCode, buildDefaultAirportSurcharges, AIRPORTS } from '@/lib/airports';
import { getDbPool } from '@/lib/db';
import { computeGoogleRoute } from '@/lib/google-routes';

const pool = getDbPool();

type JourneyRow = mysql.RowDataPacket & {
  id: number;
  client_id: number | null;
  journey_date: string;
  pickup: string;
  destination: string;
  service_type: string | null;
  vehicle_type_id: number | null;
  price: number | string;
  status: string;
  booking_payload: unknown;
  passenger_email: string | null;
};

type PricingVehicle = {
  id: number;
  code: string;
  label: string;
  as_directed_rate: number;
  tier1_rate: number;
  tier2_rate: number;
  tier3_rate: number;
};
type PricingVehicleRow = mysql.RowDataPacket & PricingVehicle;

type SurchargeRuleRow = mysql.RowDataPacket & { code: string; amount: number };
type SettingsRow = mysql.RowDataPacket & { night_surcharge: number };

const defaultVehiclePricing = {
  id: 1,
  code: 'executive',
  label: 'Executive',
  as_directed_rate: 40,
  tier1_rate: 6.25,
  tier2_rate: 2.5,
  tier3_rate: 2,
};

const defaultAirportSurcharges = buildDefaultAirportSurcharges(15, 7);

const detectPickupAirport = (pickup: string): AirportCode | null => detectAirportCodeFromText(pickup);
const detectDropAirportCodes = (dropOff: string): AirportCode[] => {
  const code = detectAirportCodeFromText(dropOff);
  return code ? [code] : [];
};

const getRate = (vehicle: PricingVehicle, miles: number) => {
  if (miles <= 10) return Number(vehicle.tier1_rate);
  if (miles <= 40) return Number(vehicle.tier2_rate);
  return Number(vehicle.tier3_rate);
};

const isNightTime = (time: string) => {
  const [hoursStr] = time.split(':');
  const hours = Number(hoursStr);
  if (Number.isNaN(hours)) return false;
  return hours >= 23 || hours < 4;
};

async function resolveClientId(email?: string | null) {
  if (!email) return null;
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [String(email).trim().toLowerCase()]
  );
  return rows[0]?.id ? Number(rows[0].id) : null;
}

async function loadPricing() {
  const [vehicleRows] = await pool.query<PricingVehicleRow[]>('SELECT id, code, label, as_directed_rate, tier1_rate, tier2_rate, tier3_rate FROM pricing_vehicles');
  const [surchargeRows] = await pool.query<SurchargeRuleRow[]>(
    `SELECT code, amount FROM surcharge_rules WHERE code IN (${[
      'AIRPORT_PICKUP',
      'AIRPORT_DROPOFF',
      ...AIRPORTS.flatMap((airport) => [airport.pickupRuleCode, airport.dropoffRuleCode]),
    ]
      .map(() => '?')
      .join(',')})`,
    ['AIRPORT_PICKUP', 'AIRPORT_DROPOFF', ...AIRPORTS.flatMap((airport) => [airport.pickupRuleCode, airport.dropoffRuleCode])]
  );
  const [settingsRows] = await pool
    .query<SettingsRow[]>('SELECT night_surcharge FROM pricing_settings WHERE id = 1 LIMIT 1')
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
    vehicles: vehicleRows.length ? vehicleRows : [defaultVehiclePricing],
    airportSurcharges,
    nightSurcharge: Number(settingsRows[0]?.night_surcharge ?? 30),
  };
}

async function computeMiles(pickup: string, dropOff: string) {
  try {
    const route = await computeGoogleRoute({ origin: pickup, destination: dropOff });
    if (!route.distanceMeters) return 0;
    return route.distanceMeters * 0.000621371;
  } catch {
    return 0;
  }
}

function buildDestination(dropOff: string) {
  return dropOff.trim();
}

async function logAdminNotification(input: {
  journeyId: number;
  email: string;
  delta: number;
  pickup: string;
  dropOff: string;
  journeyDateIso: string;
}) {
  const deltaText =
    input.delta > 0
      ? `Price increased by GBP ${input.delta.toFixed(2)}`
      : input.delta < 0
        ? `Credit GBP ${Math.abs(input.delta).toFixed(2)}`
        : 'No fare change';
  const message = `${input.email} modified booking VD_${input.journeyId}. ${deltaText}.`;
  const tags = JSON.stringify({
    journeyId: input.journeyId,
    email: input.email,
    delta: Number(input.delta.toFixed(2)),
    pickup: input.pickup,
    dropOff: input.dropOff,
    journeyDateIso: input.journeyDateIso,
  });

  try {
    await pool.execute(
      `INSERT INTO admin_notifications (category, title, message, severity, tags, related_table, related_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['bookings', `Booking modified (VD_${input.journeyId})`, message, 'info', tags, 'client_journeys', input.journeyId]
    );
  } catch (err) {
    console.error('Failed to log booking modification notification', err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || 'preview').toLowerCase();
    const email = String(body.email ?? '').trim().toLowerCase();
    const journeyId = Number(body.journeyId);
    const mode = String(body.mode || 'client').toLowerCase();

    const pickup = String(body.pickup ?? '').trim();
    const dropOff = String(body.dropOff ?? '').trim();
    const date = String(body.date ?? '').trim();
    const time = String(body.time ?? '').trim();
    const flightNumber = String(body.flightNumber ?? '').trim().toUpperCase();
    const passengers = Math.max(1, Number(body.passengers) || 1);
    const specialRequests = String(body.specialRequests ?? '').trim();

    if (!email || !journeyId) {
      return NextResponse.json({ error: 'Missing journey reference' }, { status: 400 });
    }
    if (!pickup || !dropOff || !date || !time) {
      return NextResponse.json({ error: 'Pickup, drop-off, date and time are required.' }, { status: 400 });
    }

    const clientId = await resolveClientId(email);
    if (!clientId) {
      return NextResponse.json({ error: 'Client account not found.' }, { status: 404 });
    }

    const [rows] = await pool.query<JourneyRow[]>(
      `SELECT id, client_id, journey_date, pickup, destination, service_type, vehicle_type_id, price, status, booking_payload, passenger_email
       FROM client_journeys
       WHERE id = ? AND client_id = ?
       LIMIT 1`,
      [journeyId, clientId]
    );
    const journey = rows[0];
    if (!journey) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }
    if (journey.status !== 'Upcoming') {
      return NextResponse.json({ error: 'Only upcoming bookings can be modified.' }, { status: 400 });
    }

    const originalJourneyDate = new Date(journey.journey_date);
    const hoursUntilPickup = (originalJourneyDate.getTime() - Date.now()) / (1000 * 60 * 60);
    const isLockedByWindow = hoursUntilPickup < 6;
    const bypassTimeLimit = mode === 'admin';
    if (isLockedByWindow && !bypassTimeLimit) {
      return NextResponse.json(
        {
          error: 'Changes are complimentary up to 6 hours before pickup. Within 6 hours, please contact our team directly.',
          withinSixHours: true,
        },
        { status: 403 }
      );
    }

    let payload: Record<string, any> = {};
    if (journey.booking_payload) {
      try {
        payload =
          typeof journey.booking_payload === 'string'
            ? JSON.parse(journey.booking_payload)
            : (journey.booking_payload as Record<string, any>);
      } catch {
        payload = {};
      }
    }

    const pricing = await loadPricing();
    const vehicle =
      pricing.vehicles.find((v) => Number(v.id) === Number(journey.vehicle_type_id)) ||
      pricing.vehicles.find((v) => v.label === String(payload.vehicle || '')) ||
      pricing.vehicles[0] ||
      defaultVehiclePricing;

    const serviceType = String(payload.serviceType || journey.service_type || 'Transfer');
    const waitingMinutes = Math.max(0, Number(payload.waiting) || 0);
    const miles = await computeMiles(pickup, dropOff);

    const mileageRate = getRate(vehicle, miles);
    let recalculatedFare =
      serviceType === 'As Directed' ? Number(vehicle.as_directed_rate) : miles * mileageRate;

    if (serviceType !== 'As Directed' && waitingMinutes > 0) {
      recalculatedFare += waitingMinutes * (Number(vehicle.as_directed_rate) / 60);
    }
    if (isNightTime(time)) {
      recalculatedFare += pricing.nightSurcharge;
    }
    if (serviceType === 'Wait and Return') {
      recalculatedFare *= 2;
    }

    const pickupAirport = detectPickupAirport(pickup);
    const dropAirports = detectDropAirportCodes(dropOff);
    if (pickupAirport) {
      recalculatedFare += pricing.airportSurcharges[pickupAirport]?.pickup ?? defaultAirportSurcharges[pickupAirport].pickup;
    }
    for (const code of dropAirports) {
      recalculatedFare += pricing.airportSurcharges[code]?.dropoff ?? defaultAirportSurcharges[code].dropoff;
    }

    const oldPrice = Number(journey.price || 0);
    const newPrice = Math.round(recalculatedFare * 100) / 100;
    const difference = Math.round((newPrice - oldPrice) * 100) / 100;

    if (action !== 'confirm') {
      return NextResponse.json({
        ok: true,
        oldPrice,
        newPrice,
        difference,
        payNowAmount: difference > 0 ? difference : 0,
        creditAmount: difference < 0 ? Math.abs(difference) : 0,
        withinSixHours: isLockedByWindow,
      });
    }

    const journeyDate = new Date(`${date}T${time}`);
    if (Number.isNaN(journeyDate.getTime())) {
      return NextResponse.json({ error: 'Invalid pickup time.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const previousState = {
      journeyDate: journey.journey_date,
      pickup: journey.pickup,
      destination: journey.destination,
      flightNumber: String(payload.flightNumber || '').trim(),
      passengers: Number(payload.passengers || 1),
      specialRequests: String(payload.specialEvents || payload.notes || '').trim(),
      price: oldPrice,
    };

    const historyEntry = {
      timestamp: nowIso,
      actor: mode === 'admin' ? 'admin' : 'client',
      previous: previousState,
      next: {
        journeyDate: journeyDate.toISOString(),
        pickup,
        destination: dropOff,
        flightNumber,
        passengers,
        specialRequests,
        price: newPrice,
      },
      difference,
    };

    const history = Array.isArray(payload.modificationHistory) ? payload.modificationHistory : [];
    const specialEventParts = specialRequests
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);
    const primarySpecialEvent = specialEventParts[0] || specialRequests;
    const remainingNotes = specialEventParts.slice(1).join(' | ');

    const updatedPayload = {
      ...payload,
      pickup,
      dropOffs: [dropOff],
      date,
      time,
      miles: miles.toFixed(2),
      totalFare: newPrice,
      flightNumber,
      passengers: String(passengers),
      specialEvents: primarySpecialEvent,
      notes: remainingNotes,
      lastModifiedAt: nowIso,
      modificationHistory: [...history, historyEntry],
      modificationPayment:
        difference > 0
          ? { status: 'pending', amount: difference, requiredMessage: `Pay GBP ${difference.toFixed(2)} to confirm changes.` }
          : difference < 0
            ? { status: 'credit', amount: Math.abs(difference), note: 'Credit will be applied to your next booking.' }
            : { status: 'none', amount: 0 },
    };

    await pool.execute(
      `UPDATE client_journeys
       SET journey_date = ?, pickup = ?, destination = ?, price = ?, booking_payload = ?, updated_at = NOW()
       WHERE id = ? AND client_id = ?
       LIMIT 1`,
      [
        journeyDate.toISOString().slice(0, 19).replace('T', ' '),
        pickup,
        buildDestination(dropOff),
        newPrice,
        JSON.stringify(updatedPayload),
        journeyId,
        clientId,
      ]
    );

    await logAdminNotification({
      journeyId,
      email,
      delta: difference,
      pickup,
      dropOff,
      journeyDateIso: journeyDate.toISOString(),
    });

    return NextResponse.json({
      ok: true,
      updated: true,
      oldPrice,
      newPrice,
      difference,
      withinSixHours: isLockedByWindow,
    });
  } catch (err) {
    console.error('Modify booking error', err);
    return NextResponse.json({ error: 'Failed to modify booking.' }, { status: 500 });
  }
}
