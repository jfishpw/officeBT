// 关卡数据定义：4 层地图，每层含 12-15 个节点 + 1 个 Boss 节点
// 节点按行排列，从底部起点到顶部 Boss，节点间通过 connections 连接

// ===== 类型定义 =====

// 房间类型
export enum RoomType {
  Battle = 'battle', // 普通战斗
  Elite = 'elite', // 精英战斗
  Rest = 'rest', // 休息
  Shop = 'shop', // 商店
  Event = 'event', // 随机事件
  Treasure = 'treasure', // 宝藏
  Boss = 'boss', // Boss 战
}

// 房间节点
export interface RoomNode {
  id: string; // 节点 id（如 "1-3-a"）
  floor: number; // 层数（1-4）
  row: number; // 行号（从 0 开始，从下往上）
  col: number; // 列号
  type: RoomType;
  connections: string[]; // 可前往的下一节点 id 列表
  visited: boolean; // 是否已访问
  isStart: boolean; // 是否为起点
  isBoss: boolean; // 是否为 Boss 房
}

// 一层地图
export interface FloorMap {
  floor: number;
  nodes: RoomNode[]; // 所有节点
  startNodeIds: string[]; // 起点节点 id
  bossNodeId: string; // Boss 节点 id
  currentNodeId: string | null; // 当前所在节点 id
}

// 难度曲线参数
export interface DifficultyParams {
  floor: number;
  enemyHpMultiplier: number;
  enemyAttackMultiplier: number;
  eliteChance: number; // 精英敌人出现概率
  shopPriceMultiplier: number;
  restHealPercent: number; // 休息回血百分比
}

// ===== 常量 =====

// 难度曲线参数表（4 层逐级递增）
export const DIFFICULTY_CURVE: DifficultyParams[] = [
  { floor: 1, enemyHpMultiplier: 1.0, enemyAttackMultiplier: 1.0, eliteChance: 0.05, shopPriceMultiplier: 1.0, restHealPercent: 0.3 },
  { floor: 2, enemyHpMultiplier: 1.2, enemyAttackMultiplier: 1.15, eliteChance: 0.10, shopPriceMultiplier: 1.1, restHealPercent: 0.3 },
  { floor: 3, enemyHpMultiplier: 1.4, enemyAttackMultiplier: 1.3, eliteChance: 0.15, shopPriceMultiplier: 1.2, restHealPercent: 0.3 },
  { floor: 4, enemyHpMultiplier: 1.6, enemyAttackMultiplier: 1.45, eliteChance: 0.20, shopPriceMultiplier: 1.3, restHealPercent: 0.3 },
];

// 房间类型中文名
export const ROOM_TYPE_NAMES: Record<RoomType, string> = {
  [RoomType.Battle]: '战斗',
  [RoomType.Elite]: '精英战',
  [RoomType.Rest]: '休息',
  [RoomType.Shop]: '商店',
  [RoomType.Event]: '事件',
  [RoomType.Treasure]: '宝藏',
  [RoomType.Boss]: 'Boss',
};

// 房间类型图标（emoji 占位）
export const ROOM_TYPE_ICONS: Record<RoomType, string> = {
  [RoomType.Battle]: '⚔️',
  [RoomType.Elite]: '💀',
  [RoomType.Rest]: '🏕️',
  [RoomType.Shop]: '🛒',
  [RoomType.Event]: '❓',
  [RoomType.Treasure]: '💰',
  [RoomType.Boss]: '👑',
};

// ===== 内部常量 =====

// 总楼层数
const TOTAL_FLOORS = 4;

// 非 Boss 节点数量范围
const MIN_NODES = 12;
const MAX_NODES = 15;

// 非 Boss 行数：起点行 + 3 中间行 + 1 Boss 前行 = 5 行
const NON_BOSS_ROW_COUNT = 5;

// 每行节点数量范围
const MIN_ROW_NODES = 2;
const MAX_ROW_NODES = 4;

// 房间类型概率分布（用于中间行节点）
const ROOM_TYPE_WEIGHTS: ReadonlyArray<{ type: RoomType; weight: number }> = [
  { type: RoomType.Battle, weight: 0.5 },
  { type: RoomType.Event, weight: 0.15 },
  { type: RoomType.Elite, weight: 0.1 },
  { type: RoomType.Rest, weight: 0.1 },
  { type: RoomType.Shop, weight: 0.08 },
  { type: RoomType.Treasure, weight: 0.07 },
];

// Boss 上一层允许的房间类型（排除 Rest/Shop，保证 Boss 前有挑战）
const PRE_BOSS_TYPE_WEIGHTS: ReadonlyArray<{ type: RoomType; weight: number }> = [
  { type: RoomType.Battle, weight: 0.5 },
  { type: RoomType.Elite, weight: 0.25 },
  { type: RoomType.Event, weight: 0.15 },
  { type: RoomType.Treasure, weight: 0.1 },
];

