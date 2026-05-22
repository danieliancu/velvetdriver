import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { generateStatementForJourney } from '@/lib/statement-generation';
import { captureRidePayment, chargeFlexibleRidePayment, loadRideForPayment } from '@/lib/ride-payments';

const pool = getDbPool();
const HOLD_PAYMENT_STATUSES = new Set([
  'authorized',
  'authorization_updated',
  'additional_authorization_created',
  'requires_capture',
  'partially_captured',
]);

const parsePayload = (value: unknown) => {
  if (!value) return {};
  try {
    return typeof value === 'string' ? JSON.parse(value) : (value as Record<string, any>);
  } catch {
    return {};
  }
};

export async function POST(request: Request) {
  const conn = await pool.getConnection();
  try {
    const body = await request.json();
    const journeyId = Number(body?.journeyId);
    const finalFare = Number(body?.finalFare ?? 0);
    if (!journeyId) {
      return NextResponse.json({ error: 'Missing journey id' }, { status: 400 });
    }
    if (!Number.isFinite(finalFare) || finalFare < 0) {
      return NextResponse.json({ error: 'Invalid final fare' }, { status: 400 });
    }

    await conn.beginTransaction();
    const ride = await loadRideForPayment(conn, journeyId);
    if (ride.status !== 'Upcoming') {
      await conn.rollback();
      return NextResponse.json({ error: 'Booking not found or not upcoming' }, { status: 404 });
    }

    const payload = parsePayload(ride.booking_payload);
    const paymentFlow = String(payload?.paymentFlow || '').toLowerCase();
    const paymentStatus = String(ride.payment_status || payload?.paymentStatus || '').toLowerCase();
    let payment: Record<string, any> | null = null;

    if (paymentFlow === 'pay_by_invoice' || paymentFlow === 'corporate_invoice' || paymentStatus === 'invoice pending') {
      const nextPayload = {
        ...payload,
        finalFare,
        paymentStatus: 'Invoice pending',
        invoiceStatus: 'Ready for invoicing',
      };
      const [result] = await conn.execute<mysql.ResultSetHeader>(
        `UPDATE client_journeys
            SET status = 'Completed',
                ride_status = 'completed',
                payment_status = 'Invoice pending',
                invoice_status = 'Ready for invoicing',
                final_fare = ?,
                fare_finalized_at = NOW(),
                booking_payload = ?,
                updated_at = NOW()
          WHERE id = ?
            AND status = 'Upcoming'
          LIMIT 1`,
        [finalFare, JSON.stringify(nextPayload), journeyId]
      );
      if (!result.affectedRows) {
        await conn.rollback();
        return NextResponse.json({ error: 'Booking not found or not upcoming' }, { status: 404 });
      }
      payment = { ok: true, strategy: 'corporate_invoice_ready' };
    } else if (paymentFlow === 'flexible_after_journey') {
      payment = await chargeFlexibleRidePayment(conn, { rideId: journeyId, finalFare });
      if (!payment.ok) {
        await conn.commit();
        return NextResponse.json(
          { ok: false, error: 'Flexible final charge failed', payment },
          { status: 409 }
        );
      }
    } else if (HOLD_PAYMENT_STATUSES.has(paymentStatus)) {
      payment = await captureRidePayment(conn, { rideId: journeyId, finalFare });
      if (!payment.ok) {
        await conn.commit();
        return NextResponse.json(
          { ok: false, error: 'Payment capture failed', payment },
          { status: 409 }
        );
      }
    } else {
      const nextPayload = {
        ...payload,
        finalFare,
        paymentStatus: paymentStatus || payload?.paymentStatus || 'captured',
      };
      const [result] = await conn.execute<mysql.ResultSetHeader>(
        `UPDATE client_journeys
            SET status = 'Completed',
                ride_status = 'payment_captured',
                final_fare = ?,
                fare_finalized_at = NOW(),
                booking_payload = ?,
                updated_at = NOW()
          WHERE id = ?
            AND status = 'Upcoming'
          LIMIT 1`,
        [finalFare, JSON.stringify(nextPayload), journeyId]
      );
      if (!result.affectedRows) {
        await conn.rollback();
        return NextResponse.json({ error: 'Booking not found or not upcoming' }, { status: 404 });
      }
      payment = { ok: true, strategy: paymentFlow === 'fixed_pay_now' ? 'fixed_already_paid' : 'completed_without_charge' };
    }
    await conn.commit();

    try {
      const statementResult = await generateStatementForJourney(pool, journeyId);
      if (statementResult.status === 'skipped') {
        return NextResponse.json({
          ok: true,
          payment,
          warning: `Job marked as completed, but ${statementResult.reason}`,
        });
      }
    } catch (statementErr) {
      console.error('Complete booking statement generation error', statementErr);
      return NextResponse.json({
        ok: true,
        payment,
        warning: 'Job marked as completed, but statement PDF could not be generated.',
      });
    }

    return NextResponse.json({ ok: true, payment });
  } catch (err: any) {
    await conn.rollback();
    console.error('Complete booking error', err);
    return NextResponse.json({ error: err?.message || 'Failed to mark booking as completed' }, { status: 500 });
  } finally {
    conn.release();
  }
}
