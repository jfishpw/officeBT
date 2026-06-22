// 卡牌数据定义：共 32 张卡牌（含升级版共 64 张）
// 分为基础共享卡牌与 3 个职业专属卡牌池

// 卡牌类型枚举
export enum CardType {
  Attack = 'attack', // 攻击牌
  Skill = 'skill', // 技能牌
  Power = 'power', // 能力牌（持续效果）
}

// 卡牌稀有度枚举
export enum CardRarity {
  Common = 'common', // 普通
  Rare = 'rare', // 稀有
  Epic = 'epic', // 史诗
  Legendary = 'legendary', // 传说
}

// 卡牌职业归属枚举
export enum CardClass {
  Common = 'common', // 共享卡牌
  Clerk = 'clerk',
  Operator = 'operator',
  System = 'system',
  Data = 'data',
  Safety = 'safety',
  IT = 'it',
}

// 卡牌效果（简化版，用 effect 函数描述）
export interface CardEffect {
  damage?: number; // 造成伤害
  block?: number; // 获得护甲
  heal?: number; // 回复生命
  drawCards?: number; // 抽牌
  gainEnergy?: number; // 获得能量
  applyBuff?: { name: string; stacks: number }; // 施加 buff
  applyDebuff?: { name: string; stacks: number }; // 施加 debuff
  // 特殊效果标记（由战斗系统解释）
  special?: string;
}

// 卡牌数据
export interface Card {
  id: string; // 唯一 id
  name: string; // 卡牌名
  class: CardClass; // 职业归属
  type: CardType; // 卡牌类型
  rarity: CardRarity; // 稀有度
  cost: number; // 费用
  description: string; // 效果描述
  effect: CardEffect; // 效果数据
  upgradedId?: string; // 升级后的卡牌 id
  assetKey: string; // 资源 key
}

// Buff 名称常量
export const BUFFS = {
  STRENGTH: 'strength', // 力量（增加攻击伤害）
  DEXTERITY: 'dexterity', // 敏捷（增加护甲）
  RITUAL: 'ritual', // 仪式（每回合开始获得力量）
  OVERWORK: 'overwork', // 加班（IT 专属，叠加爆发）
  PATIENCE: 'patience', // 耐心（操作工专属，叠加后反击）
  PROCESS: 'process', // 流程（体系专属，每层每回合回 1 血）
  AUDIT: 'audit', // 核算（数据专属，叠加后精准打击/资源转化）
  EARLY_WARNING: 'early_warning', // 预警（安全员专属，每层减免 2 点下次受到的伤害）
} as const;

// Debuff 名称常量
export const DEBUFFS = {
  VULNERABLE: 'vulnerable', // 易伤（受击伤害+50%）
  WEAK: 'weak', // 虚弱（攻击伤害-25%）
  ENTANGLED: 'entangled', // 缠绕（本回合不能出攻击牌）
  FRAZZLED: 'frazzled', // 烦躁（每回合开始失去 1 能量）
} as const;

// ===== 基础共享卡牌（6 张，含升级版共 12 张）=====
export const BASIC_CARDS: Card[] = [
  // 打击
  {
    id: 'strike',
    name: '打击',
    class: CardClass.Common,
    type: CardType.Attack,
    rarity: CardRarity.Common,
    cost: 1,
    description: '造成 6 点伤害。',
    effect: { damage: 6 },
    upgradedId: 'strike+',
    assetKey: 'card-strike',
  },
  {
    id: 'strike+',
    name: '打击+',
    class: CardClass.Common,
    type: CardType.Attack,
    rarity: CardRarity.Common,
    cost: 1,
    description: '造成 9 点伤害。',
    effect: { damage: 9 },
    assetKey: 'card-strike+',
  },
  // 防御
  {
    id: 'defend',
    name: '防御',
    class: CardClass.Common,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 5 点护甲。',
    effect: { block: 5 },
    upgradedId: 'defend+',
    assetKey: 'card-defend',
  },
  {
    id: 'defend+',
    name: '防御+',
    class: CardClass.Common,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 8 点护甲。',
    effect: { block: 8 },
    assetKey: 'card-defend+',
  },
  // 痛击
  {
    id: 'bash',
    name: '痛击',
    class: CardClass.Common,
    type: CardType.Attack,
    rarity: CardRarity.Common,
    cost: 2,
    description: '造成 8 点伤害，施加 2 层易伤。',
    effect: { damage: 8, applyDebuff: { name: DEBUFFS.VULNERABLE, stacks: 2 } },
    upgradedId: 'bash+',
    assetKey: 'card-bash',
  },
  {
    id: 'bash+',
    name: '痛击+',
    class: CardClass.Common,
    type: CardType.Attack,
    rarity: CardRarity.Common,
    cost: 2,
    description: '造成 10 点伤害，施加 3 层易伤。',
    effect: { damage: 10, applyDebuff: { name: DEBUFFS.VULNERABLE, stacks: 3 } },
    assetKey: 'card-bash+',
  },
  // 急智
  {
    id: 'quick_think',
    name: '急智',
    class: CardClass.Common,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 0,
    description: '抽 1 张牌。',
    effect: { drawCards: 1 },
    upgradedId: 'quick_think+',
    assetKey: 'card-quick_think',
  },
  {
    id: 'quick_think+',
    name: '急智+',
    class: CardClass.Common,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 0,
    description: '抽 2 张牌。',
    effect: { drawCards: 2 },
    assetKey: 'card-quick_think+',
  },
  // 专注
  {
    id: 'focus',
    name: '专注',
    class: CardClass.Common,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 1 点能量。',
    effect: { gainEnergy: 1 },
    upgradedId: 'focus+',
    assetKey: 'card-focus',
  },
  {
    id: 'focus+',
    name: '专注+',
    class: CardClass.Common,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 2 点能量。',
    effect: { gainEnergy: 2 },
    assetKey: 'card-focus+',
  },
  // 咖啡
  {
    id: 'coffee',
    name: '咖啡',
    class: CardClass.Common,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 0,
    description: '抽 1 张牌，获得 1 点能量。下回合失去 1 点能量。',
    effect: { drawCards: 1, gainEnergy: 1, special: 'lose_energy_next_turn_1' },
    upgradedId: 'coffee+',
    assetKey: 'card-coffee',
  },
  {
    id: 'coffee+',
    name: '咖啡+',
    class: CardClass.Common,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 0,
    description: '抽 1 张牌，获得 1 点能量。',
    effect: { drawCards: 1, gainEnergy: 1 },
    assetKey: 'card-coffee+',
  },
];

