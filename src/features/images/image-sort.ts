import type { ImageRecord } from './image.types';

export type ImageSortMode = 'created-desc' | 'created-asc' | 'taken-desc' | 'taken-asc';

export const imageSortOptions: Array<{ value: ImageSortMode; label: string }> = [
  { value: 'created-desc', label: '最新上传' },
  { value: 'created-asc', label: '最早上传' },
  { value: 'taken-desc', label: '最新拍摄' },
  { value: 'taken-asc', label: '最早拍摄' },
];

const compareTime = (
  a: string | null | undefined,
  b: string | null | undefined,
  direction: 'asc' | 'desc',
) => {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const result = a < b ? -1 : 1;
  return direction === 'asc' ? result : -result;
};

export function sortImagesByMode(images: ImageRecord[], mode: ImageSortMode): ImageRecord[] {
  const list = [...images];
  if (mode === 'created-desc') return list.sort((a, b) => compareTime(a.created_at, b.created_at, 'desc'));
  if (mode === 'created-asc') return list.sort((a, b) => compareTime(a.created_at, b.created_at, 'asc'));
  if (mode === 'taken-desc') return list.sort((a, b) => compareTime(a.exif_taken_at, b.exif_taken_at, 'desc'));
  return list.sort((a, b) => compareTime(a.exif_taken_at, b.exif_taken_at, 'asc'));
}
