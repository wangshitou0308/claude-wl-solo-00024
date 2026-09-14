/** 试拨结果 */
export type DialStatus = 'connected' | 'disconnected' | 'vacant' | 'unconfirmed';

export const STATUS_LABEL: Record<DialStatus, string> = {
  connected: '接通',
  disconnected: '停号',
  vacant: '空号',
  unconfirmed: '未确认',
};

export const STATUS_ORDER: DialStatus[] = ['connected', 'disconnected', 'vacant', 'unconfirmed'];

/** 联系人 */
export interface Contact {
  id: string;
  name: string;
  note: string;
  createdAt: number;
}

/** 电话本上抄下来的一条原记录 */
export interface PhoneRecord {
  id: string;
  contactId: string;
  /** 照原样抄写的整行文字 */
  rawText: string;
  /** 从 rawText 提取出的纯数字，参与推算 */
  digits: string;
  /** 记录年代范围（可空 = 不知道） */
  eraStart: number | null;
  eraEnd: number | null;
  /** 当时地区（空 = 未写明，绝不按现居地补区号） */
  region: string;
  /** 分机写法，如「转 208」 */
  extension: string;
  /** 页边批注 */
  marginNote: string;
  /** 原页照片（存在 IndexedDB 的 photos 仓库里） */
  photoId: string | null;
  createdAt: number;
}

/** 改号规则：把 oldPrefix 开头替换成 newPrefix */
export interface Rule {
  id: string;
  name: string;
  /** 生效年份（起） */
  effectiveStart: number;
  /** 生效年份（止，可空 = 至今） */
  effectiveEnd: number | null;
  /** 适用地区，空数组 = 全国通用 */
  regions: string[];
  /** 旧前缀，空串 = 任意开头 */
  oldPrefix: string;
  /** 替换段 */
  newPrefix: string;
  /** 变更后总位数（可空 = 不校验） */
  resultLength: number | null;
  note: string;
  /** 每次修改 +1，候选与标记据此判断是否失效 */
  version: number;
  createdAt: number;
}

/** 一条试拨标记 */
export interface DialMark {
  id: string;
  recordId: string;
  /** 标记时候选的 key（含规则版本），规则改动后旧标记据此判为失效 */
  candidateKey: string;
  digits: string;
  status: DialStatus;
  note: string;
  /** 标记时各规则的版本快照 */
  ruleVersions: Record<string, number>;
  createdAt: number;
  /** 误标撤销（软删除，可恢复） */
  undone: boolean;
}

/** 沿革链中的一步变更 */
export interface ChainStep {
  ruleId: string;
  ruleName: string;
  ruleVersion: number;
  year: number;
  before: string;
  after: string;
  oldPrefix: string;
  newPrefix: string;
  lengthWarning: string | null;
}

/** 一个相容候选号码 */
export interface Candidate {
  key: string;
  recordId: string;
  digits: string;
  steps: ChainStep[];
  /** 因歧义而保留此候选的说明 */
  assumptions: string[];
  /** 需要留意的提醒 */
  warnings: string[];
}
