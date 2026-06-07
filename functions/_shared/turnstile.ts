import { forbidden, serverError } from './http';
import type { RequestLogger } from './logger';
import type { Env } from '../types';

const COOKIE_NAME = 'visitor_challenge';
const COOKIE_TTL_SECONDS = 24 * 60 * 60;
const COOKIE_TTL_MS = COOKIE_TTL_SECONDS * 1000;
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerificationResponse {
  success?: boolean;
  hostname?: string;
  'error-codes'?: string[];
}

export interface VisitorChallenge {
  visitorId: string;
  setCookie?: string;
}

type VisitorChallengeResult =
  | { ok: true; challenge: VisitorChallenge }
  | { ok: false; response: Response };

const textEncoder = new TextEncoder();

const isCloudflareRequest = (request: Request): boolean =>
  Boolean((request as Request & { cf?: unknown }).cf);

const base64Url = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const hmacKey = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

const sign = async (value: string, secret: string): Promise<string> => {
  const key = await hmacKey(secret);
  return base64Url(await crypto.subtle.sign('HMAC', key, textEncoder.encode(value)));
};

const cookieValue = (request: Request, name: string): string | null => {
  const header = request.headers.get('cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) return valueParts.join('=');
  }
  return null;
};

const readCookieChallenge = async (request: Request, secret: string): Promise<VisitorChallenge | null> => {
  const value = cookieValue(request, COOKIE_NAME);
  if (!value) return null;

  const [expiresAtText, visitorId, signature] = value.split('.');
  const expiresAt = Number(expiresAtText);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !visitorId || !signature) return null;

  const signedValue = `${expiresAtText}.${visitorId}`;
  const expected = await sign(signedValue, secret);
  return expected === signature ? { visitorId } : null;
};

const createChallengeCookie = async (request: Request, secret: string): Promise<VisitorChallenge> => {
  const visitorId = crypto.randomUUID();
  const expiresAt = Date.now() + COOKIE_TTL_MS;
  const signedValue = `${expiresAt}.${visitorId}`;
  const signature = await sign(signedValue, secret);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return {
    visitorId,
    setCookie: `${COOKIE_NAME}=${signedValue}.${signature}; Max-Age=${COOKIE_TTL_SECONDS}; Path=/; HttpOnly${secure}; SameSite=Lax`,
  };
};

const verifyTurnstileToken = async (
  request: Request,
  secret: string,
  token: string,
  logger?: RequestLogger,
): Promise<boolean> => {
  const body = new URLSearchParams({
    secret,
    response: token,
  });
  const remoteIp = request.headers.get('cf-connecting-ip');
  if (remoteIp) body.set('remoteip', remoteIp);

  const response = await fetch(VERIFY_URL, {
    method: 'POST',
    body,
  });

  const data = (await response.json().catch(() => ({}))) as TurnstileVerificationResponse;
  if (response.ok && data.success === true) return true;

  logger?.warn('Turnstile verification failed', {
    status: response.status,
    context: {
      hostname: data.hostname,
      errorCodes: data['error-codes'] ?? [],
    },
  });
  return false;
};

export const requireVisitorChallenge = async (
  request: Request,
  env: Pick<Env, 'TURNSTILE_SECRET_KEY'>,
  token: unknown,
  logger?: RequestLogger,
): Promise<VisitorChallengeResult> => {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (!isCloudflareRequest(request)) return { ok: true, challenge: { visitorId: 'local-dev' } };
    logger?.error('Turnstile secret is not configured');
    return { ok: false, response: serverError('turnstile_not_configured') };
  }

  const cookieChallenge = await readCookieChallenge(request, secret);
  if (cookieChallenge) return { ok: true, challenge: cookieChallenge };

  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, response: forbidden('turnstile_required') };
  }

  const verified = await verifyTurnstileToken(request, secret, token, logger);
  if (!verified) return { ok: false, response: forbidden('turnstile_invalid') };

  return { ok: true, challenge: await createChallengeCookie(request, secret) };
};

export const attachVisitorChallengeCookie = (
  response: Response,
  challenge: VisitorChallenge,
): Response => {
  if (challenge.setCookie) response.headers.append('set-cookie', challenge.setCookie);
  return response;
};
