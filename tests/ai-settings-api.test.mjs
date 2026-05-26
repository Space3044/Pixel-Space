import assert from 'node:assert/strict';
import { onRequestGet, onRequestPatch } from '../functions/api/admin/ai-settings.ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const makeEnv = (row = {
  proxy_url: 'https://cpa.test/v1/chat/completions',
  model: 'image-tagger',
  prompt: '自定义图片分析提示词',
}) => {
  const calls = {
    prepared: [],
    binds: [],
  };

  const env = {
    PROXY_KEY: 'proxy-key-test',
    DB: {
      prepare(sql) {
        calls.prepared.push(sql);
        return {
          bind(...values) {
            calls.binds.push(values);
            return {
              run: async () => ({ success: true, meta: {} }),
              first: async () => row,
            };
          },
          first: async () => row,
        };
      },
    },
  };

  return { env, calls };
};

await test('GET /api/admin/ai-settings returns proxy URL, model and prompt without leaking key', async () => {
  const { env } = makeEnv();
  const response = await onRequestGet({ env, params: {}, request: new Request('http://localhost/api/admin/ai-settings') });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data, {
    proxy_url: 'https://cpa.test/v1/chat/completions',
    model: 'image-tagger',
    prompt: '自定义图片分析提示词',
  });
  assert.equal('proxy_key' in data, false);
});

await test('PATCH /api/admin/ai-settings upserts proxy URL, model and prompt only', async () => {
  const { env, calls } = makeEnv({
    proxy_url: 'https://new-cpa.test/v1/chat/completions',
    model: 'new-model',
    prompt: '新的图片分析提示词',
  });
  const response = await onRequestPatch({
    env,
    params: {},
    request: new Request('http://localhost/api/admin/ai-settings', {
      method: 'PATCH',
      body: JSON.stringify({
        proxy_url: 'https://new-cpa.test/v1/chat/completions',
        model: 'new-model',
        prompt: '新的图片分析提示词',
        proxy_key: 'must-not-save',
      }),
    }),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data, {
    proxy_url: 'https://new-cpa.test/v1/chat/completions',
    model: 'new-model',
    prompt: '新的图片分析提示词',
  });
  assert.match(calls.prepared[0], /INSERT INTO ai_settings/i);
  assert.match(calls.prepared[0], /ON CONFLICT/i);
  assert.match(calls.prepared[0], /\bprompt\b/i);
  assert.doesNotMatch(calls.prepared[0], /proxy_key/i);
  assert.deepEqual(calls.binds[0], [
    'https://new-cpa.test/v1/chat/completions',
    'new-model',
    '新的图片分析提示词',
  ]);
});
