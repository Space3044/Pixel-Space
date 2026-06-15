import assert from 'node:assert/strict';
import { useLibraryDragSelection } from '../src/features/library/useLibraryDragSelection.ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const mousePointer = (pointerId, target, extra = {}) => ({
  button: 0,
  pointerId,
  pointerType: 'mouse',
  currentTarget: target,
  preventDefault() {},
  ...extra,
});

await test('useLibraryDragSelection selects the held tile and tiles dragged over', async () => {
  const selected = [];
  const target = pointerTarget();
  const drag = useLibraryDragSelection({
    holdMs: 5,
    canSelect: () => true,
    select: (key) => selected.push(key),
  });

  drag.onTilePointerDown('image-a', mousePointer(1, target));

  assert.equal(drag.isDragSelecting.value, false);
  assert.deepEqual(selected, []);

  await wait(10);

  assert.equal(drag.isDragSelecting.value, true);
  assert.deepEqual(selected, ['image-a']);
  assert.deepEqual(target.captured, []);

  drag.onTilePointerEnter('image-b');
  drag.onTilePointerEnter('image-b');
  drag.onTilePointerEnter('image-c');

  assert.deepEqual(selected, ['image-a', 'image-b', 'image-c']);

  drag.onTilePointerUp(mousePointer(1, target));

  assert.equal(drag.isDragSelecting.value, false);
  assert.equal(drag.shouldSuppressClick(), true);
  assert.equal(drag.shouldSuppressClick(), false);
  assert.deepEqual(target.released, []);
});

await test('useLibraryDragSelection ignores quick clicks, readonly state and non-mouse pointers', async () => {
  const selected = [];
  const target = pointerTarget();
  let readonly = false;
  const drag = useLibraryDragSelection({
    holdMs: 5,
    canSelect: () => !readonly,
    select: (key) => selected.push(key),
  });

  drag.onTilePointerDown('quick', mousePointer(1, target));
  drag.onTilePointerUp(mousePointer(1, target));
  await wait(10);

  readonly = true;
  drag.onTilePointerDown('readonly', mousePointer(2, target));
  await wait(10);

  readonly = false;
  drag.onTilePointerDown('touch', {
    ...mousePointer(3, target),
    pointerType: 'touch',
  });
  await wait(10);

  assert.deepEqual(selected, []);
  assert.equal(drag.isDragSelecting.value, false);
  assert.equal(drag.shouldSuppressClick(), false);
});
