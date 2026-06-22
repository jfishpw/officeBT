// 敌人数据定义：共 13 种敌人（9 种普通 + 4 种 Boss）
// 普通敌人分同事、甲方、项目三大类，Boss 分 4 层逐级挑战

// ===== 类型定义 =====

// 敌人意图类型
export enum IntentType {
  Attack = 'attack', // 攻击
  Defend = 'defend', // 防御
  Buff = 'buff', // 增益
  Debuff = 'debuff', // 减益
  AttackDebuff = 'attack_debuff', // 攻击+减益
  Unknown = 'unknown', // 未知（Boss 特殊）
}

// 敌人意图（显示给玩家下回合行动）
export interface EnemyIntent {
  type: IntentType;
  value?: number; // 攻击伤害或护甲值
  buff?: { name: string; stacks: number }; // 增益
  debuff?: { name: string; stacks: number }; // 减益
  description: string; // 意图描述
}

// 敌人属性
export interface EnemyStats {
  maxHp: number;
  currentHp: number;
  attack: number; // 基础攻击力
  block: number; // 当前护甲
}

// 敌人 AI 行为模式
// moves 是一个意图序列，按顺序循环或条件触发
export interface EnemyAI {
  type: 'sequential' | 'conditional'; // 顺序循环或条件触发
  moves: EnemyIntent[]; // 顺序循环的意图列表
  conditions?: {
    // 条件触发（Boss 用）
    hpThreshold?: number; // HP 低于百分比触发特殊技能
    specialMoves?: EnemyIntent[]; // 特殊技能
    everyNTurns?: { n: number; move: EnemyIntent }; // 每 N 回合触发
  };
}

// 敌人数据定义
export interface EnemyData {
  id: string;
  name: string; // 中文名
  type: 'normal' | 'elite' | 'boss';
  category?: 'colleague' | 'client' | 'project' | 'manager'; // 分类
  description: string;
  stats: {
    maxHp: [number, number]; // HP 范围 [min, max]
    attack: number;
  };
  ai: EnemyAI;
  assetKey: string; // 资源 key
  color: string; // 主题色（UI 占位用）
  isBoss?: boolean;
  bossFloor?: number; // Boss 所在层（1-4）
  rewards?: {
    gold: [number, number];
    cards?: number; // 奖励卡牌数
  };
}

// ===== Buff/Debuff 名称常量（与 cards.ts 保持一致）=====

const BUFF_STRENGTH = 'strength'; // 力量（增加攻击伤害）
const BUFF_DEXTERITY = 'dexterity'; // 敏捷（增加护甲）
const DEBUFF_VULNERABLE = 'vulnerable'; // 易伤（受击伤害+50%）
const DEBUFF_WEAK = 'weak'; // 虚弱（攻击伤害-25%）
const DEBUFF_ENTANGLED = 'entangled'; // 缠绕（不能出攻击牌）
const DEBUFF_FRAZZLED = 'frazzled'; // 烦躁（每回合开始失去能量）

// ===== 层数难度缩放系数 =====

const FLOOR_SCALING: Readonly<Record<number, { hp: number; attack: number }>> = {
  1: { hp: 1.0, attack: 1.0 },
  2: { hp: 1.2, attack: 1.15 },
  3: { hp: 1.4, attack: 1.3 },
  4: { hp: 1.6, attack: 1.45 },
};

// ===== 普通敌人（9 种）=====

// --- 同事类（colleague）3 种 ---

// 推卸责任的同事
const colleagueBlame: EnemyData = {
  id: 'colleague_blame',
  name: '推卸责任的同事',
  type: 'normal',
  category: 'colleague',
  description: '总是把锅甩给别人，让你背锅',
  stats: { maxHp: [28, 34], attack: 6 },
  ai: {
    type: 'sequential',
    moves: [
      { type: IntentType.Attack, value: 8, description: '攻击 8 点伤害' },
      { type: IntentType.Attack, value: 8, description: '攻击 8 点伤害' },
      {
        type: IntentType.Debuff,
        debuff: { name: DEBUFF_VULNERABLE, stacks: 2 },
        description: '施加 2 层易伤',
      },
    ],
  },
  assetKey: 'enemy-colleague_blame',
  color: '#8B7355',
};

