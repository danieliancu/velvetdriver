import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const journeyId = Number(body?.journeyId);

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!journeyId) {
      return NextResponse.json({ error: 'Journey id is required' }, { status: 400 });
    }

    const [drivers] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id,
              d.first_and_middle_name,
              d.surname
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'driver'
       INNER JOIN drivers d ON d.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );

    const driver = drivers[0];
    if (!driver?.id) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const driverIdText = String(driver.id).trim().toLowerCase();
    const driverFullName = [driver.first_and_middle_name, driver.surname]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE client_journeys
          SET driver_name = 'Pending assignment',
              car = 'TBD',
              plate = 'TBD',
              driver_commission_applied = NULL,
              driver_price = NULL,
              client_confirmed = 1
        WHERE id = ?
          AND status = 'Upcoming'
          AND (
            LOWER(TRIM(driver_name)) = ?
            OR LOWER(TRIM(driver_name)) = ?
          )
        LIMIT 1`,
      [journeyId, driverIdText, driverFullName]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Job not found for this driver' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Driver cancel job error', err);
    return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
  }
}

