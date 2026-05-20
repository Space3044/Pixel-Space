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
const searchQuery = ref('');

const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);

const lightboxOpen = ref(false);
const lightboxImage = ref<ImageRecord | null>(null);

const resultLabel = computed(() => {
  if (loading.value) return '同步中';
  if (searchQuery.value.trim()) return `${images.value.length} 个结果`;
  return `${images.value.length} 张图片`;
});

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

const loadImages = async () => {
  loading.value = true;
  loadError.value = null;
  try {
    images.value = await listImages(searchQuery.value);
  } catch (e) {
    loadError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
};

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

  await loadImages();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

const openLightbox = (img: ImageRecord) => {
  lightboxImage.value = img;
  lightboxOpen.value = true;
};

const replaceImage = (img: ImageRecord) => {
  images.value = images.value.map((item) => (item.key === img.key ? img : item));
  lightboxImage.value = img;
};

const removeImage = (key: string) => {
  images.value = images.value.filter((item) => item.key !== key);
  lightboxOpen.value = false;
  lightboxImage.value = null;
};

const clearSearch = async () => {
  if (!searchQuery.value) return;
  searchQuery.value = '';
  await loadImages();
};
</script>

<template>
  <AppShell fluid>
    <section class="space-y-4">
      <header class="explore-header">
        <div class="explore-title">
          <h1>探索</h1>
          <p>发现公开图片</p>
        </div>

        <div class="explore-toolbar" aria-label="图库工具栏">
          <div class="toolbar-segment" aria-label="图库状态">
            <span class="status-dot" aria-hidden="true" />
            <span>{{ resultLabel }}</span>
          </div>
          <button type="button" class="toolbar-icon" aria-label="刷新图库" @click="loadImages">刷新</button>
          <form class="gallery-search" @submit.prevent="loadImages">
            <span class="search-mode">常规</span>
            <input
              v-model="searchQuery"
              type="search"
              class="gallery-search-input"
              placeholder="搜索标题、描述或位置"
              aria-label="搜索标题、描述或位置"
            />
            <button v-if="searchQuery" type="button" class="toolbar-icon" aria-label="清空搜索" @click="clearSearch">
              清空
            </button>
            <button type="submit" class="gallery-search-button">搜索</button>
          </form>
        </div>
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

    <ImageLightbox
      :open="lightboxOpen"
      :image="lightboxImage"
      @close="lightboxOpen = false"
      @updated="replaceImage"
      @deleted="removeImage"
    />
  </AppShell>
</template>

<style scoped>
.explore-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 68px;
  padding: 0.75rem 1.25rem;
  border: 1px solid rgba(53, 243, 255, 0.14);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(53, 243, 255, 0.08), transparent 36%),
    rgba(7, 7, 19, 0.62);
  backdrop-filter: blur(18px);
}

.explore-title {
  min-width: 7rem;
}

.explore-title h1 {
  margin: 0;
  font-size: 1.45rem;
  line-height: 1.1;
  font-weight: 900;
  color: white;
}

.explore-title p {
  margin: 0.2rem 0 0;
  font-size: 0.78rem;
  color: rgba(203, 213, 225, 0.75);
}

.explore-toolbar {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: 0.55rem;
  min-width: 0;
}

.toolbar-segment,
.toolbar-icon,
.search-mode,
.gallery-search-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border: 1px solid rgba(53, 243, 255, 0.18);
  border-radius: 6px;
  background: rgba(9, 14, 28, 0.72);
  padding: 0 0.75rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: rgb(203, 213, 225);
  white-space: nowrap;
}

.toolbar-icon {
  cursor: pointer;
}

.toolbar-icon:hover,
.gallery-search-button:hover {
  border-color: rgba(53, 243, 255, 0.62);
  color: rgb(53, 243, 255);
}

.status-dot {
  width: 7px;
  height: 7px;
  margin-right: 0.45rem;
  border-radius: 999px;
  background: rgb(132, 247, 153);
  box-shadow: 0 0 12px rgba(132, 247, 153, 0.7);
}

.gallery-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: min(100%, 24rem);
}

.gallery-search-input {
  flex: 1;
  min-width: 0;
  border: 1px solid rgba(53, 243, 255, 0.2);
  border-radius: 6px;
  background: rgba(7, 7, 19, 0.72);
  height: 32px;
  padding: 0 0.75rem;
  color: white;
  outline: none;
}

.gallery-search-input:focus {
  border-color: rgba(53, 243, 255, 0.7);
  box-shadow: 0 0 0 2px rgba(53, 243, 255, 0.15);
}

.gallery-search-button {
  background: rgba(53, 243, 255, 0.1);
  color: rgb(165, 243, 252);
}

@media (max-width: 900px) {
  .explore-header {
    align-items: stretch;
    flex-direction: column;
  }
  .explore-toolbar {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  .gallery-search {
    flex: 1 1 100%;
  }
}
</style>
