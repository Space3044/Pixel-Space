<script setup lang="ts">
// og:image 注入位置占位
// 阶段 5 拿到 ImageRecord 后，在 onMounted 中通过 document.head
// 动态写入 og:image / og:title / og:description（路由级 meta，不在 index.html 全局加）
// 当前阶段不接 API，保持空白
</script>

<template>
  <main class="min-h-screen bg-grid bg-[length:32px_32px]">
    <header class="border-b border-white/10 bg-void/80 backdrop-blur-xl">
      <div class="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <RouterLink to="/" class="flex items-center gap-1.5 font-mono text-base font-black leading-none tracking-wider">
          <span class="text-neon-cyan [text-shadow:0_0_8px_rgba(53,243,255,0.7)]">Pixel</span>
          <span class="text-neon-pink [text-shadow:0_0_8px_rgba(255,79,216,0.7)]">Space</span>
        </RouterLink>
        <RouterLink to="/images" class="text-sm font-semibold text-slate-300 hover:text-white">
          返回图库
        </RouterLink>
      </div>
    </header>

    <article class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <figure class="cyber-panel overflow-hidden rounded-[2rem]">
        <div class="aspect-[4/3] w-full bg-void/60" aria-label="图片占位"></div>
      </figure>

      <section class="cyber-panel mt-6 rounded-[2rem] p-8">
        <div class="h-7 w-2/3 rounded bg-white/10"></div>
        <div class="mt-4 space-y-2">
          <div class="h-3 w-full rounded bg-white/5"></div>
          <div class="h-3 w-4/5 rounded bg-white/5"></div>
        </div>
        <div class="mt-6 flex flex-wrap gap-2">
          <span class="h-6 w-16 rounded-full bg-white/5"></span>
          <span class="h-6 w-20 rounded-full bg-white/5"></span>
          <span class="h-6 w-12 rounded-full bg-white/5"></span>
        </div>
      </section>
    </article>
  </main>
</template>
