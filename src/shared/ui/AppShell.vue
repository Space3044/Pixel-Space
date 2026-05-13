<template>
  <div class="min-h-screen overflow-x-hidden bg-grid bg-[length:32px_32px]">
    <header class="border-b border-white/10 bg-void/80 backdrop-blur-xl">
      <nav class="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <RouterLink to="/images" class="text-base font-black tracking-[0.28em] text-white">
          UFO IMG
        </RouterLink>

        <div class="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <RouterLink class="rounded-full px-4 py-2 hover:bg-white/10 hover:text-white" to="/images">图库</RouterLink>
          <RouterLink class="rounded-full px-4 py-2 hover:bg-white/10 hover:text-white" to="/upload">上传</RouterLink>
          <RouterLink class="rounded-full px-4 py-2 hover:bg-white/10 hover:text-white" to="/login">登录</RouterLink>
        </div>
      </nav>
    </header>

    <main class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>
