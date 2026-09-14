import type { Candidate, ChainStep, PhoneRecord, Rule } from './types';

const FAR_PAST = 1800;
const FAR_FUTURE = 9999;
/** 候选数量上限，避免歧义组合爆炸 */
const MAX_STATES = 48;

/** 推算中的一个中间状态：某串数字在 [from, to] 期间有效 */
interface State {
  digits: string;
  from: number;
  to: number;
  steps: ChainStep[];
  assumptions: string[];
  /** 在「同期规则只应用其一」的分支里要跳过的规则 */
  skip: string[];
}

export interface BuildResult {
  candidates: Candidate[];
  /** 候选超过上限被截断 */
  truncated: boolean;
}

/**
 * 由一条原记录和全部改号规则，按时间先后推出沿革链。
 * 日期跨越规则、规则重叠、批注（地区/年代）缺位时，保留全部相容候选；
 * 绝不凭空补数字（尤其不按现居地补区号）。
 */
export function buildCandidates(record: PhoneRecord, rules: Rule[]): BuildResult {
  if (!record.digits) return { candidates: [], truncated: false };

  const sorted = [...rules].sort((a, b) => a.effectiveStart - b.effectiveStart || a.createdAt - b.createdAt);

  const initialAssumptions: string[] = [];
  if (record.eraStart == null && record.eraEnd == null) {
    initialAssumptions.push('未填写记录年代：按最宽的时间范围推算，候选可能偏多，建议补填年代');
  } else if (record.eraStart == null || record.eraEnd == null) {
    initialAssumptions.push('记录年代只填了一头：按较宽的时间范围推算');
  }

  let states: State[] = [
    {
      digits: record.digits,
      from: record.eraStart ?? FAR_PAST,
      to: record.eraEnd ?? FAR_FUTURE,
      steps: [],
      assumptions: initialAssumptions,
      skip: [],
    },
  ];

  let truncated = false;
  for (const rule of sorted) {
    const next: State[] = [];
    for (const s of states) next.push(...applyRule(s, rule, record, sorted));
    const merged = mergeStates(next);
    if (merged.length > MAX_STATES) truncated = true;
    states = merged.slice(0, MAX_STATES);
  }

  const candidates = states.map((s) => toCandidate(record, s));
  candidates.sort((a, b) => a.steps.length - b.steps.length || a.digits.localeCompare(b.digits));
  return { candidates, truncated };
}

type RegionMatch = 'yes' | 'no' | 'unknown';

function normRegion(s: string): string {
  return s.trim().replace(/(特别行政区|自治州|地区|省|市|县|区|盟|旗)+$/g, '');
}

function regionMatch(rule: Rule, recordRegion: string): RegionMatch {
  if (rule.regions.length === 0) return 'yes';
  const rr = normRegion(recordRegion);
  if (!rr) return 'unknown';
  const hit = rule.regions.some((r0) => {
    const x = normRegion(r0);
    return x !== '' && (x === rr || x.includes(rr) || rr.includes(x));
  });
  return hit ? 'yes' : 'no';
}

