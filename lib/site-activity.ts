import mysql from 'mysql2/promise';

type DbExecutor = mysql.Pool | mysql.PoolConnection;

type AuditOperation = 'INSERT' | 'UPDATE' | 'DELETE';
type AuditSeverity = 'critical' | 'warning' | 'info' | 'success';

type LogSiteActivityInput = {
  tableName: string;
  operation: AuditOperation;
  pk?: string | number | null;
  title: string;
  message: string;
  category?: string;
  severity?: AuditSeverity;
  tags?: Record<string, unknown>;
  changedBy?: number | null;
  changedByEmail?: string | null;
  ip?: string | null;
  old?: Record<string, unknown> | null;
  next?: Record<string, unknown> | null;
};

export async function ensureAuditEventsTable(db: DbExecutor) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id BIGINT NOT NULL AUTO_INCREMENT,
      table_name VARCHAR(64) NOT NULL,
      operation ENUM('INSERT','UPDATE','DELETE') NOT NULL,
      pk VARCHAR(128) DEFAULT NULL,
      changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      changed_by BIGINT DEFAULT NULL,
      changed_by_email VARCHAR(255) DEFAULT NULL,
      ip VARCHAR(128) DEFAULT NULL,
      payload LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      PRIMARY KEY (id),
      KEY idx_audit_events_changed_at (changed_at),
      KEY idx_audit_events_table (table_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

export function getRequestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null;
  }
  return request.headers.get('x-real-ip') || null;
}

export async function logSiteActivity(db: DbExecutor, input: LogSiteActivityInput) {
  await ensureAuditEventsTable(db);
  const payload = {
    category: input.category || input.tableName,
    title: input.title,
    message: input.message,
    severity: input.severity || 'info',
    tags: input.tags || null,
    old: input.old || null,
    new: input.next || null,
  };

  await db.execute<mysql.ResultSetHeader>(
    `INSERT INTO audit_events
     (table_name, operation, pk, changed_by, changed_by_email, ip, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.tableName,
      input.operation,
      input.pk !== undefined && input.pk !== null ? String(input.pk) : null,
      input.changedBy ?? null,
      input.changedByEmail ?? null,
      input.ip ?? null,
      JSON.stringify(payload),
    ]
  );
}
