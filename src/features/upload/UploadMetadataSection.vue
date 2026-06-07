<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';

import LocationSearch from '@/features/images/LocationSearch.vue';
import type { GeocodeRegion, GeocodeResult } from '@/features/images/geocode.api';
import type { MapLoadState } from './useUploadPickMap';
import type { UploadEntry } from './useUploadQueue';

defineProps<{
  currentEntry: UploadEntry | null;
  displayEntry: UploadEntry;
  hasCurrent: boolean;
  mapLoadState: MapLoadState;
  pickRegion: GeocodeRegion;
}>();

const emit = defineEmits<{
  applyLocationSearchResult: [result: GeocodeResult];
  clearLocation: [];
  mapElement: [element: HTMLElement | null];
  searchRegionChange: [region: GeocodeRegion];
  setLocationPublic: [entry: UploadEntry, checked: boolean];
  triggerAi: [];
  updateLat: [event: Event];
  updateLng: [event: Event];
}>();

const setMapElement = (element: Element | ComponentPublicInstance | null) => {
  emit('mapElement', element as HTMLElement | null);
};
</script>

<template>
  <section class="meta-section meta-section-form">
    <header class="meta-section-title meta-section-title-pink form-header">
      <span class="form-title">
        <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z" /></svg>
        <span>当前图片信息</span>
      </span>
      <button
        type="button"
        class="ai-preview-button"
        :disabled="!currentEntry?.compressedFile || currentEntry?.aiStatus === 'pending'"
        @click="emit('triggerAi')"
      >
        {{ currentEntry?.aiStatus === 'pending' ? 'AI 分析中' : '重新 AI 分析' }}
      </button>
    </header>
    <p v-if="currentEntry?.aiError" class="ai-error">{{ currentEntry.aiError }}</p>
    <label class="field">
      <span class="field-label">标题</span>
      <input v-model="displayEntry.meta.title" type="text" class="cyber-input" :disabled="!hasCurrent" />
    </label>
    <label class="field">
      <span class="field-label">描述</span>
      <textarea v-model="displayEntry.meta.caption" rows="3" class="cyber-input" :disabled="!hasCurrent"></textarea>
    </label>
    <label class="field">
      <span class="field-label">标签</span>
      <input
        v-model="displayEntry.meta.tags"
        type="text"
        class="cyber-input"
        placeholder="用逗号分隔，例如：猫, 夜景"
        :disabled="!hasCurrent"
      />
    </label>
    <label class="field">
      <span class="field-label">主色调</span>
      <input
        v-model="displayEntry.meta.dominant_color"
        type="text"
        class="cyber-input"
        placeholder="例如：暮光橙 #F59E0B"
        :disabled="!hasCurrent"
      />
    </label>
    <label class="field">
      <span class="field-label">色板</span>
      <input
        v-model="displayEntry.meta.palette"
        type="text"
        class="cyber-input"
        placeholder="用逗号分隔，例如：#F59E0B, #0F172A"
        :disabled="!hasCurrent"
      />
    </label>
    <label class="field">
      <span class="field-label">构图</span>
      <textarea v-model="displayEntry.meta.composition" rows="2" class="cyber-input" :disabled="!hasCurrent"></textarea>
    </label>
    <label class="field">
      <span class="field-label">搜索文本</span>
      <textarea v-model="displayEntry.meta.search_content" rows="2" class="cyber-input" :disabled="!hasCurrent"></textarea>
    </label>
    <label class="field">
      <span class="field-label">位置名称</span>
      <input
        v-model="displayEntry.meta.location_name"
        type="text"
        class="cyber-input"
        placeholder="例如：上海 外滩"
        :disabled="!hasCurrent"
      />
    </label>

    <div class="map-block">
      <div class="map-block-header">
        <span class="field-label">地图坐标</span>
        <label
          class="visibility-inline"
          :class="{
            'is-on': displayEntry.meta.location_public === 1,
            'is-disabled':
              !hasCurrent ||
              displayEntry.meta.location_lat === null ||
              displayEntry.meta.location_lng === null,
          }"
          :title="
            !hasCurrent
              ? '请先选择图片'
              : displayEntry.meta.location_lat === null || displayEntry.meta.location_lng === null
                ? '未设置坐标'
                : displayEntry.meta.location_public === 1
                  ? '访客可见地名和地图标记'
                  : '访客只看到空地图'
          "
        >
          <span class="visibility-inline-label">公开显示位置</span>
          <input
            type="checkbox"
            class="visibility-toggle-input"
            :checked="displayEntry.meta.location_public === 1"
            :disabled="
              !hasCurrent ||
              displayEntry.meta.location_lat === null ||
              displayEntry.meta.location_lng === null
            "
            @change="emit('setLocationPublic', displayEntry, ($event.target as HTMLInputElement).checked)"
          />
          <span class="visibility-inline-switch" aria-hidden="true"></span>
        </label>
        <button
          type="button"
          class="map-clear"
          :disabled="!hasCurrent"
          @click="emit('clearLocation')"
        >
          清空
        </button>
      </div>
      <LocationSearch
        :model-value="pickRegion"
        class="location-search"
        @select="emit('applyLocationSearchResult', $event)"
        @region-change="emit('searchRegionChange', $event)"
      />
      <div :ref="setMapElement" class="map-pane" aria-label="点击地图选择图片位置"></div>
      <p v-if="mapLoadState !== 'ready'" class="map-status">
        正在加载地图
      </p>
      <div class="map-coords">
        <label class="field">
          <span class="field-sublabel">纬度</span>
          <input
            type="number"
            step="0.000001"
            class="cyber-input"
            :value="displayEntry.meta.location_lat ?? ''"
            :disabled="!hasCurrent"
            @input="emit('updateLat', $event)"
          />
        </label>
        <label class="field">
          <span class="field-sublabel">经度</span>
          <input
            type="number"
            step="0.000001"
            class="cyber-input"
            :value="displayEntry.meta.location_lng ?? ''"
            :disabled="!hasCurrent"
            @input="emit('updateLng', $event)"
          />
        </label>
      </div>
    </div>
  </section>
</template>

<style scoped src="./upload-view.css"></style>
