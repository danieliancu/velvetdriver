import mysql from 'mysql2/promise';

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'velvet',
  DB_CHARSET = 'utf8mb4',
  DB_SSL = 'false',
} = process.env;

const globalForMysql = globalThis as unknown as {
  mysqlPool?: mysql.Pool;
};

export function getDbPool() {
  if (!globalForMysql.mysqlPool) {
    globalForMysql.mysqlPool = mysql.createPool({
      host: DB_HOST,
      port: Number(DB_PORT) || 3306,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      charset: DB_CHARSET,
      waitForConnections: true,
      connectionLimit: 10,
      ssl: DB_SSL.toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalForMysql.mysqlPool;
}
