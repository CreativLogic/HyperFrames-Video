import { describe, expect, it } from "vitest";
import type { TimelineElement } from "../store/playerStore";
import {
  getTimelineThumbnailCaptureTimeSeconds,
  getTimelineThumbnailTimeSeconds,
  resolveTimelineElementThumbnailSourcePath,
  resolveTimelineThumbnailSource,
  resolveTimelineThumbnailSourcePath,
  resolveTimelineVideoThumbnailSourcePath,
} from "./TimelineThumbnailContent";

const baseElement: TimelineElement = {
  id: "clip",
  tag: "div",
  start: 10,
  duration: 4,
  track: 0,
};

describe("resolveTimelineThumbnailSourcePath", () => {
  it("uses source composition paths directly", () => {
    expect(
      resolveTimelineThumbnailSourcePath({
        ...baseElement,
        compositionSrc: "compositions/manual.html",
      }),
    ).toBe("compositions/manual.html");
  });

  it("extracts composition paths from preview URLs", () => {
    expect(
      resolveTimelineThumbnailSourcePath({
        ...baseElement,
        compositionSrc:
          "http://127.0.0.1:5196/api/projects/demo/preview/comp/compositions%2Fmanual.html",
      }),
    ).toBe("compositions/manual.html");
  });

  it("falls back to sourceFile and rejects non-composition sources", () => {
    expect(resolveTimelineThumbnailSourcePath({ ...baseElement, sourceFile: "index.html" })).toBe(
      "index.html",
    );
    expect(resolveTimelineThumbnailSourcePath({ ...baseElement, src: "assets/video.mp4" })).toBe(
      null,
    );
  });
});

describe("resolveTimelineVideoThumbnailSourcePath", () => {
  it("resolves root-relative project video assets", () => {
    expect(
      resolveTimelineVideoThumbnailSourcePath({
        ...baseElement,
        tag: "video",
        src: "assets/avatar-visual.mp4",
      }),
    ).toBe("assets/avatar-visual.mp4");
  });

  it("resolves video assets relative to nested composition files", () => {
    expect(
      resolveTimelineVideoThumbnailSourcePath({
        ...baseElement,
        tag: "video",
        sourceFile: "compositions/manual.html",
        src: "../assets/demo.webm?cache=1",
      }),
    ).toBe("assets/demo.webm");
  });

  it("extracts project preview asset URLs", () => {
    expect(
      resolveTimelineVideoThumbnailSourcePath({
        ...baseElement,
        tag: "video",
        src: "http://127.0.0.1:5196/api/projects/demo/preview/assets/avatar-visual.mp4",
      }),
    ).toBe("assets/avatar-visual.mp4");
  });

  it("rejects non-video and external media sources", () => {
    expect(
      resolveTimelineVideoThumbnailSourcePath({
        ...baseElement,
        tag: "img",
        src: "assets/poster.png",
      }),
    ).toBe(null);
    expect(
      resolveTimelineVideoThumbnailSourcePath({
        ...baseElement,
        tag: "video",
        src: "https://cdn.example.com/video.mp4",
      }),
    ).toBe(null);
  });
});

describe("resolveTimelineElementThumbnailSourcePath", () => {
  it("uses the explicit source file for DOM element thumbnails", () => {
    expect(
      resolveTimelineElementThumbnailSourcePath({
        ...baseElement,
        sourceFile: "compositions/manual.html",
        selector: "#card",
      }),
    ).toBe("compositions/manual.html");
  });

  it("extracts the source file from stable timeline keys", () => {
    expect(
      resolveTimelineElementThumbnailSourcePath({
        ...baseElement,
        key: "index.html#beat-1",
        selector: "#beat-1",
      }),
    ).toBe("index.html");
    expect(
      resolveTimelineElementThumbnailSourcePath({
        ...baseElement,
        key: "compositions/manual.html:.card:0",
        selector: ".card",
      }),
    ).toBe("compositions/manual.html");
  });
});

describe("resolveTimelineThumbnailSource", () => {
  it("prefers composition thumbnails over nested media thumbnails", () => {
    expect(
      resolveTimelineThumbnailSource({
        ...baseElement,
        tag: "video",
        compositionSrc: "compositions/hook.html",
        src: "assets/avatar-visual.mp4",
      }),
    ).toEqual({ kind: "composition", sourcePath: "compositions/hook.html" });
  });

  it("falls back to visible video thumbnails for raw media clips", () => {
    expect(
      resolveTimelineThumbnailSource({
        ...baseElement,
        tag: "video",
        src: "assets/avatar-visual.mp4",
      }),
    ).toEqual({ kind: "video", sourcePath: "assets/avatar-visual.mp4" });
  });

  it("falls back to selector captures for normal DOM timeline elements", () => {
    expect(
      resolveTimelineThumbnailSource({
        ...baseElement,
        key: "index.html#beat-1",
        selector: "#beat-1",
      }),
    ).toEqual({
      kind: "element",
      sourcePath: "index.html",
      selector: "#beat-1",
      selectorIndex: undefined,
    });
  });

  it("uses source-file selector captures for DOM elements before whole-composition captures", () => {
    expect(
      resolveTimelineThumbnailSource({
        ...baseElement,
        sourceFile: "index.html",
        selector: "#beat-2",
      }),
    ).toEqual({
      kind: "element",
      sourcePath: "index.html",
      selector: "#beat-2",
      selectorIndex: undefined,
    });
  });
});

describe("getTimelineThumbnailTimeSeconds", () => {
  it("uses the clip midpoint by default", () => {
    expect(getTimelineThumbnailTimeSeconds(baseElement)).toBe(2);
  });

  it("adds playbackStart when present", () => {
    expect(getTimelineThumbnailTimeSeconds({ ...baseElement, playbackStart: 5 })).toBe(7);
  });
});

describe("getTimelineThumbnailCaptureTimeSeconds", () => {
  it("uses source timeline time for selector captures", () => {
    expect(
      getTimelineThumbnailCaptureTimeSeconds(
        { ...baseElement, start: 4.3, duration: 5.5, playbackStart: 20 },
        { kind: "element", sourcePath: "index.html", selector: "#beat-2" },
      ),
    ).toBe(7.05);
  });

  it("keeps video captures on media time", () => {
    expect(
      getTimelineThumbnailCaptureTimeSeconds(
        { ...baseElement, start: 4.3, duration: 5.5, playbackStart: 20 },
        { kind: "video", sourcePath: "assets/demo.mp4" },
      ),
    ).toBe(22.75);
  });
});
