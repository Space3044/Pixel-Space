import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const headersPath = 'public/_headers';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const readHeaders = () => {
  assert.equal(existsSync(headersPath), true, `${headersPath} should exist`);
  return readFileSync(headersPath, 'utf8');
};

test('static pages define browser security headers', () => {
  const headers = readHeaders();

  assert.match(headers, /^\/\*\n/m);
  assert.match(headers, /^\s+Content-Security-Policy: /m);
  assert.match(headers, /default-src 'self'/);
  assert.match(headers, /object-src 'none'/);
  assert.match(headers, /base-uri 'self'/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /^\s+Strict-Transport-Security: max-age=31536000; includeSubDomains$/m);
  assert.match(headers, /^\s+X-Frame-Options: DENY$/m);
  assert.match(headers, /^\s+X-Content-Type-Options: nosniff$/m);
  assert.match(headers, /^\s+Referrer-Policy: strict-origin-when-cross-origin$/m);
  assert.match(headers, /^\s+Permissions-Policy: /m);
});

test('static pages do not expose a wildcard CORS header', () => {
  const headers = readHeaders();

  assert.match(headers, /^\s+! Access-Control-Allow-Origin$/m);
  assert.doesNotMatch(headers, /^\s+Access-Control-Allow-Origin: \*$/m);
});

test('content security policy remains compatible with the AMap JS API', () => {
  const headers = readHeaders();

  assert.match(headers, /script-src [^;]*'unsafe-eval'/);
  assert.match(headers, /script-src [^;]*'unsafe-inline'/);
  assert.match(headers, /script-src [^;]*https:\/\/\*\.amap\.com/);
});