function applyRule(state: State, rule: Rule, record: PhoneRecord, all: Rule[]): State[] {
  if (state.skip.includes(rule.id)) return [state];
  if (rule.oldPrefix === '' && rule.newPrefix === '') return [state];

  const rm = regionMatch(rule, record.region);
  if (rm === 'no') return [state];
  if (rule.oldPrefix !== '' && !state.digits.startsWith(rule.oldPrefix)) return [state];

  const rs = rule.effectiveStart;
  // 记录已晚于规则生效：视为号码已反映该规则，不再变换
  if (state.from >= rs) return [state];

  // 记录年代跨越规则生效点：记录可能写在规则前，也可能写在规则后
  const span = state.to >= rs;
  const out: State[] = [];

  const applyAssumptions: string[] = [];
  if (span) applyAssumptions.push(`记录年代跨越「${rule.name}」生效年（${rs} 年）：保留「记录在规则前写下、号码随后变更」的可能`);
  if (rm === 'unknown') applyAssumptions.push(`原记录未写明地区：保留「适用 ${rule.name}」的可能`);

  // 分支一：规则适用，号码发生变更
  out.push(applyOnce(state, rule, rs, applyAssumptions));

  // 同期生效的规则互相重叠：保留「只应用其中一个」的可能
  const siblings = all.filter(
    (o) =>
      o.id !== rule.id &&
      o.effectiveStart === rs &&
      regionMatch(o, record.region) !== 'no' &&
      (o.oldPrefix === '' || state.digits.startsWith(o.oldPrefix)),
  );
  if (siblings.length > 0) {
    const only = applyOnce(state, rule, rs, [
      ...applyAssumptions,
      `「${rule.name}」与同期规则重叠：保留「只应用 ${rule.name}」的可能`,
    ]);
    only.skip = [...state.skip, ...siblings.map((s) => s.id)];
    out.push(only);
    // 重叠时也可能不适用本规则（而适用同期其他规则或都不适用）
    out.push({
      ...state,
      skip: [...state.skip, rule.id],
      assumptions: [...state.assumptions, `「${rule.name}」与同期规则重叠：保留「不应用 ${rule.name}」的可能`],
    });
  }

  // 分支二：记录写在规则之后，号码未再变更
  if (span) {
    out.push({
      ...state,
      assumptions: [...state.assumptions, `记录年代跨越「${rule.name}」生效年（${rs} 年）：保留「记录在规则后写下、号码未再变更」的可能`],
    });
  }
  // 分支三：地区未写明，保留「该规则不适用于此号码」的可能
  if (rm === 'unknown') {
    out.push({
      ...state,
      assumptions: [...state.assumptions, `原记录未写明地区：保留「不适用 ${rule.name}」的可能`],
    });
  }
  return out;
}

function applyOnce(state: State, rule: Rule, rs: number, extraAssumptions: string[]): State {
  const after = rule.newPrefix + state.digits.slice(rule.oldPrefix.length);
  const lengthWarning =
    rule.resultLength != null && after.length !== rule.resultLength
      ? `应用「${rule.name}」后为 ${after.length} 位，与规则设定的 ${rule.resultLength} 位不符，请核对规则或原号码`
      : null;
  const step: ChainStep = {
    ruleId: rule.id,
    ruleName: rule.name,
    ruleVersion: rule.version,
    year: rs,
    before: state.digits,
    after,
    oldPrefix: rule.oldPrefix,
    newPrefix: rule.newPrefix,
    lengthWarning,
  };
  return {
    digits: after,
    // 变更后的号码自生效年起有效；from 与 to 都取 rs，
    // 让后续规则按「确定在其生效前已存在」处理，不再引入跨越歧义
    from: rs,
    to: rs,
    steps: [...state.steps, step],
    assumptions: [...state.assumptions, ...extraAssumptions],
    skip: state.skip,
  };
}

function mergeStates(states: State[]): State[] {
  const map = new Map<string, State>();
  for (const s of states) {
    const key = s.digits + '|' + s.steps.map((t) => t.ruleId).join('>');
    const prev = map.get(key);
    if (!prev) {
      map.set(key, s);
    } else {
      prev.assumptions = [...new Set([...prev.assumptions, ...s.assumptions])];
    }
  }
  return [...map.values()];
}

function toCandidate(record: PhoneRecord, s: State): Candidate {
  const warnings: string[] = [];
  for (const st of s.steps) {
    if (st.lengthWarning) warnings.push(st.lengthWarning);
  }
  if (!record.region.trim()) {
    warnings.push('原记录未写明地区：应用不会按您现在的居住地补区号，归属地请向知情人核实');
  }
  if (s.steps.length === 0) {
    warnings.push('该候选未经过任何改号规则：若当地曾升位或改区号，请在「改号规则」中补充后再看');
  }
  if (s.digits.length <= 8) {
    warnings.push(`仅 ${s.digits.length} 位，可能缺少区号：应用不会擅自补全，请按原样核对`);
  }
  return {
    key: `${record.id}|${s.steps.map((t) => `${t.ruleId}@${t.ruleVersion}`).join('>')}|${s.digits}`,
    recordId: record.id,
    digits: s.digits,
    steps: s.steps,
    assumptions: [...new Set(s.assumptions)],
    warnings: [...new Set(warnings)],
  };
}
