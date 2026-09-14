<script setup lang="ts">
import { onMounted } from 'vue';
import { store, ui, loadAll, clearAllData } from './store';
import RecordsView from './components/RecordsView.vue';
import RulesView from './components/RulesView.vue';
import TraceView from './components/TraceView.vue';
import PrintView from './components/PrintView.vue';

onMounted(loadAll);

const tabs = [
  { id: 'records', label: '原记录' },
  { id: 'rules', label: '改号规则' },
  { id: 'trace', label: '沿革核对' },
  { id: 'card', label: '联系卡打印' },
] as const;

async function clearAll() {
  if (!window.confirm('确定要清除全部数据吗？联系人、原记录、改号规则、试拨标记和照片都会删除。')) return;
  if (!window.confirm('请再次确认：清除后无法恢复。仍要清除吗？')) return;
  await clearAllData();
  ui.tab = 'records';
  ui.traceRecordId = '';
  ui.printRecordId = '';
}
</script>

<template>
  <div class="page">
    <header class="app-header no-print">
      <h1>旧号码沿革核对</h1>
      <p class="tagline">
        把老电话本上的号码，按改号规则一步步推到今天。所有数据（原页照片、联系人、核对进度）只保存在本浏览器，不上传、不联网。
      </p>
    </header>

    <nav v-if="store.ready" class="tabs no-print" aria-label="主导航">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        class="tab"
        :class="{ active: ui.tab === t.id }"
        @click="ui.tab = t.id"
      >
        {{ t.label }}
      </button>
    </nav>

    <main v-if="store.ready" class="main">
      <RecordsView v-if="ui.tab === 'records'" />
      <RulesView v-else-if="ui.tab === 'rules'" />
      <TraceView v-else-if="ui.tab === 'trace'" />
      <PrintView v-else-if="ui.tab === 'card'" />
    </main>
    <div v-else class="loading">正在打开本机保存的数据……</div>

    <footer v-if="store.ready" class="app-footer no-print">
      <p>
        提醒：本应用只根据您录入的规则推算候选号码，不保证任何号码仍属于原联系人；试拨结果请自行核实。
      </p>
      <button type="button" class="btn danger small" @click="clearAll">清除全部数据</button>
    </footer>

    <div v-if="store.toastMessage" class="toast no-print" role="status">{{ store.toastMessage }}</div>
  </div>
</template>
