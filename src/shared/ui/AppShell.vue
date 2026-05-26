<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { devRole as currentDevRole, isAdmin, isDev, setDevRole } from '@/shared/auth/useAdmin';

defineProps<{ fluid?: boolean }>();

type IconName = 'home' | 'images' | 'random' | 'upload' | 'hive' | 'sliders' | 'language' | 'moon' | 'github' | 'plug';

const ICONS: Record<IconName, { vb: string; d: string }> = {
  home: {
    vb: '0 0 576 512',
    d: 'M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c0 2.7-.2 5.4-.5 8.1V472c0 22.1-17.9 40-40 40H456c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1H416 392c-22.1 0-40-17.9-40-40V448 384c0-17.7-14.3-32-32-32H256c-17.7 0-32 14.3-32 32v64 24c0 22.1-17.9 40-40 40H160 128.1c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2H104c-22.1 0-40-17.9-40-40V360c0-.9 0-1.9 .1-2.8V287.6H32c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z',
  },
  images: {
    vb: '0 0 576 512',
    d: 'M160 32c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H160zM396 138.7l96 144c4.9 7.4 5.4 16.8 1.2 24.6S480.9 320 472 320H328 280 200c-9.2 0-17.6-5.3-21.6-13.6s-2.9-18.2 2.9-25.4l64-80c4.6-5.7 11.4-9 18.7-9s14.2 3.3 18.7 9l17.3 21.6 56-84C360.5 132 368 128 376 128s15.5 4 20 10.7zM192 128a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zM48 120c0-13.3-10.7-24-24-24S0 106.7 0 120V344c0 75.1 60.9 136 136 136H456c13.3 0 24-10.7 24-24s-10.7-24-24-24H136c-48.6 0-88-39.4-88-88V120z',
  },
  random: {
    vb: '0 0 512 512',
    d: 'M403.8 34.4c12-5 25.7-2.2 34.9 6.9l64 64c6 6 9.4 14.1 9.4 22.6s-3.4 16.6-9.4 22.6l-64 64c-9.2 9.2-22.9 11.9-34.9 6.9s-19.8-16.6-19.8-29.6V160H352c-10.1 0-19.6 4.7-25.6 12.8L284 229.3 244 176l31.2-41.6C293.3 110.2 321.8 96 352 96h32V64c0-12.9 7.8-24.6 19.8-29.6zM164 282.7L204 336l-31.2 41.6C154.7 401.8 126.2 416 96 416H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H96c10.1 0 19.6-4.7 25.6-12.8L164 282.7zm274.6 188c-9.2 9.2-22.9 11.9-34.9 6.9s-19.8-16.6-19.8-29.6V416H352c-30.2 0-58.7-14.2-76.8-38.4L121.6 172.8c-6-8.1-15.5-12.8-25.6-12.8H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H96c30.2 0 58.7 14.2 76.8 38.4L326.4 339.2c6 8.1 15.5 12.8 25.6 12.8h32V320c0-12.9 7.8-24.6 19.8-29.6s25.7-2.2 34.9 6.9l64 64c6 6 9.4 14.1 9.4 22.6s-3.4 16.6-9.4 22.6l-64 64z',
  },
  upload: {
    vb: '0 0 512 512',
    d: 'M288 109.3V352c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3l-73.4 73.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352H192c0 35.3 28.7 64 64 64s64-28.7 64-64H448c35.3 0 64 28.7 64 64v32c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V416c0-35.3 28.7-64 64-64zM432 456a24 24 0 1 0 0-48 24 24 0 1 0 0 48z',
  },
  hive: {
    vb: '0 0 512 512',
    d: 'M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm88 64v64H64V96h88zm56 0h88v64H208V96zm240 0v64H360V96h88zM64 224h88v64H64V224zm232 0v64H208V224h88zm64 0h88v64H360V224zM152 352v64H64V352h88zm56 0h88v64H208V352zm240 0v64H360V352h88z',
  },
  sliders: {
    vb: '0 0 512 512',
    d: 'M0 416c0 17.7 14.3 32 32 32H86.7c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H233.3c-12.3-28.3-40.5-48-73.3-48s-61 19.7-73.3 48H32c-17.7 0-32 14.3-32 32zm128 0a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zM320 256a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zm32-80c-32.8 0-61 19.7-73.3 48H32c-17.7 0-32 14.3-32 32s14.3 32 32 32H278.7c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H425.3c-12.3-28.3-40.5-48-73.3-48zM192 128a32 32 0 1 1 0-64 32 32 0 1 1 0 64zm73.3-32C253 67.7 224.8 48 192 48s-61 19.7-73.3 48H32C14.3 96 0 110.3 0 128s14.3 32 32 32h86.7c12.3 28.3 40.5 48 73.3 48s61-19.7 73.3-48H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H265.3z',
  },
  language: {
    vb: '0 0 640 512',
    d: 'M0 128C0 92.7 28.7 64 64 64H256h48 16H576c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H320 304 256 64c-35.3 0-64-28.7-64-64V128zm320 0V384H576V128H320zM178.3 175.9c-3.2-7.2-10.4-11.9-18.3-11.9s-15.1 4.7-18.3 11.9l-64 144c-4.5 10.1 .1 21.9 10.2 26.4s21.9-.1 26.4-10.2l8.9-20.1h73.6l8.9 20.1c4.5 10.1 16.3 14.6 26.4 10.2s14.6-16.3 10.2-26.4l-64-144zM160 233.2L179 276H141l19-42.8zM448 164c11 0 20 9 20 20v4h44 16c11 0 20 9 20 20s-9 20-20 20h-2l-1.6 4.5c-8.9 24.4-22.4 46.6-39.6 65.4c.9 .6 1.8 1.1 2.7 1.6l18.9 11.3c9.5 5.7 12.5 18 6.9 27.4s-18 12.5-27.4 6.9l-18.9-11.3c-4.5-2.7-8.8-5.5-13.1-8.5c-10.6 7.5-21.9 14-34 19.4l-3.6 1.6c-10.1 4.5-21.9-.1-26.4-10.2s.1-21.9 10.2-26.4l3.6-1.6c6.4-2.9 12.6-6.1 18.5-9.8l-12.2-12.2c-7.8-7.8-7.8-20.5 0-28.3s20.5-7.8 28.3 0l14.6 14.6 .5 .5c12.4-13.1 22.5-28.3 29.8-45H448 376c-11 0-20-9-20-20s9-20 20-20h52v-4c0-11 9-20 20-20z',
  },
  moon: {
    vb: '0 0 384 512',
    d: 'M223.5 32C100 32 0 132.3 0 256S100 480 223.5 480c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z',
  },
  github: {
    vb: '0 0 496 512',
    d: 'M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z',
  },
  plug: {
    vb: '0 0 384 512',
    d: 'M96 0C78.3 0 64 14.3 64 32v96h64V32c0-17.7-14.3-32-32-32zM288 0c-17.7 0-32 14.3-32 32v96h64V32c0-17.7-14.3-32-32-32zM32 160c-17.7 0-32 14.3-32 32s14.3 32 32 32v32c0 77.4 55 142 128 156.8V480c0 17.7 14.3 32 32 32s32-14.3 32-32V412.8C297 398 352 333.4 352 256V224c17.7 0 32-14.3 32-32s-14.3-32-32-32H32z',
  },
};

