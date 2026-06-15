import { computed, ref } from 'vue';

export const IMAGE_ZOOM_MIN = 1;
export const IMAGE_ZOOM_MAX = 2;
export const IMAGE_ZOOM_STEP = 1.25;

type PointerSnapshot = {
  x: number;
  y: number;
};

type PinchStart = {
  centerX: number;
  centerY: number;
  distance: number;
  scale: number;
  x: number;
  y: number;
};

const clampZoom = (next: number) => Math.max(IMAGE_ZOOM_MIN, Math.min(IMAGE_ZOOM_MAX, next));

const pointerDistance = (a: PointerSnapshot, b: PointerSnapshot) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
};

const pointerCenter = (a: PointerSnapshot, b: PointerSnapshot) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export const useImageZoom = () => {
  const zoomScale = ref(IMAGE_ZOOM_MIN);
  const zoomX = ref(0);
  const zoomY = ref(0);
  const isPanning = ref(false);
  let panStart = { x: 0, y: 0, px: 0, py: 0 };
  let pinchStart: PinchStart | null = null;
  const activePointers = new Map<number, PointerSnapshot>();

  const zoomTransform = computed(
    () => `translate(${zoomX.value}px, ${zoomY.value}px) scale(${zoomScale.value})`,
  );
  const zoomPercent = computed(() => Math.round(zoomScale.value * 100));
  const canZoomIn = computed(() => zoomScale.value < IMAGE_ZOOM_MAX - 1e-3);
  const canZoomOut = computed(() => zoomScale.value > IMAGE_ZOOM_MIN + 1e-3);

  const resetZoom = () => {
    zoomScale.value = IMAGE_ZOOM_MIN;
    zoomX.value = 0;
    zoomY.value = 0;
    isPanning.value = false;
    pinchStart = null;
    activePointers.clear();
  };

  const setZoom = (next: number) => {
    zoomScale.value = clampZoom(next);
    if (zoomScale.value <= IMAGE_ZOOM_MIN) {
      zoomX.value = 0;
      zoomY.value = 0;
    }
  };

  const zoomBy = (factor: number) => {
    setZoom(zoomScale.value * factor);
  };

  const currentPinch = () => {
    const pointers = [...activePointers.values()];
    if (pointers.length < 2) return null;
    const [first, second] = pointers;
    const distance = pointerDistance(first, second);
    if (distance <= 0) return null;
    const center = pointerCenter(first, second);
    return { centerX: center.x, centerY: center.y, distance };
  };

  const startPinch = () => {
    const pinch = currentPinch();
    if (!pinch) return;
    pinchStart = {
      ...pinch,
      scale: zoomScale.value,
      x: zoomX.value,
      y: zoomY.value,
    };
  };

  const applyPinch = () => {
    const pinch = currentPinch();
    if (!pinchStart || !pinch) return;
    const nextScale = clampZoom(pinchStart.scale * (pinch.distance / pinchStart.distance));
    const ratio = nextScale / pinchStart.scale;
    zoomScale.value = nextScale;
    if (nextScale <= IMAGE_ZOOM_MIN) {
      zoomX.value = 0;
      zoomY.value = 0;
      return;
    }
    zoomX.value = pinch.centerX - (pinchStart.centerX - pinchStart.x) * ratio;
    zoomY.value = pinch.centerY - (pinchStart.centerY - pinchStart.y) * ratio;
  };

  const capturePointer = (event: PointerEvent) => {
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  };

  const releasePointer = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement | null;
    if (target?.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
  };

  const shouldTrackPointer = (event: PointerEvent) =>
    event.pointerType === 'touch' || event.pointerType === 'pen' || zoomScale.value > IMAGE_ZOOM_MIN;

  const onImageWheel = (event: WheelEvent) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? IMAGE_ZOOM_STEP : 1 / IMAGE_ZOOM_STEP;
    setZoom(zoomScale.value * factor);
  };

  const onImagePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !shouldTrackPointer(event)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    capturePointer(event);
    if (activePointers.size >= 2) {
      isPanning.value = false;
      startPinch();
      return;
    }
    if (zoomScale.value <= IMAGE_ZOOM_MIN) return;
    isPanning.value = true;
    panStart = { x: event.clientX, y: event.clientY, px: zoomX.value, py: zoomY.value };
  };

  const onImagePointerMove = (event: Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerId'>) => {
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size >= 2) {
        applyPinch();
        return;
      }
    }
    if (!isPanning.value) return;
    zoomX.value = panStart.px + (event.clientX - panStart.x);
    zoomY.value = panStart.py + (event.clientY - panStart.y);
  };

  const onImagePointerUp = (event: PointerEvent) => {
    activePointers.delete(event.pointerId);
    releasePointer(event);
    pinchStart = null;
    if (activePointers.size >= 2) {
      startPinch();
      return;
    }
    const [remainingPointer] = activePointers.values();
    if (remainingPointer && zoomScale.value > IMAGE_ZOOM_MIN) {
      isPanning.value = true;
      panStart = { x: remainingPointer.x, y: remainingPointer.y, px: zoomX.value, py: zoomY.value };
      return;
    }
    isPanning.value = false;
  };

  const onImageDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    setZoom(zoomScale.value > IMAGE_ZOOM_MIN ? IMAGE_ZOOM_MIN : IMAGE_ZOOM_MAX);
  };

  return {
    ZOOM_STEP: IMAGE_ZOOM_STEP,
    zoomScale,
    zoomX,
    zoomY,
    isPanning,
    zoomTransform,
    zoomPercent,
    canZoomIn,
    canZoomOut,
    resetZoom,
    setZoom,
    zoomBy,
    onImageWheel,
    onImagePointerDown,
    onImagePointerMove,
    onImagePointerUp,
    onImageDoubleClick,
  };
};
