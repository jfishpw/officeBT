// 商店场景：玩家可以使用金币购买卡牌或移除卡牌
import { Scene, UIManager, uiManager } from './ui-manager';
import { SceneManager, PlaceholderRenderer } from './scene';
import { gameStateMachine, GameState } from '../core/state-machine';
import { eventBus } from '../core/event-bus';
import { CharacterState } from '../game/character-manager';
import { DeckState, deckManager } from '../game/deck-manager';
import { MapState } from '../game/map';
import { Card, CardRarity, getCard, getCardsByRarity } from '../data/cards';
import { DIFFICULTY_CURVE } from '../data/levels';
import { RNG } from '../core/rng';

interface ShopPayload {
  character: CharacterState;
  deck: DeckState;
  map: MapState;
  rng: RNG;
}

// 稀有度颜色映射
const RARITY_COLORS: Record<CardRarity, string> = {
  [CardRarity.Common]: '#7f8c8d',   // 灰色
  [CardRarity.Rare]: '#3498db',      // 蓝色
  [CardRarity.Epic]: '#9b59b6',     // 紫色
  [CardRarity.Legendary]: '#f39c12', // 金色
};

// 稀有度基础价格
const RARITY_BASE_PRICES: Record<CardRarity, number> = {
  [CardRarity.Common]: 50,
  [CardRarity.Rare]: 100,
  [CardRarity.Epic]: 200,
  [CardRarity.Legendary]: 400,
};

// 移除卡牌价格
const REMOVE_CARD_PRICE = 75;

// 稀有度权重（用于随机生成）
const RARITY_WEIGHTS: Array<{ rarity: CardRarity; weight: number }> = [
  { rarity: CardRarity.Common, weight: 60 },
  { rarity: CardRarity.Rare, weight: 25 },
  { rarity: CardRarity.Epic, weight: 12 },
  { rarity: CardRarity.Legendary, weight: 3 },
];

export class ShopScene implements Scene {
  private container: HTMLElement | null = null;
  private payload!: ShopPayload;
  private shopItems: Card[] = [];
  private rng!: RNG;
  private eventListeners: Array<{ event: string; handler: (...args: any[]) => void }> = [];

  mount(container: HTMLElement): void {
    this.container = container;
    this.payload = gameStateMachine.getPayload() as ShopPayload;
    this.rng = this.payload.rng;

    // 设置背景
    SceneManager.setBackground('meeting_room');

    // 生成商店商品（3张随机卡牌）
    this.generateShopItems();

    // 渲染界面
    this.render();

    // 注册事件监听
    this.registerEventListeners();
  }

  unmount(): void {
    // 清理事件监听
    this.unregisterEventListeners();
    this.container = null;
  }

  update?(data?: any): void {
    // 如果有数据更新，重新获取状态
    if (data) {
      this.payload = data as ShopPayload;
    }
  }

  private registerEventListeners(): void {
    const handler = () => {
      // 存档自动保存
      const payload = gameStateMachine.getPayload() as ShopPayload;
      if (payload && payload.character && payload.deck && payload.map) {
        // 场景切换时自动存档
      }
    };
    eventBus.on('ui:scene-switched', handler);
    this.eventListeners.push({ event: 'ui:scene-switched', handler });
  }

  private unregisterEventListeners(): void {
    for (const { event, handler } of this.eventListeners) {
      eventBus.off(event, handler);
    }
    this.eventListeners = [];
  }

  private generateShopItems(): void {
    this.shopItems = [];
    const currentFloor = this.payload.map.currentFloor;
    const difficultyParams = DIFFICULTY_CURVE[currentFloor - 1];

    // 根据权重选择稀有度
    for (let i = 0; i < 3; i++) {
      const rarity = this.pickRarity();
      const cardsOfRarity = getCardsByRarity(rarity);
      if (cardsOfRarity.length > 0) {
        const card = this.rng.pick(cardsOfRarity);
        this.shopItems.push(card);
      }
    }
  }

  private pickRarity(): CardRarity {
    const totalWeight = RARITY_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.rng.nextInt(0, totalWeight - 1);

    for (const item of RARITY_WEIGHTS) {
      roll -= item.weight;
      if (roll < 0) {
        return item.rarity;
      }
    }

    return CardRarity.Common;
  }

  private getCardPrice(card: Card): number {
    const basePrice = RARITY_BASE_PRICES[card.rarity];
    const currentFloor = this.payload.map.currentFloor;
    const difficultyParams = DIFFICULTY_CURVE[currentFloor - 1];
    return Math.ceil(basePrice * difficultyParams.shopPriceMultiplier);
  }

