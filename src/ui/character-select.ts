// 角色选择场景
// 实现 Scene 接口，在 unmount 中清理事件监听器

import { Scene, UIManager, uiManager } from './ui-manager';
import { PlaceholderRenderer, SceneManager } from './scene';
import { GameState, gameStateMachine } from '../core/state-machine';
import { CHARACTERS, CharacterData } from '../data/characters';

/**
 * 角色选择场景
 * - 顶部标题"选择你的职业"
 * - 四个职业卡片（文员/操作工/体系/IT），使用主题色边框
 * - 点击卡片弹出确认对话框，确认后进入地图
 */
export class CharacterSelectScene implements Scene {
  /** 挂载容器引用，unmount 时用于清空 */
  private container: HTMLElement | null = null;
  /** 事件清理函数列表，unmount 时统一调用以移除监听 */
  private cleanups: Array<() => void> = [];

  mount(container: HTMLElement): void {
    this.container = container;
    // 设置办公室背景
    SceneManager.setBackground('office');

    // 场景根容器
    const root = UIManager.createElement('div', 'character-select-scene');

    // ===== 顶部标题 =====
    const title = UIManager.createElement('h2', 'character-select-title', '选择你的职业');
    root.appendChild(title);

    // ===== 职业卡片区域 =====
    const cardRow = UIManager.createElement('div', 'character-cards');
    for (const character of CHARACTERS) {
      cardRow.appendChild(this.createCharacterCard(character));
    }
    root.appendChild(cardRow);

    container.appendChild(root);
  }

  unmount(): void {
    // 移除所有事件监听
    for (const cleanup of this.cleanups) {
      cleanup();
    }
    this.cleanups = [];
    // 清空容器内容
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }

  /**
   * 创建单张职业卡片
   * 包含：占位图、名称、称号、描述、基础属性（HP/能量/金币）、主题色边框
   * @param character 角色数据
   * @returns 卡片 DOM 元素
   */
  private createCharacterCard(character: CharacterData): HTMLElement {
    // 卡片容器，使用角色主题色作为边框色
    const card = UIManager.createElement('div', 'character-card');
    card.style.borderColor = character.color;

    // 角色占位图
    const portrait = PlaceholderRenderer.createCharacterPlaceholder(
      character.name,
      character.color,
      80,
    );
    card.appendChild(portrait);

    // 职业名称
    const nameEl = UIManager.createElement('div', 'character-card-name', character.name);
    card.appendChild(nameEl);

    // 职业称号
    const titleEl = UIManager.createElement('div', 'character-card-title', character.title);
    card.appendChild(titleEl);

    // 职业描述
    const descEl = UIManager.createElement('div', 'character-card-desc', character.description);
    card.appendChild(descEl);

    // 基础属性（HP/能量/金币）
    const stats = UIManager.createElement('div', 'character-card-stats');
    stats.appendChild(UIManager.createElement('span', 'stat-item', `HP: ${character.stats.maxHp}`));
    stats.appendChild(
      UIManager.createElement('span', 'stat-item', `能量: ${character.stats.startingEnergy}`),
    );
    stats.appendChild(
      UIManager.createElement('span', 'stat-item', `金币: ${character.stats.startingGold}`),
    );
    card.appendChild(stats);

    // 点击卡片弹出确认对话框
    this.bindClick(card, () => {
      uiManager.showConfirm(`选择 ${character.name} 开始冒险？`, () => {
        gameStateMachine.transitionTo(GameState.MAP, { classId: character.id });
      });
    });

    return card;
  }

  /**
   * 绑定点击事件并记录清理函数，便于 unmount 时移除监听
   * @param el 目标元素
   * @param handler 点击回调
   */
  private bindClick(el: HTMLElement, handler: () => void): void {
    el.addEventListener('click', handler);
    this.cleanups.push(() => el.removeEventListener('click', handler));
  }
}
