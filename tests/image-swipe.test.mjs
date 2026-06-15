import assert from 'node:assert/strict';
import { useImageSwipeNavigation } from '../src/features/images/useImageSwipeNavigation.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const touch = (pointerId, clientX, clientY, extra = {}) => ({
  pointerId,
  pointerType: 'touch',
  clientX,
  clientY,
  ...extra,
});

test('useImageSwipeNavigation maps horizontal touch swipes to next and previous', () => {
  const actions = [];
  const prevented = [];
  const swipe = useImageSwipeNavigation({
    canSwipe: () => true,
    onPrevious: () => actions.push('prev'),
    onNext: () => actions.push('next'),
  });

  swipe.onSwipePointerDown(touch(1, 180, 40));
  swipe.onSwipePointerMove(touch(1, 120, 44));
  swipe.onSwipePointerUp(touch(1, 70, 46, { preventDefault: () => prevented.push('left') }));

  swipe.onSwipePointerDown(touch(2, 70, 40));
  swipe.onSwipePointerMove(touch(2, 132, 42));
  swipe.onSwipePointerUp(touch(2, 150, 44, { preventDefault: () => prevented.push('right') }));

  assert.deepEqual(actions, ['next', 'prev']);
  assert.deepEqual(prevented, ['left', 'right']);
  assert.equal(swipe.shouldSuppressClick(), true);
  assert.equal(swipe.shouldSuppressClick(), false);
});

test('useImageSwipeNavigation ignores vertical, short, zoomed and multi-touch gestures', () => {
  const actions = [];
  let zoomed = false;
  const swipe = useImageSwipeNavigation({
    canSwipe: () => !zoomed,
    onPrevious: () => actions.push('prev'),
    onNext: () => actions.push('next'),
  });

  swipe.onSwipePointerDown(touch(1, 120, 40));
  swipe.onSwipePointerMove(touch(1, 118, 132));
  swipe.onSwipePointerUp(touch(1, 116, 160));

  swipe.onSwipePointerDown(touch(2, 120, 40));
  swipe.onSwipePointerMove(touch(2, 84, 42));
  swipe.onSwipePointerUp(touch(2, 76, 44));

  zoomed = true;
  swipe.onSwipePointerDown(touch(3, 180, 40));
  swipe.onSwipePointerMove(touch(3, 80, 42));
  swipe.onSwipePointerUp(touch(3, 60, 44));
  zoomed = false;

  swipe.onSwipePointerDown(touch(4, 180, 40));
  swipe.onSwipePointerDown(touch(5, 176, 42));
  swipe.onSwipePointerMove(touch(4, 70, 44));
  swipe.onSwipePointerUp(touch(4, 60, 46));

  assert.deepEqual(actions, []);
  assert.equal(swipe.shouldSuppressClick(), false);
});