// 抢功劳的同事
const colleagueCredit: EnemyData = {
  id: 'colleague_credit',
  name: '抢功劳的同事',
  type: 'normal',
  category: 'colleague',
  description: '你的成果都被他据为己有',
  stats: { maxHp: [32, 38], attack: 7 },
  ai: {
    type: 'sequential',
    moves: [
      { type: IntentType.Attack, value: 10, description: '攻击 10 点伤害' },
      {
        type: IntentType.Buff,
        buff: { name: BUFF_STRENGTH, stacks: 2 },
        description: '获得 2 层力量',
      },
      { type: IntentType.Attack, value: 12, description: '攻击 12 点伤害' },
    ],
  },
  assetKey: 'enemy-colleague_credit',
  color: '#B8860B',
};

// 摸鱼的同事
const colleagueSlacker: EnemyData = {
  id: 'colleague_slacker',
  name: '摸鱼的同事',
  type: 'normal',
  category: 'colleague',
  description: '上班时间都在刷手机，但偶尔也会偷袭',
  stats: { maxHp: [24, 30], attack: 5 },
  ai: {
    type: 'sequential',
    moves: [
      { type: IntentType.Defend, value: 5, description: '获得 5 点护甲' },
      { type: IntentType.Attack, value: 6, description: '攻击 6 点伤害' },
      { type: IntentType.Attack, value: 6, description: '攻击 6 点伤害' },
      {
        type: IntentType.Buff,
        buff: { name: BUFF_DEXTERITY, stacks: 2 },
        description: '获得 2 层敏捷',
      },
    ],
  },
  assetKey: 'enemy-colleague_slacker',
  color: '#6B8E8B',
};

// --- 甲方类（client）3 种 ---

// 需求多变的甲方
const clientFickle: EnemyData = {
  id: 'client_fickle',
  name: '需求多变的甲方',
  type: 'normal',
  category: 'client',
  description: '需求一天三变，让你疲于奔命',
  stats: { maxHp: [36, 44], attack: 6 },
  ai: {
    type: 'sequential',
    moves: [
      { type: IntentType.Attack, value: 7, description: '攻击 7 点伤害' },
      {
        type: IntentType.Debuff,
        debuff: { name: DEBUFF_ENTANGLED, stacks: 1 },
        description: '施加缠绕',
      },
      { type: IntentType.Attack, value: 9, description: '攻击 9 点伤害' },
      {
        type: IntentType.Debuff,
        debuff: { name: DEBUFF_FRAZZLED, stacks: 1 },
        description: '施加烦躁',
      },
    ],
  },
  assetKey: 'enemy-client_fickle',
  color: '#CD5C5C',
};

// 预算削减的甲方
const clientBudget: EnemyData = {
  id: 'client_budget',
  name: '预算削减的甲方',
  type: 'normal',
  category: 'client',
  description: '预算一砍再砍，要求却越来越多',
  stats: { maxHp: [40, 48], attack: 5 },
  ai: {
    type: 'sequential',
    moves: [
      { type: IntentType.Defend, value: 8, description: '获得 8 点护甲' },
      { type: IntentType.Attack, value: 8, description: '攻击 8 点伤害' },
      {
        type: IntentType.Buff,
        buff: { name: BUFF_STRENGTH, stacks: 3 },
        description: '获得 3 层力量',
      },
    ],
  },
  assetKey: 'enemy-client_budget',
  color: '#A0522D',
};

// 无理要求的甲方
const clientUnreasonable: EnemyData = {
  id: 'client_unreasonable',
  name: '无理要求的甲方',
  type: 'normal',
  category: 'client',
  description: '提出各种不合理要求，还要求明天交付',
  stats: { maxHp: [38, 46], attack: 8 },
  ai: {
    type: 'sequential',
    moves: [
      { type: IntentType.Attack, value: 12, description: '攻击 12 点伤害' },
      {
        type: IntentType.Debuff,
        debuff: { name: DEBUFF_VULNERABLE, stacks: 2 },
        description: '施加 2 层易伤和 2 层虚弱',
      },
      { type: IntentType.Attack, value: 14, description: '攻击 14 点伤害' },
    ],
  },
  assetKey: 'enemy-client_unreasonable',
  color: '#8B0000',
};

