import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { resolveDropOffs } from '@/lib/journey-locations';

const pool = getDbPool();

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  return {
    date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
};

const formatPriceDetails = (price: number, extras?: unknown) => {
  const base = `GBP ${price.toFixed(2)}`;
  if (!Array.isArray(extras) || extras.length === 0) return base;
  const cleanedExtras = extras
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.replace(/^Extras applied:\s*/i, '').trim();
      }
      if (entry && typeof entry === 'object') {
        const label = 'label' in entry ? String((entry as { label?: unknown }).label || '').trim() : '';
        const amountRaw = 'amount' in entry ? Number((entry as { amount?: unknown }).amount) : NaN;
        if (label && Number.isFinite(amountRaw) && amountRaw > 0) {
          return `${label} GBP ${amountRaw.toFixed(2)}`;
        }
        if (label) return label;
      }
      return String(entry || '').replace(/^Extras applied:\s*/i, '').trim();
    })
    .filter(Boolean);
  if (!cleanedExtras.length) return base;
  return `${base} ( ${cleanedExtras.join(' + ')} )`;
};

const buildNotes = (payload: any) => {
  const pieces = [
    payload?.flightNumber ? `Flight ${payload.flightNumber}` : null,
    payload?.specialEvents || null,
    payload?.notes || null,
  ].filter(Boolean);
  return pieces.length ? pieces.join(' - ') : '-';
};

const parsePayload = (value: unknown) => {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
};

const HOLD_PAYMENT_STATUSES = new Set([
  'authorized',
  'authorization_updated',
  'additional_authorization_created',
  'requires_capture',
  'partially_captured',
]);

const isManualPaymentMethod = (value: string) => {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('invoice') ||
    normalized.includes('cash') ||
    normalized.includes('chauffeur') ||
    normalized.includes('driver') ||
    normalized.includes('bank transfer') ||
    normalized.includes('account')
  );
};

const OPTIONAL_RIDE_COLUMNS = [
  'ride_status',
  'payment_status',
  'original_estimated_fare',
  'current_estimated_fare',
  'final_fare',
  'originally_authorized_amount',
  'latest_authorized_amount',
  'captured_amount',
  'primary_payment_intent_id',
  'stripe_customer_id',
  'stripe_payment_method_id',
  'payment_failure_reason',
] as const;

const quoteIdentifier = (value: string) => `\`${value.replace(/`/g, '``')}\``;