const navLinks: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '首页', icon: 'home' },
  { to: '/images', label: '探索', icon: 'images' },
  { to: '/random', label: '随机', icon: 'random' },
  { to: '/upload', label: '上传', icon: 'upload' },
  { to: '/hive', label: '足迹', icon: 'hive' },
];

const adminNavLinks: { to: string; label: string; icon: IconName }[] = [
  { to: '/library', label: '控制台', icon: 'sliders' },
];

const route = useRoute();
const scrollY = ref(0);

const isScrolled = computed(() => {
  if (route.path === '/') return false;
  return scrollY.value > 20;
});

const handleScroll = () => {
  scrollY.value = window.scrollY;
};

onMounted(() => window.addEventListener('scroll', handleScroll, { passive: true }));
onUnmounted(() => window.removeEventListener('scroll', handleScroll));
</script>

<template>
  <div class="min-h-screen bg-grid bg-[length:32px_32px]">
    <header
      class="fixed inset-x-0 top-0 z-40 h-16 transition-all duration-300"
      :class="isScrolled
        ? 'border-b border-neon-cyan/30 bg-void/90 shadow-[0_4px_20px_rgba(53,243,255,0.1)] backdrop-blur-2xl'
        : 'border-b border-transparent bg-transparent'"
    >
      <nav class="relative flex h-full w-full items-center justify-between px-[max(2rem,calc((100vw-1600px)/2))]">
        <RouterLink to="/" class="flex shrink-0 items-center gap-2 transition hover:scale-[1.02]">
          <span class="font-mono text-xl font-black leading-none tracking-wider text-neon-cyan [text-shadow:0_0_10px_rgba(53,243,255,0.8),0_0_20px_rgba(53,243,255,0.4)]">Pixel</span>
          <span class="font-mono text-xl font-black leading-none tracking-wider text-neon-pink [text-shadow:0_0_10px_rgba(255,79,216,0.8),0_0_20px_rgba(255,79,216,0.4)]">Space</span>
        </RouterLink>

        <div class="ml-12 hidden flex-1 md:flex">
          <div class="flex items-center gap-2">
            <RouterLink
              v-for="link in navLinks"
              :key="link.to"
              :to="link.to"
              class="nav-item group relative flex items-center gap-2 overflow-hidden whitespace-nowrap rounded px-3.5 py-2 text-[0.8rem] font-semibold tracking-[0.025em] text-slate-200 transition-all duration-200 hover:-translate-y-px hover:text-white"
              active-class="is-active"
            >
              <svg :viewBox="ICONS[link.icon].vb" fill="currentColor" class="nav-icon h-3.5 w-3.5 shrink-0 opacity-85 transition" aria-hidden="true">
                <path :d="ICONS[link.icon].d" />
              </svg>
              <span>{{ link.label }}</span>
            </RouterLink>
            <template v-if="isAdmin">
              <span class="mx-1 hidden h-4 w-px bg-neon-cyan/25 lg:inline-block" aria-hidden="true" />
              <RouterLink
                v-for="link in adminNavLinks"
                :key="link.to"
                :to="link.to"
                class="nav-item is-admin-only group relative flex items-center gap-2 overflow-hidden whitespace-nowrap rounded px-3.5 py-2 text-[0.8rem] font-semibold tracking-[0.025em] text-slate-200 transition-all duration-200 hover:-translate-y-px hover:text-white"
                active-class="is-active"
              >
                <svg :viewBox="ICONS[link.icon].vb" fill="currentColor" class="nav-icon h-3.5 w-3.5 shrink-0 opacity-85 transition" aria-hidden="true">
                  <path :d="ICONS[link.icon].d" />
                </svg>
                <span>{{ link.label }}</span>
              </RouterLink>
            </template>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-3">
          <div
            v-if="isDev"
            class="dev-role-switch"
            :class="currentDevRole === 'admin' ? 'is-admin' : 'is-visitor'"
            role="group"
            aria-label="本地角色切换（仅开发）"
            title="本地开发角色切换：管理员 / 访客。线上无效，仅靠 X-Dev-Role 注入。"
          >
            <button
              type="button"
              class="dev-role-btn"
              :class="{ 'is-on': currentDevRole === 'admin' }"
              @click="setDevRole('admin')"
            >
              管理员
            </button>
            <button
              type="button"
              class="dev-role-btn"
              :class="{ 'is-on': currentDevRole === 'visitor' }"
              @click="setDevRole('visitor')"
            >
              访客
            </button>
          </div>

          <button
            type="button"
            class="tool-btn"
            aria-label="切换语言（阶段 12 接入）"
            disabled
          >
            <svg :viewBox="ICONS.language.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true">
              <path :d="ICONS.language.d" />
            </svg>
          </button>

          <button
            type="button"
            class="tool-btn"
            aria-label="切换主题（阶段 12 接入）"
            disabled
          >
            <svg :viewBox="ICONS.moon.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true">
              <path :d="ICONS.moon.d" />
            </svg>
          </button>

          <a
            href="https://github.com/Space3044/imgbed"
            target="_blank"
            rel="noopener noreferrer"
            class="tool-btn"
            aria-label="GitHub 仓库"
          >
            <svg :viewBox="ICONS.github.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true">
              <path :d="ICONS.github.d" />
            </svg>
          </a>

          <RouterLink
            to="/login"
            class="login-btn group flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium tracking-wide text-neon-cyan transition-all duration-200 hover:-translate-y-px hover:text-white hover:shadow-[0_2px_8px_rgba(53,243,255,0.15)]"
          >
            <svg :viewBox="ICONS.plug.vb" fill="currentColor" class="h-3 w-3 opacity-90 transition-transform group-hover:rotate-12" aria-hidden="true">
              <path :d="ICONS.plug.d" />
            </svg>
            <span>接入</span>
          </RouterLink>
        </div>

        <div v-if="isScrolled" class="scan-line pointer-events-none absolute bottom-0 left-0 h-px w-24" aria-hidden="true" />
      </nav>
    </header>

    <main
      class="pt-16"
      :class="fluid ? 'w-full px-3 sm:px-4' : 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8'"
    >
      <slot />
    </main>
  </div>
