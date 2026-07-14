import mysql from 'mysql2/promise';

let visibleColumnEnsured = false;

export async function ensureReviewsVisibleColumn(pool: mysql.Pool) {
  if (visibleColumnEnsured) return;
  try {
    await pool.query(`ALTER TABLE client_reviews ADD COLUMN visible TINYINT(1) NOT NULL DEFAULT 1 AFTER source`);
    await pool.query(`UPDATE client_reviews SET visible = 0 WHERE rating < 4`);
  } catch (err: any) {
    if (err?.code !== 'ER_DUP_FIELDNAME') throw err;
  }
  visibleColumnEnsured = true;
}
