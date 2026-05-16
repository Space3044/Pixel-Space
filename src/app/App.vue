<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

// 开发态加载标注工具，生产构建时 import.meta.env.DEV 为 false，
// 整段分支会被 Vite 当作 dead code 消除，agent-ui-annotation 不会进入产物
const DevAnnotation = import.meta.env.DEV
  ? defineAsyncComponent(() => import('@/dev/DevAnnotation.vue'))
  : null;
</script>

<template>
  <RouterView />
  <component :is="DevAnnotation" v-if="DevAnnotation" />
</template>
