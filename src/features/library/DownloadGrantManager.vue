<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { DownloadGrantRecord } from './library.api';
import { formatDownloadGrantExpiry } from './download-grant-expiry';

const props = defineProps<{
  grants: DownloadGrantRecord[];
  loadingId: string | null;
  error: string | null;
}>();

const emit = defineEmits<{
  update: [id: string, expiresAt: string];
  delete: [id: string];
}>();

const expiresAtById = reactive<Record<string, string>>({});

const toDatetimeLocal = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

watch(
  () => props.grants,
  (grants) => {
    const ids = new Set(grants.map((grant) => grant.id));
    for (const id of Object.keys(expiresAtById)) {
      if (!ids.has(id)) delete expiresAtById[id];
    }
    for (const grant of grants) expiresAtById[grant.id] = toDatetimeLocal(grant.expires_at);
  },
  { immediate: true },
);
</script>

<template>
  <section class="grant-manager" aria-label="验证码管理">
    <header class="grant-manager-header">
      <div>
        <h2>验证码管理</h2>
        <p>{{ grants.length }} 个验证码</p>
      </div>
    </header>

    <p v-if="error" class="grant-manager-error">{{ error }}</p>
    <p v-if="grants.length === 0" class="grant-manager-empty">还没有生成验证码。</p>

    <div v-else class="grant-list">
      <article v-for="grant in grants" :key="grant.id" class="grant-row">
        <header class="grant-row-header">
          <div class="grant-row-main">
            <p class="grant-code">{{ grant.code }}</p>
            <p class="grant-meta">
              {{ grant.image_count }} 张图片 · 生成于 {{ formatDownloadGrantExpiry(grant.created_at) }}
            </p>
          </div>

          <div class="grant-row-actions">
            <label class="grant-expiry-field">
              <span>过期时间</span>
              <input
                v-model="expiresAtById[grant.id]"
                type="datetime-local"
                :disabled="loadingId === grant.id"
              />
            </label>
            <button
              type="button"
              class="grant-action-btn"
              :disabled="loadingId === grant.id"
              @click="emit('update', grant.id, expiresAtById[grant.id])"
            >
              保存
            </button>
            <button
              type="button"
              class="grant-action-btn danger"
              :disabled="loadingId === grant.id"
              @click="emit('delete', grant.id)"
            >
              删除
            </button>
          </div>
        </header>

        <p v-if="grant.images.length === 0" class="grant-images-empty">这个验证码下没有图片。</p>
        <div v-else class="grant-image-strip">
          <figure v-for="image in grant.images" :key="image.key" class="grant-image">
            <img :src="image.public_url" :alt="image.original_filename || image.title || image.key" loading="lazy" />
            <figcaption>{{ image.original_filename || image.title || image.key }}</figcaption>
          </figure>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.grant-manager {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.grant-manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.grant-manager-header h2,
.grant-code,
.grant-image figcaption {
  margin: 0;
}

.grant-manager-header h2 {
  color: white;
  font-size: 1rem;
  font-weight: 900;
}

.grant-manager-header p,
.grant-meta,
.grant-images-empty,
.grant-manager-empty {
  margin: 0.25rem 0 0;
  color: rgba(203, 213, 225, 0.72);
  font-size: 0.78rem;
}

.grant-manager-error {
  margin: 0;
  color: rgb(253, 164, 175);
  font-size: 0.82rem;
}

.grant-manager-empty {
  padding: 1.2rem;
  border: 1px dashed rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  background: rgba(7, 7, 19, 0.45);
  text-align: center;
}

.grant-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.grant-row {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.95rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(7, 7, 19, 0.55);
}

.grant-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.9rem;
}

.grant-row-main {
  min-width: 0;
}

.grant-code {
  color: rgb(187, 247, 208);
  font-family: Menlo, Consolas, monospace;
  font-size: 1.08rem;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.grant-row-actions {
  display: flex;
  align-items: end;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.grant-expiry-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: rgba(165, 243, 252, 0.86);
  font-size: 0.7rem;
  font-weight: 800;
}

.grant-expiry-field input {
  width: 12.5rem;
  height: 32px;
  box-sizing: border-box;
  border: 1px solid rgba(53, 243, 255, 0.22);
  border-radius: 6px;
  background: rgba(9, 14, 28, 0.72);
  color: rgb(226, 232, 240);
  padding: 0 0.5rem;
  font: inherit;
}

.grant-action-btn {
  height: 32px;
  border: 1px solid rgba(53, 243, 255, 0.22);
  border-radius: 6px;
  background: rgba(53, 243, 255, 0.12);
  color: rgb(165, 243, 252);
  padding: 0 0.75rem;
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
}

.grant-action-btn:disabled,
.grant-expiry-field input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.grant-action-btn.danger {
  border-color: rgba(251, 113, 133, 0.4);
  background: rgba(251, 113, 133, 0.08);
  color: rgb(253, 164, 175);
}

.grant-image-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
  gap: 0.55rem;
}

.grant-image {
  min-width: 0;
  margin: 0;
}

.grant-image img {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 6px;
  object-fit: cover;
}

.grant-image figcaption {
  margin-top: 0.35rem;
  overflow: hidden;
  color: rgba(226, 232, 240, 0.82);
  font-size: 0.72rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .grant-row-header {
    align-items: stretch;
    flex-direction: column;
  }

  .grant-row-actions {
    justify-content: flex-start;
  }

  .grant-expiry-field,
  .grant-expiry-field input {
    width: 100%;
  }
}
</style>
