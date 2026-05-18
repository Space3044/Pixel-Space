<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue';
import AppShell from '@/shared/ui/AppShell.vue';
// 阶段 5：在这里调用 GET /api/list，把数据填进 items
// 阶段 11：搜索状态来自 AppShell 全局搜索框（query 参数或 store）
// 空数据时切换为「暂无公开图片」文案，等阶段 5 用 v-if 接入

const ImageLightbox = defineAsyncComponent(() => import('./ImageLightbox.vue'));

const aspects = ['3/4', '4/3', '1/1', '2/3', '16/9', '4/5', '5/4', '3/5'];
const skeletons = Array.from({ length: 36 }, (_, i) => aspects[i % aspects.length]);

const lightboxOpen = ref(false);
</script>

<template>
  <AppShell fluid>
    <section class="space-y-4">
      <header class="space-y-1 px-1">
        <p class="text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">Gallery</p>
        <h1 class="text-2xl font-black text-white sm:text-3xl">公开图库</h1>
      </header>

      <div class="columns-2 gap-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 2xl:columns-7">
        <button
          v-for="(aspect, i) in skeletons"
          :key="i"
          type="button"
          class="group mb-2 block w-full break-inside-avoid focus:outline-none"
          @click="lightboxOpen = true"
        >
          <div
            class="overflow-hidden rounded-lg border border-white/10 bg-void/60 transition group-hover:border-neon-cyan/50 group-hover:shadow-[0_4px_20px_rgba(53,243,255,0.15)]"
            :style="{ aspectRatio: aspect }"
          ></div>
        </button>
      </div>
    </section>

    <ImageLightbox :open="lightboxOpen" @close="lightboxOpen = false" />
  </AppShell>
</template>
