import { describe, expect, it } from "vitest";
import { MemoryThumbnailCache } from "./memoryThumbnailCache";

describe("MemoryThumbnailCache", () => {
  it("evicts the least recently used entry when the byte budget is exceeded", () => {
    const disposed: string[] = [];
    const cache = new MemoryThumbnailCache<string>({ maxBytes: 10, maxEntries: 10 });

    cache.set("a", { value: "a", byteSize: 4, dispose: (value) => disposed.push(value) });
    cache.set("b", { value: "b", byteSize: 4, dispose: (value) => disposed.push(value) });
    expect(cache.get("a")).toBe("a");

    cache.set("c", { value: "c", byteSize: 4, dispose: (value) => disposed.push(value) });

    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("c")).toBe(true);
    expect(disposed).toEqual(["b"]);
    expect(cache.stats()).toMatchObject({ entries: 2, bytes: 8 });
  });

  it("evicts by entry count and disposes replaced values", () => {
    const disposed: string[] = [];
    const cache = new MemoryThumbnailCache<string>({ maxBytes: 100, maxEntries: 1 });

    cache.set("a", { value: "old", byteSize: 4, dispose: (value) => disposed.push(value) });
    cache.set("a", { value: "new", byteSize: 4, dispose: (value) => disposed.push(value) });
    cache.set("b", { value: "b", byteSize: 4, dispose: (value) => disposed.push(value) });

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("b");
    expect(disposed).toEqual(["old", "new"]);
  });

  it("clears every cached value", () => {
    const disposed: string[] = [];
    const cache = new MemoryThumbnailCache<string>();

    cache.set("a", { value: "a", byteSize: 4, dispose: (value) => disposed.push(value) });
    cache.set("b", { value: "b", byteSize: 4, dispose: (value) => disposed.push(value) });
    cache.clear();

    expect(cache.stats()).toMatchObject({ entries: 0, bytes: 0 });
    expect(disposed).toEqual(["a", "b"]);
  });
});
