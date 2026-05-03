import { Window } from "happy-dom";
import { beforeAll, describe, expect, it } from "vitest";

let resolveTimelineCompositionSource: typeof import("./NLELayout").resolveTimelineCompositionSource;

beforeAll(async () => {
  const window = new Window();
  Object.assign(globalThis, {
    HTMLElement: window.HTMLElement,
    HTMLDivElement: window.HTMLDivElement,
    HTMLIFrameElement: window.HTMLIFrameElement,
    HTMLImageElement: window.HTMLImageElement,
    customElements: window.customElements,
    document: window.document,
    CSSStyleSheet: window.CSSStyleSheet,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  ({ resolveTimelineCompositionSource } = await import("./NLELayout"));
});

describe("resolveTimelineCompositionSource", () => {
  const map = new Map([
    ["hook", "compositions/hook.html"],
    ["motion", "compositions/motion.html"],
    ["closing", "compositions/closing.html"],
  ]);

  it("keeps an existing composition source", () => {
    expect(
      resolveTimelineCompositionSource(
        { id: "scene-hook", compositionSrc: "compositions/custom.html" },
        map,
      ),
    ).toBe("compositions/custom.html");
  });

  it("maps scene-prefixed timeline clip ids back to composition paths", () => {
    expect(resolveTimelineCompositionSource({ id: "scene-motion" }, map)).toBe(
      "compositions/motion.html",
    );
  });

  it("maps suffixed host ids back to composition paths", () => {
    expect(resolveTimelineCompositionSource({ id: "closing-host" }, map)).toBe(
      "compositions/closing.html",
    );
  });

  it("returns undefined for unrelated timeline elements", () => {
    expect(resolveTimelineCompositionSource({ id: "avatar-video" }, map)).toBeUndefined();
  });
});
