// 游戏状态机：管理游戏各状态之间的流转
// 切换状态时通过事件总线广播 state:exit 与 state:enter 事件
// 同时支持注册状态进入/退出回调，便于各模块响应状态变化

import { eventBus } from './event-bus';

// 游戏所有可能的状态
export enum GameState {
  MENU = 'MENU', // 主菜单
  CHARACTER_SELECT = 'CHARACTER_SELECT', // 角色选择
  MAP = 'MAP', // 地图导航
  BATTLE = 'BATTLE', // 战斗
  EVENT = 'EVENT', // 随机事件
  SHOP = 'SHOP', // 商店
  REST = 'REST', // 休息
  VICTORY = 'VICTORY', // 胜利
  DEFEAT = 'DEFEAT', // 失败
  PAUSE = 'PAUSE', // 暂停
}

// 状态切换时携带的负载数据
type StatePayload = any;
// 状态进入/退出回调签名
type StateCallback = (payload?: StatePayload) => void;

export class GameStateMachine {
  // 当前状态
  private currentState: GameState;
  // 当前状态对应的负载
  private currentPayload: StatePayload;
  // 各状态的进入回调列表
  private enterCallbacks: Map<GameState, Set<StateCallback>> = new Map();
  // 各状态的退出回调列表
  private exitCallbacks: Map<GameState, Set<StateCallback>> = new Map();

  constructor() {
    // 默认从主菜单开始
    this.currentState = GameState.MENU;
    this.currentPayload = undefined;
  }

  /**
   * 切换到目标状态
   * 切换前 emit 'state:exit' 事件并执行当前状态的退出回调
   * 切换后 emit 'state:enter' 事件并执行目标状态的进入回调
   * @param state 目标状态
   * @param payload 携带的负载数据
   */
  transitionTo(state: GameState, payload?: StatePayload): void {
    // 若目标状态与当前状态相同，则仅更新负载并触发进入事件
    const fromState = this.currentState;

    // 1. 触发当前状态的退出流程
    eventBus.emit('state:exit', fromState, state, this.currentPayload);
    this.invokeCallbacks(this.exitCallbacks.get(fromState), this.currentPayload);

    // 2. 更新状态
    this.currentState = state;
    this.currentPayload = payload;

    // 3. 触发目标状态的进入流程
    eventBus.emit('state:enter', state, fromState, payload);
    this.invokeCallbacks(this.enterCallbacks.get(state), payload);
  }

  /**
   * 获取当前状态
   */
  getCurrentState(): GameState {
    return this.currentState;
  }

  /**
   * 获取当前状态携带的负载
   */
  getPayload(): StatePayload {
    return this.currentPayload;
  }

  /**
   * 注册某状态的进入回调
   * @param state 监听的状态
   * @param callback 进入该状态时执行的回调
   */
  onEnter(state: GameState, callback: StateCallback): void {
    this.addCallback(this.enterCallbacks, state, callback);
  }

  /**
   * 注册某状态的退出回调
   * @param state 监听的状态
   * @param callback 离开该状态时执行的回调
   */
  onExit(state: GameState, callback: StateCallback): void {
    this.addCallback(this.exitCallbacks, state, callback);
  }

  /**
   * 内部：向回调映射表中添加回调
   */
  private addCallback(
    map: Map<GameState, Set<StateCallback>>,
    state: GameState,
    callback: StateCallback,
  ): void {
    if (!map.has(state)) {
      map.set(state, new Set());
    }
    map.get(state)!.add(callback);
  }

  /**
   * 内部：依次触发回调集合中的所有回调
   */
  private invokeCallbacks(set: Set<StateCallback> | undefined, payload?: StatePayload): void {
    if (!set || set.size === 0) {
      return;
    }
    // 复制一份避免回调中修改集合导致迭代异常
    const callbacks = Array.from(set);
    for (const cb of callbacks) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[GameStateMachine] 状态回调执行出错:`, err);
      }
    }
  }
}

// 导出全局单例
export const gameStateMachine = new GameStateMachine();
