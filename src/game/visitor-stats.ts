// 访客统计：通过免费计数 API 统计总访客数，通过 IP 查询 API 获取访客 IP
// 使用 abacus.jasoncameron.dev 作为计数服务，ipify 获取访客 IP
// 每台设备仅注册一次（localStorage 标记），避免重复计数

const VISITOR_REGISTERED_KEY = 'office_adventure_visitor_registered';
// 计数服务命名空间和键（abacus.jasoncameron.dev）
const ABACUS_NAMESPACE = 'office_adventure';
const ABACUS_KEY = 'visitors';
const ABACUS_BASE = 'https://abacus.jasoncameron.dev';
// IP 查询服务
const IPIFY_URL = 'https://api.ipify.org?format=json';

/**
 * 创建带超时的 fetch 信号（兼容 ES2020，不依赖 AbortSignal.timeout）
 * @param ms 超时毫秒
 * @returns AbortSignal
 */
function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export interface VisitorInfo {
  ip: string; // 访客 IP
  totalVisitors: number; // 总访客数
}

/**
 * 访客统计管理器
 */
export class VisitorStatsManager {
  /**
   * 获取访客 IP（调用 ipify API）
   * @returns IP 字符串，失败返回 '--'
   */
  async getVisitorIP(): Promise<string> {
    try {
      const res = await fetch(IPIFY_URL, { signal: timeoutSignal(5000) });
      if (!res.ok) return '--';
      const data = await res.json();
      return data.ip ?? '--';
    } catch (e) {
      console.warn('获取访客 IP 失败', e);
      return '--';
    }
  }

  /**
   * 获取总访客数（调用 abacus get 接口，不递增）
   * @returns 总访客数，失败返回 0
   */
  async getVisitorCount(): Promise<number> {
    try {
      const url = `${ABACUS_BASE}/get/${ABACUS_NAMESPACE}/${ABACUS_KEY}`;
      const res = await fetch(url, { signal: timeoutSignal(5000) });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.value ?? 0;
    } catch (e) {
      console.warn('获取访客数失败', e);
      return 0;
    }
  }

  /**
   * 注册访客（首次访问时调用 hit 接口递增计数，每台设备仅注册一次）
   * @returns 注册后的总访客数，已注册过或失败返回 0
   */
  async registerVisitor(): Promise<number> {
    // 已注册过则不再计数
    if (localStorage.getItem(VISITOR_REGISTERED_KEY) === '1') {
      return 0;
    }
    try {
      const url = `${ABACUS_BASE}/hit/${ABACUS_NAMESPACE}/${ABACUS_KEY}`;
      const res = await fetch(url, { signal: timeoutSignal(5000) });
      if (!res.ok) return 0;
      const data = await res.json();
      // 标记已注册
      localStorage.setItem(VISITOR_REGISTERED_KEY, '1');
      return data.value ?? 0;
    } catch (e) {
      console.warn('注册访客失败', e);
      return 0;
    }
  }

  /**
   * 获取访客信息（IP + 总访客数）
   * 首次访问会自动注册并递增计数
   * @returns 访客信息
   */
  async getVisitorInfo(): Promise<VisitorInfo> {
    // 并行获取 IP 和注册访客
    const [ip, registeredCount] = await Promise.all([
      this.getVisitorIP(),
      this.registerVisitor(),
    ]);
    // 若刚注册成功，直接用返回值；否则查询当前总数
    let totalVisitors = registeredCount;
    if (totalVisitors === 0) {
      totalVisitors = await this.getVisitorCount();
    }
    return { ip, totalVisitors };
  }
}

export const visitorStatsManager = new VisitorStatsManager();

