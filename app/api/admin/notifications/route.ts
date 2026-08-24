import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const pool = getDbPool();

type AuditRow = mysql.RowDataPacket & {
  id: number;
  table_name: string;
  operation: string;
  pk: string | null;
  changed_at: string;
  changed_by: number | null;
  changed_by_email: string | null;
  ip: string | null;
  payload: any;
};

type AdminNotificationRow = mysql.RowDataPacket & {
  id: number;
  category: string;
  title: string;
  message: string | null;
  severity: 'critical' | 'warning' | 'info' | 'success';
  tags: string | null;
  related_table: string | null;
  related_id: number | null;
  created_at: string;
};

async function getAuditEvents(): Promise<AuditRow[]> {
  try {
    const [rows] = await pool.query<AuditRow[]>(
      `SELECT id, table_name, operation, pk, changed_at, changed_by, changed_by_email, ip, payload
       FROM audit_events
       ORDER BY changed_at DESC
       LIMIT 200`
    );
    return rows;
  } catch (err) {
    console.error('Audit events fetch error', err);
    return [];
  }
}

async function getAdminNotifications(): Promise<AdminNotificationRow[]> {
  try {
    const [rows] = await pool.query<AdminNotificationRow[]>(
      `SELECT id, category, title, message, severity, tags, related_table, related_id, created_at
       FROM admin_notifications
       ORDER BY created_at DESC
       LIMIT 200`
    );
    return rows;
  } catch (err) {
    console.error('Admin notification table fetch error', err);
    return [];
  }
}

export async function GET() {
  const [auditRows, adminRows] = await Promise.all([getAuditEvents(), getAdminNotifications()]);
  const events = auditRows.map((r) => ({
    ...r,
    payload:
      typeof r.payload === 'string'
        ? (() => {
            try {
              return JSON.parse(r.payload);
            } catch {
              return null;
            }
          })()
        : r.payload,
  }));

  const notifications = adminRows.map((r) => ({
    id: r.id,
    table_name: r.category,
    operation: 'INSERT',
    pk: r.related_id?.toString() ?? null,
    changed_at: r.created_at,
    changed_by: null,
    changed_by_email: null,
    ip: null,
    payload: {
      category: r.category,
      title: r.title,
      message: r.message,
      severity: r.severity,
      tags: (() => {
        if (!r.tags) return null;
        try {
          return JSON.parse(r.tags);
        } catch {
          return null;
        }
      })(),
    },
  }));

  const merged = [...notifications, ...events].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  );

  return NextResponse.json({ events: merged });
}
