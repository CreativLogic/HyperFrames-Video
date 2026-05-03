import { describe, expect, it } from "vitest";
import { estimateThumbnailBytes, serializeThumbnailKey } from "./thumbnailKey";

describe("thumbnail keys", () => {
  it("serializes fields in a stable order", () => {
    expect(
      serializeThumbnailKey({
        projectId: "demo project",
        sourcePath: "compositions/intro.html",
        sourceHash: "abc123",
        kind: "html-element",
        selector: ".hero h1",
        selectorIndex: 2,
        timeSeconds: 1.23456,
        width: 160.4,
        height: 90.4,
        devicePixelRatio: 1.9999,
        version: 1,
      }),
    ).toBe(
      "v=1;project=demo%20project;source=compositions%2Fintro.html;hash=abc123;kind=html-element;time=1.235;w=160;h=90;dpr=2;selector=.hero%20h1;selectorIndex=2",
    );
  });

  it("estimates decoded thumbnail memory by pixel count", () => {
    expect(estimateThumbnailBytes(100, 50, 2)).toBe(80_000);
  });
});
