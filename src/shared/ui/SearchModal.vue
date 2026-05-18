<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

const emit = defineEmits<{
  close: [];
}>();

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  document.body.style.overflow = 'hidden';
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-start justify-center bg-void/80 p-4 pt-24 backdrop-blur-md"
      @click.self="emit('close')"
    >
      <div class="cyber-panel flex h-[36rem] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] p-6">
        <div class="flex shrink-0 items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 shrink-0 text-neon-cyan" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="搜索标题、描述、标签..."
            class="cyber-input flex-1"
            disabled
          />
          <button
            type="button"
            class="shrink-0 rounded-lg border border-white/10 px-2 py-1 font-mono text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
            @click="emit('close')"
          >
            ESC
          </button>
        </div>
        <div class="mt-6 flex flex-1 items-center justify-center overflow-y-auto">
          <p class="text-sm text-slate-500">阶段 11 接入后这里展示搜索结果</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
