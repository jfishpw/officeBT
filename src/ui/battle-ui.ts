// 战斗界面：展示敌人、手牌、玩家状态，支持出牌、结束回合、战斗结算
// 使用 DOM 渲染，flexbox 布局，上方敌人区、中间效果反馈区、下方玩家区+手牌

import { Scene, UIManager, uiManager } from './ui-manager';
import { SceneManager, PlaceholderRenderer } from './scene';
import { GameState, gameStateMachine } from '../core/state-machine';
import { BattleState, EnemyState, battleManager } from '../game/battle';
import { MapState } from '../game/map';
import { CharacterState } from '../game/character-manager';
import { DeckState } from '../game/deck-manager';
import { Card, CardType, getCard, BUFFS, DEBUFFS } from '../data/cards';
import { gameStatsManager, GameStatsManager } from '../game/game-stats';
import { EnemyIntent, IntentType, getEnemy } from '../data/enemies';

// 意图类型图标映射
const INTENT_ICONS: Record<IntentType, string> = {
  [IntentType.Attack]: '⚔️',
  [IntentType.Defend]: '🛡️',
  [IntentType.Buff]: '⬆️',
  [IntentType.Debuff]: '⬇️',
  [IntentType.AttackDebuff]: '⚔️',
  [IntentType.Unknown]: '❓',
};

// 意图类型中文说明
const INTENT_TYPE_NAMES: Record<IntentType, string> = {
  [IntentType.Attack]: '攻击',
  [IntentType.Defend]: '防御',
  [IntentType.Buff]: '增益',
  [IntentType.Debuff]: '减益',
  [IntentType.AttackDebuff]: '攻击+减益',
  [IntentType.Unknown]: '未知',
};

// Buff 中文名称与描述映射
const BUFF_INFO: Record<string, { name: string; desc: string }> = {
  strength: { name: '力量', desc: '增加攻击伤害，每点力量使攻击伤害 +1' },
  dexterity: { name: '敏捷', desc: '增加护甲，每点敏捷使获得的护甲 +1' },
  ritual: { name: '仪式', desc: '每回合开始时自动获得 1 点力量' },
  overwork: { name: '加班', desc: 'IT 专属 Buff，通过卡牌叠加层数；打出"系统崩溃"时消耗所有层数，每层 +3 伤害爆发' },
  patience: { name: '耐心', desc: '操作工专属 Buff，叠加层数；打出"无限耐心"时消耗所有层数，每层 +5 伤害爆发' },
  process: { name: '流程', desc: '体系专属 Buff，每层每回合回复 1 点生命；可被"体系碾压"和"终极流程"消耗' },
  audit: { name: '核算', desc: '数据专属 Buff，通过做报表/记账叠加；可被"精准打击"消耗爆发伤害，或被"对账/年终结算"转化为生命/能量/护甲' },
  early_warning: { name: '预警', desc: '安全员专属 Buff，被攻击时每层减免 2 点伤害并消耗 1 层；可被"应急预案/事故调查"消耗爆发' },
  power_block_1: { name: '固守', desc: '每回合开始自动获得 1 点护甲' },
  power_ow_1: { name: '加班模式', desc: '每回合开始自动获得 1 点加班层数' },
  power_process_1: { name: '官僚流程', desc: '每回合开始自动获得 1 点流程（文员"官僚主义"能力）' },
  power_cr_1: { name: '客户资源', desc: '每回合开始自动获得 1 点客户资源' },
  double_attack: { name: '双击', desc: '每回合攻击两次' },
};

// Debuff 中文名称与描述映射
const DEBUFF_INFO: Record<string, { name: string; desc: string }> = {
  vulnerable: { name: '易伤', desc: '受到的攻击伤害增加 50%，持续至回合结束' },
  weak: { name: '虚弱', desc: '攻击伤害降低 25%，持续至回合结束' },
  entangled: { name: '缠绕', desc: '本回合不能出攻击牌，回合结束后解除' },
  frazzled: { name: '烦躁', desc: '每回合开始失去 1 点能量' },
};

/** 获取 buff/debuff 的中文说明 */
function getBuffTooltip(key: string, stacks: number, isDebuff: boolean): string {
  const info = isDebuff ? DEBUFF_INFO[key] : BUFF_INFO[key];
  if (info) {
    return `${info.name} x${stacks}：${info.desc}`;
  }
  return `${key} x${stacks}`;
}

/**
 * 战斗场景
 * 展示敌人、手牌、玩家状态，支持出牌与回合管理
 */
export class BattleScene implements Scene {
  /** 根容器 */
  private root: HTMLElement | null = null;
  /** 战斗状态 */
  private battleState: BattleState;
  /** 地图状态（用于结算后返回地图） */
  private mapState: MapState;
  /** 玩家 HUD 区域 */
  private playerHud: HTMLElement | null = null;
  /** 敌人区域 */
  private enemiesArea: HTMLElement | null = null;
  /** 手牌区域 */
  private handArea: HTMLElement | null = null;
  /** 效果反馈区域 */
  private effectArea: HTMLElement | null = null;
  /** 当前选中的卡牌索引 */
  private selectedCardIndex: number = -1;
  /** 事件监听器引用（用于清理） */
  private cardClickHandlers: Array<{ cardEl: HTMLElement; index: number; handler: () => void }> = [];
  /** 敌人点击处理器 */
  private enemyClickHandlers: Array<{ enemyEl: HTMLElement; index: number; handler: () => void }> = [];
  /** 计时器更新间隔 ID */
  private timerInterval: number | null = null;
  /** 计时器显示元素 */
  private timerEl: HTMLElement | null = null;

