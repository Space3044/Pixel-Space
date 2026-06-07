import assert from 'node:assert/strict';
import {
  createRequestLogger,
  serializeError,
  withRequestLogging,
} from '../functions/_shared/logger.ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const captureConsole = async (method, fn) => {
  const original = console[method];
  const lines = [];
  console[method] = (line) => {
    lines.push(String(line));
  };
  try {
    await fn();
  } finally {
    console[method] = original;
  }
  return lines;
};

await test('serializeError keeps stable error fields', () => {
  const error = new TypeError('bad input');
  const serialized = serializeError(error);
  assert.equal(serialized.name, 'TypeError');
  assert.equal(serialized.message, 'bad input');
  assert.equal(typeof serialized.stack, 'string');
});

await test('request logger emits structured JSON with redacted context', async () => {
  const request = new Request('https://x.test/api/upload', {
    headers: { 'x-request-id': 'req-from-client' },
  });

  const lines = await captureConsole('error', () => {
    createRequestLogger(request, '/api/upload').error('upload failed', {
      status: 500,
      durationMs: 42,
      error: new Error('d1 failed'),
      context: {
        key: 'images/abc',
        TG_BOT_TOKEN: 'secret-token',
      },
    });
  });

  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.level, 'error');
  assert.equal(entry.message, 'upload failed');
  assert.equal(entry.route, '/api/upload');
  assert.equal(entry.method, 'GET');
  assert.equal(entry.requestId, 'req-from-client');
  assert.equal(entry.status, 500);
  assert.equal(entry.durationMs, 42);
  assert.equal(entry.error.message, 'd1 failed');
  assert.deepEqual(entry.context, {
    key: 'images/abc',
    TG_BOT_TOKEN: '[redacted]',
  });
});

await test('withRequestLogging logs completed requests with request id', async () => {
  const handler = withRequestLogging('/api/example', async () => new Response('ok', { status: 200 }));
  const lines = await captureConsole('info', async () => {
    const response = await handler({
      env: {},
      params: {},
      request: new Request('https://x.test/api/example', {
        headers: { 'cf-ray': 'ray-123' },
      }),
    });
    assert.equal(response.status, 200);
  });

  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.level, 'info');
  assert.equal(entry.message, 'request completed');
  assert.equal(entry.route, '/api/example');
  assert.equal(entry.requestId, 'ray-123');
  assert.equal(entry.status, 200);
  assert.equal(typeof entry.durationMs, 'number');
});

await test('withRequestLogging logs handled 5xx responses as errors', async () => {
  const handler = withRequestLogging('/api/example', async () =>
    Response.json({ error: 'upstream_failed' }, { status: 502 }),
  );

  const lines = await captureConsole('error', async () => {
    const response = await handler({
      env: {},
      params: {},
      request: new Request('https://x.test/api/example'),
    });
    assert.equal(response.status, 502);
  });

  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.level, 'error');
  assert.equal(entry.message, 'request completed');
  assert.equal(entry.status, 502);
  assert.equal(entry.error, null);
});

await test('withRequestLogging logs unhandled exceptions and returns 500', async () => {
  const handler = withRequestLogging('/api/example', async () => {
    throw new Error('boom');
  });

  const lines = await captureConsole('error', async () => {
    const response = await handler({
      env: {},
      params: {},
      request: new Request('https://x.test/api/example'),
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'server_error' });
  });

  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.level, 'error');
  assert.equal(entry.message, 'request failed');
  assert.equal(entry.status, 500);
  assert.equal(entry.error.message, 'boom');
});
