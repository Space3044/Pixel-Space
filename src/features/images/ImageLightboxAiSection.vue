<script setup lang="ts">
import { isAdmin } from '@/shared/auth/useAdmin';
import { ICONS } from './image-lightbox-icons';
import type { ImageRecord } from './image.types';
import type { ImageLightboxEditForm } from './useImageLightboxEditForm';

defineProps<{
  image: ImageRecord;
  aiEditOpen: boolean;
  saving: boolean;
  deleting: boolean;
  aiPreviewing: boolean;
  actionError: string | null;
  editForm: ImageLightboxEditForm;
  aiTags: string[];
  aiPalette: string[];
  dominantColor: { name: string; hex: string };
}>();

const emit = defineEmits<{
  cancelAiEditor: [];
  rerunAiAnalysis: [];
  saveAiMetadata: [];
  toggleAiEditor: [];
}>();
</script>

<template>
  <section class="detail-section">
    <div class="section-title section-title-with-action">
      <span class="section-title-label">
        <svg :viewBox="ICONS.robot.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.robot.d" /></svg>
        <span>AI 分析</span>
      </span>
      <span v-if="isAdmin" class="section-actions">
        <button
          v-if="isAdmin && aiEditOpen"
          type="button"
          class="ai-preview-button"
          :disabled="saving || deleting || aiPreviewing"
          @click="emit('rerunAiAnalysis')"
        >
          {{ aiPreviewing ? 'AI 分析中' : '重新 AI 分析' }}
        </button>
        <button
          type="button"
          class="ai-edit-button"
          :disabled="saving || deleting || aiPreviewing"
          @click="emit('toggleAiEditor')"
        >
          {{ aiEditOpen ? '收起' : '编辑' }}
        </button>
      </span>
    </div>
    <p v-if="aiEditOpen && actionError" class="action-error ai-action-error">{{ actionError }}</p>
    <div class="detail-items">
      <div class="detail-item">
        <span class="item-label">标题</span>
        <span class="item-value text-truncate">{{ image.title || '未命名图片' }}</span>
      </div>
      <div class="detail-item is-column">
        <span class="item-label">描述</span>
        <p v-if="image.caption" class="item-description">{{ image.caption }}</p>
        <p v-else class="item-description text-muted">暂无描述</p>
      </div>
      <div class="detail-item is-column">
        <span class="item-label">标签</span>
        <div v-if="aiTags.length" class="tag-list">
          <span v-for="tag in aiTags" :key="tag" class="tag-pill">{{ tag }}</span>
        </div>
        <p v-else class="item-description text-muted">暂无标签</p>
      </div>
      <div class="detail-item">
        <span class="item-label">主色调</span>
        <span
          v-if="image.dominant_color"
          class="dominant-color-value"
          :title="dominantColor.hex || image.dominant_color"
        >
          <span
            v-if="dominantColor.hex"
            class="palette-chip dominant-color-chip"
            :style="{ backgroundColor: dominantColor.hex }"
            aria-hidden="true"
          />
          <span class="dominant-color-name">{{ dominantColor.name }}</span>
        </span>
        <span v-else class="item-value text-muted">未记录</span>
      </div>
      <div class="detail-item is-column">
        <span class="item-label">色板</span>
        <div v-if="aiPalette.length" class="palette-list">
          <span
            v-for="color in aiPalette"
            :key="color"
            class="palette-chip"
            :style="{ backgroundColor: color }"
            :title="color"
          />
        </div>
        <p v-else class="item-description text-muted">暂无色板</p>
      </div>
      <div class="detail-item is-column">
        <span class="item-label">构图</span>
        <p v-if="image.composition" class="item-description">{{ image.composition }}</p>
        <p v-else class="item-description text-muted">未记录</p>
      </div>
    </div>
    <form v-if="aiEditOpen" class="ai-edit-form" @submit.prevent="emit('saveAiMetadata')">
      <label class="edit-field">
        <span>标题</span>
        <input v-model="editForm.title" type="text" />
      </label>
      <label class="edit-field">
        <span>描述</span>
        <textarea v-model="editForm.caption" rows="3" />
      </label>
      <label class="edit-field">
        <span>标签</span>
        <textarea v-model="editForm.tags" rows="2" placeholder="用逗号或换行分隔" />
      </label>
      <label class="edit-field">
        <span>搜索内容</span>
        <textarea v-model="editForm.search_content" rows="3" />
      </label>
      <label class="edit-field">
        <span>主色调</span>
        <input v-model="editForm.dominant_color" type="text" placeholder="暮光橙 #F59E0B" />
      </label>
      <label class="edit-field">
        <span>色板</span>
        <textarea v-model="editForm.palette" rows="2" placeholder="用逗号或换行分隔 HEX" />
      </label>
      <label class="edit-field">
        <span>构图</span>
        <textarea v-model="editForm.composition" rows="2" />
      </label>
      <div class="edit-actions">
        <button type="submit" class="action-btn" :disabled="saving || deleting || aiPreviewing">
          {{ saving ? '保存中…' : '保存' }}
        </button>
        <button type="button" class="action-btn muted" :disabled="saving || deleting || aiPreviewing" @click="emit('cancelAiEditor')">
          取消
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped src="./image-lightbox.css"></style>
