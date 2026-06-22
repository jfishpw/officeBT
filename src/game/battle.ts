// 战斗系统：管理战斗流程、敌人 AI、出牌、回合、胜负判定
// 参考《杀戮尖塔》的战斗机制，支持多敌人、Boss 特殊技能、卡牌特殊效果

import { CharacterState, characterManager } from './character-manager';
import { DeckState, deckManager } from './deck-manager';
import { Card, CardType, CardRarity, getCard, BUFFS, DEBUFFS, ALL_CARDS } from '../data/cards';
import { EnemyData, EnemyAI, EnemyIntent, IntentType, getEnemy } from '../data/enemies';
import { RNG } from '../core/rng';
import { getCharacter } from '../data/characters';

// ===== 接口定义 =====

// 敌人运行时状态
export interface EnemyState {
  id: string; // 敌人实例 id（唯一）
  dataId: string; // 敌人数据 id
  name: string;
  maxHp: number;
  currentHp: number;
  block: number;
  attack: number; // 基础攻击力
  buffs: Map<string, number>;
  debuffs: Map<string, number>;
  ai: EnemyAI; // AI 数据
  moveIndex: number; // 当前意图序列索引
  turnCount: number; // 回合计数
  currentIntent: EnemyIntent | null; // 当前意图
  isBoss: boolean;
}

// 战斗状态
export interface BattleState {
  player: CharacterState; // 玩家状态引用
  deck: DeckState; // 牌组状态引用
  enemies: EnemyState[]; // 敌人列表
  turn: number; // 回合数（从 1 开始）
  phase: 'player_turn' | 'enemy_turn' | 'victory' | 'defeat'; // 战斗阶段
  rng: RNG; // 战斗用随机数
  rewards: { gold: number; cards: number }; // 战斗奖励
  // 临时效果标记（本回合内有效）
  costReductionThisTurn?: number; // 本回合费用减少量
  costReductionTurnsLeft?: number; // 费用减少剩余回合数
  doubleAttackDamageThisTurn?: boolean; // 本回合攻击伤害翻倍
  halveDamageThisTurn?: boolean; // 本回合受到伤害减半（操作工）
  blockGainedThisTurn?: number; // 本回合获得的护甲总量（操作工）
}

// ===== 常量 =====

// 自定义 power buff 名称（每回合获得对应资源）
const POWER_BLOCK = 'power_block_1'; // 每回合获得 1 护甲
const POWER_CR = 'power_cr_1'; // 每回合获得 1 客户资源
const POWER_OW = 'power_ow_1'; // 每回合获得 1 加班

// 敌人特殊 buff 名称
const ENRAGE = 'enrage'; // 暴怒：攻击力 +50%
const DOUBLE_ATTACK = 'double_attack'; // 双攻：每回合攻击两次

// 敌人实例 id 计数器
let enemyInstanceIdCounter = 0;

// ===== 战斗管理器类 =====

export class BattleManager {
  // ===== 战斗初始化 =====

  /**
   * 初始化战斗
   * 为每个敌人创建 EnemyState（HP 取范围随机），计算敌人初始意图，
   * 重置牌组，玩家 startTurn，抽 5 张牌
   * @param player 玩家状态
   * @param deck 牌组状态
   * @param enemyDataList 敌人数据列表
   * @param rng 随机数生成器
   * @returns 初始化后的战斗状态
   */
  initBattle(
    player: CharacterState,
    deck: DeckState,
    enemyDataList: EnemyData[],
    rng: RNG,
  ): BattleState {
    // 重置敌人实例 id 计数器
    enemyInstanceIdCounter = 0;

    // 为每个敌人创建运行时状态
    const enemies: EnemyState[] = enemyDataList.map((data) =>
      this.createEnemyState(data, rng),
    );

    // 计算每个敌人的初始意图
    for (const enemy of enemies) {
      enemy.currentIntent = this.calculateEnemyIntent(enemy, rng);
    }

    // 重置牌组
    deckManager.resetForBattle(deck, rng);

    // 玩家回合开始
    characterManager.startTurn(player);

    // 抽 5 张牌
    deckManager.drawCards(deck, 5, rng);

    return {
      player,
      deck,
      enemies,
      turn: 1,
      phase: 'player_turn',
      rng,
      rewards: { gold: 0, cards: 0 },
    };
  }

  /**
   * 创建敌人运行时状态
   * HP 取 stats.maxHp 范围内的随机值
   * @param data 敌人数据
   * @param rng 随机数生成器
   * @returns 初始化后的敌人状态
   */
  private createEnemyState(data: EnemyData, rng: RNG): EnemyState {
    const maxHp = rng.nextInt(data.stats.maxHp[0], data.stats.maxHp[1]);
    return {
      id: `enemy_${enemyInstanceIdCounter++}`,
      dataId: data.id,
      name: data.name,
      maxHp,
      currentHp: maxHp,
      block: 0,
      attack: data.stats.attack,
      buffs: new Map<string, number>(),
      debuffs: new Map<string, number>(),
      ai: data.ai,
      moveIndex: 0,
      turnCount: 0,
      currentIntent: null,
      isBoss: data.isBoss ?? false,
    };
  }

  // ===== 敌人意图 =====