// ===== 文员专属卡牌（8 张，含升级版共 16 张）=====
const CLERK_CARDS: Card[] = [
  // 文档攻击
  {
    id: 'doc_attack',
    name: '文档攻击',
    class: CardClass.Clerk,
    type: CardType.Attack,
    rarity: CardRarity.Common,
    cost: 1,
    description: '造成 7 点伤害。',
    effect: { damage: 7 },
    upgradedId: 'doc_attack+',
    assetKey: 'card-doc_attack',
  },
  {
    id: 'doc_attack+',
    name: '文档攻击+',
    class: CardClass.Clerk,
    type: CardType.Attack,
    rarity: CardRarity.Common,
    cost: 1,
    description: '造成 10 点伤害。',
    effect: { damage: 10 },
    assetKey: 'card-doc_attack+',
  },
  // 流程防御
  {
    id: 'process_defense',
    name: '流程防御',
    class: CardClass.Clerk,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 7 点护甲。',
    effect: { block: 7 },
    upgradedId: 'process_defense+',
    assetKey: 'card-process_defense',
  },
  {
    id: 'process_defense+',
    name: '流程防御+',
    class: CardClass.Clerk,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 10 点护甲。',
    effect: { block: 10 },
    assetKey: 'card-process_defense+',
  },
  // 会议拖延
  {
    id: 'meeting_delay',
    name: '会议拖延',
    class: CardClass.Clerk,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '敌人下回合无法行动（缠绕）。',
    effect: { applyDebuff: { name: DEBUFFS.ENTANGLED, stacks: 1 } },
    upgradedId: 'meeting_delay+',
    assetKey: 'card-meeting_delay',
  },
  {
    id: 'meeting_delay+',
    name: '会议拖延+',
    class: CardClass.Clerk,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 0,
    description: '敌人下回合无法行动（缠绕）。',
    effect: { applyDebuff: { name: DEBUFFS.ENTANGLED, stacks: 1 } },
    assetKey: 'card-meeting_delay+',
  },
  // 繁文缛节
  {
    id: 'red_tape',
    name: '繁文缛节',
    class: CardClass.Clerk,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 2,
    description: '对所有敌人施加 2 层易伤。',
    effect: { applyDebuff: { name: DEBUFFS.VULNERABLE, stacks: 2 }, special: 'all_enemies' },
    upgradedId: 'red_tape+',
    assetKey: 'card-red_tape',
  },
  {
    id: 'red_tape+',
    name: '繁文缛节+',
    class: CardClass.Clerk,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 2,
    description: '对所有敌人施加 3 层易伤。',
    effect: { applyDebuff: { name: DEBUFFS.VULNERABLE, stacks: 3 }, special: 'all_enemies' },
    assetKey: 'card-red_tape+',
  },
  // 归档管理
  {
    id: 'filing_cabinet',
    name: '归档管理',
    class: CardClass.Clerk,
    type: CardType.Skill,
    rarity: CardRarity.Epic,
    cost: 1,
    description: '获得 4 点护甲，抽 2 张牌。',
    effect: { block: 4, drawCards: 2 },
    upgradedId: 'filing_cabinet+',
    assetKey: 'card-filing_cabinet',
  },
  {
    id: 'filing_cabinet+',
    name: '归档管理+',
    class: CardClass.Clerk,
    type: CardType.Skill,
    rarity: CardRarity.Epic,
    cost: 1,
    description: '获得 6 点护甲，抽 2 张牌。',
    effect: { block: 6, drawCards: 2 },
    assetKey: 'card-filing_cabinet+',
  },
  // 官僚主义
  {
    id: 'bureaucracy',
    name: '官僚主义',
    class: CardClass.Clerk,
    type: CardType.Power,
    rarity: CardRarity.Epic,
    cost: 3,
    description: '每回合开始时获得 1 点护甲。',
    effect: { special: 'gain_block_each_turn_1' },
    upgradedId: 'bureaucracy+',
    assetKey: 'card-bureaucracy',
  },
  {
    id: 'bureaucracy+',
    name: '官僚主义+',
    class: CardClass.Clerk,
    type: CardType.Power,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '每回合开始时获得 1 点护甲。',
    effect: { special: 'gain_block_each_turn_1' },
    assetKey: 'card-bureaucracy+',
  },
  // 备忘录风暴
  {
    id: 'memo_storm',
    name: '备忘录风暴',
    class: CardClass.Clerk,
    type: CardType.Attack,
    rarity: CardRarity.Legendary,
    cost: 2,
    description: '造成 4 点伤害 3 次。',
    effect: { damage: 4, special: 'multi_hit_3' },
    upgradedId: 'memo_storm+',
    assetKey: 'card-memo_storm',
  },
  {
    id: 'memo_storm+',
    name: '备忘录风暴+',
    class: CardClass.Clerk,
    type: CardType.Attack,
    rarity: CardRarity.Legendary,
    cost: 2,
    description: '造成 6 点伤害 3 次。',
    effect: { damage: 6, special: 'multi_hit_3' },
    assetKey: 'card-memo_storm+',
  },
  // 效能审查
  {
    id: 'efficiency_review',
    name: '效能审查',
    class: CardClass.Clerk,
    type: CardType.Skill,
    rarity: CardRarity.Legendary,
    cost: 1,
    description: '本回合所有卡牌费用 -1。',
    effect: { special: 'reduce_all_cost_1_this_turn' },
    upgradedId: 'efficiency_review+',
    assetKey: 'card-efficiency_review',
  },
  {
    id: 'efficiency_review+',
    name: '效能审查+',
    class: CardClass.Clerk,
    type: CardType.Skill,
    rarity: CardRarity.Legendary,
    cost: 1,
    description: '持续 2 回合，所有卡牌费用 -1。',
    effect: { special: 'reduce_all_cost_1_2_turns' },
    assetKey: 'card-efficiency_review+',
  },
];

