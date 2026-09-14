import { computed, reactive } from 'vue';
import type { Candidate, Contact, DialMark, DialStatus, PhoneRecord, Rule } from './types';
import { STATUS_LABEL } from './types';
import * as db from './db';
import { buildCandidates } from './chain';

export const store = reactive({
  ready: false,
  contacts: [] as Contact[],
  records: [] as PhoneRecord[],
  rules: [] as Rule[],
  marks: [] as DialMark[],
  /** photoId -> 图片预览地址（照片本体存在 IndexedDB） */
  photoUrls: new Map<string, string>(),
  /** 矛盾定位时要高亮的规则 */
  highlightRuleId: '',
  toastMessage: '',
});

export const ui = reactive({
  tab: 'records' as 'records' | 'rules' | 'trace' | 'card',
  traceRecordId: '',
  printRecordId: '',
});

let toastTimer = 0;
export function toast(msg: string): void {
  store.toastMessage = msg;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    store.toastMessage = '';
  }, 4500);
}

/* ---------- 小工具 ---------- */

export function contactName(id: string): string {
  return store.contacts.find((c) => c.id === id)?.name ?? '（已删除的联系人）';
}

export function eraText(r: PhoneRecord): string {
  if (r.eraStart != null && r.eraEnd != null) return `约 ${r.eraStart}–${r.eraEnd} 年`;
  if (r.eraStart != null) return `${r.eraStart} 年之后`;
  if (r.eraEnd != null) return `${r.eraEnd} 年之前`;
  return '年代未填写';
}

export function fmtTime(t: number): string {
  return new Date(t).toLocaleString('zh-CN', { hour12: false });
}

export function parseYear(s: string, label: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const y = Number(t);
  if (!Number.isInteger(y) || y < 1800 || y > 2100) {
    throw new Error(`${label}请填写 1800–2100 之间的年份`);
  }
  return y;
}

/* ---------- 载入与示例数据 ---------- */

export async function loadAll(): Promise<void> {
  const [contacts, records, rules, marks, photos] = await Promise.all([
    db.getAll<Contact>('contacts'),
    db.getAll<PhoneRecord>('records'),
    db.getAll<Rule>('rules'),
    db.getAll<DialMark>('marks'),
    db.getAll<{ id: string; blob: Blob }>('photos'),
  ]);
  store.contacts = contacts.sort((a, b) => a.createdAt - b.createdAt);
  store.records = records.sort((a, b) => a.createdAt - b.createdAt);
  store.rules = rules.sort((a, b) => a.effectiveStart - b.effectiveStart || a.createdAt - b.createdAt);
  store.marks = marks.sort((a, b) => a.createdAt - b.createdAt);
  for (const p of photos) store.photoUrls.set(p.id, URL.createObjectURL(p.blob));
  if (contacts.length === 0 && records.length === 0 && rules.length === 0 && marks.length === 0) {
    await seedDemo();
  }
  store.ready = true;
}

async function seedDemo(): Promise<void> {
  const rule: Rule = {
    id: crypto.randomUUID(),
    name: '示例规则·1996 年 7 位升 8 位（最前加 6）',
    effectiveStart: 1996,
    effectiveEnd: null,
    regions: [],
    oldPrefix: '',
    newPrefix: '6',
    resultLength: 8,
    note: '示例：许多城市在九十年代把 7 位号码升为 8 位。请按您当地的实际情况修改或删除这条示例。',
    version: 1,
    createdAt: Date.now(),
  };
  const contact: Contact = {
    id: crypto.randomUUID(),
    name: '示例·老同事王师傅',
    note: '示例联系人，可删除',
    createdAt: Date.now(),
  };
  const record: PhoneRecord = {
    id: crypto.randomUUID(),
    contactId: contact.id,
    rawText: '6234567（厂办）',
    digits: '6234567',
    eraStart: 1994,
    eraEnd: 1998,
    region: '',
    extension: '转 208',
    marginNote: '页边铅笔字：已调三车间',
    photoId: null,
    createdAt: Date.now(),
  };
  await db.put('rules', rule);
  await db.put('contacts', contact);
  await db.put('records', record);
  store.rules.push(rule);
  store.contacts.push(contact);
  store.records.push(record);
}

