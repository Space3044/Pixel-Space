<script setup lang="ts">
import type { FolderOption } from './useLibraryDirectory';

defineProps<{
  currentFolderId: string | null;
  folderOptions: FolderOption[];
  selectedCount: number;
}>();

const moveTarget = defineModel<string>('moveTarget', { required: true });

const emit = defineEmits<{
  cancel: [];
  delete: [];
  move: [];
  openGrant: [];
}>();
</script>

<template>
  <Transition name="move-bar">
    <div v-if="selectedCount > 0" class="move-bar" role="region" aria-label="批量移动">
      <span>已选 {{ selectedCount }} 张</span>
      <label class="move-bar-control">
        <span>移动到</span>
        <select v-model="moveTarget" class="move-select">
          <option value="__none__">/ 根目录</option>
          <option
            v-for="opt in folderOptions"
            :key="opt.id"
            :value="opt.id"
            :disabled="opt.id === currentFolderId"
          >
            {{ '— '.repeat(opt.depth) }}{{ opt.label }}
          </option>
        </select>
      </label>
      <button type="button" class="library-btn primary" @click="emit('openGrant')">生成验证码</button>
      <button type="button" class="library-btn primary" @click="emit('move')">移动</button>
      <button type="button" class="library-btn danger" @click="emit('delete')">删除</button>
      <button type="button" class="library-btn ghost" @click="emit('cancel')">取消</button>
    </div>
  </Transition>
</template>

<style scoped src="./library-view.css"></style>