// 起点节点类型概率（偏向 Battle，且只能是 Battle 或 Event）
const START_TYPE_WEIGHTS: ReadonlyArray<{ type: RoomType; weight: number }> = [
  { type: RoomType.Battle, weight: 0.7 },
  { type: RoomType.Event, weight: 0.3 },
];

// ===== 内部辅助函数 =====

/**
 * 根据权重表构建类型池（每池 100 个元素，供 pick 方法按概率选取）
 * @param weights 类型与权重的列表
 * @returns 展开后的类型池
 */
function buildTypePool(
  weights: ReadonlyArray<{ type: RoomType; weight: number }>,
): RoomType[] {
  const pool: RoomType[] = [];
  for (const entry of weights) {
    const count = Math.round(entry.weight * 100);
    for (let i = 0; i < count; i++) {
      pool.push(entry.type);
    }
  }
  return pool;
}

// 预构建加权类型池（模块级常量，避免重复构建）
const ROOM_TYPE_POOL: readonly RoomType[] = buildTypePool(ROOM_TYPE_WEIGHTS);
const PRE_BOSS_TYPE_POOL: readonly RoomType[] = buildTypePool(PRE_BOSS_TYPE_WEIGHTS);
const START_TYPE_POOL: readonly RoomType[] = buildTypePool(START_TYPE_WEIGHTS);

/**
 * 生成节点 id
 * @param floor 楼层
 * @param row 行号
 * @param index 行内序号
 * @returns 节点 id（如 "1-3-a"）
 */
function makeNodeId(floor: number, row: number, index: number): string {
  const letter = String.fromCharCode(97 + index); // a, b, c, d...
  return `${floor}-${row}-${letter}`;
}

/**
 * 在两行之间建立连接
 * 保证下一行每个节点至少有一条入边，当前行每个节点 1-2 条出边
 * @param rng 随机数生成器（使用其 pick、chance 方法）
 * @param currentRow 当前行节点列表（父节点）
 * @param nextRow 下一行节点列表（子节点）
 */
function connectRows(
  rng: any,
  currentRow: RoomNode[],
  nextRow: RoomNode[],
): void {
  if (nextRow.length === 0 || currentRow.length === 0) {
    return;
  }

  // 出边计数（当前行每个节点的出边数）
  const outCount = new Map<string, number>();
  for (const node of currentRow) {
    outCount.set(node.id, 0);
  }

  // 第一步：保证下一行每个节点至少有一个父节点
  // 采用"最小出边优先 + 列号就近"策略，均衡分配父节点并减少连线交叉
  for (const child of nextRow) {
    let minCount = Infinity;
    for (const parent of currentRow) {
      const c = outCount.get(parent.id) ?? 0;
      if (c < minCount) {
        minCount = c;
      }
    }
    // 在出边最少的父节点中，按列号差距排序，优先选择相邻列
    const candidates = currentRow
      .filter((p) => (outCount.get(p.id) ?? 0) === minCount)
      .sort((a, b) => Math.abs(a.col - child.col) - Math.abs(b.col - child.col));
    // 在最近的 1-2 个候选中随机选一个，保持少量随机性
    const topCount = Math.min(2, candidates.length);
    const parent: RoomNode = rng.pick(candidates.slice(0, topCount));
    if (!parent.connections.includes(child.id)) {
      parent.connections.push(child.id);
      outCount.set(parent.id, (outCount.get(parent.id) ?? 0) + 1);
    }
  }

  // 第二步：出边为 0 的节点，连接到下一行中列号最近的节点
  for (const node of currentRow) {
    if ((outCount.get(node.id) ?? 0) === 0) {
      // 按列号差距排序，优先连接相邻列
      const sorted = [...nextRow].sort(
        (a, b) => Math.abs(a.col - node.col) - Math.abs(b.col - node.col),
      );
      const topCount = Math.min(2, sorted.length);
      const target: RoomNode = rng.pick(sorted.slice(0, topCount));
      if (!node.connections.includes(target.id)) {
        node.connections.push(target.id);
        outCount.set(node.id, 1);
      }
    }
  }

  // 第三步：出边为 1 的节点，有 30% 概率添加第二条出边
  // 优先连接列号最接近的节点，减少连线交叉
  for (const node of currentRow) {
    if ((outCount.get(node.id) ?? 0) === 1 && rng.chance(0.3)) {
      const candidates = nextRow.filter(
        (n) => !node.connections.includes(n.id),
      );
      if (candidates.length > 0) {
        // 按列号差距排序，优先连接相邻列的节点
        candidates.sort((a, b) => Math.abs(a.col - node.col) - Math.abs(b.col - node.col));
        // 在最近的 1-2 个候选中随机选一个，保持少量随机性
        const topCount = Math.min(2, candidates.length);
        const target: RoomNode = rng.pick(candidates.slice(0, topCount));
        node.connections.push(target.id);
        outCount.set(node.id, 2);
      }
    }
  }
}

// ===== 地图生成 =====

/**
 * 生成一层地图
 * @param floor 楼层（1-4）
 * @param rng 随机数生成器（使用其 pick、nextInt、chance 方法）
 * @returns 生成的楼层地图
 */
