// 游戏统计：记录游戏次数、累计游戏时长等全局数据
// 使用独立的 localStorage 键存储，与存档数据分离

const STATS_KEY = 'office_adventure_stats';

// 统计数据结构
export interface GameStatsData {
  totalGames: number;       // 总游戏次数
  totalTime: number;        // 累计游戏时长（毫秒）
  victories: number;        // 通关次数
  defeats: number;          // 失败次数
}

// 当前局开始时间（内存中，不持久化）
let currentGameStartTime: number | null = null;

/**
 * 游戏统计管理器
 */
export class GameStatsManager {
  /**
   * 读取统计数据
   */
  load(): GameStatsData {
    try {
      const json = localStorage.getItem(STATS_KEY);
      if (json) {
        return JSON.parse(json) as GameStatsData;
      }
    } catch (e) {
      console.warn('读取游戏统计失败', e);
    }
    return { totalGames: 0, totalTime: 0, victories: 0, defeats: 0 };
  }

  /**
   * 保存统计数据
   */
  save(data: GameStatsData): void {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('保存游戏统计失败', e);
    }
  }

  /**
   * 开始新一局：增加游戏次数，记录开始时间
   */
  startNewGame(): void {
    const stats = this.load();
    stats.totalGames++;
    this.save(stats);
    currentGameStartTime = Date.now();
  }

  /**
   * 继续游戏：记录开始时间（不增加游戏次数）
   */
  continueGame(): void {
    currentGameStartTime = Date.now();
  }

  /**
   * 结束当前局：累加游戏时长，记录胜负
   * @param victory 是否通关
   */
  endGame(victory: boolean): void {
    const stats = this.load();
    if (victory) {
      stats.victories++;
    } else {
      stats.defeats++;
    }
    if (currentGameStartTime !== null) {
      stats.totalTime += Date.now() - currentGameStartTime;
      currentGameStartTime = null;
    }
    this.save(stats);
  }

  /**
   * 获取当前局时长（毫秒）
   */
  getCurrentGameTime(): number {
    if (currentGameStartTime === null) return 0;
    return Date.now() - currentGameStartTime;
  }

  /**
   * 格式化时长为可读字符串
   * @param ms 毫秒数
   * @returns 格式化后的字符串，如 "1小时23分"
   */
  static formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}小时${minutes}分`;
    }
    if (minutes > 0) {
      return `${minutes}分${seconds}秒`;
    }
    return `${seconds}秒`;
  }
}

export const gameStatsManager = new GameStatsManager();
