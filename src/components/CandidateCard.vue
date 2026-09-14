<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Candidate, DialStatus, PhoneRecord } from '../types';
import { STATUS_LABEL, STATUS_ORDER } from '../types';
import { store, addMark, latestMarkByKey, fmtTime } from '../store';
import DigitChainSvg from './DigitChainSvg.vue';
import EvidencePanel from './EvidencePanel.vue';

const props = defineProps<{ record: PhoneRecord; candidate: Candidate }>();

const showChain = ref(false);
const showEvidence = ref(false);
const note = ref('');

const mark = computed(() => latestMarkByKey.value.get(props.candidate.key));
const history = computed(() =>
  store.marks
    .filter((m) => m.candidateKey === props.candidate.key && !m.undone)
    .sort((a, b) => b.createdAt - a.createdAt),
);

async function markAs(status: DialStatus) {
  await addMark(props.record.id, props.candidate, status, note.value.trim());
  note.value = '';
}
</script>

<template>
  <article class="candidate" :class="{ confirmed: mark?.status === 'connected' }">
    <header class="candidate-head">
      <span class="mono big">{{ candidate.digits }}</span>
      <span v-if="record.extension" class="muted">（{{ record.extension }}）</span>
      <span v-if="mark" class="status" :class="mark.status">{{ STATUS_LABEL[mark.status] }}</span>
    </header>

    <div v-if="candidate.warnings.length" class="chips">
      <span v-for="w in candidate.warnings" :key="w" class="chip warn">{{ w }}</span>
    </div>
    <div v-if="candidate.assumptions.length" class="chips">
      <span v-for="a in candidate.assumptions" :key="a" class="chip assume">{{ a }}</span>
    </div>

    <div class="dial-panel">
      <input v-model="note" class="input" placeholder="试拨备注（可不填），如：接电话的是位老太太，说不认识" />
      <div class="btn-row">
        <button
          v-for="s in STATUS_ORDER"
          :key="s"
          type="button"
          class="btn dial"
          :class="s"
          @click="markAs(s)"
        >
          记为{{ STATUS_LABEL[s] }}
        </button>
      </div>
    </div>

    <div class="btn-row">
      <button type="button" class="btn small" @click="showChain = !showChain">
        {{ showChain ? '收起数字变化' : '看数字怎样一步步变来' }}
      </button>
      <button type="button" class="btn small" @click="showEvidence = !showEvidence">
        {{ showEvidence ? '收起原页依据' : '看原页依据' }}
      </button>
    </div>

    <div v-if="showChain" class="chain">
      <div class="chain-origin">
        <span class="chain-label">电话本原样</span>
        <span class="mono">{{ record.rawText }}</span>
        <span class="muted">（数字部分：{{ record.digits }}）</span>
      </div>
      <template v-for="(st, i) in candidate.steps" :key="i">
        <div class="chain-arrow" aria-hidden="true">↓</div>
        <DigitChainSvg :step="st" />
      </template>
      <p v-if="candidate.steps.length === 0" class="muted">没有匹配到任何改号规则，号码保持原样。</p>
      <div class="chain-final">
        <span class="chain-label">推算出的候选</span>
        <span class="mono big">{{ candidate.digits }}</span>
      </div>
      <p class="legend">
        连线含义：
        <span class="legend-item keep">— 保留</span>
        <span class="legend-item replace">— 替换</span>
        <span class="legend-item insert">┄ 插入</span>
        <span class="legend-item delete">— 删去</span>
      </p>
    </div>

    <EvidencePanel v-if="showEvidence" :record="record" />

    <details v-if="history.length" class="history">
      <summary>这条候选的试拨记录（{{ history.length }}）</summary>
      <p v-for="m in history" :key="m.id" class="mark-row">
        {{ fmtTime(m.createdAt) }} 记为「{{ STATUS_LABEL[m.status] }}」<span v-if="m.note">：{{ m.note }}</span>
      </p>
    </details>
  </article>
</template>
