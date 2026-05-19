import assert from 'node:assert/strict';
import { formatExifTakenAt, normalizeExif } from '../src/features/upload/exif.ts';
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

test('normalizeExif keeps camera, exposure and GPS fields used by upload metadata', () => {
  const exif = normalizeExif({
    Make: 'Canon',
    Model: 'EOS R6',
    DateTimeOriginal: new Date('2025-11-02T09:10:11.000Z'),
    ISO: 200,
    FNumber: 2.8,
    ExposureTime: 0.008,
    FocalLength: 50,
    GPSLatitude: 31.2304,
    GPSLongitude: 121.4737,
  });

  assert.deepEqual(exif, {
    taken_at: '2025-11-02T09:10:11.000Z',
    camera: 'Canon EOS R6',
    iso: 200,
    aperture: 2.8,
    shutter: '1/125',
    focal_length: 50,
    location_lat: 31.2304,
    location_lng: 121.4737,
  });
});

test('normalizeExif returns null fields when EXIF is empty or unavailable', () => {
  assert.deepEqual(normalizeExif(null), {
    taken_at: null,
    camera: null,
    iso: null,
    aperture: null,
    shutter: null,
    focal_length: null,
    location_lat: null,
    location_lng: null,
  });
});

test('formatExifTakenAt turns ISO UTC timestamp into readable local time', () => {
  assert.equal(formatExifTakenAt('2025-08-26T02:08:37.000Z', 'Asia/Shanghai'), '2025-08-26 10:08:37');
  assert.equal(formatExifTakenAt(null, 'Asia/Shanghai'), '--');
});

test('buildUploadFormData appends original, compressed, exif and meta fields', () => {
  const original = new File(['original'], 'cat.jpg', { type: 'image/jpeg' });
  const compressed = new File(['compressed'], 'cat.webp', { type: 'image/webp' });
  const exif = normalizeExif({ ISO: 100 });
  const meta = {
    title: '猫猫',
    caption: '晒太阳',
    location_name: '上海',
    location_lat: 31.23,
    location_lng: 121.47,
  };

  const formData = buildUploadFormData({ original, compressed, exif, meta });

  assert.equal(formData.get('original').name, original.name);
  assert.equal(formData.get('compressed').name, compressed.name);
  assert.equal(formData.get('original').type, original.type);
  assert.equal(formData.get('compressed').type, compressed.type);
  assert.deepEqual(JSON.parse(String(formData.get('exif'))), exif);
  assert.deepEqual(JSON.parse(String(formData.get('meta'))), meta);
});
