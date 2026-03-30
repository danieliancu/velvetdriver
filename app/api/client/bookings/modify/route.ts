import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { detectAirportCodeFromText, type AirportCode, buildDefaultAirportSurcharges, AIRPORTS } from '@/lib/airports';
import { getDbPool } from '@/lib/db';
import { computeGoogleRoute } from '@/lib/google-routes';
import { addClientCredit } from '@/lib/client-credit';

const pool = getDbPool();
const AUTHORIZED_PAYMENT_STATUSES = new Set([
  'requires_capture',
  'authorized',
  'authorization_updated',
  'additional_authorization_created',
  'succeeded',
]);

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
  passenger_name: string | null;
  driver_name: string | null;
  driver_commission_applied: number | string | null;
  driver_price: number | string | null;
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
type DriverRecipientRow = mysql.RowDataPacket & {
  driver_email: string | null;
  driver_name_display: string | null;
};

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
const TIME_EDIT_WINDOW_HOURS = 2;

const detectPickupAirport = (pickup: string): AirportCode | null => detectAirportCodeFromText(pickup);
const detectDropAirportCodes = (dropOffs: string[]): AirportCode[] =>
  dropOffs
    .map((stop) => detectAirportCodeFromText(stop))
    .filter((code): code is AirportCode => Boolean(code));

const stripStopLabel = (value: string) => value.replace(/^Stop\s+\d+:\s*/i, '').trim();
const parseDestinationStops = (destination: string) => {
  const raw = String(destination || '').trim();
  if (!raw) return [''];
  if (!raw.includes('Stop ')) return [raw];
  return raw
    .split(', ')
    .map((part) => stripStopLabel(part))
    .filter(Boolean);
};

const ADMIN_BOOKING_MODIFY_EMAILS = ['roxy.viulet@gmail.com', 'dani.iancu@yahoo.com'];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '-', time: '-' };
  return {
    date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
};

const getDriverNetAmount = (fare: number, commissionApplied?: number | string | null, existingDriverPrice?: number | string | null) => {
  const commission = Number(commissionApplied);
  if (Number.isFinite(commission) && commission >= 0) {
    return Math.round(fare * (1 - commission / 100) * 100) / 100;
  }
  const fallback = Number(existingDriverPrice);
  return Number.isFinite(fallback) ? fallback : fare;
};

async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!resendApiKey || !emailFrom) {
    throw new Error('Email service is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || `Resend error ${response.status}`);
  }
}

async function resolveAssignedDriverRecipient(journeyId: number): Promise<{ email: string | null; name: string }> {
  const [rows] = await pool.query<DriverRecipientRow[]>(
    `SELECT u.email AS driver_email,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', d.first_and_middle_name, d.surname)), ''), cj.driver_name) AS driver_name_display
       FROM client_journeys cj
       LEFT JOIN drivers d
         ON d.id = CASE
                     WHEN cj.driver_name REGEXP '^[0-9]+$' THEN CAST(cj.driver_name AS UNSIGNED)
                     ELSE NULL
                   END
       LEFT JOIN users u ON u.id = d.user_id
      WHERE cj.id = ?
      LIMIT 1`,
    [journeyId]
  );

  const row = rows[0];
  return {
    email: row?.driver_email ? String(row.driver_email).trim().toLowerCase() : null,
    name: String(row?.driver_name_display || 'Chauffeur').trim() || 'Chauffeur',
  };
}

