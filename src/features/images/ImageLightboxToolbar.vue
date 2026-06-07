<script setup lang="ts">
import { isAdmin } from '@/shared/auth/useAdmin';
import type { ImageRecord } from './image.types';
import { ICONS } from './image-lightbox-icons';

defineProps<{
  image?: ImageRecord | null;
  copied: boolean;
  detailsOpen: boolean;
  originalUrl: string;
  saving: boolean;
  deleting: boolean;
}>();

const emit = defineEmits<{
  close: [];
  delete: [];
  share: [];
  toggleDetails: [];
}>();
</script>

<template>
  <header class="navigation-bar">
    <button type="button" class="viewer-esc-button" aria-label="关闭（ESC）" @click="emit('close')">ESC</button>

    <div class="nav-actions">
      <button
        type="button"
        class="viewer-action-btn"
        :class="{ 'is-success': copied }"
        title="复制分享链接"
        :aria-label="copied ? '分享链接已复制' : '复制分享链接'"
        :disabled="!image"
        @click="emit('share')"
      >
        <svg
          :viewBox="copied ? ICONS.check.vb : ICONS.share.vb"
          fill="currentColor"
          class="h-4 w-4"
          aria-hidden="true"
        >
          <path :d="copied ? ICONS.check.d : ICONS.share.d" />
        </svg>
      </button>
      <button
        type="button"
        class="viewer-action-btn"
        :class="{ 'is-active': detailsOpen }"
        title="详情"
        :aria-label="detailsOpen ? '关闭详情面板' : '查看详情'"
        :disabled="!image"
        @click="emit('toggleDetails')"
      >
        <svg :viewBox="ICONS.info.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.info.d" /></svg>
      </button>
      <a
        v-if="image && isAdmin"
        class="viewer-action-btn"
        :href="originalUrl"
        target="_blank"
        rel="noreferrer"
        title="下载原图"
        aria-label="下载原图"
      >
        <svg :viewBox="ICONS.download.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.download.d" /></svg>
      </a>
      <button v-else-if="isAdmin" type="button" class="viewer-action-btn" title="下载原图" aria-label="下载原图" disabled>
        <svg :viewBox="ICONS.download.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.download.d" /></svg>
      </button>
      <button
        v-if="isAdmin"
        type="button"
        class="viewer-action-btn danger"
        title="删除图片"
        aria-label="删除图片"
        :disabled="!image || saving || deleting"
        @click="emit('delete')"
      >
        <svg :viewBox="ICONS.trash.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.trash.d" /></svg>
      </button>
    </div>
  </header>
</template>

<style scoped src="./image-lightbox.css"></style>
