import { describe, expect, it, vi } from "vitest";
import { StudioThumbnailService } from "./studioThumbnailService";
import type { ThumbnailKey } from "./thumbnailKey";

const key: ThumbnailKey = {
  projectId: "demo",
  sourcePath: "index.html",
  sourceHash: "abc",
  kind: "composition",
  timeSeconds: 1,
  width: 120,
  height: 68,
  devicePixelRatio: 1,
  version: 1,
};

function createPersistentCache() {
  const records = new Map<string, { blob: Blob; byteSize: number }>();
  return {
    records,
    cache: {
      async get(cacheKey: string) {
        const record = records.get(cacheKey);
        if (!record) return null;
        return {
          key: cacheKey,
          projectId: key.projectId,
          sourcePath: key.sourcePath,
          sourceHash: key.sourceHash,
          kind: key.kind,
          blob: record.blob,
          byteSize: record.byteSize,
          updatedAt: 1,
        };
      },
      async set(record: { key: string; blob: Blob; byteSize: number }) {
        records.set(record.key, { blob: record.blob, byteSize: record.byteSize });
      },
      async clearProject() {
        records.clear();
      },
    },
  };
}

describe("StudioThumbnailService", () => {
  it("dedupes in-flight thumbnail requests and reuses memory cache", async () => {
    const persistent = createPersistentCache();
    const fetchBlob = vi.fn(async () => new Blob(["thumb"], { type: "image/jpeg" }));
    const service = new StudioThumbnailService({
      persistentCache: persistent.cache,
      fetchBlob,
      createObjectUrl: () => "blob:thumb",
      revokeObjectUrl: vi.fn(),
    });

    const [first, second] = await Promise.all([
      service.getThumbnailUrl({ key, url: "/thumb", priority: "hover" }),
      service.getThumbnailUrl({ key, url: "/thumb", priority: "hover" }),
    ]);
    const third = await service.getThumbnailUrl({ key, url: "/thumb", priority: "hover" });

    expect(first).toBe("blob:thumb");
    expect(second).toBe("blob:thumb");
    expect(third).toBe("blob:thumb");
    expect(fetchBlob).toHaveBeenCalledTimes(1);
  });

  it("falls back to persistent cache before fetching", async () => {
    const persistent = createPersistentCache();
    const cacheKey = [
      "v=1",
      "project=demo",
      "source=index.html",
      "hash=abc",
      "kind=composition",
      "time=1",
      "w=120",
      "h=68",
      "dpr=1",
    ].join(";");
    persistent.records.set(cacheKey, {
      blob: new Blob(["cached"], { type: "image/jpeg" }),
      byteSize: 128,
    });
    const fetchBlob = vi.fn(async () => new Blob(["fresh"], { type: "image/jpeg" }));
    const service = new StudioThumbnailService({
      persistentCache: persistent.cache,
      fetchBlob,
      createObjectUrl: () => "blob:cached",
      revokeObjectUrl: vi.fn(),
    });

    await expect(service.getThumbnailUrl({ key, url: "/thumb", priority: "hover" })).resolves.toBe(
      "blob:cached",
    );
    expect(fetchBlob).not.toHaveBeenCalled();
  });

  it("generates video thumbnails through the injected decoder lane", async () => {
    const persistent = createPersistentCache();
    const createVideoThumbnailBlob = vi.fn(
      async () => new Blob(["video-thumb"], { type: "image/webp" }),
    );
    const service = new StudioThumbnailService({
      persistentCache: persistent.cache,
      createVideoThumbnailBlob,
      createObjectUrl: () => "blob:video-thumb",
      revokeObjectUrl: vi.fn(),
    });
    const videoKey: ThumbnailKey = {
      ...key,
      sourcePath: "assets/demo.mp4",
      sourceHash: "video-hash",
      kind: "video",
      timeSeconds: 3.2,
    };

    await expect(
      service.getVideoThumbnailUrl({
        key: videoKey,
        blob: new Blob(["video"], { type: "video/mp4" }),
        priority: "hover",
        fit: "contain",
      }),
    ).resolves.toBe("blob:video-thumb");

    expect(createVideoThumbnailBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        blob: expect.any(Blob),
        timeSeconds: 3.2,
        width: 120,
        height: 68,
        fit: "contain",
      }),
    );
  });

  it("reuses persistent video thumbnails before loading source media", async () => {
    const persistent = createPersistentCache();
    const videoKey: ThumbnailKey = {
      ...key,
      sourcePath: "assets/demo.mp4",
      sourceHash: "video-hash",
      kind: "video",
      timeSeconds: 3.2,
    };
    const cacheKey = [
      "v=1",
      "project=demo",
      "source=assets%2Fdemo.mp4",
      "hash=video-hash",
      "kind=video",
      "time=3.2",
      "w=120",
      "h=68",
      "dpr=1",
    ].join(";");
    persistent.records.set(cacheKey, {
      blob: new Blob(["cached-video-thumb"], { type: "image/webp" }),
      byteSize: 128,
    });
    const createVideoThumbnailBlob = vi.fn(
      async () => new Blob(["video-thumb"], { type: "image/webp" }),
    );
    const loadBlob = vi.fn(async () => new Blob(["video"], { type: "video/mp4" }));
    const service = new StudioThumbnailService({
      persistentCache: persistent.cache,
      createVideoThumbnailBlob,
      createObjectUrl: () => "blob:cached-video-thumb",
      revokeObjectUrl: vi.fn(),
    });

    await expect(
      service.getVideoThumbnailUrl({
        key: videoKey,
        loadBlob,
        priority: "hover",
        fit: "contain",
      }),
    ).resolves.toBe("blob:cached-video-thumb");

    expect(loadBlob).not.toHaveBeenCalled();
    expect(createVideoThumbnailBlob).not.toHaveBeenCalled();
  });
});
