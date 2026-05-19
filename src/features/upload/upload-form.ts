import type { UploadExif, UploadMeta } from './upload.types';

interface BuildUploadFormDataInput {
  original: File;
  compressed: File;
  exif: UploadExif;
  meta: UploadMeta;
}

export function buildUploadFormData(input: BuildUploadFormDataInput): FormData {
  const formData = new FormData();
  formData.append('original', input.original, input.original.name);
  formData.append('compressed', input.compressed, input.compressed.name);
  formData.append('exif', JSON.stringify(input.exif));
  formData.append('meta', JSON.stringify(input.meta));
  return formData;
}
