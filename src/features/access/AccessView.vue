<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref } from 'vue';
import AppShell from '@/shared/ui/AppShell.vue';
import type { ImageRecord } from '@/features/images/image.types';
import { formatDownloadGrantExpiry } from '@/features/library/download-grant-expiry';
import { downloadGrantOriginal, verifyDownloadGrant } from './access.api';

const ImageLightbox = defineAsyncComponent(() => import('@/features/images/ImageLightbox.vue'));

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback': () => void;
      'expired-callback': () => void;
    },
  ): string;
  reset(widgetId?: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

const code = ref('');
const verifiedCode = ref('');
const expiresAt = ref<string | null>(null);
const images = ref<ImageRecord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const downloadingKey = ref<string | null>(null);
const batchDownloading = ref(false);
const lightboxOpen = ref(false);
const lightboxImage = ref<ImageRecord | null>(null);
const turnstileRequired = ref(false);
const turnstileToken = ref('');
const turnstileEl = ref<HTMLElement | null>(null);
const turnstileStatus = ref<'idle' | 'loading' | 'ready' | 'verified' | 'error'>('idle');
const pendingCode = ref('');
let turnstileWidgetId: string | null = null;
let turnstileScriptPromise: Promise<void> | null = null;

const hasResult = computed(() => expiresAt.value !== null);

const expiresLabel = computed(() => (expiresAt.value ? formatDownloadGrantExpiry(expiresAt.value) : ''));

const loadTurnstileScript = (): Promise<void> => {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('turnstile_script_failed')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('turnstile_script_failed'));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
};

const renderTurnstile = async () => {
  if (!turnstileRequired.value || turnstileWidgetId || !turnstileEl.value) return;
  if (!TURNSTILE_SITE_KEY) {
    turnstileStatus.value = 'error';
    error.value = '人机验证暂未配置';
    return;
  }

  turnstileStatus.value = 'loading';
  try {
    await loadTurnstileScript();
    if (!window.turnstile || !turnstileEl.value) throw new Error('turnstile_unavailable');

    turnstileWidgetId = window.turnstile.render(turnstileEl.value, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => {
        turnstileToken.value = token;
        turnstileStatus.value = 'verified';
        if (pendingCode.value) void verifyCode(pendingCode.value);
      },
      'error-callback': () => {
        turnstileToken.value = '';
        turnstileStatus.value = 'error';
        error.value = '人机验证失败，请重试';
      },
      'expired-callback': () => {
        turnstileToken.value = '';
        turnstileStatus.value = 'ready';
      },
    });
    turnstileStatus.value = 'ready';
  } catch {
    turnstileStatus.value = 'error';
    error.value = '人机验证加载失败';
  }
};

const resetTurnstile = () => {
  turnstileToken.value = '';
  if (turnstileWidgetId && window.turnstile) window.turnstile.reset(turnstileWidgetId);
  turnstileStatus.value = turnstileRequired.value ? 'ready' : 'idle';
};

const hideTurnstile = () => {
  turnstileRequired.value = false;
  turnstileToken.value = '';
  turnstileWidgetId = null;
  turnstileStatus.value = 'idle';
};

const showTurnstile = async (normalized: string, message: string) => {
  pendingCode.value = normalized;
  turnstileRequired.value = true;
  error.value = message;
  if (turnstileWidgetId) {
    resetTurnstile();
    return;
  }
  await nextTick();
  await renderTurnstile();
};

const clearResult = () => {
  verifiedCode.value = '';
  expiresAt.value = null;
  images.value = [];
};

const isTurnstileError = (message: string) =>
  message.includes('turnstile_required') || message.includes('turnstile_invalid');

const verifyCode = async (normalized: string) => {
  loading.value = true;
  error.value = null;
  try {
    const result = await verifyDownloadGrant(normalized, turnstileToken.value || undefined);
    verifiedCode.value = normalized;
    expiresAt.value = result.expires_at;
    images.value = result.images;
    pendingCode.value = '';
    hideTurnstile();
  } catch (verifyError) {
    clearResult();
    const message = verifyError instanceof Error ? verifyError.message : '';
    if (isTurnstileError(message)) {
      await showTurnstile(normalized, '请先完成人机验证');
      return;
    }
    if (message.includes('too_many_attempts')) {
      error.value = '尝试次数过多，请稍后再试';
      resetTurnstile();
      return;
    }
    error.value = '验证码无效或已过期';
    resetTurnstile();
  } finally {
    loading.value = false;
  }
};

const submitCode = async () => {
  const normalized = code.value.trim().toUpperCase();
  if (!normalized) {
    error.value = '请输入验证码';
    return;
  }

  await verifyCode(normalized);
};

const downloadName = (image: ImageRecord): string => image.original_filename || image.title || image.key;

const openLightbox = (image: ImageRecord) => {
  lightboxImage.value = image;
  lightboxOpen.value = true;
};

