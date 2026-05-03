import { describe, expect, it } from "vitest";
import { hashThumbnailSource } from "./sourceHash";

describe("hashThumbnailSource", () => {
  it("is stable for identical content", () => {
    expect(hashThumbnailSource("<div>Hello</div>")).toBe(hashThumbnailSource("<div>Hello</div>"));
  });

  it("changes when source changes", () => {
    expect(hashThumbnailSource("<div>Hello</div>")).not.toBe(
      hashThumbnailSource("<div>Hello!</div>"),
    );
  });
});