export function generateFloorMap(floor: number, rng: any): FloorMap {
  // 目标非 Boss 节点总数
  const targetTotal = rng.nextInt(MIN_NODES, MAX_NODES);

  // 各行节点数量：起点行 + 3 中间行 + 1 Boss 前行 = 5 行
  const rowCounts: number[] = [];

  // 起点行：2-3 个节点
  rowCounts.push(rng.nextInt(MIN_ROW_NODES, 3));

  // 剩余节点分配到 3 中间行 + 1 Boss 前行（共 4 行）
  const middleRowCount = NON_BOSS_ROW_COUNT - 1; // 4
  const remaining = targetTotal - rowCounts[0];

  // 每行先分配最小值 2
  let assigned = 0;
  for (let i = 0; i < middleRowCount; i++) {
    rowCounts.push(MIN_ROW_NODES);
    assigned += MIN_ROW_NODES;
  }

  // 将剩余 extra 随机分配到各行（每行最多到 MAX_ROW_NODES）
  let extra = remaining - assigned;
  let guard = 0;
  while (extra > 0 && guard < 100) {
    const idx = rng.nextInt(1, middleRowCount); // 跳过起点行（索引 0）
    if (rowCounts[idx] < MAX_ROW_NODES) {
      rowCounts[idx]++;
      extra--;
    }
    guard++;
  }

  // 生成各行节点
  const rows: RoomNode[][] = [];
  for (let row = 0; row < rowCounts.length; row++) {
    const count = rowCounts[row];
    const rowNodes: RoomNode[] = [];
    for (let col = 0; col < count; col++) {
      let type: RoomType;
      if (row === 0) {
        // 起点行：Battle 或 Event（偏向 Battle）
        type = rng.pick(START_TYPE_POOL);
      } else if (row === rowCounts.length - 1) {
        // Boss 前一行：不能是 Rest/Shop
        type = rng.pick(PRE_BOSS_TYPE_POOL);
      } else {
        // 中间行：按概率分布
        type = rng.pick(ROOM_TYPE_POOL);
      }
      rowNodes.push({
        id: makeNodeId(floor, row, col),
        floor,
        row,
        col,
        type,
        connections: [],
        visited: false,
        isStart: row === 0,
        isBoss: false,
      });
    }
    rows.push(rowNodes);
  }

  // 生成 Boss 节点（单独一行）
  const bossRow = rowCounts.length;
  const bossNode: RoomNode = {
    id: makeNodeId(floor, bossRow, 0),
    floor,
    row: bossRow,
    col: 0,
    type: RoomType.Boss,
    connections: [],
    visited: false,
    isStart: false,
    isBoss: true,
  };

  // 建立行间连接
  for (let row = 0; row < rows.length - 1; row++) {
    connectRows(rng, rows[row], rows[row + 1]);
  }
  // Boss 前一行连接到 Boss
  connectRows(rng, rows[rows.length - 1], [bossNode]);

  // 收集所有节点
  const allNodes: RoomNode[] = [];
  for (const row of rows) {
    allNodes.push(...row);
  }
  allNodes.push(bossNode);

  const startNodeIds = rows[0].map((n) => n.id);

  return {
    floor,
    nodes: allNodes,
    startNodeIds,
    bossNodeId: bossNode.id,
    currentNodeId: null,
  };
}

/**
 * 生成全部 4 层地图
 * @param rng 随机数生成器
 * @returns 4 层地图数组
 */
export function generateAllFloors(rng: any): FloorMap[] {
  const floors: FloorMap[] = [];
  for (let floor = 1; floor <= TOTAL_FLOORS; floor++) {
    floors.push(generateFloorMap(floor, rng));
  }
  return floors;
}

// ===== 查询函数 =====

/**
 * 获取指定楼层的难度参数
 * @param floor 楼层（1-4）
 * @returns 难度参数，未找到时返回第 1 层参数作为兜底
 */
export function getDifficulty(floor: number): DifficultyParams {
  return DIFFICULTY_CURVE.find((d) => d.floor === floor) ?? DIFFICULTY_CURVE[0];
}

/**
 * 根据节点 id 获取房间节点
 * @param map 楼层地图
 * @param nodeId 节点 id
 * @returns 节点，未找到时返回 undefined
 */
export function getRoomNode(
  map: FloorMap,
  nodeId: string,
): RoomNode | undefined {
  return map.nodes.find((n) => n.id === nodeId);
}

/**
 * 获取当前节点可前往的下一节点列表
 * @param map 楼层地图
 * @param currentNodeId 当前节点 id
 * @returns 下一节点数组（已按 connections 顺序解析）
 */
export function getNextNodes(
  map: FloorMap,
  currentNodeId: string,
): RoomNode[] {
  const current = getRoomNode(map, currentNodeId);
  if (!current) {
    return [];
  }
  const result: RoomNode[] = [];
  for (const id of current.connections) {
    const node = getRoomNode(map, id);
    if (node) {
      result.push(node);
    }
  }
  return result;
}
