// 剧情数据定义：主线剧情 7 段（共 27 个对话节点）+ 随机事件 8 种（共 8 个对话节点）
// 提供按触发点获取主线剧情、按权重随机选取事件的能力

// ===== 类型定义 =====

// 对话效果类型
export type DialogueEffectType =
  | 'heal' // 回复生命
  | 'damage' // 受到伤害
  | 'gold' // 金币变化（正为获得，负为失去）
  | 'card' // 获得卡牌（value 为卡牌标记）
  | 'buff' // 获得 buff
  | 'debuff' // 获得 debuff
  | 'upgrade_card' // 升级卡牌
  | 'remove_card'; // 移除卡牌

// 对话效果
// 注：在任务给定结构基础上扩展为支持多效果（effects 数组）与 buff/debuff 层数（stacks），
// 以满足随机事件中"失去 3 HP + 获得卡牌"等多效果与"力量2"等带层数需求。
export interface DialogueEffect {
  type: DialogueEffectType;
  value: number | string; // 数值或卡牌标记/buff 名
  stacks?: number; // buff/debuff 层数（仅 type 为 buff/debuff 时有效）
}

// 对话选项
export interface DialogueChoice {
  text: string; // 选项文本
  nextNodeId?: string; // 跳转的下一个对话节点 id（无则结束对话）
  effects?: DialogueEffect[]; // 选项产生的效果列表（支持多效果）
  resultText?: string; // 选择后的结果描述
}

// 对话节点
export interface DialogueNode {
  id: string;
  speaker: string; // 说话人名
  portrait?: string; // 头像资源 key
  text: string; // 对话文本
  choices?: DialogueChoice[]; // 选项（无则只有"继续"）
  nextNodeId?: string; // 无选项时的下一个节点 id
}

// 剧情序列
export interface StorySequence {
  id: string;
  trigger: 'game_start' | 'boss_1' | 'boss_2' | 'boss_3' | 'boss_4' | 'victory' | 'defeat';
  nodes: DialogueNode[];
}

// 随机事件
export interface RandomEvent {
  id: string;
  title: string; // 事件标题
  description: string; // 事件描述
  icon: string; // 事件图标（emoji）
  nodes: DialogueNode[]; // 事件对话序列
  weight: number; // 出现权重
}

// ===== Buff/Debuff 名称常量（与 cards.ts 保持一致，避免循环依赖）=====

const BUFF_STRENGTH = 'strength'; // 力量（增加攻击伤害）
const BUFF_DEXTERITY = 'dexterity'; // 敏捷（增加护甲）
const DEBUFF_VULNERABLE = 'vulnerable'; // 易伤（受击伤害+50%）
const DEBUFF_WEAK = 'weak'; // 虚弱（攻击伤害-25%）
const DEBUFF_FRAZZLED = 'frazzled'; // 烦躁（每回合开始失去能量）

// ===== 卡牌/特殊效果标记说明（由游戏逻辑层解释）=====
// 'random'          - 随机卡牌（任意职业）
// 'random_it'       - 随机 IT 卡牌
// 'random_business' - 随机商务卡牌
// 'random_clerk'    - 随机文员卡牌
// 'random_rare'     - 随机稀有卡牌
// 'overtime_excuse' - 加班推脱（50% 获得力量2，50% 失去 5 HP）
// 'printer_repair'  - 打印机修理（50% 获得 20 金币，50% 失去 4 HP）

// ===== 主线剧情 =====

