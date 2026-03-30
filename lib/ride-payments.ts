import mysql from 'mysql2/promise';
import Stripe from 'stripe';
import { requireStripe, stripePublishableKey, toStripeAmount, fromStripeAmount } from '@/lib/stripe-server';

type RideRow = mysql.RowDataPacket & {
  id: number;
  client_id: number | null;
  price: number | string;
  status: string;
  ride_status: string | null;
  payment_status: string | null;
  original_estimated_fare: number | string | null;
  current_estimated_fare: number | string | null;
  final_fare: number | string | null;
  originally_authorized_amount: number | string | null;
  latest_authorized_amount: number | string | null;
  captured_amount: number | string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  primary_payment_intent_id: string | null;
  passenger_name: string | null;
  passenger_email: string | null;
  booking_payload: unknown;
};

type RidePaymentRow = mysql.RowDataPacket & {
  id: number;
  ride_id: number;
  payment_role: string;
  stripe_payment_intent_id: string;
  amount: number | string;
  authorized_amount: number | string;
  capturable_amount: number | string;
  captured_amount: number | string;
  status: string;
};

const ACTIVE_AUTH_STATUSES = ['authorized', 'authorization_updated', 'additional_authorization_created', 'partially_captured'];
const roundMoney = (value: number) => Math.round(value * 100) / 100;
const toDateTime = (unixSeconds?: number | null) =>
  unixSeconds ? new Date(unixSeconds * 1000).toISOString().slice(0, 19).replace('T', ' ') : null;

export async function loadRideForPayment(
  conn: mysql.Pool | mysql.PoolConnection,
  rideId: number
): Promise<RideRow> {
  const [rows] = await conn.query<RideRow[]>(
    `SELECT id, client_id, price, status, ride_status, payment_status, original_estimated_fare, current_estimated_fare,
            final_fare, originally_authorized_amount, latest_authorized_amount, captured_amount,
            stripe_customer_id, stripe_payment_method_id, primary_payment_intent_id, passenger_name, passenger_email,
            booking_payload
       FROM client_journeys
      WHERE id = ?
      LIMIT 1`,
    [rideId]
  );
  if (!rows.length) throw new Error('Ride not found');
  return rows[0];
}

async function updateBookingPayloadPayment(
  conn: mysql.Pool | mysql.PoolConnection,
  rideId: number,
  updates: Record<string, any>
) {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    'SELECT booking_payload FROM client_journeys WHERE id = ? LIMIT 1',
    [rideId]
  );
  let payload: Record<string, any> = {};
  if (rows[0]?.booking_payload) {
    try {
      payload =
        typeof rows[0].booking_payload === 'string'
          ? JSON.parse(rows[0].booking_payload)
          : rows[0].booking_payload;
    } catch {
      payload = {};
    }
  }
  const nextPayload = { ...payload, ...updates };
  await conn.execute('UPDATE client_journeys SET booking_payload = ? WHERE id = ? LIMIT 1', [
    JSON.stringify(nextPayload),
    rideId,
  ]);
}