  private render(): void {
    if (!this.container) return;

    const { character } = this.payload;

    // 创建主容器
    const shopContainer = document.createElement('div');
    shopContainer.className = 'shop-scene';
    shopContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
      min-height: 100vh;
      box-sizing: border-box;
    `;

    // 标题
    const title = UIManager.createElement('h1', 'shop-title', '商店');
    title.style.cssText = `
      font-size: 32px;
      color: var(--color-text);
      margin-bottom: 20px;
      text-shadow: 0 2px 4px rgba(255,255,255,0.8);
    `;

    // 金币显示
    const goldDisplay = UIManager.createElement('div', 'shop-gold');
    goldDisplay.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 24px;
      font-weight: bold;
      color: var(--color-warning);
      margin-bottom: 30px;
      background: rgba(255,255,255,0.8);
      padding: 10px 20px;
      border-radius: var(--radius-md);
    `;
    goldDisplay.innerHTML = `💰 ${character.gold} 金币`;

    // 卡牌商品区域
    const cardsContainer = UIManager.createElement('div', 'shop-cards');
    cardsContainer.style.cssText = `
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      justify-content: center;
      margin-bottom: 30px;
    `;

    // 渲染每张卡牌
    for (let i = 0; i < this.shopItems.length; i++) {
      const card = this.shopItems[i];
      const price = this.getCardPrice(card);
      const canAfford = character.gold >= price;

      const cardElement = this.createShopCard(card, price, canAfford, i);
      cardsContainer.appendChild(cardElement);
    }

    // 移除卡牌区域
    const removeSection = this.createRemoveSection();

    // 离开按钮
    const leaveBtn = UIManager.createElement('button', 'ui-btn ui-btn-secondary', '离开商店');
    leaveBtn.style.cssText = 'margin-top: 20px;';
    leaveBtn.addEventListener('click', () => this.leaveShop());

    shopContainer.appendChild(title);
    shopContainer.appendChild(goldDisplay);
    shopContainer.appendChild(cardsContainer);
    shopContainer.appendChild(removeSection);
    shopContainer.appendChild(leaveBtn);

    this.container.appendChild(shopContainer);
  }

  private createShopCard(card: Card, price: number, canAfford: boolean, index: number): HTMLElement {
    const cardWrapper = UIManager.createElement('div', 'shop-card-item');
    cardWrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    `;

    // 使用 PlaceholderRenderer 创建卡牌
    const rarityColor = RARITY_COLORS[card.rarity];
    const cardElement = PlaceholderRenderer.createCardPlaceholder(
      card.name,
      card.cost,
      rarityColor,
      card.description
    );

    // 价格标签
    const priceLabel = UIManager.createElement('div', 'shop-card-price');
    priceLabel.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      color: ${canAfford ? 'var(--color-warning)' : 'var(--color-danger)'};
    `;
    priceLabel.innerHTML = `💰 ${price}`;

    // 购买按钮
    const buyBtn = UIManager.createElement('button', 'ui-btn ui-btn-primary', '购买');
    (buyBtn as HTMLButtonElement).disabled = !canAfford;
    if (!canAfford) {
      buyBtn.style.filter = 'grayscale(0.5)';
      buyBtn.style.cursor = 'not-allowed';
    }
    buyBtn.addEventListener('click', () => this.buyCard(card, price));

    cardWrapper.appendChild(cardElement);
    cardWrapper.appendChild(priceLabel);
    cardWrapper.appendChild(buyBtn);

    return cardWrapper;
  }

  private createRemoveSection(): HTMLElement {
    const section = UIManager.createElement('div', 'shop-remove-section');
    section.style.cssText = `
      background: rgba(255,255,255,0.7);
      padding: 20px;
      border-radius: var(--radius-lg);
      text-align: center;
      margin-bottom: 20px;
    `;

    const title = UIManager.createElement('h3', '', '移除卡牌');
    title.style.cssText = `
      font-size: 20px;
      color: var(--color-text);
      margin-bottom: 10px;
    `;

    const desc = UIManager.createElement('p', '', `从主牌组移除一张卡牌（${REMOVE_CARD_PRICE} 金币）`);
    desc.style.cssText = `
      font-size: 14px;
      color: var(--color-text-light);
      margin-bottom: 15px;
    `;

    const { character, deck } = this.payload;
    const canAfford = character.gold >= REMOVE_CARD_PRICE;
    const hasCards = deck.masterDeck.length > 0;

    const removeBtn = UIManager.createElement('button', 'ui-btn ui-btn-danger', '移除卡牌');
    (removeBtn as HTMLButtonElement).disabled = !canAfford || !hasCards;
    if (!canAfford || !hasCards) {
      removeBtn.style.filter = 'grayscale(0.5)';
      removeBtn.style.cursor = 'not-allowed';
    }
    removeBtn.addEventListener('click', () => this.showRemoveDialog());

    section.appendChild(title);
    section.appendChild(desc);
    section.appendChild(removeBtn);

    return section;
  }

