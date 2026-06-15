<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { FolderRecord } from '@/features/library/library.api';

interface Props {
  modelValue: string;
  folders: FolderRecord[];
  placeholder?: string;
  noneLabel?: string;
  showNone?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '全部文件夹',
  noneLabel: '未分类',
  showNone: true,
});
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const open = ref(false);
const search = ref('');
// 用户手动展开的节点。搜索时另走 effectiveExpanded 自动全展。
const expandedIds = ref<Set<string>>(new Set());
const rootRef = ref<HTMLElement | null>(null);

interface TreeNode {
  id: string;
  name: string;
  path: string;
  children: TreeNode[];
}

const tree = computed<TreeNode[]>(() => {
  const byParent = new Map<string | null, FolderRecord[]>();
  for (const folder of props.folders) {
    const list = byParent.get(folder.parent_id) ?? [];
    list.push(folder);
    byParent.set(folder.parent_id, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }
  const build = (parentId: string | null, prefix: string): TreeNode[] => {
    const children = byParent.get(parentId) ?? [];
    return children.map((c) => {
      const path = prefix ? `${prefix} / ${c.name}` : c.name;
      return { id: c.id, name: c.name, path, children: build(c.id, path) };
    });
  };
  return build(null, '');
});

const findNodeById = (nodes: TreeNode[], id: string): TreeNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNodeById(node.children, id);
    if (hit) return hit;
  }
  return null;
};

const currentLabel = computed(() => {
  if (props.modelValue === '') return props.placeholder;
  if (props.modelValue === '__none__') return props.noneLabel;
  return findNodeById(tree.value, props.modelValue)?.path ?? '未知文件夹';
});

const trimmedSearch = computed(() => search.value.trim().toLowerCase());

// 过滤：保留匹配节点及其祖先链
const filteredTree = computed<TreeNode[]>(() => {
  if (!trimmedSearch.value) return tree.value;
  const q = trimmedSearch.value;
  const filter = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .map((n) => {
        const sub = filter(n.children);
        const selfMatch = n.name.toLowerCase().includes(q);
        if (selfMatch || sub.length > 0) return { ...n, children: sub };
        return null;
      })
      .filter((x): x is TreeNode => x !== null);
  return filter(tree.value);
});

// 搜索时把过滤后的所有非叶节点都展开，匹配链一目了然
const effectiveExpanded = computed<Set<string>>(() => {
  if (!trimmedSearch.value) return expandedIds.value;
  const set = new Set<string>();
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.children.length > 0) {
        set.add(n.id);
        walk(n.children);
      }
    }
  };
  walk(filteredTree.value);
  return set;
});

interface FlatNode {
  id: string;
  name: string;
  depth: number;
  hasChildren: boolean;
}

// 把可见树扁平化，按深度算左 padding，避免递归组件
const visibleNodes = computed<FlatNode[]>(() => {
  const result: FlatNode[] = [];
  const expanded = effectiveExpanded.value;
  const walk = (nodes: TreeNode[], depth: number) => {
    for (const n of nodes) {
      const hasChildren = n.children.length > 0;
      result.push({ id: n.id, name: n.name, depth, hasChildren });
      if (hasChildren && expanded.has(n.id)) walk(n.children, depth + 1);
    }
  };
  walk(filteredTree.value, 0);
  return result;
});

const toggle = () => {
  open.value = !open.value;
};

const close = () => {
  open.value = false;
};

const choose = (value: string) => {
  emit('update:modelValue', value);
  close();
};

const toggleExpand = (id: string) => {
  const next = new Set(expandedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedIds.value = next;
};

const onDocumentMouseDown = (e: MouseEvent) => {
  if (!open.value) return;
  const target = e.target as Node | null;
  if (rootRef.value && target && !rootRef.value.contains(target)) close();
};

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') close();
};

