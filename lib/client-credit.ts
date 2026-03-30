import mysql from 'mysql2/promise';

export async function ensureClientCreditLedgerTable(pool: mysql.Pool | mysql.PoolConnection) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_credit_ledger (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      client_id BIGINT UNSIGNED NOT NULL,
      journey_id BIGINT UNSIGNED NULL,
      entry_type ENUM('credit','debit') NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      currency CHAR(3) NOT NULL DEFAULT 'GBP',
      reason VARCHAR(255) NULL,
      metadata_json JSON NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_client_credit_client (client_id),
      KEY idx_client_credit_journey (journey_id),
      KEY idx_client_credit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

export async function getClientCreditBalance(pool: mysql.Pool | mysql.PoolConnection, clientId: number) {
  await ensureClientCreditLedgerTable(pool);
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COALESCE(SUM(
        CASE
          WHEN entry_type = 'credit' THEN amount
          WHEN entry_type = 'debit' THEN -amount
          ELSE 0
        END
      ), 0) AS balance
       FROM client_credit_ledger
      WHERE client_id = ?`,
    [clientId]
  );
  return Math.max(0, Number(rows[0]?.balance ?? 0));
}

async function insertLedgerEntry(
  pool: mysql.Pool | mysql.PoolConnection,
  input: {
    clientId: number;
    journeyId?: number | null;
    type: 'credit' | 'debit';
    amount: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await ensureClientCreditLedgerTable(pool);
  const normalizedAmount = Math.round(Math.max(0, input.amount) * 100) / 100;
  if (normalizedAmount <= 0) return;

  await pool.execute(
    `INSERT INTO client_credit_ledger (client_id, journey_id, entry_type, amount, currency, reason, metadata_json)
     VALUES (?, ?, ?, ?, 'GBP', ?, ?)`,
    [
      input.clientId,
      input.journeyId ?? null,
      input.type,
      normalizedAmount,
      input.reason || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
}

export async function addClientCredit(
  pool: mysql.Pool | mysql.PoolConnection,
  input: {
    clientId: number;
    journeyId?: number | null;
    amount: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await insertLedgerEntry(pool, { ...input, type: 'credit' });
}

export async function consumeClientCredit(
  pool: mysql.Pool | mysql.PoolConnection,
  input: {
    clientId: number;
    journeyId?: number | null;
    amount: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await insertLedgerEntry(pool, { ...input, type: 'debit' });
}