// ===== 操作工专属卡牌（8 张，含升级版共 16 张）=====
const OPERATOR_CARDS: Card[] = [
  // 阳奉阴违
  {
    id: 'passive_aggressive',
    name: '阳奉阴违',
    class: CardClass.Operator,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 8 点护甲，获得 1 层耐心。',
    effect: { block: 8, applyBuff: { name: BUFFS.PATIENCE, stacks: 1 } },
    upgradedId: 'passive_aggressive+',
    assetKey: 'card-passive_aggressive',
  },
  {
    id: 'passive_aggressive+',
    name: '阳奉阴违+',
    class: CardClass.Operator,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 11 点护甲，获得 1 层耐心。',
    effect: { block: 11, applyBuff: { name: BUFFS.PATIENCE, stacks: 1 } },
    assetKey: 'card-passive_aggressive+',
  },
  // 点头微笑
  {
    id: 'nod_and_smile',
    name: '点头微笑',
    class: CardClass.Operator,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 6 点护甲，抽 1 张牌。',
    effect: { block: 6, drawCards: 1 },
    upgradedId: 'nod_and_smile+',
    assetKey: 'card-nod_and_smile',
  },
  {
    id: 'nod_and_smile+',
    name: '点头微笑+',
    class: CardClass.Operator,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 9 点护甲，抽 1 张牌。',
    effect: { block: 9, drawCards: 1 },
    assetKey: 'card-nod_and_smile+',
  },
  // 左耳进右耳出
  {
    id: 'left_ear_right_ear',
    name: '左耳进右耳出',
    class: CardClass.Operator,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '获得 10 点护甲，本回合受到的伤害减半。',
    effect: { block: 10, special: 'halve_damage_this_turn' },
    upgradedId: 'left_ear_right_ear+',
    assetKey: 'card-left_ear_right_ear',
  },
  {
    id: 'left_ear_right_ear+',
    name: '左耳进右耳出+',
    class: CardClass.Operator,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '获得 14 点护甲，本回合受到的伤害减半。',
    effect: { block: 14, special: 'halve_damage_this_turn' },
    assetKey: 'card-left_ear_right_ear+',
  },
  // 好的但是不行
  {
    id: 'yes_but_no',
    name: '好的但是不行',
    class: CardClass.Operator,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '施加 2 层虚弱，获得 5 点护甲。',
    effect: { applyDebuff: { name: DEBUFFS.WEAK, stacks: 2 }, block: 5 },
    upgradedId: 'yes_but_no+',
    assetKey: 'card-yes_but_no',
  },
  {
    id: 'yes_but_no+',
    name: '好的但是不行+',
    class: CardClass.Operator,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '施加 3 层虚弱，获得 7 点护甲。',
    effect: { applyDebuff: { name: DEBUFFS.WEAK, stacks: 3 }, block: 7 },
    assetKey: 'card-yes_but_no+',
  },
  // 纸面防御
  {
    id: 'paper_shield',
    name: '纸面防御',
    class: CardClass.Operator,
    type: CardType.Skill,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '获得 15 点护甲，获得 2 层耐心。',
    effect: { block: 15, applyBuff: { name: BUFFS.PATIENCE, stacks: 2 } },
    upgradedId: 'paper_shield+',
    assetKey: 'card-paper_shield',
  },
  {
    id: 'paper_shield+',
    name: '纸面防御+',
    class: CardClass.Operator,
    type: CardType.Skill,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '获得 20 点护甲，获得 2 层耐心。',
    effect: { block: 20, applyBuff: { name: BUFFS.PATIENCE, stacks: 2 } },
    assetKey: 'card-paper_shield+',
  },
  // 太极回复
  {
    id: 'tai_chi_reply',
    name: '太极回复',
    class: CardClass.Operator,
    type: CardType.Power,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '每回合开始获得 1 层耐心。',
    effect: { special: 'gain_patience_each_turn_1' },
    upgradedId: 'tai_chi_reply+',
    assetKey: 'card-tai_chi_reply',
  },
  {
    id: 'tai_chi_reply+',
    name: '太极回复+',
    class: CardClass.Operator,
    type: CardType.Power,
    rarity: CardRarity.Epic,
    cost: 1,
    description: '每回合开始获得 1 层耐心。',
    effect: { special: 'gain_patience_each_turn_1' },
    assetKey: 'card-tai_chi_reply+',
  },
  // 无限耐心
  {
    id: 'infinite_patience',
    name: '无限耐心',
    class: CardClass.Operator,
    type: CardType.Attack,
    rarity: CardRarity.Legendary,
    cost: 2,
    description: '造成 3 点伤害，每层耐心增加 5 点伤害，消耗所有耐心。',
    effect: { damage: 3, special: 'consume_patience_5' },
    upgradedId: 'infinite_patience+',
    assetKey: 'card-infinite_patience',
  },
  {
    id: 'infinite_patience+',
    name: '无限耐心+',
    class: CardClass.Operator,
    type: CardType.Attack,
    rarity: CardRarity.Legendary,
    cost: 2,
    description: '造成 5 点伤害，每层耐心增加 7 点伤害，消耗所有耐心。',
    effect: { damage: 5, special: 'consume_patience_7' },
    assetKey: 'card-infinite_patience+',
  },
  // 终极反击
  {
    id: 'final_strike',
    name: '终极反击',
    class: CardClass.Operator,
    type: CardType.Attack,
    rarity: CardRarity.Legendary,
    cost: 3,
    description: '造成 4 点伤害，本回合每获得 1 点护甲增加 1 点伤害。',
    effect: { damage: 4, special: 'damage_per_block_gained_this_turn_1' },
    upgradedId: 'final_strike+',
    assetKey: 'card-final_strike',
  },
  {
    id: 'final_strike+',
    name: '终极反击+',
    class: CardClass.Operator,
    type: CardType.Attack,
    rarity: CardRarity.Legendary,
    cost: 3,
    description: '造成 6 点伤害，本回合每获得 1 点护甲增加 2 点伤害。',
    effect: { damage: 6, special: 'damage_per_block_gained_this_turn_2' },
    assetKey: 'card-final_strike+',
  },
];