  constructor(battleState: BattleState, mapState: MapState) {
    this.battleState = battleState;
    this.mapState = mapState;
  }

  /** 挂载场景，构建 DOM */
  mount(container: HTMLElement): void {
    // 设置场景背景
    SceneManager.setBackground('battle');

    // 构建根容器
    const root = UIManager.createElement('div', 'battle-scene');
    this.root = root;

    // 顶部：回合数与阶段指示
    root.appendChild(this.buildTopBar());

    // 上方：敌人区域
    this.enemiesArea = this.buildEnemiesArea();
    root.appendChild(this.enemiesArea);

    // 中间：效果反馈区域
    this.effectArea = UIManager.createElement('div', 'battle-effect-area');
    root.appendChild(this.effectArea);

    // 下方：玩家 HUD + 手牌区域
    const bottomArea = UIManager.createElement('div', 'battle-bottom-area');
    this.playerHud = this.buildPlayerHud();
    bottomArea.appendChild(this.playerHud);
    this.handArea = this.buildHandArea();
    bottomArea.appendChild(this.handArea);
    root.appendChild(bottomArea);

    // 底部：回合结束按钮
    root.appendChild(this.buildFooter());

    container.appendChild(root);

    // 绑定场景切换事件（敌人回合自动执行）
    this.bindEvents();

    // 启动计时器
    this.startTimer();
  }

  /** 卸载场景，清理 DOM 与事件监听 */
  unmount(): void {
    // 停止计时器
    this.stopTimer();

    // 清理卡牌点击事件
    for (const { cardEl, handler } of this.cardClickHandlers) {
      cardEl.removeEventListener('click', handler);
    }
    this.cardClickHandlers = [];

    // 清理敌人点击事件
    for (const { enemyEl, handler } of this.enemyClickHandlers) {
      enemyEl.removeEventListener('click', handler);
    }
    this.enemyClickHandlers = [];

    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
    this.playerHud = null;
    this.enemiesArea = null;
    this.handArea = null;
    this.effectArea = null;
  }

  /** 数据更新时刷新战斗界面 */
  update(): void {
    if (!this.root) {
      return;
    }

    // 刷新顶部状态栏
    const oldTopBar = this.root.querySelector<HTMLElement>('.battle-top-bar');
    if (oldTopBar) {
      this.root.replaceChild(this.buildTopBar(), oldTopBar);
    }

    // 刷新敌人区域
    if (this.enemiesArea) {
      const newEnemiesArea = this.buildEnemiesArea();
      this.root.replaceChild(newEnemiesArea, this.enemiesArea);
      this.enemiesArea = newEnemiesArea;
    }

    // 刷新玩家 HUD
    const oldPlayerHud = this.root.querySelector<HTMLElement>('.battle-player-hud');
    if (oldPlayerHud) {
      const newPlayerHud = this.buildPlayerHud();
      const bottomArea = oldPlayerHud.parentElement;
      if (bottomArea) {
        bottomArea.replaceChild(newPlayerHud, oldPlayerHud);
        this.playerHud = newPlayerHud;
      }
    }

    // 刷新手牌区域
    if (this.handArea) {
      const newHandArea = this.buildHandArea();
      const bottomArea = this.handArea.parentElement;
      if (bottomArea) {
        bottomArea.replaceChild(newHandArea, this.handArea);
        this.handArea = newHandArea;
      }
    }

    // 检查战斗是否结束
    const result = battleManager.checkBattleEnd(this.battleState);
    if (result === 'victory') {
      this.showVictoryDialog();
    } else if (result === 'defeat') {
      this.showDefeatDialog();
    }

    // 重新绑定敌人点击事件
    this.bindEnemyClickEvents();
  }

  // ===== 构建顶部状态栏 =====

  /**
   * 构建顶部状态栏：回合数、阶段指示
   */
  private buildTopBar(): HTMLElement {
    const bar = UIManager.createElement('div', 'battle-top-bar');
    const turnEl = UIManager.createElement('div', 'battle-turn', `回合 ${this.battleState.turn}`);
    const phaseEl = UIManager.createElement('div', 'battle-phase', this.getPhaseText());
    bar.appendChild(turnEl);
    bar.appendChild(phaseEl);
    return bar;
  }

  /**
   * 获取阶段显示文本
   */
  private getPhaseText(): string {
    switch (this.battleState.phase) {
      case 'player_turn':
        return '你的回合';
      case 'enemy_turn':
        return '敌人回合';
      case 'victory':
        return '胜利！';
      case 'defeat':
        return '失败...';
      default:
        return '';
    }
  }

  // ===== 构建敌人区域 =====

  /**
   * 构建敌人区域（横向排列）
   */
  private buildEnemiesArea(): HTMLElement {
    const area = UIManager.createElement('div', 'battle-enemies-area');
    for (let i = 0; i < this.battleState.enemies.length; i++) {
      const enemy = this.battleState.enemies[i];
      if (enemy.currentHp <= 0) {
        continue; // 跳过已死亡的敌人
      }
      const enemyEl = this.buildEnemyElement(enemy, i);
      area.appendChild(enemyEl);
    }
    return area;
  }

