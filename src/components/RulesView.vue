<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import type { Rule } from '../types';
import { store, parseYear, saveRule, deleteRule } from '../store';

const blank = () => ({
  id: '',
  name: '',
  startText: '',
  endText: '',
  regionsText: '',
  oldPrefix: '',
  newPrefix: '',
  lengthText: '',
  note: '',
});

const form = reactive(blank());
const editing = computed(() => form.id !== '');

function reset() {
  Object.assign(form, blank());
}

async function submit() {
  try {
    const name = form.name.trim();
    if (!name) throw new Error('请给规则起个名字，如「1996 年本市 7 位升 8 位」');
    const effectiveStart = parseYear(form.startText, '生效年份·从：');
    if (effectiveStart == null) throw new Error('请填写生效年份（从哪一年开始）');
    const effectiveEnd = parseYear(form.endText, '生效年份·到：');
    if (effectiveEnd != null && effectiveEnd < effectiveStart) {
      throw new Error('生效年份的「到」不能早于「从」');
    }
    if (!/^\d*$/.test(form.oldPrefix) || !/^\d*$/.test(form.newPrefix)) {
      throw new Error('「旧前缀」和「替换为」只能填数字');
    }
    if (!form.oldPrefix && !form.newPrefix) {
      throw new Error('「旧前缀」和「替换为」不能都留空（否则规则不起作用）');
    }
    if (form.oldPrefix === form.newPrefix) {
      throw new Error('「旧前缀」和「替换为」相同，规则不起作用');
    }
    const lenText = form.lengthText.trim();
    const resultLength = lenText ? Number(lenText) : null;
    if (resultLength != null && (!Number.isInteger(resultLength) || resultLength < 3 || resultLength > 20)) {
      throw new Error('变更后总位数请填 3–20 之间的数字');
    }
    const regions = form.regionsText.split(/[、,，;；\s]+/).map((s) => s.trim()).filter(Boolean);
    await saveRule({
      id: form.id || crypto.randomUUID(),
      name,
      effectiveStart,
      effectiveEnd,
      regions,
      oldPrefix: form.oldPrefix,
      newPrefix: form.newPrefix,
      resultLength,
      note: form.note.trim(),
    });
    reset();
  } catch (err) {
    alert((err as Error).message);
  }
}

