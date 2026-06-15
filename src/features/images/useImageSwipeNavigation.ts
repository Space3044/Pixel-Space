type SwipePointerEvent = Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerId' | 'pointerType'> & {
  preventDefault?: () => void;
};

interface UseImageSwipeNavigationOptions {
  canSwipe: () => boolean;
  minDistance?: number;
  maxOffAxisDistance?: number;
  onNext: () => void;
  onPrevious: () => void;
}

export const useImageSwipeNavigation = ({
  canSwipe,
  minDistance = 56,
  maxOffAxisDistance = 48,
  onNext,
  onPrevious,
}: UseImageSwipeNavigationOptions) => {
  let activePointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let blocked = false;
  let suppressNextClick = false;

  const reset = () => {
    activePointerId = null;
    startX = 0;
    startY = 0;
    lastX = 0;
    lastY = 0;
    blocked = false;
  };

  const shouldTrack = (event: SwipePointerEvent) => event.pointerType === 'touch' || event.pointerType === 'pen';

  const onSwipePointerDown = (event: SwipePointerEvent) => {
    if (!shouldTrack(event)) return;
    if (activePointerId !== null) {
      blocked = true;
      return;
    }
    if (!canSwipe()) return;
    activePointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    lastX = event.clientX;
    lastY = event.clientY;
    blocked = false;
  };

  const onSwipePointerMove = (event: SwipePointerEvent) => {
    if (activePointerId !== event.pointerId) return;
    lastX = event.clientX;
    lastY = event.clientY;
    if (!canSwipe()) blocked = true;
  };

  const onSwipePointerUp = (event: SwipePointerEvent) => {
    if (activePointerId !== event.pointerId) return;
    lastX = event.clientX;
    lastY = event.clientY;
    const dx = lastX - startX;
    const dy = lastY - startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const isHorizontalSwipe = absX >= minDistance && absY <= maxOffAxisDistance && absX > absY * 1.25;

    if (!blocked && canSwipe() && isHorizontalSwipe) {
      suppressNextClick = true;
      event.preventDefault?.();
      if (dx < 0) {
        onNext();
      } else {
        onPrevious();
      }
    }

    reset();
  };

  const onSwipePointerCancel = (event: SwipePointerEvent) => {
    if (activePointerId !== event.pointerId) return;
    reset();
  };

  const shouldSuppressClick = () => {
    if (!suppressNextClick) return false;
    suppressNextClick = false;
    return true;
  };

  return {
    onSwipePointerDown,
    onSwipePointerMove,
    onSwipePointerUp,
    onSwipePointerCancel,
    shouldSuppressClick,
  };
};
