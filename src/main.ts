// 上班族冒险 - 游戏主入口
// 串联所有游戏状态与 UI 场景，管理全局游戏状态与存档

import { GameState, gameStateMachine } from './core/state-machine';
import { RNG } from './core/rng';
import { CharacterClass } from './data/characters';
import { getStorySequence, getRandomEvent } from './data/story';
import { CharacterState, characterManager } from './game/character-manager';
import { DeckState, deckManager } from './game/deck-manager';
import { MapState, mapManager } from './game/map';
import { battleManager } from './game/battle';
import { saveManager } from './game/save';
import { uiManager, Scene, UIManager } from './ui/ui-manager';
import { MenuScene } from './ui/menu';
import { CharacterSelectScene } from './ui/character-select';
import { MapScene } from './ui/map-ui';
import { BattleScene } from './ui/battle-ui';
import { ShopScene } from './ui/shop';
import { RestScene } from './ui/rest';
import { DialogueScene } from './ui/dialogue';

// ===== 全局游戏状态 =====
let character: CharacterState | null = null;
let deck: DeckState | null = null;
let map: MapState | null = null;
// 使用时间戳作为随机种子（确保非 0）
let rng: RNG = new RNG((Date.now() >>> 0) || 1);

// ===== 工具函数 =====

/** 确保游戏状态已初始化，返回当前状态对象 */
function ensureState(): { character: CharacterState; deck: DeckState; map: MapState } {
  if (!character || !deck || !map) {
    throw new Error('游戏状态未初始化');
  }
  return { character, deck, map };
}

/** 自动存档：将当前游戏状态保存到 localStorage */
function autoSave(): void {
  if (character && deck && map) {
    const currentNode = mapManager.getCurrentNode(map);
    saveManager.autoSave(character, deck, map, rng, currentNode?.id ?? null);
  }
}

/** 开始新游戏：根据职业初始化角色、牌组、地图 */
function startNewGame(classId: CharacterClass): void {
  character = characterManager.createCharacter(classId);
  deck = deckManager.initDeck(classId);
  map = mapManager.initMaps(rng);
}

/** 读档恢复游戏状态 */
function loadGame(): boolean {
  const data = saveManager.loadGame();
  if (!data) return false;
  character = data.character;
  deck = data.deck;
  map = data.map;
  rng = data.rng;
  return true;
}

/** 进入战斗：根据当前节点获取敌人并初始化战斗状态 */
function startBattle(): void {
  const state = ensureState();
  const node = mapManager.getCurrentNode(state.map);
  if (!node) {
    uiManager.showToast('无法进入战斗');
    gameStateMachine.transitionTo(GameState.MAP);
    return;
  }
  const enemies = mapManager.getRoomEnemies(node, state.map.currentFloor, rng);
  if (enemies.length === 0) {
    uiManager.showToast('没有敌人');
    gameStateMachine.transitionTo(GameState.MAP);
    return;
  }
  const battleState = battleManager.initBattle(state.character, state.deck, enemies, rng);
  uiManager.switchScene(new BattleScene(battleState, state.map));
}

// ===== 结局场景 =====

/** 结局场景：通关或失败时显示，含返回主菜单按钮 */
class ResultScene implements Scene {
  private container: HTMLElement | null = null;
  private cleanups: Array<() => void> = [];

  constructor(
    private readonly titleText: string,
    private readonly message: string,
    private readonly isVictory: boolean,
  ) {}

  mount(container: HTMLElement): void {
    this.container = container;
    // 设置背景（通关用 boss 办公室背景，失败用战斗背景）
    container.className = this.isVictory ? 'scene-bg-boss_office' : 'scene-bg-battle';

    const root = UIManager.createElement('div', 'result-scene');
    root.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 40px 20px;
      box-sizing: border-box;
      text-align: center;
    `;

    const titleEl = UIManager.createElement('h1', 'result-title', this.titleText);
    titleEl.style.cssText = `
      font-size: 56px;
      color: ${this.isVictory ? '#f39c12' : '#e74c3c'};
      margin-bottom: 24px;
      text-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;

    const messageEl = UIManager.createElement('div', 'result-message', this.message);
    messageEl.style.cssText = `
      font-size: 20px;
      color: #fff;
      margin-bottom: 40px;
      max-width: 600px;
      line-height: 1.8;
    `;

    const button = UIManager.createElement('button', 'ui-btn ui-btn-primary', '返回主菜单');
    button.style.cssText = 'padding: 12px 36px; font-size: 18px;';
    const handler = (): void => {
      // 清除存档与全局状态
      saveManager.deleteSave();
      character = null;
      deck = null;
      map = null;
      gameStateMachine.transitionTo(GameState.MENU);
    };
    button.addEventListener('click', handler);
    this.cleanups.push(() => button.removeEventListener('click', handler));

    root.appendChild(titleEl);
    root.appendChild(messageEl);
    root.appendChild(button);
    container.appendChild(root);
  }

  unmount(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }
  }
}

// ===== 状态进入回调注册 =====

// MENU：显示主菜单
gameStateMachine.onEnter(GameState.MENU, () => {
  uiManager.switchScene(new MenuScene());
});

// CHARACTER_SELECT：显示角色选择界面
gameStateMachine.onEnter(GameState.CHARACTER_SELECT, () => {
  uiManager.switchScene(new CharacterSelectScene());
});

