// UI 管理器：负责场景切换、容器管理与浮动提示/确认对话框
// 通过操作 index.html 中的 <div id="app"> 来显示界面
// 所有 DOM 操作使用标准 Web API，不依赖任何第三方 UI 库

import { eventBus } from '../core/event-bus';

/**
 * UI 场景接口：所有界面场景（菜单/战斗/地图等）需实现此接口
 */
export interface Scene {
  /** 挂载到容器，构建 DOM */
  mount(container: HTMLElement): void;
  /** 卸载，清理 DOM 与事件监听 */
  unmount(): void;
  /** 可选：场景数据更新 */
  update?(data?: any): void;
}

/**
 * UI 管理器
 * - 维护当前场景实例
 * - 提供场景切换、容器清空、DOM 元素创建等基础能力
 * - 提供浮动提示（toast）与确认对话框（confirm）
 */
export class UIManager {
  /** #app 根容器 */
  private container: HTMLElement;
  /** 当前挂载的场景 */
  private currentScene: Scene | null = null;
  /** 当前显示的 toast 元素，便于在切换场景时清理 */
  private activeToast: HTMLElement | null = null;
  /** 当前显示的确认对话框元素 */
  private activeConfirm: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * 切换场景：先卸载当前场景，清空容器，再挂载新场景
   * @param scene 新场景实例
   */
  switchScene(scene: Scene): void {
    // 1. 卸载旧场景
    if (this.currentScene) {
      try {
        this.currentScene.unmount();
      } catch (err) {
        console.error('[UIManager] 旧场景卸载出错:', err);
      }
    }

    // 2. 清空容器与浮动元素
    this.clear();
    this.dismissToast();
    this.dismissConfirm();

    // 3. 挂载新场景
    this.currentScene = scene;
    try {
      scene.mount(this.container);
    } catch (err) {
      console.error('[UIManager] 新场景挂载出错:', err);
    }

    // 4. 广播场景切换事件，便于其他模块响应
    eventBus.emit('ui:scene-switched', scene);
  }

  /**
   * 获取当前场景
   */
  getCurrentScene(): Scene | null {
    return this.currentScene;
  }

  /**
   * 创建 DOM 元素辅助方法
   * @param tag 标签名
   * @param className 可选类名
   * @param text 可选文本内容
   */
  static createElement(tag: string, className?: string, text?: string): HTMLElement {
    const el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (text !== undefined && text !== null) {
      el.textContent = text;
    }
    return el;
  }

  /**
   * 清空容器内容
   */
  clear(): void {
    this.container.innerHTML = '';
  }

  /**
   * 显示浮动提示消息
   * @param message 提示文本
   * @param duration 显示时长（毫秒），默认 2000ms
   */
  showToast(message: string, duration: number = 2000): void {
    // 若已有 toast，先移除避免堆叠
    this.dismissToast();

    const toast = UIManager.createElement('div', 'ui-toast', message);
    // 插入到 body 以脱离场景容器，避免被 clear() 清掉
    document.body.appendChild(toast);
    this.activeToast = toast;

    // 触发进入动画
    requestAnimationFrame(() => {
      toast.classList.add('ui-toast-visible');
    });

    // 定时移除
    window.setTimeout(() => {
      this.dismissToast();
    }, duration);
  }

  /**
   * 内部：移除当前 toast
   */
  private dismissToast(): void {
    if (!this.activeToast) {
      return;
    }
    const toast = this.activeToast;
    this.activeToast = null;
    toast.classList.remove('ui-toast-visible');
    toast.classList.add('ui-toast-leaving');
    // 等待动画结束后移除节点
    window.setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  }

  /**
   * 显示确认对话框
   * @param message 提示文本
   * @param onConfirm 确认回调
   * @param onCancel 取消回调（可选）
   */
  showConfirm(message: string, onConfirm: () => void, onCancel?: () => void): void {
    // 若已有对话框，先关闭
    this.dismissConfirm();

    const overlay = UIManager.createElement('div', 'ui-confirm-overlay');
    const dialog = UIManager.createElement('div', 'ui-confirm-dialog');
    const msg = UIManager.createElement('div', 'ui-confirm-message', message);
    const btnGroup = UIManager.createElement('div', 'ui-confirm-buttons');

    const confirmBtn = UIManager.createElement('button', 'ui-btn ui-btn-primary', '确认');
    const cancelBtn = UIManager.createElement('button', 'ui-btn ui-btn-secondary', '取消');

    const close = (result: boolean) => {
      this.dismissConfirm();
      if (result) {
        onConfirm();
      } else if (onCancel) {
        onCancel();
      }
    };

    confirmBtn.addEventListener('click', () => close(true));
    cancelBtn.addEventListener('click', () => close(false));
    // 点击遮罩层视为取消
    overlay.addEventListener('click', (e: MouseEvent) => {
      if (e.target === overlay) {
        close(false);
      }
    });

    btnGroup.appendChild(cancelBtn);
    btnGroup.appendChild(confirmBtn);
    dialog.appendChild(msg);
    dialog.appendChild(btnGroup);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    this.activeConfirm = overlay;

    // 触发进入动画
    requestAnimationFrame(() => {
      overlay.classList.add('ui-confirm-visible');
    });
  }

  /**
   * 内部：移除当前确认对话框
   */
  private dismissConfirm(): void {
    if (!this.activeConfirm) {
      return;
    }
    const overlay = this.activeConfirm;
    this.activeConfirm = null;
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
}

/**
 * 全局 UI 管理器单例
 * 模块加载时自动初始化，使用 document.getElementById('app') 作为容器
 * 若容器不存在则抛出错误（index.html 必须包含 <div id="app">）
 */
const appContainer = document.getElementById('app');
if (!appContainer) {
  throw new Error('[UIManager] 未找到 #app 容器，请确认 index.html 包含 <div id="app">');
}
export const uiManager = new UIManager(appContainer);
