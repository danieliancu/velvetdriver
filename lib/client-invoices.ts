import mysql from 'mysql2/promise';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { uploadRawToCloudinary } from '@/lib/cloudinary';

export type PaidInvoicePayload = {
  journeyId: number;
  clientId: number | null;
  journeyDateIso: string;
  passengerName: string;
  passengerEmail: string;
  passengerPhone: string;
  pickup: string;
  destination: string;
  totalFare: number;
  amountPaid?: number;
  creditApplied?: number;
  paymentMethod?: string;
  paymentIntentId?: string;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const escapeText = (value: string) => value.replace(/[\r\n\t]+/g, ' ').trim() || '-';

async function buildInvoicePdfBytes(payload: PaidInvoicePayload) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const left = 52;
  const right = A4_WIDTH - 52;
  let y = A4_HEIGHT - 56;

  const bookingRef = `VD-${String(payload.journeyId).padStart(4, '0')}`;
  const invoiceRef = `${bookingRef}-INV`;

  page.drawText('Velvet Drivers - Invoice', {
    x: left,
    y,
    size: 18,
    font: bold,
    color: rgb(0.2, 0.12, 0.12),
  });
  y -= 24;

  page.drawText(`Invoice Ref: ${invoiceRef}`, { x: left, y, size: 11, font: bold });
  page.drawText(`Booking Ref: ${bookingRef}`, { x: left + 220, y, size: 11, font: bold });
  y -= 24;

  const lines: Array<[string, string]> = [
    ['Issued to', escapeText(payload.passengerName)],
    ['Email', escapeText(payload.passengerEmail)],
    ['Phone', escapeText(payload.passengerPhone)],
    ['Journey date', formatDate(payload.journeyDateIso)],
    ['Pickup', escapeText(payload.pickup)],
    ['Destination', escapeText(payload.destination)],
    ['Journey fare', `GBP ${payload.totalFare.toFixed(2)}`],
    ...(payload.creditApplied ? [['Credit applied', `GBP ${payload.creditApplied.toFixed(2)}`] as [string, string]] : []),
    ['Payment method', escapeText(payload.paymentMethod || 'Card')],
    ['Payment ref', escapeText(payload.paymentIntentId || '-')],
    ['Amount paid now', `GBP ${(payload.amountPaid ?? payload.totalFare).toFixed(2)}`],
  ];

  const labelWidth = 150;
  const maxTextWidth = right - (left + labelWidth);
  const wrap = (value: string) => {
    const words = value.split(/\s+/).filter(Boolean);
    if (!words.length) return ['-'];
    const result: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, 11) <= maxTextWidth) {
        current = next;
      } else {
        if (current) result.push(current);
        current = word;
      }
    }
    if (current) result.push(current);
    return result;
  };

  for (const [label, value] of lines) {
    page.drawText(`${label}:`, { x: left, y, size: 11, font: bold });
    const wrapped = wrap(value);
    wrapped.forEach((line, idx) => {
      page.drawText(line, { x: left + labelWidth, y: y - idx * 14, size: 11, font });
    });
    y -= Math.max(20, wrapped.length * 14 + 5);
  }

  page.drawText('Velvet Drivers Limited - Payment confirmation invoice', {
    x: left,
    y: 40,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  return new Uint8Array(await pdf.save());
}

export async function ensureClientInvoicesTable(pool: mysql.Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_invoices (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      client_id BIGINT UNSIGNED NULL,
      journey_id BIGINT UNSIGNED NOT NULL,
      invoice_ref VARCHAR(64) NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      currency CHAR(3) NOT NULL DEFAULT 'GBP',
      status ENUM('issued','paid','void') NOT NULL DEFAULT 'paid',
      issued_at DATETIME NOT NULL,
      paid_at DATETIME NULL,
      pdf_url TEXT NULL,
      pdf_public_id VARCHAR(255) NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_client_invoice_journey (journey_id),
      UNIQUE KEY uq_client_invoice_ref (invoice_ref),
      KEY idx_client_invoice_client (client_id),
      KEY idx_client_invoice_paid (paid_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

export async function createOrUpdatePaidInvoice(pool: mysql.Pool, payload: PaidInvoicePayload) {
  await ensureClientInvoicesTable(pool);

  const bookingRef = `VD-${String(payload.journeyId).padStart(4, '0')}`;
  const invoiceRef = `${bookingRef}-INV`;
  const fileName = `${bookingRef}-invoice.pdf`;

  const pdfBytes = await buildInvoicePdfBytes(payload);

  const upload = await uploadRawToCloudinary({
    bytes: pdfBytes,
    fileName,
    folder: payload.clientId ? `invoices/client-${payload.clientId}` : 'invoices/guest',
    publicId: `${bookingRef}-invoice`,
    contentType: 'application/pdf',
  });

  await pool.execute(
    `INSERT INTO client_invoices (
      client_id,
      journey_id,
      invoice_ref,
      amount,
      currency,
      status,
      issued_at,
      paid_at,
      pdf_url,
      pdf_public_id
    ) VALUES (?, ?, ?, ?, 'GBP', 'paid', NOW(), NOW(), ?, ?)
    ON DUPLICATE KEY UPDATE
      client_id = VALUES(client_id),
      invoice_ref = VALUES(invoice_ref),
      amount = VALUES(amount),
      status = VALUES(status),
      issued_at = VALUES(issued_at),
      paid_at = VALUES(paid_at),
      pdf_url = VALUES(pdf_url),
      pdf_public_id = VALUES(pdf_public_id)`,
    [
      payload.clientId,
      payload.journeyId,
      invoiceRef,
      payload.totalFare,
      upload.secureUrl,
      upload.publicId,
    ]
  );

  await pool.execute(
    `UPDATE client_journeys
       SET invoice_url = ?
     WHERE id = ?
     LIMIT 1`,
    [upload.secureUrl, payload.journeyId]
  );

  return {
    invoiceRef,
    invoiceUrl: upload.secureUrl,
    fileName,
    pdfBytes,
  };
}
