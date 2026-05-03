import { Window } from "happy-dom";
import { beforeAll, describe, expect, it } from "vitest";

let getPreviewPlayerKey: typeof import("./NLEPreview").getPreviewPlayerKey;

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
  ({ getPreviewPlayerKey } = await import("./NLEPreview"));
});

describe("getPreviewPlayerKey", () => {
  it("uses the project id for master preview identity", () => {
    expect(
      getPreviewPlayerKey({
        projectId: "timeline-edit-playground",
      }),
    ).toBe("timeline-edit-playground");
  });

  it("switches identity when drilling into a different directUrl", () => {
    expect(
      getPreviewPlayerKey({
        projectId: "timeline-edit-playground",
        directUrl: "/api/projects/timeline-edit-playground/preview",
      }),
    ).not.toBe(
      getPreviewPlayerKey({
        projectId: "timeline-edit-playground",
        directUrl: "/api/projects/timeline-edit-playground/preview/comp/compositions/intro.html",
      }),
    );
  });
});