  /**
   * 计算敌人下回合意图
   * 按 moves 序列循环，处理 everyNTurns 和 hpThreshold 特殊技能
   * @param enemy 敌人状态
   * @param rng 随机数生成器
   * @returns 敌人意图
   */
  calculateEnemyIntent(enemy: EnemyState, _rng: RNG): EnemyIntent {
    const ai = enemy.ai;
    const nextTurn = enemy.turnCount + 1;

    // 1. 检查 hpThreshold（HP 低于百分比触发特殊技能，且仅触发一次）
    if (
      ai.conditions?.hpThreshold !== undefined &&
      ai.conditions.specialMoves &&
      ai.conditions.specialMoves.length > 0
    ) {
      const hpRatio = enemy.currentHp / enemy.maxHp;
      if (hpRatio <= ai.conditions.hpThreshold) {
        // 检查是否已触发（特殊 buff 是否已存在）
        const specialBuff = ai.conditions.specialMoves[0].buff?.name;
        if (!specialBuff || !this.hasEnemyBuff(enemy, specialBuff)) {
          return ai.conditions.specialMoves[0];
        }
      }
    }

    // 2. 检查 everyNTurns（每 N 回合触发特殊技能）
    if (ai.conditions?.everyNTurns) {
      const n = ai.conditions.everyNTurns.n;
      if (nextTurn % n === 0) {
        return ai.conditions.everyNTurns.move;
      }
    }

    // 3. 按 moves 序列循环
    const moves = ai.moves;
    if (moves.length === 0) {
      return { type: IntentType.Unknown, description: '无行动' };
    }
    return moves[enemy.moveIndex % moves.length];
  }

  /**
   * 获取所有敌人当前意图
   * @param state 战斗状态
   * @returns 敌人意图数组（死亡敌人返回 null）
   */
  getEnemyIntents(state: BattleState): (EnemyIntent | null)[] {
    return state.enemies.map((enemy) =>
      enemy.currentHp > 0 ? enemy.currentIntent : null,
    );
  }

  // ===== 出牌 =====

  /**
   * 是否可以出牌（能量足够、非缠绕状态出攻击牌）
   * @param state 战斗状态
   * @param handIndex 手牌索引
   * @returns 是否可以出牌
   */
  canPlayCard(state: BattleState, handIndex: number): boolean {
    // 非玩家回合不能出牌
    if (state.phase !== 'player_turn') {
      return false;
    }
    if (handIndex < 0 || handIndex >= state.deck.hand.length) {
      return false;
    }
    const card = getCard(state.deck.hand[handIndex]);
    if (!card) {
      return false;
    }
    // 检查能量
    const effectiveCost = this.getEffectiveCost(state, card);
    if (state.player.currentEnergy < effectiveCost) {
      return false;
    }
    // 攻击牌受缠绕限制
    if (
      card.type === CardType.Attack &&
      characterManager.hasDebuff(state.player, DEBUFFS.ENTANGLED)
    ) {
      return false;
    }
    return true;
  }

  /**
   * 出牌：检查能量、检查缠绕、消耗能量、执行效果、弃牌/消耗
   * @param state 战斗状态
   * @param handIndex 手牌索引
   * @param targetEnemyIndex 目标敌人索引
   * @returns 是否出牌成功
   */
  playCard(
    state: BattleState,
    handIndex: number,
    targetEnemyIndex: number,
  ): boolean {
    if (!this.canPlayCard(state, handIndex)) {
      return false;
    }
    const cardId = state.deck.hand[handIndex];
    const card = getCard(cardId);
    if (!card) {
      return false;
    }

    // 消耗能量
    const effectiveCost = this.getEffectiveCost(state, card);
    if (!characterManager.spendEnergy(state.player, effectiveCost)) {
      return false;
    }

    // 从手牌移除
    deckManager.playCard(state.deck, handIndex);

    // 执行卡牌效果
    this.executeCardEffect(state, card, targetEnemyIndex);

    // 弃牌或消耗（能力牌消耗，不进入弃牌堆）
    if (card.type === CardType.Power) {
      deckManager.exhaustCard(state.deck, cardId);
    } else {
      deckManager.discardCard(state.deck, cardId);
    }

    // 检查战斗是否结束
    this.checkBattleEnd(state);

    return true;
  }

  /**
   * 获取卡牌有效费用（考虑费用减少效果）
   * @param state 战斗状态
   * @param card 卡牌数据
   * @returns 有效费用（最小为 0）
   */
  private getEffectiveCost(state: BattleState, card: Card): number {
    const reduction = state.costReductionThisTurn ?? 0;
    return Math.max(0, card.cost - reduction);
  }