// MAP：显示地图导航
gameStateMachine.onEnter(GameState.MAP, (payload) => {
  // 新游戏：初始化角色、牌组、地图，然后显示开场剧情
  if (payload?.classId) {
    startNewGame(payload.classId);
    const gameStartStory = getStorySequence('game_start');
    if (gameStartStory) {
      const state = ensureState();
      // 切换到 EVENT 状态显示开场剧情，结束后回到 MAP
      gameStateMachine.transitionTo(GameState.EVENT, {
        story: gameStartStory,
        nextState: GameState.MAP,
        nextPayload: {},
        character: state.character,
        deck: state.deck,
      });
      return;
    }
  } else if (payload?.continue) {
    // 继续游戏：从存档恢复
    if (!loadGame()) {
      uiManager.showToast('读档失败');
      gameStateMachine.transitionTo(GameState.MENU);
      return;
    }
  }

  // 自动存档（覆盖新游戏后、读档后、从房间返回等情况）
  autoSave();

  // 显示地图场景
  const state = ensureState();
  uiManager.switchScene(new MapScene(state.map, state.character, state.deck, rng));
});

// BATTLE：战斗
gameStateMachine.onEnter(GameState.BATTLE, (payload) => {
  // 跳过剧情（Boss 剧情结束后），直接开始战斗
  if (payload?.skipStory) {
    startBattle();
    return;
  }

  const state = ensureState();
  const node = mapManager.getCurrentNode(state.map);

  // Boss 战：先显示 Boss 剧情，再开始战斗
  if (node?.isBoss) {
    const trigger = mapManager.getRoomStoryTrigger(node);
    if (trigger) {
      const story = getStorySequence(trigger);
      if (story) {
        // 切换到 EVENT 状态显示 Boss 剧情，结束后回到 BATTLE
        gameStateMachine.transitionTo(GameState.EVENT, {
          story,
          nextState: GameState.BATTLE,
          nextPayload: { skipStory: true },
          character: state.character,
          deck: state.deck,
        });
        return;
      }
    }
  }

  // 普通战斗：直接开始
  startBattle();
});

// REST：休息站
gameStateMachine.onEnter(GameState.REST, (payload) => {
  if (!payload) {
    gameStateMachine.transitionTo(GameState.MAP);
    return;
  }
  const state = ensureState();
  // 补充 RestScene 所需的 payload 字段
  payload.character = state.character;
  payload.deck = state.deck;
  payload.map = state.map;
  uiManager.switchScene(new RestScene());
});

// SHOP：商店
gameStateMachine.onEnter(GameState.SHOP, (payload) => {
  if (!payload) {
    gameStateMachine.transitionTo(GameState.MAP);
    return;
  }
  const state = ensureState();
  // 补充 ShopScene 所需的 payload 字段
  payload.character = state.character;
  payload.deck = state.deck;
  payload.map = state.map;
  payload.rng = rng;
  uiManager.switchScene(new ShopScene());
});

// EVENT：对话/随机事件
gameStateMachine.onEnter(GameState.EVENT, (payload) => {
  // 已有 story（开场/Boss/结局剧情），直接显示对话场景
  if (payload?.story) {
    uiManager.switchScene(new DialogueScene());
    return;
  }

  // 随机事件：从池中随机选取事件并补充 payload
  if (payload?.nodeId) {
    const state = ensureState();
    const event = getRandomEvent(rng);
    payload.story = event;
    payload.nextState = GameState.MAP;
    payload.nextPayload = {};
    payload.character = state.character;
    payload.deck = state.deck;
    uiManager.switchScene(new DialogueScene());
  }
});

// VICTORY：通关结局
gameStateMachine.onEnter(GameState.VICTORY, (payload) => {
  // 剧情已显示，展示结局画面
  if (payload?.skipStory) {
    uiManager.switchScene(
      new ResultScene('🎉 通关！', '恭喜你成功晋升为 CEO，职场冒险圆满结束！', true),
    );
    return;
  }

  // 先显示通关剧情，再展示结局画面
  const state = ensureState();
  const victoryStory = getStorySequence('victory');
  if (victoryStory) {
    gameStateMachine.transitionTo(GameState.EVENT, {
      story: victoryStory,
      nextState: GameState.VICTORY,
      nextPayload: { skipStory: true },
      character: state.character,
      deck: state.deck,
    });
  } else {
    uiManager.switchScene(
      new ResultScene('🎉 通关！', '恭喜你成功晋升为 CEO，职场冒险圆满结束！', true),
    );
  }
});

// DEFEAT：失败结局
gameStateMachine.onEnter(GameState.DEFEAT, (payload) => {
  // 剧情已显示，展示失败画面
  if (payload?.skipStory) {
    uiManager.switchScene(
      new ResultScene('💀 失败', '你的角色倒下了，职业生涯暂时告一段落...', false),
    );
    return;
  }

  // 先显示失败剧情，再展示失败画面
  const state = ensureState();
  const defeatStory = getStorySequence('defeat');
  if (defeatStory) {
    gameStateMachine.transitionTo(GameState.EVENT, {
      story: defeatStory,
      nextState: GameState.DEFEAT,
      nextPayload: { skipStory: true },
      character: state.character,
      deck: state.deck,
    });
  } else {
    uiManager.switchScene(
      new ResultScene('💀 失败', '你的角色倒下了，职业生涯暂时告一段落...', false),
    );
  }
});

// ===== 启动游戏 =====
console.log('Office Adventure 启动中...');
// 触发初始 MENU 状态，显示主菜单
gameStateMachine.transitionTo(GameState.MENU);
