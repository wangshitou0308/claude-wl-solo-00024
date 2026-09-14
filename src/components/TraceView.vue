<script setup lang="ts">
import { computed } from 'vue';
import { STATUS_LABEL } from '../types';
import {
  store,
  ui,
  contactName,
  fmtTime,
  candidatesByRecord,
  contradictions,
  orphanMarks,
  undoLastMark,
  restoreMark,
  deleteMark,
} from '../store';
import CandidateCard from './CandidateCard.vue';

const record = computed(() => store.records.find((r) => r.id === ui.traceRecordId) ?? null);

const build = computed(() => {
  if (!record.value) return { candidates: [], truncated: false };
  return candidatesByRecord.value.get(record.value.id) ?? { candidates: [], truncated: false };
});

const recordOrphans = computed(() =>
  record.value ? orphanMarks.value.filter((m) => m.recordId === record.value!.id) : [],
);

const recordUndone = computed(() =>
  record.value
    ? store.marks.filter((m) => m.undone && m.recordId === record.value!.id).sort((a, b) => b.createdAt - a.createdAt)
    : [],
);

function locateRules(ids: string[]) {
  store.highlightRuleId = ids[0];
  ui.tab = 'rules';
}
</script>

<template>
  <section class="panel">
    <h2>沿革核对</h2>
    <p class="hint">
      选择一条原记录，应用按时间先后套用改号规则，列出所有相容的候选号码；日期跨越规则、规则重叠或批注缺位时，候选会全部保留，不会替您猜。
    </p>

    <div v-if="contradictions.length" class="contradictions" role="alert">
      <div v-for="c in contradictions" :key="c.id" class="contradiction">
        <span>{{ c.message }}</span>
        <button v-if="c.ruleIds.length" type="button" class="btn small" @click="locateRules(c.ruleIds)">
          定位到相关规则
        </button>
      </div>
    </div>

    <div v-if="!store.records.length" class="empty">还没有原记录，请先到「原记录」页添加。</div>

    <template v-else>
      <label class="field">
        <span class="field-label">选择原记录</span>
        <select v-model="ui.traceRecordId" class="input">
          <option value="" disabled>请选择一条原记录</option>
          <option v-for="r in store.records" :key="r.id" :value="r.id">
            {{ contactName(r.contactId) }} — {{ r.rawText }}
          </option>
        </select>
      </label>

      <template v-if="record">
        <div class="record-bar">
          <span>候选 <strong>{{ build.candidates.length }}</strong> 条</span>
          <button type="button" class="btn small" @click="undoLastMark">撤销上一笔记号</button>
        </div>
        <p v-if="build.truncated" class="warn-text">
          候选过多，仅显示前 48 条。请补充记录年代或当时地区，让推算收窄。
        </p>

        <CandidateCard v-for="c in build.candidates" :key="c.key" :record="record" :candidate="c" />

        <details v-if="recordOrphans.length" class="fold">
          <summary>已失效的标记（{{ recordOrphans.length }}）— 因规则或原记录被修改</summary>
          <p class="hint">这些标记依据的是旧版规则，对应的候选已不存在，仅供参考，可删除。</p>
          <p v-for="m in recordOrphans" :key="m.id" class="mark-row">
            <span class="mono">{{ m.digits }}</span>
            「{{ STATUS_LABEL[m.status] }}」 {{ fmtTime(m.createdAt) }}
            <button type="button" class="btn small danger" @click="deleteMark(m.id)">删除</button>
          </p>
        </details>

        <details v-if="recordUndone.length" class="fold">
          <summary>已撤销的标记（{{ recordUndone.length }}）</summary>
          <p v-for="m in recordUndone" :key="m.id" class="mark-row">
            <span class="mono">{{ m.digits }}</span>
            「{{ STATUS_LABEL[m.status] }}」 {{ fmtTime(m.createdAt) }}
            <button type="button" class="btn small" @click="restoreMark(m.id)">恢复</button>
            <button type="button" class="btn small danger" @click="deleteMark(m.id)">彻底删除</button>
          </p>
        </details>
      </template>
      <p v-else class="empty">请在上方选择一条原记录。</p>
    </template>
  </section>
</template>