  /**
   * 执行卡牌效果（damage/block/heal/drawCards/gainEnergy/applyBuff/applyDebuff/special）
   * @param state 战斗状态
   * @param card 卡牌数据
   * @param targetEnemyIndex 目标敌人索引
   */
  executeCardEffect(
    state: BattleState,
    card: Card,
    targetEnemyIndex: number,
  ): void {
    const effect = card.effect;

    // 处理伤害
    if (effect.damage !== undefined) {
      this.applyCardDamage(state, card, targetEnemyIndex);
    }

    // 处理护甲
    if (effect.block !== undefined) {
      characterManager.gainBlock(state.player, effect.block);
      // 记录本回合获得的护甲总量（操作工用）
      state.blockGainedThisTurn = (state.blockGainedThisTurn ?? 0) + effect.block;
    }

    // 处理回血
    if (effect.heal !== undefined) {
      characterManager.heal(state.player, effect.heal);
    }

    // 处理抽牌
    if (effect.drawCards !== undefined) {
      deckManager.drawCards(state.deck, effect.drawCards, state.rng);
    }

    // 处理获得能量
    if (effect.gainEnergy !== undefined) {
      characterManager.gainEnergy(state.player, effect.gainEnergy);
    }

    // 处理施加 buff（给玩家）
    if (effect.applyBuff) {
      characterManager.addBuff(
        state.player,
        effect.applyBuff.name,
        effect.applyBuff.stacks,
      );
    }

    // 处理施加 debuff（给敌人）
    if (effect.applyDebuff) {
      if (effect.special === 'all_enemies') {
        // 对所有敌人施加 debuff
        for (const enemy of state.enemies) {
          if (enemy.currentHp > 0) {
            this.addEnemyDebuff(
              enemy,
              effect.applyDebuff.name,
              effect.applyDebuff.stacks,
            );
          }
        }
      } else {
        // 对目标敌人施加 debuff
        const target = state.enemies[targetEnemyIndex];
        if (target && target.currentHp > 0) {
          this.addEnemyDebuff(
            target,
            effect.applyDebuff.name,
            effect.applyDebuff.stacks,
          );
        }
      }
    }

    // 处理特殊效果
    if (effect.special) {
      this.executeSpecialEffect(state, card, targetEnemyIndex);
    }
  }

  /**
   * 应用卡牌伤害（处理 multi_hit、damage_per_client_resource、consume 等）
   * @param state 战斗状态
   * @param card 卡牌数据
   * @param targetEnemyIndex 目标敌人索引
   */
  private applyCardDamage(
    state: BattleState,
    card: Card,
    targetEnemyIndex: number,
  ): void {
    const effect = card.effect;
    const baseDamage = effect.damage ?? 0;
    const special = effect.special;

    // 计算伤害次数
    let hits = 1;
    if (special === 'multi_hit_3') {
      hits = 3;
    }

    // 计算每次伤害的基础值
    let perHitDamage = baseDamage;

    // damage_per_process：每层流程造成伤害
    if (special === 'damage_per_process_2') {
      const stacks = characterManager.getBuffStacks(
        state.player,
        BUFFS.PROCESS,
      );
      perHitDamage = baseDamage + stacks * 2;
    }
    if (special === 'damage_per_process_3') {
      const stacks = characterManager.getBuffStacks(
        state.player,
        BUFFS.PROCESS,
      );
      perHitDamage = baseDamage + stacks * 3;
    }

    // consume_patience_5：消耗所有耐心，每点 +5 伤害
    if (special === 'consume_patience_5') {
      const stacks = characterManager.getBuffStacks(
        state.player,
        BUFFS.PATIENCE,
      );
      perHitDamage = baseDamage + stacks * 5;
      state.player.buffs.delete(BUFFS.PATIENCE);
    }

    // consume_patience_7：消耗所有耐心，每点 +7 伤害
    if (special === 'consume_patience_7') {
      const stacks = characterManager.getBuffStacks(
        state.player,
        BUFFS.PATIENCE,
      );
      perHitDamage = baseDamage + stacks * 7;
      state.player.buffs.delete(BUFFS.PATIENCE);
    }

    // consume_overwork_3：消耗所有加班，每点 +3 伤害
    if (special === 'consume_overwork_3') {
      const stacks = characterManager.getBuffStacks(
        state.player,
        BUFFS.OVERWORK,
      );
      perHitDamage = baseDamage + stacks * 3;
      // 消耗所有加班
      state.player.buffs.delete(BUFFS.OVERWORK);
    }

    // consume_audit_4：消耗所有核算，每点 +4 伤害
    if (special === 'consume_audit_4') {
      const stacks = characterManager.getBuffStacks(state.player, BUFFS.AUDIT);
      perHitDamage = baseDamage + stacks * 4;
      state.player.buffs.delete(BUFFS.AUDIT);
    }

    // consume_audit_6：消耗所有核算，每点 +6 伤害
    if (special === 'consume_audit_6') {
      const stacks = characterManager.getBuffStacks(state.player, BUFFS.AUDIT);
      perHitDamage = baseDamage + stacks * 6;
      state.player.buffs.delete(BUFFS.AUDIT);
    }

    // damage_per_hand_card：手牌每有 1 张增加伤害
    if (special === 'damage_per_hand_card_1') {
      perHitDamage = baseDamage + state.deck.hand.length * 1;
    }
    if (special === 'damage_per_hand_card_2') {
      perHitDamage = baseDamage + state.deck.hand.length * 2;
    }

    // consume_early_warning_damage：消耗所有预警，每层增加伤害
    if (special === 'consume_early_warning_damage_4') {
      const stacks = characterManager.getBuffStacks(state.player, BUFFS.EARLY_WARNING);
      perHitDamage = baseDamage + stacks * 4;
      state.player.buffs.delete(BUFFS.EARLY_WARNING);
    }
    if (special === 'consume_early_warning_damage_6') {
      const stacks = characterManager.getBuffStacks(state.player, BUFFS.EARLY_WARNING);
      perHitDamage = baseDamage + stacks * 6;
      state.player.buffs.delete(BUFFS.EARLY_WARNING);
    }

    // 执行多次攻击
    for (let i = 0; i < hits; i++) {
      // 计算玩家输出伤害（含力量、虚弱）
      let damage = characterManager.calculateOutgoingDamage(
        state.player,
        perHitDamage,
      );
      // 双倍攻击伤害（本回合）
      if (state.doubleAttackDamageThisTurn && card.type === CardType.Attack) {
        damage *= 2;
      }
      // 对敌人造成伤害
      const target = state.enemies[targetEnemyIndex];
      if (target && target.currentHp > 0) {
        this.damageEnemy(state, target, damage);
      }
    }
  }