  /**
   * 构建单个敌人元素
   */
  private buildEnemyElement(enemy: EnemyState, index: number): HTMLElement {
    const enemyEl = UIManager.createElement('div', 'battle-enemy');
    if (enemy.isBoss) {
      enemyEl.classList.add('boss');
    }

    // 敌人占位图
    const enemyData = getEnemy(enemy.dataId);
    const enemyColor = enemyData?.color ?? '#888888';
    const placeholder = PlaceholderRenderer.createEnemyPlaceholder(enemy.name, enemyColor, enemy.isBoss);
    placeholder.classList.add('battle-enemy-placeholder');
    enemyEl.appendChild(placeholder);

    // 名称
    const nameEl = UIManager.createElement('div', 'battle-enemy-name tooltip-bottom', enemy.name);
    nameEl.setAttribute('data-tooltip', `${enemy.name}${enemy.isBoss ? '（Boss）' : ''}：${enemy.currentHp}/${enemy.maxHp} HP`);
    enemyEl.appendChild(nameEl);

    // HP 条
    const hpBar = this.buildHpBar(enemy.currentHp, enemy.maxHp);
    enemyEl.appendChild(hpBar);

    // 意图显示
    const intentEl = this.buildIntentDisplay(enemy);
    enemyEl.appendChild(intentEl);

    // Buff/Debuff 图标
    const buffsEl = this.buildEnemyBuffs(enemy);
    enemyEl.appendChild(buffsEl);

    // 设置 data 属性
    enemyEl.setAttribute('data-enemy-index', String(index));

    return enemyEl;
  }

  /**
   * 构建 HP 条
   */
  private buildHpBar(current: number, max: number): HTMLElement {
    const container = UIManager.createElement('div', 'battle-hp-bar-container tooltip-bottom');
    container.setAttribute('data-tooltip', `生命值：${current} / ${max}`);
    const bar = UIManager.createElement('div', 'battle-hp-bar');
    const ratio = max > 0 ? current / max : 0;
    bar.style.width = `${ratio * 100}%`;
    if (ratio < 0.3) {
      bar.classList.add('low');
    }
    const text = UIManager.createElement('div', 'battle-hp-text', `${current}/${max}`);
    container.appendChild(bar);
    container.appendChild(text);
    return container;
  }

  /**
   * 构建敌人意图显示
   */
  private buildIntentDisplay(enemy: EnemyState): HTMLElement {
    const intent = enemy.currentIntent;
    // 根据意图类型添加不同的 CSS 类
    let intentClass = 'battle-enemy-intent tooltip-bottom';
    if (intent) {
      switch (intent.type) {
        case IntentType.Attack:
        case IntentType.AttackDebuff:
          intentClass += ' intent-attack';
          break;
        case IntentType.Defend:
          intentClass += ' intent-defend';
          break;
        case IntentType.Buff:
          intentClass += ' intent-buff';
          break;
        case IntentType.Debuff:
          intentClass += ' intent-debuff';
          break;
      }
    }

    const intentEl = UIManager.createElement('div', intentClass);
    if (!intent) {
      intentEl.textContent = '❓';
      intentEl.setAttribute('data-tooltip', '意图未知');
      return intentEl;
    }

    const icon = INTENT_ICONS[intent.type] ?? '❓';

    // 计算实际伤害值（考虑力量和虚弱）
    let displayValue = intent.value;
    if (intent.value !== undefined && (intent.type === IntentType.Attack || intent.type === IntentType.AttackDebuff)) {
      // 基础伤害 + 力量
      const strength = enemy.buffs.get(BUFFS.STRENGTH) ?? 0;
      let actualDamage = intent.value + strength;
      // 虚弱减伤（×0.75）
      const weak = enemy.debuffs.get(DEBUFFS.WEAK) ?? 0;
      if (weak > 0) {
        actualDamage = Math.floor(actualDamage * 0.75);
      }
      displayValue = actualDamage;
    }

    const valueEl = UIManager.createElement('span', 'intent-value', displayValue !== undefined ? String(displayValue) : '');
    // 根据意图类型给数值添加颜色类
    if (displayValue !== undefined) {
      if (intent.type === IntentType.Defend) {
        valueEl.classList.add('intent-value-defend');
      } else if (intent.type === IntentType.Buff) {
        valueEl.classList.add('intent-value-buff');
      }
    }
    intentEl.appendChild(UIManager.createElement('span', 'intent-icon', icon));
    intentEl.appendChild(valueEl);

    // 构建意图 tooltip 说明
    const typeName = INTENT_TYPE_NAMES[intent.type] ?? '未知';
    let tooltipText = `下回合行动：${typeName}`;
    if (displayValue !== undefined) {
      if (intent.type === IntentType.Attack || intent.type === IntentType.AttackDebuff) {
        tooltipText += `，预计造成 ${displayValue} 点伤害`;
        // 显示原始伤害和修正
        if (displayValue !== intent.value) {
          tooltipText += `（基础 ${intent.value}`;
          const strength = enemy.buffs.get(BUFFS.STRENGTH) ?? 0;
          if (strength > 0) tooltipText += ` + 力量${strength}`;
          const weak = enemy.debuffs.get(DEBUFFS.WEAK) ?? 0;
          if (weak > 0) tooltipText += `，虚弱×0.75`;
          tooltipText += `）`;
        }
      } else if (intent.type === IntentType.Defend) {
        tooltipText += `，预计获得 ${displayValue} 点护甲`;
      } else {
        tooltipText += `，数值 ${displayValue}`;
      }
    }
    if (intent.debuff) {
      const debuffInfo = DEBUFF_INFO[intent.debuff.name];
      const debuffName = debuffInfo?.name ?? intent.debuff.name;
      tooltipText += `；附加 ${debuffName} x${intent.debuff.stacks}`;
    }
    intentEl.setAttribute('data-tooltip', tooltipText);
    return intentEl;
  }

