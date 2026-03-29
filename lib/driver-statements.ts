import mysql from 'mysql2/promise';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { uploadRawToCloudinary } from './cloudinary';

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
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const left = 38;
  const right = A4_WIDTH - 38;
  const top = A4_HEIGHT - 30;
  const bottom = 28;
  const colors = {
    paper: rgb(0.985, 0.965, 0.92),
    card: rgb(1, 0.992, 0.97),
    border: rgb(0.85, 0.77, 0.6),
    brown: rgb(0.18, 0.09, 0.06),
    brownSoft: rgb(0.36, 0.2, 0.11),
    label: rgb(0.54, 0.42, 0.2),
    text: rgb(0.18, 0.13, 0.09),
    footer: rgb(0.96, 0.92, 0.82),
  };

  const wrapText = (text: string, usedFont: any, size: number, maxWidth: number) => {
    const words = String(text || '-').split(/\s+/).filter(Boolean);
    if (!words.length) return ['-'];
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (usedFont.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  let y = top;
  const resetPageBackground = () => {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: A4_WIDTH,
      height: A4_HEIGHT,
      color: colors.paper,
    });
  };
  resetPageBackground();

  const ensureSpace = (needed: number) => {
    if (y - needed >= bottom) return;
    page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    resetPageBackground();
    y = top;
  };

  const drawTextLines = (
    x: number,
    yTop: number,
    lines: string[],
    size: number,
    usedFont: any,
    color = colors.text,
    lineGap = 12
  ) => {
    lines.forEach((line, index) => {
      page.drawText(line, {
        x,
        y: yTop - index * lineGap,
        size,
        font: usedFont,
        color,
      });
    });
  };

  const drawField = (x: number, yTop: number, width: number, label: string, value: string, minHeight = 56) => {
    const labelSize = 7.5;
    const valueSize = 11;
    const textWidth = width - 20;
    const valueLines = wrapText(value, font, valueSize, textWidth);
    const height = Math.max(minHeight, 18 + valueLines.length * 12 + 12);
    page.drawRectangle({
      x,
      y: yTop - height,
      width,
      height,
      color: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
    });
    page.drawText(label.toUpperCase(), {
      x: x + 10,
      y: yTop - 14,
      size: labelSize,
      font: bold,
      color: colors.label,
    });
    drawTextLines(x + 10, yTop - 28, valueLines, valueSize, font, colors.text, 12);
    return height;
  };

  const drawSectionTitle = (title: string) => {
    page.drawText(title.toUpperCase(), {
      x: left + 4,
      y,
      size: 9,
      font: bold,
      color: colors.label,
    });
    y -= 13;
  };

  const drawSingleField = (label: string, value: string, minHeight = 48) => {
    const height = drawField(left, y, right - left, label, value, minHeight);
    y -= height + 8;
  };

  const drawTwoFields = (leftField: [string, string], rightField: [string, string], minHeight = 48) => {
    const gap = 10;
    const width = (right - left - gap) / 2;
    const leftHeight = drawField(left, y, width, leftField[0], leftField[1], minHeight);
    const rightHeight = drawField(left + width + gap, y, width, rightField[0], rightField[1], minHeight);
    y -= Math.max(leftHeight, rightHeight) + 8;
  };

  const drawHeader = () => {
    page.drawRectangle({
      x: left,
      y: y - 58,
      width: right - left,
      height: 58,
      color: colors.brown,
    });
    page.drawText('VELVET DRIVERS LIMITED', {
      x: left + 18,
      y: y - 18,
      size: 8.5,
      font: bold,
      color: rgb(0.95, 0.86, 0.66),
    });
    page.drawText('Journey Statement', {
      x: left + 18,
      y: y - 38,
      size: 18,
      font: bold,
      color: rgb(1, 1, 1),
    });
    y -= 68;
  };

  drawHeader();
  ensureSpace(64);
  drawTwoFields(['Statement No', payload.bookingRef], ['Date Issued', formatDate(new Date())], 48);

  ensureSpace(128);
  drawSectionTitle('Booking Details');
  drawTwoFields(['Booking accepted by', payload.personAccepting], ['Date of booking', formatDate(payload.bookingDate)]);
  drawSingleField('Date of journey', formatDate(payload.journeyDate));

  ensureSpace(96);
  drawSectionTitle('Customer Details');
  drawTwoFields(['Customer name', payload.customerName], ['Phone number', payload.phoneNumber]);

  ensureSpace(180);
  drawSectionTitle('Journey Details');
  drawSingleField('Collection address', payload.collection, 58);
  drawSingleField('Destination', payload.destination, 58);
  drawTwoFields(['Fare quoted', `GBP ${payload.fareQuoted.toFixed(2)}`], ['Vehicle type', payload.vehicleType]);

  ensureSpace(180);
  drawSectionTitle('Driver & Vehicle Details');
  drawTwoFields(['Dispatching operator', payload.personDispatching], ['Driver full name', payload.driverName]);
  drawTwoFields(['PCO licence number', payload.driverLicenseNo], ['Vehicle registration', payload.vehicleReg]);
  drawTwoFields(['Subcontract operator number', payload.subletOperatorNo], ['Subcontract operator name', payload.subletOperatorName], 52);

  ensureSpace(32);
  page.drawRectangle({
    x: left,
    y: y - 22,
    width: right - left,
    height: 22,
    color: colors.footer,
    borderColor: colors.border,
    borderWidth: 1,
  });
  page.drawText('Velvet Drivers Limited | Private Hire Operator | This statement was generated for record purposes.', {
    x: left + 12,
    y: y - 14,
    size: 7.2,
    font,
    color: colors.brownSoft,
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
