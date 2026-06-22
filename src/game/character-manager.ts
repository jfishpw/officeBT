// 角色管理器：管理角色状态、属性、Buff/Debuff、回合与升级
import { CharacterClass, getCharacter } from '../data/characters';
import { BUFFS, DEBUFFS } from '../data/cards';

// 角色运行时状态
export interface CharacterState {
  classId: CharacterClass; // 职业
  name: string; // 角色名
  maxHp: number; // 最大生命
  currentHp: number; // 当前生命
  maxEnergy: number; // 每回合最大能量
  currentEnergy: number; // 当前能量
  gold: number; // 金币
  block: number; // 当前护甲（每回合清零）
  buffs: Map<string, number>; // buff 名称 -> 层数
  debuffs: Map<string, number>; // debuff 名称 -> 层数
  upgradePoints: number; // 升级点数（击败 Boss 获得）
  level: number; // 当前等级（击败 Boss 数量，0-4）
}

// 角色管理器类
export class CharacterManager {
  /**
   * 根据职业创建角色，初始化属性
   * @param classId 职业枚举
   * @returns 初始化后的角色状态
   */
  createCharacter(classId: CharacterClass): CharacterState {
    const data = getCharacter(classId);
    return {
      classId,
      name: data.name,
      maxHp: data.stats.maxHp,
      currentHp: data.stats.maxHp,
      maxEnergy: data.stats.startingEnergy,
      currentEnergy: data.stats.startingEnergy,
      gold: data.stats.startingGold,
      block: 0,
      buffs: new Map(),
      debuffs: new Map(),
      upgradePoints: 0,
      level: 0,
    };
  }

  /**
   * 受伤（计算护甲、易伤），返回实际伤害（HP 损失）
   * @param state 角色状态
   * @param amount 基础伤害
   * @returns 实际造成的生命值损失
   */
  takeDamage(state: CharacterState, amount: number): number {
    if (amount <= 0) return 0;
    // 计算易伤后的实际伤害
    const actualDamage = this.calculateIncomingDamage(state, amount);
    // 先扣护甲
    let remaining = actualDamage;
    if (state.block > 0) {
      const absorbed = Math.min(state.block, remaining);
      state.block -= absorbed;
      remaining -= absorbed;
    }
    // 护甲不足再扣血
    if (remaining > 0) {
      state.currentHp = Math.max(0, state.currentHp - remaining);
    }
    return remaining;
  }

  /**
   * 回血，不超过 maxHp，返回实际回复量
   * @param state 角色状态
   * @param amount 回复量
   * @returns 实际回复的生命值
   */
  heal(state: CharacterState, amount: number): number {
    if (amount <= 0) return 0;
    const before = state.currentHp;
    state.currentHp = Math.min(state.maxHp, state.currentHp + amount);
    return state.currentHp - before;
  }

  /**
   * 获得护甲（应用敏捷加成，每层 +1）
   * @param state 角色状态
   * @param amount 护甲基础值
   */
  gainBlock(state: CharacterState, amount: number): void {
    const dexterity = this.getBuffStacks(state, BUFFS.DEXTERITY);
    state.block += amount + dexterity;
  }

  /**
   * 获得能量
   * @param state 角色状态
   * @param amount 能量值
   */
  gainEnergy(state: CharacterState, amount: number): void {
    state.currentEnergy += amount;
  }

  /**
   * 消耗能量，不足返回 false
   * @param state 角色状态
   * @param amount 消耗量
   * @returns 是否消耗成功
   */
  spendEnergy(state: CharacterState, amount: number): boolean {
    if (state.currentEnergy < amount) return false;
    state.currentEnergy -= amount;
    return true;
  }

  /**
   * 金币变化（可正可负）
   * @param state 角色状态
   * @param amount 变化量
   */
  addGold(state: CharacterState, amount: number): void {
    state.gold += amount;
  }

  /**
   * 添加 buff，叠加层数
   * @param state 角色状态
   * @param name buff 名称
   * @param stacks 层数
   */
  addBuff(state: CharacterState, name: string, stacks: number): void {
    const current = state.buffs.get(name) ?? 0;
    state.buffs.set(name, current + stacks);
  }

  /**
   * 减少 buff 层数，若减至 0 则移除
   * @param state 角色状态
   * @param name buff 名称
   * @param stacks 减少的层数
   */
  removeBuff(state: CharacterState, name: string, stacks: number): void {
    const current = state.buffs.get(name) ?? 0;
    const remaining = current - stacks;
    if (remaining <= 0) {
      state.buffs.delete(name);
    } else {
      state.buffs.set(name, remaining);
    }
  }

