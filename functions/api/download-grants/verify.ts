import type { Env } from '../../types';
import { json, notFound, serverError } from '../../_shared/http';
import { withRequestLogging } from '../../_shared/logger';
import { parseJsonObject } from '../../_shared/request';
import { loadGrantImages, resolveActiveGrant } from '../../_shared/download-grants';
import { requireSameOrigin } from '../../_shared/security';
import {
  attachVisitorChallengeCookie,
  blockedVisitorCodeRetryAfter,
  clearFailedVisitorCodes,
  recordFailedVisitorCode,
  requireVisitorChallenge,
  tooManyVisitorAttempts,
  visitorIp,
} from '../../_shared/turnstile';

export const onRequestPost: PagesFunction<Env> = withRequestLogging('/api/download-grants/verify', async ({ request, env }, logger) => {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const raw = await parseJsonObject(request);
  const challengeResult = await requireVisitorChallenge(request, env, raw?.turnstileToken, logger);
  if (!challengeResult.ok) return challengeResult.response;

  const blockedRetryAfter = blockedVisitorCodeRetryAfter(request, challengeResult.challenge);
  if (blockedRetryAfter !== null) {
    logger.warn('POST /api/download-grants/verify rate limited', {
      status: 429,
      context: { ip: visitorIp(request) },
    });
    return attachVisitorChallengeCookie(tooManyVisitorAttempts(blockedRetryAfter), challengeResult.challenge);
  }

  const grant = await resolveActiveGrant(env.DB, raw?.code);
  if (!grant) {
    const retryAfter = recordFailedVisitorCode(request, challengeResult.challenge);
    if (retryAfter !== null) {
      logger.warn('POST /api/download-grants/verify rate limited', {
        status: 429,
        context: { ip: visitorIp(request) },
      });
      return attachVisitorChallengeCookie(tooManyVisitorAttempts(retryAfter), challengeResult.challenge);
    }
    return attachVisitorChallengeCookie(notFound('download_grant_not_found'), challengeResult.challenge);
  }

  try {
    const images = await loadGrantImages(env.DB, grant.id, env.PUBLIC_BASE_URL);
    clearFailedVisitorCodes(request, challengeResult.challenge);
    return attachVisitorChallengeCookie(json({
      expires_at: grant.expires_at,
      images,
    }), challengeResult.challenge);
  } catch (error) {
    logger.error('POST /api/download-grants/verify failed', {
      error,
      context: { grantId: grant.id },
    });
    return serverError('download_grant_verify_failed');
  }
});