// ===== 体系专属卡牌（8 张，含升级版共 16 张）=====
const SYSTEM_CARDS: Card[] = [
  // 流程审计
  {
    id: 'process_audit',
    name: '流程审计',
    class: CardClass.System,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 0,
    description: '获得 1 层流程，抽 1 张牌。',
    effect: { applyBuff: { name: BUFFS.PROCESS, stacks: 1 }, drawCards: 1 },
    upgradedId: 'process_audit+',
    assetKey: 'card-process_audit',
  },
  {
    id: 'process_audit+',
    name: '流程审计+',
    class: CardClass.System,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 0,
    description: '获得 2 层流程，抽 1 张牌。',
    effect: { applyBuff: { name: BUFFS.PROCESS, stacks: 2 }, drawCards: 1 },
    assetKey: 'card-process_audit+',
  },
  // 慢慢来
  {
    id: 'slow_work',
    name: '慢慢来',
    class: CardClass.System,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '回复 5 点生命，获得 1 层流程。',
    effect: { heal: 5, applyBuff: { name: BUFFS.PROCESS, stacks: 1 } },
    upgradedId: 'slow_work+',
    assetKey: 'card-slow_work',
  },
  {
    id: 'slow_work+',
    name: '慢慢来+',
    class: CardClass.System,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '回复 8 点生命，获得 1 层流程。',
    effect: { heal: 8, applyBuff: { name: BUFFS.PROCESS, stacks: 1 } },
    assetKey: 'card-slow_work+',
  },
  // 温水煮青蛙
  {
    id: 'boiling_frog',
    name: '温水煮青蛙',
    class: CardClass.System,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '施加 1 层易伤和 1 层虚弱，获得 1 层流程。',
    effect: { applyDebuff: { name: DEBUFFS.VULNERABLE, stacks: 1 }, special: 'apply_weak_1_gain_process_1' },
    upgradedId: 'boiling_frog+',
    assetKey: 'card-boiling_frog',
  },
  {
    id: 'boiling_frog+',
    name: '温水煮青蛙+',
    class: CardClass.System,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '施加 2 层易伤和 2 层虚弱，获得 1 层流程。',
    effect: { applyDebuff: { name: DEBUFFS.VULNERABLE, stacks: 2 }, special: 'apply_weak_2_gain_process_1' },
    assetKey: 'card-boiling_frog+',
  },
  // 开会无结果
  {
    id: 'meeting_no_result',
    name: '开会无结果',
    class: CardClass.System,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '施加 2 层缠绕，抽 2 张牌。',
    effect: { applyDebuff: { name: DEBUFFS.ENTANGLED, stacks: 2 }, drawCards: 2 },
    upgradedId: 'meeting_no_result+',
    assetKey: 'card-meeting_no_result',
  },
  {
    id: 'meeting_no_result+',
    name: '开会无结果+',
    class: CardClass.System,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '施加 2 层缠绕，抽 3 张牌。',
    effect: { applyDebuff: { name: DEBUFFS.ENTANGLED, stacks: 2 }, drawCards: 3 },
    assetKey: 'card-meeting_no_result+',
  },
  // 这事明天再说
  {
    id: 'push_tomorrow',
    name: '这事明天再说',
    class: CardClass.System,
    type: CardType.Skill,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '回复 10 点生命，获得 3 层流程。',
    effect: { heal: 10, applyBuff: { name: BUFFS.PROCESS, stacks: 3 } },
    upgradedId: 'push_tomorrow+',
    assetKey: 'card-push_tomorrow',
  },
  {
    id: 'push_tomorrow+',
    name: '这事明天再说+',
    class: CardClass.System,
    type: CardType.Skill,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '回复 15 点生命，获得 3 层流程。',
    effect: { heal: 15, applyBuff: { name: BUFFS.PROCESS, stacks: 3 } },
    assetKey: 'card-push_tomorrow+',
  },
  // 橡皮推脱
  {
    id: 'rubber_stall',
    name: '橡皮推脱',
    class: CardClass.System,
    type: CardType.Power,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '每回合开始获得 1 层流程，回复 2 点生命。',
    effect: { special: 'gain_process_heal_each_turn' },
    upgradedId: 'rubber_stall+',
    assetKey: 'card-rubber_stall',
  },
  {
    id: 'rubber_stall+',
    name: '橡皮推脱+',
    class: CardClass.System,
    type: CardType.Power,
    rarity: CardRarity.Epic,
    cost: 1,
    description: '每回合开始获得 1 层流程，回复 2 点生命。',
    effect: { special: 'gain_process_heal_each_turn' },
    assetKey: 'card-rubber_stall+',
  },
  // 体系碾压
  {
    id: 'system_grind',
    name: '体系碾压',
    class: CardClass.System,
    type: CardType.Attack,
    rarity: CardRarity.Legendary,
    cost: 2,
    description: '造成 2 点伤害，每层流程增加 2 点伤害。',
    effect: { damage: 2, special: 'damage_per_process_2' },
    upgradedId: 'system_grind+',
    assetKey: 'card-system_grind',
  },
  {
    id: 'system_grind+',
    name: '体系碾压+',
    class: CardClass.System,
    type: CardType.Attack,
    rarity: CardRarity.Legendary,
    cost: 2,
    description: '造成 3 点伤害，每层流程增加 3 点伤害。',
    effect: { damage: 3, special: 'damage_per_process_3' },
    assetKey: 'card-system_grind+',
  },
  // 终极流程
  {
    id: 'ultimate_process',
    name: '终极流程',
    class: CardClass.System,
    type: CardType.Skill,
    rarity: CardRarity.Legendary,
    cost: 0,
    description: '消耗所有流程，每层回复 3 点生命并抽 1 张牌。',
    effect: { special: 'consume_process_heal_3_draw_1' },
    upgradedId: 'ultimate_process+',
    assetKey: 'card-ultimate_process',
  },
  {
    id: 'ultimate_process+',
    name: '终极流程+',
    class: CardClass.System,
    type: CardType.Skill,
    rarity: CardRarity.Legendary,
    cost: 0,
    description: '消耗所有流程，每层回复 5 点生命并抽 1 张牌。',
    effect: { special: 'consume_process_heal_5_draw_1' },
    assetKey: 'card-ultimate_process+',
  },
];

