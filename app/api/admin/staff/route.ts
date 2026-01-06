import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool, DbRow } from '@/lib/db';

const pool = getDbPool();

type StaffRow = DbRow<{
  id: number;
  full_name: string;
  email: string | null;
  username: string;
  password: string;
  role: string;
  created_at: string;
  updated_at: string;
}>;

const mapStaff = (row: StaffRow) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  username: row.username,
  password: row.password,
  role: row.role,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function addAdminNotification(
  title: string,
  message: string,
  relatedId: number | null,
  severity: 'critical' | 'warning' | 'info' | 'success' = 'info',
  tags: Record<string, any> = {}
) {
  try {
    await pool.execute(
      `INSERT INTO admin_notifications (category, title, message, severity, related_table, related_id, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'staff',
        title,
        message,
        severity,
        'admin_staff',
        relatedId,
        Object.keys(tags).length ? JSON.stringify(tags) : null,
      ]
    );
  } catch (err) {
    console.error('Admin staff notification insert error', err);
  }
}

async function addAuditEvent(
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  pk: number | null,
  payload: Record<string, any>
) {
  try {
    await pool.execute(
      `INSERT INTO audit_events (table_name, operation, pk, payload)
       VALUES (?, ?, ?, ?)`,
      ['admin_staff', operation, pk !== null ? String(pk) : null, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error('Admin staff audit insert error', err);
  }
}

export async function GET() {
  try {
    const [rows] = await pool.query<StaffRow[]>(
      `SELECT id, full_name, email, username, password, role, created_at, updated_at
       FROM admin_staff
       ORDER BY created_at DESC
       LIMIT 500`
    );
    return NextResponse.json({ staff: rows.map(mapStaff) });
  } catch (err) {
    console.error('Admin staff fetch error', err);
    return NextResponse.json({ error: 'Failed to load staff' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullName = String(body.fullName ?? '').trim();
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '').trim();
    const email = body.email !== undefined ? String(body.email ?? '').trim() : null;
    const role = String(body.role ?? '').trim() || 'Staff';

    if (!fullName || !username || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO admin_staff (full_name, email, username, password, role) VALUES (?, ?, ?, ?, ?)`,
      [fullName, email || null, username, password, role]
    );

    const insertedId = result.insertId;
    const [rows] = await pool.query<StaffRow[]>(
      `SELECT id, full_name, email, username, password, role, created_at, updated_at
       FROM admin_staff WHERE id = ? LIMIT 1`,
      [insertedId]
    );

    const created = rows[0] ? mapStaff(rows[0]) : null;
    if (created) {
      await addAdminNotification(
        'Staff member added',
        `Added ${created.fullName} (${created.username})`,
        created.id,
        'success',
        { action: 'create' }
      );
      await addAuditEvent('INSERT', created.id, {
        category: 'staff',
        title: 'Staff member added',
        message: `Added ${created.fullName} (${created.username})`,
        severity: 'success',
        tags: { action: 'create' },
        new: created,
      });
    }

    return NextResponse.json({ staff: created }, { status: 201 });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Email or username already exists' }, { status: 409 });
    }
    console.error('Admin staff create error', err);
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: Array<any> = [];

    if (body.fullName !== undefined) {
      const fullName = String(body.fullName ?? '').trim();
      if (!fullName) return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
      updates.push('full_name = ?');
      params.push(fullName);
    }

    if (body.email !== undefined) {
      const email = String(body.email ?? '').trim();
      updates.push('email = ?');
      params.push(email || null);
    }

    if (body.username !== undefined) {
      const username = String(body.username ?? '').trim();
      if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
      updates.push('username = ?');
      params.push(username);
    }

    if (body.password !== undefined) {
      const password = String(body.password ?? '').trim();
      if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 });
      updates.push('password = ?');
      params.push(password);
    }

    if (body.role !== undefined) {
      const role = String(body.role ?? '').trim();
      updates.push('role = ?');
      params.push(role || 'Staff');
    }

    if (!updates.length) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    params.push(id);

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE admin_staff SET ${updates.join(', ')} WHERE id = ? LIMIT 1`,
      params
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    const [rows] = await pool.query<StaffRow[]>(
      `SELECT id, full_name, email, username, password, role, created_at, updated_at
       FROM admin_staff WHERE id = ? LIMIT 1`,
      [id]
    );

    const updated = rows[0] ? mapStaff(rows[0]) : null;
    if (updated) {
      await addAdminNotification(
        'Staff member updated',
        `Updated ${updated.fullName} (${updated.username})`,
        updated.id,
        'info',
        { action: 'update' }
      );
      await addAuditEvent('UPDATE', updated.id, {
        category: 'staff',
        title: 'Staff member updated',
        message: `Updated ${updated.fullName} (${updated.username})`,
        severity: 'info',
        tags: { action: 'update' },
        new: updated,
      });
    }

    return NextResponse.json({ staff: updated });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Email or username already exists' }, { status: 409 });
    }
    console.error('Admin staff update error', err);
    return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) {
      return NextResponse.json({ error: 'Missing staff id' }, { status: 400 });
    }

    const [existingRows] = await pool.query<StaffRow[]>(
      `SELECT id, full_name, email, username, password, role, created_at, updated_at
       FROM admin_staff WHERE id = ? LIMIT 1`,
      [id]
    );
    const existing = existingRows[0] ? mapStaff(existingRows[0]) : null;

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      'DELETE FROM admin_staff WHERE id = ? LIMIT 1',
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    if (existing) {
      await addAdminNotification(
        'Staff member deleted',
        `Deleted ${existing.fullName} (${existing.username})`,
        existing.id,
        'warning',
        { action: 'delete' }
      );
      await addAuditEvent('DELETE', existing.id, {
        category: 'staff',
        title: 'Staff member deleted',
        message: `Deleted ${existing.fullName} (${existing.username})`,
        severity: 'warning',
        tags: { action: 'delete' },
        old: existing,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Admin staff delete error', err);
    return NextResponse.json({ error: 'Failed to delete staff member' }, { status: 500 });
  }
}