  /**
   * 执行特殊效果
   * @param state 战斗状态
   * @param card 卡牌数据
   * @param targetEnemyIndex 目标敌人索引
   */
  private executeSpecialEffect(
    state: BattleState,
    card: Card,
    targetEnemyIndex: number,
  ): void {
    const special = card.effect.special;
    if (!special) return;

    switch (special) {
      case 'multi_hit_3':
      case 'all_enemies':
      case 'damage_per_process_2':
      case 'damage_per_process_3':
      case 'consume_patience_5':
      case 'consume_patience_7':
      case 'consume_overwork_3':
      case 'consume_audit_4':
      case 'consume_audit_6':
      case 'damage_per_hand_card_1':
      case 'damage_per_hand_card_2':
      case 'consume_early_warning_damage_4':
      case 'consume_early_warning_damage_6':
        // 已在 applyCardDamage / executeCardEffect 中处理
        break;

      case 'gain_block_each_turn_1':
        // 能力牌：每回合获得 1 护甲
        characterManager.addBuff(state.player, POWER_BLOCK, 1);
        break;

      case 'gain_patience_each_turn_1':
        // 能力牌：每回合获得 1 耐心
        characterManager.addBuff(state.player, BUFFS.PATIENCE, 1);
        break;

      case 'gain_overwork_each_turn_1':
        // 能力牌：每回合获得 1 加班
        characterManager.addBuff(state.player, POWER_OW, 1);
        break;

      case 'gain_process_heal_each_turn':
        // 能力牌：每回合获得 1 流程，回复 2 生命
        characterManager.addBuff(state.player, BUFFS.PROCESS, 1);
        characterManager.heal(state.player, 2);
        break;

      case 'gain_audit_draw_each_turn':
        // 能力牌：每回合获得 1 核算，抽 1 牌
        characterManager.addBuff(state.player, BUFFS.AUDIT, 1);
        deckManager.drawCards(state.deck, 1, state.rng);
        break;

      case 'lose_energy_next_turn_1':
        // 下回合失去 1 能量（添加 frazzled 1）
        characterManager.addDebuff(state.player, DEBUFFS.FRAZZLED, 1);
        break;

      case 'reduce_all_cost_1_this_turn':
        // 本回合所有手牌费用 -1
        state.costReductionThisTurn = 1;
        state.costReductionTurnsLeft = 1;
        break;

      case 'reduce_all_cost_1_2_turns':
        // 持续 2 回合所有手牌费用 -1
        state.costReductionThisTurn = 1;
        state.costReductionTurnsLeft = 2;
        break;

      case 'double_attack_damage_this_turn':
        // 本回合攻击伤害翻倍
        state.doubleAttackDamageThisTurn = true;
        break;

      case 'gain_gold_30':
        // 获得 30 金币
        characterManager.addGold(state.player, 30);
        break;

      case 'gain_gold_50':
        // 获得 50 金币
        characterManager.addGold(state.player, 50);
        break;

      case 'lose_hp_2':
        // 失去 2 点 HP（无视护甲）
        state.player.currentHp = Math.max(0, state.player.currentHp - 2);
        break;

      case 'apply_vulnerable_1':
        // 施加 1 层易伤
        {
          const target = state.enemies[targetEnemyIndex];
          if (target && target.currentHp > 0) {
            this.addEnemyDebuff(target, DEBUFFS.VULNERABLE, 1);
          }
        }
        break;

      // ===== 操作工特殊效果 =====
      case 'halve_damage_this_turn':
        // 本回合受到的伤害减半
        state.halveDamageThisTurn = true;
        break;

      case 'damage_per_block_gained_this_turn_1':
        // 本回合每获得 1 护甲增加 1 伤害（在出牌时计算）
        {
          const blockGained = state.blockGainedThisTurn ?? 0;
          const target = state.enemies[targetEnemyIndex];
          if (target && target.currentHp > 0) {
            this.damageEnemy(state, target, blockGained * 1);
          }
        }
        break;

      case 'damage_per_block_gained_this_turn_2':
        // 本回合每获得 1 护甲增加 2 伤害
        {
          const blockGained = state.blockGainedThisTurn ?? 0;
          const target = state.enemies[targetEnemyIndex];
          if (target && target.currentHp > 0) {
            this.damageEnemy(state, target, blockGained * 2);
          }
        }
        break;

      // ===== 体系特殊效果 =====
      case 'apply_weak_1_gain_process_1':
        // 施加 1 层虚弱，获得 1 层流程
        {
          const target = state.enemies[targetEnemyIndex];
          if (target && target.currentHp > 0) {
            this.addEnemyDebuff(target, DEBUFFS.WEAK, 1);
          }
          characterManager.addBuff(state.player, BUFFS.PROCESS, 1);
        }
        break;

      case 'apply_weak_2_gain_process_1':
        // 施加 2 层虚弱，获得 1 层流程
        {
          const target = state.enemies[targetEnemyIndex];
          if (target && target.currentHp > 0) {
            this.addEnemyDebuff(target, DEBUFFS.WEAK, 2);
          }
          characterManager.addBuff(state.player, BUFFS.PROCESS, 1);
        }
        break;

      case 'consume_process_heal_3_draw_1':
        // 消耗所有流程，每层回复 3 血抽 1 牌
        {
          const stacks = characterManager.getBuffStacks(state.player, BUFFS.PROCESS);
          characterManager.heal(state.player, stacks * 3);
          deckManager.drawCards(state.deck, stacks, state.rng);
          state.player.buffs.delete(BUFFS.PROCESS);
        }
        break;

      case 'consume_process_heal_5_draw_1':
        // 消耗所有流程，每层回复 5 血抽 1 牌
        {
          const stacks = characterManager.getBuffStacks(state.player, BUFFS.PROCESS);
          characterManager.heal(state.player, stacks * 5);
          deckManager.drawCards(state.deck, stacks, state.rng);
          state.player.buffs.delete(BUFFS.PROCESS);
        }
        break;

      // ===== 数据特殊效果 =====
      case 'consume_audit_3_heal_8_energy_1':
        // 消耗 3 层核算，回复 8 生命，获得 1 能量
        {
          const stacks = characterManager.getBuffStacks(state.player, BUFFS.AUDIT);
          if (stacks >= 3) {
            characterManager.removeBuff(state.player, BUFFS.AUDIT, 3);
            characterManager.heal(state.player, 8);
            state.player.currentEnergy += 1;
          }
        }
        break;

      case 'consume_audit_3_heal_12_energy_2':
        // 消耗 3 层核算，回复 12 生命，获得 2 能量
        {
          const stacks = characterManager.getBuffStacks(state.player, BUFFS.AUDIT);
          if (stacks >= 3) {
            characterManager.removeBuff(state.player, BUFFS.AUDIT, 3);
            characterManager.heal(state.player, 12);
            state.player.currentEnergy += 2;
          }
        }
        break;

      case 'consume_audit_heal_2_block_1_draw_1':
        // 消耗所有核算，每层回 2 血 + 1 护甲 + 抽 1 牌
        {
          const stacks = characterManager.getBuffStacks(state.player, BUFFS.AUDIT);
          characterManager.heal(state.player, stacks * 2);
          characterManager.gainBlock(state.player, stacks * 1);
          deckManager.drawCards(state.deck, stacks, state.rng);
          state.player.buffs.delete(BUFFS.AUDIT);
        }
        break;

      case 'consume_audit_heal_3_block_2_draw_1':
        // 消耗所有核算，每层回 3 血 + 2 护甲 + 抽 1 牌
        {
          const stacks = characterManager.getBuffStacks(state.player, BUFFS.AUDIT);
          characterManager.heal(state.player, stacks * 3);
          characterManager.gainBlock(state.player, stacks * 2);
          deckManager.drawCards(state.deck, stacks, state.rng);
          state.player.buffs.delete(BUFFS.AUDIT);
        }
        break;

      // ===== 安全员特殊效果 =====
      case 'consume_early_warning_block_5_damage_3':
        // 消耗所有预警，每层获得 5 护甲，对所有敌人造成 3 伤害
        {
          const stacks = characterManager.getBuffStacks(state.player, BUFFS.EARLY_WARNING);
          characterManager.gainBlock(state.player, stacks * 5);
          for (const enemy of state.enemies) {
            if (enemy.currentHp > 0) {
              this.damageEnemy(state, enemy, stacks * 3);
            }
          }
          state.player.buffs.delete(BUFFS.EARLY_WARNING);
        }
        break;

      case 'consume_early_warning_block_8_damage_5':
        // 消耗所有预警，每层获得 8 护甲，对所有敌人造成 5 伤害
        {
          const stacks = characterManager.getBuffStacks(state.player, BUFFS.EARLY_WARNING);
          characterManager.gainBlock(state.player, stacks * 8);
          for (const enemy of state.enemies) {
            if (enemy.currentHp > 0) {
              this.damageEnemy(state, enemy, stacks * 5);
            }
          }
          state.player.buffs.delete(BUFFS.EARLY_WARNING);
        }
        break;

      case 'gain_early_warning_3_energy_if_5':
        // 获得 3 层预警，若预警 ≥ 5 则额外获得 1 能量
        {
          characterManager.addBuff(state.player, BUFFS.EARLY_WARNING, 3);
          const total = characterManager.getBuffStacks(state.player, BUFFS.EARLY_WARNING);
          if (total >= 5) {
            state.player.currentEnergy += 1;
          }
        }
        break;

      case 'gain_early_warning_4_energy_if_5':
        // 获得 4 层预警，若预警 ≥ 5 则额外获得 2 能量
        {
          characterManager.addBuff(state.player, BUFFS.EARLY_WARNING, 4);
          const total = characterManager.getBuffStacks(state.player, BUFFS.EARLY_WARNING);
          if (total >= 5) {
            state.player.currentEnergy += 2;
          }
        }
        break;

      case 'gain_early_warning_and_block_each_turn':
        // 能力牌：每回合获得 1 层预警和 5 护甲
        characterManager.addBuff(state.player, BUFFS.EARLY_WARNING, 1);
        characterManager.gainBlock(state.player, 5);
        break;

      case 'gain_early_warning_and_block_each_turn_2':
        // 能力牌：每回合获得 2 层预警和 8 护甲
        characterManager.addBuff(state.player, BUFFS.EARLY_WARNING, 2);
        characterManager.gainBlock(state.player, 8);
        break;

      default:
        break;
    }
  }

