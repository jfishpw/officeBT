// 休息场景：玩家可以休息回血或升级卡牌
import { Scene, UIManager, uiManager } from './ui-manager';
import { SceneManager } from './scene';
import { gameStateMachine, GameState } from '../core/state-machine';
import { CharacterState, characterManager } from '../game/character-manager';
import { DeckState, deckManager } from '../game/deck-manager';
import { MapState } from '../game/map';
import { Card, getCard, getUpgradedCard } from '../data/cards';
import { DIFFICULTY_CURVE } from '../data/levels';

interface RestPayload {
  character: CharacterState;
  deck: DeckState;
  map: MapState;
}

export class RestScene implements Scene {
  private container: HTMLElement | null = null;
  private payload!: RestPayload;

  mount(container: HTMLElement): void {
    this.container = container;
    this.payload = gameStateMachine.getPayload() as RestPayload;

    // 设置背景
    SceneManager.setBackground('office');

    // 渲染界面
    this.render();
  }

  unmount(): void {
    this.container = null;
  }

  update?(data?: any): void {
    if (data) {
      this.payload = data as RestPayload;
    }
  }

  private render(): void {
    if (!this.container) return;

    const { character, map } = this.payload;
    const currentFloor = map.currentFloor;
    const difficultyParams = DIFFICULTY_CURVE[currentFloor - 1];
    const healAmount = Math.ceil(difficultyParams.restHealPercent * character.maxHp);

    // 创建主容器
    const restContainer = UIManager.createElement('div', 'rest-scene');
    restContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
      min-height: 100vh;
      box-sizing: border-box;
    `;

    // 标题
    const title = UIManager.createElement('h1', 'rest-title', '休息站');
    title.style.cssText = `
      font-size: 32px;
      color: var(--color-text);
      margin-bottom: 30px;
      text-shadow: 0 2px 4px rgba(255,255,255,0.8);
    `;

    // HP 显示
    const hpDisplay = UIManager.createElement('div', 'rest-hp-display');
    hpDisplay.style.cssText = `
      background: rgba(255,255,255,0.8);
      padding: 20px 40px;
      border-radius: var(--radius-lg);
      margin-bottom: 30px;
      text-align: center;
    `;

    const hpText = UIManager.createElement('div', 'rest-hp-text');
    hpText.style.cssText = `
      font-size: 28px;
      font-weight: bold;
      color: var(--color-danger);
    `;
    hpText.textContent = `${character.currentHp} / ${character.maxHp} HP`;

    const hpBar = UIManager.createElement('div', 'rest-hp-bar');
    hpBar.style.cssText = `
      width: 200px;
      height: 12px;
      background: #e0e0e0;
      border-radius: 6px;
      margin-top: 10px;
      overflow: hidden;
    `;

    const hpFill = UIManager.createElement('div', 'rest-hp-fill');
    const hpPercent = (character.currentHp / character.maxHp) * 100;
    hpFill.style.cssText = `
      width: ${hpPercent}%;
      height: 100%;
      background: linear-gradient(90deg, #e74c3c, #c0392b);
      border-radius: 6px;
      transition: width 0.3s ease;
    `;

    hpBar.appendChild(hpFill);
    hpDisplay.appendChild(hpText);
    hpDisplay.appendChild(hpBar);

    // 选项区域
    const optionsContainer = UIManager.createElement('div', 'rest-options');
    optionsContainer.style.cssText = `
      display: flex;
      gap: 30px;
      flex-wrap: wrap;
      justify-content: center;
    `;

    // 休息选项
    const restOption = this.createRestOption(healAmount);
    optionsContainer.appendChild(restOption);

    // 升级卡牌选项
    const upgradeOption = this.createUpgradeOption();
    optionsContainer.appendChild(upgradeOption);

    // 离开按钮
    const leaveBtn = UIManager.createElement('button', 'ui-btn ui-btn-secondary', '离开');
    leaveBtn.style.cssText = 'margin-top: 30px;';
    leaveBtn.addEventListener('click', () => this.leaveRest());

    restContainer.appendChild(title);
    restContainer.appendChild(hpDisplay);
    restContainer.appendChild(optionsContainer);
    restContainer.appendChild(leaveBtn);

    this.container.appendChild(restContainer);
  }

  private createRestOption(healAmount: number): HTMLElement {
    const option = UIManager.createElement('div', 'rest-option');
    option.style.cssText = `
      background: rgba(255,255,255,0.9);
      padding: 24px;
      border-radius: var(--radius-lg);
      text-align: center;
      min-width: 200px;
      box-shadow: var(--shadow-soft);
    `;

    const icon = UIManager.createElement('div', 'rest-option-icon');
    icon.style.cssText = 'font-size: 48px; margin-bottom: 12px;';
    icon.textContent = '🛏️';

    const name = UIManager.createElement('h3', '', '休息');
    name.style.cssText = 'font-size: 20px; color: var(--color-text); margin-bottom: 8px;';

    const desc = UIManager.createElement('p', '', `回复 ${healAmount} 点生命`);
    desc.style.cssText = 'font-size: 14px; color: var(--color-text-light); margin-bottom: 16px;';

    const restBtn = UIManager.createElement('button', 'ui-btn ui-btn-primary', '休息');
    restBtn.addEventListener('click', () => this.doRest(healAmount));

    option.appendChild(icon);
    option.appendChild(name);
    option.appendChild(desc);
    option.appendChild(restBtn);

    return option;
  }

  private createUpgradeOption(): HTMLElement {
    const { deck, character } = this.payload;

    // 找出可升级的卡牌
    const upgradeableCards: Array<{ cardId: string; card: Card }> = [];
    const uniqueCardIds = new Set<string>();

    for (const cardId of deck.masterDeck) {
      if (uniqueCardIds.has(cardId)) continue;

      const card = getCard(cardId);
      if (!card) continue;

      // 检查是否有升级版且未升级
      if (card.upgradedId && !deck.upgradedCards.has(cardId)) {
        upgradeableCards.push({ cardId, card });
        uniqueCardIds.add(cardId);
      }
    }

    const hasUpgradeableCards = upgradeableCards.length > 0;

    const option = UIManager.createElement('div', 'upgrade-option');
    option.style.cssText = `
      background: rgba(255,255,255,0.9);
      padding: 24px;
      border-radius: var(--radius-lg);
      text-align: center;
      min-width: 200px;
      box-shadow: var(--shadow-soft);
    `;

    const icon = UIManager.createElement('div', 'upgrade-option-icon');
    icon.style.cssText = 'font-size: 48px; margin-bottom: 12px;';
    icon.textContent = '⬆️';

    const name = UIManager.createElement('h3', '', '升级卡牌');
    name.style.cssText = 'font-size: 20px; color: var(--color-text); margin-bottom: 8px;';

    const desc = UIManager.createElement('p', '', '升级主牌组中的一张卡');
    desc.style.cssText = 'font-size: 14px; color: var(--color-text-light); margin-bottom: 16px;';

    const upgradeBtn = UIManager.createElement('button', 'ui-btn ui-btn-accent', '升级');
    (upgradeBtn as HTMLButtonElement).disabled = !hasUpgradeableCards;
    if (!hasUpgradeableCards) {
      upgradeBtn.style.filter = 'grayscale(0.5)';
      upgradeBtn.style.cursor = 'not-allowed';
    }
    upgradeBtn.addEventListener('click', () => {
      if (hasUpgradeableCards) {
        this.showUpgradeDialog(upgradeableCards);
      }
    });

    option.appendChild(icon);
    option.appendChild(name);
    option.appendChild(desc);
    option.appendChild(upgradeBtn);

    return option;
  }

  private showUpgradeDialog(upgradeableCards: Array<{ cardId: string; card: Card }>): void {
    const { deck } = this.payload;

    // 创建对话框
    const overlay = UIManager.createElement('div', 'upgrade-overlay');
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

    const dialog = UIManager.createElement('div', 'upgrade-dialog');
    dialog.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: var(--radius-lg);
      max-width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
    `;

    const title = UIManager.createElement('h3', '', '选择要升级的卡牌');
    title.style.cssText = 'margin-bottom: 16px; text-align: center;';

    const cardsContainer = UIManager.createElement('div', 'upgrade-cards-grid');
    cardsContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
      margin-bottom: 20px;
    `;

    for (const { cardId, card } of upgradeableCards) {
      const upgradedCard = getUpgradedCard(cardId);
      if (!upgradedCard) continue;

      const cardElement = UIManager.createElement('div', 'upgrade-card-option');
      cardElement.style.cssText = `
        cursor: pointer;
        padding: 8px;
        border: 2px solid transparent;
        border-radius: var(--radius-md);
        transition: all 0.2s;
      `;

      // 显示基础卡信息
      const baseCardEl = UIManager.createElement('div', 'card-base');
      baseCardEl.style.cssText = 'margin-bottom: 8px;';
      baseCardEl.textContent = `${card.name} → ${upgradedCard.name}`;

      const baseDesc = UIManager.createElement('div', 'card-desc');
      baseDesc.style.cssText = 'font-size: 12px; color: var(--color-text-light);';
      baseDesc.textContent = card.description;

      cardElement.appendChild(baseCardEl);
      cardElement.appendChild(baseDesc);

      cardElement.addEventListener('click', () => {
        this.upgradeCard(cardId);
        overlay.remove();
      });

      cardElement.addEventListener('mouseenter', () => {
        cardElement.style.borderColor = 'var(--color-accent)';
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

  private doRest(healAmount: number): void {
    const { character } = this.payload;

    const actualHeal = characterManager.heal(character, healAmount);
    uiManager.showToast(`休息完成，回复了 ${actualHeal} 点生命！`);

    // 短暂延迟后返回地图
    setTimeout(() => {
      gameStateMachine.transitionTo(GameState.MAP);
    }, 1000);
  }

  private upgradeCard(cardId: string): void {
    const { deck, character } = this.payload;

    // 检查是否有升级点
    if (character.upgradePoints <= 0) {
      uiManager.showToast('没有升级点数！');
      return;
    }

    // 升级卡牌
    const success = deckManager.upgradeCard(deck, cardId);
    if (success) {
      character.upgradePoints -= 1;
      const card = getCard(cardId);
      const upgradedCard = getUpgradedCard(cardId);
      uiManager.showToast(`${card?.name} 已升级为 ${upgradedCard?.name}！`);
    } else {
      uiManager.showToast('升级失败！');
    }

    // 短暂延迟后返回地图
    setTimeout(() => {
      gameStateMachine.transitionTo(GameState.MAP);
    }, 1000);
  }

  private leaveRest(): void {
    gameStateMachine.transitionTo(GameState.MAP);
  }
}
