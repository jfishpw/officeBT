// 地图界面：可视化当前楼层的节点与连接，支持节点导航与房间状态切换
// 使用 DOM 渲染，flexbox 布局节点（row 0 在底部，Boss 在顶部），SVG 绘制连线

import { Scene, UIManager, uiManager } from './ui-manager';
import { SceneManager, PlaceholderRenderer } from './scene';
import { GameState, gameStateMachine } from '../core/state-machine';
import {
  RoomNode,
  RoomType,
  ROOM_TYPE_NAMES,
  ROOM_TYPE_ICONS,
} from '../data/levels';
import { MapState, mapManager } from '../game/map';
import { CharacterState } from '../game/character-manager';
import { DeckState } from '../game/deck-manager';
import { RNG } from '../core/rng';
import { saveManager } from '../game/save';
import { Card, CardType, CardRarity, ALL_CARDS, getCard } from '../data/cards';
import { gameStatsManager, GameStatsManager } from '../game/game-stats';
import { characterManager } from '../game/character-manager';
import { deckManager } from '../game/deck-manager';
import { getCharacter } from '../data/characters';

// 楼层对应的场景背景
const FLOOR_BACKGROUNDS: Record<number, 'office' | 'meeting_room' | 'boss_office'> = {
  1: 'office',
  2: 'meeting_room',
  3: 'office',
  4: 'boss_office',
};

// 楼层显示名
const FLOOR_NAMES: Record<number, string> = {
  1: '办公室',
  2: '会议室',
  3: '办公区',
  4: '领导办公室',
};

/**
 * 地图场景
 * 展示当前楼层的节点地图，支持节点导航与房间状态切换
 */
export class MapScene implements Scene {
  /** 根容器 */
  private root: HTMLElement | null = null;
  /** 地图区域元素（便于刷新） */
  private mapArea: HTMLElement | null = null;
  /** 地图状态 */
  private mapState: MapState;
  /** 角色状态 */
  private characterState: CharacterState;
  /** 牌组状态（用于存档） */
  private deckState: DeckState;
  /** 随机数生成器（用于存档） */
  private rng: RNG;
  /** 计时器更新间隔 ID */
  private timerInterval: number | null = null;
  /** 计时器显示元素 */
  private timerEl: HTMLElement | null = null;

  constructor(
    mapState: MapState,
    characterState: CharacterState,
    deckState: DeckState,
    rng: RNG,
  ) {
    this.mapState = mapState;
    this.characterState = characterState;
    this.deckState = deckState;
    this.rng = rng;
  }

  /** 挂载场景，构建 DOM */
  mount(container: HTMLElement): void {
    // 设置场景背景
    const floor = this.mapState.currentFloor;
    SceneManager.setBackground(FLOOR_BACKGROUNDS[floor] ?? 'office');

    // 构建根容器
    const root = UIManager.createElement('div', 'map-scene');
    this.root = root;

    // 顶部 HUD
    root.appendChild(this.buildHud());

    // 中央地图区域
    this.mapArea = this.buildMapArea();
    root.appendChild(this.mapArea);

    // 底部按钮
    root.appendChild(this.buildFooter());

    container.appendChild(root);

    // 启动计时器
    this.startTimer();
  }

  /** 卸载场景，清理 DOM */
  unmount(): void {
    this.stopTimer();
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
    this.mapArea = null;
  }

  /** 数据更新时刷新地图与 HUD */
  update(): void {
    if (!this.root) {
      return;
    }
    // 刷新 HUD
    const oldHud = this.root.querySelector<HTMLElement>('.map-hud');
    if (oldHud) {
      this.root.replaceChild(this.buildHud(), oldHud);
    }
    // 重建地图区域
    if (this.mapArea) {
      const newMapArea = this.buildMapArea();
      this.root.replaceChild(newMapArea, this.mapArea);
      this.mapArea = newMapArea;
    }
  }

  // ===== 构建 HUD =====