  // ===== 敌人受伤 =====

  /**
   * 对敌人造成伤害（计算敌人护甲、易伤），返回实际 HP 损失
   * @param state 战斗状态
   * @param enemy 敌人状态
   * @param amount 基础伤害
   * @returns 实际造成的生命值损失
   */
  damageEnemy(
    _state: BattleState,
    enemy: EnemyState,
    amount: number,
  ): number {
    if (amount <= 0 || enemy.currentHp <= 0) return 0;
    // 计算易伤后的实际伤害
    const actualDamage = this.calculateEnemyIncomingDamage(enemy, amount);
    let remaining = actualDamage;
    // 先扣护甲
    if (enemy.block > 0) {
      const absorbed = Math.min(enemy.block, remaining);
      enemy.block -= absorbed;
      remaining -= absorbed;
    }
    // 护甲不足再扣血
    if (remaining > 0) {
      enemy.currentHp = Math.max(0, enemy.currentHp - remaining);
    }
    return remaining;
  }

  /**
   * 计算敌人受到的伤害（含易伤增伤）
   * @param enemy 敌人状态
   * @param baseDamage 基础伤害
   * @returns 计算后的伤害值
   */
  private calculateEnemyIncomingDamage(
    enemy: EnemyState,
    baseDamage: number,
  ): number {
    if (this.hasEnemyDebuff(enemy, DEBUFFS.VULNERABLE)) {
      return Math.floor(baseDamage * 1.5);
    }
    return baseDamage;
  }

