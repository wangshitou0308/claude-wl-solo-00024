<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PhoneRecord } from '../types';
import { store, contactName, eraText } from '../store';

const props = defineProps<{ record: PhoneRecord }>();

const photo = computed(() => (props.record.photoId ? store.photoUrls.get(props.record.photoId) ?? '' : ''));
const zoom = ref(false);
</script>

<template>
  <div class="evidence">
    <h4>原页依据</h4>
    <dl class="evidence-list">
      <div><dt>联系人</dt><dd>{{ contactName(record.contactId) }}</dd></div>
      <div><dt>电话本原样</dt><dd class="mono">{{ record.rawText }}</dd></div>
      <div><dt>记录年代</dt><dd>{{ eraText(record) }}</dd></div>
      <div><dt>当时地区</dt><dd>{{ record.region || '未写明（不会按现居地补区号）' }}</dd></div>
      <div v-if="record.extension"><dt>分机</dt><dd>{{ record.extension }}</dd></div>
      <div><dt>页边批注</dt><dd>{{ record.marginNote || '无' }}</dd></div>
    </dl>
    <figure v-if="photo" class="evidence-figure">
      <img
        :src="photo"
        :class="['evidence-photo', { zoom }]"
        alt="电话本原页照片"
        @click="zoom = !zoom"
      />
      <figcaption class="muted">点照片可放大 / 缩小</figcaption>
    </figure>
    <p v-else class="muted">未拍原页照片。建议在「原记录」页补拍，方便日后对照。</p>
  </div>
</template>
