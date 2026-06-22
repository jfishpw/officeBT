// 地图管理器：管理关卡与房间逻辑
// 负责地图状态管理、节点导航、楼层推进、房间内容生成

import { RNG } from '../core/rng';
import {
  FloorMap,
  RoomNode,
  RoomType,
  generateAllFloors,
  getRoomNode,
  getNextNodes,
} from '../data/levels';
import {
  EnemyData,
  getBossByFloor,
  getRandomNormalEnemies,
} from '../data/enemies';

// ===== 类型定义 =====

// 地图状态
export interface MapState {
  floors: FloorMap[]; // 4 层地图
  currentFloor: number; // 当前楼层（1-4）
  currentMap: FloorMap; // 当前楼层地图（floors[currentFloor-1] 的引用）
  visitedNodes: Set<string>; // 已访问节点 id 集合
  completedFloors: Set<number>; // 已完成楼层集合
}

// Boss 剧情触发点类型
type BossStoryTrigger = 'boss_1' | 'boss_2' | 'boss_3' | 'boss_4';

// ===== 常量 =====

// 总楼层数
const TOTAL_FLOORS = 4;

// ===== 地图管理器 =====

/**
 * 地图管理器
 * 负责地图状态管理、节点导航、楼层推进和房间内容生成
 */
export class MapManager {
  // ===== 初始化 =====

  /**
   * 初始化全部 4 层地图
   * @param rng 随机数生成器
   * @returns 初始地图状态（currentFloor=1，无已访问节点）
   */
  initMaps(rng: RNG): MapState {
    const floors = generateAllFloors(rng);
    return {
      floors,
      currentFloor: 1,
      currentMap: floors[0],
      visitedNodes: new Set<string>(),
      completedFloors: new Set<number>(),
    };
  }

  /**
   * 获取当前楼层
   */
  getCurrentFloor(state: MapState): number {
    return state.currentFloor;
  }

  /**
   * 获取当前楼层地图
   */
  getCurrentMap(state: MapState): FloorMap {
    return state.currentMap;
  }

  // ===== 节点导航 =====

  /**
   * 获取当前可前往的节点
   * - 若当前未选择任何节点（currentNodeId 为 null），返回起点节点
   * - 否则返回当前节点的下一节点列表
   * @param state 地图状态
   * @returns 可前往的节点数组
   */
  getAvailableNodes(state: MapState): RoomNode[] {
    const map = state.currentMap;
    if (map.currentNodeId === null) {
      // 起始状态：返回所有起点节点
      return map.startNodeIds
        .map((id) => getRoomNode(map, id))
        .filter((n): n is RoomNode => n !== undefined);
    }
    // 已选择节点：返回当前节点的下一节点
    return getNextNodes(map, map.currentNodeId);
  }

  /**
   * 判断节点是否可选
   * @param state 地图状态
   * @param nodeId 节点 id
   */
  isNodeAvailable(state: MapState, nodeId: string): boolean {
    const available = this.getAvailableNodes(state);
    return available.some((n) => n.id === nodeId);
  }

  /**
   * 选择节点前进
   * 标记节点为 visited，更新 currentNodeId
   * @param state 地图状态
   * @param nodeId 目标节点 id
   * @returns 选中的节点，若不可选返回 null
   */
  selectNode(state: MapState, nodeId: string): RoomNode | null {
    if (!this.isNodeAvailable(state, nodeId)) {
      return null;
    }
    const map = state.currentMap;
    const node = getRoomNode(map, nodeId);
    if (!node) {
      return null;
    }
    node.visited = true;
    state.visitedNodes.add(nodeId);
    map.currentNodeId = nodeId;
    return node;
  }

  /**
   * 获取当前所在节点
   * @param state 地图状态
   * @returns 当前节点，若未选择任何节点返回 null
   */
  getCurrentNode(state: MapState): RoomNode | null {
    const map = state.currentMap;
    if (map.currentNodeId === null) {
      return null;
    }
    return getRoomNode(map, map.currentNodeId) ?? null;
  }

