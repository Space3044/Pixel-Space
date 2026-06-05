import type { ImageRecord, ImageRow } from './images';
import { IMAGE_SELECT_COLUMNS, rowToRecord, scrubRecordForVisitor } from './images';

export const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const ACCESS_CODE_LENGTH = 8;
const ACCESS_CODE_PATTERN = new RegExp(`^[${ACCESS_CODE_ALPHABET}]{${ACCESS_CODE_LENGTH}}$`);

export interface ActiveDownloadGrant {
  id: string;
  expires_at: string;
}

export const normalizeAccessCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return ACCESS_CODE_PATTERN.test(code) ? code : null;
};

const bytesToHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');

export const codeHash = async (value: string): Promise<string> => {
  const code = normalizeAccessCode(value);
  if (!code) throw new Error('invalid_access_code');
  const data = new TextEncoder().encode(code);
  return bytesToHex(await crypto.subtle.digest('SHA-256', data));
};

export const generateAccessCode = (): string => {
  const bytes = new Uint8Array(ACCESS_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ACCESS_CODE_ALPHABET[byte % ACCESS_CODE_ALPHABET.length]).join('');
};

export const normalizeFutureIso = (value: string): string | null => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() <= Date.now()) return null;
  return date.toISOString();
};

export const resolveActiveGrant = async (
  db: D1Database,
  rawCode: unknown,
): Promise<ActiveDownloadGrant | null> => {
  const code = normalizeAccessCode(rawCode);
  if (!code) return null;
  const hash = await codeHash(code);
  const now = new Date().toISOString();
  return db
    .prepare('SELECT id, expires_at FROM download_grants WHERE code_hash = ? AND expires_at > ?')
    .bind(hash, now)
    .first<ActiveDownloadGrant>();
};

export const loadGrantImages = async (
  db: D1Database,
  grantId: string,
  publicBaseUrl: string,
): Promise<ImageRecord[]> => {
  const result = await db
    .prepare(
      `SELECT ${IMAGE_SELECT_COLUMNS}
       FROM images
       INNER JOIN download_grant_images ON download_grant_images.image_key = images.key
       WHERE download_grant_images.grant_id = ?
       ORDER BY images.created_at DESC`,
    )
    .bind(grantId)
    .all<ImageRow>();

  return (result.results ?? [])
    .map((row) => rowToRecord(row, publicBaseUrl))
    .map((record) => scrubRecordForVisitor(record));
};

export const imageBelongsToGrant = async (
  db: D1Database,
  grantId: string,
  key: string,
): Promise<boolean> => {
  const row = await db
    .prepare('SELECT image_key FROM download_grant_images WHERE grant_id = ? AND image_key = ?')
    .bind(grantId, key)
    .first<{ image_key: string }>();
  return row !== null;
};
