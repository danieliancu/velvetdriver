import mysql from 'mysql2/promise';

const EXPIRY_NOTIFICATION_RECIPIENTS = ['roxy.viulet@gmail.com', 'dani.iancu@yahoo.com'];

type ExpiringDocument = {
  driverId: number;
  driverName: string;
  driverEmail: string;
  driverPhone: string;
  documentKey: string;
  documentType: string;
  label: string;
  expiryDate: string;
  daysUntilExpiry: number;
  carLabel?: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const DOCUMENT_LABELS: Record<string, string> = {
  pco_licence: 'PCO licence',
  mot: 'MOT',
  insurance: 'Insurance',
  phv_car_licence: 'PHV car licence',
};

export async function ensureDocumentExpiryNotificationsTable(pool: mysql.Pool | mysql.PoolConnection) {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS document_expiry_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      document_key VARCHAR(255) NOT NULL,
      document_type VARCHAR(64) NOT NULL,
      expiry_date DATE NOT NULL,
      recipient_email VARCHAR(255) NOT NULL,
      sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_document_expiry_notification (document_key, expiry_date, recipient_email),
      KEY idx_document_expiry_notification_sent (sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

async function sendExpiryNotificationEmail(documents: ExpiringDocument[]) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!resendApiKey || !emailFrom || documents.length === 0) {
    return { attempted: false };
  }

  const subject =
    documents.length === 1
      ? `Velvet Drivers - document expiring soon (${documents[0].label})`
      : `Velvet Drivers - ${documents.length} documents expiring soon`;

  const html = `
    <h2>${escapeHtml(subject)}</h2>
    <p>The following driver documents are due to expire within 30 days.</p>
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;">
      <thead>
        <tr>
          <th style="text-align:left;border-bottom:1px solid #ddd;padding:8px;">Driver</th>
          <th style="text-align:left;border-bottom:1px solid #ddd;padding:8px;">Document</th>
          <th style="text-align:left;border-bottom:1px solid #ddd;padding:8px;">Expiry</th>
          <th style="text-align:left;border-bottom:1px solid #ddd;padding:8px;">Days left</th>
          <th style="text-align:left;border-bottom:1px solid #ddd;padding:8px;">Details</th>
        </tr>
      </thead>
      <tbody>
        ${documents
          .map(
            (doc) => `
              <tr>
                <td style="border-bottom:1px solid #eee;padding:8px;">
                  ${escapeHtml(doc.driverName)}<br />
                  <span style="color:#666;">${escapeHtml(doc.driverEmail || '-')} | ${escapeHtml(doc.driverPhone || '-')}</span>
                </td>
                <td style="border-bottom:1px solid #eee;padding:8px;">${escapeHtml(doc.label)}</td>
                <td style="border-bottom:1px solid #eee;padding:8px;">${escapeHtml(formatDate(doc.expiryDate))}</td>
                <td style="border-bottom:1px solid #eee;padding:8px;">${doc.daysUntilExpiry}</td>
                <td style="border-bottom:1px solid #eee;padding:8px;">${escapeHtml(doc.carLabel || '-')}</td>
              </tr>
            `
          )
          .join('')}
      </tbody>
    </table>
  `;

  const text = [
    subject,
    '',
    'The following driver documents are due to expire within 30 days:',
    '',
    ...documents.map((doc) =>
      [
        `Driver: ${doc.driverName}`,
        `Document: ${doc.label}`,
        `Expiry: ${formatDate(doc.expiryDate)}`,
        `Days left: ${doc.daysUntilExpiry}`,
        `Details: ${doc.carLabel || '-'}`,
        `Contact: ${doc.driverEmail || '-'} | ${doc.driverPhone || '-'}`,
      ].join('\n')
    ),
  ].join('\n\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: EXPIRY_NOTIFICATION_RECIPIENTS,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to send expiry notification email: ${response.status} ${body}`);
  }

  return { attempted: true };
}

export async function getPendingExpiringDocuments(pool: mysql.Pool | mysql.PoolConnection) {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(`
    SELECT *
      FROM (
        SELECT d.id AS driver_id,
               TRIM(CONCAT_WS(' ', d.first_and_middle_name, d.surname)) AS driver_name,
               u.email AS driver_email,
               COALESCE(NULLIF(TRIM(d.phone), ''), NULLIF(TRIM(u.phone), ''), '-') AS driver_phone,
               CONCAT('driver:', d.id, ':pco') AS document_key,
               'pco_licence' AS document_type,
               d.pco_expires_date AS expiry_date,
               NULL AS car_label,
               DATEDIFF(d.pco_expires_date, CURDATE()) AS days_until_expiry
          FROM drivers d
          INNER JOIN users u ON u.id = d.user_id
         WHERE d.pco_expires_date IS NOT NULL

        UNION ALL

        SELECT d.id AS driver_id,
               TRIM(CONCAT_WS(' ', d.first_and_middle_name, d.surname)) AS driver_name,
               u.email AS driver_email,
               COALESCE(NULLIF(TRIM(d.phone), ''), NULLIF(TRIM(u.phone), ''), '-') AS driver_phone,
               CONCAT('car:', dc.id, ':', latest.doc_type) AS document_key,
               latest.doc_type AS document_type,
               latest.expiry_date AS expiry_date,
               TRIM(CONCAT_WS(' ', NULLIF(TRIM(c.make), ''), NULLIF(TRIM(c.model), ''), CONCAT('·', NULLIF(TRIM(c.vehicle_registration), '')))) AS car_label,
               DATEDIFF(latest.expiry_date, CURDATE()) AS days_until_expiry
          FROM (
                SELECT dcd.id,
                       dcd.car_id,
                       dcd.doc_type,
                       dcd.expiry_date
                  FROM driver_car_documents dcd
                  INNER JOIN (
                    SELECT car_id, doc_type, MAX(id) AS max_id
                      FROM driver_car_documents
                     WHERE deleted_at IS NULL
                     GROUP BY car_id, doc_type
                  ) latest_row
                    ON latest_row.max_id = dcd.id
               ) latest
          INNER JOIN driver_cars dc ON dc.id = latest.car_id
          INNER JOIN drivers d ON d.id = dc.driver_id
          INNER JOIN users u ON u.id = d.user_id
          INNER JOIN cars c ON c.id = dc.car_id
         WHERE latest.expiry_date IS NOT NULL
      ) expiring_docs
     WHERE expiring_docs.days_until_expiry BETWEEN 0 AND 30
     ORDER BY expiring_docs.days_until_expiry ASC, expiring_docs.driver_name ASC
  `);

  return rows.map((row) => ({
    driverId: Number(row.driver_id),
    driverName: String(row.driver_name || `Driver ${row.driver_id}`),
    driverEmail: String(row.driver_email || ''),
    driverPhone: String(row.driver_phone || '-'),
    documentKey: String(row.document_key),
    documentType: String(row.document_type),
    label: DOCUMENT_LABELS[String(row.document_type)] || String(row.document_type),
    expiryDate: String(row.expiry_date),
    daysUntilExpiry: Number(row.days_until_expiry),
    carLabel: row.car_label ? String(row.car_label) : undefined,
  })) as ExpiringDocument[];
}

export async function sendPendingDocumentExpiryNotifications(pool: mysql.Pool | mysql.PoolConnection) {
  await ensureDocumentExpiryNotificationsTable(pool);

  const allPending = await getPendingExpiringDocuments(pool);
  if (!allPending.length) {
    return { sent: 0, documents: 0 };
  }

  const placeholders = EXPIRY_NOTIFICATION_RECIPIENTS.map(() => '?').join(',');
  const [sentRows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT document_key, expiry_date, recipient_email
       FROM document_expiry_notifications
      WHERE recipient_email IN (${placeholders})`,
    EXPIRY_NOTIFICATION_RECIPIENTS
  );

  const sentSet = new Set(
    sentRows.map(
      (row) =>
        `${String(row.document_key)}|${String(row.expiry_date).slice(0, 10)}|${String(row.recipient_email).toLowerCase()}`
    )
  );

  const unsentDocuments = allPending.filter((doc) =>
    EXPIRY_NOTIFICATION_RECIPIENTS.some(
      (recipient) =>
        !sentSet.has(`${doc.documentKey}|${doc.expiryDate.slice(0, 10)}|${recipient.toLowerCase()}`)
    )
  );

  if (!unsentDocuments.length) {
    return { sent: 0, documents: 0 };
  }

  const emailResult = await sendExpiryNotificationEmail(unsentDocuments);
  if (!emailResult.attempted) {
    return { sent: 0, documents: 0, skipped: 'Email service not configured' };
  }

  for (const doc of unsentDocuments) {
    for (const recipient of EXPIRY_NOTIFICATION_RECIPIENTS) {
      await pool.execute<mysql.ResultSetHeader>(
        `INSERT IGNORE INTO document_expiry_notifications
         (document_key, document_type, expiry_date, recipient_email)
         VALUES (?, ?, ?, ?)`,
        [doc.documentKey, doc.documentType, doc.expiryDate, recipient]
      );
    }
  }

  const title =
    unsentDocuments.length === 1
      ? `${unsentDocuments[0].label} expiry reminder sent`
      : `${unsentDocuments.length} document expiry reminders sent`;
  const message = unsentDocuments
    .map(
      (doc) =>
        `${doc.driverName} - ${doc.label} - ${formatDate(doc.expiryDate)}${doc.carLabel ? ` - ${doc.carLabel}` : ''}`
    )
    .join('\n');

  await pool
    .execute<mysql.ResultSetHeader>(
      `INSERT INTO admin_notifications
       (category, title, message, severity, related_table, related_id, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'document_expiry',
        title,
        message,
        'warning',
        'drivers',
        unsentDocuments[0]?.driverId || null,
        JSON.stringify(['documents', 'expiry', 'email']),
      ]
    )
    .catch((err) => {
      console.error('Failed to insert admin notification for document expiry', err);
    });

  return { sent: EXPIRY_NOTIFICATION_RECIPIENTS.length, documents: unsentDocuments.length };
}