  // ===== 回合管理 =====

  /**
   * 结束玩家回合：弃手牌、player.endTurn、切换到 enemy_turn
   * @param state 战斗状态
   */
  endPlayerTurn(state: BattleState): void {
    if (state.phase !== 'player_turn') {
      return;
    }
    // 弃手牌
    deckManager.discardHand(state.deck);
    // 玩家回合结束（递减 debuff）
    characterManager.endTurn(state.player);
    // 清除本回合临时效果
    state.doubleAttackDamageThisTurn = false;
    state.halveDamageThisTurn = false;
    state.blockGainedThisTurn = 0;
    // 递减费用减少剩余回合
    if (state.costReductionTurnsLeft !== undefined && state.costReductionTurnsLeft > 0) {
      state.costReductionTurnsLeft -= 1;
      if (state.costReductionTurnsLeft <= 0) {
        state.costReductionThisTurn = 0;
        state.costReductionTurnsLeft = 0;
      }
    }
    // 切换到敌人回合
    state.phase = 'enemy_turn';
  }

  /**
   * 执行敌人回合：每个敌人按意图行动，然后切换回 player_turn，
   * turn+1，player.startTurn，抽 5 张牌，重新计算敌人意图
   * @param state 战斗状态
   */
  executeEnemyTurn(state: BattleState): void {
    if (state.phase !== 'enemy_turn') {
      return;
    }

    // 清除所有敌人护甲（敌人回合开始）
    for (const enemy of state.enemies) {
      if (enemy.currentHp > 0) {
        enemy.block = 0;
      }
    }

    // 每个敌人按意图行动
    for (const enemy of state.enemies) {
      if (enemy.currentHp <= 0) continue;
      this.executeEnemyAction(state, enemy);
      // 检查玩家是否死亡
      if (state.player.currentHp <= 0) {
        state.phase = 'defeat';
        return;
      }
    }

    // 敌人回合结束：递减 debuff
    this.endEnemyTurn(state);

    // 检查战斗是否结束
    const result = this.checkBattleEnd(state);
    if (result === 'defeat') {
      return;
    }

    // 切换回玩家回合
    state.turn += 1;
    state.phase = 'player_turn';
    // 玩家回合开始（重置能量、清零护甲、处理 ritual/frazzled）
    characterManager.startTurn(state.player);
    // 处理 power buff（每回合获得资源）
    this.processPowerBuffs(state);
    // 抽 5 张牌
    deckManager.drawCards(state.deck, 5, state.rng);
  }

  /**
   * 执行单个敌人行动（attack/block/buff/debuff）
   * @param state 战斗状态
   * @param enemy 敌人状态
   */
  executeEnemyAction(state: BattleState, enemy: EnemyState): void {
    // 缠绕状态跳过行动
    if (this.hasEnemyDebuff(enemy, DEBUFFS.ENTANGLED)) {
      // 递增回合计数并计算下回合意图
      enemy.turnCount += 1;
      enemy.moveIndex += 1;
      enemy.currentIntent = this.calculateEnemyIntent(enemy, state.rng);
      return;
    }

    const intent = enemy.currentIntent;
    if (!intent) return;

    // 检查是否双攻
    const doubleAttack = this.hasEnemyBuff(enemy, DOUBLE_ATTACK);
    const attackCount = doubleAttack ? 2 : 1;

    switch (intent.type) {
      case IntentType.Attack:
        for (let i = 0; i < attackCount; i++) {
          this.enemyAttack(state, enemy, intent.value ?? 0);
        }
        break;

      case IntentType.AttackDebuff:
        for (let i = 0; i < attackCount; i++) {
          this.enemyAttack(state, enemy, intent.value ?? 0);
        }
        if (intent.debuff) {
          characterManager.addDebuff(
            state.player,
            intent.debuff.name,
            intent.debuff.stacks,
          );
        }
        break;

      case IntentType.Defend:
        enemy.block += intent.value ?? 0;
        break;

      case IntentType.Buff:
        if (intent.buff) {
          this.addEnemyBuff(enemy, intent.buff.name, intent.buff.stacks);
        }
        break;

      case IntentType.Debuff:
        if (intent.debuff) {
          characterManager.addDebuff(
            state.player,
            intent.debuff.name,
            intent.debuff.stacks,
          );
        }
        break;

      case IntentType.Unknown:
        this.executeSpecialEnemyAction(state, enemy, intent);
        break;

      default:
        break;
    }

    // 递增回合计数和移动索引
    enemy.turnCount += 1;
    enemy.moveIndex += 1;
    // 计算下回合意图
    enemy.currentIntent = this.calculateEnemyIntent(enemy, state.rng);
  }