export async function clearDemoData(): Promise<void> {
  for (const r of store.rules.filter((x) => x.name.startsWith('示例'))) {
    await deleteRule(r.id, true);
  }
  const demoContactIds = new Set(store.contacts.filter((c) => c.name.startsWith('示例')).map((c) => c.id));
  for (const r of [...store.records]) {
    if (demoContactIds.has(r.contactId)) await deleteRecord(r.id, true);
  }
  for (const c of store.contacts.filter((x) => x.name.startsWith('示例'))) {
    await deleteContact(c.id);
  }
  toast('示例数据已清除');
}

/* ---------- 联系人 ---------- */

export async function saveContact(c: Contact): Promise<void> {
  await db.put('contacts', c);
  const i = store.contacts.findIndex((x) => x.id === c.id);
  if (i >= 0) store.contacts.splice(i, 1, c);
  else store.contacts.push(c);
}

export async function deleteContact(id: string): Promise<void> {
  await db.remove('contacts', id);
  store.contacts = store.contacts.filter((c) => c.id !== id);
}

/* ---------- 原记录 ---------- */

export async function saveRecord(r: PhoneRecord): Promise<void> {
  await db.put('records', r);
  const i = store.records.findIndex((x) => x.id === r.id);
  if (i >= 0) store.records.splice(i, 1, r);
  else store.records.push(r);
  toast('原记录已保存');
}

export async function deleteRecord(id: string, silent = false): Promise<void> {
  const rec = store.records.find((r) => r.id === id);
  if (rec?.photoId) await deletePhoto(rec.photoId);
  for (const m of store.marks.filter((m) => m.recordId === id)) {
    await db.remove('marks', m.id);
  }
  store.marks = store.marks.filter((m) => m.recordId !== id);
  await db.remove('records', id);
  store.records = store.records.filter((r) => r.id !== id);
  if (!silent) toast('原记录已删除');
}

export async function setPhoto(file: Blob): Promise<string> {
  const id = crypto.randomUUID();
  await db.put('photos', { id, blob: file });
  store.photoUrls.set(id, URL.createObjectURL(file));
  return id;
}

export async function deletePhoto(id: string): Promise<void> {
  await db.remove('photos', id);
  const url = store.photoUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  store.photoUrls.delete(id);
}

/* ---------- 改号规则 ---------- */

export async function saveRule(input: Omit<Rule, 'version' | 'createdAt'>): Promise<void> {
  const existing = store.rules.find((r) => r.id === input.id);
  const rule: Rule = {
    ...input,
    version: existing ? existing.version + 1 : 1,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  await db.put('rules', rule);
  const i = store.rules.findIndex((r) => r.id === rule.id);
  if (i >= 0) store.rules.splice(i, 1, rule);
  else store.rules.push(rule);
  store.rules.sort((a, b) => a.effectiveStart - b.effectiveStart || a.createdAt - b.createdAt);
  if (existing) {
    toast(`规则「${rule.name}」已修改：使用它的候选已立即失效并重新推算，相关旧标记移入「已失效的标记」`);
  } else {
    toast(`规则「${rule.name}」已添加`);
  }
}

export async function deleteRule(id: string, silent = false): Promise<void> {
  await db.remove('rules', id);
  store.rules = store.rules.filter((r) => r.id !== id);
  if (!silent) toast('规则已删除：使用它的候选已失效，相关标记移入「已失效的标记」');
}

/* ---------- 试拨标记 ---------- */

export async function addMark(recordId: string, cand: Candidate, status: DialStatus, note: string): Promise<void> {
  const mark: DialMark = {
    id: crypto.randomUUID(),
    recordId,
    candidateKey: cand.key,
    digits: cand.digits,
    status,
    note,
    ruleVersions: Object.fromEntries(cand.steps.map((s) => [s.ruleId, s.ruleVersion])),
    createdAt: Date.now(),
    undone: false,
  };
  await db.put('marks', mark);
  store.marks.push(mark);
  toast(`已记下：${cand.digits} →「${STATUS_LABEL[status]}」。标错了可点「撤销上一笔记号」。`);
}

export async function undoLastMark(): Promise<void> {
  const active = store.marks.filter((m) => !m.undone).sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!active) {
    toast('没有可撤销的标记');
    return;
  }
  active.undone = true;
  await db.put('marks', active);
  toast(`已撤销 ${active.digits} 的「${STATUS_LABEL[active.status]}」标记；如需恢复，请打开「已撤销的标记」`);
}

