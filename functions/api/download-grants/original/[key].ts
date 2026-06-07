import type { Env } from '../../../types';
import { notFound, serverError } from '../../../_shared/http';
import { withRequestLogging } from '../../../_shared/logger';
import { parseJsonObject } from '../../../_shared/request';
import { imageBelongsToGrant, resolveActiveGrant } from '../../../_shared/download-grants';
import { streamTelegramOriginal, type OriginalImageRow } from '../../../_shared/original';
import { keyFromRouteParam } from '../../../_shared/keys';
import { requireSameOrigin } from '../../../_shared/security';
import {
  attachVisitorChallengeCookie,
  blockedVisitorCodeRetryAfter,
  clearFailedVisitorCodes,
  recordFailedVisitorCode,
  requireVisitorChallenge,
  tooManyVisitorAttempts,
  visitorIp,
} from '../../../_shared/turnstile';

const ORIGINAL_SQL = 'SELECT key, original_filename, tg_file_id FROM images WHERE key = ?';

export const onRequestPost: PagesFunction<Env> = withRequestLogging('/api/download-grants/original/:key', async ({ request, env, params }, logger) => {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const key = keyFromRouteParam(params.key);
  if (!key) return notFound();

  const raw = await parseJsonObject(request);
  const challengeResult = await requireVisitorChallenge(request, env, raw?.turnstileToken, logger);
  if (!challengeResult.ok) return challengeResult.response;

  const blockedRetryAfter = blockedVisitorCodeRetryAfter(request, challengeResult.challenge);
  if (blockedRetryAfter !== null) {
    logger.warn('POST /api/download-grants/original/:key rate limited', {
      status: 429,
      context: { key, ip: visitorIp(request) },
    });
    return attachVisitorChallengeCookie(tooManyVisitorAttempts(blockedRetryAfter), challengeResult.challenge);
  }

  const grant = await resolveActiveGrant(env.DB, raw?.code);
  if (!grant) {
    const retryAfter = recordFailedVisitorCode(request, challengeResult.challenge);
    if (retryAfter !== null) {
      logger.warn('POST /api/download-grants/original/:key rate limited', {
        status: 429,
        context: { key, ip: visitorIp(request) },
      });
      return attachVisitorChallengeCookie(tooManyVisitorAttempts(retryAfter), challengeResult.challenge);
    }
    return attachVisitorChallengeCookie(notFound('download_grant_not_found'), challengeResult.challenge);
  }

  try {
    const allowed = await imageBelongsToGrant(env.DB, grant.id, key);
    if (!allowed) {
      const retryAfter = recordFailedVisitorCode(request, challengeResult.challenge);
      if (retryAfter !== null) {
        logger.warn('POST /api/download-grants/original/:key rate limited', {
          status: 429,
          context: { key, ip: visitorIp(request) },
        });
        return attachVisitorChallengeCookie(tooManyVisitorAttempts(retryAfter), challengeResult.challenge);
      }
      return attachVisitorChallengeCookie(notFound('download_grant_not_found'), challengeResult.challenge);
    }

    const row = await env.DB.prepare(ORIGINAL_SQL).bind(key).first<OriginalImageRow>();
    if (!row) return attachVisitorChallengeCookie(notFound(), challengeResult.challenge);

    const response = await streamTelegramOriginal(env.TG_BOT_TOKEN, row);
    if (!response) return attachVisitorChallengeCookie(notFound('original_not_archived'), challengeResult.challenge);

    clearFailedVisitorCodes(request, challengeResult.challenge);
    return attachVisitorChallengeCookie(response, challengeResult.challenge);
  } catch (error) {
    logger.error('POST /api/download-grants/original/:key failed', {
      error,
      context: {
        key,
        grantId: grant.id,
      },
    });
    return serverError('original_failed');
  }
});
