<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import AppShell from '@/shared/ui/AppShell.vue';
// 阶段 5/12 增强：从 GET /api/list 拉全部公开图，HoneycombCanvas 内部实现拖动平移、视口预加载、滚动加载更多
// 阶段 12：键盘 F 全屏、双击切换全屏、点击单图弹出 lightbox

const FA = {
  images: { vb: '0 0 576 512', d: 'M160 32c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H160zM396 138.7l96 144c4.9 7.4 5.4 16.8 1.2 24.6S480.9 320 472 320H328 280 200c-9.2 0-17.6-5.3-21.6-13.6s-2.9-18.2 2.9-25.4l64-80c4.6-5.7 11.4-9 18.7-9s14.2 3.3 18.7 9l17.3 21.6 56-84C360.5 132 368 128 376 128s15.5 4 20 10.7zM192 128a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zM48 120c0-13.3-10.7-24-24-24S0 106.7 0 120V344c0 75.1 60.9 136 136 136H456c13.3 0 24-10.7 24-24s-10.7-24-24-24H136c-48.6 0-88-39.4-88-88V120z' },
  expand: { vb: '0 0 448 512', d: 'M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z' },
  hand: { vb: '0 0 512 512', d: 'M256 0c-25.3 0-47.2 14.7-57.6 36c-7-2.6-14.5-4-22.4-4c-35.3 0-64 28.7-64 64V261.7C82.5 252 64 226.2 64 196c0-17.7-14.3-32-32-32s-32 14.3-32 32c0 64.6 39.8 119.9 96.2 142.9c12.8 5.2 21.8 17.2 21.8 31V408c0 57.4 46.6 104 104 104h135.7c63 0 117.3-44.5 129.6-106.3l32.3-161.7c2.2-10.9 3.3-22 3.3-33.2c0-50.5-37.3-92.4-85.8-99.4c-3.7-31.7-30.7-56.4-63.3-56.4c-7.9 0-15.4 1.4-22.4 4C303.2 14.7 281.3 0 256 0zM240 96.1l0-.1V64c0-8.8 7.2-16 16-16s16 7.2 16 16V224c0 8.8 7.2 16 16 16s16-7.2 16-16V96c0-8.8 7.2-16 16-16s16 7.2 16 16V224c0 8.8 7.2 16 16 16s16-7.2 16-16V128c0-8.8 7.2-16 16-16c8.7 0 15.8 6.9 16 15.5V288c0 8.8 7.2 16 16 16s16-7.2 16-16V160c8.8 0 16 7.2 16 16v32c0 7.3-.7 14.6-2.2 21.7L427.9 391.5c-6.1 30.9-33.2 53.1-64.6 53.1H227.7c-30.8 0-56-24.7-56.7-55.3c19.4-11.5 32.6-32.6 33-56.9V196c0 17.7 14.3 32 32 32s32-14.3 32-32V96.1z' },
  chevronUp: { vb: '0 0 512 512', d: 'M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z' },
  chevronDown: { vb: '0 0 512 512', d: 'M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z' },
};

const HEX_COLS = 16;
const HEX_ROWS = 14;
const TOTAL_HEX = HEX_COLS * HEX_ROWS;

const TINT_PALETTE = [
  'from-neon-cyan/25 to-neon-cyan/10',
  'from-neon-pink/25 to-neon-pink/10',
  'from-neon-violet/25 to-neon-violet/10',
  'from-neon-lime/25 to-neon-lime/10',
  'from-sky-400/20 to-indigo-500/10',
  'from-amber-400/20 to-rose-500/10',
  'from-emerald-400/20 to-cyan-500/10',
  'from-fuchsia-400/20 to-purple-500/10',
];

const rows = computed(() =>
  Array.from({ length: HEX_ROWS }, (_, rowIdx) => ({
    idx: rowIdx,
    offset: rowIdx % 2 === 1,
    items: Array.from({ length: HEX_COLS }, (_, colIdx) => {
      const seed = rowIdx * 73 + colIdx * 17;
      return {
        key: `${rowIdx}-${colIdx}`,
        tint: TINT_PALETTE[seed % TINT_PALETTE.length],
        rotate: ((seed % 5) - 2) * 0.4,
      };
    }),
  }))
);

const tipsHidden = ref(false);
const toggleTips = () => { tipsHidden.value = !tipsHidden.value; };

const BG_ORBS = Array.from({ length: 6 }, (_, i) => ({
  key: i,
  left: `${(i * 17 + 7) % 90}%`,
  top: `${(i * 23 + 11) % 80}%`,
  size: 40 + (i % 3) * 20,
  delay: `${i * 0.6}s`,
}));

const handleKey = (e: KeyboardEvent) => {
  const tag = (document.activeElement?.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === 'h' || e.key === 'H') {
    e.preventDefault();
    toggleTips();
  }
};

onMounted(() => window.addEventListener('keydown', handleKey));
onUnmounted(() => window.removeEventListener('keydown', handleKey));
</script>

