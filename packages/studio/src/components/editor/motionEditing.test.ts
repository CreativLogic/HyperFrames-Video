import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import {
  buildMotionAgentContext,
  buildMotionCurveModel,
  buildDomEditMotionPatchOperations,
  buildDomEditMotionPatchOperation,
  buildMotionVarsAttribute,
  buildMotionVarsId,
  clampMotionDraftToTimeline,
  detectMotionOwnership,
  formatMotionBezierEase,
  MOTION_EASE_OPTIONS,
  parseMotionDraft,
  parseMotionBezierEase,
  parseMotionVarsAttribute,
  sampleMotionEase,
  serializeMotionVarsAttribute,
  serializeMotionDraft,
  type MotionDraft,
} from "./motionEditing";

describe("motionEditing", () => {
  it("serializes the default fade-up preset into the data-hf-motion contract", () => {
    const draft: MotionDraft = {
      preset: "fade-up",
      direction: "up",
      start: 0,
      duration: 0.6,
      ease: "outCubic",
      distance: 32,
    };

    expect(serializeMotionDraft(draft)).toBe(
      "v=1;preset=fade-up;start=0;duration=0.6;ease=outCubic;x=0;y=32;opacity=0:1;scale=1:1",
    );
  });

  it("serializes custom two-keyframe tracks into the data-hf-motion contract", () => {
    const draft: MotionDraft = {
      preset: "fade-up",
      direction: "up",
      start: 0.1,
      duration: 1.2,
      ease: "inOutCubic",
      distance: 32,
      keyframes: {
        x: { from: -24, to: 12 },
        y: { from: 48, to: 4 },
        opacity: { from: 0.25, to: 0.9 },
        scale: { from: 0.8, to: 1.1 },
      },
    };

    expect(serializeMotionDraft(draft)).toBe(
      "v=1;preset=fade-up;start=0.1;duration=1.2;ease=inOutCubic;x=-24:12;y=48:4;opacity=0.25:0.9;scale=0.8:1.1",
    );
  });

  it("serializes and parses custom cubic-bezier easing", () => {
    const draft: MotionDraft = {
      preset: "fade-up",
      direction: "up",
      start: 0,
      duration: 0.6,
      ease: "bezier(0.2,1.25,0.4,1)",
      distance: 32,
    };

    expect(serializeMotionDraft(draft)).toContain("ease=bezier(0.2,1.25,0.4,1)");
    expect(parseMotionDraft(serializeMotionDraft(draft))?.ease).toBe("bezier(0.2,1.25,0.4,1)");
    expect(parseMotionBezierEase("cubic-bezier(0.2, 1.25, 0.4, 1)")).toEqual({
      x1: 0.2,
      y1: 1.25,
      x2: 0.4,
      y2: 1,
    });
  });

  it("exposes a broad deterministic easing catalog", () => {
    expect(MOTION_EASE_OPTIONS.map((option) => option.value)).toEqual(
      expect.arrayContaining([
        "linear",
        "ease",
        "outSine",
        "inOutQuad",
        "outCubic",
        "inOutQuart",
        "outExpo",
        "inOutCirc",
        "outBack",
        "outBounce",
        "outElastic",
      ]),
    );
    expect(formatMotionBezierEase({ x1: 0.16, y1: 1, x2: 0.3, y2: 1 })).toBe(
      "bezier(0.16,1,0.3,1)",
    );
    expect(sampleMotionEase("outBack", 0.5)).toBeGreaterThan(1);
    expect(sampleMotionEase("bezier(0,0,1,1)", 0.5)).toBeCloseTo(0.5, 4);
  });

  it("serializes slide direction and distance into x/y offsets", () => {
    const draft: MotionDraft = {
      preset: "slide",
      direction: "left",
      start: 0.25,
      duration: 0.75,
      ease: "linear",
      distance: 48,
    };

    expect(serializeMotionDraft(draft)).toBe(
      "v=1;preset=slide;start=0.25;duration=0.75;ease=linear;x=48;y=0;opacity=1:1;scale=1:1",
    );
  });

  it("serializes pop as opacity plus scale without travel", () => {
    const draft: MotionDraft = {
      preset: "pop",
      direction: "up",
      start: 0,
      duration: 0.4,
      ease: "outCubic",
      distance: 32,
    };

    expect(serializeMotionDraft(draft)).toBe(
      "v=1;preset=pop;start=0;duration=0.4;ease=outCubic;x=0;y=0;opacity=0:1;scale=0.92:1",
    );
  });

  it("clamps motion timing to the timeline duration", () => {
    const draft: MotionDraft = {
      preset: "fade-up",
      direction: "up",
      start: 5,
      duration: 16.05,
      ease: "outCubic",
      distance: 32,
      keyframes: {
        x: { from: 0, to: 0 },
        y: { from: 44, to: 0 },
        opacity: { from: 0, to: 1 },
        scale: { from: 1, to: 1 },
      },
    };

    expect(clampMotionDraftToTimeline(draft, 3)).toEqual({
      ...draft,
      start: 2.95,
      duration: 0.05,
    });
  });

  it("clamps duration against the remaining timeline window", () => {
    expect(
      clampMotionDraftToTimeline(
        {
          preset: "slide",
          direction: "right",
          start: 2.2,
          duration: 2,
          ease: "linear",
          distance: 24,
        },
        3,
      ),
    ).toMatchObject({
      start: 2.2,
      duration: 0.8,
    });
  });

  it("parses authored motion back into editable controls", () => {
    expect(
      parseMotionDraft(
        "v=1;preset=fade-up;start=0.15;duration=0.8;ease=inOutCubic;x=0;y=40;opacity=0:1;scale=1:1",
      ),
    ).toEqual({
      preset: "fade-up",
      direction: "up",
      start: 0.15,
      duration: 0.8,
      ease: "inOutCubic",
      distance: 40,
      keyframes: {
        x: { from: 0, to: 0 },
        y: { from: 40, to: 0 },
        opacity: { from: 0, to: 1 },
        scale: { from: 1, to: 1 },
      },
    });
  });

  it("parses custom two-keyframe tracks back into editable controls", () => {
    expect(
      parseMotionDraft(
        "v=1;preset=slide;start=0.25;duration=0.75;ease=linear;x=-20:10;y=4:-4;opacity=0.2:1;scale=0.75:1.25",
      ),
    ).toEqual({
      preset: "slide",
      direction: "right",
      start: 0.25,
      duration: 0.75,
      ease: "linear",
      distance: 20,
      keyframes: {
        x: { from: -20, to: 10 },
        y: { from: 4, to: -4 },
        opacity: { from: 0.2, to: 1 },
        scale: { from: 0.75, to: 1.25 },
      },
    });
  });

  it("builds set and clear patch operations", () => {
    const draft: MotionDraft = {
      preset: "fade-up",
      direction: "up",
      start: 0,
      duration: 0.6,
      ease: "outCubic",
      distance: 32,
    };

    expect(buildDomEditMotionPatchOperation(draft)).toEqual({
      type: "attribute",
      property: "hf-motion",
      value: "v=1;preset=fade-up;start=0;duration=0.6;ease=outCubic;x=0;y=32;opacity=0:1;scale=1:1",
    });
    expect(buildDomEditMotionPatchOperation(null)).toEqual({
      type: "attribute",
      property: "hf-motion",
      value: null,
    });
    expect(buildDomEditMotionPatchOperations(draft, "headline")).toEqual([
      {
        type: "attribute",
        property: "hf-motion",
        value:
          "v=1;preset=fade-up;start=0;duration=0.6;ease=outCubic;x=0;y=32;opacity=0:1;scale=1:1",
      },
      {
        type: "attribute",
        property: "hf-motion-vars",
        value: "v=1;id=headline;lanes=x,y,scale,rotate,opacity;owner=hf;driver=hf",
      },
    ]);
    expect(buildDomEditMotionPatchOperations(null, "headline")).toEqual([
      { type: "attribute", property: "hf-motion", value: null },
      { type: "attribute", property: "hf-motion-vars", value: null },
    ]);
  });

  it("serializes and parses canonical motion variable lanes", () => {
    expect(buildMotionVarsId("#Hero Title")).toBe("hero-title");
    expect(buildMotionVarsAttribute("hero-title")).toBe(
      "v=1;id=hero-title;lanes=x,y,scale,rotate,opacity;owner=hf;driver=hf",
    );
    expect(
      parseMotionVarsAttribute(
        "v=1;id=hero-title;lanes=x,y,scale,rotate,opacity;owner=hf;driver=hf",
      ),
    ).toEqual({
      version: 1,
      id: "hero-title",
      lanes: ["x", "y", "scale", "rotate", "opacity"],
      owner: "hf",
      driver: "hf",
    });
    expect(parseMotionVarsAttribute("v=1;id=hero;lanes=x,bad;owner=hf;driver=hf")).toBeNull();
  });

  it("serializes external runtime variable lanes through the shared contract", () => {
    const serialized = serializeMotionVarsAttribute({
      version: 1,
      id: "#Hero Title",
      lanes: ["x", "opacity"],
      owner: "gsap",
      driver: "runtime",
    });

    expect(serialized).toBe("v=1;id=hero-title;lanes=x,opacity;owner=gsap;driver=runtime");
    expect(parseMotionVarsAttribute(serialized)).toEqual({
      version: 1,
      id: "hero-title",
      lanes: ["x", "opacity"],
      owner: "gsap",
      driver: "runtime",
    });
  });

  it("maps fade-up into curve tracks with start and end markers", () => {
    const model = buildMotionCurveModel({
      preset: "fade-up",
      direction: "up",
      start: 0.25,
      duration: 0.75,
      ease: "outCubic",
      distance: 40,
    });

    expect(model.windowEnd).toBe(1);
    expect(model.markers).toEqual([
      { label: "Start", time: 0.25, percent: 25 },
      { label: "End", time: 1, percent: 100 },
    ]);
    expect(model.tracks).toMatchObject([
      { key: "x", from: 0, to: 0, unit: "px", active: false },
      { key: "y", from: 40, to: 0, unit: "px", active: true },
      { key: "opacity", from: 0, to: 1, unit: "", active: true },
      { key: "scale", from: 1, to: 1, unit: "", active: false },
    ]);
  });

  it("maps pop into opacity and scale curve tracks", () => {
    const model = buildMotionCurveModel({
      preset: "pop",
      direction: "left",
      start: 0,
      duration: 0.4,
      ease: "outCubic",
      distance: 80,
    });

    expect(model.tracks.map((track) => [track.key, track.from, track.to, track.active])).toEqual([
      ["x", 0, 0, false],
      ["y", 0, 0, false],
      ["opacity", 0, 1, true],
      ["scale", 0.92, 1, true],
    ]);
  });

  it("maps custom keyframes into editable curve tracks", () => {
    const model = buildMotionCurveModel({
      preset: "fade-up",
      direction: "up",
      start: 0,
      duration: 1,
      ease: "linear",
      distance: 32,
      keyframes: {
        x: { from: -8, to: 16 },
        y: { from: 24, to: 0 },
        opacity: { from: 0.25, to: 1 },
        scale: { from: 0.9, to: 1.05 },
      },
    });

    expect(model.tracks.map((track) => [track.key, track.from, track.to, track.active])).toEqual([
      ["x", -8, 16, true],
      ["y", 24, 0, true],
      ["opacity", 0.25, 1, true],
      ["scale", 0.9, 1.05, true],
    ]);
  });

  it("detects editable HyperFrames motion ownership", () => {
    const window = new Window();
    const element = window.document.createElement("div");
    element.setAttribute("data-hf-motion", "v=1;preset=fade-up");
    window.document.body.appendChild(element);

    expect(
      detectMotionOwnership({
        element: element as HTMLElement,
        dataAttributes: { "hf-motion": "v=1;preset=fade-up" },
        computedStyles: {},
      }),
    ).toMatchObject({
      state: "editable",
      badges: [{ kind: "hf-motion", label: "HF Motion", state: "Editable" }],
    });
  });

  it("detects variable-owned HyperFrames motion as editable", () => {
    const window = new Window();
    const element = window.document.createElement("div");
    element.setAttribute("data-hf-motion-vars", buildMotionVarsAttribute("headline"));
    window.document.body.appendChild(element);

    const report = detectMotionOwnership({
      element: element as HTMLElement,
      dataAttributes: { "hf-motion-vars": buildMotionVarsAttribute("headline") },
      computedStyles: {},
    });

    expect(report.state).toBe("editable");
    expect(report.badges).toContainEqual(
      expect.objectContaining({
        kind: "hf-motion",
        label: "HF Motion Vars",
        state: "Editable",
      }),
    );
  });

  it("detects external canonical variable lanes without exposing unsafe editing", () => {
    const window = new Window();
    const element = window.document.createElement("div");
    element.setAttribute(
      "data-hf-motion-vars",
      "v=1;id=headline;lanes=x,y,scale,rotate,opacity;owner=gsap;driver=runtime",
    );
    window.document.body.appendChild(element);

    const report = detectMotionOwnership({
      element: element as HTMLElement,
      dataAttributes: {
        "hf-motion-vars":
          "v=1;id=headline;lanes=x,y,scale,rotate,opacity;owner=gsap;driver=runtime",
      },
      computedStyles: {},
    });

    expect(report).toMatchObject({
      state: "detected",
      editable: false,
      badges: [{ kind: "gsap", label: "GSAP Vars", state: "Detected", editable: false }],
    });
  });

  it("detects read-only external runtime ownership and mixed ownership", () => {
    const window = new Window();
    const element = window.document.createElement("div") as HTMLElement;
    window.document.body.appendChild(element);
    Object.defineProperty(element, "getAnimations", {
      value: () => [{ constructor: { name: "Animation" } }],
    });
    Object.assign(window, {
      __timelines: {
        main: {
          getChildren: () => [{ targets: () => [element] }],
        },
      },
      __hfAnime: [{ animatables: [{ target: element }] }],
    });

    const report = detectMotionOwnership({
      element,
      dataAttributes: {},
      computedStyles: {
        "animation-name": "pulse",
        "animation-duration": "1s",
      },
    });

    expect(report.state).toBe("mixed");
    expect(report.badges.map((badge) => badge.label)).toEqual([
      "CSS",
      "WAAPI",
      "GSAP",
      "anime.js",
      "Mixed",
    ]);
    expect(report.badges.filter((badge) => badge.state === "Editable")).toHaveLength(0);
  });

  it("detects Three ownership for time-driven canvases", () => {
    const window = new Window();
    const canvas = window.document.createElement("canvas") as HTMLElement;
    window.document.body.appendChild(canvas);
    Object.assign(window, { __hfThreeTime: 0 });

    expect(
      detectMotionOwnership({
        element: canvas,
        dataAttributes: {},
        computedStyles: {},
      }).badges,
    ).toMatchObject([{ kind: "three", label: "Three", state: "Detected" }]);
  });

  it("builds motion-aware agent context with curve and runtime guardrails", () => {
    const ownership = detectMotionOwnership({
      dataAttributes: { "hf-motion": "v=1;preset=fade-up" },
      computedStyles: {
        "animation-name": "pulse",
        "animation-duration": "1s",
      },
    });

    const context = buildMotionAgentContext({
      hfMotionAttribute:
        "v=1;preset=fade-up;start=0;duration=0.6;ease=outCubic;x=0;y=32;opacity=0:1;scale=1:1",
      draft: parseMotionDraft(
        "v=1;preset=fade-up;start=0;duration=0.6;ease=outCubic;x=0;y=32;opacity=0:1;scale=1:1",
      ),
      ownership,
    });

    expect(context.version).toBe(1);
    expect(context.owners.map((owner) => `${owner.label}:${owner.state}`)).toEqual([
      "HF Motion:Editable",
      "CSS:Detected",
      "Mixed:Mixed",
    ]);
    expect(context.curveTracks).toContainEqual({
      key: "y",
      label: "Y",
      from: 32,
      to: 0,
      unit: "px",
      active: true,
    });
    expect(
      context.instructions.some((item) => item.includes("Patch the existing runtime library")),
    ).toBe(true);
    expect(context.instructions.some((item) => item.includes("Use an outer layout wrapper"))).toBe(
      true,
    );
  });
});
