import { IndexedDbThumbnailCache, type PersistentThumbnailRecord } from "./indexedDbThumbnailCache";
import { MemoryThumbnailCache } from "./memoryThumbnailCache";
import { estimateThumbnailBytes, serializeThumbnailKey, type ThumbnailKey } from "./thumbnailKey";
import { ThumbnailScheduler, type ThumbnailPriority } from "./thumbnailScheduler";
import type { VideoThumbnailRequest } from "./videoThumbnail";

export interface StudioThumbnailRequest {
  key: ThumbnailKey;
  url: string;
  priority: ThumbnailPriority;
  signal?: AbortSignal;
}

export interface StudioVideoThumbnailRequest {
  key: ThumbnailKey;
  priority: ThumbnailPriority;
  blob?: Blob;
  loadBlob?: (signal: AbortSignal) => Promise<Blob | null>;
  signal?: AbortSignal;
  fit?: VideoThumbnailRequest["fit"];
  type?: VideoThumbnailRequest["type"];
  quality?: number;
}

export interface StudioThumbnailServiceStats {
  memory: ReturnType<MemoryThumbnailCache<string>["stats"]>;
  scheduler: ReturnType<ThumbnailScheduler["stats"]>;
}

export interface StudioThumbnailServiceOptions {
  memoryCache?: MemoryThumbnailCache<string>;
  persistentCache?: Pick<IndexedDbThumbnailCache, "get" | "set" | "clearProject">;
  scheduler?: ThumbnailScheduler;
  fetchBlob?: (url: string, signal: AbortSignal) => Promise<Blob | null>;
  createVideoThumbnailBlob?: (request: VideoThumbnailRequest) => Promise<Blob | null>;
  createObjectUrl?: (blob: Blob) => string;
  revokeObjectUrl?: (url: string) => void;
}

export class StudioThumbnailService {
  private readonly memoryCache: MemoryThumbnailCache<string>;
  private readonly persistentCache: Pick<IndexedDbThumbnailCache, "get" | "set" | "clearProject">;
  private readonly scheduler: ThumbnailScheduler;
  private readonly fetchBlob: (url: string, signal: AbortSignal) => Promise<Blob | null>;
  private readonly createVideoThumbnailBlob: (
    request: VideoThumbnailRequest,
  ) => Promise<Blob | null>;
  private readonly createObjectUrl: (blob: Blob) => string;
  private readonly revokeObjectUrl: (url: string) => void;

  constructor(options: StudioThumbnailServiceOptions = {}) {
    this.memoryCache = options.memoryCache ?? new MemoryThumbnailCache<string>();
    this.persistentCache = options.persistentCache ?? new IndexedDbThumbnailCache();
    this.scheduler = options.scheduler ?? new ThumbnailScheduler();
    this.fetchBlob = options.fetchBlob ?? fetchThumbnailBlob;
    this.createVideoThumbnailBlob = options.createVideoThumbnailBlob ?? createDefaultVideoThumbnail;
    this.createObjectUrl = options.createObjectUrl ?? createBrowserObjectUrl;
    this.revokeObjectUrl = options.revokeObjectUrl ?? revokeBrowserObjectUrl;
  }

  async getThumbnailUrl(request: StudioThumbnailRequest): Promise<string | null> {
    const cacheKey = serializeThumbnailKey(request.key);
    const cachedUrl = this.memoryCache.get(cacheKey);
    if (cachedUrl) return cachedUrl;

    const result = await this.scheduler.schedule({
      key: cacheKey,
      priority: request.priority,
      signal: request.signal,
      task: async (signal) => {
        const persistent = await this.getPersistent(cacheKey);
        if (persistent) return this.storeObjectUrl(cacheKey, persistent.blob, persistent.byteSize);

        const blob = await this.fetchBlob(request.url, signal);
        if (!blob) return null;

        const byteSize = estimateThumbnailBytes(
          request.key.width,
          request.key.height,
          request.key.devicePixelRatio,
        );
        await this.setPersistent({
          key: cacheKey,
          projectId: request.key.projectId,
          sourcePath: request.key.sourcePath,
          sourceHash: request.key.sourceHash,
          kind: request.key.kind,
          blob,
          byteSize,
          updatedAt: 0,
        });
        return this.storeObjectUrl(cacheKey, blob, byteSize);
      },
    });

    return typeof result === "string" ? result : null;
  }

  async getVideoThumbnailUrl(request: StudioVideoThumbnailRequest): Promise<string | null> {
    const cacheKey = serializeThumbnailKey(request.key);
    const cachedUrl = this.memoryCache.get(cacheKey);
    if (cachedUrl) return cachedUrl;

    const result = await this.scheduler.schedule({
      key: cacheKey,
      priority: request.priority,
      signal: request.signal,
      task: async (signal) => {
        const persistent = await this.getPersistent(cacheKey);
        if (persistent) return this.storeObjectUrl(cacheKey, persistent.blob, persistent.byteSize);

        const sourceBlob = request.blob ?? (await request.loadBlob?.(signal));
        if (!sourceBlob) return null;

        const blob = await this.createVideoThumbnailBlob({
          blob: sourceBlob,
          timeSeconds: request.key.timeSeconds,
          width: request.key.width,
          height: request.key.height,
          fit: request.fit,
          type: request.type,
          quality: request.quality,
          signal,
        });
        if (!blob) return null;

        const byteSize = estimateThumbnailBytes(
          request.key.width,
          request.key.height,
          request.key.devicePixelRatio,
        );
        await this.setPersistent({
          key: cacheKey,
          projectId: request.key.projectId,
          sourcePath: request.key.sourcePath,
          sourceHash: request.key.sourceHash,
          kind: request.key.kind,
          blob,
          byteSize,
          updatedAt: 0,
        });
        return this.storeObjectUrl(cacheKey, blob, byteSize);
      },
    });

    return typeof result === "string" ? result : null;
  }

  async clearProject(projectId: string): Promise<void> {
    this.memoryCache.clear();
    await this.persistentCache.clearProject(projectId).catch(() => {});
    dispatchThumbnailCacheCleared(projectId);
  }

  stats(): StudioThumbnailServiceStats {
    return {
      memory: this.memoryCache.stats(),
      scheduler: this.scheduler.stats(),
    };
  }

  dispose(): void {
    this.memoryCache.clear();
  }

  private storeObjectUrl(cacheKey: string, blob: Blob, byteSize: number): string {
    const objectUrl = this.createObjectUrl(blob);
    this.memoryCache.set(cacheKey, {
      value: objectUrl,
      byteSize,
      dispose: this.revokeObjectUrl,
    });
    return objectUrl;
  }

  private async getPersistent(cacheKey: string): Promise<PersistentThumbnailRecord | null> {
    return this.persistentCache.get(cacheKey).catch(() => null);
  }

  private async setPersistent(record: PersistentThumbnailRecord): Promise<void> {
    await this.persistentCache.set(record).catch(() => {});
  }
}

let singleton: StudioThumbnailService | null = null;

export function getStudioThumbnailService(): StudioThumbnailService {
  if (!singleton) singleton = new StudioThumbnailService();
  return singleton;
}

async function fetchThumbnailBlob(url: string, signal: AbortSignal): Promise<Blob | null> {
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  return response.blob();
}

async function createDefaultVideoThumbnail(request: VideoThumbnailRequest): Promise<Blob | null> {
  const { createVideoThumbnail } = await import("./videoThumbnail");
  return createVideoThumbnail(request);
}

function createBrowserObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

function revokeBrowserObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}

function dispatchThumbnailCacheCleared(projectId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("hf:thumbnail-cache-cleared", { detail: { projectId } }));
}
