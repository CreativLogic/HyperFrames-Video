import { describe, expect, it } from "vitest";
import { selectThumbnailEvictions } from "./indexedDbThumbnailCache";

describe("selectThumbnailEvictions", () => {
  it("evicts oldest records until the byte budget fits", () => {
    expect(
      selectThumbnailEvictions(
        [
          { key: "new", byteSize: 8, updatedAt: 30 },
          { key: "old", byteSize: 8, updatedAt: 10 },
          { key: "middle", byteSize: 8, updatedAt: 20 },
        ],
        { maxBytes: 16, maxEntries: 10 },
      ),
    ).toEqual(["old"]);
  });

  it("evicts oldest records until the entry budget fits", () => {
    expect(
      selectThumbnailEvictions(
        [
          { key: "a", byteSize: 1, updatedAt: 10 },
          { key: "b", byteSize: 1, updatedAt: 20 },
          { key: "c", byteSize: 1, updatedAt: 30 },
        ],
        { maxBytes: 10, maxEntries: 1 },
      ),
    ).toEqual(["a", "b"]);
  });

  it("keeps records when both budgets fit", () => {
    expect(
      selectThumbnailEvictions(
        [
          { key: "a", byteSize: 1, updatedAt: 10 },
          { key: "b", byteSize: 1, updatedAt: 20 },
        ],
        { maxBytes: 10, maxEntries: 10 },
      ),
    ).toEqual([]);
  });
});
