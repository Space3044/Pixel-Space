<script setup lang="ts">
import { ref, watch } from 'vue';
import type { CreateDownloadGrantResponse } from './library.api';
import {
  DEFAULT_DOWNLOAD_GRANT_PRESET,
  DOWNLOAD_GRANT_EXPIRY_OPTIONS,
  buildDownloadGrantExpiry,
  formatDownloadGrantExpiry,
  type DownloadGrantExpiryPreset,
} from './download-grant-expiry';

const props = defineProps<{
  open: boolean;
  selectedCount: number;
  loading: boolean;
  result: CreateDownloadGrantResponse | null;
  error: string | null;
}>();

const emit = defineEmits<{
  close: [];
  create: [expiresAt: string];
  clear: [];
}>();

const preset = ref<DownloadGrantExpiryPreset>(DEFAULT_DOWNLOAD_GRANT_PRESET);
const customExpiresAt = ref('');
const formError = ref<string | null>(null);
const copiedMessage = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    preset.value = DEFAULT_DOWNLOAD_GRANT_PRESET;
    customExpiresAt.value = '';
    formError.value = null;
    copiedMessage.value = null;
    emit('clear');
  },
);

const submit = () => {
  const expiresAt = buildDownloadGrantExpiry(preset.value, customExpiresAt.value);
  if (!expiresAt) {
    formError.value = '请选择未来的有效期';
    return;
  }
  formError.value = null;
  emit('create', expiresAt);
};

const copyText = async (value: string, label: string) => {
  await navigator.clipboard.writeText(value);
  copiedMessage.value = `${label}已复制`;
};

const buildAccessUrl = () => {
  if (!props.result) return '';
  return new URL(props.result.access_url, window.location.origin).toString();
};
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="grant-dialog-backdrop" role="presentation" @click.self="emit('close')">
      <section class="grant-dialog" role="dialog" aria-modal="true" aria-labelledby="grant-dialog-title">
        <header class="grant-dialog-header">
          <div>
            <h2 id="grant-dialog-title">生成验证码</h2>
            <p>已选 {{ selectedCount }} 张图片</p>
          </div>
          <button type="button" class="grant-icon-btn" aria-label="关闭" @click="emit('close')">×</button>
        </header>

        <form class="grant-dialog-body" @submit.prevent="submit">
          <div class="grant-preset-grid" role="group" aria-label="有效期">
            <label v-for="option in DOWNLOAD_GRANT_EXPIRY_OPTIONS" :key="option.value" class="grant-preset">
              <input v-model="preset" type="radio" :value="option.value" />
              <span>{{ option.label }}</span>
            </label>
          </div>

          <label v-if="preset === 'custom'" class="grant-field">
            <span>自定义有效期</span>
            <input v-model="customExpiresAt" type="datetime-local" />
          </label>

          <p v-if="formError || error" class="grant-error">{{ formError || error }}</p>

          <div v-if="props.result" class="grant-result">
            <span class="grant-code">{{ props.result.code }}</span>
            <p>{{ props.result.image_count }} 张图片 · {{ formatDownloadGrantExpiry(props.result.expires_at) }}</p>
            <div class="grant-result-actions">
              <button type="button" @click="copyText(props.result.code, '验证码')">复制验证码</button>
              <button type="button" @click="copyText(buildAccessUrl(), '入口')">复制入口</button>
            </div>
            <p v-if="copiedMessage" class="grant-copy-message" aria-live="polite">{{ copiedMessage }}</p>
          </div>

          <footer class="grant-dialog-actions">
            <button type="button" @click="emit('close')">取消</button>
            <button type="submit" :disabled="loading || selectedCount === 0">
              {{ loading ? '生成中...' : '生成验证码' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.grant-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.58);
}

.grant-dialog {
  width: min(100%, 28rem);
  border: 1px solid rgba(53, 243, 255, 0.24);
  border-radius: 8px;
  background: rgba(7, 7, 19, 0.96);
  color: rgb(226, 232, 240);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
}

.grant-dialog-header,
.grant-dialog-actions,
.grant-result-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.grant-dialog-header {
  padding: 1rem;
  border-bottom: 1px solid rgba(53, 243, 255, 0.16);
}

.grant-dialog-header h2 {
  margin: 0;
  color: white;
  font-size: 1rem;
  font-weight: 900;
}

.grant-dialog-header p,
.grant-result p {
  margin: 0.25rem 0 0;
  color: rgba(203, 213, 225, 0.72);
  font-size: 0.78rem;
}

.grant-icon-btn {
  width: 40px;
  height: 40px;
  border: 1px solid rgba(53, 243, 255, 0.18);
  border-radius: 6px;
  background: transparent;
  color: rgb(203, 213, 225);
  cursor: pointer;
  font-size: 1.2rem;
}

.grant-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
}

.grant-preset-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.grant-preset {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 40px;
  border: 1px solid rgba(53, 243, 255, 0.18);
  border-radius: 6px;
  color: rgba(203, 213, 225, 0.88);
  font-size: 0.78rem;
  cursor: pointer;
}

.grant-preset input {
  position: absolute;
  opacity: 0;
}

.grant-preset:has(input:checked) {
  border-color: rgba(53, 243, 255, 0.65);
  background: rgba(53, 243, 255, 0.14);
  color: rgb(165, 243, 252);
}

.grant-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: rgba(165, 243, 252, 0.86);
  font-size: 0.76rem;
  font-weight: 800;
}

.grant-field input {
  height: 40px;
  border: 1px solid rgba(53, 243, 255, 0.22);
  border-radius: 6px;
  background: rgba(9, 14, 28, 0.72);
  color: white;
  padding: 0 0.65rem;
}

.grant-error {
  margin: 0;
  color: rgb(253, 164, 175);
  font-size: 0.8rem;
}

.grant-copy-message {
  margin: 0.55rem 0 0;
  color: rgb(187, 247, 208);
  font-size: 0.78rem;
}

.grant-result {
  border: 1px solid rgba(132, 247, 153, 0.25);
  border-radius: 8px;
  background: rgba(132, 247, 153, 0.08);
  padding: 0.8rem;
}

.grant-code {
  font-family: Menlo, Consolas, monospace;
  font-size: 1.45rem;
  font-weight: 900;
  color: rgb(187, 247, 208);
  letter-spacing: 0.14em;
}

.grant-dialog-actions button,
.grant-result-actions button {
  min-height: 40px;
  border: 1px solid rgba(53, 243, 255, 0.22);
  border-radius: 6px;
  background: rgba(9, 14, 28, 0.72);
  color: rgb(203, 213, 225);
  padding: 0 0.8rem;
  cursor: pointer;
}

.grant-dialog-actions button[type='submit'] {
  border-color: rgba(53, 243, 255, 0.55);
  background: rgba(53, 243, 255, 0.16);
  color: rgb(165, 243, 252);
}

@media (max-width: 520px) {
  .grant-preset-grid,
  .grant-result-actions,
  .grant-dialog-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .grant-result-actions,
  .grant-dialog-actions {
    display: grid;
  }
}
</style>
