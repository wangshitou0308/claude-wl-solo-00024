<script setup lang="ts">
import { computed } from 'vue';
import { store, ui, contactName, eraText, candidatesByRecord } from '../store';

const record = computed(() => store.records.find((r) => r.id === ui.printRecordId) ?? null);

const build = computed(() => {
  if (!record.value) return { candidates: [], truncated: false };
  return candidatesByRecord.value.get(record.value.id) ?? { candidates: [], truncated: false };
});

const today = new Date().toLocaleDateString('zh-CN');

function doPrint() {
  window.print();
}
</script>

<template>
  <section class="panel no-print">
    <h2>打印联系卡</h2>
    <p class="hint">
      卡片上只有原记录、候选号码和询问要点，方便照着打电话；推算规则和试拨历史不会印在卡片上。
    </p>
    <div v-if="!store.records.length" class="empty">还没有原记录，请先到「原记录」页添加。</div>
    <template v-else>
      <label class="field">
        <span class="field-label">选择原记录</span>
        <select v-model="ui.printRecordId" class="input">
          <option value="" disabled>请选择一条原记录</option>
          <option v-for="r in store.records" :key="r.id" :value="r.id">
            {{ contactName(r.contactId) }} — {{ r.rawText }}
          </option>
        </select>
      </label>
      <template v-if="record">
        <p v-if="build.truncated" class="warn-text">候选过多（超过 48 条），请先补充年代或地区收窄，再打印。</p>
        <button type="button" class="btn primary" @click="doPrint">打印这张联系卡</button>
        <p class="hint">下方是卡片预览，打印时只保留卡片本身。</p>
      </template>
    </template>
  </section>

  <div v-if="record" class="print-card">
    <h2 class="pc-title">联系核对卡</h2>
    <p class="pc-date">整理日期：{{ today }}</p>

    <section class="pc-section">
      <h3>一、原记录（照电话本抄录）</h3>
      <p>联系人：{{ contactName(record.contactId) }}</p>
      <p>
        原号码：<span class="mono">{{ record.rawText }}</span>
        <template v-if="record.extension">（分机：{{ record.extension }}）</template>
      </p>
      <p>记录年代：{{ eraText(record) }}　当时地区：{{ record.region || '未写明' }}</p>
      <p v-if="record.marginNote">页边批注：{{ record.marginNote }}</p>
    </section>

    <section class="pc-section">
      <h3>二、候选号码（推算结果，逐一试拨）</h3>
      <ol class="pc-candidates">
        <li v-for="c in build.candidates" :key="c.key">
          <span class="mono big">{{ c.digits }}</span>
          <span v-if="record.extension">（{{ record.extension }}）</span>
          <span class="pc-boxes">☐ 接通　☐ 停号　☐ 空号　☐ 未确认</span>
          <div class="pc-line">备注：＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿</div>
        </li>
      </ol>
    </section>

    <section class="pc-section">
      <h3>三、询问要点</h3>
      <ol>
        <li>先自报家门，再问：「请问这是 {{ contactName(record.contactId) }} 家（或原来的单位）吗？」</li>
        <li>若对方不认识：「打扰了。请问您用这个号码多久了？知道之前的机主吗？」</li>
        <li>若已换号或停机：「请问方便告诉我能联系上 {{ contactName(record.contactId) }} 的方式吗？」</li>
        <li>通话后在上面勾选结果，回家在应用的「沿革核对」里记下；「接通但不是本人」不算找到。</li>
      </ol>
    </section>

    <p class="pc-disclaimer">
      说明：本卡片根据旧电话本记录和自行整理的改号规则推算，仅用于核对线索；以上号码不代表仍属于原联系人。如打扰到他人，请致歉并结束通话。
    </p>
  </div>
</template>
