import type { ImageRecord } from './image.types';

const stripBrackets = (s: string): string => s.replace(/[\[\]]/g, '');

const escapeAttr = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export function buildMarkdown(image: Pick<ImageRecord, 'title' | 'public_url'>): string {
  return `![${stripBrackets(image.title ?? '')}](${image.public_url})`;
}

export function buildHtml(
  image: Pick<ImageRecord, 'title' | 'public_url' | 'width' | 'height'>,
): string {
  const src = escapeAttr(image.public_url);
  const alt = escapeAttr(image.title ?? '');
  return `<img src="${src}" alt="${alt}" width="${image.width}" height="${image.height}" />`;
}

export function buildPublicPageUrl(image: Pick<ImageRecord, 'key'>, origin: string): string {
  return `${origin.replace(/\/$/, '')}/p/${image.key}`;
}
