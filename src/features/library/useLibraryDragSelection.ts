import { ref } from 'vue';

type DragPointerEvent = Pick<PointerEvent, 'button' | 'currentTarget' | 'pointerId' | 'pointerType'> & {
  preventDefault?: () => void;
};

interface UseLibraryDragSelectionOptions {
  canSelect: () => boolean;
  holdMs?: number;
  select: (key: string) => void;
}

export const useLibraryDragSelection = ({
  canSelect,
  holdMs = 220,
  select,
}: UseLibraryDragSelectionOptions) => {
  const isDragSelecting = ref(false);
  let activePointerId: number | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let suppressNextClick = false;
  let selectedDuringDrag = new Set<string>();

  const clearHoldTimer = () => {
    if (!holdTimer) return;
    clearTimeout(holdTimer);
    holdTimer = null;
  };

  const selectOnce = (key: string) => {
    if (selectedDuringDrag.has(key)) return;
    selectedDuringDrag.add(key);
    select(key);
  };

  const startSelecting = (key: string) => {
    if (activePointerId === null || !canSelect()) return;
    isDragSelecting.value = true;
    suppressNextClick = true;
    selectOnce(key);
  };

  const onGlobalPointerEnd = (event: PointerEvent) => {
    if (activePointerId !== event.pointerId) return;
    reset();
  };

  const addGlobalPointerListeners = () => {
    if (typeof window === 'undefined') return;
    window.addEventListener('pointerup', onGlobalPointerEnd);
    window.addEventListener('pointercancel', onGlobalPointerEnd);
  };

  const removeGlobalPointerListeners = () => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointerup', onGlobalPointerEnd);
    window.removeEventListener('pointercancel', onGlobalPointerEnd);
  };

  const reset = () => {
    clearHoldTimer();
    removeGlobalPointerListeners();
    activePointerId = null;
    isDragSelecting.value = false;
    selectedDuringDrag = new Set();
  };

  const onTilePointerDown = (key: string, event: DragPointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !canSelect()) return;
    reset();
    activePointerId = event.pointerId;
    addGlobalPointerListeners();
    holdTimer = setTimeout(() => {
      holdTimer = null;
      startSelecting(key);
    }, holdMs);
  };

  const onTilePointerEnter = (key: string) => {
    if (!isDragSelecting.value || !canSelect()) return;
    selectOnce(key);
  };

  const onTilePointerUp = (event: DragPointerEvent) => {
    if (activePointerId !== event.pointerId) return;
    if (isDragSelecting.value) {
      suppressNextClick = true;
      event.preventDefault?.();
    }
    reset();
  };

  const onTilePointerCancel = (event: DragPointerEvent) => {
    if (activePointerId !== event.pointerId) return;
    reset();
  };

  const shouldSuppressClick = () => {
    if (!suppressNextClick) return false;
    suppressNextClick = false;
    return true;
  };

  return {
    isDragSelecting,
    onTilePointerDown,
    onTilePointerEnter,
    onTilePointerUp,
    onTilePointerCancel,
    shouldSuppressClick,
  };
};
