<script setup lang="ts">
import AppShell from '@/shared/ui/AppShell.vue';
// 阶段 5：站点统计接 GET /api/stats（待规划），目前用 -- 占位
</script>

<template>
  <AppShell fluid>
    <div class="relative isolate overflow-hidden">
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10">
        <div class="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-neon-cyan/20 blur-3xl"></div>
        <div class="absolute -bottom-24 right-1/4 h-80 w-80 rounded-full bg-neon-pink/20 blur-3xl"></div>
        <div class="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-neon-violet/15 blur-3xl"></div>
      </div>

      <div class="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center sm:py-32">
        <p class="text-xs font-bold uppercase tracking-[0.4em] text-neon-cyan">Personal Image Hosting</p>

        <h1 class="mt-6 text-5xl font-black leading-none tracking-tight text-white sm:text-7xl lg:text-8xl">
          <span class="bg-gradient-to-r from-neon-cyan via-white to-neon-pink bg-clip-text text-transparent">Pixel Space</span>
        </h1>

        <p class="mt-8 max-w-2xl text-lg text-slate-200 sm:text-xl">
          让图片管理从繁琐到简单，让分享从等待到极速
        </p>
        <p class="mt-3 text-sm text-slate-400">
          AI 自动标注 · 压缩图秒发 · 原图安心归档
        </p>

        <div class="mt-12 flex flex-wrap items-center justify-center gap-3">
          <RouterLink to="/images" class="cyber-button">探索图库</RouterLink>
          <RouterLink to="/upload" class="cyber-button">开始上传</RouterLink>
          <RouterLink to="/login" class="cyber-button">接入管理</RouterLink>
        </div>

        <div class="mt-20 grid w-full max-w-3xl grid-cols-3 gap-6 sm:gap-12">
          <div class="text-center">
            <div class="font-mono text-3xl font-black text-white sm:text-5xl">--</div>
            <div class="mt-2 text-xs uppercase tracking-[0.3em] text-slate-400">Photos</div>
          </div>
          <div class="text-center">
            <div class="font-mono text-3xl font-black text-white sm:text-5xl">--</div>
            <div class="mt-2 text-xs uppercase tracking-[0.3em] text-slate-400">Storage</div>
          </div>
          <div class="text-center">
            <div class="font-mono text-3xl font-black text-white sm:text-5xl">--</div>
            <div class="mt-2 text-xs uppercase tracking-[0.3em] text-slate-400">AI Tagged</div>
          </div>
        </div>
      </div>

      <div class="mx-auto max-w-7xl px-6 pb-24">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article class="cyber-panel rounded-2xl p-6">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-cyan/15 text-neon-cyan">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
                <path d="M12 2 2 7l10 5 10-5-10-5z" />
                <path d="m2 17 10 5 10-5" />
                <path d="m2 12 10 5 10-5" />
              </svg>
            </div>
            <h3 class="mt-4 text-base font-bold text-white">Cloudflare 全栈</h3>
            <p class="mt-2 text-sm text-slate-400">Pages + Functions + D1 + R2，边缘网络全球加速</p>
          </article>

          <article class="cyber-panel rounded-2xl p-6">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-pink/15 text-neon-pink">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              </svg>
            </div>
            <h3 class="mt-4 text-base font-bold text-white">AI 智能标注</h3>
            <p class="mt-2 text-sm text-slate-400">自动生成描述、标签和搜索关键词，搜索更精准</p>
          </article>

          <article class="cyber-panel rounded-2xl p-6">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-violet/15 text-neon-violet">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                <path d="M9 12h6" />
                <path d="M12 9v6" />
              </svg>
            </div>
            <h3 class="mt-4 text-base font-bold text-white">压缩 + 归档</h3>
            <p class="mt-2 text-sm text-slate-400">公开 WebP 走 CDN，原图私密归档到 Telegram</p>
          </article>

          <article class="cyber-panel rounded-2xl p-6">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-lime/15 text-neon-lime">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 class="mt-4 text-base font-bold text-white">Access 鉴权</h3>
            <p class="mt-2 text-sm text-slate-400">GitHub 登录 + 邮箱白名单，管理路径只属于你</p>
          </article>
        </div>
      </div>
    </div>
  </AppShell>
</template>
