<script setup lang="ts">
import { computed, reactive } from 'vue';
import type { Contact, PhoneRecord } from '../types';
import {
  store,
  ui,
  contactName,
  eraText,
  parseYear,
  saveContact,
  deleteContact,
  saveRecord,
  deleteRecord,
  setPhoto,
  deletePhoto,
  clearDemoData,
} from '../store';

/* ---------- 联系人 ---------- */

const contactForm = reactive({ name: '', note: '' });

async function addContact() {
  const name = contactForm.name.trim();
  if (!name) {
    alert('请先填写联系人姓名或称呼');
    return;
  }
  await saveContact({ id: crypto.randomUUID(), name, note: contactForm.note.trim(), createdAt: Date.now() });
  contactForm.name = '';
  contactForm.note = '';
}

async function onDeleteContact(c: Contact) {
  if (store.records.some((r) => r.contactId === c.id)) {
    alert(`「${c.name}」还有原记录，请先删除对应的原记录。`);
    return;
  }
  if (!window.confirm(`确定删除联系人「${c.name}」吗？`)) return;
  await deleteContact(c.id);
}

function recordCount(contactId: string): number {
  return store.records.filter((r) => r.contactId === contactId).length;
}

const hasDemo = computed(
  () =>
    store.contacts.some((c) => c.name.startsWith('示例')) ||
    store.rules.some((r) => r.name.startsWith('示例')),
);

async function clearDemo() {
  if (!window.confirm('清除所有名称带「示例」的联系人、原记录和规则？')) return;
  await clearDemoData();
}

/* ---------- 原记录表单 ---------- */

const blankForm = () => ({
  id: '',
  contactId: '',
  rawText: '',
  eraStartText: '',
  eraEndText: '',
  region: '',
  extension: '',
  marginNote: '',
  photoId: null as string | null,
});

const form = reactive(blankForm());
const editing = computed(() => form.id !== '');
const digitsPreview = computed(() => form.rawText.replace(/\D/g, ''));

const regionSuggestions = computed(() => {
  const set = new Set<string>();
  for (const r of store.rules) for (const x of r.regions) set.add(x);
  for (const r of store.records) if (r.region.trim()) set.add(r.region.trim());
  return [...set];
});

function photoUrl(id: string | null): string {
  return id ? store.photoUrls.get(id) ?? '' : '';
}

async function onPhotoChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (form.photoId) await deletePhoto(form.photoId);
  form.photoId = await setPhoto(file);
  input.value = '';
}

async function removePhoto() {
  if (form.photoId) await deletePhoto(form.photoId);
  form.photoId = null;
}

function resetForm() {
  Object.assign(form, blankForm());
}

async function submit() {
  try {
    if (!form.contactId) throw new Error('请选择联系人（先在上方添加）');
    const digits = digitsPreview.value;
    if (digits.length < 3) throw new Error('原号码里至少要有 3 位数字，请照电话本原样抄写');
    const eraStart = parseYear(form.eraStartText, '记录年代·从：');
    const eraEnd = parseYear(form.eraEndText, '记录年代·到：');
    if (eraStart != null && eraEnd != null && eraStart > eraEnd) {
      throw new Error('记录年代的「从」不能晚于「到」');
    }
    const rec: PhoneRecord = {
      id: form.id || crypto.randomUUID(),
      contactId: form.contactId,
      rawText: form.rawText.trim(),
      digits,
      eraStart,
      eraEnd,
      region: form.region.trim(),
      extension: form.extension.trim(),
      marginNote: form.marginNote.trim(),
      photoId: form.photoId,
      createdAt: form.id ? store.records.find((r) => r.id === form.id)?.createdAt ?? Date.now() : Date.now(),
    };
    await saveRecord(rec);
    resetForm();
  } catch (err) {
    alert((err as Error).message);
  }
}

