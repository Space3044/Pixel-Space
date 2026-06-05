import type { Env } from '../../types';
import { resolveAdmin } from '../../_shared/auth';
import { badRequest, json, serverError, unauthorized } from '../../_shared/http';
import { normalizeStringList, parseJsonObject, stringOrNull } from '../../_shared/request';
import { codeHash, generateAccessCode, normalizeFutureIso } from '../../_shared/download-grants';
import type { ImageRecord, ImageRow } from '../../_shared/images';
import { IMAGE_SELECT_COLUMNS, rowToRecord } from '../../_shared/images';

interface CreatePayload {
  keys: string[];
  expires_at: string;
}

interface DownloadGrantRow {
  id: string;
  code: string | null;
  expires_at: string;
  created_at: string;
}

interface DownloadGrantImageRow extends ImageRow {
  grant_id: string;
}

interface DownloadGrantRecord extends DownloadGrantRow {
  image_count: number;
  images: ImageRecord[];
}

const MAX_IMAGES = 200;
const MAX_CODE_ATTEMPTS = 5;

const parsePayload = async (request: Request): Promise<CreatePayload | null> => {
  const raw = await parseJsonObject(request);
  if (!raw) return null;

  const keys = normalizeStringList(raw.keys, { min: 1, max: MAX_IMAGES });
  const expiresAt = stringOrNull(raw.expires_at);
  if (!keys || !expiresAt) return null;

  return { keys: [...new Set(keys)], expires_at: expiresAt };
};

const selectExistingKeys = async (db: D1Database, keys: string[]): Promise<Set<string>> => {
  const placeholders = keys.map(() => '?').join(',');
  const result = await db
    .prepare(`SELECT key FROM images WHERE key IN (${placeholders})`)
    .bind(...keys)
    .all<{ key: string }>();
  return new Set((result.results ?? []).map((row) => row.key));
};

const createUniqueCode = async (db: D1Database): Promise<{ code: string; hash: string }> => {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateAccessCode();
    const hash = await codeHash(code);
    const existing = await db
      .prepare('SELECT id FROM download_grants WHERE code_hash = ?')
      .bind(hash)
      .first<{ id: string }>();
    if (!existing) return { code, hash };
  }
  throw new Error('download_grant_code_collision');
};

const isMissingCodeColumnError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /no such column:\s*code|no column named code/i.test(message);
};

const insertDownloadGrant = async (db: D1Database, id: string, hash: string, code: string, expiresAt: string) => {
  try {
    await db
      .prepare('INSERT INTO download_grants (id, code_hash, code, expires_at) VALUES (?, ?, ?, ?)')
      .bind(id, hash, code, expiresAt)
      .run();
  } catch (error) {
    if (!isMissingCodeColumnError(error)) throw error;
    await db
      .prepare('INSERT INTO download_grants (id, code_hash, expires_at) VALUES (?, ?, ?)')
      .bind(id, hash, expiresAt)
      .run();
  }
};

const loadGrantRows = async (db: D1Database): Promise<DownloadGrantRow[]> => {
  try {
    const result = await db
      .prepare('SELECT id, code, expires_at, created_at FROM download_grants ORDER BY created_at DESC')
      .bind()
      .all<DownloadGrantRow>();
    return result.results ?? [];
  } catch (error) {
    if (!isMissingCodeColumnError(error)) throw error;
    const result = await db
      .prepare('SELECT id, NULL AS code, expires_at, created_at FROM download_grants ORDER BY created_at DESC')
      .bind()
      .all<DownloadGrantRow>();
    return result.results ?? [];
  }
};

const loadGrantRecords = async (env: Env): Promise<DownloadGrantRecord[]> => {
  const grants = await loadGrantRows(env.DB);
  if (grants.length === 0) return [];

  const placeholders = grants.map(() => '?').join(',');
  const imageResult = await env.DB
    .prepare(
      `SELECT download_grant_images.grant_id, ${IMAGE_SELECT_COLUMNS}
       FROM download_grant_images
       INNER JOIN images ON images.key = download_grant_images.image_key
       WHERE download_grant_images.grant_id IN (${placeholders})
       ORDER BY images.created_at DESC`,
    )
    .bind(...grants.map((grant) => grant.id))
    .all<DownloadGrantImageRow>();

  const imagesByGrant = new Map<string, ImageRecord[]>();
  for (const row of imageResult.results ?? []) {
    const list = imagesByGrant.get(row.grant_id) ?? [];
    list.push(rowToRecord(row, env.PUBLIC_BASE_URL));
    imagesByGrant.set(row.grant_id, list);
  }

  return grants.map((grant) => {
    const images = imagesByGrant.get(grant.id) ?? [];
    return {
      ...grant,
      image_count: images.length,
      images,
    };
  });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  try {
    return json({ grants: await loadGrantRecords(env) });
  } catch (error) {
    console.error('GET /api/admin/download-grants failed', error);
    return serverError('download_grant_list_failed');
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  const payload = await parsePayload(request);
  if (!payload) return badRequest('invalid_download_grant_payload');

  const expiresAt = normalizeFutureIso(payload.expires_at);
  if (!expiresAt) return badRequest('invalid_expiration');

  try {
    const existingKeys = await selectExistingKeys(env.DB, payload.keys);
    if (existingKeys.size !== payload.keys.length) return badRequest('image_not_found');

    const grantId = crypto.randomUUID();
    const { code, hash } = await createUniqueCode(env.DB);

    await insertDownloadGrant(env.DB, grantId, hash, code, expiresAt);

    await env.DB.batch(
      payload.keys.map((key) =>
        env.DB
          .prepare('INSERT INTO download_grant_images (grant_id, image_key) VALUES (?, ?)')
          .bind(grantId, key),
      ),
    );

    return json({
      code,
      expires_at: expiresAt,
      image_count: payload.keys.length,
      access_url: '/access',
    });
  } catch (error) {
    console.error('POST /api/admin/download-grants failed', error);
    return serverError('download_grant_create_failed');
  }
};
