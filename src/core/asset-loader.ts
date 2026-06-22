// 资源加载器：统一管理游戏资源（图片/占位资源）
// 预留美术资源升级接口：开发阶段使用占位资源，正式美术就绪后只需 registerImage 即可替换

// 占位资源的配置数据，用于程序化绘制占位图
export interface PlaceholderData {
  color: string; // 占位图主色
  label: string; // 占位图上显示的标签文字
  width: number; // 占位图宽度
  height: number; // 占位图高度
}

// 资源类型
export type AssetType = 'image' | 'placeholder';

// 单个资源条目
interface AssetEntry {
  key: string; // 资源唯一标识
  type: AssetType; // 资源类型
  src?: string; // 图片资源地址（type 为 image 时使用）
  placeholderConfig?: PlaceholderData; // 占位配置（type 为 placeholder 时使用）
}

// 已加载资源的缓存值类型
type LoadedAsset = HTMLImageElement | PlaceholderData;

export class AssetLoader {
  // 资源注册表
  private entries: Map<string, AssetEntry> = new Map();
  // 已加载资源缓存
  private cache: Map<string, LoadedAsset> = new Map();
  // 当前正在进行的加载任务，避免重复加载
  private pending: Map<string, Promise<LoadedAsset>> = new Map();

  /**
   * 注册占位资源
   * @param key 资源唯一标识
   * @param config 占位配置（颜色、标签、宽高）
   */
  registerPlaceholder(
    key: string,
    config: { color: string; label: string; width: number; height: number },
  ): void {
    this.entries.set(key, {
      key,
      type: 'placeholder',
      placeholderConfig: { ...config },
    });
  }

  /**
   * 注册正式图片资源（用于未来美术升级）
   * @param key 资源唯一标识
   * @param src 图片地址
   */
  registerImage(key: string, src: string): void {
    this.entries.set(key, {
      key,
      type: 'image',
      src,
    });
  }

  /**
   * 加载指定资源
   * - 占位资源：直接返回 PlaceholderData
   * - 图片资源：加载为 HTMLImageElement
   * @param key 资源唯一标识
   */
  load(key: string): Promise<HTMLImageElement | PlaceholderData> {
    // 命中缓存直接返回
    const cached = this.cache.get(key);
    if (cached) {
      return Promise.resolve(cached);
    }

    // 已有进行中的加载任务，复用
    const pending = this.pending.get(key);
    if (pending) {
      return pending;
    }

    const entry = this.entries.get(key);
    if (!entry) {
      return Promise.reject(new Error(`AssetLoader.load: 未注册的资源 "${key}"`));
    }

    const task = this.loadEntry(entry);
    this.pending.set(key, task);
    return task;
  }

  /**
   * 加载所有已注册资源
   */
  async loadAll(): Promise<void> {
    const keys = Array.from(this.entries.keys());
    await Promise.all(keys.map((k) => this.load(k)));
  }

  /**
   * 获取已加载资源（未加载时返回 null）
   * @param key 资源唯一标识
   */
  get(key: string): HTMLImageElement | PlaceholderData | null {
    return this.cache.get(key) ?? null;
  }

  /**
   * 判断某资源是否为占位资源
   * @param key 资源唯一标识
   */
  isPlaceholder(key: string): boolean {
    const entry = this.entries.get(key);
    return !!entry && entry.type === 'placeholder';
  }

  /**
   * 内部：根据资源条目类型执行实际加载
   */
  private loadEntry(entry: AssetEntry): Promise<LoadedAsset> {
    if (entry.type === 'placeholder') {
      // 占位资源无需异步加载，直接返回配置
      const data: PlaceholderData = {
        ...(entry.placeholderConfig as PlaceholderData),
      };
      this.cache.set(entry.key, data);
      this.pending.delete(entry.key);
      return Promise.resolve(data);
    }

    // 图片资源：通过 Image 对象异步加载
    return new Promise<LoadedAsset>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(entry.key, img);
        this.pending.delete(entry.key);
        resolve(img);
      };
      img.onerror = () => {
        this.pending.delete(entry.key);
        reject(new Error(`AssetLoader.load: 图片加载失败 "${entry.key}" (${entry.src})`));
      };
      img.src = entry.src as string;
    });
  }
}

// 导出全局单例
export const assetLoader = new AssetLoader();
