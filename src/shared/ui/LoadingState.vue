<script setup lang="ts">
import { computed } from 'vue';
import TaskProgress from './TaskProgress.vue';

const props = withDefaults(defineProps<{
  title: string;
  message?: string;
  error?: string | null;
  progress?: number | null;
  max?: number;
}>(), {
  message: '',
  error: null,
  progress: null,
  max: 100,
});

const isError = computed(() => props.error !== null && props.error !== '');
const status = computed(() => (isError.value ? 'error' : 'loading'));
const stateRole = computed(() => (isError.value ? 'alert' : 'status'));
</script>

<template>
  <section
    class="loading-state cyber-panel"
    :class="{ 'is-error': isError }"
    :role="stateRole"
    :aria-live="isError ? 'assertive' : 'polite'"
  >
    <span class="loading-state-mark" aria-hidden="true" />
    <div class="loading-state-body">
      <h2>{{ title }}</h2>
      <p v-if="error || message">{{ error || message }}</p>
      <TaskProgress
        v-if="!isError"
        :label="message || title"
        :value="progress"
        :max="max"
        :status="status"
        compact
      />
    </div>
  </section>
</template>

<style scoped>
.loading-state {
  display: grid;
  grid-template-columns: 0.7rem minmax(0, 1fr);
  gap: 0.8rem;
  align-items: start;
  padding: 0.85rem 1rem;
  border-radius: 6px;
}

.loading-state-mark {
  width: 0.62rem;
  height: 0.62rem;
  margin-top: 0.35rem;
  border-radius: 50%;
  background: rgb(var(--c-cyan));
  box-shadow: 0 0 12px rgb(var(--c-cyan) / 0.55);
}

.loading-state-body {
  display: grid;
  gap: 0.42rem;
  min-width: 0;
}

.loading-state h2,
.loading-state p {
  margin: 0;
}

.loading-state h2 {
  color: rgb(var(--c-text-soft));
  font-size: 0.86rem;
  font-weight: 800;
  line-height: 1.35;
}

.loading-state p {
  color: rgb(var(--c-text-muted));
  font-size: 0.78rem;
  line-height: 1.45;
}

.loading-state.is-error {
  border-color: rgb(var(--c-danger) / 0.36);
  background: rgb(var(--c-danger) / 0.08);
}

.loading-state.is-error .loading-state-mark {
  background: rgb(var(--c-danger));
  box-shadow: 0 0 12px rgb(var(--c-danger) / 0.45);
}

.loading-state.is-error h2,
.loading-state.is-error p {
  color: rgb(253, 164, 175);
}
</style>