// --- 项目类（project）3 种 ---

// 延期的项目
const projectDelayed: EnemyData = {
  id: 'project_delayed',
  name: '延期的项目',
  type: 'normal',
  category: 'project',
  description: 'deadline 一拖再拖，压力越来越大',
  stats: { maxHp: [45, 55], attack: 7 },
  ai: {
    type: 'sequential',
    moves: [
      { type: IntentType.Attack, value: 10, description: '攻击 10 点伤害' },
      {
        type: IntentType.Debuff,
        debuff: { name: DEBUFF_FRAZZLED, stacks: 1 },
        description: '施加烦躁',
      },
      { type: IntentType.Attack, value: 12, description: '攻击 12 点伤害' },
      {
        type: IntentType.Buff,
        buff: { name: BUFF_STRENGTH, stacks: 2 },
        description: '获得 2 层力量',
      },
    ],
  },
  assetKey: 'enemy-project_delayed',
  color: '#FF6347',
};

// 需求模糊的项目
const projectVague: EnemyData = {
  id: 'project_vague',
  name: '需求模糊的项目',
  type: 'normal',
  category: 'project',
  description: '需求不清不楚，做出来全是错的',
  stats: { maxHp: [35, 42], attack: 6 },
  ai: {
    type: 'sequential',
    moves: [
      { type: IntentType.Unknown, description: '需求不明，无法预测下一步行动' },
      { type: IntentType.Attack, value: 8, description: '攻击 8 点伤害' },
      {
        type: IntentType.Debuff,
        debuff: { name: DEBUFF_ENTANGLED, stacks: 1 },
        description: '施加缠绕',
      },
    ],
  },
  assetKey: 'enemy-project_vague',
  color: '#9370DB',
};

// 资源不足的项目
const projectUnderstaffed: EnemyData = {
  id: 'project_understaffed',
  name: '资源不足的项目',
  type: 'normal',
  category: 'project',
  description: '人手不够，一个人干三个人的活',
  stats: { maxHp: [42, 50], attack: 6 },
  ai: {
    type: 'sequential',
    moves: [
      { type: IntentType.Attack, value: 7, description: '攻击 7 点伤害' },
      { type: IntentType.Defend, value: 6, description: '获得 6 点护甲' },
      { type: IntentType.Attack, value: 9, description: '攻击 9 点伤害' },
      {
        type: IntentType.Buff,
        buff: { name: BUFF_DEXTERITY, stacks: 3 },
        description: '获得 3 层敏捷',
      },
    ],
  },
  assetKey: 'enemy-project_understaffed',
  color: '#5F9EA0',
};

// ===== Boss 敌人（4 种，每层一个）=====

// 部门经理（第 1 层）
const bossManager: EnemyData = {
  id: 'boss_manager',
  name: '部门经理',
  type: 'boss',
  category: 'manager',
  description: '你的直属上司，喜欢开会和甩锅',
  stats: { maxHp: [80, 90], attack: 8 },
  ai: {
    type: 'conditional',
    moves: [
      { type: IntentType.Attack, value: 10, description: '攻击 10 点伤害' },
      { type: IntentType.Defend, value: 8, description: '获得 8 点护甲' },
      { type: IntentType.Attack, value: 12, description: '攻击 12 点伤害' },
      {
        type: IntentType.Debuff,
        debuff: { name: DEBUFF_VULNERABLE, stacks: 2 },
        description: '施加 2 层易伤',
      },
    ],
    conditions: {
      everyNTurns: {
        n: 3,
        move: {
          type: IntentType.Unknown,
          description: '召唤实习生（攻击 4，生命 10）',
        },
      },
    },
  },
  assetKey: 'enemy-boss_manager',
  color: '#4682B4',
  isBoss: true,
  bossFloor: 1,
  rewards: { gold: [50, 70], cards: 1 },
};

