import mysql from 'mysql2/promise';

type DbExecutor = mysql.Pool | mysql.PoolConnection;

type UpsertDriverCarDocumentInput = {
  carId: number;
  docType: string;
  expiryDate?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  publicId?: string | null;
  resourceType?: string | null;
  format?: string | null;
  bytes?: number | null;
  width?: number | null;
  height?: number | null;
};

export async function upsertDriverCarDocument(
  db: DbExecutor,
  input: UpsertDriverCarDocumentInput
) {
  const [existingRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT id
       FROM driver_car_documents
      WHERE car_id = ?
        AND doc_type = ?
      ORDER BY updated_at DESC, id DESC`,
    [input.carId, input.docType]
  );

  const existingId = Number(existingRows[0]?.id || 0);
  const normalizedExpiryDate = input.expiryDate || null;
  const normalizedFileName = input.fileName || null;
  const normalizedFileUrl = input.fileUrl || '';
  const normalizedPublicId = input.publicId || '';
  const normalizedResourceType = input.resourceType || 'image';
  const normalizedFormat = input.format || null;
  const normalizedBytes = input.bytes ?? null;
  const normalizedWidth = input.width ?? null;
  const normalizedHeight = input.height ?? null;

  if (existingId) {
    await db.execute<mysql.ResultSetHeader>(
      `UPDATE driver_car_documents
          SET expiry_date = ?,
              file_name = CASE WHEN ? <> '' THEN ? ELSE file_name END,
              file_url = CASE WHEN ? <> '' THEN ? ELSE file_url END,
              public_id = CASE WHEN ? <> '' THEN ? ELSE public_id END,
              resource_type = CASE WHEN ? <> '' THEN ? ELSE resource_type END,
              format = CASE WHEN ? IS NOT NULL THEN ? ELSE format END,
              bytes = CASE WHEN ? IS NOT NULL THEN ? ELSE bytes END,
              width = CASE WHEN ? IS NOT NULL THEN ? ELSE width END,
              height = CASE WHEN ? IS NOT NULL THEN ? ELSE height END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        normalizedExpiryDate,
        normalizedFileName || '',
        normalizedFileName,
        normalizedFileUrl,
        normalizedFileUrl,
        normalizedPublicId,
        normalizedPublicId,
        normalizedResourceType,
        normalizedResourceType,
        normalizedFormat,
        normalizedFormat,
        normalizedBytes,
        normalizedBytes,
        normalizedWidth,
        normalizedWidth,
        normalizedHeight,
        normalizedHeight,
        existingId,
      ]
    );

    if (existingRows.length > 1) {
      const duplicateIds = existingRows
        .slice(1)
        .map((row) => Number(row.id))
        .filter(Boolean);
      if (duplicateIds.length) {
        await db.execute<mysql.ResultSetHeader>(
          `DELETE FROM driver_car_documents
            WHERE id IN (${duplicateIds.map(() => '?').join(',')})`,
          duplicateIds
        );
      }
    }

    return { id: existingId, expiryDate: normalizedExpiryDate };
  }

  const [result] = await db.execute<mysql.ResultSetHeader>(
    `INSERT INTO driver_car_documents
     (car_id, doc_type, expiry_date, file_name, file_url, public_id, resource_type, format, bytes, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.carId,
      input.docType,
      normalizedExpiryDate,
      normalizedFileName,
      normalizedFileUrl,
      normalizedPublicId,
      normalizedResourceType,
      normalizedFormat,
      normalizedBytes,
      normalizedWidth,
      normalizedHeight,
    ]
  );

  return { id: Number(result.insertId), expiryDate: normalizedExpiryDate };
}