export const MAIN_STORY: StorySequence[] = [
  // --- 开场 ---
  {
    id: 'story_game_start',
    trigger: 'game_start',
    nodes: [
      {
        id: 'game_start_n1',
        speaker: '旁白',
        text: '又是一个平凡的工作日...但今天，你决定不再平凡。',
        nextNodeId: 'game_start_n2',
      },
      {
        id: 'game_start_n2',
        speaker: '主角',
        text: '是时候证明自己了。从普通职员到 CEO，这条路不会容易。',
        nextNodeId: 'game_start_n3',
      },
      {
        id: 'game_start_n3',
        speaker: '旁白',
        text: '你的冒险开始了。第一站：部门。',
      },
    ],
  },
  // --- 部门经理战前 ---
  {
    id: 'story_boss_1',
    trigger: 'boss_1',
    nodes: [
      {
        id: 'boss_1_n1',
        speaker: '部门经理',
        text: '小王啊，你这个月的 KPI 不达标啊。',
        nextNodeId: 'boss_1_n2',
      },
      {
        id: 'boss_1_n2',
        speaker: '主角',
        text: '经理，我已经加班很多了...',
        nextNodeId: 'boss_1_n3',
      },
      {
        id: 'boss_1_n3',
        speaker: '部门经理',
        text: "加班？加班是应该的。我看你是需要好好'谈谈'了。",
        nextNodeId: 'boss_1_n4',
      },
      {
        id: 'boss_1_n4',
        speaker: '旁白',
        text: '部门经理挡在了你的面前。',
      },
    ],
  },
  // --- 总监战前 ---
  {
    id: 'story_boss_2',
    trigger: 'boss_2',
    nodes: [
      {
        id: 'boss_2_n1',
        speaker: '总监',
        text: '听说你最近表现不错？但想要往上走，光靠表现可不够。',
        nextNodeId: 'boss_2_n2',
      },
      {
        id: 'boss_2_n2',
        speaker: '主角',
        text: '我会用实力说话。',
        nextNodeId: 'boss_2_n3',
      },
      {
        id: 'boss_2_n3',
        speaker: '总监',
        text: '好！那就让我看看你的实力。',
        nextNodeId: 'boss_2_n4',
      },
      {
        id: 'boss_2_n4',
        speaker: '旁白',
        text: '总监的目光锐利如刀。',
      },
    ],
  },
  // --- CTO 战前 ---
  {
    id: 'story_boss_3',
    trigger: 'boss_3',
    nodes: [
      {
        id: 'boss_3_n1',
        speaker: 'CTO',
        text: "你的技术...还差得远。让我来'重构'一下你的认知。",
        nextNodeId: 'boss_3_n2',
      },
      {
        id: 'boss_3_n2',
        speaker: '主角',
        text: '技术不是一切，但我会证明我的价值。',
        nextNodeId: 'boss_3_n3',
      },
      {
        id: 'boss_3_n3',
        speaker: 'CTO',
        text: '有趣。那就来吧。',
        nextNodeId: 'boss_3_n4',
      },
      {
        id: 'boss_3_n4',
        speaker: '旁白',
        text: "CTO 启动了'系统重构'模式。",
      },
    ],
  },
  // --- CEO 战前 ---
  {
    id: 'story_boss_4',
    trigger: 'boss_4',
    nodes: [
      {
        id: 'boss_4_n1',
        speaker: 'CEO',
        text: '年轻人，你走到了这里。但你想过吗？成为 CEO 意味着什么？',
        nextNodeId: 'boss_4_n2',
      },
      {
        id: 'boss_4_n2',
        speaker: '主角',
        text: '意味着责任，也意味着改变。',
        nextNodeId: 'boss_4_n3',
      },
      {
        id: 'boss_4_n3',
        speaker: 'CEO',
        text: '哈哈，有志气！那就让我看看，你是否有资格坐上这个位置。',
        nextNodeId: 'boss_4_n4',
      },
      {
        id: 'boss_4_n4',
        speaker: '旁白',
        text: '最终的挑战来临。CEO 站在了你的面前。',
      },
    ],
  },
  // --- 胜利结局 ---
  {
    id: 'story_victory',
    trigger: 'victory',
    nodes: [
      {
        id: 'victory_n1',
        speaker: '旁白',
        text: 'CEO 倒下了。会议室里一片寂静。',
        nextNodeId: 'victory_n2',
      },
      {
        id: 'victory_n2',
        speaker: 'CEO',
        text: '你...赢了。也许，公司确实需要新的血液。',
        nextNodeId: 'victory_n3',
      },
      {
        id: 'victory_n3',
        speaker: '主角',
        text: '这不是结束，而是新的开始。',
        nextNodeId: 'victory_n4',
      },
      {
        id: 'victory_n4',
        speaker: '旁白',
        text: '你成为了新的 CEO。但你知道，这只是另一段冒险的起点。',
        nextNodeId: 'victory_n5',
      },
      {
        id: 'victory_n5',
        speaker: '旁白',
        text: '恭喜你通关！感谢游玩《上班族冒险》。',
      },
    ],
  },
  // --- 失败结局 ---
  {
    id: 'story_defeat',
    trigger: 'defeat',
    nodes: [
      {
        id: 'defeat_n1',
        speaker: '旁白',
        text: '你倒下了...',
        nextNodeId: 'defeat_n2',
      },
      {
        id: 'defeat_n2',
        speaker: '主角',
        text: '难道...我的冒险就到此为止了吗？',
        nextNodeId: 'defeat_n3',
      },
      {
        id: 'defeat_n3',
        speaker: '旁白',
        text: '但每一次失败，都是成长的机会。再来一次吧！',
      },
    ],
  },
];

// ===== 随机事件 =====