export async function logPaymentEvent(
  conn: mysql.Pool | mysql.PoolConnection,
  input: {
    rideId?: number | null;
    stripeEventId?: string | null;
    eventType: string;
    source?: string;
    status?: string | null;
    message?: string | null;
    payload?: Record<string, any> | null;
  }
) {
  await conn.execute(
    `INSERT IGNORE INTO payment_events
      (ride_id, stripe_event_id, event_type, source, status, message, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.rideId ?? null,
      input.stripeEventId ?? null,
      input.eventType,
      input.source || 'system',
      input.status ?? null,
      input.message ?? null,
      input.payload ? JSON.stringify(input.payload) : null,
    ]
  );
}

export async function logRideChange(
  conn: mysql.Pool | mysql.PoolConnection,
  input: {
    rideId: number;
    changeSource: 'customer' | 'admin' | 'system';
    changedByUserId?: number | null;
    changedByAdminId?: number | null;
    changeReason?: string | null;
    note?: string | null;
    previousSnapshot: Record<string, any>;
    nextSnapshot: Record<string, any>;
    fareBefore: number;
    fareAfter: number;
    paymentAdjustmentStatus?: string | null;
  }
) {
  await conn.execute(
    `INSERT INTO ride_change_history
      (ride_id, change_source, changed_by_user_id, changed_by_admin_id, change_reason, note,
       previous_snapshot, next_snapshot, fare_before, fare_after, fare_delta, payment_adjustment_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.rideId,
      input.changeSource,
      input.changedByUserId ?? null,
      input.changedByAdminId ?? null,
      input.changeReason ?? null,
      input.note ?? null,
      JSON.stringify(input.previousSnapshot),
      JSON.stringify(input.nextSnapshot),
      roundMoney(input.fareBefore),
      roundMoney(input.fareAfter),
      roundMoney(input.fareAfter - input.fareBefore),
      input.paymentAdjustmentStatus ?? null,
    ]
  );
}

async function findOrCreateStripeCustomer(input: { name?: string | null; email?: string | null; existingCustomerId?: string | null }) {
  const stripe = requireStripe();
  if (input.existingCustomerId) return input.existingCustomerId;
  if (!input.email) return null;
  const customer = await stripe.customers.create({
    email: input.email,
    name: input.name || undefined,
    metadata: { product: 'velvetdriver' },
  });
  return customer.id;
}

async function writePaymentFromIntent(
  conn: mysql.Pool | mysql.PoolConnection,
  rideId: number,
  paymentRole: string,
  intent: Stripe.PaymentIntent,
  status: string
) {
  const latestCharge =
    typeof intent.latest_charge === 'string'
      ? intent.latest_charge
      : intent.latest_charge?.id || null;
  await conn.execute(
    `INSERT INTO ride_payments
      (ride_id, payment_role, stripe_payment_intent_id, stripe_charge_id, stripe_customer_id,
       stripe_payment_method_id, currency, amount, authorized_amount, capturable_amount,
       captured_amount, status, stripe_status, failure_code, failure_message,
       authorization_expires_at, authorized_at, captured_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       stripe_charge_id = VALUES(stripe_charge_id),
       stripe_customer_id = VALUES(stripe_customer_id),
       stripe_payment_method_id = VALUES(stripe_payment_method_id),
       currency = VALUES(currency),
       amount = VALUES(amount),
       authorized_amount = VALUES(authorized_amount),
       capturable_amount = VALUES(capturable_amount),
       captured_amount = VALUES(captured_amount),
       status = VALUES(status),
       stripe_status = VALUES(stripe_status),
       failure_code = VALUES(failure_code),
       failure_message = VALUES(failure_message),
       authorization_expires_at = VALUES(authorization_expires_at),
       authorized_at = VALUES(authorized_at),
       captured_at = VALUES(captured_at),
       metadata = VALUES(metadata)`,
    [
      rideId,
      paymentRole,
      intent.id,
      latestCharge,
      typeof intent.customer === 'string' ? intent.customer : intent.customer?.id || null,
      typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method?.id || null,
      intent.currency,
      fromStripeAmount(intent.amount),
      fromStripeAmount(intent.amount),
      fromStripeAmount(intent.amount_capturable),
      fromStripeAmount(intent.amount_received),
      status,
      intent.status,
      intent.last_payment_error?.code || null,
      intent.last_payment_error?.message || null,
      null,
      status === 'authorized' || status === 'authorization_updated' || status === 'additional_authorization_created'
        ? new Date().toISOString().slice(0, 19).replace('T', ' ')
        : null,
      intent.status === 'succeeded' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
      JSON.stringify(intent.metadata || {}),
    ]
  );
}

