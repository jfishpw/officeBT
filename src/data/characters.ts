// 角色数据定义：6 种职业角色（文员、操作工、体系、数据、安全员、IT）
// 各职业拥有差异化机制：防御控制、纯防御反击、持续恢复、精准核算、预防预警、爆发技术

// 职业枚举
export enum CharacterClass {
  Clerk = 'clerk', // 文员
  Operator = 'operator', // 操作工
  System = 'system', // 体系
  Data = 'data', // 数据
  Safety = 'safety', // 安全员
  IT = 'it', // IT
}

// 角色基础属性
export interface CharacterStats {
  maxHp: number; // 最大生命值
  startingEnergy: number; // 初始能量（每回合）
  startingGold: number; // 初始金币
}

// 角色数据
export interface CharacterData {
  id: CharacterClass;
  name: string; // 中文名
  title: string; // 职业称号
  description: string; // 职业描述
  trait: string; // 职业特征描述
  stats: CharacterStats;
  startingDeck: string[]; // 初始卡组（卡牌 id 数组）
  cardPool: string[]; // 专属卡牌池（卡牌 id 数组，用于掉落）
  assetKey: string; // 资源 key（用于 assetLoader）
  color: string; // 主题色（用于 UI）
}

// 文员（Clerk）：偏防御/控制，擅长流程拖延、文档攻击
const clerk: CharacterData = {
  id: CharacterClass.Clerk,
  name: '文员',
  title: '行政专员',
  description: '稳健的行政专员，擅长流程管控',
  trait: '偏防御/控制，擅长流程拖延与文档攻击，生命值较高',
  stats: {
    maxHp: 75,
    startingEnergy: 3,
    startingGold: 99,
  },
  startingDeck: [
    'strike',
    'strike',
    'strike',
    'strike',
    'strike',
    'defend',
    'defend',
    'defend',
    'defend',
    'doc_attack',
    'process_defense',
  ],
  cardPool: [
    'doc_attack',
    'process_defense',
    'meeting_delay',
    'red_tape',
    'filing_cabinet',
    'bureaucracy',
    'memo_storm',
    'efficiency_review',
  ],
  assetKey: 'char-clerk',
  color: '#4A90A4',
};

// 操作工（Operator）：纯防御角色，擅长化解甲方攻击、阳奉阴违
const operator: CharacterData = {
  id: CharacterClass.Operator,
  name: '操作工',
  title: '甲方防御师',
  description: '深谙甲方套路的老手，擅长化解攻击',
  trait: '纯防御/反击，擅长化解甲方攻击、阳奉阴违，攻击力低但防御极高',
  stats: {
    maxHp: 80,
    startingEnergy: 3,
    startingGold: 80,
  },
  startingDeck: [
    'strike',
    'strike',
    'strike',
    'defend',
    'defend',
    'defend',
    'defend',
    'defend',
    'defend',
    'passive_aggressive',
  ],
  cardPool: [
    'passive_aggressive',
    'nod_and_smile',
    'left_ear_right_ear',
    'yes_but_no',
    'paper_shield',
    'tai_chi_reply',
    'infinite_patience',
    'final_strike',
  ],
  assetKey: 'char-operator',
  color: '#27AE60',
};

// 体系（System）：持续性强，低攻低防但续航能力极强
const system: CharacterData = {
  id: CharacterClass.System,
  name: '体系',
  title: '流程守护者',
  description: '用体系对抗混乱，用流程消磨一切',
  trait: '低攻击低防御，但持续性极强，擅长回血、抽牌、叠加 debuff 消耗敌人',
  stats: {
    maxHp: 70,
    startingEnergy: 3,
    startingGold: 90,
  },
  startingDeck: [
    'strike',
    'strike',
    'strike',
    'strike',
    'defend',
    'defend',
    'defend',
    'defend',
    'process_audit',
    'process_audit',
  ],
  cardPool: [
    'process_audit',
    'slow_work',
    'boiling_frog',
    'meeting_no_result',
    'push_tomorrow',
    'rubber_stall',
    'system_grind',
    'ultimate_process',
  ],
  assetKey: 'char-system',
  color: '#E67E22',
};

// 数据（Data）：精准核算型，擅长报表分析、记账盘点
const data: CharacterData = {
  id: CharacterClass.Data,
  name: '数据',
  title: '核算专员',
  description: '精打细算的核算专员，擅长报表分析与记账盘点',
  trait: '精准核算型，通过叠加"核算"层数实现精准打击与资源转化，攻守均衡但依赖蓄力',
  stats: {
    maxHp: 72,
    startingEnergy: 3,
    startingGold: 100,
  },
  startingDeck: [
    'strike',
    'strike',
    'strike',
    'strike',
    'defend',
    'defend',
    'defend',
    'defend',
    'make_report',
    'bookkeeping',
    'data_verify',
  ],
  cardPool: [
    'data_verify',
    'make_report',
    'bookkeeping',
    'reconciliation',
    'inventory_check',
    'financial_report',
    'audit_power',
    'precision_strike',
    'year_end_settlement',
  ],
  assetKey: 'char-data',
  color: '#3498DB',
};

// 安全员（Safety）：预防预警型，擅长巡检、安全制度、隐患排查
const safety: CharacterData = {
  id: CharacterClass.Safety,
  name: '安全员',
  title: '安全守护者',
  description: '防患于未然的安全守护者，擅长巡检预警与隐患排查',
  trait: '预防预警型，通过叠加"预警"层数提前减免伤害，擅长巡检抽牌、制度防御、隐患排查削弱敌人',
  stats: {
    maxHp: 78,
    startingEnergy: 3,
    startingGold: 85,
  },
  startingDeck: [
    'strike',
    'strike',
    'strike',
    'strike',
    'defend',
    'defend',
    'defend',
    'defend',
    'patrol_inspect',
    'safety_rules',
  ],
  cardPool: [
    'patrol_inspect',
    'safety_rules',
    'hazard_check',
    'safety_training',
    'emergency_plan',
    'safety_audit',
    'accident_investigation',
    'zero_accident',
  ],
  assetKey: 'char-safety',
  color: '#F39C12',
};

// IT：偏爆发/技术，擅长代码攻击、debug 回复、加班加成
const it: CharacterData = {
  id: CharacterClass.IT,
  name: 'IT',
  title: '工程师',
  description: '技术精湛的工程师，擅长代码爆发',
  trait: '偏爆发/技术，擅长代码攻击与加班加成，能量高但生命值较低',
  stats: {
    maxHp: 65,
    startingEnergy: 4,
    startingGold: 80,
  },
  startingDeck: [
    'strike',
    'strike',
    'strike',
    'strike',
    'strike',
    'defend',
    'defend',
    'defend',
    'defend',
    'code_attack',
    'hotfix',
  ],
  cardPool: [
    'hotfix',
    'code_attack',
    'system_defense',
    'debug',
    'overtime',
    'code_review',
    'system_crash',
    'tech_stack',
    'production_deploy',
  ],
  assetKey: 'char-it',
  color: '#7B68EE',
};

// 所有角色数据
export const CHARACTERS: CharacterData[] = [clerk, operator, system, data, safety, it];

/**
 * 根据职业枚举获取角色数据
 * @param id 职业枚举值
 * @returns 对应的角色数据
 */
export function getCharacter(id: CharacterClass): CharacterData {
  const character = CHARACTERS.find((c) => c.id === id);
  if (!character) {
    throw new Error(`getCharacter: 未找到职业 "${id}" 的角色数据`);
  }
  return character;
}