function editRule(r: Rule) {
  Object.assign(form, {
    id: r.id,
    name: r.name,
    startText: String(r.effectiveStart),
    endText: r.effectiveEnd != null ? String(r.effectiveEnd) : '',
    regionsText: r.regions.join('、'),
    oldPrefix: r.oldPrefix,
    newPrefix: r.newPrefix,
    lengthText: r.resultLength != null ? String(r.resultLength) : '',
    note: r.note,
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function onDeleteRule(r: Rule) {
  if (!window.confirm(`删除规则「${r.name}」后，使用它的候选会立即失效，相关试拨标记会移入「已失效的标记」。确定删除吗？`)) return;
  await deleteRule(r.id);
  if (form.id === r.id) reset();
}

/* 矛盾定位：高亮并滚动到指定规则 */
const flashId = ref('');
let flashTimer = 0;
watch(
  () => store.highlightRuleId,
  async (id) => {
    if (!id) return;
    await nextTick();
    flashId.value = id;
    document.getElementById('rule-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => {
      flashId.value = '';
      store.highlightRuleId = '';
    }, 6000);
  },
  { immediate: true },
);
</script>

<template>
  <section class="panel">
    <h2>{{ editing ? '修改改号规则' : '添加改号规则' }}</h2>
    <p class="hint">
      把您打听到的改号办法（升位、区号拆分、局号调整等）逐条填进来。拿不准也先填上：推算时会保留所有可能，不会擅自下结论。
    </p>

    <details class="help-box">
      <summary>怎么填？点这里看例子</summary>
      <ul>
        <li>7 位升 8 位、最前面加 6：旧前缀留空，替换为填 6，变更后总位数填 8。</li>
        <li>区号 0755 改成 755：旧前缀填 0755，替换为填 755。</li>
        <li>某段开头整体替换（如 63 换成 86）：旧前缀填 63，替换为填 86。</li>
        <li>适用地区留空表示全国通用；多个地区用顿号隔开，如：广州、佛山。</li>
        <li>「生效年份·到」指该规则被下一次改号取代的年份，只是便于整理，可留空。</li>
      </ul>
    </details>

    <form @submit.prevent="submit">
      <label class="field">
        <span class="field-label">规则名称</span>
        <input v-model="form.name" class="input" placeholder="如：1996 年本市 7 位升 8 位" />
      </label>
      <div class="field-row">
        <label class="field">
          <span class="field-label">生效年份·从</span>
          <input v-model="form.startText" class="input" inputmode="numeric" placeholder="如：1996" />
        </label>
        <label class="field">
          <span class="field-label">生效年份·到（留空 = 至今）</span>
          <input v-model="form.endText" class="input" inputmode="numeric" placeholder="可不填" />
        </label>
      </div>
      <label class="field">
        <span class="field-label">适用地区（留空 = 全国通用）</span>
        <input v-model="form.regionsText" class="input" placeholder="如：广州、佛山" />
      </label>
      <div class="field-row">
        <label class="field">
          <span class="field-label">旧前缀（留空 = 任意开头）</span>
          <input v-model="form.oldPrefix" class="input mono" inputmode="numeric" placeholder="如：0755" />
        </label>
        <label class="field">
          <span class="field-label">替换为</span>
          <input v-model="form.newPrefix" class="input mono" inputmode="numeric" placeholder="如：755 或 6" />
        </label>
      </div>
      <label class="field">
        <span class="field-label">变更后总位数（可不填）</span>
        <input v-model="form.lengthText" class="input" inputmode="numeric" placeholder="如：8" />
      </label>
      <label class="field">
        <span class="field-label">备注（可不填）</span>
        <textarea v-model="form.note" class="input" rows="2" placeholder="如：听老同事说的，待核实"></textarea>
      </label>
      <div class="btn-row">
        <button class="btn primary" type="submit">{{ editing ? '保存修改' : '添加规则' }}</button>
        <button v-if="editing" type="button" class="btn" @click="reset">取消修改</button>
      </div>
      <p v-if="editing" class="warn-text">保存后，使用此规则的候选会立即失效并重新推算，相关试拨标记会移入「已失效的标记」。</p>
    </form>
  </section>

  <section class="panel">
    <h2>已录入的规则（{{ store.rules.length }}）</h2>
    <p v-if="!store.rules.length" class="empty">还没有规则。没有规则时，候选号码就是原号码本身。</p>
    <article
      v-for="r in store.rules"
      :key="r.id"
      :id="'rule-' + r.id"
      class="rule-card"
      :class="{ flash: flashId === r.id }"
    >
      <header class="record-head">
        <strong>{{ r.name }}</strong>
        <span class="muted">第 {{ r.version }} 版</span>
      </header>
      <p>
        {{ r.effectiveStart }} 年{{ r.effectiveEnd != null ? `—${r.effectiveEnd} 年` : '起至今' }} ·
        {{ r.regions.length ? r.regions.join('、') : '全国' }}
      </p>
      <p>
        开头「{{ r.oldPrefix || '任意' }}」→「{{ r.newPrefix || '删去' }}」
        <template v-if="r.resultLength != null"> · 变更后 {{ r.resultLength }} 位</template>
      </p>
      <p v-if="r.note" class="note-text">{{ r.note }}</p>
      <div class="btn-row">
        <button type="button" class="btn small" @click="editRule(r)">修改</button>
        <button type="button" class="btn small danger" @click="onDeleteRule(r)">删除</button>
      </div>
    </article>
  </section>
</template>