function editRecord(r: PhoneRecord) {
  Object.assign(form, {
    id: r.id,
    contactId: r.contactId,
    rawText: r.rawText,
    eraStartText: r.eraStart != null ? String(r.eraStart) : '',
    eraEndText: r.eraEnd != null ? String(r.eraEnd) : '',
    region: r.region,
    extension: r.extension,
    marginNote: r.marginNote,
    photoId: r.photoId,
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function onDeleteRecord(r: PhoneRecord) {
  if (!window.confirm(`确定删除这条原记录（${r.rawText}）吗？它的试拨标记会一并删除。`)) return;
  await deleteRecord(r.id);
  if (form.id === r.id) resetForm();
}

function gotoTrace(r: PhoneRecord) {
  ui.traceRecordId = r.id;
  ui.tab = 'trace';
}
</script>

<template>
  <section class="panel">
    <h2>联系人</h2>
    <div v-if="hasDemo" class="demo-banner">
      <span>当前包含示例数据（名称带「示例」），熟悉操作后可一键清除。</span>
      <button type="button" class="btn small" @click="clearDemo">清除示例数据</button>
    </div>
    <form class="inline-form" @submit.prevent="addContact">
      <input v-model="contactForm.name" class="input" placeholder="姓名或称呼，如：老同事王师傅" />
      <input v-model="contactForm.note" class="input" placeholder="备注（可不填）" />
      <button class="btn primary" type="submit">添加联系人</button>
    </form>
    <ul v-if="store.contacts.length" class="contact-list">
      <li v-for="c in store.contacts" :key="c.id">
        <strong>{{ c.name }}</strong>
        <span v-if="c.note" class="muted">{{ c.note }}</span>
        <span class="muted">（{{ recordCount(c.id) }} 条原记录）</span>
        <button type="button" class="btn small danger" @click="onDeleteContact(c)">删除</button>
      </li>
    </ul>
    <p v-else class="empty">还没有联系人，请先添加一位。</p>
  </section>

  <section class="panel">
    <h2>{{ editing ? '修改原记录' : '抄写一条原记录' }}</h2>
    <p class="hint">照着电话本原样抄，不要凭记忆改动；不知道的项目留空即可，应用不会替您猜。</p>
    <form @submit.prevent="submit">
      <label class="field">
        <span class="field-label">联系人</span>
        <select v-model="form.contactId" class="input">
          <option value="" disabled>请选择联系人</option>
          <option v-for="c in store.contacts" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">原号码（照原样抄写，含括号、横线都可以）</span>
        <input v-model="form.rawText" class="input mono" placeholder="如：0755-6234567 或 6234567（厂办）" />
      </label>
      <p v-if="digitsPreview" class="hint">
        将按数字 <strong class="mono">{{ digitsPreview }}</strong> 推算（括号、横线等不参与）。
      </p>

      <div class="field-row">
        <label class="field">
          <span class="field-label">记录年代·从（可不填）</span>
          <input v-model="form.eraStartText" class="input" inputmode="numeric" placeholder="如：1994" />
        </label>
        <label class="field">
          <span class="field-label">记录年代·到（可不填）</span>
          <input v-model="form.eraEndText" class="input" inputmode="numeric" placeholder="如：1998" />
        </label>
      </div>

      <label class="field">
        <span class="field-label">当时地区（不知道就留空；留空不会按现居地补区号）</span>
        <input v-model="form.region" class="input" list="region-list" placeholder="如：广州" />
        <datalist id="region-list">
          <option v-for="r in regionSuggestions" :key="r" :value="r" />
        </datalist>
      </label>

      <label class="field">
        <span class="field-label">分机写法（没有就留空）</span>
        <input v-model="form.extension" class="input" placeholder="如：转 208" />
      </label>

      <label class="field">
        <span class="field-label">页边批注（一字不差抄下来，没有就留空）</span>
        <textarea v-model="form.marginNote" class="input" rows="2" placeholder="如：页边铅笔字：已调三车间"></textarea>
      </label>

      <div class="field">
        <span class="field-label">原页照片（可选，只存在本浏览器）</span>
        <input type="file" accept="image/*" @change="onPhotoChange" />
        <div v-if="form.photoId && photoUrl(form.photoId)" class="photo-row">
          <img :src="photoUrl(form.photoId)" class="photo-thumb" alt="电话本原页照片" />
          <button type="button" class="btn small danger" @click="removePhoto">移除照片</button>
        </div>
      </div>

      <div class="btn-row">
        <button class="btn primary" type="submit">{{ editing ? '保存修改' : '保存原记录' }}</button>
        <button v-if="editing" type="button" class="btn" @click="resetForm">取消修改</button>
      </div>
      <p v-if="editing" class="warn-text">保存修改后，这条记录原有的候选会重新推算，相关试拨标记会移入「已失效的标记」。</p>
    </form>
  </section>

  <section class="panel">
    <h2>已抄录的原记录（{{ store.records.length }}）</h2>
    <p v-if="!store.records.length" class="empty">还没有原记录。先在上方添加联系人，再抄写号码。</p>
    <article v-for="r in store.records" :key="r.id" class="record-card">
      <header class="record-head">
        <strong>{{ contactName(r.contactId) }}</strong>
        <span class="mono">{{ r.rawText }}</span>
      </header>
      <p class="muted">
        {{ eraText(r) }} · {{ r.region || '地区未写明' }}
        <template v-if="r.extension"> · 分机：{{ r.extension }}</template>
      </p>
      <p v-if="r.marginNote" class="note-text">批注：{{ r.marginNote }}</p>
      <img v-if="r.photoId && photoUrl(r.photoId)" :src="photoUrl(r.photoId)" class="photo-thumb" alt="电话本原页照片" />
      <div class="btn-row">
        <button type="button" class="btn primary small" @click="gotoTrace(r)">核对沿革</button>
        <button type="button" class="btn small" @click="editRecord(r)">修改</button>
        <button type="button" class="btn small danger" @click="onDeleteRecord(r)">删除</button>
      </div>
    </article>
  </section>
</template>