const saveOriginalBlob = (image: ImageRecord, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadName(image);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const downloadOriginal = async (image: ImageRecord) => {
  if (!verifiedCode.value || batchDownloading.value) return;
  downloadingKey.value = image.key;
  error.value = null;
  try {
    const blob = await downloadGrantOriginal(image.key, verifiedCode.value);
    saveOriginalBlob(image, blob);
  } catch {
    error.value = '原图下载失败';
  } finally {
    downloadingKey.value = null;
  }
};

const downloadAllOriginals = async () => {
  if (!verifiedCode.value || images.value.length === 0 || batchDownloading.value) return;
  batchDownloading.value = true;
  error.value = null;
  let completed = 0;
  try {
    for (const image of images.value) {
      downloadingKey.value = image.key;
      const blob = await downloadGrantOriginal(image.key, verifiedCode.value);
      saveOriginalBlob(image, blob);
      completed += 1;
    }
  } catch {
    error.value = `批量下载失败：已下载 ${completed} / ${images.value.length} 张`;
  } finally {
    downloadingKey.value = null;
    batchDownloading.value = false;
  }
};
</script>

<template>
  <AppShell>
    <section class="access-page">
      <div class="access-orbs" aria-hidden="true">
        <span class="orb orb-cyan" />
        <span class="orb orb-pink" />
      </div>

      <div class="access-inner">
        <header class="access-hero">
          <p class="access-eyebrow">Original Access</p>
          <h1>原图通行</h1>
          <p class="access-sub">输入授权验证码，下载对应图片的原始文件。</p>
        </header>

        <form class="access-form cyber-panel" @submit.prevent="submitCode">
          <label class="access-field-label" for="access-code">验证码</label>
          <div class="access-field">
            <input
              id="access-code"
              v-model="code"
              class="access-input"
              type="text"
              autocomplete="one-time-code"
              placeholder="输入验证码"
              aria-label="输入验证码"
            />
            <button type="submit" class="access-submit" :disabled="loading">
              {{ loading ? '验证中...' : '验证' }}
            </button>
          </div>
          <div v-if="turnstileRequired" class="access-turnstile">
            <div ref="turnstileEl" class="access-turnstile-widget" />
          </div>
          <p v-if="error" class="access-error">{{ error }}</p>
        </form>

        <section v-if="hasResult" class="access-result">
          <div class="access-expiry cyber-panel">
            <span class="expiry-dot" aria-hidden="true" />
            <div class="expiry-text">
              <span class="expiry-label">授权有效期至</span>
              <strong class="expiry-value">{{ expiresLabel }}</strong>
            </div>
            <button
              v-if="images.length > 0"
              type="button"
              class="access-batch-download"
              :disabled="batchDownloading || !!downloadingKey"
              @click="downloadAllOriginals"
            >
              {{ batchDownloading ? '批量下载中...' : '批量下载原图' }}
            </button>
          </div>

          <p v-if="images.length === 0" class="access-empty cyber-panel">
            这个验证码暂时没有可下载图片。
          </p>
          <div v-else class="access-grid">
            <article v-for="image in images" :key="image.key" class="access-card">
              <button
                type="button"
                class="access-card-media access-lightbox-trigger"
                :aria-label="`查看 ${downloadName(image)} 大图`"
                @click="openLightbox(image)"
              >
                <img :src="image.public_url" :alt="downloadName(image)" loading="lazy" />
              </button>
              <div class="access-card-body">
                <h2>{{ image.original_filename || image.title || image.key }}</h2>
                <p class="access-card-meta">{{ image.width }} × {{ image.height }} · {{ image.format.toUpperCase() }}</p>
                <button
                  type="button"
                  class="access-download"
                  :disabled="batchDownloading || downloadingKey === image.key"
                  @click="downloadOriginal(image)"
                >
                  {{ downloadingKey === image.key ? '下载中...' : '下载原图' }}
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>

      <ImageLightbox :open="lightboxOpen" :image="lightboxImage" @close="lightboxOpen = false" />
    </section>
  </AppShell>
</template>

<style scoped>
.access-page {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: calc(100svh - 4rem);
  padding: 2rem 0 4rem;
}

.access-orbs {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(80px);
  opacity: 0.5;
}

.orb-cyan {
  top: -6rem;
  left: 12%;
  width: 22rem;
  height: 22rem;
  background: radial-gradient(circle, rgba(53, 243, 255, 0.32), transparent 70%);
}

.orb-pink {
  right: 8%;
  bottom: -8rem;
  width: 24rem;
  height: 24rem;
  background: radial-gradient(circle, rgba(255, 79, 216, 0.22), transparent 70%);
}

.access-inner {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: min(100%, 60rem);
  margin: 0 auto;
}

.access-hero {
  padding: 1rem 0 0.25rem;
  text-align: center;
}

.access-eyebrow {
  margin: 0;
  color: rgb(53, 243, 255);
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.32em;
  text-transform: uppercase;
}

.access-hero h1 {
  margin: 0.6rem 0 0;
  color: white;
  font-size: 1.9rem;
  font-weight: 900;
  letter-spacing: 0.02em;
  text-shadow: 0 0 18px rgba(53, 243, 255, 0.35);
}

.access-sub {
  margin: 0.55rem 0 0;
  color: rgba(203, 213, 225, 0.72);
  font-size: 0.9rem;
}

.access-form {
  display: grid;
  gap: 0.65rem;
  width: 100%;
  max-width: 32rem;
  margin: 0 auto;
  border-radius: 10px;
  padding: 1.25rem;
}

.access-field-label {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.85);
}