async function recomputeRidePaymentSummary(conn: mysql.Pool | mysql.PoolConnection, rideId: number) {
  const [summaryRows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT
        COALESCE(SUM(CASE WHEN status IN ('authorized', 'authorization_updated', 'additional_authorization_created', 'partially_captured', 'captured')
          THEN authorized_amount ELSE 0 END), 0) AS authorized_total,
        COALESCE(SUM(CASE WHEN status IN ('captured', 'partially_captured', 'extra_charge_succeeded')
          THEN captured_amount ELSE 0 END), 0) AS captured_total
       FROM ride_payments
      WHERE ride_id = ?`,
    [rideId]
  );
  const authorizedTotal = roundMoney(Number(summaryRows[0]?.authorized_total ?? 0));
  const capturedTotal = roundMoney(Number(summaryRows[0]?.captured_total ?? 0));
  await conn.execute(
    `UPDATE client_journeys
        SET latest_authorized_amount = ?,
            captured_amount = ?
      WHERE id = ?
      LIMIT 1`,
    [authorizedTotal, capturedTotal, rideId]
  );
  return { authorizedTotal, capturedTotal };
}

export async function createBookingAuthorization(input: {
  amount: number;
  currency?: string;
  passengerName?: string;
  passengerEmail?: string;
  pickup?: string;
  dropOffs?: string[];
  rideId?: number | null;
  customerId?: string | null;
}) {
  const stripe = requireStripe();
  const customerId = await findOrCreateStripeCustomer({
    name: input.passengerName,
    email: input.passengerEmail,
    existingCustomerId: input.customerId,
  });
  const paymentIntent = await stripe.paymentIntents.create({
    amount: toStripeAmount(input.amount),
    currency: String(input.currency || 'gbp').toLowerCase(),
    capture_method: 'manual',
    automatic_payment_methods: { enabled: true },
    customer: customerId || undefined,
    setup_future_usage: customerId ? 'off_session' : undefined,
    metadata: {
      rideId: input.rideId ? String(input.rideId) : 'pending',
      paymentFlow: 'booking_authorization',
      pickup: String(input.pickup || ''),
      dropOff: Array.isArray(input.dropOffs) ? String(input.dropOffs[input.dropOffs.length - 1] || '') : '',
      passengerEmail: String(input.passengerEmail || ''),
    },
  });

  return {
    customerId,
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    publishableKey: stripePublishableKey,
  };
}

export async function persistBookingAuthorization(
  conn: mysql.Pool | mysql.PoolConnection,
  input: {
    rideId: number;
    paymentIntentId: string;
    estimatedAmount: number;
  }
) {
  const stripe = requireStripe();
  const intent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
  if (intent.status !== 'requires_capture') {
    throw new Error('Authorization has not been confirmed');
  }

  await writePaymentFromIntent(conn, input.rideId, 'authorization', intent, 'authorized');
  const authorizationExpiresAt = null;
  const stripeCustomerId = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id || null;
  const stripePaymentMethodId =
    typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method?.id || null;

  await conn.execute(
    `UPDATE client_journeys
        SET payment_status = 'authorized',
            ride_status = 'payment_authorized',
            original_estimated_fare = COALESCE(original_estimated_fare, ?),
            current_estimated_fare = ?,
            originally_authorized_amount = ?,
            latest_authorized_amount = ?,
            stripe_customer_id = COALESCE(stripe_customer_id, ?),
            stripe_payment_method_id = COALESCE(stripe_payment_method_id, ?),
            primary_payment_intent_id = COALESCE(primary_payment_intent_id, ?),
            authorization_expires_at = ?,
            authorized_at = NOW()
      WHERE id = ?
      LIMIT 1`,
    [
      roundMoney(input.estimatedAmount),
      roundMoney(input.estimatedAmount),
      fromStripeAmount(intent.amount),
      fromStripeAmount(intent.amount_capturable),
      stripeCustomerId,
      stripePaymentMethodId,
      intent.id,
      authorizationExpiresAt,
      input.rideId,
    ]
  );

  await updateBookingPayloadPayment(conn, input.rideId, {
    paymentIntentId: intent.id,
    paymentStatus: 'authorized',
    paymentMethod: 'Card authorization',
    paymentAmount: roundMoney(input.estimatedAmount),
    paymentCurrency: String(intent.currency || 'gbp').toUpperCase(),
    stripeCustomerId,
    stripePaymentMethodId,
  });
  await recomputeRidePaymentSummary(conn, input.rideId);
  await logPaymentEvent(conn, {
    rideId: input.rideId,
    eventType: 'authorization.persisted',
    source: 'api',
    status: 'authorized',
    message: `Primary authorization stored for ${intent.id}`,
    payload: { paymentIntentId: intent.id, amount: fromStripeAmount(intent.amount) },
  });
  await stripe.paymentIntents.update(intent.id, {
    metadata: { ...intent.metadata, rideId: String(input.rideId), paymentFlow: 'booking_authorization' },
  });
  return intent;
}

async function activeAuthorizations(
  conn: mysql.Pool | mysql.PoolConnection,
  rideId: number
) {
  const [rows] = await conn.query<RidePaymentRow[]>(
    `SELECT id, ride_id, payment_role, stripe_payment_intent_id, amount, authorized_amount, capturable_amount, captured_amount, status
       FROM ride_payments
      WHERE ride_id = ?
        AND status IN (${ACTIVE_AUTH_STATUSES.map(() => '?').join(',')})
      ORDER BY id ASC`,
    [rideId, ...ACTIVE_AUTH_STATUSES]
  );
  return rows;
}

export async function updateRideAuthorization(
  conn: mysql.Pool | mysql.PoolConnection,
  input: {
    rideId: number;
    newEstimatedAmount: number;
    source: 'customer' | 'admin' | 'system';
    reason?: string | null;
    note?: string | null;
    paymentIntentId?: string | null;
  }
) {
  const stripe = requireStripe();
  const ride = await loadRideForPayment(conn, input.rideId);
  const authorizations = await activeAuthorizations(conn, input.rideId);
  const currentAuthorized = roundMoney(
    authorizations.reduce((sum, row) => sum + Number(row.capturable_amount ?? row.authorized_amount ?? 0), 0)
  );

  if (input.paymentIntentId) {
    const intent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
    if (intent.status !== 'requires_capture') {
      throw new Error('Additional authorization is not confirmed');
    }
    await writePaymentFromIntent(conn, input.rideId, 'additional_authorization', intent, 'additional_authorization_created');
    await recomputeRidePaymentSummary(conn, input.rideId);
  }

  const refreshedRide = await loadRideForPayment(conn, input.rideId);
  const totalAuthorized = Math.max(currentAuthorized, Number(refreshedRide.latest_authorized_amount ?? 0));
  if (roundMoney(input.newEstimatedAmount) <= roundMoney(totalAuthorized)) {
    await conn.execute(
      `UPDATE client_journeys
          SET current_estimated_fare = ?,
              payment_status = CASE
                WHEN payment_status = 'authorized' THEN 'authorization_updated'
                ELSE payment_status
              END,
              ride_status = 'fare_updated'
        WHERE id = ?
        LIMIT 1`,
      [roundMoney(input.newEstimatedAmount), input.rideId]
    );
    await updateBookingPayloadPayment(conn, input.rideId, {
      paymentStatus: 'authorization_updated',
      currentEstimatedFare: roundMoney(input.newEstimatedAmount),
    });
    await logPaymentEvent(conn, {
      rideId: input.rideId,
      eventType: 'authorization.covered',
      source: input.source,
      status: 'authorization_updated',
      message: 'Existing authorization already covers updated estimate',
      payload: { currentAuthorized: totalAuthorized, newEstimatedAmount: roundMoney(input.newEstimatedAmount) },
    });
    return { ok: true, strategy: 'covered_by_existing_authorization', requiresAction: false };
  }

  const delta = roundMoney(input.newEstimatedAmount - totalAuthorized);
  const stripeCustomerId = refreshedRide.stripe_customer_id;
  const stripePaymentMethodId = refreshedRide.stripe_payment_method_id;
  if (!stripeCustomerId || !stripePaymentMethodId) {
    await conn.execute(
      `UPDATE client_journeys
          SET current_estimated_fare = ?,
              payment_status = 'additional_authorization_required',
              ride_status = 'payment_issue',
              payment_failure_reason = 'Missing reusable Stripe payment method for additional authorization'
        WHERE id = ?
        LIMIT 1`,
      [roundMoney(input.newEstimatedAmount), input.rideId]
    );
    return { ok: false, strategy: 'missing_saved_payment_method', requiresAction: true, amountToAuthorize: delta };
  }

  try {
    const offSessionIntent = await stripe.paymentIntents.create({
      amount: toStripeAmount(delta),
      currency: 'gbp',
      customer: stripeCustomerId,
      payment_method: stripePaymentMethodId,
      capture_method: 'manual',
      confirm: true,
      off_session: true,
      metadata: {
        rideId: String(input.rideId),
        paymentFlow: 'additional_authorization',
        source: input.source,
      },
    });

    if (offSessionIntent.status === 'requires_capture') {
      await writePaymentFromIntent(
        conn,
        input.rideId,
        'additional_authorization',
        offSessionIntent,
        'additional_authorization_created'
      );
      const summary = await recomputeRidePaymentSummary(conn, input.rideId);
      await conn.execute(
        `UPDATE client_journeys
            SET current_estimated_fare = ?,
                payment_status = 'additional_authorization_created',
                ride_status = 'fare_updated',
                payment_failure_reason = NULL
          WHERE id = ?
          LIMIT 1`,
        [roundMoney(input.newEstimatedAmount), input.rideId]
      );
      await updateBookingPayloadPayment(conn, input.rideId, {
        paymentStatus: 'additional_authorization_created',
        currentEstimatedFare: roundMoney(input.newEstimatedAmount),
        latestAuthorizedAmount: summary.authorizedTotal,
      });
      return {
        ok: true,
        strategy: 'additional_authorization_off_session',
        requiresAction: false,
        additionalPaymentIntentId: offSessionIntent.id,
      };
    }
  } catch (error: any) {
    const requiresCustomerAction =
      error?.code === 'authentication_required' ||
      error?.payment_intent?.status === 'requires_action' ||
      error?.raw?.payment_intent?.status === 'requires_action';
    if (!requiresCustomerAction) {
      await conn.execute(
        `UPDATE client_journeys
            SET current_estimated_fare = ?,
                payment_status = 'failed',
                ride_status = 'payment_issue',
                payment_failure_reason = ?
          WHERE id = ?
          LIMIT 1`,
        [roundMoney(input.newEstimatedAmount), error?.message || 'Additional authorization failed', input.rideId]
      );
      throw error;
    }
  }

  const onSessionIntent = await stripe.paymentIntents.create({
    amount: toStripeAmount(delta),
    currency: 'gbp',
    capture_method: 'manual',
    customer: stripeCustomerId,
    setup_future_usage: 'off_session',
    automatic_payment_methods: { enabled: true },
    metadata: {
      rideId: String(input.rideId),
      paymentFlow: 'additional_authorization',
      source: input.source,
    },
  });
  await conn.execute(
    `UPDATE client_journeys
        SET current_estimated_fare = ?,
            payment_status = 'additional_authorization_required',
            ride_status = 'payment_issue',
            payment_failure_reason = 'Customer confirmation required for additional authorization'
      WHERE id = ?
      LIMIT 1`,
    [roundMoney(input.newEstimatedAmount), input.rideId]
  );
  await logPaymentEvent(conn, {
    rideId: input.rideId,
    eventType: 'authorization.customer_action_required',
    source: input.source,
    status: 'additional_authorization_required',
    message: 'Additional authorization requires customer confirmation',
    payload: { paymentIntentId: onSessionIntent.id, amountToAuthorize: delta },
  });
  return {
    ok: false,
    strategy: 'additional_authorization_on_session',
    requiresAction: true,
    amountToAuthorize: delta,
    clientSecret: onSessionIntent.client_secret,
    paymentIntentId: onSessionIntent.id,
    publishableKey: stripePublishableKey,
  };
}

export async function captureRidePayment(
  conn: mysql.Pool | mysql.PoolConnection,
  input: { rideId: number; finalFare: number }
) {
  const stripe = requireStripe();
  const ride = await loadRideForPayment(conn, input.rideId);
  const authorizations = await activeAuthorizations(conn, input.rideId);
  let remainingToCapture = roundMoney(input.finalFare);
  let capturedTotal = 0;

  for (const payment of authorizations) {
    if (remainingToCapture <= 0) break;
    const capturable = roundMoney(Number(payment.capturable_amount ?? payment.authorized_amount ?? 0));
    if (capturable <= 0) continue;
    const amountForIntent = Math.min(remainingToCapture, capturable);
    const capturedIntent = await stripe.paymentIntents.capture(payment.stripe_payment_intent_id, {
      amount_to_capture: toStripeAmount(amountForIntent),
    });
    await writePaymentFromIntent(
      conn,
      input.rideId,
      payment.payment_role,
      capturedIntent,
      amountForIntent < capturable ? 'partially_captured' : 'captured'
    );
    remainingToCapture = roundMoney(remainingToCapture - amountForIntent);
    capturedTotal = roundMoney(capturedTotal + amountForIntent);
  }

  if (remainingToCapture > 0) {
    if (!ride.stripe_customer_id || !ride.stripe_payment_method_id) {
      await conn.execute(
        `UPDATE client_journeys
            SET final_fare = ?,
                fare_finalized_at = NOW(),
                captured_amount = ?,
                payment_status = 'extra_charge_required',
                ride_status = 'payment_issue',
                payment_failure_reason = 'Final fare exceeded authorized amount and no reusable payment method was available'
          WHERE id = ?
          LIMIT 1`,
        [roundMoney(input.finalFare), capturedTotal, input.rideId]
      );
      return { ok: false, capturedTotal, remainingToCapture, strategy: 'missing_payment_method_for_extra_charge' };
    }

    try {
      const extraCharge = await stripe.paymentIntents.create({
        amount: toStripeAmount(remainingToCapture),
        currency: 'gbp',
        customer: ride.stripe_customer_id,
        payment_method: ride.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        metadata: {
          rideId: String(input.rideId),
          paymentFlow: 'final_extra_charge',
        },
      });
      await writePaymentFromIntent(conn, input.rideId, 'extra_charge', extraCharge, 'extra_charge_succeeded');
      capturedTotal = roundMoney(capturedTotal + remainingToCapture);
      remainingToCapture = 0;
    } catch (error: any) {
      await conn.execute(
        `UPDATE client_journeys
            SET final_fare = ?,
                fare_finalized_at = NOW(),
                captured_amount = ?,
                payment_status = 'extra_charge_failed',
                ride_status = 'payment_issue',
                payment_failure_reason = ?
          WHERE id = ?
          LIMIT 1`,
        [roundMoney(input.finalFare), capturedTotal, error?.message || 'Extra charge failed', input.rideId]
      );
      return { ok: false, capturedTotal, remainingToCapture, strategy: 'extra_charge_failed' };
    }
  }

  await recomputeRidePaymentSummary(conn, input.rideId);
  await conn.execute(
    `UPDATE client_journeys
        SET final_fare = ?,
            fare_finalized_at = NOW(),
            captured_amount = ?,
            captured_at = NOW(),
            payment_status = CASE
              WHEN ? > originally_authorized_amount THEN 'extra_charge_succeeded'
              WHEN ? < latest_authorized_amount THEN 'partially_captured'
              ELSE 'captured'
            END,
            ride_status = 'payment_captured',
            status = 'Completed',
            payment_failure_reason = NULL
      WHERE id = ?
      LIMIT 1`,
    [
      roundMoney(input.finalFare),
      capturedTotal,
      roundMoney(input.finalFare),
      roundMoney(input.finalFare),
      input.rideId,
    ]
  );
  await updateBookingPayloadPayment(conn, input.rideId, {
    paymentStatus:
      roundMoney(input.finalFare) > Number(ride.originally_authorized_amount ?? 0)
        ? 'extra_charge_succeeded'
        : roundMoney(input.finalFare) < Number(ride.latest_authorized_amount ?? 0)
          ? 'partially_captured'
          : 'captured',
    finalFare: roundMoney(input.finalFare),
    capturedAmount: capturedTotal,
  });
  return { ok: true, capturedTotal, remainingToCapture: 0, strategy: 'captured' };
}

export async function syncPaymentIntentToDb(
  conn: mysql.Pool | mysql.PoolConnection,
  paymentIntent: Stripe.PaymentIntent,
  stripeEventId?: string | null
) {
  const rideId = Number(paymentIntent.metadata?.rideId || 0);
  if (!rideId) return;
  const role = String(paymentIntent.metadata?.paymentFlow || '').includes('additional')
    ? 'additional_authorization'
    : String(paymentIntent.metadata?.paymentFlow || '').includes('extra_charge')
      ? 'extra_charge'
      : 'authorization';

  let status = 'authorization_pending';
  if (paymentIntent.status === 'requires_capture') status = role === 'authorization' ? 'authorized' : 'additional_authorization_created';
  if (paymentIntent.status === 'succeeded') status = role === 'extra_charge' ? 'extra_charge_succeeded' : 'captured';
  if (paymentIntent.status === 'canceled') status = paymentIntent.cancellation_reason === 'abandoned' ? 'expired' : 'canceled';
  if (paymentIntent.status === 'requires_payment_method') status = 'failed';

  await writePaymentFromIntent(conn, rideId, role, paymentIntent, status);
  await recomputeRidePaymentSummary(conn, rideId);
  await conn.execute(
    `UPDATE client_journeys
        SET stripe_customer_id = COALESCE(stripe_customer_id, ?),
            stripe_payment_method_id = COALESCE(stripe_payment_method_id, ?),
            primary_payment_intent_id = COALESCE(primary_payment_intent_id, ?),
            payment_status = CASE
              WHEN ? IN ('authorized', 'additional_authorization_created', 'captured', 'extra_charge_succeeded', 'failed', 'expired', 'canceled')
                THEN ?
              ELSE payment_status
            END,
            payment_failure_reason = CASE
              WHEN ? = 'failed' THEN ?
              ELSE payment_failure_reason
            END
      WHERE id = ?
      LIMIT 1`,
    [
      typeof paymentIntent.customer === 'string' ? paymentIntent.customer : paymentIntent.customer?.id || null,
      typeof paymentIntent.payment_method === 'string' ? paymentIntent.payment_method : paymentIntent.payment_method?.id || null,
      paymentIntent.id,
      status,
      status,
      status,
      paymentIntent.last_payment_error?.message || null,
      rideId,
    ]
  );
  await logPaymentEvent(conn, {
    rideId,
    stripeEventId,
    eventType: `stripe.${paymentIntent.status}`,
    source: 'webhook',
    status,
    message: `Webhook synced ${paymentIntent.id}`,
    payload: { paymentIntentId: paymentIntent.id, role },
  });
}
