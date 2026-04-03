import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { getRequestIp, logSiteActivity } from '@/lib/site-activity';

const pool = getDbPool();

async function executeOptional(conn: mysql.PoolConnection, sql: string, params?: any[]) {
  try {
    return await conn.execute(sql, params);
  } catch (err: any) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return null;
    throw err;
  }
}

async function deleteDriverAccount(conn: mysql.PoolConnection, driverId: number, userId: number, driverName: string) {
  const [driverCarRows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id, car_id
       FROM driver_cars
      WHERE driver_id = ?`,
    [driverId]
  );
  const driverCarIds = driverCarRows.map((row) => Number(row.id)).filter(Boolean);
  const carIds = driverCarRows.map((row) => Number(row.car_id)).filter(Boolean);
  const driverIdText = String(driverId).trim().toLowerCase();
  const driverNameText = driverName.trim().toLowerCase();

  await conn.execute(
    `UPDATE client_journeys
        SET driver_name = ?,
            car = 'TBD',
            plate = 'TBD',
            driver_commission_applied = NULL,
            driver_price = NULL
      WHERE status <> 'Completed'
        AND (
          LOWER(TRIM(driver_name)) = ?
          OR LOWER(TRIM(driver_name)) = ?
        )`,
    ['Pending assignment', driverIdText, driverNameText]
  );

  await conn.execute(
    `UPDATE client_journeys
        SET driver_name = ?
      WHERE status = 'Completed'
        AND (
          LOWER(TRIM(driver_name)) = ?
          OR LOWER(TRIM(driver_name)) = ?
        )`,
    [driverName, driverIdText, driverNameText]
  );

  if (driverCarIds.length) {
    await executeOptional(
      conn,
      `DELETE FROM driver_car_documents
        WHERE car_id IN (${driverCarIds.map(() => '?').join(',')})`,
      driverCarIds
    );
  }

  await executeOptional(conn, `DELETE FROM driver_bank_details WHERE driver_id = ?`, [driverId]);
  await conn.execute(`DELETE FROM driver_documents WHERE driver_id = ?`, [driverId]);
  await executeOptional(conn, `DELETE FROM driver_statements WHERE driver_id = ?`, [driverId]);
  await conn.execute(`DELETE FROM driver_cars WHERE driver_id = ?`, [driverId]);

  if (carIds.length) {
    await conn.execute(
      `DELETE FROM cars
        WHERE id IN (${carIds.map(() => '?').join(',')})
          AND id NOT IN (
            SELECT car_id
              FROM (
                SELECT car_id
                  FROM driver_cars
                 WHERE car_id IN (${carIds.map(() => '?').join(',')})
              ) AS linked_cars
          )`,
      [...carIds, ...carIds]
    );
  }

  await executeOptional(conn, `DELETE FROM password_reset_tokens WHERE user_id = ?`, [userId]);
  await conn.execute(`DELETE FROM drivers WHERE id = ? LIMIT 1`, [driverId]);
  await conn.execute(`DELETE FROM users WHERE id = ? LIMIT 1`, [userId]);
}

async function deleteClientAccount(conn: mysql.PoolConnection, clientId: number, userId: number) {
  await executeOptional(conn, `DELETE FROM client_saved_quotes WHERE client_id = ?`, [userId]);
  await executeOptional(conn, `DELETE FROM password_reset_tokens WHERE user_id = ?`, [userId]);
  await conn.execute(`DELETE FROM clients WHERE id = ? LIMIT 1`, [clientId]);
  await conn.execute(`DELETE FROM users WHERE id = ? LIMIT 1`, [userId]);
}

async function deleteCorporateAccount(conn: mysql.PoolConnection, corporateId: number, userId: number) {
  await executeOptional(conn, `DELETE FROM corporate_vehicle_types WHERE corporate_id = ?`, [corporateId]);
  await executeOptional(conn, `DELETE FROM corporate_journey_categories WHERE corporate_id = ?`, [corporateId]);
  await executeOptional(conn, `DELETE FROM password_reset_tokens WHERE user_id = ?`, [userId]);
  await conn.execute(`DELETE FROM corporates WHERE id = ? LIMIT 1`, [corporateId]);
  await conn.execute(`DELETE FROM users WHERE id = ? LIMIT 1`, [userId]);
}

export async function DELETE(request: Request) {
  const conn = await pool.getConnection();
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    const expectedRole = String(body?.expectedRole ?? '').trim().toLowerCase();
    if (!email || !expectedRole) {
      return NextResponse.json({ error: 'Missing email or role' }, { status: 400 });
    }

    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT u.id AS user_id,
              u.email,
              r.code AS role_code,
              c.id AS client_id,
              c.full_name AS client_name,
              d.id AS driver_id,
              d.first_and_middle_name,
              d.surname,
              corp.id AS corporate_id,
              corp.contact_name,
              corp.company_name
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         LEFT JOIN clients c ON c.user_id = u.id
         LEFT JOIN drivers d ON d.user_id = u.id
         LEFT JOIN corporates corp ON corp.user_id = u.id
        WHERE LOWER(TRIM(u.email)) = ?
        LIMIT 1`,
      [email]
    );

    const account = rows[0];
    if (!account?.user_id) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    if (String(account.role_code) !== expectedRole) {
      return NextResponse.json({ error: 'Account role mismatch' }, { status: 403 });
    }

    await conn.beginTransaction();

    if (expectedRole === 'driver') {
      const driverId = Number(account.driver_id || 0);
      if (!driverId) {
        await conn.rollback();
        return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 });
      }
      const driverName =
        [account.first_and_middle_name, account.surname].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ') ||
        `Driver ${driverId}`;
      await deleteDriverAccount(conn, driverId, Number(account.user_id), driverName);
    } else if (expectedRole === 'client') {
      const clientId = Number(account.client_id || 0);
      if (!clientId) {
        await conn.rollback();
        return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
      }
      await deleteClientAccount(conn, clientId, Number(account.user_id));
    } else if (expectedRole === 'corporate') {
      const corporateId = Number(account.corporate_id || 0);
      if (!corporateId) {
        await conn.rollback();
        return NextResponse.json({ error: 'Corporate profile not found' }, { status: 404 });
      }
      await deleteCorporateAccount(conn, corporateId, Number(account.user_id));
    } else {
      await conn.rollback();
      return NextResponse.json({ error: 'Unsupported role' }, { status: 400 });
    }

    await conn.commit();

    await logSiteActivity(pool, {
      tableName: 'users',
      operation: 'DELETE',
      pk: account.user_id,
      category: 'account',
      title: 'Account deleted by owner',
      message: `${email} deleted their own account.`,
      severity: 'warning',
      tags: { actor: expectedRole },
      changedBy: Number(account.user_id),
      changedByEmail: email,
      ip: getRequestIp(request),
      old: {
        email,
        role: expectedRole,
      },
    }).catch((err) => console.error('Account delete audit error', err));

    return NextResponse.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error('Account delete error', err);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  } finally {
    conn.release();
  }
}