  private showRemoveDialog(): void {
    const { deck, character } = this.payload;

    if (deck.masterDeck.length === 0) {
      uiManager.showToast('主牌组为空，无法移除卡牌');
      return;
    }

    // 创建卡牌选择对话框
    const overlay = UIManager.createElement('div', 'remove-card-overlay');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    const dialog = UIManager.createElement('div', 'remove-card-dialog');
    dialog.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: var(--radius-lg);
      max-width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
    `;

    const title = UIManager.createElement('h3', '', '选择要移除的卡牌');
    title.style.cssText = 'margin-bottom: 16px; text-align: center;';

    const cardsContainer = UIManager.createElement('div', 'remove-cards-grid');
    cardsContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
      margin-bottom: 20px;
    `;

    // 获取主牌组中的卡牌（去重显示）
    const uniqueCards = new Map<string, number>();
    for (const cardId of deck.masterDeck) {
      const count = uniqueCards.get(cardId) ?? 0;
      uniqueCards.set(cardId, count + 1);
    }

    for (const [cardId, count] of uniqueCards) {
      const card = getCard(cardId);
      if (!card) continue;

      const cardElement = UIManager.createElement('div', 'remove-card-option');
      cardElement.style.cssText = `
        cursor: pointer;
        padding: 8px;
        border: 2px solid transparent;
        border-radius: var(--radius-md);
        transition: all 0.2s;
      `;

      const rarityColor = RARITY_COLORS[card.rarity];
      const placeholderCard = PlaceholderRenderer.createCardPlaceholder(
        card.name,
        card.cost,
        rarityColor,
        card.description
      );

      const countLabel = UIManager.createElement('div', '', `x${count}`);
      countLabel.style.cssText = 'text-align: center; font-size: 12px; color: var(--color-text-light);';

      cardElement.appendChild(placeholderCard);
      cardElement.appendChild(countLabel);

      cardElement.addEventListener('click', () => {
        this.removeCard(cardId, count);
        overlay.remove();
      });

      cardElement.addEventListener('mouseenter', () => {
        cardElement.style.borderColor = 'var(--color-primary)';
      });
      cardElement.addEventListener('mouseleave', () => {
        cardElement.style.borderColor = 'transparent';
      });

      cardsContainer.appendChild(cardElement);
    }

    const cancelBtn = UIManager.createElement('button', 'ui-btn ui-btn-secondary', '取消');
    cancelBtn.addEventListener('click', () => overlay.remove());
    cancelBtn.style.cssText = 'display: block; margin: 0 auto;';

    dialog.appendChild(title);
    dialog.appendChild(cardsContainer);
    dialog.appendChild(cancelBtn);
    overlay.appendChild(dialog);

    document.body.appendChild(overlay);
  }

  private buyCard(card: Card, price: number): void {
    const { character, deck } = this.payload;

    if (character.gold < price) {
      uiManager.showToast('金币不足！');
      return;
    }

    // 扣除金币
    character.gold -= price;

    // 添加卡牌到主牌组
    deck.masterDeck.push(card.id);

    uiManager.showToast(`购买了 ${card.name}！`);

    // 重新渲染
    this.rerender();
  }

  private removeCard(cardId: string, count: number): void {
    const { character, deck } = this.payload;

    if (character.gold < REMOVE_CARD_PRICE) {
      uiManager.showToast('金币不足！');
      return;
    }

    // 扣除金币
    character.gold -= REMOVE_CARD_PRICE;

    // 移除卡牌（只移除一张）
    deckManager.removeCard(deck, cardId);

    const card = getCard(cardId);
    uiManager.showToast(`移除了 ${card?.name ?? cardId}！`);

    // 重新渲染
    this.rerender();
  }

  private rerender(): void {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.render();
  }

  private leaveShop(): void {
    gameStateMachine.transitionTo(GameState.MAP);
  }
}