  /**
   * 构建敌人 buff/debuff 显示
   */
  private buildEnemyBuffs(enemy: EnemyState): HTMLElement {
    const buffsEl = UIManager.createElement('div', 'battle-enemy-buffs');

    // 收集所有 buff 和 debuff
    const allBuffs: Array<{ name: string; stacks: number; isDebuff: boolean }> = [];
    for (const [name, stacks] of enemy.buffs) {
      allBuffs.push({ name, stacks, isDebuff: false });
    }
    for (const [name, stacks] of enemy.debuffs) {
      allBuffs.push({ name, stacks, isDebuff: true });
    }

    for (const buff of allBuffs) {
      const icon = UIManager.createElement('div', `battle-buff-icon ${buff.isDebuff ? 'debuff' : 'buff'} tooltip-bottom`);
      icon.textContent = `${buff.stacks}`;
      icon.setAttribute('data-tooltip', getBuffTooltip(buff.name, buff.stacks, buff.isDebuff));
      buffsEl.appendChild(icon);
    }

    return buffsEl;
  }

  // ===== 构建玩家 HUD =====

  /**
   * 构建玩家 HUD
   */
  private buildPlayerHud(): HTMLElement {
    const hud = UIManager.createElement('div', 'battle-player-hud');
    const player = this.battleState.player;

    // 角色占位图
    const placeholder = PlaceholderRenderer.createCharacterPlaceholder(player.name, '#4A90D9', 64);
    placeholder.classList.add('battle-player-placeholder');
    hud.appendChild(placeholder);

    // HP
    const hpEl = UIManager.createElement('div', 'battle-player-stat tooltip', `❤️ ${player.currentHp}/${player.maxHp}`);
    hpEl.setAttribute('data-tooltip', `生命值：当前 ${player.currentHp} / 最大 ${player.maxHp}，降为 0 则战斗失败`);
    hud.appendChild(hpEl);

    // 能量
    const energyEl = UIManager.createElement('div', 'battle-player-stat tooltip', `⚡ ${player.currentEnergy}/${player.maxEnergy}`);
    energyEl.setAttribute('data-tooltip', `能量：当前 ${player.currentEnergy} / 最大 ${player.maxEnergy}，出牌消耗能量`);
    hud.appendChild(energyEl);

    // 护甲
    const blockEl = UIManager.createElement('div', 'battle-player-stat tooltip', `🛡️ ${player.block}`);
    blockEl.setAttribute('data-tooltip', `护甲：${player.block} 点，抵挡等量攻击伤害，回合开始时清零`);
    hud.appendChild(blockEl);

    // 金币
    const goldEl = UIManager.createElement('div', 'battle-player-stat tooltip', `💰 ${player.gold}`);
    goldEl.setAttribute('data-tooltip', `金币：${player.gold}，在商店中购买卡牌与服务`);
    hud.appendChild(goldEl);

    // Buffs
    const buffsEl = this.buildPlayerBuffs(player);
    hud.appendChild(buffsEl);

    return hud;
  }

  /**
   * 构建玩家 buff/debuff 显示
   */
  private buildPlayerBuffs(player: CharacterState): HTMLElement {
    const buffsEl = UIManager.createElement('div', 'battle-player-buffs');

    for (const [name, stacks] of player.buffs) {
      const icon = UIManager.createElement('div', 'battle-buff-icon buff tooltip');
      icon.textContent = `${stacks}`;
      icon.setAttribute('data-tooltip', getBuffTooltip(name, stacks, false));
      buffsEl.appendChild(icon);
    }
    for (const [name, stacks] of player.debuffs) {
      const icon = UIManager.createElement('div', 'battle-buff-icon debuff tooltip');
      icon.textContent = `${stacks}`;
      icon.setAttribute('data-tooltip', getBuffTooltip(name, stacks, true));
      buffsEl.appendChild(icon);
    }

    return buffsEl;
  }

  // ===== 构建手牌区域 =====

  /**
   * 构建手牌区域
   */
  private buildHandArea(): HTMLElement {
    const area = UIManager.createElement('div', 'battle-hand-area');
    const hand = this.battleState.deck.hand;

    for (let i = 0; i < hand.length; i++) {
      const cardId = hand[i];
      const card = getCard(cardId);
      if (!card) {
        continue;
      }
      const cardEl = this.buildCardElement(card, i);
      area.appendChild(cardEl);
    }

    return area;
  }

  /**
   * 构建单张卡牌元素
   */
  private buildCardElement(card: Card, index: number): HTMLElement {
    // 使用 PlaceholderRenderer 创建卡牌占位图
    const cardEl = PlaceholderRenderer.createCardPlaceholder(
      card.name,
      card.cost,
      this.getCardColor(card),
      card.description,
    );
    cardEl.classList.add('battle-card');

    // 检查是否可出
    const canPlay = battleManager.canPlayCard(this.battleState, index);
    if (!canPlay) {
      cardEl.classList.add('disabled');
    } else {
      cardEl.classList.add('playable');
    }

    // 设置 data 属性
    cardEl.setAttribute('data-card-index', String(index));

    // 卡牌类型标识
    const typeIcon = this.getCardTypeIcon(card.type);
    const typeEl = UIManager.createElement('div', 'battle-card-type', typeIcon);
    cardEl.appendChild(typeEl);

    // 绑定点击事件
    const handler = () => this.handleCardClick(index);
    cardEl.addEventListener('click', handler);
    this.cardClickHandlers.push({ cardEl, index, handler });

    return cardEl;
  }

  /**
   * 获取卡牌颜色
   */
  private getCardColor(card: Card): string {
    switch (card.type) {
      case CardType.Attack:
        return '#E74C3C'; // 红色
      case CardType.Skill:
        return '#3498DB'; // 蓝色
      case CardType.Power:
        return '#9B59B6'; // 紫色
      default:
        return '#95A5A6';
    }
  }

