import assert from 'node:assert/strict';
import { useClipboardFeedback } from '../src/features/images/useClipboardFeedback.ts';
import { useImageZoom } from '../src/features/images/useImageZoom.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const pointerTarget = () => ({
  captured: [],
  released: [],
  setPointerCapture(pointerId) {
    this.captured.push(pointerId);
  },
  hasPointerCapture() {
    return true;
  },
  releasePointerCapture(pointerId) {
    this.released.push(pointerId);
  },
});

test('useImageZoom centralizes zoom controls and pointer panning', () => {
  const zoom = useImageZoom();
  assert.equal(zoom.zoomScale.value, 1);
  assert.equal(zoom.zoomPercent.value, 100);
  assert.equal(zoom.canZoomOut.value, false);

  zoom.zoomBy(zoom.ZOOM_STEP);
  assert.equal(zoom.zoomScale.value, 1.25);
  assert.equal(zoom.zoomPercent.value, 125);
  assert.equal(zoom.canZoomOut.value, true);

  zoom.onImageWheel({ deltaY: -1, preventDefault() {} });
  assert.equal(zoom.zoomScale.value, 1.5625);

  zoom.setZoom(2);
  const target = pointerTarget();
  zoom.onImagePointerDown({
    button: 0,
    clientX: 10,
    clientY: 20,
    pointerId: 7,
    currentTarget: target,
  });
  zoom.onImagePointerMove({ clientX: 15, clientY: 18 });

  assert.equal(zoom.isPanning.value, true);
  assert.deepEqual(target.captured, [7]);
  assert.equal(zoom.zoomX.value, 5);
  assert.equal(zoom.zoomY.value, -2);

  zoom.onImagePointerUp({ pointerId: 7, currentTarget: target });
  assert.equal(zoom.isPanning.value, false);
  assert.deepEqual(target.released, [7]);

  zoom.resetZoom();
  assert.equal(zoom.zoomScale.value, 1);
  assert.equal(zoom.zoomX.value, 0);
  assert.equal(zoom.zoomY.value, 0);
});

test('useClipboardFeedback centralizes clipboard copy state', async () => {
  const copied = [];
  const feedback = useClipboardFeedback({
    resetMs: 100,
    writeText: async (value) => {
      copied.push(value);
    },
  });

  await feedback.copyValue('https://imgbed.example.com/p/abc', '公开页');

  assert.deepEqual(copied, ['https://imgbed.example.com/p/abc']);
  assert.equal(feedback.copied.value, true);
  assert.equal(feedback.copiedText.value, '公开页');

  feedback.clearCopyTimer();
  assert.equal(feedback.copied.value, false);
  assert.equal(feedback.copiedText.value, '');
});
