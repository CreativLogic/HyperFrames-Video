import type { ThumbnailKey } from "./thumbnailKey";

export interface PersistentThumbnailRecord {
  key: string;
  projectId: string;
  sourcePath: string;
  sourceHash: string;
  kind: ThumbnailKey["kind"];
  blob: Blob;
  byteSize: number;
  updatedAt: number;
}

export interface IndexedDbThumbnailCacheOptions {
  dbName?: string;
  storeName?: string;
  maxBytes?: number;
  maxEntries?: number;
  now?: () => number;
}

export interface ThumbnailEvictionRecord {
  key: string;
  byteSize: number;
  updatedAt: number;
}

const DEFAULT_DB_NAME = "hyperframes-studio-thumbnails";
const DEFAULT_STORE_NAME = "thumbnails";
const DEFAULT_MAX_BYTES = 96 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 600;
const DB_VERSION = 1;

export function selectThumbnailEvictions(
  records: ThumbnailEvictionRecord[],
  options: { maxBytes: number; maxEntries: number },
): string[] {
  const maxBytes = Math.max(0, options.maxBytes);
  const maxEntries = Math.max(0, options.maxEntries);
  let totalBytes = records.reduce((total, record) => total + Math.max(0, record.byteSize), 0);
  let totalEntries = records.length;
  const evictions: string[] = [];

  const oldestFirst = [...records].sort((a, b) => a.updatedAt - b.updatedAt);
  for (const record of oldestFirst) {
    if (totalEntries <= maxEntries && totalBytes <= maxBytes) break;
    evictions.push(record.key);
    totalEntries -= 1;
    totalBytes -= Math.max(0, record.byteSize);
  }

  return evictions;
}

export class IndexedDbThumbnailCache {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly dbName: string;
  private readonly storeName: string;
  private readonly maxBytes: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: IndexedDbThumbnailCacheOptions = {}) {
    this.dbName = options.dbName ?? DEFAULT_DB_NAME;
    this.storeName = options.storeName ?? DEFAULT_STORE_NAME;
    this.maxBytes = Math.max(0, options.maxBytes ?? DEFAULT_MAX_BYTES);
    this.maxEntries = Math.max(0, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
    this.now = options.now ?? (() => Date.now());
  }

  get supported(): boolean {
    return typeof indexedDB !== "undefined";
  }

  async get(key: string): Promise<PersistentThumbnailRecord | null> {
    const record = await this.withStore("readwrite", (store) => requestToPromise(store.get(key)));
    if (!isThumbnailRecord(record)) return null;
    record.updatedAt = this.now();
    await this.withStore("readwrite", (store) => requestToPromise(store.put(record)));
    return record;
  }

  async set(record: Omit<PersistentThumbnailRecord, "updatedAt">): Promise<void> {
    const stored: PersistentThumbnailRecord = {
      ...record,
      byteSize: Math.max(0, Math.ceil(record.byteSize)),
      updatedAt: this.now(),
    };
    await this.withStore("readwrite", (store) => requestToPromise(store.put(stored)));
    await this.prune();
  }

  async delete(key: string): Promise<void> {
    await this.withStore("readwrite", (store) => requestToPromise(store.delete(key)));
  }

  async clearProject(projectId: string): Promise<void> {
    const records = await this.listRecords();
    const keys = records
      .filter((record) => record.projectId === projectId)
      .map((record) => record.key);
    await this.deleteMany(keys);
  }

  async clear(): Promise<void> {
    await this.withStore("readwrite", (store) => requestToPromise(store.clear()));
  }

  async prune(): Promise<string[]> {
    const records = await this.listRecords();
    const evictions = selectThumbnailEvictions(records, {
      maxBytes: this.maxBytes,
      maxEntries: this.maxEntries,
    });
    await this.deleteMany(evictions);
    return evictions;
  }

  private async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.withStore("readwrite", async (store) => {
      await Promise.all(keys.map((key) => requestToPromise(store.delete(key))));
    });
  }

  private async listRecords(): Promise<PersistentThumbnailRecord[]> {
    const records = await this.withStore("readonly", (store) =>
      requestToPromise(store.getAll() as IDBRequest<unknown[]>),
    );
    return records.filter(isThumbnailRecord);
  }

  private async withStore<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    if (!this.supported) throw new Error("IndexedDB is not available for thumbnail caching.");
    const db = await this.openDb();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(this.storeName, mode);
      const store = transaction.objectStore(this.storeName);
      let actionSettled = false;
      let actionValue: T | undefined;

      void action(store)
        .then((value) => {
          actionSettled = true;
          actionValue = value;
        })
        .catch((error: unknown) => {
          actionSettled = true;
          reject(error);
          transaction.abort();
        });

      transaction.oncomplete = () => {
        if (!actionSettled) {
          reject(new Error("IndexedDB transaction completed before thumbnail action settled."));
          return;
        }
        resolve(actionValue as T);
      };
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB aborted."));
    });
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(this.storeName)
          ? request.transaction?.objectStore(this.storeName)
          : db.createObjectStore(this.storeName, { keyPath: "key" });
        if (store && !store.indexNames.contains("projectId")) {
          store.createIndex("projectId", "projectId", { unique: false });
        }
        if (store && !store.indexNames.contains("updatedAt")) {
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    });
    return this.dbPromise;
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function isThumbnailRecord(value: unknown): value is PersistentThumbnailRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PersistentThumbnailRecord>;
  return (
    typeof record.key === "string" &&
    typeof record.projectId === "string" &&
    typeof record.sourcePath === "string" &&
    typeof record.sourceHash === "string" &&
    typeof record.kind === "string" &&
    typeof record.byteSize === "number" &&
    typeof record.updatedAt === "number" &&
    typeof Blob !== "undefined" &&
    record.blob instanceof Blob
  );
}
