import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPOSITION_THUMBNAIL_MODE,
  getCompositionDisplayName,
  getCompositionThumbnailTimeSeconds,
  parseCompositionDimensionsFromHtml,
  parseCompositionDurationFromHtml,
} from "./CompositionsTab";

describe("getCompositionDisplayName", () => {
  it("strips the composition directory and html extension", () => {
    expect(getCompositionDisplayName("compositions/intro-card.html")).toBe("intro-card");
  });

  it("keeps bare composition names readable", () => {
    expect(getCompositionDisplayName("index.html")).toBe("index");
  });
});

describe("DEFAULT_COMPOSITION_THUMBNAIL_MODE", () => {
  it("loads composition thumbnails by default", () => {
    expect(DEFAULT_COMPOSITION_THUMBNAIL_MODE).toBe("visible");
  });
});

describe("composition thumbnail timing", () => {
  it("uses the 3s frame for compositions at least 3 seconds long", () => {
    expect(getCompositionThumbnailTimeSeconds(4.3)).toBe(3);
    expect(getCompositionThumbnailTimeSeconds(3)).toBe(3);
  });

  it("uses the midpoint for compositions shorter than 3 seconds", () => {
    expect(getCompositionThumbnailTimeSeconds(2)).toBe(1);
    expect(getCompositionThumbnailTimeSeconds(1.5)).toBe(0.75);
  });

  it("falls back to 3s when duration is unavailable", () => {
    expect(getCompositionThumbnailTimeSeconds(null)).toBe(3);
  });
});

describe("composition source metadata parsing", () => {
  it("reads duration and dimensions from composition attributes", () => {
    const html =
      '<div data-composition-id="beat" data-width="960" data-height="540" data-duration="2.5">';
    expect(parseCompositionDurationFromHtml(html)).toBe(2.5);
    expect(parseCompositionDimensionsFromHtml(html)).toEqual({ width: 960, height: 540 });
  });

  it("falls back to 16:9 dimensions when omitted", () => {
    expect(parseCompositionDimensionsFromHtml("<main></main>")).toEqual({
      width: 1920,
      height: 1080,
    });
  });
});
