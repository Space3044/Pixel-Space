import assert from 'node:assert/strict';
import { archiveOriginalToTelegram, getTelegramFileUrl } from '../functions/_shared/telegram.ts';

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

await test('archiveOriginalToTelegram sends the original file as a Telegram document', async () => {
  const requests = [];

  await withMockedFetch(
    async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json({
        ok: true,
        result: {
          message_id: 42,
          chat: { id: -100123 },
          document: { file_id: 'telegram-file-id' },
        },
      });
    },
    async () => {
      const result = await archiveOriginalToTelegram({
        token: 'token-test',
        chatId: '-100123',
        file: new File(['original-bytes'], 'cat.jpg', { type: 'image/jpeg' }),
        key: 'image-key',
      });

      assert.deepEqual(result, {
        file_id: 'telegram-file-id',
        message_id: 42,
        chat_id: '-100123',
      });
    },
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.telegram.org/bottoken-test/sendDocument');
  assert.equal(requests[0].init.method, 'POST');
  assert.equal(requests[0].init.body.get('chat_id'), '-100123');
  assert.equal(requests[0].init.body.get('caption'), 'imgbed:image-key');
  const document = requests[0].init.body.get('document');
  assert.equal(document.name, 'cat.jpg');
  assert.equal(document.type, 'image/jpeg');
});

await test('archiveOriginalToTelegram reports Telegram failure without leaking the bot token', async () => {
  await withMockedFetch(
    async () =>
      Response.json(
        {
          ok: false,
          description: 'token-test rejected by Telegram',
        },
        { status: 400 },
      ),
    async () => {
      await assert.rejects(
        () =>
          archiveOriginalToTelegram({
            token: 'token-test',
            chatId: '-100123',
            file: new File(['original-bytes'], 'cat.jpg', { type: 'image/jpeg' }),
            key: 'image-key',
          }),
        (error) => {
          assert.match(error.message, /telegram_archive_failed/);
          assert.doesNotMatch(error.message, /token-test/);
          return true;
        },
      );
    },
  );
});

await test('archiveOriginalToTelegram reports invalid Telegram JSON explicitly', async () => {
  await withMockedFetch(
    async () => new Response('not-json', { status: 502 }),
    async () => {
      await assert.rejects(
        () =>
          archiveOriginalToTelegram({
            token: 'token-test',
            chatId: '-100123',
            file: new File(['original-bytes'], 'cat.jpg', { type: 'image/jpeg' }),
            key: 'image-key',
          }),
        /telegram_archive_failed: invalid_json/,
      );
    },
  );
});

await test('getTelegramFileUrl resolves the Telegram file download URL', async () => {
  const requests = [];

  await withMockedFetch(
    async (url) => {
      requests.push(String(url));
      return Response.json({
        ok: true,
        result: { file_path: 'documents/original.jpg' },
      });
    },
    async () => {
      const fileUrl = await getTelegramFileUrl('token-test', 'telegram-file-id');
      assert.equal(fileUrl, 'https://api.telegram.org/file/bottoken-test/documents/original.jpg');
    },
  );

  assert.deepEqual(requests, [
    'https://api.telegram.org/bottoken-test/getFile?file_id=telegram-file-id',
  ]);
});