  /**
   * 敌人攻击玩家（计算力量、虚弱、暴怒）
   * @param state 战斗状态
   * @param enemy 敌人状态
   * @param baseDamage 基础伤害
   */
  private enemyAttack(
    state: BattleState,
    enemy: EnemyState,
    baseDamage: number,
  ): void {
    // 基础伤害 + 力量
    let damage = baseDamage + this.getEnemyBuffStacks(enemy, BUFFS.STRENGTH);
    // 虚弱减伤（×0.75）
    if (this.hasEnemyDebuff(enemy, DEBUFFS.WEAK)) {
      damage = Math.floor(damage * 0.75);
    }
    // 暴怒增伤（×1.5）
    if (this.hasEnemyBuff(enemy, ENRAGE)) {
      damage = Math.floor(damage * 1.5);
    }
    // 操作工：左耳进右耳出，本回合伤害减半
    if (state.halveDamageThisTurn) {
      damage = Math.floor(damage * 0.5);
    }
    // 安全员：预警机制，每层减免 2 点伤害，消耗 1 层
    const warningStacks = characterManager.getBuffStacks(state.player, BUFFS.EARLY_WARNING);
    if (warningStacks > 0 && damage > 0) {
      const reduction = Math.min(damage, warningStacks * 2);
      damage -= reduction;
      characterManager.removeBuff(state.player, BUFFS.EARLY_WARNING, 1);
    }
    // 玩家受伤（含易伤、护甲）
    characterManager.takeDamage(state.player, damage);
  }

  /**
   * 执行敌人特殊行动（召唤、能量减少等）
   * @param state 战斗状态
   * @param enemy 敌人状态
   * @param intent 敌人意图
   */
  private executeSpecialEnemyAction(
    state: BattleState,
    enemy: EnemyState,
    intent: EnemyIntent,
  ): void {
    const description = intent.description;

    // 解析描述中的召唤信息
    if (description.includes('召唤')) {
      // 解析召唤数量
      const countMatch = description.match(/召唤\s*(\d+)\s*个/);
      const count = countMatch ? parseInt(countMatch[1], 10) : 1;
      // 解析攻击力和生命值
      const attackMatch = description.match(/攻击\s*(\d+)/);
      const hpMatch = description.match(/生命\s*(\d+)/);
      const attack = attackMatch ? parseInt(attackMatch[1], 10) : 5;
      const hp = hpMatch ? parseInt(hpMatch[1], 10) : 10;
      // 解析名称
      const nameMatch = description.match(/召唤(?:\d+\s*个)?(.+?)（/);
      const name = nameMatch ? nameMatch[1] : '召唤物';

      // 创建召唤敌人
      for (let i = 0; i < count; i++) {
        const summoned: EnemyState = {
          id: `enemy_${enemyInstanceIdCounter++}`,
          dataId: `summoned_${enemy.dataId}`,
          name,
          maxHp: hp,
          currentHp: hp,
          block: 0,
          attack,
          buffs: new Map<string, number>(),
          debuffs: new Map<string, number>(),
          ai: {
            type: 'sequential',
            moves: [
              {
                type: IntentType.Attack,
                value: attack,
                description: `攻击 ${attack} 点伤害`,
              },
            ],
          },
          moveIndex: 0,
          turnCount: 0,
          currentIntent: null,
          isBoss: false,
        };
        summoned.currentIntent = this.calculateEnemyIntent(summoned, state.rng);
        state.enemies.push(summoned);
      }
    } else if (description.includes('能量')) {
      // 系统重构：本回合玩家能量 -1
      state.player.currentEnergy = Math.max(
        0,
        state.player.currentEnergy - 1,
      );
    }
  }

  /**
   * 敌人回合结束：递减 debuff（与玩家相同逻辑）
   * @param state 战斗状态
   */
  private endEnemyTurn(state: BattleState): void {
    for (const enemy of state.enemies) {
      if (enemy.currentHp <= 0) continue;
      const decrementDebuff = (name: string): void => {
        const stacks = enemy.debuffs.get(name);
        if (stacks !== undefined) {
          if (stacks <= 1) {
            enemy.debuffs.delete(name);
          } else {
            enemy.debuffs.set(name, stacks - 1);
          }
        }
      };
      decrementDebuff(DEBUFFS.VULNERABLE);
      decrementDebuff(DEBUFFS.WEAK);
      decrementDebuff(DEBUFFS.ENTANGLED);
      decrementDebuff(DEBUFFS.FRAZZLED);
    }
  }

  /**
   * 处理 power buff（每回合获得资源）
   * @param state 战斗状态
   */
  private processPowerBuffs(state: BattleState): void {
    const player = state.player;
    // 每回合获得护甲
    const powerBlock = characterManager.getBuffStacks(player, POWER_BLOCK);
    if (powerBlock > 0) {
      characterManager.gainBlock(player, powerBlock);
    }
    // 每回合获得加班
    const powerOw = characterManager.getBuffStacks(player, POWER_OW);
    if (powerOw > 0) {
      characterManager.addBuff(player, BUFFS.OVERWORK, powerOw);
    }
    // 体系：流程 buff 每层每回合回 1 血
    const processStacks = characterManager.getBuffStacks(player, BUFFS.PROCESS);
    if (processStacks > 0) {
      characterManager.heal(player, processStacks);
    }
  }