// ===== 数据专属卡牌（8 张，含升级版共 16 张）=====
const DATA_CARDS: Card[] = [
  // 做报表
  {
    id: 'make_report',
    name: '做报表',
    class: CardClass.Data,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 1 层核算，抽 2 张牌。',
    effect: { applyBuff: { name: BUFFS.AUDIT, stacks: 1 }, drawCards: 2 },
    upgradedId: 'make_report+',
    assetKey: 'card-make_report',
  },
  {
    id: 'make_report+',
    name: '做报表+',
    class: CardClass.Data,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 2 层核算，抽 2 张牌。',
    effect: { applyBuff: { name: BUFFS.AUDIT, stacks: 2 }, drawCards: 2 },
    assetKey: 'card-make_report+',
  },
  // 记账
  {
    id: 'bookkeeping',
    name: '记账',
    class: CardClass.Data,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 5 点护甲，获得 1 层核算。',
    effect: { block: 5, applyBuff: { name: BUFFS.AUDIT, stacks: 1 } },
    upgradedId: 'bookkeeping+',
    assetKey: 'card-bookkeeping',
  },
  {
    id: 'bookkeeping+',
    name: '记账+',
    class: CardClass.Data,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 8 点护甲，获得 1 层核算。',
    effect: { block: 8, applyBuff: { name: BUFFS.AUDIT, stacks: 1 } },
    assetKey: 'card-bookkeeping+',
  },
  // 对账
  {
    id: 'reconciliation',
    name: '对账',
    class: CardClass.Data,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '消耗 3 层核算，回复 8 点生命，获得 1 点能量。',
    effect: { special: 'consume_audit_3_heal_8_energy_1' },
    upgradedId: 'reconciliation+',
    assetKey: 'card-reconciliation',
  },
  {
    id: 'reconciliation+',
    name: '对账+',
    class: CardClass.Data,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '消耗 3 层核算，回复 12 点生命，获得 2 点能量。',
    effect: { special: 'consume_audit_3_heal_12_energy_2' },
    assetKey: 'card-reconciliation+',
  },
  // 盘点
  {
    id: 'inventory_check',
    name: '盘点',
    class: CardClass.Data,
    type: CardType.Attack,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '造成 4 点伤害，手牌每有 1 张牌增加 1 点伤害。',
    effect: { damage: 4, special: 'damage_per_hand_card_1' },
    upgradedId: 'inventory_check+',
    assetKey: 'card-inventory_check',
  },
  {
    id: 'inventory_check+',
    name: '盘点+',
    class: CardClass.Data,
    type: CardType.Attack,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '造成 6 点伤害，手牌每有 1 张牌增加 2 点伤害。',
    effect: { damage: 6, special: 'damage_per_hand_card_2' },
    assetKey: 'card-inventory_check+',
  },
  // 财务报表
  {
    id: 'financial_report',
    name: '财务报表',
    class: CardClass.Data,
    type: CardType.Skill,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '获得 3 层核算，抽 3 张牌，获得 1 点能量。',
    effect: { applyBuff: { name: BUFFS.AUDIT, stacks: 3 }, drawCards: 3, gainEnergy: 1 },
    upgradedId: 'financial_report+',
    assetKey: 'card-financial_report',
  },
  {
    id: 'financial_report+',
    name: '财务报表+',
    class: CardClass.Data,
    type: CardType.Skill,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '获得 4 层核算，抽 3 张牌，获得 2 点能量。',
    effect: { applyBuff: { name: BUFFS.AUDIT, stacks: 4 }, drawCards: 3, gainEnergy: 2 },
    assetKey: 'card-financial_report+',
  },
  // 审计
  {
    id: 'audit_power',
    name: '审计',
    class: CardClass.Data,
    type: CardType.Power,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '每回合开始获得 1 层核算，抽 1 张牌。',
    effect: { special: 'gain_audit_draw_each_turn' },
    upgradedId: 'audit_power+',
    assetKey: 'card-audit_power',
  },
  {
    id: 'audit_power+',
    name: '审计+',
    class: CardClass.Data,
    type: CardType.Power,
    rarity: CardRarity.Epic,
    cost: 1,
    description: '每回合开始获得 1 层核算，抽 1 张牌。',
    effect: { special: 'gain_audit_draw_each_turn' },
    assetKey: 'card-audit_power+',
  },
  // 精准打击
  {
    id: 'precision_strike',
    name: '精准打击',
    class: CardClass.Data,
    type: CardType.Attack,
    rarity: CardRarity.Legendary,
    cost: 2,
    description: '造成 5 点伤害，每层核算增加 4 点伤害，消耗所有核算。',
    effect: { damage: 5, special: 'consume_audit_4' },
    upgradedId: 'precision_strike+',
    assetKey: 'card-precision_strike',
  },
  {
    id: 'precision_strike+',
    name: '精准打击+',
    class: CardClass.Data,
    type: CardType.Attack,
    rarity: CardRarity.Legendary,
    cost: 2,
    description: '造成 7 点伤害，每层核算增加 6 点伤害，消耗所有核算。',
    effect: { damage: 7, special: 'consume_audit_6' },
    assetKey: 'card-precision_strike+',
  },
  // 年终结算
  {
    id: 'year_end_settlement',
    name: '年终结算',
    class: CardClass.Data,
    type: CardType.Skill,
    rarity: CardRarity.Legendary,
    cost: 0,
    description: '消耗所有核算，每层回复 2 点生命、获得 1 点护甲、抽 1 张牌。',
    effect: { special: 'consume_audit_heal_2_block_1_draw_1' },
    upgradedId: 'year_end_settlement+',
    assetKey: 'card-year_end_settlement',
  },
  {
    id: 'year_end_settlement+',
    name: '年终结算+',
    class: CardClass.Data,
    type: CardType.Skill,
    rarity: CardRarity.Legendary,
    cost: 0,
    description: '消耗所有核算，每层回复 3 点生命、获得 2 点护甲、抽 1 张牌。',
    effect: { special: 'consume_audit_heal_3_block_2_draw_1' },
    assetKey: 'card-year_end_settlement+',
  },
];

