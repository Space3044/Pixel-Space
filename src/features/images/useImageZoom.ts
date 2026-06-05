import { computed, ref } from 'vue';

export const IMAGE_ZOOM_MIN = 1;
export const IMAGE_ZOOM_MAX = 2;
export const IMAGE_ZOOM_STEP = 1.25;

export const useImageZoom = () => {
  const zoomScale = ref(IMAGE_ZOOM_MIN);
  const zoomX = ref(0);
  const zoomY = ref(0);
  const isPanning = ref(false);
  let panStart = { x: 0, y: 0, px: 0, py: 0 };

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
  };

  const setZoom = (next: number) => {
    zoomScale.value = Math.max(IMAGE_ZOOM_MIN, Math.min(IMAGE_ZOOM_MAX, next));
    if (zoomScale.value <= IMAGE_ZOOM_MIN) {
      zoomX.value = 0;
      zoomY.value = 0;
    }
  };

  const zoomBy = (factor: number) => {
    setZoom(zoomScale.value * factor);
  };

  const onImageWheel = (event: WheelEvent) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? IMAGE_ZOOM_STEP : 1 / IMAGE_ZOOM_STEP;
    setZoom(zoomScale.value * factor);
  };

  const onImagePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || zoomScale.value <= IMAGE_ZOOM_MIN) return;
    isPanning.value = true;
    panStart = { x: event.clientX, y: event.clientY, px: zoomX.value, py: zoomY.value };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onImagePointerMove = (event: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
    if (!isPanning.value) return;
    zoomX.value = panStart.px + (event.clientX - panStart.x);
    zoomY.value = panStart.py + (event.clientY - panStart.y);
  };

  const onImagePointerUp = (event: PointerEvent) => {
    if (!isPanning.value) return;
    isPanning.value = false;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
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
