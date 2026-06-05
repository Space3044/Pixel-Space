<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

interface Option {
  value: string;
  label: string;
}

const props = defineProps<{
  modelValue: string;
  options: Option[];
  ariaLabel?: string;
  minWidth?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const currentLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue);
  return opt?.label ?? '';
});

const toggle = () => {
  open.value = !open.value;
};

const close = () => {
  open.value = false;
};

const choose = (value: string) => {
  emit('update:modelValue', value);
  close();
};

const onDocumentMouseDown = (e: MouseEvent) => {
  if (!open.value) return;
  const target = e.target as Node | null;
  if (rootRef.value && target && !rootRef.value.contains(target)) close();
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') close();
};

watch(open, (val) => {
  if (val) {
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onKeydown);
  } else {
    document.removeEventListener('mousedown', onDocumentMouseDown);
    document.removeEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="rootRef" class="select-popover">
    <button
      type="button"
      class="sp-trigger"
      :class="{ active: open }"
      :aria-label="ariaLabel"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
    >
      <slot name="leading-icon" />
      <span class="sp-label">{{ currentLabel }}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sp-caret" :class="{ open }" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div v-if="open" class="sp-popover" role="listbox" :style="{ minWidth: minWidth ?? '12rem' }">
      <div
        v-for="opt in options"
        :key="opt.value"
        role="option"
        tabindex="0"
        :aria-selected="opt.value === modelValue"
        class="sp-row"
        :class="{ chosen: opt.value === modelValue }"
        @click="choose(opt.value)"
        @keydown.enter="choose(opt.value)"
        @keydown.space.prevent="choose(opt.value)"
      >
        <span class="sp-row-label">{{ opt.label }}</span>
        <svg v-if="opt.value === modelValue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="sp-check" aria-hidden="true">
          <path d="m5 12 4 4 10-10" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.select-popover {
  position: relative;
}

.sp-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  height: 32px;
  border: 1px solid rgba(53, 243, 255, 0.18);
  border-radius: 6px;
  background: rgba(9, 14, 28, 0.72);
  padding: 0 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: rgb(203, 213, 225);
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
}

.sp-trigger:hover,
.sp-trigger:focus-visible,
.sp-trigger.active {
  border-color: rgba(53, 243, 255, 0.62);
  color: rgb(53, 243, 255);
  outline: none;
}

.sp-trigger.active {
  box-shadow: 0 0 0 2px rgba(53, 243, 255, 0.18);
}

.sp-label {
  white-space: nowrap;
}

.sp-caret {
  width: 14px;
  height: 14px;
  margin-left: 0.1rem;
  flex-shrink: 0;
  transition: transform 160ms ease;
}

.sp-caret.open {
  transform: rotate(180deg);
}

.sp-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  border: 1px solid rgba(53, 243, 255, 0.28);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(53, 243, 255, 0.08), transparent 42%),
    rgba(7, 7, 19, 0.92);
  backdrop-filter: blur(18px);
  box-shadow: 0 16px 40px rgba(2, 4, 14, 0.55), 0 0 0 1px rgba(53, 243, 255, 0.06);
  overflow: hidden;
  padding: 0.3rem 0;
}

.sp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  min-height: 32px;
  padding: 0 0.75rem;
  font-size: 0.78rem;
  color: rgb(203, 213, 225);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
  user-select: none;
}

.sp-row:hover,
.sp-row:focus-visible {
  background: rgba(53, 243, 255, 0.08);
  color: rgb(165, 243, 252);
  outline: none;
}

.sp-row.chosen {
  background: rgba(53, 243, 255, 0.14);
  color: rgb(53, 243, 255);
}

.sp-check {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.sp-row-label {
  white-space: nowrap;
}
</style>
