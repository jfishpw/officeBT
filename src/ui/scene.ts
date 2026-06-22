// 场景与占位图形绘制
// 使用 CSS + emoji 创建卡通风格的占位图形，不依赖图片资源
// 包含：角色/敌人/卡牌占位图，以及办公室/会议室/领导办公室等场景背景

import { uiManager } from './ui-manager';

/**
 * 场景背景类型
 */
export type SceneBackgroundType = 'office' | 'meeting_room' | 'boss_office' | 'battle' | 'menu';

/**
 * 占位图形绘制器：用 CSS 创建卡通风格的占位图形
 * 所有方法均为静态，返回独立的 DOM 元素，由调用方负责挂载
 */
export class PlaceholderRenderer {
  /**
   * 创建角色占位图（圆形头像 + 标签）
   * @param name 角色名称（用于匹配 emoji 与显示标签）
   * @param color 角色主题色
   * @param size 头像尺寸（像素），默认 96
   */
  static createCharacterPlaceholder(name: string, color: string, size: number = 96): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'placeholder-character';
    wrapper.style.setProperty('--ph-color', color);
    wrapper.style.setProperty('--ph-size', `${size}px`);

    // 圆形头像容器
    const avatar = document.createElement('div');
    avatar.className = 'placeholder-character-avatar';
    avatar.style.width = `${size}px`;
    avatar.style.height = `${size}px`;
    avatar.style.backgroundColor = color;
    avatar.textContent = PlaceholderRenderer.pickCharacterEmoji(name);

    // 名称标签
    const label = document.createElement('div');
    label.className = 'placeholder-character-label';
    label.textContent = name;