async function getClientJourneyColumns() {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'client_journeys'`
  );
  return new Set(rows.map((row) => String(row.COLUMN_NAME || '')));
}

function buildOptionalSelect(existingColumns: Set<string>) {
  return OPTIONAL_RIDE_COLUMNS.map((column) =>
    existingColumns.has(column)
      ? `cj.${quoteIdentifier(column)}`
      : `NULL AS ${quoteIdentifier(column)}`
  ).join(',\n              ');
}

export async function GET() {
  try {
    const existingColumns = await getClientJourneyColumns();
    const optionalSelect = buildOptionalSelect(existingColumns);
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id,
              cj.journey_date,
              cj.pickup,
              cj.destination,
              cj.passenger_name,
              cj.passenger_phone,
              cj.passenger_email,
              cj.driver_name,
              ${existingColumns.has('driver_id') ? 'cj.driver_id' : 'NULL AS driver_id'},
              cj.driver_price,
              cj.driver_commission_applied,
              cj.client_confirmed,
              cj.created_at,
              cj.updated_at,
              cj.price,
              cj.booking_payload,
              cj.booked_by_staff_id,
              cj.service_type,
              cj.vehicle_type_id,
              ${optionalSelect},
              u.email AS client_email
         , staff.full_name AS staff_name
         , pv.label AS vehicle_label
         FROM client_journeys cj
         LEFT JOIN users u ON cj.client_id = u.id
         LEFT JOIN admin_staff staff ON cj.booked_by_staff_id = staff.id
         LEFT JOIN pricing_vehicles pv ON pv.id = cj.vehicle_type_id
        WHERE cj.status = 'Upcoming'
        ORDER BY cj.journey_date ASC`
    );

    const bookings = rows.map((row) => {
      const payload: any = parsePayload(row.booking_payload);
      const { date, time } = formatDate(String(row.journey_date));
      const priceNumber = Number(row.price ?? payload?.totalFare ?? 0) || 0;
      const bookedByStaffId = row.booked_by_staff_id ? Number(row.booked_by_staff_id) : null;
      const bookedByName = row.staff_name || null;
      const vehicleLabel =
        row.vehicle_label || payload?.vehicle || payload?.vehicleLabel || payload?.vehicleTypeLabel || 'Unknown';
      const paymentMethod = String(payload?.paymentMethod || payload?.paymentType || '').trim();
      const paymentFlow = String(payload?.paymentFlow || '').trim();
      const paymentStatus = String(row.payment_status || payload?.paymentStatus || '').trim().toLowerCase();
      const paymentIntentId = String(payload?.paymentIntentId || row.primary_payment_intent_id || '').trim();
      const alreadyRefunded = String(payload?.refund?.status || '').trim().toLowerCase() === 'succeeded';
      const isPaid =
        paymentStatus === 'succeeded' ||
        paymentStatus === 'captured' ||
        paymentStatus === 'final_charge_succeeded' ||
        paymentStatus === 'extra_charge_succeeded';
      const isRefundable = isPaid && Boolean(paymentIntentId) && !alreadyRefunded;
      const canReleaseHold = HOLD_PAYMENT_STATUSES.has(paymentStatus) && Boolean(paymentIntentId) && !alreadyRefunded;
      const canCancelNoCharge =
        paymentFlow === 'flexible_after_journey' &&
        !isPaid &&
        !alreadyRefunded &&
        ['card_saved', 'payment_pending', 'authorization_pending'].includes(paymentStatus || 'card_saved');
      const canManualCancel =
        !isRefundable &&
        !canReleaseHold &&
        !canCancelNoCharge &&
        !alreadyRefunded &&
        (paymentFlow === 'manual' || isManualPaymentMethod(paymentMethod) || paymentStatus === 'authorization_pending');
      const dropOffs = resolveDropOffs(String(row.destination || ''), payload);
      const rawDriverName = String(row.driver_name ?? '').trim();
      const driverIdFromColumn = row.driver_id !== null && row.driver_id !== undefined ? String(row.driver_id).trim() : '';
      const driverId =
        driverIdFromColumn ||
        (rawDriverName && rawDriverName.toLowerCase() !== 'pending assignment' && /^\d+$/.test(rawDriverName)
          ? rawDriverName
          : '');
      const driverName =
        rawDriverName && rawDriverName.toLowerCase() !== 'pending assignment' && !/^\d+$/.test(rawDriverName)
          ? rawDriverName
          : '';
      return {
        journeyId: Number(row.id),
        id: Number(row.id),
        code: `VD-${String(row.id).padStart(4, '0')}`,
        journeyDate: row.journey_date ? String(row.journey_date) : null,
        pickup: row.pickup,
        dropOff: row.destination,
        dropOffs,
        passenger: row.passenger_name || payload?.passengerName || 'Guest Passenger',
        phone: row.passenger_phone || payload?.passengerPhone || '',
        bookedBy: bookedByName || row.client_email || payload?.passengerName || 'Guest Booking',
        bookedByStaffId,
        notes: buildNotes(payload),
        date,
        time,
        priceDetails: formatPriceDetails(priceNumber, payload?.extras),
        paymentMethod,
        paymentFlow,
        isPaid,
        isRefundable,
        canReleaseHold,
        canCancelNoCharge,
        paymentAction: isRefundable ? 'refund' : canReleaseHold ? 'cancel_hold' : canCancelNoCharge ? 'cancel_no_charge' : canManualCancel ? 'manual_cancel' : null,
        vehicle: vehicleLabel,
        serviceType: row.service_type || payload?.serviceType || 'Transfer',
        vehicleTypeId: row.vehicle_type_id ? Number(row.vehicle_type_id) : null,
        passengerEmail: row.passenger_email || payload?.passengerEmail || '',
        clientEmail: row.client_email || '',
        driverId,
        driverName,
        driverPrice: row.driver_price !== null && row.driver_price !== undefined ? Number(row.driver_price) : null,
        driverCommissionApplied:
          row.driver_commission_applied !== null && row.driver_commission_applied !== undefined
            ? Number(row.driver_commission_applied)
            : null,
        clientConfirmed: Boolean(row.client_confirmed),
        rideStatus: row.ride_status ? String(row.ride_status) : '',
        paymentStatus: row.payment_status ? String(row.payment_status) : paymentStatus,
        originalEstimate:
          row.original_estimated_fare !== null && row.original_estimated_fare !== undefined
            ? Number(row.original_estimated_fare)
            : null,
        currentEstimate:
          row.current_estimated_fare !== null && row.current_estimated_fare !== undefined
            ? Number(row.current_estimated_fare)
            : null,
        finalFare:
          row.final_fare !== null && row.final_fare !== undefined
            ? Number(row.final_fare)
            : null,
        authorizedAmount:
          row.latest_authorized_amount !== null && row.latest_authorized_amount !== undefined
            ? Number(row.latest_authorized_amount)
            : null,
        capturedAmount:
          row.captured_amount !== null && row.captured_amount !== undefined
            ? Number(row.captured_amount)
            : null,
        primaryPaymentIntentId: row.primary_payment_intent_id ? String(row.primary_payment_intent_id) : '',
        stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : '',
        stripePaymentMethodId: row.stripe_payment_method_id ? String(row.stripe_payment_method_id) : '',
        paymentFailureReason: row.payment_failure_reason ? String(row.payment_failure_reason) : '',
        createdAt: row.created_at ? String(row.created_at) : null,
        updatedAt: row.updated_at ? String(row.updated_at) : null,
      };
    });

    return NextResponse.json({ bookings });
  } catch (err) {
    console.error('Admin live bookings fetch error', err);
    return NextResponse.json({ error: 'Failed to load live bookings' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const bookedByStaffId =
      body.bookedByStaffId !== undefined && body.bookedByStaffId !== null
        ? Number(body.bookedByStaffId)
        : null;

    if (!id) {
      return NextResponse.json({ error: 'Missing booking id' }, { status: 400 });
    }

    if (bookedByStaffId && Number.isNaN(bookedByStaffId)) {
      return NextResponse.json({ error: 'Invalid staff id' }, { status: 400 });
    }

    if (bookedByStaffId) {
      const [staffRows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM admin_staff WHERE id = ? LIMIT 1',
        [bookedByStaffId]
      );
      if (!staffRows.length) {
        return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
      }
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE client_journeys SET booked_by_staff_id = ? WHERE id = ? LIMIT 1`,
      [bookedByStaffId || null, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Admin live bookings update error', err);
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}

