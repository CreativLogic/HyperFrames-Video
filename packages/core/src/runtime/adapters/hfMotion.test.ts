import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHfMotionAdapter,
  parseHfMotionAttribute,
  parseHfMotionVarsAttribute,
} from "./hfMotion";

describe("hf motion adapter", () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  afterEach(() => {
    document.body.innerHTML = "";
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it("has correct name", () => {
    expect(createHfMotionAdapter().name).toBe("hf-motion");
  });

  it("parses the v1 data-hf-motion contract", () => {
    expect(
      parseHfMotionAttribute(
        "v=1;preset=fade-up;start=0;duration=0.6;ease=outCubic;x=0;y=32;opacity=0:1;scale=1:1",
      ),
    ).toEqual({
      version: 1,
      preset: "fade-up",
      start: 0,
      duration: 0.6,
      ease: "outCubic",
      x: { from: 0, to: 0 },
      y: { from: 32, to: 0 },
      opacity: { from: 0, to: 1 },
      scale: { from: 1, to: 1 },
    });
  });

  it("parses extended and custom easing values", () => {
    expect(
      parseHfMotionAttribute(
        "v=1;preset=fade-up;start=0;duration=0.6;ease=outBack;x=0;y=32;opacity=0:1;scale=1:1",
      )?.ease,
    ).toBe("outBack");
    expect(
      parseHfMotionAttribute(
        "v=1;preset=fade-up;start=0;duration=0.6;ease=cubic-bezier(0.2,1.25,0.4,1);x=0;y=32;opacity=0:1;scale=1:1",
      )?.ease,
    ).toBe("bezier(0.2,1.25,0.4,1)");
    expect(
      parseHfMotionAttribute(
        "v=1;preset=fade-up;start=0;duration=0.6;ease=bezier(1.2,0,0.4,1);x=0;y=32;opacity=0:1;scale=1:1",
      ),
    ).toBeNull();
  });

  it("rejects malformed motion values without throwing", () => {
    expect(parseHfMotionAttribute("v=2;preset=fade-up;duration=0.6")).toBeNull();
    expect(parseHfMotionAttribute("v=1;preset=fade-up;duration=-1")).toBeNull();
    expect(parseHfMotionAttribute("v=1;preset=<script>;duration=1")).toBeNull();
    expect(() => parseHfMotionAttribute("v=1;preset=fade-up;duration=abc")).not.toThrow();
  });

  it("parses the v1 data-hf-motion-vars contract", () => {
    expect(
      parseHfMotionVarsAttribute(
        "v=1;id=headline;lanes=x,y,scale,rotate,opacity;owner=hf;driver=hf",
      ),
    ).toEqual({
      version: 1,
      id: "headline",
      lanes: ["x", "y", "scale", "rotate", "opacity"],
      owner: "hf",
      driver: "hf",
    });

    expect(
      parseHfMotionVarsAttribute("v=1;id=headline;lanes=x,unknown;owner=hf;driver=hf"),
    ).toBeNull();
    expect(
      parseHfMotionVarsAttribute("v=1;id=headline;lanes=x;owner=lottie;driver=runtime"),
    ).toBeNull();
  });

  it("seeks custom cubic-bezier easing deterministically", () => {
    const el = document.createElement("div");
    el.setAttribute(
      "data-hf-motion",
      "v=1;preset=fade-up;start=0;duration=1;ease=bezier(0,0,1,1);x=0;y=20;opacity=1:1;scale=1:1",
    );
    document.body.appendChild(el);

    const adapter = createHfMotionAdapter();
    adapter.discover();
    adapter.seek({ time: 0.5 });

    expect(el.style.transform).toBe("translate(0px, 10px) scale(1)");
  });

  it("writes deterministic HF Motion into canonical CSS variable lanes", () => {
    const el = document.createElement("div");
    el.style.opacity = "0.5";
    el.style.transform = "rotate(3deg)";
    el.setAttribute(
      "data-hf-motion",
      "v=1;preset=fade-up;start=0;duration=1;ease=linear;x=0;y=20;opacity=0:1;scale=1:1",
    );
    el.setAttribute(
      "data-hf-motion-vars",
      "v=1;id=headline;lanes=x,y,scale,rotate,opacity;owner=hf;driver=hf",
    );
    document.body.appendChild(el);

    const adapter = createHfMotionAdapter();
    adapter.discover();
    adapter.seek({ time: 0.5 });

    expect(el.style.getPropertyValue("--hf-motion-x")).toBe("0px");
    expect(el.style.getPropertyValue("--hf-motion-y")).toBe("10px");
    expect(el.style.getPropertyValue("--hf-motion-scale")).toBe("1");
    expect(el.style.getPropertyValue("--hf-motion-rotate")).toBe("0deg");
    expect(el.style.getPropertyValue("--hf-motion-opacity")).toBe("0.25");
    expect(el.style.transform).toBe(
      "rotate(3deg) translate3d(var(--hf-motion-x, 0px), var(--hf-motion-y, 0px), 0) rotate(var(--hf-motion-rotate, 0deg)) scale(var(--hf-motion-scale, 1))",
    );
    expect(el.style.opacity).toBe("var(--hf-motion-opacity, 0.5)");
  });

  it("applies the variable transform template for runtime-driven variable lanes", () => {
    const el = document.createElement("div");
    el.setAttribute(
      "data-hf-motion-vars",
      "v=1;id=headline;lanes=x,y,scale,rotate,opacity;owner=gsap;driver=runtime",
    );
    document.body.appendChild(el);

    const adapter = createHfMotionAdapter();
    adapter.discover();
    adapter.seek({ time: 0.5 });

    expect(el.style.transform).toBe(
      "translate3d(var(--hf-motion-x, 0px), var(--hf-motion-y, 0px), 0) rotate(var(--hf-motion-rotate, 0deg)) scale(var(--hf-motion-scale, 1))",
    );
    expect(el.style.getPropertyValue("--hf-motion-x")).toBe("");
  });

  it("seeks authored motion deterministically and clamps progress", () => {
    const el = document.createElement("div");
    el.style.opacity = "0.5";
    el.setAttribute(
      "data-hf-motion",
      "v=1;preset=fade-up;start=0;duration=1;ease=linear;x=0;y=20;opacity=0:1;scale=1:1",
    );
    document.body.appendChild(el);

    const adapter = createHfMotionAdapter();
    adapter.discover();

    adapter.seek({ time: -1 });
    expect(el.style.opacity).toBe("0");
    expect(el.style.transform).toBe("translate(0px, 20px) scale(1)");

    adapter.seek({ time: 0.5 });
    expect(el.style.opacity).toBe("0.25");
    expect(el.style.transform).toBe("translate(0px, 10px) scale(1)");

    adapter.seek({ time: 2 });
    expect(el.style.opacity).toBe("0.5");
    expect(el.style.transform).toBe("");
  });

  it("drives authored motion while runtime playback is active", () => {
    let currentTime = 0;
    let nextFrameId = 1;
    const callbacks = new Map<number, FrameRequestCallback>();
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId;
      nextFrameId += 1;
      callbacks.set(id, callback);
      return id;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = vi.fn((id: number) => {
      callbacks.delete(id);
    }) as typeof window.cancelAnimationFrame;

    const el = document.createElement("div");
    el.setAttribute(
      "data-hf-motion",
      "v=1;preset=fade-up;start=0;duration=1;ease=linear;x=0;y=20;opacity=1:1;scale=1:1",
    );
    document.body.appendChild(el);

    const adapter = createHfMotionAdapter({ getCurrentTime: () => currentTime });
    adapter.discover();
    adapter.play?.();

    expect(el.style.transform).toBe("translate(0px, 20px) scale(1)");

    currentTime = 0.5;
    const firstFrame = callbacks.entries().next().value as
      | [number, FrameRequestCallback]
      | undefined;
    expect(firstFrame).toBeDefined();
    if (firstFrame) {
      callbacks.delete(firstFrame[0]);
      firstFrame[1](16);
    }

    expect(el.style.transform).toBe("translate(0px, 10px) scale(1)");
    expect(callbacks.size).toBe(1);

    adapter.pause();

    expect(callbacks.size).toBe(0);
  });

  it("resolves motion start relative to the selected element", () => {
    const el = document.createElement("div");
    el.setAttribute(
      "data-hf-motion",
      "v=1;preset=fade-up;start=0.5;duration=1;ease=linear;x=0;y=40;opacity=0:1;scale=1:1",
    );
    document.body.appendChild(el);

    const adapter = createHfMotionAdapter({ resolveStartSeconds: () => 2 });
    adapter.discover();

    adapter.seek({ time: 2.5 });
    expect(el.style.opacity).toBe("0");
    expect(el.style.transform).toBe("translate(0px, 40px) scale(1)");

    adapter.seek({ time: 3 });
    expect(el.style.opacity).toBe("0.5");
    expect(el.style.transform).toBe("translate(0px, 20px) scale(1)");
  });

  it("appends authored transform to the base transform", () => {
    const el = document.createElement("div");
    el.style.transform = "rotate(3deg)";
    el.setAttribute(
      "data-hf-motion",
      "v=1;preset=slide;start=0;duration=1;ease=linear;x=20;y=0;opacity=1:1;scale=1:1",
    );
    document.body.appendChild(el);

    const adapter = createHfMotionAdapter();
    adapter.discover();
    adapter.seek({ time: 0.5 });

    expect(el.style.transform).toBe("rotate(3deg) translate(10px, 0px) scale(1)");
  });

  it("reverts inline styles it owns", () => {
    const el = document.createElement("div");
    el.style.opacity = "0.4";
    el.style.transform = "rotate(3deg)";
    el.setAttribute(
      "data-hf-motion",
      "v=1;preset=pop;start=0;duration=1;ease=linear;x=0;y=0;opacity=0:1;scale=0.9:1",
    );
    document.body.appendChild(el);

    const adapter = createHfMotionAdapter();
    adapter.discover();
    adapter.seek({ time: 0.5 });
    expect(el.style.opacity).toBe("0.2");
    expect(el.style.transform).toBe("rotate(3deg) translate(0px, 0px) scale(0.95)");

    adapter.revert?.();
    expect(el.style.opacity).toBe("0.4");
    expect(el.style.transform).toBe("rotate(3deg)");
  });
});
