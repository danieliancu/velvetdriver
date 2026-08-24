import { NextResponse } from 'next/server';
import { getDbPool, DbRow } from '@/lib/db';

export const dynamic = 'force-dynamic';

const pool = getDbPool();

type ClientBookingRow = DbRow<{
  user_id: number;
  email: string;
  user_phone: string | null;
  user_status: string | null;
  client_name: string | null;
  client_phone: string | null;
  booking_id: number | null;
  booking_created_at: string | null;
  journey_date: string | null;
  pickup: string | null;
  destination: string | null;
  price: number | null;
  status: string | null;
}>;

export async function GET() {
  try {
    const [rows] = await pool.query<ClientBookingRow[]>(
      `SELECT u.id AS user_id,
              u.email,
              u.phone AS user_phone,
              u.status AS user_status,
              c.full_name AS client_name,
              c.phone AS client_phone,
              cj.id AS booking_id,
              cj.created_at AS booking_created_at,
              cj.journey_date,
              cj.pickup,
              cj.destination,
              cj.price,
              cj.status
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'client'
       LEFT JOIN clients c ON c.user_id = u.id
       LEFT JOIN client_journeys cj ON cj.client_id = u.id
       ORDER BY u.id DESC, cj.created_at DESC, cj.id DESC`
    );

    const clientMap = new Map<
      number,
      {
        id: number;
        name: string;
        email: string;
        phone: string;
        status: string;
        bookingCount: number;
        firstPurchaseAt: string | null;
        lastPurchaseAt: string | null;
        bookings: Array<{
          id: number;
          purchasedAt: string | null;
          journeyDate: string | null;
          pickup: string;
          destination: string;
          price: number;
          status: string;
        }>;
      }
    >();

    for (const row of rows) {
      if (!clientMap.has(row.user_id)) {
        clientMap.set(row.user_id, {
          id: row.user_id,
          name: row.client_name || row.email,
          email: row.email,
          phone: row.client_phone || row.user_phone || '',
          status: row.user_status || 'active',
          bookingCount: 0,
          firstPurchaseAt: null,
          lastPurchaseAt: null,
          bookings: [],
        });
      }

      const client = clientMap.get(row.user_id)!;
      if (!row.booking_id) continue;

      const purchasedAt = row.booking_created_at || null;
      client.bookings.push({
        id: row.booking_id,
        purchasedAt,
        journeyDate: row.journey_date || null,
        pickup: row.pickup || '',
        destination: row.destination || '',
        price: Number(row.price ?? 0),
        status: row.status || '',
      });
      client.bookingCount += 1;

      if (purchasedAt) {
        if (!client.lastPurchaseAt || new Date(purchasedAt).getTime() > new Date(client.lastPurchaseAt).getTime()) {
          client.lastPurchaseAt = purchasedAt;
        }
        if (!client.firstPurchaseAt || new Date(purchasedAt).getTime() < new Date(client.firstPurchaseAt).getTime()) {
          client.firstPurchaseAt = purchasedAt;
        }
      }
    }

    const clients = Array.from(clientMap.values());
    return NextResponse.json({ clients });
  } catch (err) {
    console.error('Admin clients fetch error', err);
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 });
  }
}