  // ===== 房间类型判断 =====

  /** 获取房间类型 */
  getRoomType(node: RoomNode): RoomType {
    return node.type;
  }

  /** 是否 Boss 房 */
  isBossRoom(node: RoomNode): boolean {
    return node.type === RoomType.Boss;
  }

  /** 是否休息房 */
  isRestRoom(node: RoomNode): boolean {
    return node.type === RoomType.Rest;
  }

  /** 是否商店房 */
  isShopRoom(node: RoomNode): boolean {
    return node.type === RoomType.Shop;
  }

  /** 是否事件房 */
  isEventRoom(node: RoomNode): boolean {
    return node.type === RoomType.Event;
  }

  /** 是否宝藏房 */
  isTreasureRoom(node: RoomNode): boolean {
    return node.type === RoomType.Treasure;
  }

  /** 是否战斗房（含普通和精英） */
  isBattleRoom(node: RoomNode): boolean {
    return node.type === RoomType.Battle || node.type === RoomType.Elite;
  }

  // ===== 楼层推进 =====

  /**
   * 进入下一层
   * 需当前层 Boss 已击败，且非最后一层
   * @param state 地图状态
   * @returns 成功进入返回 true，已是最后一层或 Boss 未击败返回 false
   */
  goToNextFloor(state: MapState): boolean {
    // 已是最后一层，无法继续
    if (state.currentFloor >= TOTAL_FLOORS) {
      return false;
    }
    // 当前层 Boss 未击败，不能进入下一层
    if (!this.isCurrentFloorCompleted(state)) {
      return false;
    }
    state.currentFloor++;
    state.currentMap = state.floors[state.currentFloor - 1];
    return true;
  }

  /**
   * 当前楼层是否完成（Boss 已击败）
   */
  isCurrentFloorCompleted(state: MapState): boolean {
    return state.completedFloors.has(state.currentFloor);
  }

  /**
   * 游戏是否通关（4 层全完成）
   */
  isGameCompleted(state: MapState): boolean {
    return state.completedFloors.size >= TOTAL_FLOORS;
  }

  /**
   * 标记当前层 Boss 已击败
   */
  markBossDefeated(state: MapState): void {
    state.completedFloors.add(state.currentFloor);
  }

  // ===== 房间内容生成 =====

  /**
   * 根据房间类型和楼层获取敌人
   * - 普通战斗：1-3 个普通敌人
   * - 精英战斗：1 个强化敌人
   * - Boss 战：对应层 Boss
   * - 其他房间：空数组
   * @param node 房间节点
   * @param floor 楼层
   * @param rng 随机数生成器
   */
  getRoomEnemies(node: RoomNode, floor: number, rng: RNG): EnemyData[] {
    switch (node.type) {
      case RoomType.Battle:
        // 普通战斗：1-2 个普通敌人
        return getRandomNormalEnemies(floor, rng.nextInt(1, 2), rng);
      case RoomType.Elite:
        // 精英战斗：1 个强化敌人
        return getRandomNormalEnemies(floor, 1, rng);
      case RoomType.Boss: {
        // Boss 战：对应层 Boss
        const boss = getBossByFloor(floor);
        return boss ? [boss] : [];
      }
      default:
        // 非战斗房间无敌人
        return [];
    }
  }

  /**
   * 获取房间触发的剧情
   * 仅 Boss 房触发对应楼层剧情
   * @param node 房间节点
   * @returns 剧情触发点，非 Boss 房返回 null
   */
  getRoomStoryTrigger(node: RoomNode): BossStoryTrigger | null {
    if (!this.isBossRoom(node)) {
      return null;
    }
    switch (node.floor) {
      case 1:
        return 'boss_1';
      case 2:
        return 'boss_2';
      case 3:
        return 'boss_3';
      case 4:
        return 'boss_4';
      default:
        return null;
    }
  }
}

// 导出单例
export const mapManager = new MapManager();
