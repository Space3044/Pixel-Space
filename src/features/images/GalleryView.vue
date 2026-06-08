<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import justifiedLayout from 'justified-layout';
import AppShell from '@/shared/ui/AppShell.vue';
import LoadingState from '@/shared/ui/LoadingState.vue';
import SelectPopover from '@/shared/ui/SelectPopover.vue';
import type { ImageRecord } from './image.types';
import { imageSortOptions, sortImagesByMode, type ImageSortMode } from './image-sort';
import { listImagesPage } from './images.api';
import { fetchFolders, type FolderRecord } from '@/features/library/library.api';
import FolderPickerPopover from './FolderPickerPopover.vue';

const ImageLightbox = defineAsyncComponent(() => import('./ImageLightbox.vue'));
const GALLERY_PAGE_SIZE = 48;

const images = ref<ImageRecord[]>([]);
const loading = ref(true);
const loadingMore = ref(false);
const loadError = ref<string | null>(null);
const folderLoadError = ref<string | null>(null);
const searchQuery = ref('');
const nextCursor = ref<string | null>(null);

const sortMode = ref<ImageSortMode>('created-desc');

// 文件夹筛选状态：
//   '' 表示「全部」（不传 folder 参数）
//   '__none__' 表示「未分类」
//   其它字符串为 folder.id
const folderFilter = ref<string>('');
const folders = ref<FolderRecord[]>([]);

const containerRef = ref<HTMLElement | null>(null);
const loadMoreSentinelRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);

const lightboxOpen = ref(false);
const lightboxImage = ref<ImageRecord | null>(null);

const hasMore = computed(() => nextCursor.value !== null);
const countLabel = computed(() => `${images.value.length}${hasMore.value ? '+' : ''}`);

const resultLabel = computed(() => {
  if (loading.value) return '同步中';
  if (searchQuery.value.trim()) return `${countLabel.value} 个结果`;
  return `${countLabel.value} 张图片`;
});

const displayImages = computed<ImageRecord[]>(() => sortImagesByMode(images.value, sortMode.value));

const layout = computed(() => {
  if (displayImages.value.length === 0 || containerWidth.value === 0) {
    return { boxes: [], containerHeight: 0, widowCount: 0 };
  }
  return justifiedLayout(
    displayImages.value.map((img) => ({ width: img.width, height: img.height })),
    {
      containerWidth: containerWidth.value,
      targetRowHeight: 240,
      boxSpacing: 8,
      containerPadding: 0,
    },
  );
});

const folderFilterToOptions = () => {
  if (folderFilter.value === '') return undefined;
  if (folderFilter.value === '__none__') return null;
  return folderFilter.value;
};

const loadImages = async () => {
  loading.value = true;
  loadError.value = null;
  nextCursor.value = null;
  try {
    const folderId = folderFilterToOptions();
    const page = await listImagesPage(searchQuery.value, { folderId, limit: GALLERY_PAGE_SIZE });
    images.value = page.items;
    nextCursor.value = page.nextCursor;
  } catch (e) {
    loadError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
};

const loadMoreImages = async () => {
  if (!nextCursor.value || loading.value || loadingMore.value) return;
  loadingMore.value = true;
  loadError.value = null;
  try {
    const folderId = folderFilterToOptions();
    const page = await listImagesPage(searchQuery.value, {
      folderId,
      limit: GALLERY_PAGE_SIZE,
      cursor: nextCursor.value,
    });
    images.value = [...images.value, ...page.items];
    nextCursor.value = page.nextCursor;
  } catch (e) {
    loadError.value = (e as Error).message;
  } finally {
    loadingMore.value = false;
  }
};

const maybeAutoLoadMore = () => {
  if (!hasMore.value || loading.value || loadingMore.value || loadError.value) return;
  void loadMoreImages();
};

const loadFolders = async () => {
  folderLoadError.value = null;
  try {
    folders.value = await fetchFolders();
  } catch (error) {
    folderLoadError.value = (error as Error).message;
  }
};

let resizeObserver: ResizeObserver | null = null;
let loadMoreObserver: IntersectionObserver | null = null;

const observeLoadMoreSentinel = (element: HTMLElement | null) => {
  loadMoreObserver?.disconnect();
  loadMoreObserver = null;
  if (!element || typeof IntersectionObserver === 'undefined') return;

  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) maybeAutoLoadMore();
    },
    { rootMargin: '600px 0px' },
  );
  loadMoreObserver.observe(element);
};

onMounted(async () => {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.offsetWidth;
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) containerWidth.value = entry.contentRect.width;
    });
    resizeObserver.observe(containerRef.value);
  }

  await Promise.all([loadFolders(), loadImages()]);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  loadMoreObserver?.disconnect();
  loadMoreObserver = null;
});

watch(loadMoreSentinelRef, observeLoadMoreSentinel, { flush: 'post' });

// 切换文件夹时立刻重新拉取，跟刷新一致。
watch(folderFilter, () => {
  void loadImages();
});

const openLightbox = (img: ImageRecord) => {
  lightboxImage.value = img;
  lightboxOpen.value = true;
};

const showAdjacentImage = (offset: -1 | 1) => {
  const items = displayImages.value;
  if (!lightboxImage.value || items.length === 0) return;
  const currentIndex = items.findIndex((item) => item.key === lightboxImage.value?.key);
  if (currentIndex === -1) return;
  const nextIndex = (currentIndex + offset + items.length) % items.length;
  lightboxImage.value = items[nextIndex];
};

