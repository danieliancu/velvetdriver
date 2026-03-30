import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { consumeClientCredit, getClientCreditBalance } from '@/lib/client-credit';
import { persistBookingAuthorization } from '@/lib/ride-payments';

const pool = getDbPool();

export async function POST(request: Request) {
  const conn = await pool.getConnection();
  try {
    const body = await request.json();
    const pickup = String(body.pickup ?? '').trim();
    const dropOffs = Array.isArray(body.dropOffs) ? body.dropOffs.map((d: string) => String(d ?? '').trim()).filter(Boolean) : [];
    const date = String(body.date ?? '').trim();
    const time = String(body.time ?? '').trim();
    const passengerName = String(body.passengerName ?? '').trim();
    const passengerEmail = String(body.passengerEmail ?? '').trim();
    const passengerPhone = String(body.passengerPhone ?? '').trim();
    const paymentMethod = String(body.paymentMethod ?? '').trim();
    const paymentIntentId = String(body.paymentIntentId ?? '').trim();
    const totalFare = Math.max(0, Number(body.totalFare ?? 0));
    const requestedAppliedCredit = Math.max(0, Number(body.appliedCreditAmount ?? 0));
    if (!pickup || !dropOffs.length || !date || !time || !passengerName || !passengerEmail || !passengerPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const journeyDate = new Date(`${date}T${time}`);
    if (Number.isNaN(journeyDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date or time' }, { status: 400 });
    }

    let clientId: number | null = null;
    const clientLookupEmail = String(body.clientEmail ?? passengerEmail ?? '').trim().toLowerCase();
    if (clientLookupEmail) {
      const [users] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [clientLookupEmail]);
      if (users[0]?.id) clientId = Number(users[0].id);
    }

    let appliedCreditAmount = 0;
    if (clientId) {
      const availableCredit = await getClientCreditBalance(conn, clientId);
      appliedCreditAmount = Math.min(totalFare, availableCredit, requestedAppliedCredit);
    }
    const amountDueNow = Math.max(0, Math.round((totalFare - appliedCreditAmount) * 100) / 100);
    if (paymentMethod.toLowerCase() === 'card authorization' && amountDueNow > 0 && !paymentIntentId) {
      return NextResponse.json({ error: 'Missing authorized payment intent' }, { status: 400 });
    }

    const destination = dropOffs
      .map((stop: string, index: number) => (index === dropOffs.length - 1 ? stop : `Stop ${index + 1}: ${stop}`))
      .join(', ');
    const payload = {
      ...body,
      pickup,
      dropOffs,
      totalFare,
      appliedCreditAmount,
      amountDueNow,
      paymentStatus:
        paymentMethod.toLowerCase() === 'card authorization'
          ? 'authorized'
          : paymentMethod.toLowerCase() === 'credit'
            ? 'captured'
            : 'authorization_pending',
    };

    await conn.beginTransaction();
    const [result] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO client_journeys
        (client_id, journey_date, pickup, destination, service_type, driver_name, car, plate, status, ride_status,
         payment_status, price, original_estimated_fare, current_estimated_fare, final_fare, originally_authorized_amount,
         latest_authorized_amount, captured_amount, invoice_url, passenger_name, passenger_email, passenger_phone,
         vehicle_type_id, booking_payload)
       VALUES (?, ?, ?, ?, ?, 'Pending assignment', 'TBD', 'TBD', 'Upcoming', ?, ?, ?, ?, ?, NULL, 0, 0, 0, NULL, ?, ?, ?, ?, ?)`,
      [
        clientId,
        journeyDate.toISOString().slice(0, 19).replace('T', ' '),
        pickup,
        destination,
        String(body.serviceType ?? 'Transfer'),
        paymentMethod.toLowerCase() === 'card authorization' ? 'payment_authorized' : 'booked',
        paymentMethod.toLowerCase() === 'card authorization'
          ? 'authorized'
          : paymentMethod.toLowerCase() === 'credit'
            ? 'captured'
            : 'authorization_pending',
        totalFare,
        totalFare,
        totalFare,
        passengerName,
        passengerEmail,
        passengerPhone,
        body.vehicleTypeId ? Number(body.vehicleTypeId) : null,
        JSON.stringify(payload),
      ]
    );
    const rideId = Number(result.insertId);

    if (clientId && appliedCreditAmount > 0) {
      await consumeClientCredit(conn, {
        clientId,
        journeyId: rideId,
        amount: appliedCreditAmount,
        reason: 'Applied to booking authorization',
        metadata: { source: 'booking', totalFare, amountDueNow },
      });
    }

    if (paymentMethod.toLowerCase() === 'card authorization' && amountDueNow > 0) {
      await persistBookingAuthorization(conn, { rideId, paymentIntentId, estimatedAmount: amountDueNow });
    } else if (paymentMethod.toLowerCase() === 'credit') {
      await conn.execute(
        `UPDATE client_journeys
            SET payment_status = 'captured',
                ride_status = 'payment_captured',
                originally_authorized_amount = 0,
                latest_authorized_amount = 0,
                captured_amount = 0
          WHERE id = ?
          LIMIT 1`,
        [rideId]
      );
    }

    await conn.commit();
    return NextResponse.json({ success: true, journeyId: rideId });
  } catch (err: any) {
    await conn.rollback();
    console.error('Booking create error', err);
    return NextResponse.json({ error: err?.message || 'Failed to submit booking' }, { status: 500 });
  } finally {
    conn.release();
  }
}
