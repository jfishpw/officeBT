// 事件总线：实现发布订阅机制，用于模块间解耦通信
// 支持订阅（on）、取消订阅（off）、发布（emit）和清空（clear）

type EventHandler = (...args: any[]) => void;

export class EventBus {
  // 内部维护事件名到处理器列表的映射
  private handlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理器
   */
  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  /**
   * 取消订阅事件
   * @param event 事件名称
   * @param handler 事件处理器（需与订阅时传入的引用一致）
   */
  off(event: string, handler: EventHandler): void {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
      // 若该事件已无任何处理器，则清理掉空集合
      if (set.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * 发布事件，依次调用所有订阅该事件的处理器
   * @param event 事件名称
   * @param args 传递给处理器的参数
   */
  emit(event: string, ...args: any[]): void {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    // 复制一份避免在回调中修改集合导致迭代异常
    const listeners = Array.from(set);
    for (const handler of listeners) {
      try {
        handler(...args);
      } catch (err) {
        // 单个处理器异常不应影响其他处理器执行
        console.error(`[EventBus] 事件 "${event}" 的处理器执行出错:`, err);
      }
    }
  }

  /**
   * 清空所有事件订阅
   */
  clear(): void {
    this.handlers.clear();
  }
}

// 导出全局单例，供各模块共享使用
export const eventBus = new EventBus();
