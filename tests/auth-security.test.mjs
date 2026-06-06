import assert from 'node:assert/strict';
import { resolveAdmin } from '../functions/_shared/auth.ts';
import { requireSameOrigin } from '../functions/_shared/security.ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const base64Url = (value) => {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

const createAccessJwt = async ({ aud = 'app-aud', email = 'admin@example.com', teamDomain = 'team.cloudflareaccess.com' } = {}) => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  publicJwk.kid = 'test-kid';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: publicJwk.kid }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      aud,
      email,
      exp: now + 300,
      iss: `https://${teamDomain}`,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  );

  return {
    jwt: `${signingInput}.${base64Url(signature)}`,
    publicJwk,
  };
};

const withMockedFetch = async (fetchImpl, fn) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

await test('resolveAdmin rejects production Access email headers without a verified JWT', async () => {
  const request = new Request('https://imgbed.example.com/api/admin/me', {
    headers: {
      'Cf-Access-Authenticated-User-Email': 'spoof@example.com',
    },
  });

  const admin = await resolveAdmin(request, {
    CF_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
    CF_ACCESS_AUD: 'app-aud',
  });

  assert.equal(admin, null);
});

await test('resolveAdmin trusts the signed Access JWT email instead of a spoofable header', async () => {
  const { jwt, publicJwk } = await createAccessJwt();
  const request = new Request('https://imgbed.example.com/api/admin/me', {
    headers: {
      'Cf-Access-Authenticated-User-Email': 'spoof@example.com',
      'Cf-Access-Jwt-Assertion': jwt,
    },
  });
  const fetchedUrls = [];

  const admin = await withMockedFetch(
    async (url) => {
      fetchedUrls.push(String(url));
      return Response.json({ keys: [publicJwk] });
    },
    () =>
      resolveAdmin(request, {
        CF_ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
        CF_ACCESS_AUD: 'app-aud',
      }),
  );

  assert.deepEqual(admin, { email: 'admin@example.com' });
  assert.deepEqual(fetchedUrls, ['https://team.cloudflareaccess.com/cdn-cgi/access/certs']);
});

await test('resolveAdmin keeps local development role switching independent from Access JWTs', async () => {
  const request = new Request('http://localhost/api/admin/me', {
    headers: {
      'X-Dev-Role': 'admin',
    },
  });

  assert.deepEqual(await resolveAdmin(request, {}), { email: 'dev@local' });
});

await test('requireSameOrigin allows the Vite dev proxy loopback origin', async () => {
  const request = new Request('http://localhost:8788/api/upload', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:5173',
    },
  });

  assert.equal(requireSameOrigin(request), null);
});

await test('requireSameOrigin still rejects external cross-site browser origins', async () => {
  const response = requireSameOrigin(
    new Request('https://imgbed.example.com/api/upload', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
      },
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'invalid_origin' });
});