// 总监（第 2 层）
const bossDirector: EnemyData = {
  id: 'boss_director',
  name: '总监',
  type: 'boss',
  category: 'manager',
  description: '部门的大佬，决策影响整个团队',
  stats: { maxHp: [120, 140], attack: 10 },
  ai: {
    type: 'conditional',
    moves: [
      { type: IntentType.Attack, value: 14, description: '攻击 14 点伤害' },
      {
        type: IntentType.Buff,
        buff: { name: BUFF_STRENGTH, stacks: 3 },
        description: '获得 3 层力量',
      },
      { type: IntentType.Attack, value: 16, description: '攻击 16 点伤害' },
      {
        type: IntentType.Debuff,
        debuff: { name: DEBUFF_WEAK, stacks: 2 },
        description: '施加 2 层虚弱',
      },
      { type: IntentType.Attack, value: 18, description: '攻击 18 点伤害' },
    ],
    conditions: {
      hpThreshold: 0.5,
      specialMoves: [
        {
          type: IntentType.Buff,
          buff: { name: 'enrage', stacks: 1 },
          description: '暴怒模式：攻击力 +50%',
        },
      ],
    },
  },
  assetKey: 'enemy-boss_director',
  color: '#8B008B',
  isBoss: true,
  bossFloor: 2,
  rewards: { gold: [80, 100], cards: 1 },
};

// CTO（第 3 层）
const bossCto: EnemyData = {
  id: 'boss_cto',
  name: 'CTO',
  type: 'boss',
  category: 'manager',
  description: '技术大牛，一言不合就重构系统',
  stats: { maxHp: [160, 180], attack: 12 },
  ai: {
    type: 'conditional',
    moves: [
      { type: IntentType.Attack, value: 16, description: '攻击 16 点伤害' },
      {
        type: IntentType.Debuff,
        debuff: { name: DEBUFF_ENTANGLED, stacks: 1 },
        description: '施加缠绕',
      },
      {
        type: IntentType.Buff,
        buff: { name: BUFF_STRENGTH, stacks: 4 },
        description: '获得 4 层力量',
      },
      { type: IntentType.Attack, value: 20, description: '攻击 20 点伤害' },
      {
        type: IntentType.Debuff,
        debuff: { name: DEBUFF_VULNERABLE, stacks: 3 },
        description: '施加 3 层易伤',
      },
    ],
    conditions: {
      everyNTurns: {
        n: 4,
        move: {
          type: IntentType.Unknown,
          description: '系统重构：本回合玩家能量 -1',
        },
      },
    },
  },
  assetKey: 'enemy-boss_cto',
  color: '#4169E1',
  isBoss: true,
  bossFloor: 3,
  rewards: { gold: [120, 150], cards: 2 },
};

// CEO（第 4 层，最终 Boss）
const bossCeo: EnemyData = {
  id: 'boss_ceo',
  name: 'CEO',
  type: 'boss',
  category: 'manager',
  description: '公司的最高决策者，你的最终挑战',
  stats: { maxHp: [220, 260], attack: 14 },
  ai: {
    type: 'conditional',
    moves: [
      { type: IntentType.Attack, value: 18, description: '攻击 18 点伤害' },
      {
        type: IntentType.Buff,
        buff: { name: BUFF_STRENGTH, stacks: 5 },
        description: '获得 5 层力量',
      },
      { type: IntentType.Attack, value: 22, description: '攻击 22 点伤害' },
      {
        type: IntentType.Debuff,
        debuff: { name: DEBUFF_VULNERABLE, stacks: 3 },
        description: '施加 3 层易伤和 3 层虚弱',
      },
      { type: IntentType.Attack, value: 26, description: '攻击 26 点伤害' },
    ],
    conditions: {
      everyNTurns: {
        n: 3,
        move: {
          type: IntentType.Unknown,
          description: '全员会议：召唤 2 个中层管理（攻击 6，生命 20）',
        },
      },
      hpThreshold: 0.3,
      specialMoves: [
        {
          type: IntentType.Buff,
          buff: { name: 'double_attack', stacks: 1 },
          description: '战略调整：每回合攻击两次',
        },
      ],
    },
  },
  assetKey: 'enemy-boss_ceo',
  color: '#FFD700',
  isBoss: true,
  bossFloor: 4,
  rewards: { gold: [200, 300], cards: 3 },
};

// ===== 数据导出 =====

// 普通敌人列表（9 种）
export const NORMAL_ENEMIES: EnemyData[] = [
  colleagueBlame,
  colleagueCredit,
  colleagueSlacker,
  clientFickle,
  clientBudget,
  clientUnreasonable,
  projectDelayed,
  projectVague,
  projectUnderstaffed,
];