  /**
   * 获取卡牌类型图标
   */
  private getCardTypeIcon(type: CardType): string {
    switch (type) {
      case CardType.Attack:
        return '⚔️';
      case CardType.Skill:
        return '🛡️';
      case CardType.Power:
        return '✨';
      default:
        return '❓';
    }
  }

  // ===== 构建底部按钮 =====

  /**
   * 构建底部区域：回合结束按钮
   */
  private buildFooter(): HTMLElement {
    const footer = UIManager.createElement('div', 'battle-footer');
    const poolBtn = UIManager.createElement('button', 'ui-btn ui-btn-secondary', '查看牌组');
    poolBtn.addEventListener('click', () => this.showCardPoolDialog());
    footer.appendChild(poolBtn);
    const endTurnBtn = UIManager.createElement('button', 'ui-btn battle-end-turn-btn', '结束回合');
    endTurnBtn.addEventListener('click', () => this.handleEndTurn());
    footer.appendChild(endTurnBtn);
    // 计时器
    this.timerEl = UIManager.createElement('span', 'game-timer', '');
    this.updateTimerDisplay();
    footer.appendChild(this.timerEl);
    return footer;
  }

  /** 启动计时器 */
  private startTimer(): void {
    this.updateTimerDisplay();
    this.timerInterval = window.setInterval(() => this.updateTimerDisplay(), 1000);
  }

  /** 停止计时器 */
  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /** 更新计时器显示 */
  private updateTimerDisplay(): void {
    if (!this.timerEl) return;
    const ms = gameStatsManager.getCurrentGameTime();
    this.timerEl.textContent = '⏱ ' + GameStatsManager.formatTime(ms);
  }

  // ===== 事件处理 =====

  /**
   * 绑定场景相关事件
   */
  private bindEvents(): void {
    // 敌人回合自动执行
    if (this.battleState.phase === 'enemy_turn') {
      this.executeEnemyTurn();
    }
  }

  /**
   * 绑定敌人点击事件（用于选择攻击目标）
   */
  private bindEnemyClickEvents(): void {
    // 清理旧事件
    for (const { enemyEl, handler } of this.enemyClickHandlers) {
      enemyEl.removeEventListener('click', handler);
    }
    this.enemyClickHandlers = [];

    // 如果有选中的卡牌，绑定敌人点击事件
    if (this.selectedCardIndex >= 0) {
      const cardId = this.battleState.deck.hand[this.selectedCardIndex];
      const card = getCard(cardId);
      if (card && this.cardNeedsTarget(card)) {
        const enemyElements = this.root?.querySelectorAll<HTMLElement>('.battle-enemy');
        enemyElements?.forEach((enemyEl) => {
          const index = parseInt(enemyEl.getAttribute('data-enemy-index') ?? '-1', 10);
          if (index >= 0) {
            const handler = () => this.handleEnemyClick(index);
            enemyEl.addEventListener('click', handler);
            enemyEl.classList.add('targetable');
            this.enemyClickHandlers.push({ enemyEl, index, handler });
          }
        });
      }
    }
  }

  /**
   * 处理卡牌点击
   */
  private handleCardClick(handIndex: number): void {
    if (this.battleState.phase !== 'player_turn') {
      uiManager.showToast('现在不能出牌');
      return;
    }

    const canPlay = battleManager.canPlayCard(this.battleState, handIndex);
    if (!canPlay) {
      uiManager.showToast('无法出这张牌');
      return;
    }

    const cardId = this.battleState.deck.hand[handIndex];
    const card = getCard(cardId);
    if (!card) {
      return;
    }

    // 判断是否需要选择目标
    const needsTarget = this.cardNeedsTarget(card);

    if (needsTarget && this.battleState.enemies.length > 1) {
      this.selectedCardIndex = handIndex;
      uiManager.showToast('选择目标');
      this.bindEnemyClickEvents();
      this.update(); // 更新高亮显示
    } else {
      // 不需要选目标或只有一个敌人，直接出牌
      this.playCard(handIndex, 0);
    }
  }

  /**
   * 判断卡牌是否需要选择敌人目标
   */
  private cardNeedsTarget(card: Card): boolean {
    // 攻击牌需要选目标（除非是全体攻击）
    if (card.type === CardType.Attack) {
      return card.effect.special !== 'all_enemies';
    }
    // 有 applyDebuff 的技能牌需要选目标
    if (card.effect.applyDebuff) {
      return true;
    }
    return false;
  }

  /**
   * 处理敌人点击（选择攻击目标）
   */
  private handleEnemyClick(enemyIndex: number): void {
    if (this.selectedCardIndex < 0) {
      return;
    }

    const cardId = this.battleState.deck.hand[this.selectedCardIndex];
    const card = getCard(cardId);
    if (!card) {
      return;
    }

    // 验证卡牌确实需要目标
    if (!this.cardNeedsTarget(card)) {
      return;
    }

    // 出牌
    this.playCard(this.selectedCardIndex, enemyIndex);
    this.selectedCardIndex = -1;
  }

  /**
   * 出牌
   */
  private playCard(handIndex: number, targetEnemyIndex: number): void {
    const cardId = this.battleState.deck.hand[handIndex];
    const card = getCard(cardId);
    if (!card) {
      return;
    }

    const success = battleManager.playCard(this.battleState, handIndex, targetEnemyIndex);
    if (!success) {
      uiManager.showToast('出牌失败');
      return;
    }

    // 显示效果反馈
    this.showCardEffect(card, targetEnemyIndex);

    // 更新显示
    this.update();
  }

