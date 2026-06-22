// 牌组管理器：管理主牌组、抽牌堆、手牌、弃牌堆、消耗堆的状态与流转
// 参考《杀戮尖塔》的牌组机制，支持抽牌、洗牌、出牌、弃牌、消耗、升级等操作

import { Card, getCard, getUpgradedCard } from '../data/cards';
import { CharacterClass, getCharacter } from '../data/characters';
import { RNG } from '../core/rng';

/**
 * 牌组状态接口
 */
export interface DeckState {
  /** 主牌组（所有拥有的卡牌 id，含重复） */
  masterDeck: string[];
  /** 抽牌堆 */
  drawPile: string[];
  /** 手牌 */
  hand: string[];
  /** 弃牌堆 */
  discardPile: string[];
  /** 消耗堆 */
  exhaustPile: string[];
  /** 已升级的卡牌 id 集合（存储基础卡 id） */
  upgradedCards: Set<string>;
}

/**
 * 牌组管理器
 * 负责牌组的初始化、抽牌、出牌、弃牌、消耗、升级等操作
 */
export class DeckManager {
  /** 手牌上限 */
  public static readonly HAND_LIMIT = 10;

  /**
   * 根据职业初始卡组初始化牌组状态
   * @param classId 职业枚举
   * @returns 初始化后的牌组状态（抽牌堆尚未洗牌，需调用 resetForBattle 或 shuffleDrawPile）
   */
  initDeck(classId: CharacterClass): DeckState {
    const character = getCharacter(classId);
    // 复制初始卡组，避免修改原始数据
    const masterDeck = [...character.startingDeck];
    return {
      masterDeck,
      drawPile: [],
      hand: [],
      discardPile: [],
      exhaustPile: [],
      upgradedCards: new Set<string>(),
    };
  }

  /**
   * 洗牌抽牌堆
   * @param state 牌组状态
   * @param rng 随机数生成器
   */
  shuffleDrawPile(state: DeckState, rng: RNG): void {
    state.drawPile = rng.shuffle(state.drawPile);
  }

  /**
   * 抽牌到手牌
   * 抽牌堆空时自动将弃牌堆洗入抽牌堆
   * @param state 牌组状态
   * @param count 抽牌数量
   * @param rng 随机数生成器
   * @returns 实际抽到的卡牌 id 数组（手牌满或牌堆耗尽时可能少于 count）
   */
  drawCards(state: DeckState, count: number, rng: RNG): string[] {
    const drawn: string[] = [];
    for (let i = 0; i < count; i++) {
      // 手牌已满，停止抽牌
      if (state.hand.length >= DeckManager.HAND_LIMIT) {
        break;
      }
      // 抽牌堆为空时，将弃牌堆洗入抽牌堆
      if (state.drawPile.length === 0) {
        if (state.discardPile.length === 0) {
          // 弃牌堆也无牌，无法继续抽
          break;
        }
        state.drawPile = rng.shuffle(state.discardPile);
        state.discardPile = [];
      }
      // 从抽牌堆顶部抽一张到手牌
      const cardId = state.drawPile.pop() as string;
      state.hand.push(cardId);
      drawn.push(cardId);
    }
    return drawn;
  }

  /**
   * 从抽牌堆中指定抽一张到手牌
   * @param state 牌组状态
   * @param cardId 要抽的卡牌 id
   * @returns 是否成功抽到手牌（手牌已满或抽牌堆中无此牌时返回 false）
   */
  drawToHand(state: DeckState, cardId: string): boolean {
    // 手牌已满
    if (state.hand.length >= DeckManager.HAND_LIMIT) {
      return false;
    }
    const index = state.drawPile.indexOf(cardId);
    if (index === -1) {
      return false;
    }
    // 从抽牌堆移除并加入手牌
    state.drawPile.splice(index, 1);
    state.hand.push(cardId);
    return true;
  }

  /**
   * 出牌（从手牌移除）
   * 注意：此方法仅从手牌移除卡牌，不自动进入弃牌堆或消耗堆，
   * 调用方需根据卡牌效果自行调用 discardCard 或 exhaustCard
   * @param state 牌组状态
   * @param handIndex 手牌索引
   * @returns 出牌的卡牌 id，索引无效时返回 null
   */
  playCard(state: DeckState, handIndex: number): string | null {
    if (handIndex < 0 || handIndex >= state.hand.length) {
      return null;
    }
    const cardId = state.hand.splice(handIndex, 1)[0];
    return cardId;
  }

