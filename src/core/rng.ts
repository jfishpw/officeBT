// 确定性随机数生成器（RNG）
// 基于 mulberry32 算法，支持种子复现，便于存档/读档时还原随机序列

export class RNG {
  // 创建时使用的种子（不可变，用于复现）
  private readonly seed: number;
  // 内部状态，每次 next() 都会更新
  private state: number;

  /**
   * 构造函数
   * @param seed 随机种子（建议使用 32 位无符号整数）
   */
  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  /**
   * 生成下一个 [0, 1) 范围的浮点数
   * 使用 mulberry32 算法，保证同一种子产生确定性序列
   */
  next(): number {
    // mulberry32 核心算法
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    // 计算结果并归一化到 [0, 1)
    const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return result;
  }

  /**
   * 生成 [min, max] 闭区间内的整数
   * @param min 最小值（含）
   * @param max 最大值（含）
   */
  nextInt(min: number, max: number): number {
    if (max < min) {
      // 容错：交换边界
      [min, max] = [max, min];
    }
    // 闭区间整数：min + floor([0,1) * (max - min + 1))
    const range = max - min + 1;
    return min + Math.floor(this.next() * range);
  }

  /**
   * 从数组中随机选取一个元素
   * @param arr 待选取的数组
   */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new Error('RNG.pick: 数组不能为空');
    }
    const index = this.nextInt(0, arr.length - 1);
    return arr[index];
  }

  /**
   * 返回打乱后的新数组（不修改原数组）
   * 使用 Fisher-Yates 洗牌算法
   * @param arr 待打乱的数组
   */
  shuffle<T>(arr: readonly T[]): T[] {
    const result = arr.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * 概率判断
   * @param probability 触发概率，范围 [0, 1]
   * @returns 是否触发
   */
  chance(probability: number): boolean {
    if (probability <= 0) {
      return false;
    }
    if (probability >= 1) {
      return true;
    }
    return this.next() < probability;
  }

  /**
   * 获取创建时使用的种子
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * 获取当前内部状态（用于存档）
   */
  getState(): number {
    return this.state;
  }

  /**
   * 恢复内部状态（用于读档后还原随机序列）
   * @param state 之前通过 getState() 获取的状态
   */
  setState(state: number): void {
    this.state = state >>> 0;
  }
}