// ===== 安全员 专属卡牌（8 张，含升级版共 16 张）=====
export const SAFETY_CARDS: Card[] = [
  // 巡检
  {
    id: 'patrol_inspect',
    name: '巡检',
    class: CardClass.Safety,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 6 点护甲，抽 1 张牌。',
    effect: { block: 6, drawCards: 1 },
    upgradedId: 'patrol_inspect+',
    assetKey: 'card-patrol_inspect',
  },
  {
    id: 'patrol_inspect+',
    name: '巡检+',
    class: CardClass.Safety,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 9 点护甲，抽 1 张牌。',
    effect: { block: 9, drawCards: 1 },
    assetKey: 'card-patrol_inspect+',
  },
  // 安全制度
  {
    id: 'safety_rules',
    name: '安全制度',
    class: CardClass.Safety,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 8 点护甲，获得 1 层预警。',
    effect: { block: 8, applyBuff: { name: BUFFS.EARLY_WARNING, stacks: 1 } },
    upgradedId: 'safety_rules+',
    assetKey: 'card-safety_rules',
  },
  {
    id: 'safety_rules+',
    name: '安全制度+',
    class: CardClass.Safety,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 11 点护甲，获得 2 层预警。',
    effect: { block: 11, applyBuff: { name: BUFFS.EARLY_WARNING, stacks: 2 } },
    assetKey: 'card-safety_rules+',
  },
  // 隐患排查
  {
    id: 'hazard_check',
    name: '隐患排查',
    class: CardClass.Safety,
    type: CardType.Attack,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '造成 8 点伤害，施加 1 层易伤。',
    effect: { damage: 8, applyDebuff: { name: DEBUFFS.VULNERABLE, stacks: 1 } },
    upgradedId: 'hazard_check+',
    assetKey: 'card-hazard_check',
  },
  {
    id: 'hazard_check+',
    name: '隐患排查+',
    class: CardClass.Safety,
    type: CardType.Attack,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '造成 11 点伤害，施加 2 层易伤。',
    effect: { damage: 11, applyDebuff: { name: DEBUFFS.VULNERABLE, stacks: 2 } },
    assetKey: 'card-hazard_check+',
  },
  // 安全培训
  {
    id: 'safety_training',
    name: '安全培训',
    class: CardClass.Safety,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '获得 2 层预警，抽 2 张牌。',
    effect: { applyBuff: { name: BUFFS.EARLY_WARNING, stacks: 2 }, drawCards: 2 },
    upgradedId: 'safety_training+',
    assetKey: 'card-safety_training',
  },
  {
    id: 'safety_training+',
    name: '安全培训+',
    class: CardClass.Safety,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '获得 3 层预警，抽 2 张牌。',
    effect: { applyBuff: { name: BUFFS.EARLY_WARNING, stacks: 3 }, drawCards: 2 },
    assetKey: 'card-safety_training+',
  },
  // 应急预案
  {
    id: 'emergency_plan',
    name: '应急预案',
    class: CardClass.Safety,
    type: CardType.Skill,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '消耗所有预警，每层获得 5 点护甲、造成 3 点伤害（对所有敌人）。',
    effect: { special: 'consume_early_warning_block_5_damage_3' },
    upgradedId: 'emergency_plan+',
    assetKey: 'card-emergency_plan',
  },
  {
    id: 'emergency_plan+',
    name: '应急预案+',
    class: CardClass.Safety,
    type: CardType.Skill,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '消耗所有预警，每层获得 8 点护甲、造成 5 点伤害（对所有敌人）。',
    effect: { special: 'consume_early_warning_block_8_damage_5' },
    assetKey: 'card-emergency_plan+',
  },
  // 安全审计
  {
    id: 'safety_audit',
    name: '安全审计',
    class: CardClass.Safety,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '获得 3 层预警。若预警 ≥ 5 层，额外获得 1 点能量。',
    effect: { special: 'gain_early_warning_3_energy_if_5' },
    upgradedId: 'safety_audit+',
    assetKey: 'card-safety_audit',
  },
  {
    id: 'safety_audit+',
    name: '安全审计+',
    class: CardClass.Safety,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '获得 4 层预警。若预警 ≥ 5 层，额外获得 2 点能量。',
    effect: { special: 'gain_early_warning_4_energy_if_5' },
    assetKey: 'card-safety_audit+',
  },
  // 事故调查
  {
    id: 'accident_investigation',
    name: '事故调查',
    class: CardClass.Safety,
    type: CardType.Attack,
    rarity: CardRarity.Rare,
    cost: 2,
    description: '造成 12 点伤害，消耗所有预警，每层额外造成 4 点伤害。',
    effect: { damage: 12, special: 'consume_early_warning_damage_4' },
    upgradedId: 'accident_investigation+',
    assetKey: 'card-accident_investigation',
  },
  {
    id: 'accident_investigation+',
    name: '事故调查+',
    class: CardClass.Safety,
    type: CardType.Attack,
    rarity: CardRarity.Rare,
    cost: 2,
    description: '造成 16 点伤害，消耗所有预警，每层额外造成 6 点伤害。',
    effect: { damage: 16, special: 'consume_early_warning_damage_6' },
    assetKey: 'card-accident_investigation+',
  },
  // 零事故
  {
    id: 'zero_accident',
    name: '零事故',
    class: CardClass.Safety,
    type: CardType.Power,
    rarity: CardRarity.Legendary,
    cost: 3,
    description: '每回合开始获得 1 层预警和 5 点护甲。',
    effect: { special: 'gain_early_warning_and_block_each_turn' },
    upgradedId: 'zero_accident+',
    assetKey: 'card-zero_accident',
  },
  {
    id: 'zero_accident+',
    name: '零事故+',
    class: CardClass.Safety,
    type: CardType.Power,
    rarity: CardRarity.Legendary,
    cost: 3,
    description: '每回合开始获得 2 层预警和 8 点护甲。',
    effect: { special: 'gain_early_warning_and_block_each_turn_2' },
    assetKey: 'card-zero_accident+',
  },
];