export const RANDOM_EVENTS: RandomEvent[] = [
  // 1. 咖啡机故障
  {
    id: 'event_coffee_machine',
    title: '咖啡机故障',
    description: '咖啡机坏了，你急需一杯咖啡提神。',
    icon: '☕',
    weight: 10,
    nodes: [
      {
        id: 'event_coffee_machine_n1',
        speaker: '旁白',
        text: '咖啡机坏了，你急需一杯咖啡提神。',
        choices: [
          {
            text: '自己修理',
            effects: [
              { type: 'damage', value: 3 },
              { type: 'card', value: 'random_it' },
            ],
            resultText: '你捣鼓了一阵，修好了咖啡机，还顺手学了点 IT 技巧。',
          },
          {
            text: '叫维修',
            effects: [{ type: 'gold', value: -20 }],
            resultText: '维修师傅很快修好了，但收了你 20 金币。',
          },
          {
            text: '放弃',
            effects: [{ type: 'debuff', value: DEBUFF_FRAZZLED, stacks: 1 }],
            resultText: '没有咖啡的一天，你心烦意乱。',
          },
        ],
      },
    ],
  },
  // 2. 午餐邀请
  {
    id: 'event_lunch_invitation',
    title: '午餐邀请',
    description: '同事邀请你一起午餐。',
    icon: '🍱',
    weight: 10,
    nodes: [
      {
        id: 'event_lunch_invitation_n1',
        speaker: '旁白',
        text: '同事邀请你一起午餐。',
        choices: [
          {
            text: '接受邀请',
            effects: [{ type: 'heal', value: 8 }],
            resultText: '和同事共进午餐，心情舒畅，回复了 8 点生命。',
          },
          {
            text: '拒绝继续工作',
            effects: [
              { type: 'gold', value: 30 },
              { type: 'damage', value: 2 },
            ],
            resultText: '你继续埋头工作，多赚了 30 金币，但累得失去了 2 点生命。',
          },
        ],
      },
    ],
  },
  // 3. 加班通知
  {
    id: 'event_overtime_notice',
    title: '加班通知',
    description: '领导要求你今晚加班。',
    icon: '🌙',
    weight: 8,
    nodes: [
      {
        id: 'event_overtime_notice_n1',
        speaker: '旁白',
        text: '领导要求你今晚加班。',
        choices: [
          {
            text: '乖乖加班',
            effects: [
              { type: 'gold', value: 50 },
              { type: 'debuff', value: DEBUFF_WEAK, stacks: 2 },
            ],
            resultText: '你加了班，赚了 50 金币，但累得虚弱了。',
          },
          {
            text: '找借口推脱',
            effects: [{ type: 'card', value: 'overtime_excuse' }],
            resultText: '你找了个借口。运气好能蒙混过关获得力量，运气不好则会被训斥受伤。',
          },
          {
            text: '直接拒绝',
            effects: [
              { type: 'damage', value: 10 },
              { type: 'buff', value: BUFF_STRENGTH, stacks: 3 },
            ],
            resultText: '你硬气地拒绝了，虽然挨了批失去 10 点生命，但内心充满了力量。',
          },
        ],
      },
    ],
  },
  // 4. 茶水间八卦
  {
    id: 'event_gossip',
    title: '茶水间八卦',
    description: '茶水间听到一些有趣的八卦。',
    icon: '💬',
    weight: 8,
    nodes: [
      {
        id: 'event_gossip_n1',
        speaker: '旁白',
        text: '茶水间听到一些有趣的八卦。',
        choices: [
          {
            text: '仔细倾听',
            effects: [{ type: 'card', value: 'random' }],
            resultText: '你从八卦中得到了灵感，获得 1 张随机卡牌。',
          },
          {
            text: '传播八卦',
            effects: [
              { type: 'gold', value: 25 },
              { type: 'debuff', value: DEBUFF_VULNERABLE, stacks: 2 },
            ],
            resultText: '你传播八卦赚了 25 金币，但也因此变得容易被人攻击。',
          },
        ],
      },
    ],
  },
  // 5. 培训机会
  {
    id: 'event_training',
    title: '培训机会',
    description: '公司提供了一次培训机会。',
    icon: '📚',
    weight: 7,
    nodes: [
      {
        id: 'event_training_n1',
        speaker: '旁白',
        text: '公司提供了一次培训机会。',
        choices: [
          {
            text: '参加技术培训',
            effects: [{ type: 'upgrade_card', value: 1 }],
            resultText: '你参加了技术培训，升级了 1 张卡牌。',
          },
          {
            text: '参加操作培训',
            effects: [{ type: 'card', value: 'random_operator' }],
            resultText: '你参加了操作培训，获得 1 张随机操作工卡。',
          },
          {
            text: '参加行政培训',
            effects: [{ type: 'card', value: 'random_clerk' }],
            resultText: '你参加了行政培训，获得 1 张随机文员卡。',
          },
        ],
      },
    ],
  },
  // 6. 打印机卡纸
  {
    id: 'event_printer_jam',
    title: '打印机卡纸',
    description: '打印机卡纸了，急需打印重要文件。',
    icon: '🖨️',
    weight: 9,
    nodes: [
      {
        id: 'event_printer_jam_n1',
        speaker: '旁白',
        text: '打印机卡纸了，急需打印重要文件。',
        choices: [
          {
            text: '自己修理',
            effects: [{ type: 'card', value: 'printer_repair' }],
            resultText: '你尝试自己修理。运气好能顺利打印获得奖励，运气不好则会被卡纸划伤。',
          },
          {
            text: '找 IT 部门帮忙',
            effects: [{ type: 'card', value: 'random_it' }],
            resultText: 'IT 同事帮你修好了打印机，你还顺便学了点技巧，获得 1 张随机 IT 卡。',
          },
        ],
      },
    ],
  },
  // 7. 升职传闻
  {
    id: 'event_promotion_rumor',
    title: '升职传闻',
    description: '听说有升职机会，但竞争激烈。',
    icon: '📈',
    weight: 6,
    nodes: [
      {
        id: 'event_promotion_rumor_n1',
        speaker: '旁白',
        text: '听说有升职机会，但竞争激烈。',
        choices: [
          {
            text: '积极争取',
            effects: [
              { type: 'damage', value: 5 },
              { type: 'buff', value: BUFF_STRENGTH, stacks: 3 },
            ],
            resultText: '你积极争取，虽然消耗了 5 点生命，但充满了力量。',
          },
          {
            text: '低调处理',
            effects: [{ type: 'card', value: 'random_rare' }],
            resultText: '你低调处理，反而获得了一张稀有卡牌。',
          },
          {
            text: '拉拢同事',
            effects: [
              { type: 'gold', value: -30 },
              { type: 'card', value: 'random' },
              { type: 'card', value: 'random' },
            ],
            resultText: '你花了 30 金币请同事吃饭，获得了 2 张随机卡牌。',
          },
        ],
      },
    ],
  },
  // 8. 公司年会
  {
    id: 'event_office_party',
    title: '公司年会',
    description: '公司年会，大家都在庆祝。',
    icon: '🎉',
    weight: 7,
    nodes: [
      {
        id: 'event_office_party_n1',
        speaker: '旁白',
        text: '公司年会，大家都在庆祝。',
        choices: [
          {
            text: '尽情享受',
            effects: [
              { type: 'heal', value: 10 },
              { type: 'gold', value: -20 },
            ],
            resultText: '你尽情享受了年会，回复了 10 点生命，但花了 20 金币。',
          },
          {
            text: '借机社交',
            effects: [
              { type: 'card', value: 'random' },
              { type: 'buff', value: BUFF_DEXTERITY, stacks: 2 },
            ],
            resultText: '你借机社交，获得 1 张随机卡牌和 2 层敏捷。',
          },
          {
            text: '默默加班',
            effects: [{ type: 'gold', value: 40 }],
            resultText: '你在年会时默默加班，赚了 40 金币。',
          },
        ],
      },
    ],
  },
];