  /**
   * 显示卡牌效果反馈
   */
  private showCardEffect(card: Card, targetEnemyIndex: number): void {
    if (!this.effectArea) {
      return;
    }

    // 伤害数字动画
    if (card.effect.damage !== undefined) {
      const enemy = this.battleState.enemies[targetEnemyIndex];
      if (enemy && enemy.currentHp > 0) {
        const damageEl = UIManager.createElement('div', 'battle-damage-number');
        const actualDamage = characterManager.calculateOutgoingDamage(this.battleState.player, card.effect.damage);
        damageEl.textContent = `-${actualDamage}`;
        damageEl.style.color = '#E74C3C';

        // 定位到敌人位置
        const enemyEls = this.effectArea.parentElement?.querySelectorAll('.battle-enemy');
        const targetEnemyEl = enemyEls?.[targetEnemyIndex];
        if (targetEnemyEl) {
          const rect = targetEnemyEl.getBoundingClientRect();
          damageEl.style.left = `${rect.left + rect.width / 2}px`;
          damageEl.style.top = `${rect.top}px`;
        }

        document.body.appendChild(damageEl);
        requestAnimationFrame(() => {
          damageEl.classList.add('show');
          setTimeout(() => {
            if (damageEl.parentNode) {
              damageEl.parentNode.removeChild(damageEl);
            }
          }, 800);
        });
      }
    }

    // 护甲获得反馈
    if (card.effect.block !== undefined) {
      uiManager.showToast(`🛡️ 获得 ${card.effect.block} 点护甲`);
    }

    // 回血反馈
    if (card.effect.heal !== undefined) {
      uiManager.showToast(`❤️ 回复 ${card.effect.heal} 点生命`);
    }

    // 抽牌反馈
    if (card.effect.drawCards !== undefined) {
      uiManager.showToast(`🎴 抽 ${card.effect.drawCards} 张牌`);
    }

    // 能量反馈
    if (card.effect.gainEnergy !== undefined) {
      uiManager.showToast(`⚡ 获得 ${card.effect.gainEnergy} 点能量`);
    }
  }

  /**
   * 处理结束回合
   */
  private handleEndTurn(): void {
    if (this.battleState.phase !== 'player_turn') {
      uiManager.showToast('现在不能结束回合');
      return;
    }

    // 清除选中的卡牌
    this.selectedCardIndex = -1;

    // 结束玩家回合
    battleManager.endPlayerTurn(this.battleState);
    this.update();

    // 执行敌人回合
    this.executeEnemyTurn();
  }

  /**
   * 执行敌人回合
   * 调用 battleManager 执行完整敌人回合，并显示攻击反馈
   */
  private executeEnemyTurn(): void {
    if (this.battleState.phase !== 'enemy_turn') {
      return;
    }

    // 记录玩家初始状态，用于计算伤害
    const hpBefore = this.battleState.player.currentHp;

    // 记录每个攻击型敌人的信息（用于反馈）
    const attackersBefore = this.battleState.enemies
      .filter((e) => e.currentHp > 0 && e.currentIntent)
      .map((e) => ({
        name: e.name,
        index: this.battleState.enemies.indexOf(e),
        intentType: e.currentIntent!.type,
        intentValue: e.currentIntent!.value ?? 0,
      }))
      .filter(
        (a) => a.intentType === IntentType.Attack || a.intentType === IntentType.AttackDebuff,
      );

    // 延迟执行，让玩家看到回合切换
    setTimeout(() => {
      // 执行完整敌人回合（包含行动、debuff 递减、切换回玩家回合）
      battleManager.executeEnemyTurn(this.battleState);

      // 计算总伤害
      const totalDamage = hpBefore - this.battleState.player.currentHp;

      // 更新显示
      this.update();

      // 显示敌人攻击反馈
      if (totalDamage > 0) {
        this.showPlayerDamage(totalDamage, attackersBefore);
      } else if (attackersBefore.length > 0) {
        // 有攻击型敌人但未造成伤害（被护甲抵挡）
        uiManager.showToast('🛡️ 护甲抵挡了所有攻击', 2000);
      } else {
        // 敌人使用非攻击行动
        uiManager.showToast('敌人回合结束', 1500);
      }

      // 检查战斗是否结束
      const result = battleManager.checkBattleEnd(this.battleState);
      if (result === 'victory') {
        this.showVictoryDialog();
      } else if (result === 'defeat') {
        this.showDefeatDialog();
      }
    }, 800);
  }

  /**
   * 显示玩家受到伤害的视觉反馈
   * @param totalDamage 总伤害
   * @param attackers 攻击者信息列表
   */
  private showPlayerDamage(
    totalDamage: number,
    attackers: { name: string; index: number; intentType: IntentType; intentValue: number }[],
  ): void {
    // 在玩家 HUD 上显示伤害数字
    const playerHud = this.root?.querySelector<HTMLElement>('.battle-player-hud');
    if (playerHud) {
      const damageEl = UIManager.createElement('div', 'battle-damage-number');
      damageEl.textContent = `-${totalDamage}`;
      damageEl.style.color = '#e74c3c';
      const rect = playerHud.getBoundingClientRect();
      damageEl.style.left = `${rect.left + rect.width / 2}px`;
      damageEl.style.top = `${rect.top}px`;
      document.body.appendChild(damageEl);
      requestAnimationFrame(() => {
        damageEl.classList.add('show');
        setTimeout(() => {
          if (damageEl.parentNode) {
            damageEl.parentNode.removeChild(damageEl);
          }
        }, 1000);
      });
    }

    // 屏幕震动效果
    if (this.root) {
      this.root.classList.add('battle-shake');
      setTimeout(() => {
        this.root?.classList.remove('battle-shake');
      }, 400);
    }

    // 显示攻击者信息
    if (attackers.length > 0) {
      const attackerText = attackers.map((a) => `${a.name} ${a.intentValue}`).join('，');
      uiManager.showToast(`💥 受到攻击：${attackerText}（共 -${totalDamage} HP）`, 2500);
    }
  }