<template>
  <AppShell fluid>
    <div class="-mx-3 -mt-16 sm:-mx-4">
      <section class="hive-stage">
        <div aria-hidden="true" class="orbs">
          <div
            v-for="orb in BG_ORBS"
            :key="orb.key"
            class="hex-orb"
            :style="{ left: orb.left, top: orb.top, width: orb.size + 'px', height: orb.size + 'px', animationDelay: orb.delay }"
          />
        </div>

        <div class="honeycomb">
          <div
            v-for="row in rows"
            :key="row.idx"
            class="hive-row"
            :class="{ 'is-offset': row.offset }"
          >
            <div
              v-for="hex in row.items"
              :key="hex.key"
              class="hive-hex"
            >
              <div
                class="hex-face"
                :class="['bg-gradient-to-br', hex.tint]"
                :style="{ transform: `rotate(${hex.rotate}deg)` }"
              />
            </div>
          </div>
        </div>

        <aside class="user-tips" :class="{ 'is-hidden': tipsHidden }" aria-label="蜂巢操作提示">
          <header class="mb-2 flex items-center gap-2">
            <span class="inline-block h-2 w-2 rounded-full bg-neon-cyan shadow-[0_0_8px_rgba(53,243,255,0.8)]" />
            <span class="text-[11px] font-bold uppercase tracking-[0.2em] text-neon-cyan">Hive Tips</span>
          </header>

          <ul class="space-y-1.5 text-xs text-slate-300">
            <li class="flex items-center gap-2">
              <svg :viewBox="FA.images.vb" fill="currentColor" class="h-3 w-3 text-neon-cyan/80" aria-hidden="true"><path :d="FA.images.d" /></svg>
              <span>已加载 <span class="font-mono font-bold text-white">{{ TOTAL_HEX }}</span> 个占位</span>
            </li>
            <li class="flex items-center gap-2">
              <svg :viewBox="FA.expand.vb" fill="currentColor" class="h-3 w-3 text-neon-cyan/80" aria-hidden="true"><path :d="FA.expand.d" /></svg>
              <span>双击 <kbd>F</kbd> 切换全屏（阶段 12 接入）</span>
            </li>
            <li class="flex items-center gap-2">
              <svg :viewBox="FA.hand.vb" fill="currentColor" class="h-3 w-3 text-neon-cyan/80" aria-hidden="true"><path :d="FA.hand.d" /></svg>
              <span>拖动浏览蜂巢（阶段 12 接入）</span>
            </li>
          </ul>

          <button
            type="button"
            class="tips-toggle"
            :aria-label="tipsHidden ? '展开提示' : '收起提示'"
            @click="toggleTips"
          >
            <svg :viewBox="tipsHidden ? FA.chevronDown.vb : FA.chevronUp.vb" fill="currentColor" class="h-3 w-3" aria-hidden="true">
              <path :d="tipsHidden ? FA.chevronDown.d : FA.chevronUp.d" />
            </svg>
          </button>
        </aside>
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.hive-stage {
  position: relative;
  min-height: 100vh;
  background: linear-gradient(135deg, #04040c 0%, #070713 50%, #0a0a1a 100%);
  overflow: hidden;
}

.orbs {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.hex-orb {
  position: absolute;
  background: rgba(53, 243, 255, 0.08);
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  animation: orb-float 8s ease-in-out infinite;
}

@keyframes orb-float {
  0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.6; }
  50% { transform: translateY(-30px) rotate(180deg); opacity: 1; }
}

.honeycomb {
  --hex-w: clamp(60px, 7vw, 110px);
  --hex-h: calc(var(--hex-w) * 1.1547);
  --gap: 4px;

  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6rem 0 4rem;
  user-select: none;
}

.hive-row {
  display: flex;
  gap: var(--gap);
  margin-bottom: calc(var(--hex-h) * -0.25 + var(--gap));
}

.hive-row.is-offset {
  margin-left: calc((var(--hex-w) + var(--gap)) * 0.5);
}

.hive-hex {
  flex: 0 0 var(--hex-w);
  width: var(--hex-w);
  height: var(--hex-h);
  position: relative;
  transition: transform 0.25s ease;
}

.hive-hex:hover {
  transform: scale(1.08);
  z-index: 5;
}

.hex-face {
  position: absolute;
  inset: 0;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  border: 1px solid rgba(255, 255, 255, 0.04);
  transition: filter 0.25s ease, box-shadow 0.25s ease;
}

.hive-hex:hover .hex-face {
  filter: brightness(1.4);
  box-shadow: 0 0 24px rgba(53, 243, 255, 0.4);
}

.user-tips {
  position: fixed;
  top: 5rem;
  left: 1.25rem;
  z-index: 30;
  width: 16rem;
  padding: 0.875rem 1rem 1rem;
  background: rgba(7, 7, 19, 0.78);
  border: 1px solid rgba(53, 243, 255, 0.25);
  border-radius: 0.625rem;
  backdrop-filter: blur(14px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.user-tips.is-hidden {
  transform: translateY(calc(-100% + 2.25rem));
  opacity: 0.95;
}

kbd {
  display: inline-block;
  min-width: 1.2rem;
  padding: 0.1rem 0.3rem;
  margin: 0 0.15rem;
  font-family: 'Courier New', monospace;
  font-size: 0.6rem;
  color: rgb(53, 243, 255);
  background: rgba(53, 243, 255, 0.1);
  border: 1px solid rgba(53, 243, 255, 0.3);
  border-radius: 0.25rem;
  text-align: center;
}

.tips-toggle {
  position: absolute;
  bottom: -14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 9999px;
  background: rgba(53, 243, 255, 0.2);
  border: 1px solid rgba(53, 243, 255, 0.4);
  color: rgb(53, 243, 255);
  cursor: pointer;
  transition: all 0.25s ease;
}

.tips-toggle:hover {
  background: rgba(53, 243, 255, 0.35);
  box-shadow: 0 0 12px rgba(53, 243, 255, 0.5);
}

@media (max-width: 768px) {
  .user-tips { top: 4.5rem; left: 0.75rem; right: 0.75rem; width: auto; }
}
</style>
