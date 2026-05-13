<script setup lang="ts">
import AppShell from '@/shared/ui/AppShell.vue';
</script>

<template>
  <AppShell>
    <section class="cyber-panel mx-auto max-w-2xl rounded-[2rem] p-8">
      <p class="text-sm font-bold uppercase tracking-[0.3em] text-neon-cyan">Admin Access</p>
      <h1 class="mt-4 text-3xl font-black text-white">GitHub 管理员登录</h1>
      <p class="mt-3 text-slate-300">
        后续由 Cloudflare Access 接 GitHub。这里先保留入口页面，具体配置到部署阶段再做。
      </p>
      <RouterLink to="/upload" class="cyber-button mt-8 inline-flex">进入上传页</RouterLink>
    </section>
  </AppShell>
</template>
