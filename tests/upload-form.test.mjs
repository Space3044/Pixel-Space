import assert from 'node:assert/strict';
import { buildUploadFormData } from '../src/features/upload/upload-form.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('buildUploadFormData includes files, metadata, EXIF, and compressed dimensions', () => {
  const original = new File(['raw-bytes'], 'cat.jpg', { type: 'image/jpeg' });
  const compressed = new File(['webp-bytes'], 'cat.webp', { type: 'image/webp' });

  const formData = buildUploadFormData({
    original,
    compressed,
    exif: {
      taken_at: '2025-08-26T02:08:37.000Z',
      camera: 'Nikon Zf',
      iso: 400,
      aperture: 2.8,
      shutter: '1/125',
      focal_length: 40,
      location_lat: 31.2304,
      location_lng: 121.4737,
    },
    meta: {
      title: '猫猫',
      caption: '夜色',
      location_name: '上海',
      location_lat: 31.2304,
      location_lng: 121.4737,
      tags: '猫, 夜景',
      search_content: '猫 夜景 HELLO',
      dominant_color: '暖橙色 #F59E0B',
      palette: '#F59E0B, #0F172A',
      composition: '三分法构图',
      ai_status: 'done',
    },
    dimensions: {
      width: 1280,
      height: 853,
    },
  });

  const originalField = formData.get('original');
  const compressedField = formData.get('compressed');
  assert.equal(originalField.name, original.name);
  assert.equal(originalField.type, original.type);
  assert.equal(originalField.size, original.size);
  assert.equal(compressedField.name, compressed.name);
  assert.equal(compressedField.type, compressed.type);
  assert.equal(compressedField.size, compressed.size);
  assert.deepEqual(JSON.parse(String(formData.get('dimensions'))), { width: 1280, height: 853 });
  assert.equal(JSON.parse(String(formData.get('exif'))).focal_length, 40);
  const meta = JSON.parse(String(formData.get('meta')));
  assert.equal(meta.location_name, '上海');
  assert.equal(meta.dominant_color, '暖橙色 #F59E0B');
  assert.equal(meta.palette, '#F59E0B, #0F172A');
  assert.equal(meta.composition, '三分法构图');
});
