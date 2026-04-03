import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const pool = getDbPool();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableDbError = (err: any) =>
  err?.code === 'ECONNRESET' ||
  err?.code === 'PROTOCOL_CONNECTION_LOST' ||
  err?.code === 'ETIMEDOUT';

const queryWithRetry = async <T extends mysql.RowDataPacket[]>(
  sql: string,
  params?: any[],
  retries = 1
) => {
  try {
    return await pool.query<T>(sql, params);
  } catch (err) {
    if (!isRetryableDbError(err) || retries <= 0) throw err;
    await sleep(150);
    return queryWithRetry<T>(sql, params, retries - 1);
  }
};

type StreamBooking = {
  journeyId: number;
  code: string;
  pickup: string;
  dropOff: string;
  passenger: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  priceDetails: string;
  createdAt: string | null;
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  return {
    date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
};

const formatPriceDetails = (price: number, extras?: unknown) => {
  const base = `GBP ${price.toFixed(2)}`;
  if (!Array.isArray(extras) || extras.length === 0) return base;
  const cleanedExtras = extras
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.replace(/^Extras applied:\s*/i, '').trim();
      }
      if (entry && typeof entry === 'object') {
        const label = 'label' in entry ? String((entry as { label?: unknown }).label || '').trim() : '';
        const amountRaw = 'amount' in entry ? Number((entry as { amount?: unknown }).amount) : NaN;
        if (label && Number.isFinite(amountRaw) && amountRaw > 0) {
          return `${label} GBP ${amountRaw.toFixed(2)}`;
        }
        if (label) return label;
      }
      return String(entry || '').replace(/^Extras applied:\s*/i, '').trim();
    })
    .filter(Boolean);
  if (!cleanedExtras.length) return base;
  return `${base} ( ${cleanedExtras.join(' + ')} )`;
};

const getCurrentMaxUpcomingId = async () => {
  const [rows] = await queryWithRetry<mysql.RowDataPacket[]>(
    `SELECT COALESCE(MAX(id), 0) AS max_id
      FROM client_journeys
      WHERE status = 'Upcoming'`
  );

  const row = rows[0] || {};
  return Number(row.max_id || 0);
};

const getNewUpcomingBookings = async (afterId: number): Promise<StreamBooking[]> => {
  const [rows] = await queryWithRetry<mysql.RowDataPacket[]>(
    `SELECT cj.id,
            cj.journey_date,
            cj.pickup,
            cj.destination,
            cj.passenger_name,
            cj.passenger_phone,
            cj.passenger_email,
            cj.price,
            cj.booking_payload,
            cj.created_at,
            u.email AS client_email
      FROM client_journeys cj
      LEFT JOIN users u ON cj.client_id = u.id
      WHERE cj.status = 'Upcoming' AND cj.id > ?
      ORDER BY cj.id ASC
      LIMIT 20`,
    [afterId]
  );

  return rows.map((row) => {
    let payload: any = null;
    if (row.booking_payload) {
      try {
        payload = typeof row.booking_payload === 'string' ? JSON.parse(row.booking_payload) : row.booking_payload;
      } catch {
        payload = null;
      }
    }
    const journeyDate = String(row.journey_date || '');
    const { date, time } = formatDate(journeyDate);
    const priceNumber = Number(row.price ?? payload?.totalFare ?? 0) || 0;

    return {
      journeyId: Number(row.id),
      code: `VD-${String(row.id).padStart(4, '0')}`,
      pickup: String(row.pickup || ''),
      dropOff: String(row.destination || ''),
      passenger: String(row.passenger_name || payload?.passengerName || 'Guest Passenger'),
      phone: String(row.passenger_phone || payload?.passengerPhone || ''),
      email: String(row.passenger_email || row.client_email || payload?.passengerEmail || ''),
      date,
      time,
      priceDetails: formatPriceDetails(priceNumber, payload?.extras),
      createdAt: row.created_at ? String(row.created_at) : null,
    };
  });
};

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const url = new URL(request.url);
  const rawAfterId = url.searchParams.get('afterId');
  const parsedAfterId = rawAfterId == null || rawAfterId.trim() === '' ? NaN : Number(rawAfterId);
  const requestedAfterId = Number.isFinite(parsedAfterId) && parsedAfterId >= 0 ? parsedAfterId : null;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastSeenId = requestedAfterId ?? (await getCurrentMaxUpcomingId());
      let checker: ReturnType<typeof setInterval> | null = null;
      let keepAlive: ReturnType<typeof setInterval> | null = null;
      let checking = false;
      let lastErrorLogAt = 0;

      const writeEvent = (event: string, payload: Record<string, unknown>) => {
        const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      };

      const closeStream = () => {
        if (closed) return;
        closed = true;
        if (checker) clearInterval(checker);
        if (keepAlive) clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // Client already disconnected.
        }
      };

      request.signal.addEventListener('abort', closeStream);

      writeEvent('connected', { ok: true, ts: Date.now(), lastSeenId });

      const checkForUpdates = async () => {
        if (closed || checking) return;
        checking = true;
        try {
          const newBookings = await getNewUpcomingBookings(lastSeenId);
          if (newBookings.length) {
            for (const booking of newBookings) {
              writeEvent('booking-created', { ts: Date.now(), booking });
            }
            lastSeenId = newBookings[newBookings.length - 1].journeyId;
          }
        } catch (err) {
          const now = Date.now();
          if (now - lastErrorLogAt > 15000) {
            console.error('Live bookings stream check failed', err);
            lastErrorLogAt = now;
          }
        } finally {
          checking = false;
        }
      };

      checkForUpdates();
      checker = setInterval(checkForUpdates, 1500);
      keepAlive = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        }
      }, 20000);
    },
    cancel() {
      // Intervals are cleared in closeStream via request abort.
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
