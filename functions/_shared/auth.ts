import type { Env } from '../types';

export interface AdminIdentity {
  email: string;
}

const DEV_ADMIN_EMAIL = 'dev@local';

// 身份判定的唯一信号是请求 hostname：
// - hostname 不是 localhost/127.0.0.1/0.0.0.0 → 边缘运行时（线上），只信 Access 注入的邮箱头，env 与请求头里的角色标记一律忽略。
// - 是 localhost 系列 → 本地 wrangler pages dev，按 X-Dev-Role > LOCAL_ROLE > 默认 admin 决定身份。
// 之所以不用 request.cf：wrangler pages dev 也会模拟该对象，无法据此区分。
// 生产域名永远不可能是 localhost，所以 hostname 作为信号最稳。
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

interface AccessJwtHeader {
  alg?: unknown;
  kid?: unknown;
}

interface AccessJwtPayload {
  aud?: unknown;
  email?: unknown;
  exp?: unknown;
  iss?: unknown;
  nbf?: unknown;
}

interface AccessCertsResponse {
  keys?: JsonWebKey[];
}

type AccessPublicJwk = JsonWebKey & { kid?: string };

const certsCache = new Map<string, Promise<JsonWebKey[]>>();

const base64UrlToBytes = (value: string): Uint8Array => {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const base64UrlToJson = <T>(value: string): T => {
  const text = new TextDecoder().decode(base64UrlToBytes(value));
  return JSON.parse(text) as T;
};

const normalizeTeamDomain = (value: string | undefined): string => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return trimmed.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
};

const accessCertsUrl = (teamDomain: string): string => `https://${teamDomain}/cdn-cgi/access/certs`;

const loadAccessCerts = async (teamDomain: string): Promise<JsonWebKey[]> => {
  const url = accessCertsUrl(teamDomain);
  const cached = certsCache.get(url);
  if (cached) return cached;

  const next = fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error(`access_certs_http_${response.status}`);
      const data = (await response.json()) as AccessCertsResponse;
      return Array.isArray(data.keys) ? data.keys : [];
    })
    .catch((error) => {
      certsCache.delete(url);
      throw error;
    });
  certsCache.set(url, next);
  return next;
};

const audMatches = (claim: unknown, expected: string): boolean => {
  if (typeof claim === 'string') return claim === expected;
  if (Array.isArray(claim)) return claim.includes(expected);
  return false;
};

const importRsaPublicKey = (jwk: JsonWebKey): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

const verifyAccessJwt = async (jwt: string, env: Env): Promise<AdminIdentity | null> => {
  const teamDomain = normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const expectedAud = env.CF_ACCESS_AUD?.trim() ?? '';
  if (!teamDomain || !expectedAud) return null;

  const parts = jwt.split('.');
  if (parts.length !== 3) return null;

  try {
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = base64UrlToJson<AccessJwtHeader>(encodedHeader);
    const payload = base64UrlToJson<AccessJwtPayload>(encodedPayload);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    if (payload.iss !== `https://${teamDomain}`) return null;
    if (!audMatches(payload.aud, expectedAud)) return null;
    if (typeof payload.email !== 'string' || !payload.email.trim()) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > now) return null;

    const cert = (await loadAccessCerts(teamDomain)).find((key) => (key as AccessPublicJwk).kid === header.kid);
    if (!cert) return null;

    const key = await importRsaPublicKey(cert);
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlToBytes(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
    return valid ? { email: payload.email.trim() } : null;
  } catch {
    return null;
  }
};

export const resolveAdmin = async (request: Request, env: Env): Promise<AdminIdentity | null> => {
  const hostname = new URL(request.url).hostname;
  const isLocal = LOCAL_HOSTS.has(hostname);
  if (!isLocal) {
    const jwt = request.headers.get('Cf-Access-Jwt-Assertion')?.trim() ?? '';
    return jwt ? await verifyAccessJwt(jwt, env) : null;
  }
  const headerRole = request.headers.get('X-Dev-Role')?.trim().toLowerCase();
  const envRole = env.LOCAL_ROLE?.trim().toLowerCase();
  const role = headerRole || envRole || 'admin';
  return role === 'visitor' ? null : { email: DEV_ADMIN_EMAIL };
};