.access-field {
  display: flex;
  gap: 0.6rem;
}

.access-turnstile {
  display: flex;
  min-height: 65px;
  align-items: center;
}

.access-turnstile-widget {
  min-height: 65px;
}

.access-input {
  flex: 1;
  min-width: 0;
  height: 44px;
  border: 1px solid rgba(53, 243, 255, 0.22);
  border-radius: 8px;
  background: rgba(9, 14, 28, 0.8);
  color: white;
  padding: 0 0.9rem;
  font-size: 0.95rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.access-input::placeholder {
  letter-spacing: 0.05em;
  color: rgba(148, 163, 184, 0.55);
}

.access-input:focus {
  outline: none;
  border-color: rgba(53, 243, 255, 0.65);
  box-shadow: 0 0 0 3px rgba(53, 243, 255, 0.14);
}

.access-submit {
  flex-shrink: 0;
  min-height: 44px;
  padding: 0 1.4rem;
  border: 1px solid rgba(53, 243, 255, 0.45);
  border-radius: 8px;
  background: rgba(53, 243, 255, 0.16);
  color: rgb(165, 243, 252);
  font-weight: 800;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background-color 160ms ease, transform 140ms ease, box-shadow 160ms ease;
}

.access-submit:hover:not(:disabled) {
  background: rgba(53, 243, 255, 0.26);
  box-shadow: 0 0 18px rgba(53, 243, 255, 0.28);
}

.access-submit:active:not(:disabled) {
  transform: scale(0.97);
}

.access-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.access-error {
  margin: 0;
  color: rgb(253, 164, 175);
  font-size: 0.82rem;
}

.access-result {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.access-expiry {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  border-radius: 10px;
  padding: 0.85rem 1.1rem;
}

.expiry-dot {
  flex-shrink: 0;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 999px;
  background: rgb(110, 231, 183);
  box-shadow: 0 0 12px rgba(110, 231, 183, 0.8);
}

.expiry-text {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.expiry-label {
  color: rgba(148, 163, 184, 0.86);
  font-size: 0.8rem;
}

.expiry-value {
  color: white;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.access-batch-download {
  flex-shrink: 0;
  min-height: 36px;
  border: 1px solid rgba(53, 243, 255, 0.4);
  border-radius: 8px;
  background: rgba(53, 243, 255, 0.14);
  color: rgb(165, 243, 252);
  padding: 0 0.9rem;
  font-size: 0.78rem;
  font-weight: 850;
  cursor: pointer;
  transition: background-color 160ms ease, box-shadow 160ms ease;
}

.access-batch-download:hover:not(:disabled) {
  background: rgba(53, 243, 255, 0.24);
  box-shadow: 0 0 16px rgba(53, 243, 255, 0.24);
}

.access-batch-download:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.access-empty {
  margin: 0;
  border-radius: 10px;
  padding: 1.5rem;
  text-align: center;
  color: rgba(203, 213, 225, 0.7);
  font-size: 0.9rem;
}

.access-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1rem;
}

.access-card {
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 10px;
  background: rgba(7, 7, 19, 0.55);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.access-card:hover {
  transform: translateY(-3px);
  border-color: rgba(53, 243, 255, 0.4);
  box-shadow: 0 10px 30px rgba(2, 6, 18, 0.5), 0 0 0 1px rgba(53, 243, 255, 0.12);
}

.access-card-media {
  display: block;
  overflow: hidden;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  cursor: pointer;
}

.access-lightbox-trigger:focus-visible {
  outline: 2px solid rgba(53, 243, 255, 0.78);
  outline-offset: -2px;
}

.access-card-media img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  transition: transform 320ms ease;
}

.access-card:hover .access-card-media img {
  transform: scale(1.04);
}

.access-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.85rem;
}

.access-card-body h2 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: white;
  font-size: 0.9rem;
  font-weight: 800;
}

.access-card-meta {
  margin: 0;
  color: rgba(148, 163, 184, 0.78);
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.74rem;
}

.access-download {
  margin-top: 0.15rem;
  min-height: 38px;
  border: 1px solid rgba(53, 243, 255, 0.4);
  border-radius: 8px;
  background: rgba(53, 243, 255, 0.12);
  color: rgb(165, 243, 252);
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  transition: background-color 160ms ease, box-shadow 160ms ease;
}

.access-download:hover:not(:disabled) {
  background: rgba(53, 243, 255, 0.22);
  box-shadow: 0 0 16px rgba(53, 243, 255, 0.25);
}

.access-download:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .access-field {
    flex-direction: column;
  }

  .access-hero h1 {
    font-size: 1.55rem;
  }
}
</style>