  /**
   * 添加 debuff，叠加层数
   * @param state 角色状态
   * @param name debuff 名称
   * @param stacks 层数
   */
  addDebuff(state: CharacterState, name: string, stacks: number): void {
    const current = state.debuffs.get(name) ?? 0;
    state.debuffs.set(name, current + stacks);
  }

  /**
   * 获取 buff 层数
   * @param state 角色状态
   * @param name buff 名称
   * @returns 层数（不存在则为 0）
   */
  getBuffStacks(state: CharacterState, name: string): number {
    return state.buffs.get(name) ?? 0;
  }

  /**
   * 获取 debuff 层数
   * @param state 角色状态
   * @param name debuff 名称
   * @returns 层数（不存在则为 0）
   */
  getDebuffStacks(state: CharacterState, name: string): number {
    return state.debuffs.get(name) ?? 0;
  }

  /**
   * 是否有某 debuff
   * @param state 角色状态
   * @param name debuff 名称
   * @returns 是否存在（层数 > 0）
   */
  hasDebuff(state: CharacterState, name: string): boolean {
    return this.getDebuffStacks(state, name) > 0;
  }

  /**
   * 回合开始：重置能量=maxEnergy，清零护甲，处理 ritual 每回合获得力量、frazzled 失去能量
   * @param state 角色状态
   */
  startTurn(state: CharacterState): void {
    // 重置能量
    state.currentEnergy = state.maxEnergy;
    // 清零护甲
    state.block = 0;
    // 处理 ritual：每回合开始获得力量（层数 = 获得力量数）
    const ritual = this.getBuffStacks(state, BUFFS.RITUAL);
    if (ritual > 0) {
      this.addBuff(state, BUFFS.STRENGTH, ritual);
    }
    // 处理 frazzled：每回合开始失去能量（层数 = 失去能量数）
    const frazzled = this.getDebuffStacks(state, DEBUFFS.FRAZZLED);
    if (frazzled > 0) {
      state.currentEnergy = Math.max(0, state.currentEnergy - frazzled);
    }
  }

  /**
   * 回合结束：递减 debuff 层数（vulnerable/weak/entangled/frazzled 各 -1）
   * @param state 角色状态
   */
  endTurn(state: CharacterState): void {
    const decrementDebuff = (name: string): void => {
      const stacks = state.debuffs.get(name);
      if (stacks !== undefined) {
        if (stacks <= 1) {
          state.debuffs.delete(name);
        } else {
          state.debuffs.set(name, stacks - 1);
        }
      }
    };
    decrementDebuff(DEBUFFS.VULNERABLE);
    decrementDebuff(DEBUFFS.WEAK);
    decrementDebuff(DEBUFFS.ENTANGLED);
    decrementDebuff(DEBUFFS.FRAZZLED);
  }

  /**
   * 击败 Boss 后调用，upgradePoints+1，level+1
   * @param state 角色状态
   */
  gainUpgradePoint(state: CharacterState): void {
    state.upgradePoints += 1;
    state.level += 1;
  }

  /**
   * 获取可用升级点
   * @param state 角色状态
   * @returns 当前升级点数
   */
  getUpgradePoints(state: CharacterState): number {
    return state.upgradePoints;
  }

  /**
   * 计算打出的伤害（应用 strength 增伤、weak 减伤）
   * @param state 角色状态
   * @param baseDamage 基础伤害
   * @returns 计算后的伤害值
   */
  calculateOutgoingDamage(state: CharacterState, baseDamage: number): number {
    // 力量增伤（每层 +1）
    let damage = baseDamage + this.getBuffStacks(state, BUFFS.STRENGTH);
    // 虚弱减伤（×0.75，向下取整）
    if (this.hasDebuff(state, DEBUFFS.WEAK)) {
      damage = Math.floor(damage * 0.75);
    }
    return damage;
  }

  /**
   * 计算受到的伤害（应用 vulnerable 增伤）
   * @param state 角色状态
   * @param baseDamage 基础伤害
   * @returns 计算后的伤害值
   */
  calculateIncomingDamage(state: CharacterState, baseDamage: number): number {
    // 易伤增伤（×1.5，向下取整）
    if (this.hasDebuff(state, DEBUFFS.VULNERABLE)) {
      return Math.floor(baseDamage * 1.5);
    }
    return baseDamage;
  }
}

// 导出单例
export const characterManager = new CharacterManager();
