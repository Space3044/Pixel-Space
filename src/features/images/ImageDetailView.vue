<script setup lang="ts">
import AppShell from '@/shared/ui/AppShell.vue';
</script>

<template>
  <AppShell>
    <section class="cyber-panel rounded-[2rem] p-8">
      <p class="text-sm font-bold uppercase tracking-[0.3em] text-neon-cyan">Image Detail</p>
      <h1 class="mt-4 text-3xl font-black text-white">图片详情</h1>
      <p class="mt-3 text-slate-300">
        这里后续读取单张图片元数据，并提供复制链接、手动位置和管理员操作入口。
      </p>
    </section>
  </AppShell>
</template>
