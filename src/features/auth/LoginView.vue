<script setup lang="ts">
import AppShell from '@/shared/ui/AppShell.vue';
// 阶段 6：Cloudflare Access 接 GitHub 后，访问 /upload 等管理路径
// 会被边缘拦截跳到 GitHub 登录页。这页本身始终公开，作为说明入口。

const GITHUB = {
  vb: '0 0 496 512',
  d: 'M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z',
};

const ARROW = {
  vb: '0 0 448 512',
  d: 'M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.7 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z',
};

const SHIELD = {
  vb: '0 0 512 512',
  d: 'M256 0c4.6 0 9.2 1 13.4 2.9L457.7 82.8c22 9.3 38.4 31 38.3 57.2c-.5 99.2-41.3 280.7-213.6 363.2c-16.7 8-36.1 8-52.8 0C57.3 420.7 16.5 239.2 16 140c-.1-26.2 16.3-47.9 38.3-57.2L242.7 2.9C246.8 1 251.4 0 256 0z',
};
</script>

<template>
  <AppShell fluid>
    <div class="-mx-3 -mt-16 sm:-mx-4">
      <section class="access-stage">
        <div aria-hidden="true" class="grid-bg" />
        <div aria-hidden="true" class="orbs">
          <div class="orb orb-cyan" />
          <div class="orb orb-pink" />
        </div>

        <div class="access-frame">
          <article class="access-card">
            <span class="corner corner-tl" aria-hidden="true" />
            <span class="corner corner-tr" aria-hidden="true" />
            <span class="corner corner-bl" aria-hidden="true" />
            <span class="corner corner-br" aria-hidden="true" />
            <span class="scan" aria-hidden="true" />

            <div class="shield-wrap" aria-hidden="true">
              <svg :viewBox="SHIELD.vb" fill="currentColor" class="shield">
                <path :d="SHIELD.d" />
              </svg>
            </div>

            <header class="text-center">
              <RouterLink to="/" class="brand">
                <span class="brand-cyan">Pixel</span>
                <span class="brand-pink">Space</span>
              </RouterLink>
              <p class="kicker">Access Terminal</p>
              <h1 class="title">管理员通道</h1>
              <p class="desc">
                管理路径由
                <span class="hl">Cloudflare Access</span>
                接管，未登录会自动跳到 GitHub 完成验证。非白名单账号会被拒绝。
              </p>
            </header>

            <div class="actions">
              <RouterLink to="/upload" class="primary">
                <svg :viewBox="GITHUB.vb" fill="currentColor" class="primary-icon" aria-hidden="true">
                  <path :d="GITHUB.d" />
                </svg>
                <span>通过 GitHub 接入</span>
              </RouterLink>

              <div class="divider"><span>OR</span></div>

              <RouterLink to="/images" class="secondary">
                <span>浏览公开图库</span>
                <svg :viewBox="ARROW.vb" fill="currentColor" class="secondary-icon" aria-hidden="true">
                  <path :d="ARROW.d" />
                </svg>
              </RouterLink>
            </div>

            <footer class="status">
              <span class="status-dot" aria-hidden="true" />
              <span>EDGE :: Cloudflare Access · GitHub · v0.1.0</span>
            </footer>
          </article>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.access-stage {
  position: relative;
  min-height: 100vh;
  background: linear-gradient(135deg, #04040c 0%, #070713 50%, #0a0a1a 100%);
  overflow: hidden;
}

.grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(53, 243, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(53, 243, 255, 0.05) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

.orbs {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.orb {
  position: absolute;
  width: 28rem;
  height: 28rem;
  border-radius: 9999px;
  filter: blur(90px);
  opacity: 0.22;
}

.orb-cyan {
  top: -6rem;
  left: 12%;
  background: rgb(53, 243, 255);
  animation: orb-cyan 12s ease-in-out infinite;
}

.orb-pink {
  bottom: -8rem;
  right: 12%;
  background: rgb(255, 79, 216);
  animation: orb-pink 14s ease-in-out infinite;
}

@keyframes orb-cyan {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(2rem, 1rem); }
}

@keyframes orb-pink {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-2rem, -1rem); }
}

.access-frame {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 5rem 1.5rem 4rem;
}

