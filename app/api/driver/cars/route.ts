import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const vehicleReg = String(body.vehicleReg ?? '').trim();
    const make = String(body.make ?? '').trim();
    const model = String(body.model ?? '').trim();
    const colour = String(body.colour ?? '').trim();
    const keeperInfo = String(body.keeperInfo ?? '').trim();

    if (!email || !vehicleReg || !make || !model) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id AS driver_id
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'driver'
       INNER JOIN drivers d ON d.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );
    const driverId = rows[0]?.driver_id;
    if (!driverId) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const [carTypeRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id
       FROM vehicle_types
       WHERE is_active = 1
       ORDER BY (sort_order IS NULL), sort_order, id
       LIMIT 1`
    );
    const vehicleTypeId = carTypeRows[0]?.id;
    if (!vehicleTypeId) {
      return NextResponse.json({ error: 'No vehicle types configured' }, { status: 400 });
    }

    let carId: number | null = null;
    const [existingCar] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id FROM cars WHERE vehicle_registration = ? LIMIT 1`,
      [vehicleReg]
    );
    if (existingCar.length) {
      carId = existingCar[0].id;
    } else {
    const [carResult] = await pool.execute<mysql.ResultSetHeader>(
        `INSERT INTO cars
         (vehicle_type_id, vehicle_registration, make, model, colour, keeper_info)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [vehicleTypeId, vehicleReg, make, model, colour || null, keeperInfo || null]
      );
      carId = carResult.insertId;
    }

    const [existingDriverCar] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT id FROM driver_cars WHERE driver_id = ? AND car_id = ? AND deleted_at IS NULL LIMIT 1`,
      [driverId, carId]
    );
    let driverCarId = existingDriverCar[0]?.id || null;
    if (!driverCarId) {
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `INSERT INTO driver_cars
         (driver_id, car_id, status, assigned_from)
         VALUES (?, ?, 'active', NOW())`,
        [driverId, carId]
      );
      driverCarId = result.insertId;
    }

    return NextResponse.json({
      ok: true,
      id: driverCarId,
      vehicleReg,
      make,
      model,
      colour: colour || null,
      keeperInfo: keeperInfo || null,
    });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY' && String(err?.message || '').includes('uq_driver_active')) {
      return NextResponse.json(
        { error: 'Database constraint allows only one active car per driver. Remove uq_driver_active to allow multiple cars.' },
        { status: 409 }
      );
    }
    console.error('Driver car create error', err);
    return NextResponse.json({ error: 'Failed to add car' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const driverCarId = Number(body.driverCarId);
    if (!email || !driverCarId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id AS driver_id
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'driver'
       INNER JOIN drivers d ON d.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );
    const driverId = rows[0]?.driver_id;
    if (!driverId) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `DELETE FROM driver_cars WHERE id = ? AND driver_id = ? LIMIT 1`,
      [driverCarId, driverId]
    );
    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Car not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Driver car delete error', err);
    return NextResponse.json({ error: 'Failed to delete car' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const driverCarId = Number(body.driverCarId);
    const vehicleReg = String(body.vehicleReg ?? '').trim();
    const make = String(body.make ?? '').trim();
    const model = String(body.model ?? '').trim();
    const colour = String(body.colour ?? '').trim();
    const keeperInfo = String(body.keeperInfo ?? '').trim();

    if (!email || !driverCarId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id AS driver_id
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'driver'
       INNER JOIN drivers d ON d.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );
    const driverId = rows[0]?.driver_id;
    if (!driverId) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const [carRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT car_id FROM driver_cars WHERE id = ? AND driver_id = ? AND deleted_at IS NULL LIMIT 1`,
      [driverCarId, driverId]
    );
    const carId = carRows[0]?.car_id;
    if (!carId) {
      return NextResponse.json({ error: 'Car not found' }, { status: 404 });
    }

    await pool.execute(
      `UPDATE cars
       SET vehicle_registration = ?, make = ?, model = ?, colour = ?, keeper_info = ?
       WHERE id = ?`,
      [vehicleReg, make, model, colour || null, keeperInfo || null, carId]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Driver car update error', err);
    return NextResponse.json({ error: 'Failed to update car' }, { status: 500 });
  }
}