// ===== IT 专属卡牌（8 张，含升级版共 16 张）=====
export const IT_CARDS: Card[] = [
  // 代码攻击
  {
    id: 'code_attack',
    name: '代码攻击',
    class: CardClass.IT,
    type: CardType.Attack,
    rarity: CardRarity.Common,
    cost: 1,
    description: '造成 7 点伤害，获得 1 层加班。',
    effect: { damage: 7, applyBuff: { name: BUFFS.OVERWORK, stacks: 1 } },
    upgradedId: 'code_attack+',
    assetKey: 'card-code_attack',
  },
  {
    id: 'code_attack+',
    name: '代码攻击+',
    class: CardClass.IT,
    type: CardType.Attack,
    rarity: CardRarity.Common,
    cost: 1,
    description: '造成 10 点伤害，获得 1 层加班。',
    effect: { damage: 10, applyBuff: { name: BUFFS.OVERWORK, stacks: 1 } },
    assetKey: 'card-code_attack+',
  },
  // 系统防御
  {
    id: 'system_defense',
    name: '系统防御',
    class: CardClass.IT,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 7 点护甲。',
    effect: { block: 7 },
    upgradedId: 'system_defense+',
    assetKey: 'card-system_defense',
  },
  {
    id: 'system_defense+',
    name: '系统防御+',
    class: CardClass.IT,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '获得 10 点护甲。',
    effect: { block: 10 },
    assetKey: 'card-system_defense+',
  },
  // Debug
  {
    id: 'debug',
    name: 'Debug',
    class: CardClass.IT,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '回复 4 点生命，抽 1 张牌。',
    effect: { heal: 4, drawCards: 1 },
    upgradedId: 'debug+',
    assetKey: 'card-debug',
  },
  {
    id: 'debug+',
    name: 'Debug+',
    class: CardClass.IT,
    type: CardType.Skill,
    rarity: CardRarity.Common,
    cost: 1,
    description: '回复 6 点生命，抽 1 张牌。',
    effect: { heal: 6, drawCards: 1 },
    assetKey: 'card-debug+',
  },
  // 加班
  {
    id: 'overtime',
    name: '加班',
    class: CardClass.IT,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 0,
    description: '获得 2 层加班，失去 2 点生命。',
    effect: { applyBuff: { name: BUFFS.OVERWORK, stacks: 2 }, special: 'lose_hp_2' },
    upgradedId: 'overtime+',
    assetKey: 'card-overtime',
  },
  {
    id: 'overtime+',
    name: '加班+',
    class: CardClass.IT,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 0,
    description: '获得 3 层加班，失去 2 点生命。',
    effect: { applyBuff: { name: BUFFS.OVERWORK, stacks: 3 }, special: 'lose_hp_2' },
    assetKey: 'card-overtime+',
  },
  // 代码审查
  {
    id: 'code_review',
    name: '代码审查',
    class: CardClass.IT,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '施加 2 层虚弱，抽 1 张牌。',
    effect: { applyDebuff: { name: DEBUFFS.WEAK, stacks: 2 }, drawCards: 1 },
    upgradedId: 'code_review+',
    assetKey: 'card-code_review',
  },
  {
    id: 'code_review+',
    name: '代码审查+',
    class: CardClass.IT,
    type: CardType.Skill,
    rarity: CardRarity.Rare,
    cost: 1,
    description: '施加 3 层虚弱，抽 1 张牌。',
    effect: { applyDebuff: { name: DEBUFFS.WEAK, stacks: 3 }, drawCards: 1 },
    assetKey: 'card-code_review+',
  },
  // 系统崩溃
  {
    id: 'system_crash',
    name: '系统崩溃',
    class: CardClass.IT,
    type: CardType.Attack,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '造成 12 点伤害，消耗所有加班，每点增加 3 点伤害。',
    effect: { damage: 12, special: 'consume_overwork_3' },
    upgradedId: 'system_crash+',
    assetKey: 'card-system_crash',
  },
  {
    id: 'system_crash+',
    name: '系统崩溃+',
    class: CardClass.IT,
    type: CardType.Attack,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '造成 16 点伤害，消耗所有加班，每点增加 3 点伤害。',
    effect: { damage: 16, special: 'consume_overwork_3' },
    assetKey: 'card-system_crash+',
  },
  // 技术栈
  {
    id: 'tech_stack',
    name: '技术栈',
    class: CardClass.IT,
    type: CardType.Power,
    rarity: CardRarity.Epic,
    cost: 3,
    description: '每回合开始时获得 1 层加班。',
    effect: { special: 'gain_overwork_each_turn_1' },
    upgradedId: 'tech_stack+',
    assetKey: 'card-tech_stack',
  },
  {
    id: 'tech_stack+',
    name: '技术栈+',
    class: CardClass.IT,
    type: CardType.Power,
    rarity: CardRarity.Epic,
    cost: 2,
    description: '每回合开始时获得 1 层加班。',
    effect: { special: 'gain_overwork_each_turn_1' },
    assetKey: 'card-tech_stack+',
  },
  // 生产部署
  {
    id: 'production_deploy',
    name: '生产部署',
    class: CardClass.IT,
    type: CardType.Attack,
    rarity: CardRarity.Legendary,
    cost: 3,
    description: '造成 20 点伤害，本回合所有攻击牌伤害翻倍。',
    effect: { damage: 20, special: 'double_attack_damage_this_turn' },
    upgradedId: 'production_deploy+',
    assetKey: 'card-production_deploy',
  },
  {
    id: 'production_deploy+',
    name: '生产部署+',
    class: CardClass.IT,
    type: CardType.Attack,
    rarity: CardRarity.Legendary,
    cost: 2,
    description: '造成 20 点伤害，本回合所有攻击牌伤害翻倍。',
    effect: { damage: 20, special: 'double_attack_damage_this_turn' },
    assetKey: 'card-production_deploy+',
  },
];

