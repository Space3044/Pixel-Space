import assert from 'node:assert/strict';
import {
  buildImageLinkRows,
  buildMarkdown,
  buildHtml,
  buildPublicPageUrl,
} from '../src/features/images/image-links.ts';
import * as imageLinks from '../src/features/images/image-links.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const sample = {
  key: 'abc123',
  title: 'Sunset',
  public_url: 'https://cdn.example.com/img/abc123.webp',
  width: 1024,
  height: 768,
};

test('buildMarkdown wraps title and url with alt syntax', () => {
  assert.equal(
    buildMarkdown(sample),
    '![Sunset](https://cdn.example.com/img/abc123.webp)',
  );
});

test('buildMarkdown strips brackets from title to keep alt valid', () => {
  assert.equal(
    buildMarkdown({ title: 'Hello [World]', public_url: 'https://x/y.webp' }),
    '![Hello World](https://x/y.webp)',
  );
});

test('buildHtml emits img tag with dimensions', () => {
  assert.equal(
    buildHtml(sample),
    '<img src="https://cdn.example.com/img/abc123.webp" alt="Sunset" width="1024" height="768" />',
  );
});

test('buildHtml escapes quotes and angle brackets in title and url', () => {
  assert.equal(
    buildHtml({
      title: 'A "quote" <tag>',
      public_url: 'https://x/y?q="z"',
      width: 100,
      height: 100,
    }),
    '<img src="https://x/y?q=&quot;z&quot;" alt="A &quot;quote&quot; &lt;tag&gt;" width="100" height="100" />',
  );
});

test('buildAbsoluteImageUrl adds origin to relative image urls', () => {
  assert.equal(
    imageLinks.buildAbsoluteImageUrl('/api/public/abc.webp', 'https://imgbed.example.com'),
    'https://imgbed.example.com/api/public/abc.webp',
  );
});

test('buildAbsoluteImageUrl keeps absolute image urls unchanged', () => {
  assert.equal(
    imageLinks.buildAbsoluteImageUrl('https://cdn.example.com/img/abc.webp', 'https://imgbed.example.com'),
    'https://cdn.example.com/img/abc.webp',
  );
});

test('buildPublicPageUrl joins origin and /p/:key', () => {
  assert.equal(
    buildPublicPageUrl({ key: 'abc' }, 'https://imgbed.example.com'),
    'https://imgbed.example.com/p/abc',
  );
});

test('buildPublicPageUrl trims a trailing slash on origin', () => {
  assert.equal(
    buildPublicPageUrl({ key: 'abc' }, 'https://imgbed.example.com/'),
    'https://imgbed.example.com/p/abc',
  );
});

test('buildImageLinkRows centralizes copyable image link rows', () => {
  assert.deepEqual(buildImageLinkRows(sample, 'https://imgbed.example.com'), [
    { label: '图片直链', value: 'https://cdn.example.com/img/abc123.webp' },
    { label: 'Markdown', value: '![Sunset](https://cdn.example.com/img/abc123.webp)' },
    {
      label: 'HTML',
      value: '<img src="https://cdn.example.com/img/abc123.webp" alt="Sunset" width="1024" height="768" />',
    },
    { label: '公开页', value: 'https://imgbed.example.com/p/abc123' },
  ]);
});