export async function restoreMark(id: string): Promise<void> {
  const m = store.marks.find((x) => x.id === id);
  if (!m) return;
  m.undone = false;
  await db.put('marks', m);
  toast('标记已恢复');
}

export async function deleteMark(id: string): Promise<void> {
  await db.remove('marks', id);
  store.marks = store.marks.filter((m) => m.id !== id);
}

/* ---------- 清除全部 ---------- */

export async function clearAllData(): Promise<void> {
  for (const s of ['contacts', 'records', 'rules', 'marks', 'photos'] as const) {
    await db.clear(s);
  }
  for (const url of store.photoUrls.values()) URL.revokeObjectURL(url);
  store.photoUrls.clear();
  store.contacts = [];
  store.records = [];
  store.rules = [];
  store.marks = [];
  toast('已清除全部数据');
}

/* ---------- 派生：候选、标记、矛盾 ---------- */

export const candidatesByRecord = computed(() => {
  const m = new Map<string, { candidates: Candidate[]; truncated: boolean }>();
  for (const r of store.records) {
    m.set(r.id, buildCandidates(r, store.rules));
  }
  return m;
});

/** 每个候选的最新一条有效标记 */
export const latestMarkByKey = computed(() => {
  const m = new Map<string, DialMark>();
  for (const mk of store.marks) {
    if (mk.undone) continue;
    const prev = m.get(mk.candidateKey);
    if (!prev || mk.createdAt > prev.createdAt) m.set(mk.candidateKey, mk);
  }
  return m;
});

export const validCandidateKeys = computed(() => {
  const set = new Set<string>();
  for (const b of candidatesByRecord.value.values()) {
    for (const c of b.candidates) set.add(c.key);
  }
  return set;
});

/** 规则或原记录被修改后失效的标记 */
export const orphanMarks = computed(() =>
  store.marks.filter((m) => !m.undone && !validCandidateKeys.value.has(m.candidateKey)),
);

export interface Contradiction {
  id: string;
  recordId: string;
  message: string;
  ruleIds: string[];
}

function divergentRuleIds(a: Candidate, b: Candidate): string[] {
  const n = Math.max(a.steps.length, b.steps.length);
  for (let i = 0; i < n; i++) {
    const sa = a.steps[i];
    const sb = b.steps[i];
    if (!sa || !sb || sa.ruleId !== sb.ruleId) {
      return [...new Set([sa?.ruleId, sb?.ruleId].filter((x): x is string => Boolean(x)))];
    }
  }
  return [];
}

export const contradictions = computed<Contradiction[]>(() => {
  const out: Contradiction[] = [];
  const valid = validCandidateKeys.value;

  // 同一号码被标出互相矛盾的结果
  const byDigits = new Map<string, DialMark[]>();
  for (const [key, mk] of latestMarkByKey.value) {
    if (!valid.has(key)) continue;
    const arr = byDigits.get(mk.digits) ?? [];
    arr.push(mk);
    byDigits.set(mk.digits, arr);
  }
  for (const [digits, arr] of byDigits) {
    const st = new Set(arr.map((a) => a.status));
    if (st.has('connected') && (st.has('vacant') || st.has('disconnected'))) {
      const kinds = arr.map((a) => `「${STATUS_LABEL[a.status]}」`).join(' 和 ');
      out.push({
        id: 'digits-' + digits,
        recordId: arr[0].recordId,
        message: `号码 ${digits} 的试拨结果互相矛盾（既${kinds}）。请回忆通话情形，撤销记错的一条。`,
        ruleIds: [],
      });
    }
  }

  // 同一原记录有两个不同候选都被标为「接通」：定位到分歧规则
  for (const rec of store.records) {
    const cands = candidatesByRecord.value.get(rec.id)?.candidates ?? [];
    const hits = cands.filter((c) => latestMarkByKey.value.get(c.key)?.status === 'connected');
    if (hits.length >= 2) {
      const [a, b] = hits;
      const ruleIds = divergentRuleIds(a, b);
      const names = ruleIds
        .map((id) => store.rules.find((r) => r.id === id)?.name)
        .filter(Boolean)
        .join('」「');
      out.push({
        id: 'record-' + rec.id,
        recordId: rec.id,
        message: `「${contactName(rec.contactId)}」有两个候选都被标为「接通」（${a.digits} 与 ${b.digits}）。两条沿革链的分歧在规则「${names || '未知'}」附近，建议先核实这条规则。`,
        ruleIds,
      });
    }
  }
  return out;
});
