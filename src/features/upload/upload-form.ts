import type { UploadDimensions, UploadExif, UploadMeta } from './upload.types';

interface BuildUploadFormDataInput {
  original: File;
  compressed: File;
  hash: string;
  exif: UploadExif;
  meta: UploadMeta;
  dimensions: UploadDimensions;
}

export function buildUploadFormData(input: BuildUploadFormDataInput): FormData {
  const formData = new FormData();
  formData.append('original', input.original, input.original.name);
  formData.append('compressed', input.compressed, input.compressed.name);
  formData.append('hash', input.hash);
  formData.append('exif', JSON.stringify(input.exif));
  formData.append('meta', JSON.stringify(input.meta));
  formData.append('dimensions', JSON.stringify(input.dimensions));
  return formData;
}