watch(open, (val) => {
  if (val) {
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onKeydown);
  } else {
    search.value = '';
    document.removeEventListener('mousedown', onDocumentMouseDown);
    document.removeEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="rootRef" class="folder-picker">
    <button
      type="button"
      class="folder-trigger"
      :class="{ active: open }"
      aria-haspopup="true"
      :aria-expanded="open"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="folder-icon" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
      <span class="folder-trigger-label">{{ currentLabel }}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="folder-caret" :class="{ open }" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div v-if="open" class="folder-popover" role="dialog" aria-label="文件夹筛选">
      <div class="folder-search-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          v-model="search"
          type="search"
          class="folder-search-input"
          placeholder="搜索文件夹"
          aria-label="搜索文件夹"
        />
      </div>

      <div class="folder-quicklinks">
        <div
          role="button"
          tabindex="0"
          class="folder-row"
          :class="{ chosen: props.modelValue === '' }"
          @click="choose('')"
          @keydown.enter="choose('')"
          @keydown.space.prevent="choose('')"
        >
          <span class="folder-row-spacer" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="folder-row-icon" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
          </svg>
          <span class="folder-row-label">{{ placeholder }}</span>
        </div>
        <div
          v-if="showNone"
          role="button"
          tabindex="0"
          class="folder-row"
          :class="{ chosen: props.modelValue === '__none__' }"
          @click="choose('__none__')"
          @keydown.enter="choose('__none__')"
          @keydown.space.prevent="choose('__none__')"
        >
          <span class="folder-row-spacer" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="folder-row-icon" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M9 12h6" />
          </svg>
          <span class="folder-row-label">{{ noneLabel }}</span>
        </div>
      </div>

      <div class="folder-tree">
        <p v-if="visibleNodes.length === 0" class="folder-empty">
          {{ trimmedSearch ? '没有匹配的文件夹' : '还没有文件夹' }}
        </p>

        <div
          v-for="node in visibleNodes"
          v-else
          :key="node.id"
          role="button"
          tabindex="0"
          class="folder-row"
          :class="{ chosen: props.modelValue === node.id }"
          :style="{ paddingLeft: `${node.depth * 16 + 8}px` }"
          @click="choose(node.id)"
          @keydown.enter="choose(node.id)"
          @keydown.space.prevent="choose(node.id)"
        >
          <button
            v-if="node.hasChildren"
            type="button"
            class="folder-caret-btn"
            :aria-label="effectiveExpanded.has(node.id) ? '收起' : '展开'"
            @click.stop="toggleExpand(node.id)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="caret-svg" :class="{ open: effectiveExpanded.has(node.id) }" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
          <span v-else class="folder-row-spacer" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="folder-row-icon" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span class="folder-row-label">{{ node.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.folder-picker {
  position: relative;
}

.folder-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  height: 32px;
  max-width: 14rem;
  border: 1px solid rgba(53, 243, 255, 0.18);
  border-radius: 6px;
  background: rgba(9, 14, 28, 0.72);
  padding: 0 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: rgb(203, 213, 225);
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
}

.folder-trigger:hover,
.folder-trigger:focus-visible,
.folder-trigger.active {
  border-color: rgba(53, 243, 255, 0.62);
  color: rgb(53, 243, 255);
  outline: none;
}

.folder-trigger.active {
  box-shadow: 0 0 0 2px rgba(53, 243, 255, 0.18);
}

.folder-icon,
.folder-caret {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.folder-icon {
  color: rgba(165, 243, 252, 0.85);
}

.folder-caret {
  margin-left: 0.1rem;
  transition: transform 160ms ease;
}

.folder-caret.open {
  transform: rotate(180deg);
}

.folder-trigger-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  width: clamp(240px, 18rem, 22rem);
  border: 1px solid rgba(53, 243, 255, 0.28);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(53, 243, 255, 0.08), transparent 42%),
    rgba(7, 7, 19, 0.92);
  backdrop-filter: blur(18px);
  box-shadow: 0 16px 40px rgba(2, 4, 14, 0.55), 0 0 0 1px rgba(53, 243, 255, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.folder-search-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.6rem;
  border-bottom: 1px solid rgba(53, 243, 255, 0.12);
  background: rgba(9, 14, 28, 0.55);
}

.search-icon {
  width: 14px;
  height: 14px;
  color: rgba(165, 243, 252, 0.7);
  flex-shrink: 0;
}

.folder-search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: rgb(226, 232, 240);
  font-size: 0.78rem;
  outline: none;
}

.folder-search-input::placeholder {
  color: rgba(148, 163, 184, 0.6);
}

.folder-quicklinks {
  display: flex;
  flex-direction: column;
  padding: 0.3rem 0;
  border-bottom: 1px solid rgba(53, 243, 255, 0.1);
}

.folder-tree {
  max-height: 18rem;
  overflow-y: auto;
  padding: 0.3rem 0;
}

.folder-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 32px;
  padding: 0 0.6rem 0 0.5rem;
  font-size: 0.78rem;
  color: rgb(203, 213, 225);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
  user-select: none;
}

.folder-row:hover,
.folder-row:focus-visible {
  background: rgba(53, 243, 255, 0.08);
  color: rgb(165, 243, 252);
  outline: none;
}

.folder-row.chosen {
  background: rgba(53, 243, 255, 0.14);
  color: rgb(53, 243, 255);
}

.folder-row-spacer {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.folder-caret-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: 0;
  background: transparent;
  padding: 0;
  color: rgba(165, 243, 252, 0.7);
  cursor: pointer;
  border-radius: 3px;
}

.folder-caret-btn:hover {
  color: rgb(53, 243, 255);
  background: rgba(53, 243, 255, 0.16);
}

.caret-svg {
  width: 12px;
  height: 12px;
  transition: transform 160ms ease;
}

.caret-svg.open {
  transform: rotate(90deg);
}

.folder-row-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: rgba(165, 243, 252, 0.75);
}

.folder-row-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-empty {
  padding: 0.6rem 0.75rem;
  margin: 0;
  font-size: 0.78rem;
  color: rgba(148, 163, 184, 0.7);
}

.folder-tree::-webkit-scrollbar {
  width: 6px;
}

.folder-tree::-webkit-scrollbar-thumb {
  background: rgba(53, 243, 255, 0.22);
  border-radius: 3px;
}

.folder-tree::-webkit-scrollbar-track {
  background: transparent;
}

@media (max-width: 767px) {
  .folder-popover {
    position: fixed;
    left: 0.75rem;
    right: 0.75rem;
    top: calc(4.75rem + env(safe-area-inset-top, 0px));
    bottom: calc(5rem + env(safe-area-inset-bottom));
    z-index: 60;
    width: auto;
    max-height: none;
  }

  .folder-tree {
    flex: 1;
    min-height: 0;
    max-height: none;
  }
}
</style>
