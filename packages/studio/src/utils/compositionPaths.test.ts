import { describe, expect, it } from "vitest";
import {
  getCompositionLabel,
  getCompositionPreviewUrl,
  isSourceCompositionPath,
  parseCompositionSourceMap,
} from "./compositionPaths";

describe("composition paths", () => {
  it("recognizes source composition paths", () => {
    expect(isSourceCompositionPath("index.html")).toBe(true);
    expect(isSourceCompositionPath("compositions/intro.html")).toBe(true);
    expect(isSourceCompositionPath("assets/poster.png")).toBe(false);
  });

  it("builds stable preview URLs with encoded path segments", () => {
    expect(getCompositionPreviewUrl("demo project", "index.html")).toBe(
      "/api/projects/demo%20project/preview",
    );
    expect(getCompositionPreviewUrl("demo", "compositions/intro card.html")).toBe(
      "/api/projects/demo/preview/comp/compositions/intro%20card.html",
    );
  });

  it("labels composition paths for breadcrumbs", () => {
    expect(getCompositionLabel("index.html")).toBe("Master");
    expect(getCompositionLabel("compositions/manual-editing.html")).toBe("manual-editing");
  });

  it("parses composition id to source mappings from source HTML", () => {
    const map = parseCompositionSourceMap(`
      <section id="hero-host" data-composition-id="hero" data-composition-src="compositions/hero.html"></section>
      <section data-composition-file='compositions/cards.html' data-composition-id='cards'></section>
    `);

    expect(map.get("hero")).toBe("compositions/hero.html");
    expect(map.get("hero-host")).toBe("compositions/hero.html");
    expect(map.get("cards")).toBe("compositions/cards.html");
  });
});
