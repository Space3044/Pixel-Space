<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
import justifiedLayout from 'justified-layout';
import AppShell from '@/shared/ui/AppShell.vue';
import type { ImageRecord } from './image.types';
import { listImages } from './images.api';

const ImageLightbox = defineAsyncComponent(() => import('./ImageLightbox.vue'));

const images = ref<ImageRecord[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);

const lightboxOpen = ref(false);
const lightboxImage = ref<ImageRecord | null>(null);

const layout = computed(() => {
  if (images.value.length === 0 || containerWidth.value === 0) {
    return { boxes: [], containerHeight: 0, widowCount: 0 };
  }
  return justifiedLayout(
    images.value.map((img) => ({ width: img.width, height: img.height })),
    {
      containerWidth: containerWidth.value,
      targetRowHeight: 240,
      boxSpacing: 8,
      containerPadding: 0,
    },
  );
});

let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.offsetWidth;
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) containerWidth.value = entry.contentRect.width;
    });
    resizeObserver.observe(containerRef.value);
  }

  try {
    images.value = await listImages();
  } catch (e) {
    loadError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

const openLightbox = (img: ImageRecord) => {
  lightboxImage.value = img;
  lightboxOpen.value = true;
};
</script>

<template>
  <AppShell fluid>
    <section class="space-y-4">
      <header class="space-y-1 px-1">
        <p class="text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">Gallery</p>
        <h1 class="text-2xl font-black text-white sm:text-3xl">公开图库</h1>
      </header>

      <div
        ref="containerRef"
        class="relative w-full"
        :style="{ height: layout.containerHeight + 'px', minHeight: loading ? '12rem' : '0' }"
      >
        <button
          v-for="(box, i) in layout.boxes"
          :key="images[i].key"
          type="button"
          class="group absolute overflow-hidden rounded-lg border border-white/10 bg-void/60 transition hover:border-neon-cyan/50 hover:shadow-[0_4px_20px_rgba(53,243,255,0.15)] focus:outline-none focus:ring-2 focus:ring-neon-cyan/60"
          :style="{
            top: box.top + 'px',
            left: box.left + 'px',
            width: box.width + 'px',
            height: box.height + 'px',
          }"
          :aria-label="images[i].title || images[i].key"
          @click="openLightbox(images[i])"
        >
          <img
            :src="images[i].public_url"
            :alt="images[i].title"
            loading="lazy"
            class="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        </button>
      </div>

      <p v-if="loading" class="px-1 text-sm text-slate-500">加载中…</p>
      <p v-else-if="loadError" class="px-1 text-sm text-rose-400">加载失败：{{ loadError }}</p>
      <p v-else-if="images.length === 0" class="px-1 text-sm text-slate-500">还没有公开图片。</p>
    </section>

    <ImageLightbox :open="lightboxOpen" :image="lightboxImage" @close="lightboxOpen = false" />
  </AppShell>
</template>