  /**
   * 构建顶部 HUD：楼层、角色名、HP、金币
   */
  private buildHud(): HTMLElement {
    const hud = UIManager.createElement('div', 'map-hud');
    const floor = this.mapState.currentFloor;
    const floorName = FLOOR_NAMES[floor] ?? '未知楼层';
    const char = this.characterState;

    const floorEl = UIManager.createElement(
      'div',
      'map-hud-floor',
      `第 ${floor} 层 - ${floorName}`,
    );
    const nameEl = UIManager.createElement('div', 'map-hud-name', char.name);
    const hpEl = UIManager.createElement(
      'div',
      'map-hud-hp',
      `❤️ ${char.currentHp}/${char.maxHp}`,
    );
    const goldEl = UIManager.createElement('div', 'map-hud-gold', `💰 ${char.gold}`);

    hud.appendChild(floorEl);
    hud.appendChild(nameEl);
    hud.appendChild(hpEl);
    hud.appendChild(goldEl);
    return hud;
  }

  // ===== 构建地图区域 =====

  /**
   * 构建中央地图区域
   * - 使用 flexbox column-reverse 从下往上排列行（row 0 在底部）
   * - 每行内使用 flexbox 水平分布节点
   * - SVG 覆盖层绘制节点间连线
   */
  private buildMapArea(): HTMLElement {
    const map = this.mapState.currentMap;
    const availableNodes = mapManager.getAvailableNodes(this.mapState);
    const availableIds = new Set(availableNodes.map((n) => n.id));
    const currentNode = mapManager.getCurrentNode(this.mapState);
    const currentId = currentNode?.id ?? null;

    const area = UIManager.createElement('div', 'map-area');

    // SVG 连线层（绝对定位覆盖整个地图区域）
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('map-connections');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    area.appendChild(svg);

    // 按 row 分组节点
    const rowsMap = new Map<number, RoomNode[]>();
    for (const node of map.nodes) {
      const arr = rowsMap.get(node.row);
      if (arr) {
        arr.push(node);
      } else {
        rowsMap.set(node.row, [node]);
      }
    }

    // 按 row 升序排序（column-reverse 会将首行放到底部）
    const sortedRows = Array.from(rowsMap.keys()).sort((a, b) => a - b);

    // 行容器：flex-direction: column-reverse 使 row 0 在底部
    const rowsContainer = UIManager.createElement('div', 'map-rows');
    for (const row of sortedRows) {
      const nodes = rowsMap.get(row)!;
      // 行内按 col 排序
      nodes.sort((a, b) => a.col - b.col);
      const rowEl = UIManager.createElement('div', 'map-row');
      for (const node of nodes) {
        rowEl.appendChild(this.buildNodeElement(node, availableIds, currentId));
      }
      rowsContainer.appendChild(rowEl);
    }
    area.appendChild(rowsContainer);

    // 渲染后测量节点位置并绘制连线
    requestAnimationFrame(() => this.drawConnections(svg, area));

    return area;
  }

  /**
   * 构建单个节点元素
   * @param node 房间节点
   * @param availableIds 可前往节点 id 集合
   * @param currentId 当前节点 id
   */
  private buildNodeElement(
    node: RoomNode,
    availableIds: Set<string>,
    currentId: string | null,
  ): HTMLElement {
    const nodeEl = UIManager.createElement('button', 'map-node');
    nodeEl.setAttribute('data-node-id', node.id);

    // 图标
    const icon = UIManager.createElement('div', 'map-node-icon', ROOM_TYPE_ICONS[node.type]);
    // 类型名
    const name = UIManager.createElement('div', 'map-node-name', ROOM_TYPE_NAMES[node.type]);
    nodeEl.appendChild(icon);
    nodeEl.appendChild(name);

    // 状态类名
    if (node.isBoss) {
      nodeEl.classList.add('boss');
    }
    if (node.visited || this.mapState.visitedNodes.has(node.id)) {
      nodeEl.classList.add('visited');
    }
    if (node.id === currentId) {
      nodeEl.classList.add('current');
    }
    if (availableIds.has(node.id)) {
      nodeEl.classList.add('available');
      // 绑定点击事件
      nodeEl.addEventListener('click', () => this.handleNodeClick(node));
    } else {
      // 不可前往的节点禁用点击
      (nodeEl as HTMLButtonElement).disabled = true;
    }

    return nodeEl;
  }