</template>

<style scoped>
.nav-item::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(53, 243, 255, 0.05);
  opacity: 0;
  transition: opacity 0.25s ease;
  border-radius: inherit;
}

.nav-item:hover::after {
  opacity: 1;
}

.nav-item:hover .nav-icon {
  opacity: 1;
  transform: scale(1.05);
  color: rgb(53, 243, 255);
}

.nav-item.is-active {
  color: rgb(53, 243, 255);
  text-shadow: 0 0 8px rgba(53, 243, 255, 0.4);
}

.nav-item.is-active::after {
  opacity: 1;
  background: rgba(53, 243, 255, 0.08);
}

.nav-item.is-active .nav-icon {
  color: rgb(53, 243, 255);
  opacity: 1;
  filter: drop-shadow(0 0 4px rgba(53, 243, 255, 0.6));
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 0.25rem;
  color: rgb(203, 213, 225);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.25s ease;
}

.tool-btn:hover:not(:disabled) {
  background: rgba(53, 243, 255, 0.08);
  color: rgb(53, 243, 255);
  transform: translateY(-1px);
}

.tool-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.dev-role-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid rgba(53, 243, 255, 0.2);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.55);
}
.dev-role-switch.is-visitor {
  border-color: rgba(255, 79, 216, 0.32);
}
.dev-role-btn {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgb(148, 163, 184);
  background: transparent;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition: color 160ms ease, background-color 160ms ease;
}
.dev-role-btn:hover {
  color: rgb(226, 232, 240);
}
.dev-role-btn.is-on {
  background: rgba(53, 243, 255, 0.16);
  color: rgb(165, 243, 252);
}
.dev-role-switch.is-visitor .dev-role-btn.is-on {
  background: rgba(255, 79, 216, 0.14);
  color: rgb(251, 182, 232);
}

.login-btn {
  backdrop-filter: blur(8px);
}

.scan-line {
  background: linear-gradient(90deg, transparent, rgb(53, 243, 255), transparent);
  animation: scan-across 3s infinite;
}

@keyframes scan-across {
  0% { left: 0; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { left: calc(100% - 6rem); opacity: 0; }
}

@media (max-width: 1200px) {
  .ml-12 { margin-left: 2rem; }
}
@media (max-width: 900px) {
  .ml-12 { margin-left: 1.5rem; }
}
</style>