  // ===== 结算弹窗 =====

  /**
   * 显示胜利弹窗
   */
  private showVictoryDialog(): void {
    const rewards = battleManager.getRewards(this.battleState);

    const overlay = UIManager.createElement('div', 'battle-result-overlay');
    const dialog = UIManager.createElement('div', 'battle-result-dialog victory');
    const title = UIManager.createElement('div', 'battle-result-title', '🎉 战斗胜利！');
    dialog.appendChild(title);

    // 奖励显示
    const rewardsDiv = UIManager.createElement('div', 'battle-result-rewards');

    // 金币奖励
    const goldEl = UIManager.createElement('div', 'battle-result-reward-item', `💰 金币 +${rewards.gold}`);
    rewardsDiv.appendChild(goldEl);

    // 卡牌选择
    if (rewards.cardChoices.length > 0) {
      const cardsLabel = UIManager.createElement('div', 'battle-result-reward-label', '选择一张新卡牌加入牌组：');
      rewardsDiv.appendChild(cardsLabel);

      const cardsContainer = UIManager.createElement('div', 'battle-result-cards');
      for (const cardId of rewards.cardChoices) {
        const card = getCard(cardId);
        if (card) {
          const cardEl = PlaceholderRenderer.createCardPlaceholder(
            card.name,
            card.cost,
            this.getCardColor(card),
            card.description,
          );
          cardEl.classList.add('battle-result-card');
          cardEl.addEventListener('click', () => {
            // 添加卡牌到主牌组
            deckManager.addCard(this.battleState.deck, cardId);
            // 增加金币
            characterManager.addGold(this.battleState.player, rewards.gold);
            uiManager.showToast(`获得卡牌：${card.name}`, 1500);
            this.dismissResultDialog();
            this.returnToMap();
          });
          cardsContainer.appendChild(cardEl);
        }
      }
      rewardsDiv.appendChild(cardsContainer);

      // 跳过卡牌按钮
      const skipBtn = UIManager.createElement('button', 'ui-btn', '跳过卡牌');
      skipBtn.style.marginTop = '12px';
      skipBtn.addEventListener('click', () => {
        characterManager.addGold(this.battleState.player, rewards.gold);
        this.dismissResultDialog();
        this.returnToMap();
      });
      rewardsDiv.appendChild(skipBtn);
    } else {
      // 无卡牌选择，直接显示确定按钮
      const confirmBtn = UIManager.createElement('button', 'ui-btn ui-btn-primary', '继续');
      confirmBtn.addEventListener('click', () => {
        // 增加金币
        characterManager.addGold(this.battleState.player, rewards.gold);
        this.dismissResultDialog();
        this.returnToMap();
      });
      rewardsDiv.appendChild(confirmBtn);
    }

    dialog.appendChild(rewardsDiv);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  }

  /**
   * 显示失败弹窗
   */
  private showDefeatDialog(): void {
    const overlay = UIManager.createElement('div', 'battle-result-overlay');
    const dialog = UIManager.createElement('div', 'battle-result-dialog defeat');
    const title = UIManager.createElement('div', 'battle-result-title', '💀 战斗失败...');
    dialog.appendChild(title);

    const message = UIManager.createElement('div', 'battle-result-message', '你的角色倒下了...');
    dialog.appendChild(message);

    const confirmBtn = UIManager.createElement('button', 'ui-btn ui-btn-primary', '重新开始');
    confirmBtn.addEventListener('click', () => {
      this.dismissResultDialog();
      gameStateMachine.transitionTo(GameState.DEFEAT);
    });
    dialog.appendChild(confirmBtn);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  }

