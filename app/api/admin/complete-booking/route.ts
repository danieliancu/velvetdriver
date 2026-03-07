import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { upsertDriverStatementForAllocation } from '@/lib/driver-statements';

const pool = getDbPool();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const journeyId = Number(body?.journeyId);
    if (!journeyId) {
      return NextResponse.json({ error: 'Missing journey id' }, { status: 400 });
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE client_journeys
          SET status = 'Completed'
        WHERE id = ?
          AND status = 'Upcoming'
        LIMIT 1`,
      [journeyId]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Booking not found or not upcoming' }, { status: 404 });
    }

    const [bookingRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id,
              cj.journey_date,
              cj.created_at,
              cj.pickup,
              cj.destination,
              cj.passenger_name,
              cj.passenger_phone,
              cj.price,
              cj.driver_price,
              cj.driver_name,
              cj.vehicle_type_id,
              cj.booking_payload,
              pv.label AS vehicle_label
         FROM client_journeys cj
         LEFT JOIN pricing_vehicles pv ON pv.id = cj.vehicle_type_id
        WHERE cj.id = ?
        LIMIT 1`,
      [journeyId]
    );

    const booking = bookingRows[0];
    if (!booking) {
      return NextResponse.json({ ok: true });
    }

    let payload: any = null;
    if (booking.booking_payload) {
      try {
        payload =
          typeof booking.booking_payload === 'string'
            ? JSON.parse(booking.booking_payload)
            : booking.booking_payload;
      } catch {
        payload = null;
      }
    }

    const rawDriver = String(booking.driver_name || '').trim();
    let [driverRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id, d.first_and_middle_name, d.surname, d.pco_license_no
         FROM drivers d
        WHERE d.id = ?
        LIMIT 1`,
      [Number(rawDriver)]
    );

    if (!driverRows.length && rawDriver) {
      [driverRows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT d.id, d.first_and_middle_name, d.surname, d.pco_license_no
           FROM drivers d
          WHERE LOWER(TRIM(CONCAT_WS(' ', d.first_and_middle_name, d.surname))) = LOWER(TRIM(?))
          LIMIT 1`,
        [rawDriver]
      );
    }

    const driver = driverRows[0];
    if (!driver?.id) {
      return NextResponse.json({
        ok: true,
        warning: 'Job marked as completed, but statement was skipped because driver was not found.',
      });
    }

    const [carRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT c.vehicle_registration, c.make, c.model
         FROM driver_cars dc
         INNER JOIN cars c ON c.id = dc.car_id
        WHERE dc.driver_id = ?
          AND dc.deleted_at IS NULL
        ORDER BY (dc.status = 'active') DESC, dc.id DESC
        LIMIT 1`,
      [Number(driver.id)]
    );
    const car = carRows[0] || {};

    const driverName =
      [driver.first_and_middle_name, driver.surname].filter(Boolean).join(' ').trim() || rawDriver || 'Assigned driver';
    const bookingRef = `VD-${String(journeyId).padStart(4, '0')}`;
    const fareQuoted = Number(booking.driver_price ?? booking.price ?? payload?.totalFare ?? 0) || 0;
    const vehicleType =
      booking.vehicle_label || payload?.vehicle || payload?.vehicleLabel || payload?.vehicleTypeLabel || '-';

    try {
      await upsertDriverStatementForAllocation(pool, {
        journeyId,
        driverId: Number(driver.id),
        bookingRef,
        bookingDate: booking.created_at ? String(booking.created_at) : null,
        journeyDate: booking.journey_date ? String(booking.journey_date) : null,
        customerName: String(booking.passenger_name || payload?.passengerName || 'Client'),
        phoneNumber: String(booking.passenger_phone || payload?.passengerPhone || '-'),
        collection: String(booking.pickup || '-'),
        destination: String(booking.destination || '-'),
        fareQuoted,
        personAccepting: 'Velvet Admin',
        personDispatching: 'Velvet Dispatch',
        driverName: String(driverName),
        driverLicenseNo: String(driver.pco_license_no || '-'),
        vehicleReg: String(car.vehicle_registration || '-'),
        vehicleType: String(vehicleType),
        subletOperatorNo: 'VELVET-001',
        subletOperatorName: 'Velvet Drivers Limited',
      });
    } catch (statementErr) {
      console.error('Complete booking statement generation error', statementErr);
      return NextResponse.json({
        ok: true,
        warning: 'Job marked as completed, but statement PDF could not be generated.',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Complete booking error', err);
    return NextResponse.json({ error: 'Failed to mark booking as completed' }, { status: 500 });
  }
}
