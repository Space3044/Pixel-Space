<script setup lang="ts">
import { computed, ref } from 'vue';
import { searchLocations, type GeocodeRegion, type GeocodeResult } from './geocode.api';

const props = defineProps<{ modelValue?: GeocodeRegion }>();
const emit = defineEmits<{
  select: [result: GeocodeResult];
  'region-change': [region: GeocodeRegion];
  'update:modelValue': [region: GeocodeRegion];
}>();

const query = ref('');
const localRegion = ref<GeocodeRegion>('cn');
const selectedRegion = computed(() => props.modelValue ?? localRegion.value);
const results = ref<GeocodeResult[]>([]);
const searching = ref(false);
const error = ref<string | null>(null);

const runSearch = async () => {
  const keyword = query.value.trim();
  if (!keyword || searching.value) return;

  searching.value = true;
  error.value = null;
  try {
    results.value = await searchLocations(keyword, selectedRegion.value);
  } catch (e) {
    error.value = (e as Error).message;
    results.value = [];
  } finally {
    searching.value = false;
  }
};

const selectResult = (result: GeocodeResult) => {
  query.value = result.name;
  results.value = [];
  emit('select', result);
};

const setRegion = (region: GeocodeRegion) => {
  localRegion.value = region;
  emit('update:modelValue', region);
  emit('region-change', region);
  results.value = [];
  error.value = null;
};
</script>

<template>
  <div class="location-search">
    <div class="location-region-toggle" role="group" aria-label="选择位置搜索范围">
      <button
        type="button"
        class="location-region-button"
        :class="{ active: selectedRegion === 'cn' }"
        @click="setRegion('cn')"
      >
        国内
      </button>
      <button
        type="button"
        class="location-region-button"
        :class="{ active: selectedRegion === 'global' }"
        @click="setRegion('global')"
      >
        国外
      </button>
    </div>

    <form class="location-search-form" @submit.prevent="runSearch">
      <input
        v-model="query"
        type="search"
        class="location-search-input"
        aria-label="搜索位置"
      />
      <button type="submit" class="location-search-button" :disabled="searching || !query.trim()">
        {{ searching ? '搜索中…' : '搜索' }}
      </button>
    </form>

    <p v-if="error" class="location-search-error">{{ error }}</p>
    <p v-else-if="!searching && results.length === 0 && query.trim()" class="location-search-hint">
      输入地点后点搜索，不会自动联想。
    </p>

    <ul v-if="results.length" class="location-search-results">
      <li v-for="result in results" :key="`${result.lat},${result.lng},${result.name}`">
        <button type="button" class="location-result" @click="selectResult(result)">
          <span :title="result.name">{{ result.name }}</span>
          <small :title="`${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}`">{{ result.lat.toFixed(6) }}, {{ result.lng.toFixed(6) }}</small>
          <strong>选择位置</strong>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.location-search {
  display: grid;
  gap: 0.55rem;
}

.location-search-form {
  display: flex;
  gap: 0.4rem;
  align-items: stretch;
}

.location-region-toggle {
  display: inline-flex;
  width: fit-content;
  overflow: hidden;
  border: 1px solid rgba(53, 243, 255, 0.18);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.52);
}

.location-region-button {
  border: 0;
  background: transparent;
  padding: 0.35rem 0.7rem;
  color: rgba(148, 163, 184, 0.92);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 800;
}

.location-region-button.active {
  background: rgba(53, 243, 255, 0.14);
  color: rgb(165, 243, 252);
}

.location-search-input {
  min-width: 0;
  flex: 1;
  border: 1px solid rgba(53, 243, 255, 0.18);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.72);
  padding: 0.55rem 0.65rem;
  color: rgb(226, 232, 240);
  outline: none;
}

.location-search-input:focus {
  border-color: rgba(53, 243, 255, 0.65);
  box-shadow: 0 0 0 2px rgba(53, 243, 255, 0.12);
}

.location-search-button,
.location-result {
  border: 1px solid rgba(53, 243, 255, 0.24);
  border-radius: 4px;
  background: rgba(53, 243, 255, 0.08);
  color: rgb(165, 243, 252);
  cursor: pointer;
  font-weight: 800;
}

.location-search-button {
  flex-shrink: 0;
  padding: 0 0.55rem;
  min-height: 0;
  font-size: 0.72rem;
  white-space: nowrap;
}

.location-search-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.location-search-error,
.location-search-hint {
  margin: 0;
  font-size: 0.75rem;
}

.location-search-error {
  color: rgb(251, 113, 133);
}

.location-search-hint {
  color: rgba(148, 163, 184, 0.82);
}

.location-search-results {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.location-result {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.18rem 0.75rem;
  padding: 0.55rem 0.65rem;
  text-align: left;
}

.location-result:hover {
  border-color: rgba(53, 243, 255, 0.52);
  background: rgba(53, 243, 255, 0.13);
}

.location-result span,
.location-result small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-result span {
  font-size: 0.78rem;
  color: rgb(226, 232, 240);
}

.location-result small {
  color: rgba(148, 163, 184, 0.86);
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.68rem;
}

.location-result strong {
  grid-row: 1 / 3;
  grid-column: 2 / 3;
  align-self: center;
  color: rgb(165, 243, 252);
  font-size: 0.72rem;
}

@media (max-width: 640px) {
  .location-search-form {
    flex-direction: column;
  }

  .location-search-button {
    min-height: 2.25rem;
  }
}
</style>
