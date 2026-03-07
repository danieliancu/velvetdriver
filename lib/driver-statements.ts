import mysql from 'mysql2/promise';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { uploadRawToCloudinary } from '@/lib/cloudinary';

export type StatementAllocationPayload = {
  journeyId: number;
  driverId: number;
  bookingRef: string;
  bookingDate: string | Date | null;
  journeyDate: string | Date | null;
  customerName: string;
  phoneNumber: string;
  collection: string;
  destination: string;
  fareQuoted: number;
  personAccepting: string;
  personDispatching: string;
  driverName: string;
  driverLicenseNo: string;
  vehicleReg: string;
  vehicleType: string;
  subletOperatorNo: string;
  subletOperatorName: string;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const formatDate = (value: string | Date | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const toMySqlDateTime = (value: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

async function buildStatementPdfBytes(payload: StatementAllocationPayload) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const left = 50;
  const right = A4_WIDTH - 50;
  let y = A4_HEIGHT - 56;

  page.drawText('Velvet Drivers Statement', {
    x: left,
    y,
    size: 18,
    font: bold,
    color: rgb(0.2, 0.12, 0.12),
  });
  y -= 26;

  page.drawText(`Reference: ${payload.bookingRef}`, {
    x: left,
    y,
    size: 12,
    font: bold,
    color: rgb(0, 0, 0),
  });
  y -= 22;

  const rows: Array<[string, string]> = [
    ['Person accepting booking', payload.personAccepting],
    ['Date of booking', formatDate(payload.bookingDate)],
    ['Date of journey', formatDate(payload.journeyDate)],
    ['Customer name', payload.customerName],
    ['Phone number', payload.phoneNumber],
    ['Place of collection', payload.collection],
    ['Main destination', payload.destination],
    ['Fare quoted', `GBP ${payload.fareQuoted.toFixed(2)}`],
    ['Person dispatching booking', payload.personDispatching],
    ['Driver full name', payload.driverName],
    ['Driver PCO licence number', payload.driverLicenseNo],
    ['Vehicle reg number', payload.vehicleReg],
    ['Vehicle type', payload.vehicleType],
    ['Sublet operator no.', payload.subletOperatorNo],
    ['Sublet operator name', payload.subletOperatorName],
  ];

  const maxLineWidth = right - (left + 200);
  const wrapText = (text: string, usedFont: any, size: number) => {
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return ['-'];
    const lines: string[] = [];
    let current = '';
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      const width = usedFont.widthOfTextAtSize(next, size);
      if (width <= maxLineWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);
    return lines;
  };

  rows.forEach(([label, value]) => {
    page.drawText(`${label}:`, {
      x: left,
      y,
      size: 11,
      font: bold,
      color: rgb(0, 0, 0),
    });

    const lines = wrapText(value || '-', font, 11);
    lines.forEach((line, idx) => {
      page.drawText(line, {
        x: left + 200,
        y: y - idx * 15,
        size: 11,
        font,
        color: rgb(0, 0, 0),
      });
    });

    y -= Math.max(20, lines.length * 15 + 5);
  });

  page.drawText('Generated automatically at completion time.', {
    x: left,
    y: 40,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });

  return new Uint8Array(await pdfDoc.save());
}

export async function ensureDriverStatementsTable(pool: mysql.Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS driver_statements (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      journey_id BIGINT UNSIGNED NOT NULL,
      driver_id BIGINT UNSIGNED NOT NULL,
      booking_ref VARCHAR(32) NOT NULL,
      booking_date DATETIME NULL,
      journey_date DATETIME NULL,
      customer_name VARCHAR(255) NOT NULL DEFAULT '',
      phone_number VARCHAR(64) NULL,
      collection VARCHAR(255) NOT NULL DEFAULT '',
      destination VARCHAR(255) NOT NULL DEFAULT '',
      fare_quoted DECIMAL(10,2) NOT NULL DEFAULT 0,
      person_accepting VARCHAR(255) NOT NULL DEFAULT 'Velvet Dispatch',
      person_dispatching VARCHAR(255) NOT NULL DEFAULT 'Velvet Dispatch',
      driver_name VARCHAR(255) NOT NULL DEFAULT '',
      driver_license_no VARCHAR(128) NULL,
      vehicle_reg VARCHAR(64) NULL,
      vehicle_type VARCHAR(128) NULL,
      sublet_operator_no VARCHAR(64) NOT NULL DEFAULT 'VELVET-001',
      sublet_operator_name VARCHAR(255) NOT NULL DEFAULT 'Velvet Drivers Limited',
      statement_pdf_url TEXT NULL,
      statement_pdf_public_id VARCHAR(255) NULL,
      status ENUM('Unpaid','Paid') NOT NULL DEFAULT 'Unpaid',
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_driver_statements_journey (journey_id),
      KEY idx_driver_statements_driver_date (driver_id, journey_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

export async function upsertDriverStatementForAllocation(
  pool: mysql.Pool,
  payload: StatementAllocationPayload
) {
  await ensureDriverStatementsTable(pool);
  const bookingDateSql = toMySqlDateTime(payload.bookingDate);
  const journeyDateSql = toMySqlDateTime(payload.journeyDate);

  const pdfBytes = await buildStatementPdfBytes(payload);
  const fileName = `${payload.bookingRef}-statement.pdf`;
  const publicId = `${payload.bookingRef}-statement`;

  const upload = await uploadRawToCloudinary({
    bytes: pdfBytes,
    fileName,
    folder: `statements/${payload.driverId}`,
    publicId,
    contentType: 'application/pdf',
  });

  await pool.execute(
    `INSERT INTO driver_statements (
      journey_id,
      driver_id,
      booking_ref,
      booking_date,
      journey_date,
      customer_name,
      phone_number,
      collection,
      destination,
      fare_quoted,
      person_accepting,
      person_dispatching,
      driver_name,
      driver_license_no,
      vehicle_reg,
      vehicle_type,
      sublet_operator_no,
      sublet_operator_name,
      statement_pdf_url,
      statement_pdf_public_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      driver_id = VALUES(driver_id),
      booking_ref = VALUES(booking_ref),
      booking_date = VALUES(booking_date),
      journey_date = VALUES(journey_date),
      customer_name = VALUES(customer_name),
      phone_number = VALUES(phone_number),
      collection = VALUES(collection),
      destination = VALUES(destination),
      fare_quoted = VALUES(fare_quoted),
      person_accepting = VALUES(person_accepting),
      person_dispatching = VALUES(person_dispatching),
      driver_name = VALUES(driver_name),
      driver_license_no = VALUES(driver_license_no),
      vehicle_reg = VALUES(vehicle_reg),
      vehicle_type = VALUES(vehicle_type),
      sublet_operator_no = VALUES(sublet_operator_no),
      sublet_operator_name = VALUES(sublet_operator_name),
      statement_pdf_url = VALUES(statement_pdf_url),
      statement_pdf_public_id = VALUES(statement_pdf_public_id)`,
    [
      payload.journeyId,
      payload.driverId,
      payload.bookingRef,
      bookingDateSql,
      journeyDateSql,
      payload.customerName,
      payload.phoneNumber,
      payload.collection,
      payload.destination,
      payload.fareQuoted,
      payload.personAccepting,
      payload.personDispatching,
      payload.driverName,
      payload.driverLicenseNo,
      payload.vehicleReg,
      payload.vehicleType,
      payload.subletOperatorNo,
      payload.subletOperatorName,
      upload.secureUrl,
      upload.publicId,
    ]
  );

  return {
    pdfUrl: upload.secureUrl,
  };
}
