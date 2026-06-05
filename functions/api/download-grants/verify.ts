import type { Env } from '../../types';
import { json, notFound, serverError } from '../../_shared/http';
import { parseJsonObject } from '../../_shared/request';
import { loadGrantImages, resolveActiveGrant } from '../../_shared/download-grants';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const raw = await parseJsonObject(request);
  const grant = await resolveActiveGrant(env.DB, raw?.code);
  if (!grant) return notFound('download_grant_not_found');

  try {
    const images = await loadGrantImages(env.DB, grant.id, env.PUBLIC_BASE_URL);
    return json({
      expires_at: grant.expires_at,
      images,
    });
  } catch (error) {
    console.error('POST /api/download-grants/verify failed', error);
    return serverError('download_grant_verify_failed');
  }
};
