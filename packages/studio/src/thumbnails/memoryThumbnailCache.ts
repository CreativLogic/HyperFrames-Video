export interface MemoryThumbnailCacheOptions {
  maxBytes?: number;
  maxEntries?: number;
}

export interface MemoryThumbnailCacheEntry<T> {
  value: T;
  byteSize: number;
  dispose?: (value: T) => void;
}

export interface MemoryThumbnailCacheStats {
  entries: number;
  bytes: number;
  maxBytes: number;
  maxEntries: number;
}

interface StoredEntry<T> extends MemoryThumbnailCacheEntry<T> {
  key: string;
}

const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 64;

export class MemoryThumbnailCache<T> {
  readonly maxBytes: number;
  readonly maxEntries: number;

  private entries = new Map<string, StoredEntry<T>>();
  private totalBytes = 0;

  constructor(options: MemoryThumbnailCacheOptions = {}) {
    this.maxBytes = Math.max(0, options.maxBytes ?? DEFAULT_MAX_BYTES);
    this.maxEntries = Math.max(0, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  set(key: string, entry: MemoryThumbnailCacheEntry<T>): void {
    this.delete(key);

    const byteSize = Math.max(0, Math.ceil(entry.byteSize));
    this.entries.set(key, {
      key,
      value: entry.value,
      byteSize,
      dispose: entry.dispose,
    });
    this.totalBytes += byteSize;
    this.prune();
  }

  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;

    this.entries.delete(key);
    this.totalBytes -= entry.byteSize;
    disposeEntry(entry);
    return true;
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      disposeEntry(entry);
    }
    this.entries.clear();
    this.totalBytes = 0;
  }

  stats(): MemoryThumbnailCacheStats {
    return {
      entries: this.entries.size,
      bytes: this.totalBytes,
      maxBytes: this.maxBytes,
      maxEntries: this.maxEntries,
    };
  }

  private prune(): void {
    while (
      this.entries.size > 0 &&
      (this.entries.size > this.maxEntries || this.totalBytes > this.maxBytes)
    ) {
      const oldestKey = this.entries.keys().next().value;
      if (typeof oldestKey !== "string") return;
      this.delete(oldestKey);
    }
  }
}

function disposeEntry<T>(entry: StoredEntry<T>): void {
  entry.dispose?.(entry.value);
}
