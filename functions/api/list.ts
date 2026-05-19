import type { Env } from '../types';
import { json, serverError } from '../_shared/http';
import type { ImageRow } from '../_shared/images';
import { rowToRecord } from '../_shared/images';

const LIST_SQL =
  'SELECT key, title, caption, r2_key, width, height, format, location_name FROM images ORDER BY created_at DESC';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const result = await env.DB.prepare(LIST_SQL).all<ImageRow>();
    const records = (result.results ?? []).map((row) => rowToRecord(row, env.PUBLIC_BASE_URL));
    return json(records);
  } catch (error) {
    console.error('GET /api/list failed', error);
    return serverError('list_failed');
  }
};