async function sendModificationEmails(input: {
  journeyId: number;
  clientEmail: string;
  clientName: string;
  passengerName: string;
  oldPrice: number;
  newPrice: number;
  oldDriverPrice: number;
  newDriverPrice: number;
  driverCommissionApplied: number | null;
  difference: number;
  previousState: {
    journeyDate: string;
    pickup: string;
    destination: string;
    flightNumber: string;
    passengers: number;
    specialRequests: string;
  };
  nextState: {
    journeyDate: string;
    pickup: string;
    destination: string;
    flightNumber: string;
    passengers: number;
    specialRequests: string;
  };
}) {
  const warnings: string[] = [];
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!resendApiKey || !emailFrom) {
    return ['Booking updated, but email service is not configured.'];
  }

  const bookingCode = `VD-${String(input.journeyId).padStart(4, '0')}`;
  const before = formatDateTime(input.previousState.journeyDate);
  const after = formatDateTime(input.nextState.journeyDate);
  const changeLine =
    input.difference > 0
      ? `Fare increased by GBP ${input.difference.toFixed(2)}`
      : input.difference < 0
        ? `Credit due GBP ${Math.abs(input.difference).toFixed(2)}`
        : 'No fare change';
  const driverChangeLine =
    input.newDriverPrice > input.oldDriverPrice
      ? `Your amount increased by GBP ${(input.newDriverPrice - input.oldDriverPrice).toFixed(2)}`
      : input.newDriverPrice < input.oldDriverPrice
        ? `Your amount decreased by GBP ${(input.oldDriverPrice - input.newDriverPrice).toFixed(2)}`
        : 'No payable change';

  const summaryRows = `
    <tr><td style="padding:6px 0;font-weight:700;">Reference</td><td style="padding:6px 0;">${escapeHtml(bookingCode)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Old pickup</td><td style="padding:6px 0;">${escapeHtml(input.previousState.pickup)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">New pickup</td><td style="padding:6px 0;">${escapeHtml(input.nextState.pickup)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Old destination</td><td style="padding:6px 0;">${escapeHtml(input.previousState.destination)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">New destination</td><td style="padding:6px 0;">${escapeHtml(input.nextState.destination)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Old date/time</td><td style="padding:6px 0;">${escapeHtml(`${before.date} ${before.time}`)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">New date/time</td><td style="padding:6px 0;">${escapeHtml(`${after.date} ${after.time}`)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Old flight</td><td style="padding:6px 0;">${escapeHtml(input.previousState.flightNumber || '-')}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">New flight</td><td style="padding:6px 0;">${escapeHtml(input.nextState.flightNumber || '-')}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Old passengers</td><td style="padding:6px 0;">${input.previousState.passengers}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">New passengers</td><td style="padding:6px 0;">${input.nextState.passengers}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Old requests</td><td style="padding:6px 0;">${escapeHtml(input.previousState.specialRequests || '-')}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">New requests</td><td style="padding:6px 0;">${escapeHtml(input.nextState.specialRequests || '-')}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Old fare</td><td style="padding:6px 0;">GBP ${input.oldPrice.toFixed(2)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">New fare</td><td style="padding:6px 0;">GBP ${input.newPrice.toFixed(2)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Change</td><td style="padding:6px 0;">${escapeHtml(changeLine)}</td></tr>
  `;

  const clientHtml = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
    <h2 style="margin:0 0 16px;">Booking updated</h2>
    <p style="margin:0 0 16px;">Hello ${escapeHtml(input.clientName || input.passengerName || 'Client')}, your booking has been updated successfully.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;">${summaryRows}</table>
  </div>
</body>
</html>`;
  const clientText = [
    `Booking updated: ${bookingCode}`,
    `Old pickup: ${input.previousState.pickup}`,
    `New pickup: ${input.nextState.pickup}`,
    `Old destination: ${input.previousState.destination}`,
    `New destination: ${input.nextState.destination}`,
    `Old date/time: ${before.date} ${before.time}`,
    `New date/time: ${after.date} ${after.time}`,
    `Change: ${changeLine}`,
  ].join('\n');

  try {
    await sendEmail({
      to: input.clientEmail,
      subject: `Velvet Drivers - Booking updated ${bookingCode}`,
      html: clientHtml,
      text: clientText,
    });
  } catch (err) {
    console.error('Client modification email error', err);
    warnings.push('Booking updated, but client email could not be sent.');
  }

  const assignedDriver = await resolveAssignedDriverRecipient(input.journeyId);
  if (assignedDriver.email) {
    const driverHtml = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
    <h2 style="margin:0 0 16px;">Assigned booking updated</h2>
    <p style="margin:0 0 16px;">Hello ${escapeHtml(assignedDriver.name)}, booking ${escapeHtml(bookingCode)} assigned to you was modified by the client.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      ${summaryRows}
      <tr><td style="padding:6px 0;font-weight:700;">Commission applied</td><td style="padding:6px 0;">${input.driverCommissionApplied != null ? `${input.driverCommissionApplied.toFixed(2)}%` : '-'}</td></tr>
      <tr><td style="padding:6px 0;font-weight:700;">Old your amount</td><td style="padding:6px 0;">GBP ${input.oldDriverPrice.toFixed(2)}</td></tr>
      <tr><td style="padding:6px 0;font-weight:700;">New your amount</td><td style="padding:6px 0;">GBP ${input.newDriverPrice.toFixed(2)}</td></tr>
      <tr><td style="padding:6px 0;font-weight:700;">Your change</td><td style="padding:6px 0;">${escapeHtml(driverChangeLine)}</td></tr>
    </table>
  </div>
</body>
</html>`;
    const driverText = [
      `Assigned booking updated: ${bookingCode}`,
      `Passenger: ${input.passengerName}`,
      `New pickup: ${input.nextState.pickup}`,
      `New destination: ${input.nextState.destination}`,
      `New date/time: ${after.date} ${after.time}`,
      `Commission applied: ${input.driverCommissionApplied != null ? `${input.driverCommissionApplied.toFixed(2)}%` : '-'}`,
      `Old your amount: GBP ${input.oldDriverPrice.toFixed(2)}`,
      `New your amount: GBP ${input.newDriverPrice.toFixed(2)}`,
      `Your change: ${driverChangeLine}`,
    ].join('\n');

    try {
      await sendEmail({
        to: assignedDriver.email,
        subject: `Velvet Drivers - Booking updated ${bookingCode}`,
        html: driverHtml,
        text: driverText,
      });
    } catch (err) {
      console.error('Driver modification email error', err);
      warnings.push('Booking updated, but driver email could not be sent.');
    }
  } else {
    warnings.push('Booking updated, but no allocated driver email was found.');
  }

  const adminHtml = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
    <h2 style="margin:0 0 16px;">Booking modified by client</h2>
    <p style="margin:0 0 16px;">Client ${escapeHtml(input.clientEmail)} modified booking ${escapeHtml(bookingCode)}.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;">${summaryRows}</table>
  </div>
