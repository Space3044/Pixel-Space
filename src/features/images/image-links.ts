import type { ImageRecord } from './image.types';

export interface ImageLinkRow {
  label: string;
  value: string;
}

const stripBrackets = (s: string): string => s.replace(/[\[\]]/g, '');

const escapeAttr = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export function buildAbsoluteImageUrl(url: string, origin: string): string {
  const trimmed = url.trim();
  if (!origin || !trimmed) return trimmed;
  return new URL(trimmed, origin).toString();
}

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
  return `${origin.replace(/\/$/, '')}/p/${encodeURIComponent(image.key)}`;
}

export function buildImageLinkRows(
  image: Pick<ImageRecord, 'key' | 'title' | 'public_url' | 'width' | 'height'>,
  origin: string,
): ImageLinkRow[] {
  const imageUrl = buildAbsoluteImageUrl(image.public_url, origin);
  const imageForCopy = { ...image, public_url: imageUrl };
  return [
    { label: '图片直链', value: imageUrl },
    { label: 'Markdown', value: buildMarkdown(imageForCopy) },
    { label: 'HTML', value: buildHtml(imageForCopy) },
    { label: '公开页', value: buildPublicPageUrl(image, origin) },
  ];
}
