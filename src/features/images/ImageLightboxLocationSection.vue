<script setup lang="ts">
import { isAdmin } from '@/shared/auth/useAdmin';
import type { MapRegion } from '@/features/upload/map-coordinate';
import LocationSearch from './LocationSearch.vue';
import ReadOnlyMap from './ReadOnlyMap.vue';
import type { GeocodeRegion, GeocodeResult } from './geocode.api';
import { ICONS } from './image-lightbox-icons';
import type { ImageRecord } from './image.types';
import type { ImageLightboxEditForm } from './useImageLightboxEditForm';

defineProps<{
  image: ImageRecord;
  locationEditOpen: boolean;
  saving: boolean;
  deleting: boolean;
  actionError: string | null;
  editForm: ImageLightboxEditForm;
  editSearchRegion: GeocodeRegion;
  hasCoordinates: boolean;
  mapLat: number | null;
  mapLng: number | null;
  mapRegion: MapRegion | null;
}>();

const emit = defineEmits<{
  applyLocationSearchResult: [result: GeocodeResult];
  cancelLocationEditor: [];
  editSearchRegionChange: [region: GeocodeRegion];
  saveLocation: [];
  saveVisibilityFlag: [field: 'is_public' | 'location_public', value: 0 | 1];
  syncEditRegionFromSearch: [];
  toggleLocationEditor: [];
  updateLocationFromMap: [coords: { lat: number; lng: number }];
}>();
</script>

<template>
  <section class="detail-section">
    <div class="section-title section-title-with-action">
      <span class="section-title-label">
        <svg :viewBox="ICONS.mapPin.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.mapPin.d" /></svg>
        <span>位置</span>
      </span>
      <button
        v-if="isAdmin"
        type="button"
        class="location-edit-button"
        :disabled="saving || deleting"
        @click="emit('toggleLocationEditor')"
      >
        {{ locationEditOpen ? '收起' : '编辑位置' }}
      </button>
    </div>

    <div class="detail-items location-display">
      <div class="detail-item">
        <span class="item-label">位置</span>
        <span class="item-value text-truncate" :class="{ 'text-muted': !image.location_name }">
          {{ image.location_name || '未记录' }}
        </span>
      </div>
      <div class="detail-item">
        <span class="item-label">经纬度</span>
        <span v-if="hasCoordinates" class="item-value font-mono">
          {{ image.location_lat }}, {{ image.location_lng }}
        </span>
        <span v-else class="item-value text-muted">未记录</span>
      </div>
      <div v-if="isAdmin" class="detail-item">
        <span class="item-label">位置可见</span>
        <span class="item-value">
          <label
            class="inline-flag"
            :class="{
              'is-on': image.location_public !== 0,
              'is-busy': saving,
              'is-disabled': !hasCoordinates,
            }"
            :title="!hasCoordinates ? '未设置坐标，开关不生效' : image.location_public !== 0 ? '点击隐藏位置' : '点击对访客公开位置'"
          >
            <input
              type="checkbox"
              class="inline-flag-input"
              :checked="image.location_public !== 0"
              :disabled="!hasCoordinates || saving || deleting"
              @change="emit('saveVisibilityFlag', 'location_public', ($event.target as HTMLInputElement).checked ? 1 : 0)"
            />
            <span class="inline-flag-switch" aria-hidden="true"></span>
            <span class="inline-flag-text">
              {{ !hasCoordinates ? '无坐标' : image.location_public !== 0 ? '公开' : '仅自己' }}
            </span>
          </label>
        </span>
      </div>
    </div>
    <ReadOnlyMap
      class="mt-3"
      :lat="mapLat"
      :lng="mapLng"
      :region="mapRegion"
      :label="image.location_name || image.title"
      :interactive="locationEditOpen"
      :admin="isAdmin"
      @pick="emit('updateLocationFromMap', $event)"
    />

    <form v-if="locationEditOpen" class="location-edit-form" @submit.prevent="emit('saveLocation')">
      <LocationSearch
        :model-value="editSearchRegion"
        @select="emit('applyLocationSearchResult', $event)"
        @region-change="emit('editSearchRegionChange', $event)"
      />
      <label class="edit-field">
        <span>位置名</span>
        <input v-model="editForm.location_name" type="text" />
      </label>
      <div class="edit-grid">
        <label class="edit-field">
          <span>纬度</span>
          <input v-model="editForm.location_lat" type="number" step="any" min="-90" max="90" @change="emit('syncEditRegionFromSearch')" />
        </label>
        <label class="edit-field">
          <span>经度</span>
          <input v-model="editForm.location_lng" type="number" step="any" min="-180" max="180" @change="emit('syncEditRegionFromSearch')" />
        </label>
      </div>
      <label
        class="edit-toggle"
        :class="{
          'is-on': editForm.location_public === 1,
          'is-disabled': editForm.location_lat === '' || editForm.location_lng === '',
        }"
      >
        <span class="edit-toggle-text">
          <span class="edit-toggle-title">公开显示位置</span>
          <span class="edit-toggle-hint">
            {{
              editForm.location_lat === '' || editForm.location_lng === ''
                ? '未设置坐标，开关不生效'
                : editForm.location_public === 1
                  ? '访客可见地名和地图标记'
                  : '访客只看到一张空地图'
            }}
          </span>
        </span>
        <input
          type="checkbox"
          class="edit-toggle-input"
          :checked="editForm.location_public === 1"
          :disabled="editForm.location_lat === '' || editForm.location_lng === ''"
          @change="editForm.location_public = ($event.target as HTMLInputElement).checked ? 1 : 0"
        />
        <span class="edit-toggle-switch" aria-hidden="true"></span>
      </label>
      <p v-if="actionError" class="action-error">{{ actionError }}</p>
      <div class="edit-actions">
        <button type="submit" class="action-btn" :disabled="saving || deleting">
          {{ saving ? '保存中…' : '保存位置' }}
        </button>
        <button type="button" class="action-btn muted" :disabled="saving || deleting" @click="emit('cancelLocationEditor')">
          取消
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped src="./image-lightbox.css"></style>