</body>
</html>`;
  const adminText = [
    `Booking modified by client: ${bookingCode}`,
    `Client: ${input.clientEmail}`,
    `Passenger: ${input.passengerName}`,
    `New pickup: ${input.nextState.pickup}`,
    `New destination: ${input.nextState.destination}`,
    `New date/time: ${after.date} ${after.time}`,
    `Change: ${changeLine}`,
  ].join('\n');

  try {
    await sendEmail({
      to: ADMIN_BOOKING_MODIFY_EMAILS,
      subject: `Velvet Drivers Admin - Booking updated ${bookingCode}`,
      html: adminHtml,
      text: adminText,
    });
  } catch (err) {
    console.error('Admin modification email error', err);
    warnings.push('Booking updated, but admin email could not be sent.');
  }

  return warnings;
}

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

const formatTimeValue = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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

async function computeMiles(pickup: string, dropOffs: string[]) {
  try {
    const cleanedStops = dropOffs.map((stop) => String(stop || '').trim()).filter(Boolean);
    if (!cleanedStops.length) return 0;
    const route = await computeGoogleRoute({
      origin: pickup,
      destination: cleanedStops[cleanedStops.length - 1],
      intermediates: cleanedStops.slice(0, -1),
    });
    if (!route.distanceMeters) return 0;
    return route.distanceMeters * 0.000621371;
  } catch {
    return 0;
  }
}

function buildDestination(dropOffs: string[]) {
  return dropOffs
    .map((stop, index) =>
      index === dropOffs.length - 1 ? String(stop || '').trim() : `Stop ${index + 1}: ${String(stop || '').trim()}`
    )
    .filter(Boolean)
    .join(', ');
}

async function logAdminNotification(input: {
  journeyId: number;
  email: string;
  delta: number;
  pickup: string;
  dropOffs: string[];
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
    dropOffs: input.dropOffs,
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
    const dropOffs = Array.isArray(body.dropOffs)
      ? body.dropOffs.map((value: string) => String(value || '').trim()).filter(Boolean)
      : parseDestinationStops(String(body.dropOff ?? '').trim());
    const date = String(body.date ?? '').trim();
    const time = String(body.time ?? '').trim();
    const flightNumber = String(body.flightNumber ?? '').trim().toUpperCase();
    const passengers = Math.max(1, Number(body.passengers) || 1);
    const specialRequests = String(body.specialRequests ?? '').trim();
    const paymentIntentId = String(body.paymentIntentId ?? '').trim();
    const paymentStatus = String(body.paymentStatus ?? '').trim().toLowerCase();
    const paymentMethod = String(body.paymentMethod ?? '').trim();

    if (!email || !journeyId) {
      return NextResponse.json({ error: 'Missing journey reference' }, { status: 400 });
    }
    if (!pickup || !dropOffs.length || !date || !time) {
      return NextResponse.json({ error: 'Pickup, destination, date and time are required.' }, { status: 400 });
    }

    const clientId = await resolveClientId(email);
    if (!clientId) {
      return NextResponse.json({ error: 'Client account not found.' }, { status: 404 });
    }

    const [rows] = await pool.query<JourneyRow[]>(
      `SELECT id, client_id, journey_date, pickup, destination, service_type, vehicle_type_id, price, status, booking_payload, passenger_email, passenger_name, driver_name, driver_commission_applied, driver_price
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
    const isTimeLocked = hoursUntilPickup < TIME_EDIT_WINDOW_HOURS;
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
    const miles = await computeMiles(pickup, dropOffs);

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
    const dropAirports = detectDropAirportCodes(dropOffs);
    if (pickupAirport) {
      recalculatedFare += pricing.airportSurcharges[pickupAirport]?.pickup ?? defaultAirportSurcharges[pickupAirport].pickup;
    }
    for (const code of dropAirports) {
      recalculatedFare += pricing.airportSurcharges[code]?.dropoff ?? defaultAirportSurcharges[code].dropoff;
    }

    const oldPrice = Number(journey.price || 0);
    const newPrice = Math.round(recalculatedFare * 100) / 100;
    const commissionAppliedRaw = journey.driver_commission_applied != null ? Number(journey.driver_commission_applied) : null;
    const oldDriverPrice = getDriverNetAmount(oldPrice, commissionAppliedRaw, journey.driver_price);
    const newDriverPrice = getDriverNetAmount(newPrice, commissionAppliedRaw, journey.driver_price);
    const difference = Math.round((newPrice - oldPrice) * 100) / 100;

    if (isTimeLocked && formatTimeValue(originalJourneyDate) !== time) {
      return NextResponse.json(
        { error: 'Pickup time can no longer be changed within 2 hours of the journey.' },
        { status: 403 }
      );
    }

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
    if (difference > 0 && !AUTHORIZED_PAYMENT_STATUSES.has(paymentStatus)) {
      return NextResponse.json(
        { error: 'Additional payment is required before the booking can be updated.', requiresPayment: true, amountDue: difference },
        { status: 402 }
      );
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
        destination: buildDestination(dropOffs),
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
      dropOffs,
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
          ? {
              status: AUTHORIZED_PAYMENT_STATUSES.has(paymentStatus) ? 'authorized' : paymentStatus || 'pending',
              amount: difference,
              paymentIntentId: paymentIntentId || null,
              paymentMethod: paymentMethod || 'Card authorization',
              paidAt: nowIso,
            }
          : difference < 0
            ? { status: 'credit', amount: Math.abs(difference), note: 'Credit will be applied to your next booking.', createdAt: nowIso }
            : { status: 'none', amount: 0 },
    };

    await pool.execute(
      `UPDATE client_journeys
       SET journey_date = ?, pickup = ?, destination = ?, price = ?, driver_price = ?, booking_payload = ?, updated_at = NOW()
       WHERE id = ? AND client_id = ?
       LIMIT 1`,
      [
        journeyDate.toISOString().slice(0, 19).replace('T', ' '),
        pickup,
        buildDestination(dropOffs),
        newPrice,
        newDriverPrice,
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
      dropOffs,
      journeyDateIso: journeyDate.toISOString(),
    });

    if (difference < 0) {
      await addClientCredit(pool, {
        clientId,
        journeyId,
        amount: Math.abs(difference),
        reason: 'Credit from booking modification',
        metadata: {
          source: 'modify-booking',
          oldPrice,
          newPrice,
        },
      });
    }

    const emailWarnings = await sendModificationEmails({
      journeyId,
      clientEmail: email,
      clientName: String(payload.passengerName || journey.passenger_name || '').trim(),
      passengerName: String(journey.passenger_name || payload.passengerName || 'Client').trim(),
      oldPrice,
      newPrice,
      oldDriverPrice,
      newDriverPrice,
      driverCommissionApplied: commissionAppliedRaw,
      difference,
      previousState,
      nextState: {
        journeyDate: journeyDate.toISOString(),
        pickup,
        destination: buildDestination(dropOffs),
        flightNumber,
        passengers,
        specialRequests,
      },
    });

    return NextResponse.json({
      ok: true,
      updated: true,
      oldPrice,
      newPrice,
      difference,
      withinSixHours: isLockedByWindow,
      warnings: emailWarnings,
      creditIssued: difference < 0 ? Math.abs(difference) : 0,
    });
  } catch (err) {
    console.error('Modify booking error', err);
    return NextResponse.json({ error: 'Failed to modify booking.' }, { status: 500 });
  }
}
