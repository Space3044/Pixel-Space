import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/ai/preview.ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
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

const makeRequest = (file = new File(['webp-bytes'], 'cat.webp', { type: 'image/webp' })) => {
  const formData = new FormData();
  formData.append('image', file);
  return new Request('http://localhost/api/ai/preview', { method: 'POST', body: formData });
};

const DATABASE_PROMPT = '数据库系统提示词：只输出 JSON';

const makeEnv = (
  settings = { proxy_url: 'https://cpa.test/v1/chat/completions', model: 'image-tagger', prompt: DATABASE_PROMPT },
) => {
  const calls = {
    prepared: [],
  };
  const env = {
    PROXY_KEY: 'proxy-key-test',
    DB: {
      prepare(sql) {
        calls.prepared.push(sql);
        return {
          first: async () => settings,
        };
      },
    },
  };
  return { env, calls };
};

await test('POST /api/ai/preview calls CPA with configured URL and model and returns normalized JSON', async () => {
  const { env, calls } = makeEnv();
  const proxyRequests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      proxyRequests.push({ url: String(url), init });
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: '夜色猫猫',
                caption: '一只猫站在夜色里。',
                tags: ['猫', '夜景'],
                search_content: '猫 夜景 HELLO',
                dominant_color: '深蓝色 #0F172A',
                palette: ['#0F172A', '#F59E0B', '#F8FAFC'],
                composition: '主体位于画面中央，背景以暗部留白突出夜色氛围。',
              }),
            },
          },
        ],
      });
    },
    () => onRequestPost({ env, params: {}, request: makeRequest() }),
  );

  assert.equal(response.status, 200);
  assert.match(calls.prepared[0], /FROM ai_settings/i);
  assert.equal(proxyRequests.length, 1);
  assert.equal(proxyRequests[0].url, 'https://cpa.test/v1/chat/completions');
  assert.equal(proxyRequests[0].init.headers.Authorization, 'Bearer proxy-key-test');
  const body = JSON.parse(proxyRequests[0].init.body);
  assert.equal(body.model, 'image-tagger');
  assert.equal(body.messages[0].role, 'system');
  assert.equal(body.messages[0].content, DATABASE_PROMPT);
  assert.doesNotMatch(body.messages[0].content, /ocr_text/i);
  assert.equal(body.messages[1].role, 'user');
  assert.match(JSON.stringify(body.messages[1]), /直接输出符合上述 Schema 的 JSON 对象/);
  assert.doesNotMatch(JSON.stringify(body.messages), /ocr_text/i);
  assert.match(JSON.stringify(body.messages), /data:image\/webp;base64/);

  const data = await response.json();
  assert.deepEqual(data, {
    title: '夜色猫猫',
    caption: '一只猫站在夜色里。',
    tags: ['猫', '夜景'],
    search_content: '猫 夜景 HELLO',
    dominant_color: '深蓝色 #0F172A',
    palette: ['#0F172A', '#F59E0B', '#F8FAFC'],
    composition: '主体位于画面中央，背景以暗部留白突出夜色氛围。',
  });
});

await test('POST /api/ai/preview rejects missing AI settings before calling CPA', async () => {
  const { env } = makeEnv({ proxy_url: '', model: '' });
  let called = false;

  const response = await withMockedFetch(
    async () => {
      called = true;
      return Response.json({});
    },
    () => onRequestPost({ env, params: {}, request: makeRequest() }),
  );

  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.deepEqual(await response.json(), { error: 'missing_ai_settings' });
});

await test('POST /api/ai/preview uses the editable prompt from ai_settings', async () => {
  const { env } = makeEnv({
    proxy_url: 'https://cpa.test/v1/chat/completions',
    model: 'image-tagger',
    prompt: '自定义系统提示词：只输出 JSON',
  });
  const proxyRequests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      proxyRequests.push({ url: String(url), init });
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: '夜色猫猫',
                caption: '一只猫站在夜色里。',
                tags: ['猫', '夜景'],
                search_content: '猫 夜景',
                dominant_color: '深蓝色 #0F172A',
                palette: ['#0F172A', '#F59E0B', '#F8FAFC'],
                composition: '主体居中。',
              }),
            },
          },
        ],
      });
    },
    () => onRequestPost({ env, params: {}, request: makeRequest() }),
  );

  assert.equal(response.status, 200);
  const body = JSON.parse(proxyRequests[0].init.body);
  assert.equal(body.messages[0].content, '自定义系统提示词：只输出 JSON');
});
