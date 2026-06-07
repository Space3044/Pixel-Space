import type { Env } from '../../types';
import { json, notFound, serverError } from '../../_shared/http';
import { withRequestLogging } from '../../_shared/logger';
import { parseJsonObject } from '../../_shared/request';
import { loadGrantImages, resolveActiveGrant } from '../../_shared/download-grants';
import { requireSameOrigin } from '../../_shared/security';

export const onRequestPost: PagesFunction<Env> = withRequestLogging('/api/download-grants/verify', async ({ request, env }, logger) => {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

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
    logger.error('POST /api/download-grants/verify failed', {
      error,
      context: { grantId: grant.id },
    });
    return serverError('download_grant_verify_failed');
  }
});
