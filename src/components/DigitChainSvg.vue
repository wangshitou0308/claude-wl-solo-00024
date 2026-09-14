<script setup lang="ts">
import { computed } from 'vue';
import type { ChainStep } from '../types';

const props = defineProps<{ step: ChainStep }>();

const BOX = 34;
const GAP = 6;
const PAD = 10;
const ROW_H = 40;
const TOP_Y = 6;
const BOT_Y = 92;
const HEIGHT = BOT_Y + ROW_H + 6;

interface Link {
  d: string;
  kind: 'keep' | 'replace' | 'delete';
}

const boxX = (i: number) => PAD + i * (BOX + GAP);

const layout = computed(() => {
  const s = props.step;
  const before = s.before.split('');
  const after = s.after.split('');
  const pOld = s.oldPrefix.length;
  const pNew = s.newPrefix.length;
  const width = Math.max(before.length, after.length, 1) * (BOX + GAP) - GAP + PAD * 2;
  const cx = (i: number) => boxX(i) + BOX / 2;
  const y1 = TOP_Y + ROW_H;
  const y2 = BOT_Y;
  const curve = (x1: number, x2: number) => `M ${x1} ${y1} C ${x1} ${y1 + 26}, ${x2} ${y2 - 26}, ${x2} ${y2}`;

  const links: Link[] = [];
  const inserts: { x: number }[] = [];
  const deletes: { x: number }[] = [];
  const topRole: string[] = before.map(() => 'same');
  const botRole: string[] = after.map(() => 'same');

  if (pNew >= pOld) {
    // 前缀变长（含纯插入）：左对齐，多出的新数字算插入
    for (let i = 0; i < pOld; i++) {
      const same = before[i] === after[i];
      links.push({ d: curve(cx(i), cx(i)), kind: same ? 'keep' : 'replace' });
      topRole[i] = same ? 'same' : 'chg';
      botRole[i] = same ? 'same' : 'chg';
    }
    for (let j = pOld; j < pNew; j++) {
      inserts.push({ x: cx(j) });
      botRole[j] = 'ins';
    }
  } else {
    // 前缀变短：右对齐，多出的旧数字算删去
    const del = pOld - pNew;
    for (let i = 0; i < del; i++) {
      links.push({ d: `M ${cx(i)} ${y1} L ${cx(i)} ${y1 + 24}`, kind: 'delete' });
      deletes.push({ x: cx(i) });
      topRole[i] = 'del';
    }
    for (let i = del; i < pOld; i++) {
      const same = before[i] === after[i - del];
      links.push({ d: curve(cx(i), cx(i - del)), kind: same ? 'keep' : 'replace' });
      topRole[i] = same ? 'same' : 'chg';
      botRole[i - del] = same ? 'same' : 'chg';
    }
  }
  // 前缀之后的部分逐位保留
  for (let k = 0; k < before.length - pOld; k++) {
    links.push({ d: curve(cx(pOld + k), cx(pNew + k)), kind: 'keep' });
  }

  return { width, links, inserts, deletes, before, after, topRole, botRole };
});
</script>

<template>
  <div class="chain-step">
    <p class="chain-caption">
      <strong>{{ step.year }} 年</strong> 应用「{{ step.ruleName }}」：
      <template v-if="step.oldPrefix === ''">在最前面加入「{{ step.newPrefix }}」</template>
      <template v-else>开头「{{ step.oldPrefix }}」换成「{{ step.newPrefix || '（删去）' }}」</template>
    </p>
    <div class="chain-scroll">
      <svg
        :width="layout.width"
        :height="HEIGHT"
        :viewBox="`0 0 ${layout.width} ${HEIGHT}`"
        class="chain-svg"
        role="img"
        :aria-label="`${step.before} 变为 ${step.after}`"
      >
        <path v-for="(l, i) in layout.links" :key="'l' + i" :d="l.d" :class="['link', l.kind]" />
        <g v-for="(ins, i) in layout.inserts" :key="'i' + i">
          <line :x1="ins.x" :y1="BOT_Y - 34" :x2="ins.x" :y2="BOT_Y - 4" class="insert-line" />
          <text :x="ins.x" :y="BOT_Y - 40" class="ins-label">+</text>
        </g>
        <text v-for="(d, i) in layout.deletes" :key="'d' + i" :x="d.x" :y="TOP_Y + ROW_H + 40" class="del-label">×</text>
        <g v-for="(ch, i) in layout.before" :key="'t' + i">
          <rect :x="boxX(i)" :y="TOP_Y" :width="BOX" :height="ROW_H" rx="6" :class="['box', layout.topRole[i]]" />
          <text :x="boxX(i) + BOX / 2" :y="TOP_Y + ROW_H / 2" class="digit">{{ ch }}</text>
        </g>
        <g v-for="(ch, j) in layout.after" :key="'b' + j">
          <rect :x="boxX(j)" :y="BOT_Y" :width="BOX" :height="ROW_H" rx="6" :class="['box', layout.botRole[j]]" />
          <text :x="boxX(j) + BOX / 2" :y="BOT_Y + ROW_H / 2" class="digit">{{ ch }}</text>
        </g>
      </svg>
    </div>
    <p v-if="step.lengthWarning" class="warn-text">{{ step.lengthWarning }}</p>
  </div>
</template>