.access-card {
  position: relative;
  width: 100%;
  max-width: 28rem;
  padding: 3rem 2rem 1.5rem;
  background: rgba(7, 7, 19, 0.72);
  border: 1px solid rgba(53, 243, 255, 0.28);
  border-radius: 1rem;
  backdrop-filter: blur(20px);
  box-shadow:
    0 4px 30px rgba(0, 0, 0, 0.45),
    inset 0 0 60px rgba(53, 243, 255, 0.04);
  overflow: hidden;
}

@media (min-width: 640px) {
  .access-card {
    padding: 3.25rem 2.75rem 2rem;
  }
}

.corner {
  position: absolute;
  width: 16px;
  height: 16px;
  border-color: rgb(53, 243, 255);
  border-style: solid;
  border-width: 0;
  filter: drop-shadow(0 0 4px rgba(53, 243, 255, 0.55));
}

.corner-tl { top: 8px; left: 8px; border-top-width: 1px; border-left-width: 1px; }
.corner-tr { top: 8px; right: 8px; border-top-width: 1px; border-right-width: 1px; }
.corner-bl { bottom: 8px; left: 8px; border-bottom-width: 1px; border-left-width: 1px; }
.corner-br { bottom: 8px; right: 8px; border-bottom-width: 1px; border-right-width: 1px; }

.scan {
  position: absolute;
  top: 0;
  left: -25%;
  height: 1px;
  width: 25%;
  background: linear-gradient(90deg, transparent, rgb(53, 243, 255), transparent);
  animation: scan-card 4s infinite;
  pointer-events: none;
}

@keyframes scan-card {
  0% { left: -25%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { left: 100%; opacity: 0; }
}

.shield-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.shield {
  width: 40px;
  height: 40px;
  color: rgb(53, 243, 255);
  filter: drop-shadow(0 0 12px rgba(53, 243, 255, 0.6));
  animation: shield-pulse 3s ease-in-out infinite;
}

@keyframes shield-pulse {
  0%, 100% { filter: drop-shadow(0 0 12px rgba(53, 243, 255, 0.6)); }
  50% { filter: drop-shadow(0 0 20px rgba(53, 243, 255, 0.9)); }
}

.brand {
  display: inline-flex;
  gap: 0.375rem;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: 0.075em;
  line-height: 1;
}

.brand-cyan {
  color: rgb(53, 243, 255);
  text-shadow: 0 0 10px rgba(53, 243, 255, 0.8), 0 0 20px rgba(53, 243, 255, 0.4);
}

.brand-pink {
  color: rgb(255, 79, 216);
  text-shadow: 0 0 10px rgba(255, 79, 216, 0.8), 0 0 20px rgba(255, 79, 216, 0.4);
}

.kicker {
  margin-top: 0.875rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3em;
  color: rgb(53, 243, 255);
  opacity: 0.85;
}

.title {
  margin-top: 0.375rem;
  font-size: 1.75rem;
  font-weight: 900;
  color: white;
  letter-spacing: 0.05em;
}

.desc {
  margin: 0.875rem auto 0;
  max-width: 22rem;
  font-size: 0.85rem;
  line-height: 1.65;
  color: rgb(148, 163, 184);
}

.hl {
  color: rgb(53, 243, 255);
  font-weight: 600;
}

.actions {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.primary {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 0.875rem 1.5rem;
  background: rgba(53, 243, 255, 0.08);
  border: 1px solid rgba(53, 243, 255, 0.45);
  border-radius: 0.5rem;
  color: rgb(53, 243, 255);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  transition: transform 0.25s ease, background 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease;
  overflow: hidden;
}

.primary::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(53, 243, 255, 0.18), transparent);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}

.primary:hover {
  background: rgba(53, 243, 255, 0.16);
  border-color: rgb(53, 243, 255);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 24px rgba(53, 243, 255, 0.32);
}

.primary:hover::before {
  transform: translateX(100%);
}

.primary-icon {
  width: 18px;
  height: 18px;
}

.divider {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.65rem;
  color: rgba(148, 163, 184, 0.5);
  letter-spacing: 0.3em;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

.secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  color: rgb(148, 163, 184);
  font-size: 0.8rem;
  font-weight: 600;
  transition: color 0.25s ease, gap 0.25s ease;
}

.secondary:hover {
  color: white;
  gap: 0.625rem;
}

.secondary-icon {
  width: 12px;
  height: 12px;
}

.status {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: rgba(148, 163, 184, 0.6);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: rgb(132, 247, 153);
  box-shadow: 0 0 8px rgba(132, 247, 153, 0.6);
  animation: status-pulse 2s ease-in-out infinite;
}

@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
