import { describe, expect, it } from "vitest";
import { normalizeThumbnailMode, shouldRequestThumbnail } from "./thumbnailMode";

describe("normalizeThumbnailMode", () => {
  it("accepts known modes", () => {
    expect(normalizeThumbnailMode("off")).toBe("off");
    expect(normalizeThumbnailMode("hover")).toBe("visible");
    expect(normalizeThumbnailMode("visible")).toBe("visible");
    expect(normalizeThumbnailMode("always")).toBe("always");
  });

  it("defaults unknown values to disabled thumbnails", () => {
    expect(normalizeThumbnailMode("fast")).toBe("off");
    expect(normalizeThumbnailMode(null)).toBe("off");
  });
});

describe("shouldRequestThumbnail", () => {
  it("keeps off mode cold", () => {
    expect(shouldRequestThumbnail("off", { hovered: true, visible: true })).toBe(false);
  });

  it("only requests hover mode while hovered", () => {
    expect(shouldRequestThumbnail("hover", { hovered: false })).toBe(false);
    expect(shouldRequestThumbnail("hover", { hovered: true })).toBe(true);
  });

  it("requests visible and always modes deterministically", () => {
    expect(shouldRequestThumbnail("visible", { visible: true })).toBe(true);
    expect(shouldRequestThumbnail("visible", { visible: false })).toBe(false);
    expect(shouldRequestThumbnail("always", { visible: false })).toBe(true);
  });
});
