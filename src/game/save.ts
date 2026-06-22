// 存档系统：负责游戏状态的保存与读取
// 将角色、牌组、地图、RNG 状态等序列化到 localStorage，支持自动存档与读档恢复
// JSON 不支持 Map/Set，序列化时需转为普通对象/数组，反序列化时再转回

import { CharacterState } from './character-manager';
import { DeckState } from './deck-manager';
import { MapState } from './map';
import { RNG } from '../core/rng';
import { FloorMap } from '../data/levels';

// localStorage 存储键
const SAVE_KEY = 'office_adventure_save';

// 当前存档版本号（读档时用于版本校验）
const SAVE_VERSION = '1.0.0';

// ===== 序列化后的数据结构（Map -> Object，Set -> Array） =====

// 序列化后的角色状态
interface SerializedCharacterState {
  classId: CharacterState['classId'];
  name: string;
  maxHp: number;
  currentHp: number;
  maxEnergy: number;
  currentEnergy: number;
  gold: number;
  block: number;
  buffs: Record<string, number>;
  debuffs: Record<string, number>;
  upgradePoints: number;
  level: number;
}

// 序列化后的牌组状态
interface SerializedDeckState {
  masterDeck: string[];
  drawPile: string[];
  hand: string[];
  discardPile: string[];
  exhaustPile: string[];
  upgradedCards: string[];
}

// 序列化后的地图状态
interface SerializedMapState {
  floors: FloorMap[];
  currentFloor: number;
  currentMap: FloorMap;
  visitedNodes: string[];
  completedFloors: number[];
}

// 序列化后的完整存档（可直接 JSON.stringify）
interface SerializedSaveData {
  version: string;
  timestamp: number;
  character: SerializedCharacterState;
  deck: SerializedDeckState;
  map: SerializedMapState;
  rngSeed: number;
  rngState: number;
  currentNodeId: string | null;
  inBattle: boolean;
}

// ===== 存档数据接口（运行时使用，含 Map/Set） =====

/**
 * 存档数据接口
 */
export interface SaveData {
  version: string; // 存档版本号（如 '1.0.0'）
  timestamp: number; // 保存时间戳
  character: CharacterState; // 角色状态
  deck: DeckState; // 牌组状态
  map: MapState; // 地图状态
  rngSeed: number; // RNG 种子
  rngState: number; // RNG 当前状态
  currentNodeId: string | null; // 当前节点 id
  inBattle: boolean; // 是否在战斗中（战斗中不存档，或存为非战斗状态）
}

/**
 * 存档管理器
 * 负责存档的保存、读取、删除，以及 Map/Set 与 JSON 的相互转换
 */
export class SaveManager {
  // ===== 序列化辅助 =====

  /**
   * Map 转 Object（JSON 不支持 Map）
   * @param map 键为 string、值为 number 的 Map
   * @returns 普通对象
   */
  serializeMap(map: Map<string, number>): Record<string, number> {
    const obj: Record<string, number> = {};
    for (const [key, value] of map) {
      obj[key] = value;
    }
    return obj;
  }

