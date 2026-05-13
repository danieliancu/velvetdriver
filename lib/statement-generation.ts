import mysql from 'mysql2/promise';
import { upsertDriverStatementForAllocation } from './driver-statements';

export type StatementGenerationResult =
  | {
      status: 'generated';
      journeyId: number;
      bookingRef: string;
      driverId: number;
      pdfUrl: string | null;
    }
  | {
      status: 'skipped';
      journeyId: number;
      bookingRef: string;
      reason: string;
    };

function parseBookingPayload(raw: any) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

async function findDriverForBooking(pool: mysql.Pool, rawDriver: string) {
  const trimmed = String(rawDriver || '').trim();
  if (!trimmed) return null;

  const numericDriverId = Number(trimmed);
  let driverRows: mysql.RowDataPacket[] = [];
  if (Number.isFinite(numericDriverId) && numericDriverId > 0) {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id, d.first_and_middle_name, d.surname, d.pco_license_no
         FROM drivers d
        WHERE d.id = ?
        LIMIT 1`,
      [numericDriverId]
    );
    driverRows = rows;
  }

  if (!driverRows.length) {
    [driverRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id, d.first_and_middle_name, d.surname, d.pco_license_no
         FROM drivers d
        WHERE LOWER(TRIM(CONCAT_WS(' ', d.first_and_middle_name, d.surname))) = LOWER(TRIM(?))
        LIMIT 1`,
      [trimmed]
    );
  }

  return driverRows[0] || null;
}

async function findDriverCar(pool: mysql.Pool, driverId: number) {
  const [carRows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT c.vehicle_registration, c.make, c.model
       FROM driver_cars dc
       INNER JOIN cars c ON c.id = dc.car_id
      WHERE dc.driver_id = ?
        AND dc.deleted_at IS NULL
      ORDER BY (dc.status = 'active') DESC, dc.id DESC
      LIMIT 1`,
    [driverId]
  );

  return carRows[0] || null;
}

async function getClientJourneyColumns(pool: mysql.Pool) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'client_journeys'`
  );
  return new Set(rows.map((row) => String(row.COLUMN_NAME || '')));
}

export async function generateStatementForJourney(
  pool: mysql.Pool,
  journeyId: number
): Promise<StatementGenerationResult> {
  const columns = await getClientJourneyColumns(pool);
  const [bookingRows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT cj.id,
            cj.status,
            cj.journey_date,
            cj.created_at,
            cj.pickup,
            cj.destination,
            cj.passenger_name,
            cj.passenger_phone,
            cj.price,
            cj.driver_price,
            cj.driver_name,
            ${columns.has('driver_id') ? 'cj.driver_id' : 'NULL AS driver_id'},
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
  const bookingRef = `VD-${String(journeyId).padStart(4, '0')}`;
  if (!booking) {
    return {
      status: 'skipped',
      journeyId,
      bookingRef,
      reason: 'Booking not found.',
    };
  }

  if (String(booking.status || '').trim() !== 'Completed') {
    return {
      status: 'skipped',
      journeyId,
      bookingRef,
      reason: 'Statement can only be generated after the journey is completed.',
    };
  }

  const payload = parseBookingPayload(booking.booking_payload);
  const rawDriver = String(booking.driver_id || booking.driver_name || '').trim();
  const driver = await findDriverForBooking(pool, rawDriver);
  if (!driver?.id) {
    return {
      status: 'skipped',
      journeyId,
      bookingRef,
      reason: 'Statement skipped because driver was not found.',
    };
  }

  const car = await findDriverCar(pool, Number(driver.id));
  const driverName =
    [driver.first_and_middle_name, driver.surname].filter(Boolean).join(' ').trim() || rawDriver || 'Assigned driver';
  const fareQuoted = Number(booking.driver_price ?? booking.price ?? payload?.totalFare ?? 0) || 0;
  const vehicleType =
    booking.vehicle_label || payload?.vehicle || payload?.vehicleLabel || payload?.vehicleTypeLabel || '-';

  const statement = await upsertDriverStatementForAllocation(pool, {
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
    vehicleReg: String(car?.vehicle_registration || '-'),
    vehicleType: String(vehicleType),
    subletOperatorNo: 'VELVET-001',
    subletOperatorName: 'Velvet Drivers Limited',
  });

  return {
    status: 'generated',
    journeyId,
    bookingRef,
    driverId: Number(driver.id),
    pdfUrl: statement.pdfUrl || null,
  };
}