  // ===== 胜负判定 =====

  /**
   * 检查战斗是否结束
   * @param state 战斗状态
   * @returns 'victory' | 'defeat' | null
   */
  checkBattleEnd(state: BattleState): 'victory' | 'defeat' | null {
    // 玩家死亡
    if (state.player.currentHp <= 0) {
      state.phase = 'defeat';
      return 'defeat';
    }
    // 所有敌人死亡
    const allDead = state.enemies.every((e) => e.currentHp <= 0);
    if (allDead) {
      state.phase = 'victory';
      // 计算奖励（仅在首次进入胜利状态时）
      if (state.rewards.gold === 0 && state.rewards.cards === 0) {
        this.calculateRewards(state);
      }
      return 'victory';
    }
    return null;
  }

  /**
   * 计算战斗奖励（金币按敌人 rewards，卡牌数按敌人 rewards）
   * @param state 战斗状态
   */
  private calculateRewards(state: BattleState): void {
    let gold = 0;
    let cards = 0;
    for (const enemy of state.enemies) {
      // 通过 dataId 查找原始敌人数据获取 rewards
      const enemyData = getEnemy(enemy.dataId);
      if (enemyData?.rewards) {
        gold += state.rng.nextInt(
          enemyData.rewards.gold[0],
          enemyData.rewards.gold[1],
        );
        cards += enemyData.rewards.cards ?? 0;
      } else {
        // 普通敌人/召唤物默认奖励
        gold += state.rng.nextInt(10, 20);
        cards += 1; // 普通敌人也奖励 1 张卡牌
      }
    }
    state.rewards = { gold, cards };
  }

  /**
   * 获取战斗奖励（卡牌按稀有度概率：普通60%/稀有25%/史诗12%/传说3%）
   * @param state 战斗状态
   * @returns 奖励对象（金币数量和卡牌 id 列表）
   */
  getRewards(state: BattleState): { gold: number; cardChoices: string[] } {
    const gold = state.rewards.gold;
    const cardChoices: string[] = [];
    const cardCount = state.rewards.cards;

    // 获取玩家职业卡牌池
    const character = getCharacter(state.player.classId);
    const poolIds = new Set<string>(character.cardPool);
    // 获取卡牌数据并按稀有度分组
    const pool = ALL_CARDS.filter((c) => poolIds.has(c.id));
    const byRarity = new Map<CardRarity, Card[]>([
      [CardRarity.Common, pool.filter((c) => c.rarity === CardRarity.Common)],
      [CardRarity.Rare, pool.filter((c) => c.rarity === CardRarity.Rare)],
      [CardRarity.Epic, pool.filter((c) => c.rarity === CardRarity.Epic)],
      [CardRarity.Legendary, pool.filter((c) => c.rarity === CardRarity.Legendary)],
    ]);

    for (let i = 0; i < cardCount; i++) {
      // 按稀有度概率选择
      const roll = state.rng.next();
      let rarity: CardRarity;
      if (roll < 0.6) {
        rarity = CardRarity.Common;
      } else if (roll < 0.85) {
        rarity = CardRarity.Rare;
      } else if (roll < 0.97) {
        rarity = CardRarity.Epic;
      } else {
        rarity = CardRarity.Legendary;
      }

      // 从该稀有度中随机选择一张
      let cardsOfRarity = byRarity.get(rarity) ?? [];
      // 如果该稀有度无卡牌，降级到普通
      if (cardsOfRarity.length === 0) {
        cardsOfRarity = byRarity.get(CardRarity.Common) ?? pool;
      }
      if (cardsOfRarity.length > 0) {
        const card = state.rng.pick(cardsOfRarity);
        cardChoices.push(card.id);
      }
    }

    return { gold, cardChoices };
  }

  // ===== 敌人 buff/debuff 辅助方法 =====

  /**
   * 添加敌人 buff，叠加层数
   */
  private addEnemyBuff(enemy: EnemyState, name: string, stacks: number): void {
    const current = enemy.buffs.get(name) ?? 0;
    enemy.buffs.set(name, current + stacks);
  }

  /**
   * 添加敌人 debuff，叠加层数
   */
  private addEnemyDebuff(enemy: EnemyState, name: string, stacks: number): void {
    const current = enemy.debuffs.get(name) ?? 0;
    enemy.debuffs.set(name, current + stacks);
  }

  /**
   * 获取敌人 buff 层数
   */
  private getEnemyBuffStacks(enemy: EnemyState, name: string): number {
    return enemy.buffs.get(name) ?? 0;
  }

  /**
   * 获取敌人 debuff 层数
   */
  private getEnemyDebuffStacks(enemy: EnemyState, name: string): number {
    return enemy.debuffs.get(name) ?? 0;
  }

  /**
   * 敌人是否有某 buff
   */
  private hasEnemyBuff(enemy: EnemyState, name: string): boolean {
    return this.getEnemyBuffStacks(enemy, name) > 0;
  }

  /**
   * 敌人是否有某 debuff
   */
  private hasEnemyDebuff(enemy: EnemyState, name: string): boolean {
    return this.getEnemyDebuffStacks(enemy, name) > 0;
  }
}

// 导出单例
export const battleManager = new BattleManager();