// ===== 索引与查找函数 =====

// 主线剧情索引（trigger -> StorySequence）
const STORY_INDEX: Map<StorySequence['trigger'], StorySequence> = new Map(
  MAIN_STORY.map((story) => [story.trigger, story]),
);

// 随机事件索引（id -> RandomEvent）
const EVENT_INDEX: Map<string, RandomEvent> = new Map(
  RANDOM_EVENTS.map((event) => [event.id, event]),
);

/**
 * 根据触发点获取主线剧情序列
 * @param trigger 触发点
 * @returns 剧情序列，未找到时返回 undefined
 */
export function getStorySequence(
  trigger: StorySequence['trigger'],
): StorySequence | undefined {
  return STORY_INDEX.get(trigger);
}

/**
 * 按权重随机选取一个随机事件
 * @param rng 随机数生成器（使用其 nextInt 方法）
 * @returns 选中的随机事件
 */
export function getRandomEvent(rng: any): RandomEvent {
  // 计算总权重
  const totalWeight = RANDOM_EVENTS.reduce((sum, event) => sum + event.weight, 0);
  // 生成 [0, totalWeight) 的随机数
  let roll: number = rng.nextInt(0, totalWeight - 1);
  // 按权重区间选取事件
  for (const event of RANDOM_EVENTS) {
    roll -= event.weight;
    if (roll < 0) {
      return event;
    }
  }
  // 兜底：返回最后一个事件（理论上不会执行到此）
  return RANDOM_EVENTS[RANDOM_EVENTS.length - 1];
}

/**
 * 根据事件 id 获取随机事件
 * @param id 事件唯一 id
 * @returns 随机事件，未找到时返回 undefined
 */
export function getRandomEventById(id: string): RandomEvent | undefined {
  return EVENT_INDEX.get(id);
}