  /**
   * 弃掉所有手牌（移动到弃牌堆）
   * @param state 牌组状态
   */
  discardHand(state: DeckState): void {
    state.discardPile.push(...state.hand);
    state.hand = [];
  }

  /**
   * 弃指定卡（加入弃牌堆）
   * @param state 牌组状态
   * @param cardId 卡牌 id
   */
  discardCard(state: DeckState, cardId: string): void {
    state.discardPile.push(cardId);
  }

  /**
   * 消耗指定卡（加入消耗堆）
   * @param state 牌组状态
   * @param cardId 卡牌 id
   */
  exhaustCard(state: DeckState, cardId: string): void {
    state.exhaustPile.push(cardId);
  }

  /**
   * 添加卡牌到主牌组
   * @param state 牌组状态
   * @param cardId 卡牌 id
   */
  addCard(state: DeckState, cardId: string): void {
    state.masterDeck.push(cardId);
  }

  /**
   * 从主牌组移除一张卡牌
   * @param state 牌组状态
   * @param cardId 卡牌 id
   * @returns 是否移除成功（主牌组中无此卡时返回 false）
   */
  removeCard(state: DeckState, cardId: string): boolean {
    const index = state.masterDeck.indexOf(cardId);
    if (index === -1) {
      return false;
    }
    state.masterDeck.splice(index, 1);
    return true;
  }

  /**
   * 升级卡牌
   * 标记为已升级，并将主牌组中的基础卡 id 替换为升级版 id（如 'strike' -> 'strike+'）
   * @param state 牌组状态
   * @param cardId 基础卡牌 id
   * @returns 是否升级成功（已升级、无升级版、主牌组中无此卡时返回 false）
   */
  upgradeCard(state: DeckState, cardId: string): boolean {
    // 已升级则不再升级
    if (state.upgradedCards.has(cardId)) {
      return false;
    }
    const upgradedCard = getUpgradedCard(cardId);
    if (!upgradedCard) {
      return false;
    }
    // 在主牌组中查找并替换为升级版 id
    const index = state.masterDeck.indexOf(cardId);
    if (index === -1) {
      return false;
    }
    state.masterDeck[index] = upgradedCard.id;
    state.upgradedCards.add(cardId);
    return true;
  }

  /**
   * 获取手牌的 Card 数据
   * @param state 牌组状态
   * @returns 手牌对应的 Card 数据数组（跳过未找到的卡牌）
   */
  getHand(state: DeckState): Card[] {
    const cards: Card[] = [];
    for (const id of state.hand) {
      const card = getCard(id);
      if (card) {
        cards.push(card);
      }
    }
    return cards;
  }

  /**
   * 获取抽牌堆数量
   */
  getDrawPileCount(state: DeckState): number {
    return state.drawPile.length;
  }

  /**
   * 获取弃牌堆数量
   */
  getDiscardPileCount(state: DeckState): number {
    return state.discardPile.length;
  }

  /**
   * 获取主牌组大小
   */
  getMasterDeckSize(state: DeckState): number {
    return state.masterDeck.length;
  }

  /**
   * 判断卡牌是否已升级
   * @param state 牌组状态
   * @param cardId 卡牌 id（基础 id 或升级版 id 均可）
   * @returns 是否已升级
   */
  isUpgraded(state: DeckState, cardId: string): boolean {
    // 直接匹配基础 id
    if (state.upgradedCards.has(cardId)) {
      return true;
    }
    // 若传入的是升级版 id（以 '+' 结尾），检查其基础 id
    if (cardId.endsWith('+')) {
      const baseId = cardId.slice(0, -1);
      return state.upgradedCards.has(baseId);
    }
    return false;
  }

  /**
   * 战斗开始时重置牌组
   * 清空手牌、弃牌堆、消耗堆，将主牌组复制到抽牌堆并洗牌
   * @param state 牌组状态
   * @param rng 随机数生成器
   */
  resetForBattle(state: DeckState, rng: RNG): void {
    state.hand = [];
    state.discardPile = [];
    state.exhaustPile = [];
    // 复制主牌组到抽牌堆并洗牌（不修改主牌组本身）
    state.drawPile = rng.shuffle(state.masterDeck);
  }
}

/** 牌组管理器单例 */
export const deckManager = new DeckManager();
