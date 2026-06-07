import type { Env } from '../../types';
import { json, notFound, serverError } from '../../_shared/http';
import { withRequestLogging } from '../../_shared/logger';
import { parseJsonObject } from '../../_shared/request';
import { loadGrantImages, resolveActiveGrant } from '../../_shared/download-grants';
import { requireSameOrigin } from '../../_shared/security';
import { attachVisitorChallengeCookie, requireVisitorChallenge, type VisitorChallenge } from '../../_shared/turnstile';

const FAILED_CODE_LIMIT = 5;
const FAILED_CODE_WINDOW_MS = 10 * 60 * 1000;

const failedCodeAttempts = new Map<string, { count: number; resetAt: number }>();

const visitorIp = (request: Request): string =>
  request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';

const failedAttemptKey = (request: Request, challenge: VisitorChallenge): string =>
  `${visitorIp(request)}:${challenge.visitorId}`;

const retryAfterSeconds = (resetAt: number): number => Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

const rateLimited = (retryAfter: number): Response => {
  const response = json({ error: 'too_many_attempts' }, 429);
  response.headers.set('retry-after', String(retryAfter));
  return response;
};

const failedAttemptBlocked = (key: string): number | null => {
  const bucket = failedCodeAttempts.get(key);
  if (!bucket) return null;
  if (bucket.resetAt <= Date.now()) {
    failedCodeAttempts.delete(key);
    return null;
  }
  return bucket.count >= FAILED_CODE_LIMIT ? retryAfterSeconds(bucket.resetAt) : null;
};

const recordFailedAttempt = (key: string): number | null => {
  const now = Date.now();
  const bucket = failedCodeAttempts.get(key);
  if (!bucket || bucket.resetAt <= now) {
    failedCodeAttempts.set(key, { count: 1, resetAt: now + FAILED_CODE_WINDOW_MS });
    return null;
  }

  bucket.count += 1;
  return bucket.count > FAILED_CODE_LIMIT ? retryAfterSeconds(bucket.resetAt) : null;
};

const clearFailedAttempts = (key: string): void => {
  failedCodeAttempts.delete(key);
};

export const onRequestPost: PagesFunction<Env> = withRequestLogging('/api/download-grants/verify', async ({ request, env }, logger) => {
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const raw = await parseJsonObject(request);
  const challengeResult = await requireVisitorChallenge(request, env, raw?.turnstileToken, logger);
  if (!challengeResult.ok) return challengeResult.response;

  const attemptKey = failedAttemptKey(request, challengeResult.challenge);
  const blockedRetryAfter = failedAttemptBlocked(attemptKey);
  if (blockedRetryAfter !== null) {
    logger.warn('POST /api/download-grants/verify rate limited', {
      status: 429,
      context: { ip: visitorIp(request) },
    });
    return attachVisitorChallengeCookie(rateLimited(blockedRetryAfter), challengeResult.challenge);
  }

  const grant = await resolveActiveGrant(env.DB, raw?.code);
  if (!grant) {
    const retryAfter = recordFailedAttempt(attemptKey);
    if (retryAfter !== null) {
      logger.warn('POST /api/download-grants/verify rate limited', {
        status: 429,
        context: { ip: visitorIp(request) },
      });
      return attachVisitorChallengeCookie(rateLimited(retryAfter), challengeResult.challenge);
    }
    return attachVisitorChallengeCookie(notFound('download_grant_not_found'), challengeResult.challenge);
  }

  try {
    const images = await loadGrantImages(env.DB, grant.id, env.PUBLIC_BASE_URL);
    clearFailedAttempts(attemptKey);
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