const showPreviousImage = () => showAdjacentImage(-1);
const showNextImage = () => showAdjacentImage(1);

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
          <SelectPopover v-model="sortMode" :options="imageSortOptions" aria-label="排序方式">
            <template #leading-icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="leading-icon" aria-hidden="true">
                <path d="M3 6h13" />
                <path d="M3 12h9" />
                <path d="M3 18h5" />
                <path d="m17 8 4 4-4 4" />
                <path d="M21 12H10" />
              </svg>
            </template>
          </SelectPopover>
          <FolderPickerPopover v-model="folderFilter" :folders="folders" />
          <form class="gallery-search" @submit.prevent="loadImages">
            <input
              v-model="searchQuery"
              type="search"
              class="gallery-search-input"
              placeholder="搜索标题、描述、文件名或位置"
              aria-label="搜索标题、描述、文件名或位置"
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
        class="gallery-stage relative w-full"
        :style="{ height: layout.containerHeight + 'px', minHeight: loading ? '12rem' : '0' }"
      >
        <div v-if="loading" class="gallery-loading" role="status" aria-live="polite">
          <span>加载中</span>
          <div class="gallery-loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <button
          v-for="(box, i) in layout.boxes"
          :key="displayImages[i].key"
          type="button"
          class="group absolute overflow-hidden rounded-lg border border-white/10 bg-void/60 transition-all duration-300 ease-out hover:z-10 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_10px_28px_rgba(0,0,0,0.45),0_0_24px_rgba(53,243,255,0.08)] focus:outline-none focus:ring-2 focus:ring-neon-cyan/60"
          :style="{
            top: box.top + 'px',
            left: box.left + 'px',
            width: box.width + 'px',
            height: box.height + 'px',
          }"
          :aria-label="displayImages[i].title || displayImages[i].key"
          @click="openLightbox(displayImages[i])"
        >
          <img
            :src="displayImages[i].public_url"
            :alt="displayImages[i].title"
            loading="lazy"
            class="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          />
          <div
            class="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-void/92 via-void/55 to-transparent px-3 pb-2 pt-7 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100"
          >
            <p class="truncate text-xs font-semibold tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
              {{ displayImages[i].title || displayImages[i].original_filename }}
            </p>
          </div>
        </button>
      </div>

      <p v-if="folderLoadError" class="px-1 text-sm text-rose-400">文件夹加载失败：{{ folderLoadError }}</p>
      <LoadingState v-if="!loading && loadError" class="gallery-loading-state" title="图库加载失败" :error="loadError" />
      <p v-else-if="images.length === 0" class="px-1 text-sm text-slate-500">还没有公开图片。</p>
      <div v-if="hasMore && !loadError" class="load-more-row">
        <div ref="loadMoreSentinelRef" class="load-more-sentinel" aria-hidden="true" />
        <button
          type="button"
          class="load-more-button"
          :disabled="loading || loadingMore"
          @click="loadMoreImages"
        >
          {{ loadingMore ? '加载中…' : '加载更多' }}
        </button>
      </div>
    </section>

    <ImageLightbox
      :open="lightboxOpen"
      :image="lightboxImage"
      @close="lightboxOpen = false"
      @prev="showPreviousImage"
      @next="showNextImage"
      @updated="replaceImage"
      @deleted="removeImage"
    />
  </AppShell>
</template>

<style scoped>
.explore-header {
  position: relative;
  z-index: 20;
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

.leading-icon {
  width: 14px;
  height: 14px;
  color: rgba(165, 243, 252, 0.85);
  flex-shrink: 0;
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

.gallery-stage {
  isolation: isolate;
}

.gallery-loading {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  color: rgba(226, 232, 240, 0.92);
  font-size: 0.86rem;
  font-weight: 800;
  letter-spacing: 0;
  pointer-events: none;
}

.gallery-loading-dots {
  display: inline-flex;
  align-items: center;
  gap: 0.22rem;
}

.gallery-loading-dots span {
  width: 0.32rem;
  height: 0.32rem;
  border-radius: 999px;
  background: rgb(53, 243, 255);
  box-shadow: 0 0 10px rgba(53, 243, 255, 0.55);
  animation: gallery-dot-jump 1.05s ease-in-out infinite;
}

.gallery-loading-dots span:nth-child(2) {
  animation-delay: 0.14s;
}

.gallery-loading-dots span:nth-child(3) {
  animation-delay: 0.28s;
}

@media (prefers-reduced-motion: reduce) {
  .gallery-loading-dots span {
    animation: none;
  }
}

.gallery-loading-state {
  width: min(100%, 22rem);
  margin: 3.5rem auto;
}

@keyframes gallery-dot-jump {
  0%,
  80%,
  100% {
    opacity: 0.45;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-0.34rem);
  }
}

.load-more-row {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 0.25rem 0 1rem;
}

.load-more-sentinel {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.load-more-button {
  min-width: 9rem;
  height: 36px;
  border: 1px solid rgba(53, 243, 255, 0.22);
  border-radius: 6px;
  background: rgba(53, 243, 255, 0.08);
  color: rgb(165, 243, 252);
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

.load-more-button:hover:not(:disabled) {
  border-color: rgba(53, 243, 255, 0.62);
  color: white;
}

.load-more-button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
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