  /**
   * Object 转 Map
   * @param obj 普通对象
   * @returns Map
   */
  deserializeMap(obj: Record<string, number>): Map<string, number> {
    const map = new Map<string, number>();
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        map.set(key, obj[key]);
      }
    }
    return map;
  }

  /**
   * Set 转 Array（JSON 不支持 Set）
   * @param set 字符串集合
   * @returns 字符串数组
   */
  serializeSet(set: Set<string>): string[] {
    return Array.from(set);
  }

  /**
   * Array 转 Set
   * @param arr 字符串数组
   * @returns Set
   */
  deserializeSet(arr: string[]): Set<string> {
    return new Set<string>(arr);
  }

  // ===== 存档操作 =====

  /**
   * 保存存档到 localStorage
   * 序列化时将 Map 转为 Object、Set 转为 Array
   * @param data 存档数据
   * @returns 是否保存成功（localStorage 不可用时返回 false）
   */
  save(data: SaveData): boolean {
    try {
      const serialized: SerializedSaveData = {
        version: data.version,
        timestamp: data.timestamp,
        character: {
          classId: data.character.classId,
          name: data.character.name,
          maxHp: data.character.maxHp,
          currentHp: data.character.currentHp,
          maxEnergy: data.character.maxEnergy,
          currentEnergy: data.character.currentEnergy,
          gold: data.character.gold,
          block: data.character.block,
          buffs: this.serializeMap(data.character.buffs),
          debuffs: this.serializeMap(data.character.debuffs),
          upgradePoints: data.character.upgradePoints,
          level: data.character.level,
        },
        deck: {
          masterDeck: data.deck.masterDeck,
          drawPile: data.deck.drawPile,
          hand: data.deck.hand,
          discardPile: data.deck.discardPile,
          exhaustPile: data.deck.exhaustPile,
          upgradedCards: this.serializeSet(data.deck.upgradedCards),
        },
        map: {
          floors: data.map.floors,
          currentFloor: data.map.currentFloor,
          currentMap: data.map.currentMap,
          visitedNodes: this.serializeSet(data.map.visitedNodes),
          completedFloors: Array.from(data.map.completedFloors),
        },
        rngSeed: data.rngSeed,
        rngState: data.rngState,
        currentNodeId: data.currentNodeId,
        inBattle: data.inBattle,
      };
      const json = JSON.stringify(serialized);
      localStorage.setItem(SAVE_KEY, json);
      return true;
    } catch (e) {
      console.warn('存档失败：localStorage 不可用或写入异常', e);
      return false;
    }
  }

  /**
   * 从 localStorage 读取存档
   * 反序列化时将 Object 转回 Map、Array 转回 Set
   * 读档时检查版本号，版本不匹配返回 null
   * @returns 存档数据，不存在或版本不匹配时返回 null
   */
  load(): SaveData | null {
    try {
      const json = localStorage.getItem(SAVE_KEY);
      if (json === null) {
        return null;
      }
      const parsed = JSON.parse(json) as SerializedSaveData;

      // 版本号校验
      if (parsed.version !== SAVE_VERSION) {
        console.warn(
          `存档版本不匹配：期望 ${SAVE_VERSION}，实际 ${parsed.version}`,
        );
        return null;
      }

      // 反序列化角色状态（Object -> Map）
      const character: CharacterState = {
        classId: parsed.character.classId,
        name: parsed.character.name,
        maxHp: parsed.character.maxHp,
        currentHp: parsed.character.currentHp,
        maxEnergy: parsed.character.maxEnergy,
        currentEnergy: parsed.character.currentEnergy,
        gold: parsed.character.gold,
        block: parsed.character.block,
        buffs: this.deserializeMap(parsed.character.buffs),
        debuffs: this.deserializeMap(parsed.character.debuffs),
        upgradePoints: parsed.character.upgradePoints,
        level: parsed.character.level,
      };

      // 反序列化牌组状态（Array -> Set）
      const deck: DeckState = {
        masterDeck: parsed.deck.masterDeck,
        drawPile: parsed.deck.drawPile,
        hand: parsed.deck.hand,
        discardPile: parsed.deck.discardPile,
        exhaustPile: parsed.deck.exhaustPile,
        upgradedCards: this.deserializeSet(parsed.deck.upgradedCards),
      };

      // 反序列化地图状态（Array -> Set）
      const map: MapState = {
        floors: parsed.map.floors,
        currentFloor: parsed.map.currentFloor,
        currentMap: parsed.map.currentMap,
        visitedNodes: this.deserializeSet(parsed.map.visitedNodes),
        completedFloors: new Set<number>(parsed.map.completedFloors),
      };

      // 重新建立 currentMap 对 floors 的引用
      // JSON 反序列化后 currentMap 会变成独立副本，需恢复为 floors 中的引用
      const floorIndex = map.currentFloor - 1;
      if (floorIndex >= 0 && floorIndex < map.floors.length) {
        map.currentMap = map.floors[floorIndex];
      }

      return {
        version: parsed.version,
        timestamp: parsed.timestamp,
        character,
        deck,
        map,
        rngSeed: parsed.rngSeed,
        rngState: parsed.rngState,
        currentNodeId: parsed.currentNodeId,
        inBattle: parsed.inBattle,
      };
    } catch (e) {
      console.warn('读档失败：localStorage 不可用或解析异常', e);
      return null;
    }
  }

  /**
   * 是否存在存档
   * @returns 是否存在存档
   */
  hasSave(): boolean {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch (e) {
      console.warn('检查存档失败：localStorage 不可用', e);
      return false;
    }
  }

  /**
   * 删除存档
   */
  deleteSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      console.warn('删除存档失败：localStorage 不可用', e);
    }
  }

  // ===== 自动存档与读档恢复 =====

  /**
   * 自动存档（组合各模块状态并保存）
   * 战斗中存档时存为非战斗状态
   * @param character 角色状态
   * @param deck 牌组状态
   * @param map 地图状态
   * @param rng 随机数生成器
   * @param currentNodeId 当前节点 id
   * @returns 是否存档成功
   */
  autoSave(
    character: CharacterState,
    deck: DeckState,
    map: MapState,
    rng: RNG,
    currentNodeId: string | null,
  ): boolean {
    const data: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      character,
      deck,
      map,
      rngSeed: rng.getSeed(),
      rngState: rng.getState(),
      currentNodeId,
      inBattle: false, // 自动存档统一存为非战斗状态
    };
    return this.save(data);
  }

  /**
   * 读档并恢复所有状态
   * 使用存档的种子重建 RNG 并恢复到存档时的内部状态
   * @returns 恢复后的对象，读档失败返回 null
   */
  loadGame(): {
    character: CharacterState;
    deck: DeckState;
    map: MapState;
    rng: RNG;
    currentNodeId: string | null;
  } | null {
    const data = this.load();
    if (data === null) {
      return null;
    }
    // 用存档的种子创建 RNG，并恢复到存档时的状态
    const rng = new RNG(data.rngSeed);
    rng.setState(data.rngState);
    return {
      character: data.character,
      deck: data.deck,
      map: data.map,
      rng,
      currentNodeId: data.currentNodeId,
    };
  }
}

// 导出单例
export const saveManager = new SaveManager();