  /**
   * 渲染后测量节点位置，绘制 SVG 连线
   * 使用 offsetTop/offsetLeft 获取相对地图区域的位置，避免滚动错位
   * @param svg SVG 元素
   * @param area 地图区域容器
   */
  private drawConnections(svg: SVGSVGElement, area: HTMLElement): void {
    // 容器尚未布局，跳过
    const contentWidth = area.scrollWidth;
    const contentHeight = area.scrollHeight;
    if (contentWidth === 0 || contentHeight === 0) {
      return;
    }

    // SVG 覆盖整个可滚动内容区域（而非仅可视区域）
    svg.setAttribute('width', String(contentWidth));
    svg.setAttribute('height', String(contentHeight));
    svg.setAttribute('viewBox', `0 0 ${contentWidth} ${contentHeight}`);

    // 收集所有节点中心位置（相对地图区域左上角）
    // 使用 offsetLeft/offsetTop 避免滚动时 getBoundingClientRect 偏移
    const nodeElements = area.querySelectorAll<HTMLElement>('.map-node');
    const positions = new Map<string, { x: number; y: number }>();
    for (const el of nodeElements) {
      const nodeId = el.getAttribute('data-node-id');
      if (!nodeId) {
        continue;
      }
      // 累加 offset 链直到 map-area，确保相对位置正确
      let x = 0;
      let y = 0;
      let current: HTMLElement | null = el as HTMLElement;
      while (current && current !== area) {
        x += current.offsetLeft;
        y += current.offsetTop;
        current = current.offsetParent as HTMLElement | null;
      }
      x += el.offsetWidth / 2;
      y += el.offsetHeight / 2;
      positions.set(nodeId, { x, y });
    }

    // 绘制连线
    const map = this.mapState.currentMap;
    for (const node of map.nodes) {
      const from = positions.get(node.id);
      if (!from) {
        continue;
      }
      for (const targetId of node.connections) {
        const to = positions.get(targetId);
        if (!to) {
          continue;
        }
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(from.x));
        line.setAttribute('y1', String(from.y));
        line.setAttribute('x2', String(to.x));
        line.setAttribute('y2', String(to.y));
        // 两端均已访问的连线使用高亮样式
        const target = map.nodes.find((n) => n.id === targetId);
        if (node.visited && target?.visited) {
          line.classList.add('map-line', 'map-line-visited');
        } else {
          line.classList.add('map-line');
        }
        svg.appendChild(line);
      }
    }
  }

  // ===== 构建底部按钮 =====

  /**
   * 构建底部"保存并退出"按钮
   */
  private buildFooter(): HTMLElement {
    const footer = UIManager.createElement('div', 'map-footer');
    const poolBtn = UIManager.createElement('button', 'ui-btn ui-btn-secondary', '查看牌组');
    poolBtn.addEventListener('click', () => this.showCardPoolDialog());
    footer.appendChild(poolBtn);
    const saveBtn = UIManager.createElement(
      'button',
      'ui-btn ui-btn-secondary',
      '保存并退出',
    );
    saveBtn.addEventListener('click', () => this.handleSaveAndExit());
    footer.appendChild(saveBtn);
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

  // ===== 节点交互 =====

  /**
   * 点击可前往节点：显示确认提示
   */
  private handleNodeClick(node: RoomNode): void {
    const typeName = ROOM_TYPE_NAMES[node.type];
    uiManager.showConfirm(`前往「${typeName}」？`, () => this.enterRoom(node));
  }

  /**
   * 选择节点并根据房间类型切换游戏状态
   * - Battle/Elite/Boss → 战斗
   * - Rest → 休息
   * - Shop → 商店
   * - Event → 事件
   * - Treasure → 显示提示后回到地图
   */
  private enterRoom(node: RoomNode): void {
    const selected = mapManager.selectNode(this.mapState, node.id);
    if (!selected) {
      uiManager.showToast('无法前往该节点');
      return;
    }

    switch (node.type) {
      case RoomType.Battle:
      case RoomType.Elite:
      case RoomType.Boss:
        // 战斗类房间（含 Boss 战）
        gameStateMachine.transitionTo(GameState.BATTLE, { nodeId: node.id });
        break;
      case RoomType.Rest:
        gameStateMachine.transitionTo(GameState.REST, { nodeId: node.id });
        break;
      case RoomType.Shop:
        gameStateMachine.transitionTo(GameState.SHOP, { nodeId: node.id });
        break;
      case RoomType.Event:
        gameStateMachine.transitionTo(GameState.EVENT, { nodeId: node.id });
        break;
      case RoomType.Treasure:
        // 宝藏房：给予金币奖励 + 卡牌选择
        this.showTreasureDialog();
        break;
      default:
        // 未知类型，刷新地图
        this.update();
        break;
    }
  }

  // ===== 宝藏房间 =====

  /**
   * 显示宝藏奖励弹窗
   * 给予金币奖励（按楼层递增）+ 一张卡牌选择（稀有度优于普通战斗）
   */
  private showTreasureDialog(): void {
    const floor = this.mapState.currentFloor;
    // 金币奖励：基础 30 + 楼层 * 10，加少量随机
    const goldReward = 30 + floor * 10 + this.rng.nextInt(0, 10);

    // 生成 3 张卡牌供选择（稀有度优于普通战斗：普通40%/稀有35%/史诗20%/传说5%）
    const character = getCharacter(this.characterState.classId);
    const poolIds = new Set<string>(character.cardPool);
    const pool = ALL_CARDS.filter((c) => poolIds.has(c.id));
    const byRarity = new Map<CardRarity, Card[]>([
      [CardRarity.Common, pool.filter((c) => c.rarity === CardRarity.Common)],
      [CardRarity.Rare, pool.filter((c) => c.rarity === CardRarity.Rare)],
      [CardRarity.Epic, pool.filter((c) => c.rarity === CardRarity.Epic)],
      [CardRarity.Legendary, pool.filter((c) => c.rarity === CardRarity.Legendary)],
    ]);

    const cardChoices: string[] = [];
    for (let i = 0; i < 3; i++) {
      const roll = this.rng.next();
      let rarity: CardRarity;
      if (roll < 0.4) {
        rarity = CardRarity.Common;
      } else if (roll < 0.75) {
        rarity = CardRarity.Rare;
      } else if (roll < 0.95) {
        rarity = CardRarity.Epic;
      } else {
        rarity = CardRarity.Legendary;
      }
      let cardsOfRarity = byRarity.get(rarity) ?? [];
      if (cardsOfRarity.length === 0) {
        cardsOfRarity = byRarity.get(CardRarity.Common) ?? pool;
      }
      if (cardsOfRarity.length > 0) {
        const card = this.rng.pick(cardsOfRarity);
        // 避免重复
        if (!cardChoices.includes(card.id)) {
          cardChoices.push(card.id);
        }
      }
    }

    // 构建弹窗
    const overlay = UIManager.createElement('div', 'battle-result-overlay');
    const dialog = UIManager.createElement('div', 'battle-result-dialog victory');
    const title = UIManager.createElement('div', 'battle-result-title', '💰 发现宝藏！');
    dialog.appendChild(title);

    const rewardsDiv = UIManager.createElement('div', 'battle-result-rewards');
    const goldEl = UIManager.createElement('div', 'battle-result-reward-item', `💰 金币 +${goldReward}`);
    rewardsDiv.appendChild(goldEl);

    if (cardChoices.length > 0) {
      const cardsLabel = UIManager.createElement('div', 'battle-result-reward-label', '选择一张卡牌加入牌组：');
      rewardsDiv.appendChild(cardsLabel);

      const cardsContainer = UIManager.createElement('div', 'battle-result-cards');
      for (const cardId of cardChoices) {
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
            deckManager.addCard(this.deckState, cardId);
            characterManager.addGold(this.characterState, goldReward);
            uiManager.showToast(`获得卡牌：${card.name}，金币 +${goldReward}`, 1500);
            this.dismissTreasureDialog(overlay);
            this.update();
          });
          cardsContainer.appendChild(cardEl);
        }
      }
      rewardsDiv.appendChild(cardsContainer);

      // 跳过卡牌按钮（仅获得金币）
      const skipBtn = UIManager.createElement('button', 'ui-btn', '只要金币');
      skipBtn.style.marginTop = '12px';
      skipBtn.addEventListener('click', () => {
        characterManager.addGold(this.characterState, goldReward);
        uiManager.showToast(`金币 +${goldReward}`, 1500);
        this.dismissTreasureDialog(overlay);
        this.update();
      });
      rewardsDiv.appendChild(skipBtn);
    } else {
      const confirmBtn = UIManager.createElement('button', 'ui-btn ui-btn-primary', '继续');
      confirmBtn.addEventListener('click', () => {
        characterManager.addGold(this.characterState, goldReward);
        this.dismissTreasureDialog(overlay);
        this.update();
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

  /** 关闭宝藏弹窗 */
  private dismissTreasureDialog(overlay: HTMLElement): void {
    overlay.classList.remove('visible');
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 200);
  }

  /** 保存并退出到主菜单 */
  private handleSaveAndExit(): void {
    uiManager.showConfirm('是否保存并退出到主菜单？', () => {
      // 保存当前游戏状态
      const currentNode = mapManager.getCurrentNode(this.mapState);
      saveManager.autoSave(
        this.characterState,
        this.deckState,
        this.mapState,
        this.rng,
        currentNode?.id ?? null,
      );
      gameStateMachine.transitionTo(GameState.MENU);
    });
  }

  // ===== 卡牌池弹窗 =====

  private showCardPoolDialog(): void {
    // 地图场景没有战斗，只显示已获得的所有卡牌
    const allCardMap = new Map<string, number>();
    for (const cardId of this.deckState.masterDeck) {
      allCardMap.set(cardId, (allCardMap.get(cardId) ?? 0) + 1);
    }
    const allCards = Array.from(allCardMap.entries())
      .map(([id, count]) => ({ card: getCard(id), count }))
      .filter((item): item is { card: Card; count: number } => item.card !== undefined);

    // 创建弹窗
    const overlay = UIManager.createElement('div', 'card-pool-overlay');
    const dialog = UIManager.createElement('div', 'card-pool-dialog');

    // 标题
    const title = UIManager.createElement('div', 'card-pool-title', `我的牌组 (${this.deckState.masterDeck.length} 张)`);
    dialog.appendChild(title);

    // 内容区
    const contentArea = UIManager.createElement('div', 'card-pool-content');

    if (allCards.length === 0) {
      const empty = UIManager.createElement('div', 'card-pool-empty', '牌组为空');
      contentArea.appendChild(empty);
    } else {
      // 按类型分组
      const groups = [
        { label: '攻击牌', type: CardType.Attack },
        { label: '技能牌', type: CardType.Skill },
        { label: '能力牌', type: CardType.Power },
      ];
      for (const group of groups) {
        const groupCards = allCards.filter(c => c.card.type === group.type);
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
        contentArea.appendChild(groupEl);
      }
    }

    dialog.appendChild(contentArea);

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

  private getCardColor(card: Card): string {
    switch (card.type) {
      case CardType.Attack: return '#E74C3C';
      case CardType.Skill: return '#3498DB';
      case CardType.Power: return '#9B59B6';
      default: return '#95A5A6';
    }
  }

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
}
