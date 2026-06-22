// 主菜单场景
// 实现 Scene 接口，在 unmount 中清理事件监听器

import { Scene, UIManager, uiManager } from './ui-manager';
import { SceneManager } from './scene';
import { GameState, gameStateMachine } from '../core/state-machine';
import { saveManager } from '../game/save';

/**
 * 主菜单场景
 * - 游戏标题与副标题
 * - "开始冒险"按钮：新游戏，清空存档后进入角色选择
 * - "继续"按钮：如有存档则进入角色选择，否则显示 toast 提示
 */
export class MenuScene implements Scene {
  /** 挂载容器引用，unmount 时用于清空 */
  private container: HTMLElement | null = null;
  /** 事件清理函数列表，unmount 时统一调用以移除监听 */
  private cleanups: Array<() => void> = [];

  mount(container: HTMLElement): void {
    this.container = container;
    // 设置主菜单背景
    SceneManager.setBackground('menu');

    // 场景根容器
    const root = UIManager.createElement('div', 'menu-scene');

    // ===== 标题区域 =====
    const titleWrap = UIManager.createElement('div', 'menu-title');
    const title = UIManager.createElement('h1', 'menu-title-main', '上班族冒险');
    const subtitle = UIManager.createElement('h2', 'menu-title-sub', '卡牌策略游戏');
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);
    root.appendChild(titleWrap);

    // ===== 按钮区域 =====
    const btnGroup = UIManager.createElement('div', 'menu-buttons');

    // 开始冒险（新游戏）：清空存档后进入角色选择
    const newGameBtn = UIManager.createElement('button', 'ui-btn ui-btn-primary', '开始冒险');
    this.bindClick(newGameBtn, () => {
      if (saveManager.hasSave()) {
        saveManager.deleteSave();
      }
      gameStateMachine.transitionTo(GameState.CHARACTER_SELECT);
    });

    // 继续：有存档则进入地图，无存档则提示
    const continueBtn = UIManager.createElement('button', 'ui-btn ui-btn-secondary', '继续');
    this.bindClick(continueBtn, () => {
      if (saveManager.hasSave()) {
        gameStateMachine.transitionTo(GameState.MAP, { continue: true });
      } else {
        uiManager.showToast('暂无存档', 2000);
      }
    });

    btnGroup.appendChild(newGameBtn);
    btnGroup.appendChild(continueBtn);
    root.appendChild(btnGroup);

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
   * 绑定点击事件并记录清理函数，便于 unmount 时移除监听
   * @param el 目标元素
   * @param handler 点击回调
   */
  private bindClick(el: HTMLElement, handler: () => void): void {
    el.addEventListener('click', handler);
    this.cleanups.push(() => el.removeEventListener('click', handler));
  }
}
