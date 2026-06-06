<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  label?: string;
  value?: number | null;
  max?: number;
  status?: 'idle' | 'loading' | 'success' | 'error';
  compact?: boolean;
}>(), {
  label: '处理中',
  value: null,
  max: 100,
  status: 'loading',
  compact: false,
});

const normalizedProgress = computed(() => {
  if (props.value === null || !Number.isFinite(props.value) || props.max <= 0) return null;
  return Math.min(100, Math.max(0, (props.value / props.max) * 100));
});

const isIndeterminate = computed(() => props.status === 'loading' && normalizedProgress.value === null);

const progressScale = computed(() => {
  if (normalizedProgress.value === null) return 0;
  return normalizedProgress.value / 100;
});

const progressStyle = computed(() => ({
  transform: isIndeterminate.value ? 'translateX(-35%) scaleX(0.35)' : `scaleX(${progressScale.value})`,
}));

const percentLabel = computed(() => {
  if (normalizedProgress.value === null) return '';
  return `${Math.round(normalizedProgress.value)}%`;
});

const ariaValueNow = computed(() => {
  if (normalizedProgress.value === null || props.value === null) return undefined;
  return Math.round(Math.min(props.max, Math.max(0, props.value)));
});
</script>

<template>
  <div
    class="task-progress"
    :class="[`is-${status}`, { 'is-compact': compact }]"
    role="status"
    :aria-live="status === 'loading' ? 'polite' : 'off'"
  >
    <div v-if="!compact" class="task-progress-head">
      <span class="task-progress-label">{{ label }}</span>
      <span v-if="percentLabel" class="task-progress-percent">{{ percentLabel }}</span>
    </div>

    <div
      class="task-progress-track"
      :class="{ 'is-indeterminate': isIndeterminate }"
      role="progressbar"
      :aria-label="label"
      aria-valuemin="0"
      :aria-valuemax="max"
      :aria-valuenow="ariaValueNow"
    >
      <span class="task-progress-fill" :style="progressStyle" aria-hidden="true" />
    </div>

    <div class="task-progress-caption">
      <span>{{ label }}</span>
      <span v-if="compact && percentLabel" class="task-progress-percent">{{ percentLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.task-progress {
  display: grid;
  gap: 0.42rem;
  min-width: 0;
  color: rgb(var(--c-text-soft));
}

.task-progress-head,
.task-progress-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
  font-size: 0.78rem;
  line-height: 1.35;
}

.task-progress-caption {
  color: rgb(var(--c-text-muted));
}

.task-progress.is-compact {
  gap: 0.3rem;
}

.task-progress.is-compact .task-progress-caption {
  font-size: 0.76rem;
}

.task-progress-label,
.task-progress-caption span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-progress-percent {
  flex-shrink: 0;
  color: rgb(var(--c-cyan));
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.72rem;
}

.task-progress-track {
  position: relative;
  height: 0.42rem;
  overflow: hidden;
  border: 1px solid rgb(var(--c-cyan) / 0.18);
  border-radius: 0.25rem;
  background: rgb(var(--c-bg) / 0.62);
}

.task-progress-fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  border-radius: inherit;
  background: linear-gradient(90deg, rgb(var(--c-cyan)), rgb(var(--c-pink)));
  box-shadow: 0 0 16px rgb(var(--c-cyan) / 0.28);
  transition: transform 180ms ease;
}

.task-progress-track.is-indeterminate .task-progress-fill {
  animation: task-progress-scan 1.15s ease-in-out infinite;
}

.task-progress.is-idle .task-progress-fill {
  background: rgb(var(--c-border) / 0.42);
  box-shadow: none;
}

.task-progress.is-success .task-progress-fill {
  background: linear-gradient(90deg, rgb(var(--c-success)), rgb(var(--c-cyan)));
}

.task-progress.is-success .task-progress-percent {
  color: rgb(var(--c-success));
}

.task-progress.is-error .task-progress-track {
  border-color: rgb(var(--c-danger) / 0.34);
}

.task-progress.is-error .task-progress-fill {
  background: rgb(var(--c-danger));
  box-shadow: 0 0 14px rgb(var(--c-danger) / 0.22);
}

.task-progress.is-error .task-progress-percent {
  color: rgb(var(--c-danger));
}

@keyframes task-progress-scan {
  0% {
    transform: translateX(-85%) scaleX(0.35);
  }
  50% {
    transform: translateX(88%) scaleX(0.35);
  }
  100% {
    transform: translateX(220%) scaleX(0.35);
  }
}

@media (prefers-reduced-motion: reduce) {
  .task-progress-fill {
    transition-duration: 1ms;
  }

  .task-progress-track.is-indeterminate .task-progress-fill {
    animation: none;
    transform: scaleX(0.35);
  }
}
</style>