  /**
   * 关闭结算弹窗
   */
  private dismissResultDialog(): void {
    const overlay = document.querySelector('.battle-result-overlay');
    if (overlay && overlay.parentNode) {
      overlay.classList.remove('visible');
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 200);
    }
  }

  /**
   * 显示卡牌池弹窗
   */
  private showCardPoolDialog(): void {
    const deck = this.battleState.deck;

    // 全部：masterDeck 去重统计
    const allCardMap = new Map<string, number>();
    for (const cardId of deck.masterDeck) {
      allCardMap.set(cardId, (allCardMap.get(cardId) ?? 0) + 1);
    }
    const allCards = Array.from(allCardMap.entries())
      .map(([id, count]) => ({ card: getCard(id), count }))
      .filter((item): item is { card: Card; count: number } => item.card !== undefined);

    // 已使用：弃牌堆 + 消耗堆（本场战斗已打出的牌）
    const usedCardMap = new Map<string, number>();
    for (const cardId of deck.discardPile) {
      usedCardMap.set(cardId, (usedCardMap.get(cardId) ?? 0) + 1);
    }
    for (const cardId of deck.exhaustPile) {
      usedCardMap.set(cardId, (usedCardMap.get(cardId) ?? 0) + 1);
    }
    const usedCards = Array.from(usedCardMap.entries())
      .map(([id, count]) => ({ card: getCard(id), count }))
      .filter((item): item is { card: Card; count: number } => item.card !== undefined);

    // 未使用：抽牌堆 + 手牌（本场战斗还没打出的牌）
    const unusedCardMap = new Map<string, number>();
    for (const cardId of deck.drawPile) {
      unusedCardMap.set(cardId, (unusedCardMap.get(cardId) ?? 0) + 1);
    }
    for (const cardId of deck.hand) {
      unusedCardMap.set(cardId, (unusedCardMap.get(cardId) ?? 0) + 1);
    }
    const unusedCards = Array.from(unusedCardMap.entries())
      .map(([id, count]) => ({ card: getCard(id), count }))
      .filter((item): item is { card: Card; count: number } => item.card !== undefined);

    // 创建弹窗
    const overlay = UIManager.createElement('div', 'card-pool-overlay');
    const dialog = UIManager.createElement('div', 'card-pool-dialog');

    // 标题
    const title = UIManager.createElement('div', 'card-pool-title', '卡牌池');
    dialog.appendChild(title);

    // Tab 切换
    const tabBar = UIManager.createElement('div', 'card-pool-tabs');
    const tabs = [
      { key: 'all', label: `全部 (${allCards.length})` },
      { key: 'unused', label: `未使用 (${unusedCards.length})` },
      { key: 'used', label: `已使用 (${usedCards.length})` },
    ];
    const tabBtns: HTMLElement[] = [];
    const contentArea = UIManager.createElement('div', 'card-pool-content');

    for (const tab of tabs) {
      const btn = UIManager.createElement('button', 'card-pool-tab-btn', tab.label);
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderCardPoolTab(contentArea, tab.key, allCards, unusedCards, usedCards);
      });
      tabBar.appendChild(btn);
      tabBtns.push(btn);
    }
    dialog.appendChild(tabBar);

    // 提示
    const hint = UIManager.createElement('div', 'card-pool-hint', '提示：未使用的卡牌不按显示顺序抽取');
    dialog.appendChild(hint);

    // 内容区
    dialog.appendChild(contentArea);

    // 默认显示全部
    tabBtns[0].classList.add('active');
    this.renderCardPoolTab(contentArea, 'all', allCards, unusedCards, usedCards);

    // 关闭按钮
    const closeBtn = UIManager.createElement('button', 'ui-btn card-pool-close-btn', '关闭');
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('visible');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    });
    dialog.appendChild(closeBtn);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  /**
   * 渲染卡牌池 Tab 内容
   */
  private renderCardPoolTab(
    container: HTMLElement,
    tabKey: string,
    allCards: { card: Card; count: number }[],
    unusedCards: { card: Card; count: number }[],
    usedCards: { card: Card; count: number }[],
  ): void {
    container.innerHTML = '';

    let cards: { card: Card; count: number }[];
    let emptyText: string;

    if (tabKey === 'all') {
      cards = allCards;
      emptyText = '牌组为空';
    } else if (tabKey === 'unused') {
      cards = unusedCards;
      emptyText = '没有未使用的卡牌';
    } else {
      cards = usedCards;
      emptyText = '还没有打出卡牌';
    }

    if (cards.length === 0) {
      const empty = UIManager.createElement('div', 'card-pool-empty', emptyText);
      container.appendChild(empty);
      return;
    }

    // 按类型分组
    const groups = [
      { label: '攻击牌', type: CardType.Attack },
      { label: '技能牌', type: CardType.Skill },
      { label: '能力牌', type: CardType.Power },
    ];
    for (const group of groups) {
      const groupCards = cards.filter(c => c.card.type === group.type);
      if (groupCards.length === 0) continue;
      const groupEl = UIManager.createElement('div', 'card-pool-group');
      const groupLabel = UIManager.createElement('div', 'card-pool-group-label', group.label);
      groupEl.appendChild(groupLabel);
      const cardsRow = UIManager.createElement('div', 'card-pool-cards-row');
      for (const { card, count } of groupCards) {
        const cardEl = this.buildCardPoolCard(card, count);
        cardsRow.appendChild(cardEl);
      }
      groupEl.appendChild(cardsRow);
      container.appendChild(groupEl);
    }
  }

  /**
   * 构建卡牌池中的单张卡牌元素
   */
  private buildCardPoolCard(card: Card, count?: number): HTMLElement {
    const cardEl = PlaceholderRenderer.createCardPlaceholder(
      card.name,
      card.cost,
      this.getCardColor(card),
      card.description,
    );
    cardEl.classList.add('card-pool-card');
    if (count !== undefined && count > 1) {
      const countBadge = UIManager.createElement('div', 'card-pool-count', `x${count}`);
      cardEl.appendChild(countBadge);
    }
    return cardEl;
  }

  /**
   * 返回地图
   */
  private returnToMap(): void {
    // 清空战斗内 buff/debuff（流程/加班/核算/力量等均为战斗内效果，下场战斗清零）
    characterManager.clearCombatBuffs(this.battleState.player);

    // 标记 Boss 已击败（如果是 Boss 战），并给予升级点
    const currentNode = mapManager.getCurrentNode(this.mapState);
    if (currentNode?.isBoss) {
      mapManager.markBossDefeated(this.mapState);
      characterManager.gainUpgradePoint(this.battleState.player);
    }

    // 检查是否通关
    if (mapManager.isGameCompleted(this.mapState)) {
      gameStateMachine.transitionTo(GameState.VICTORY);
      return;
    }

    // 检查是否需要进入下一层
    if (mapManager.isCurrentFloorCompleted(this.mapState)) {
      if (mapManager.goToNextFloor(this.mapState)) {
        gameStateMachine.transitionTo(GameState.MAP);
        return;
      }
    }

    gameStateMachine.transitionTo(GameState.MAP);
  }
}

// 导入 characterManager 和 deckManager（用于奖励结算）
import { characterManager } from '../game/character-manager';
import { deckManager } from '../game/deck-manager';
import { mapManager } from '../game/map';