// 所有卡牌合并
export const ALL_CARDS: Card[] = [
  ...BASIC_CARDS,
  ...CLERK_CARDS,
  ...OPERATOR_CARDS,
  ...SYSTEM_CARDS,
  ...DATA_CARDS,
  ...SAFETY_CARDS,
  ...IT_CARDS,
];

// 卡牌查找索引（id -> Card），用于快速查找
const CARD_INDEX: Map<string, Card> = new Map(ALL_CARDS.map((card) => [card.id, card]));

/**
 * 根据卡牌 id 获取卡牌数据
 * @param id 卡牌唯一 id
 * @returns 卡牌数据，未找到时返回 undefined
 */
export function getCard(id: string): Card | undefined {
  return CARD_INDEX.get(id);
}

/**
 * 获取指定卡牌的升级版本
 * @param id 基础卡牌 id
 * @returns 升级后的卡牌数据，若无升级版或未找到则返回 undefined
 */
export function getUpgradedCard(id: string): Card | undefined {
  const card = CARD_INDEX.get(id);
  if (!card || !card.upgradedId) {
    return undefined;
  }
  return CARD_INDEX.get(card.upgradedId);
}

/**
 * 获取指定职业归属的所有卡牌
 * @param cls 职业归属
 * @returns 该职业的所有卡牌数组
 */
export function getCardsByClass(cls: CardClass): Card[] {
  return ALL_CARDS.filter((card) => card.class === cls);
}

/**
 * 获取指定稀有度的所有卡牌
 * @param rarity 稀有度
 * @returns 该稀有度的所有卡牌数组
 */
export function getCardsByRarity(rarity: CardRarity): Card[] {
  return ALL_CARDS.filter((card) => card.rarity === rarity);
}