// 精英敌人列表（复用普通敌人）
export const ELITE_ENEMIES: EnemyData[] = NORMAL_ENEMIES;

// Boss 列表（4 个）
export const BOSSES: EnemyData[] = [bossManager, bossDirector, bossCto, bossCeo];

// 所有敌人合并
export const ALL_ENEMIES: EnemyData[] = [...NORMAL_ENEMIES, ...BOSSES];

// 敌人查找索引（id -> EnemyData），用于快速查找
const ENEMY_INDEX: Map<string, EnemyData> = new Map(
  ALL_ENEMIES.map((enemy) => [enemy.id, enemy]),
);

// ===== 查找函数 =====

/**
 * 根据敌人 id 获取敌人数据
 * @param id 敌人唯一 id
 * @returns 敌人数据，未找到时返回 undefined
 */
export function getEnemy(id: string): EnemyData | undefined {
  return ENEMY_INDEX.get(id);
}

/**
 * 根据层数获取对应 Boss
 * @param floor 楼层（1-4）
 * @returns Boss 数据，未找到时返回 undefined
 */
export function getBossByFloor(floor: number): EnemyData | undefined {
  return BOSSES.find((boss) => boss.bossFloor === floor);
}

/**
 * 获取随机普通敌人列表（应用难度缩放）
 * @param floor 当前楼层（1-4），决定缩放系数
 * @param count 需要的敌人数量
 * @param rng 随机数生成器实例（使用其 pick 方法选取敌人）
 * @returns 缩放后的敌人数据数组（深拷贝，不影响原始数据）
 */
export function getRandomNormalEnemies(
  floor: number,
  count: number,
  rng: any,
): EnemyData[] {
  if (count <= 0) {
    return [];
  }
  // 获取楼层缩放系数，未知楼层默认不缩放
  const scaling = FLOOR_SCALING[floor] ?? { hp: 1.0, attack: 1.0 };
  const result: EnemyData[] = [];
  for (let i = 0; i < count; i++) {
    const base: EnemyData = rng.pick(NORMAL_ENEMIES);
    result.push(scaleEnemy(base, scaling.hp, scaling.attack));
  }
  return result;
}

// ===== 内部辅助函数 =====

/**
 * 深拷贝敌人数据（使用 JSON 序列化，适用于纯数据对象）
 * @param enemy 原始敌人数据
 * @returns 深拷贝后的敌人数据
 */
function cloneEnemy(enemy: EnemyData): EnemyData {
  return JSON.parse(JSON.stringify(enemy)) as EnemyData;
}

/**
 * 对敌人数据应用难度缩放
 * @param enemy 原始敌人数据
 * @param hpMult HP 缩放系数
 * @param atkMult 攻击缩放系数
 * @returns 缩放后的新敌人数据（不修改原始数据）
 */
function scaleEnemy(
  enemy: EnemyData,
  hpMult: number,
  atkMult: number,
): EnemyData {
  const clone = cloneEnemy(enemy);
  // 缩放 HP 范围
  clone.stats.maxHp = [
    Math.round(clone.stats.maxHp[0] * hpMult),
    Math.round(clone.stats.maxHp[1] * hpMult),
  ];
  // 缩放基础攻击力
  clone.stats.attack = Math.round(clone.stats.attack * atkMult);
  // 缩放所有攻击意图的伤害值
  const scaleMoves = (moves: EnemyIntent[]): void => {
    for (const move of moves) {
      if (
        (move.type === IntentType.Attack ||
          move.type === IntentType.AttackDebuff) &&
        move.value !== undefined
      ) {
        move.value = Math.round(move.value * atkMult);
      }
    }
  };
  scaleMoves(clone.ai.moves);
  if (clone.ai.conditions?.specialMoves) {
    scaleMoves(clone.ai.conditions.specialMoves);
  }
  if (clone.ai.conditions?.everyNTurns) {
    const move = clone.ai.conditions.everyNTurns.move;
    if (
      (move.type === IntentType.Attack ||
        move.type === IntentType.AttackDebuff) &&
      move.value !== undefined
    ) {
      move.value = Math.round(move.value * atkMult);
    }
  }
  return clone;
}