    wrapper.appendChild(avatar);
    wrapper.appendChild(label);
    return wrapper;
  }

  /**
   * 创建敌人占位图（方形 + 表情）
   * @param name 敌人名称（用于匹配 emoji 与显示标签）
   * @param color 敌人主题色
   * @param isBoss 是否为 Boss（影响尺寸与边框）
   */
  static createEnemyPlaceholder(name: string, color: string, isBoss: boolean = false): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'placeholder-enemy';
    if (isBoss) {
      wrapper.classList.add('placeholder-enemy-boss');
    }
    wrapper.style.setProperty('--ph-color', color);

    // 方形头像容器
    const avatar = document.createElement('div');
    avatar.className = 'placeholder-enemy-avatar';
    avatar.style.backgroundColor = color;
    avatar.textContent = PlaceholderRenderer.pickEnemyEmoji(name, isBoss);

    // 名称标签
    const label = document.createElement('div');
    label.className = 'placeholder-enemy-label';
    label.textContent = name;

    wrapper.appendChild(avatar);
    wrapper.appendChild(label);
    return wrapper;
  }

  /**
   * 创建卡牌占位图
   * @param name 卡牌名称
   * @param cost 卡牌费用
   * @param color 卡牌主题色
   * @param description 卡牌描述
   */
  static createCardPlaceholder(
    name: string,
    cost: number,
    color: string,
    description: string,
  ): HTMLElement {
    const card = document.createElement('div');
    card.className = 'placeholder-card';
    card.style.setProperty('--ph-color', color);

    // 顶部费用
    const costEl = document.createElement('div');
    costEl.className = 'placeholder-card-cost';
    costEl.textContent = String(cost);

    // 中间名称
    const nameEl = document.createElement('div');
    nameEl.className = 'placeholder-card-name';
    nameEl.textContent = name;

    // 底部描述
    const descEl = document.createElement('div');
    descEl.className = 'placeholder-card-desc';
    descEl.textContent = description;

    card.appendChild(costEl);
    card.appendChild(nameEl);
    card.appendChild(descEl);
    return card;
  }

  /**
   * 创建场景背景
   * @param sceneType 场景类型
   */
  static createSceneBackground(
    sceneType: 'office' | 'meeting_room' | 'boss_office' | 'battle',
  ): HTMLElement {
    const bg = document.createElement('div');
    bg.className = `scene-background scene-background-${sceneType}`;

    // 根据场景类型添加装饰元素
    switch (sceneType) {
      case 'office': {
        // 办公桌线条装饰
        const desk = document.createElement('div');
        desk.className = 'scene-decor scene-decor-desk';
        bg.appendChild(desk);
        break;
      }
      case 'meeting_room': {
        // 会议桌装饰
        const table = document.createElement('div');
        table.className = 'scene-decor scene-decor-table';
        bg.appendChild(table);
        break;
      }
      case 'boss_office': {
        // 豪华装饰线条
        const frame = document.createElement('div');
        frame.className = 'scene-decor scene-decor-frame';
        bg.appendChild(frame);
        break;
      }
      case 'battle': {
        // 战斗氛围粒子
        const aura = document.createElement('div');
        aura.className = 'scene-decor scene-decor-aura';
        bg.appendChild(aura);
        break;
      }
    }

    return bg;
  }

  /**
   * 内部：根据角色名称匹配 emoji
   * 文员 🧑‍💼 / 操作工 🛡️ / 体系 📋 / 数据 📊 / 安全员 🦺 / IT 👨‍💻，默认 🧑‍💼
   */
  private static pickCharacterEmoji(name: string): string {
    if (name.includes('IT') || name.includes('it') || name.includes('工程师') || name.includes('程序')) {
      return '👨‍💻';
    }
    if (name.includes('操作') || name.includes('防御')) {
      return '🛡️';
    }
    if (name.includes('体系') || name.includes('流程')) {
      return '📋';
    }
    if (name.includes('数据') || name.includes('核算') || name.includes('报表')) {
      return '📊';
    }
    if (name.includes('安全') || name.includes('预警') || name.includes('巡检')) {
      return '🦺';
    }
    // 默认文员
    return '🧑‍💼';
  }

  /**
   * 内部：根据敌人名称匹配 emoji
   * 同事 😠 / 甲方 😤 / 项目 📅 / Boss 👔，默认 😠
   */
  private static pickEnemyEmoji(name: string, isBoss: boolean): string {
    if (isBoss || name.includes('Boss') || name.includes('boss') || name.includes('CEO') || name.includes('CTO') || name.includes('经理') || name.includes('总监') || name.includes('领导')) {
      return '👔';
    }
    if (name.includes('项目') || name.includes('需求') || name.includes('deadline') || name.includes('截止')) {
      return '📅';
    }
    if (name.includes('甲方') || name.includes('客户') || name.includes('需求方')) {
      return '😤';
    }
    // 默认同事
    return '😠';
  }
}

/**
 * 场景管理器：管理全局场景背景
 * 通过给 #app 容器添加背景类来切换场景氛围
 */
export class SceneManager {
  /** 当前背景类型 */
  private static currentType: SceneBackgroundType | null = null;

  /** 场景显示名映射 */
  private static readonly SCENE_NAMES: Record<SceneBackgroundType, string> = {
    office: '办公室',
    meeting_room: '会议室',
    boss_office: '领导办公室',
    battle: '战斗',
    menu: '主菜单',
  };

  /**
   * 设置场景背景
   * 清除旧背景类，应用新背景类到 #app 容器
   * @param type 场景背景类型
   */
  static setBackground(type: SceneBackgroundType): void {
    const container = document.getElementById('app');
    if (!container) {
      console.warn('[SceneManager] 未找到 #app 容器，无法设置背景');
      return;
    }

    // 清除旧的背景类
    if (SceneManager.currentType) {
      container.classList.remove(`scene-bg-${SceneManager.currentType}`);
    }

    // 应用新背景类
    container.classList.add(`scene-bg-${type}`);
    SceneManager.currentType = type;
  }

  /**
   * 获取场景显示名
   * @param type 场景背景类型
   */
  static getSceneName(type: SceneBackgroundType): string {
    return SceneManager.SCENE_NAMES[type] ?? type;
  }

  /**
   * 获取当前背景类型
   */
  static getCurrentType(): SceneBackgroundType | null {
    return SceneManager.currentType;
  }
}

// 触发 uiManager 单例初始化（确保 import 本模块时 uiManager 已就绪）
void uiManager;
