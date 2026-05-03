import type { RuntimeDeterministicAdapter } from "../types";

export type HfMotionEasePreset =
  | "linear"
  | "ease"
  | "inSine"
  | "outSine"
  | "inOutSine"
  | "inQuad"
  | "outQuad"
  | "inOutQuad"
  | "inCubic"
  | "outCubic"
  | "inOutCubic"
  | "inQuart"
  | "outQuart"
  | "inOutQuart"
  | "inQuint"
  | "outQuint"
  | "inOutQuint"
  | "inExpo"
  | "outExpo"
  | "inOutExpo"
  | "inCirc"
  | "outCirc"
  | "inOutCirc"
  | "inBack"
  | "outBack"
  | "inOutBack"
  | "inBounce"
  | "outBounce"
  | "inOutBounce"
  | "inElastic"
  | "outElastic"
  | "inOutElastic";

export type HfMotionEase = HfMotionEasePreset | `bezier(${string})`;

export interface HfMotionRange {
  from: number;
  to: number;
}

export interface HfMotionConfig {
  version: 1;
  preset: string;
  start: number;
  duration: number;
  ease: HfMotionEase;
  x: HfMotionRange;
  y: HfMotionRange;
  opacity: HfMotionRange;
  scale: HfMotionRange;
}

export type HfMotionVarLane = "x" | "y" | "scale" | "rotate" | "opacity";
export type HfMotionVarOwner = "hf" | "gsap" | "anime" | "css" | "waapi";
export type HfMotionVarDriver = "hf" | "runtime";

export interface HfMotionVarsConfig {
  version: 1;
  id: string;
  lanes: HfMotionVarLane[];
  owner: HfMotionVarOwner;
  driver: HfMotionVarDriver;
}

type HfMotionEntry = {
  el: HTMLElement;
  attributeValue: string;
  config: HfMotionConfig | null;
  varsAttributeValue: string;
  varsConfig: HfMotionVarsConfig | null;
  baseInlineOpacity: string;
  baseOpacity: number;
  baseInlineTransform: string;
  baseInlineVars: Partial<Record<HfMotionVarName, string>>;
};

const MOTION_ATTR = "data-hf-motion";
const MOTION_VARS_ATTR = "data-hf-motion-vars";
const EPSILON = 0.0001;
const HF_MOTION_TRANSFORM_TEMPLATE =
  "translate3d(var(--hf-motion-x, 0px), var(--hf-motion-y, 0px), 0) rotate(var(--hf-motion-rotate, 0deg)) scale(var(--hf-motion-scale, 1))";
const HF_MOTION_VAR_NAMES = [
  "--hf-motion-x",
  "--hf-motion-y",
  "--hf-motion-scale",
  "--hf-motion-rotate",
  "--hf-motion-opacity",
] as const;
type HfMotionVarName = (typeof HF_MOTION_VAR_NAMES)[number];
const SUPPORTED_VAR_LANES = new Set<HfMotionVarLane>(["x", "y", "scale", "rotate", "opacity"]);
const SUPPORTED_VAR_OWNERS = new Set<HfMotionVarOwner>(["hf", "gsap", "anime", "css", "waapi"]);
const SUPPORTED_VAR_DRIVERS = new Set<HfMotionVarDriver>(["hf", "runtime"]);
let cssPropertiesRegistered = false;
const SUPPORTED_EASES = new Set<string>([
  "linear",
  "ease",
  "inSine",
  "outSine",
  "inOutSine",
  "inQuad",
  "outQuad",
  "inOutQuad",
  "inCubic",
  "outCubic",
  "inOutCubic",
  "inQuart",
  "outQuart",
  "inOutQuart",
  "inQuint",
  "outQuint",
  "inOutQuint",
  "inExpo",
  "outExpo",
  "inOutExpo",
  "inCirc",
  "outCirc",
  "inOutCirc",
  "inBack",
  "outBack",
  "inOutBack",
  "inBounce",
  "outBounce",
  "inOutBounce",
  "inElastic",
  "outElastic",
  "inOutElastic",
]);

interface CubicBezierEase {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function parseHfMotionAttribute(value: string | null | undefined): HfMotionConfig | null {
  if (!value) return null;

  const parts = new Map<string, string>();
  for (const rawPart of value.split(";")) {
    const part = rawPart.trim();
    if (!part) continue;
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) return null;
    const key = part.slice(0, separatorIndex).trim();
    const partValue = part.slice(separatorIndex + 1).trim();
    if (!key || !partValue) return null;
    parts.set(key, partValue);
  }

  if (parts.get("v") !== "1") return null;
  const preset = parts.get("preset");
  if (!preset || !/^[a-z0-9-]{1,40}$/.test(preset)) return null;

  const start = parseFiniteNumber(parts.get("start") ?? "0");
  const duration = parseFiniteNumber(parts.get("duration"));
  if (start == null || start < 0 || duration == null || duration <= 0) return null;

  const ease = normalizeHfMotionEase(parts.get("ease") ?? "linear");
  if (!ease) return null;

  const x = parseRange(parts.get("x"), { from: 0, to: 0 }, 0);
  const y = parseRange(parts.get("y"), { from: 0, to: 0 }, 0);
  const opacity = parseRange(parts.get("opacity"), { from: 1, to: 1 });
  const scale = parseRange(parts.get("scale"), { from: 1, to: 1 });
  if (!x || !y || !opacity || !scale) return null;
  if (!isUnitRange(opacity) || scale.from < 0 || scale.to < 0) return null;

  return {
    version: 1,
    preset,
    start,
    duration,
    ease,
    x,
    y,
    opacity,
    scale,
  };
}

export function parseHfMotionVarsAttribute(
  value: string | null | undefined,
): HfMotionVarsConfig | null {
  if (!value) return null;

  const parts = new Map<string, string>();
  for (const rawPart of value.split(";")) {
    const part = rawPart.trim();
    if (!part) continue;
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) return null;
    const key = part.slice(0, separatorIndex).trim();
    const partValue = part.slice(separatorIndex + 1).trim();
    if (!key || !partValue) return null;
    parts.set(key, partValue);
  }

  if (parts.get("v") !== "1") return null;
  const id = parts.get("id");
  if (!id || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) return null;

  const rawLanes =
    parts
      .get("lanes")
      ?.split(",")
      .map((lane) => lane.trim()) ?? [];
  if (rawLanes.length === 0) return null;
  const lanes: HfMotionVarLane[] = [];
  for (const lane of rawLanes) {
    if (!SUPPORTED_VAR_LANES.has(lane as HfMotionVarLane)) return null;
    if (!lanes.includes(lane as HfMotionVarLane)) lanes.push(lane as HfMotionVarLane);
  }

  const owner = parts.get("owner") as HfMotionVarOwner | undefined;
  if (!owner || !SUPPORTED_VAR_OWNERS.has(owner)) return null;
  const driver = parts.get("driver") as HfMotionVarDriver | undefined;
  if (!driver || !SUPPORTED_VAR_DRIVERS.has(driver)) return null;

  return {
    version: 1,
    id,
    lanes,
    owner,
    driver,
  };
}

export function createHfMotionAdapter(params?: {
  resolveStartSeconds?: (element: Element) => number;
  getCurrentTime?: () => number;
}): RuntimeDeterministicAdapter {
  let entries: HfMotionEntry[] = [];
  const entryByElement = new WeakMap<HTMLElement, HfMotionEntry>();
  let playbackRafId: number | null = null;

  const restoreOpacity = (entry: HfMotionEntry) => {
    if (entry.baseInlineOpacity) {
      entry.el.style.opacity = entry.baseInlineOpacity;
    } else {
      entry.el.style.removeProperty("opacity");
    }
  };

  const restoreTransform = (entry: HfMotionEntry) => {
    if (entry.baseInlineTransform) {
      entry.el.style.transform = entry.baseInlineTransform;
    } else {
      entry.el.style.removeProperty("transform");
    }
  };

  const restoreVars = (entry: HfMotionEntry) => {
    for (const name of HF_MOTION_VAR_NAMES) {
      const value = entry.baseInlineVars[name];
      if (value) {
        entry.el.style.setProperty(name, value);
      } else {
        entry.el.style.removeProperty(name);
      }
    }
  };

  const restoreEntry = (entry: HfMotionEntry) => {
    restoreVars(entry);
    restoreOpacity(entry);
    restoreTransform(entry);
  };

  const syncEntries = () => {
    registerHfMotionCssProperties();
    const nextEntries: HfMotionEntry[] = [];
    const seen = new Set<HTMLElement>();
    const motionElements = document.querySelectorAll(`[${MOTION_ATTR}], [${MOTION_VARS_ATTR}]`);
    for (const rawEl of motionElements) {
      if (!(rawEl instanceof HTMLElement)) continue;
      const attributeValue = rawEl.getAttribute(MOTION_ATTR) ?? "";
      const config = parseHfMotionAttribute(attributeValue);
      const varsAttributeValue = rawEl.getAttribute(MOTION_VARS_ATTR) ?? "";
      const varsConfig = parseHfMotionVarsAttribute(varsAttributeValue);
      if (!config && !varsConfig) continue;

      seen.add(rawEl);
      const existing = entryByElement.get(rawEl);
      if (existing) {
        existing.attributeValue = attributeValue;
        existing.config = config;
        existing.varsAttributeValue = varsAttributeValue;
        existing.varsConfig = varsConfig;
        nextEntries.push(existing);
        continue;
      }

      const nextEntry = {
        el: rawEl,
        attributeValue,
        config,
        varsAttributeValue,
        varsConfig,
        baseInlineOpacity: rawEl.style.opacity || "",
        baseOpacity: resolveBaseOpacity(rawEl),
        baseInlineTransform: rawEl.style.transform || "",
        baseInlineVars: snapshotInlineVars(rawEl),
      };
      entryByElement.set(rawEl, nextEntry);
      nextEntries.push(nextEntry);
    }

    for (const entry of entries) {
      if (seen.has(entry.el)) continue;
      if (entry.el.isConnected) restoreEntry(entry);
      entryByElement.delete(entry.el);
    }

    entries = nextEntries;
  };

  const seekAllAtTime = (timeSeconds: number) => {
    syncEntries();
    const time = Math.max(0, Number(timeSeconds) || 0);
    for (const entry of entries) {
      if (!entry.el.isConnected) continue;
      applyVariableTemplate(entry);
      if (!entry.config) continue;
      applyMotionAtTime(entry, time, params?.resolveStartSeconds);
    }
  };

  const stopPlaybackLoop = () => {
    if (playbackRafId == null) return;
    window.cancelAnimationFrame(playbackRafId);
    playbackRafId = null;
  };

  const tickPlayback = () => {
    playbackRafId = null;
    const getCurrentTime = params?.getCurrentTime;
    if (!getCurrentTime) return;
    seekAllAtTime(getCurrentTime());
    playbackRafId = window.requestAnimationFrame(tickPlayback);
  };

  const startPlaybackLoop = () => {
    if (playbackRafId != null) return;
    syncEntries();
    if (!params?.getCurrentTime || !entries.some((entry) => entry.config)) return;
    seekAllAtTime(params.getCurrentTime());
    playbackRafId = window.requestAnimationFrame(tickPlayback);
  };

  return {
    name: "hf-motion",

    discover: () => {
      syncEntries();
    },

    seek: (ctx) => {
      seekAllAtTime(ctx.time);
    },

    pause: () => {
      stopPlaybackLoop();
    },

    play: () => {
      startPlaybackLoop();
    },

    revert: () => {
      stopPlaybackLoop();
      for (const entry of entries) {
        if (!entry.el.isConnected) continue;
        restoreEntry(entry);
      }
      entries = [];
    },
  };
}

function parseFiniteNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && String(value).trim() !== "" ? parsed : null;
}

function parseRange(
  value: string | undefined,
  fallback: HfMotionRange,
  singleValueTo?: number,
): HfMotionRange | null {
  if (value == null || value.trim() === "") return fallback;
  const parts = value.split(":");
  if (parts.length > 2) return null;
  const from = parseFiniteNumber(parts[0]);
  if (from == null) return null;
  const to =
    parts.length === 2 ? parseFiniteNumber(parts[1]) : singleValueTo != null ? singleValueTo : from;
  if (to == null) return null;
  return { from, to };
}

function isUnitRange(range: HfMotionRange): boolean {
  return range.from >= 0 && range.from <= 1 && range.to >= 0 && range.to <= 1;
}

function resolveBaseOpacity(el: HTMLElement): number {
  const inlineOpacity = parseFiniteNumber(el.style.opacity);
  if (inlineOpacity != null) return inlineOpacity;
  try {
    const computedOpacity = parseFiniteNumber(window.getComputedStyle(el).opacity);
    return computedOpacity ?? 1;
  } catch {
    return 1;
  }
}

function applyMotionAtTime(
  entry: HfMotionEntry,
  time: number,
  resolveStartSeconds: ((element: Element) => number) | undefined,
): void {
  if (!entry.config) return;
  const clipStart = resolveStartSeconds ? resolveStartSeconds(entry.el) : 0;
  const localTime = time - Math.max(0, Number(clipStart) || 0) - entry.config.start;
  const rawProgress = localTime / entry.config.duration;
  const progress = easeProgress(clamp(rawProgress, 0, 1), entry.config.ease);
  const x = interpolate(entry.config.x, progress);
  const y = interpolate(entry.config.y, progress);
  const opacityMultiplier = interpolate(entry.config.opacity, progress);
  const scale = interpolate(entry.config.scale, progress);

  if (entry.varsConfig?.driver === "hf") {
    applyVariableMotion(entry, x, y, scale, entry.baseOpacity * opacityMultiplier);
    return;
  }

  applyOpacity(entry, entry.baseOpacity * opacityMultiplier);
  applyTransform(entry, x, y, scale);
}

function snapshotInlineVars(el: HTMLElement): Partial<Record<HfMotionVarName, string>> {
  const vars: Partial<Record<HfMotionVarName, string>> = {};
  for (const name of HF_MOTION_VAR_NAMES) {
    const value = el.style.getPropertyValue(name);
    if (value) vars[name] = value;
  }
  return vars;
}

function registerHfMotionCssProperties(): void {
  if (cssPropertiesRegistered) return;
  cssPropertiesRegistered = true;
  const cssGlobal = window.CSS as
    | (typeof CSS & {
        registerProperty?: (definition: {
          name: string;
          syntax: string;
          inherits: boolean;
          initialValue: string;
        }) => void;
      })
    | undefined;
  const registerProperty = cssGlobal?.registerProperty;
  if (typeof registerProperty !== "function") return;

  const definitions = [
    { name: "--hf-motion-x", syntax: "<length>", initialValue: "0px" },
    { name: "--hf-motion-y", syntax: "<length>", initialValue: "0px" },
    { name: "--hf-motion-scale", syntax: "<number>", initialValue: "1" },
    { name: "--hf-motion-rotate", syntax: "<angle>", initialValue: "0deg" },
    { name: "--hf-motion-opacity", syntax: "<number>", initialValue: "1" },
  ];

  for (const definition of definitions) {
    try {
      registerProperty.call(cssGlobal, {
        ...definition,
        inherits: false,
      });
    } catch {
      // Browsers throw when a custom property is registered twice.
    }
  }
}

function applyVariableTemplate(entry: HfMotionEntry): void {
  if (!entry.varsConfig) return;
  const baseTransform = entry.baseInlineTransform.trim();
  entry.el.style.transform = baseTransform
    ? `${baseTransform} ${HF_MOTION_TRANSFORM_TEMPLATE}`
    : HF_MOTION_TRANSFORM_TEMPLATE;
  entry.el.style.opacity = `var(--hf-motion-opacity, ${formatNumber(entry.baseOpacity)})`;
}

function applyVariableMotion(
  entry: HfMotionEntry,
  x: number,
  y: number,
  scale: number,
  opacity: number,
): void {
  applyVariableTemplate(entry);
  const clampedScale = Math.max(0, scale);
  entry.el.style.setProperty("--hf-motion-x", `${formatNumber(x)}px`);
  entry.el.style.setProperty("--hf-motion-y", `${formatNumber(y)}px`);
  entry.el.style.setProperty("--hf-motion-scale", formatNumber(clampedScale));
  entry.el.style.setProperty("--hf-motion-rotate", "0deg");
  entry.el.style.setProperty("--hf-motion-opacity", formatNumber(clamp(opacity, 0, 1)));
}

function applyOpacity(entry: HfMotionEntry, value: number): void {
  const clampedValue = clamp(value, 0, 1);
  if (Math.abs(clampedValue - entry.baseOpacity) < EPSILON) {
    if (entry.baseInlineOpacity) {
      entry.el.style.opacity = entry.baseInlineOpacity;
    } else {
      entry.el.style.removeProperty("opacity");
    }
    return;
  }
  entry.el.style.opacity = formatNumber(clampedValue);
}

function applyTransform(entry: HfMotionEntry, x: number, y: number, scale: number): void {
  const clampedScale = Math.max(0, scale);
  const isNeutral =
    Math.abs(x) < EPSILON && Math.abs(y) < EPSILON && Math.abs(clampedScale - 1) < EPSILON;
  if (isNeutral) {
    if (entry.baseInlineTransform) {
      entry.el.style.transform = entry.baseInlineTransform;
    } else {
      entry.el.style.removeProperty("transform");
    }
    return;
  }

  const motionTransform = `translate(${formatNumber(x)}px, ${formatNumber(y)}px) scale(${formatNumber(
    clampedScale,
  )})`;
  entry.el.style.transform = [entry.baseInlineTransform, motionTransform].filter(Boolean).join(" ");
}

function interpolate(range: HfMotionRange, progress: number): number {
  return range.from + (range.to - range.from) * progress;
}

function easeProgress(progress: number, ease: HfMotionEase): number {
  const bezier = parseHfMotionBezierEase(ease);
  if (bezier) return cubicBezierProgress(progress, bezier);

  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  const c3 = c1 + 1;
  const c4 = (2 * Math.PI) / 3;
  const c5 = (2 * Math.PI) / 4.5;

  switch (ease) {
    case "ease":
      return cubicBezierProgress(progress, { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 });
    case "inSine":
      return 1 - Math.cos((progress * Math.PI) / 2);
    case "outSine":
      return Math.sin((progress * Math.PI) / 2);
    case "inOutSine":
      return -(Math.cos(Math.PI * progress) - 1) / 2;
    case "inQuad":
      return progress * progress;
    case "outQuad":
      return 1 - (1 - progress) * (1 - progress);
    case "inOutQuad":
      return progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    case "inCubic":
      return progress * progress * progress;
    case "outCubic":
      return 1 - Math.pow(1 - progress, 3);
    case "inOutCubic":
      return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    case "inQuart":
      return progress * progress * progress * progress;
    case "outQuart":
      return 1 - Math.pow(1 - progress, 4);
    case "inOutQuart":
      return progress < 0.5 ? 8 * Math.pow(progress, 4) : 1 - Math.pow(-2 * progress + 2, 4) / 2;
    case "inQuint":
      return Math.pow(progress, 5);
    case "outQuint":
      return 1 - Math.pow(1 - progress, 5);
    case "inOutQuint":
      return progress < 0.5 ? 16 * Math.pow(progress, 5) : 1 - Math.pow(-2 * progress + 2, 5) / 2;
    case "inExpo":
      return progress === 0 ? 0 : Math.pow(2, 10 * progress - 10);
    case "outExpo":
      return progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    case "inOutExpo":
      return progress === 0
        ? 0
        : progress === 1
          ? 1
          : progress < 0.5
            ? Math.pow(2, 20 * progress - 10) / 2
            : (2 - Math.pow(2, -20 * progress + 10)) / 2;
    case "inCirc":
      return 1 - Math.sqrt(1 - Math.pow(progress, 2));
    case "outCirc":
      return Math.sqrt(1 - Math.pow(progress - 1, 2));
    case "inOutCirc":
      return progress < 0.5
        ? (1 - Math.sqrt(1 - Math.pow(2 * progress, 2))) / 2
        : (Math.sqrt(1 - Math.pow(-2 * progress + 2, 2)) + 1) / 2;
    case "inBack":
      return c3 * progress * progress * progress - c1 * progress * progress;
    case "outBack":
      return 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
    case "inOutBack":
      return progress < 0.5
        ? (Math.pow(2 * progress, 2) * ((c2 + 1) * 2 * progress - c2)) / 2
        : (Math.pow(2 * progress - 2, 2) * ((c2 + 1) * (progress * 2 - 2) + c2) + 2) / 2;
    case "inBounce":
      return 1 - outBounce(1 - progress);
    case "outBounce":
      return outBounce(progress);
    case "inOutBounce":
      return progress < 0.5
        ? (1 - outBounce(1 - 2 * progress)) / 2
        : (1 + outBounce(2 * progress - 1)) / 2;
    case "inElastic":
      return progress === 0
        ? 0
        : progress === 1
          ? 1
          : -Math.pow(2, 10 * progress - 10) * Math.sin((progress * 10 - 10.75) * c4);
    case "outElastic":
      return progress === 0
        ? 0
        : progress === 1
          ? 1
          : Math.pow(2, -10 * progress) * Math.sin((progress * 10 - 0.75) * c4) + 1;
    case "inOutElastic":
      return progress === 0
        ? 0
        : progress === 1
          ? 1
          : progress < 0.5
            ? -(Math.pow(2, 20 * progress - 10) * Math.sin((20 * progress - 11.125) * c5)) / 2
            : (Math.pow(2, -20 * progress + 10) * Math.sin((20 * progress - 11.125) * c5)) / 2 + 1;
    case "linear":
    default:
      return progress;
  }
}

function normalizeHfMotionEase(value: string): HfMotionEase | null {
  const trimmed = value.trim();
  if (isHfMotionEasePreset(trimmed)) return trimmed;
  const bezier = parseHfMotionBezierEase(trimmed);
  return bezier ? formatBezierEase(bezier) : null;
}

function isHfMotionEasePreset(value: string): value is HfMotionEasePreset {
  return SUPPORTED_EASES.has(value);
}

function parseHfMotionBezierEase(value: string): CubicBezierEase | null {
  const trimmed = value.trim();
  const bezierPrefix = "bezier(";
  const cssPrefix = "cubic-bezier(";
  const prefix = trimmed.startsWith(bezierPrefix)
    ? bezierPrefix
    : trimmed.startsWith(cssPrefix)
      ? cssPrefix
      : null;
  if (!prefix || !trimmed.endsWith(")")) return null;

  const body = trimmed.slice(prefix.length, -1);
  const parts = body.split(",").map((part) => parseFiniteNumber(part));
  if (parts.length !== 4 || parts.some((part) => part == null)) return null;
  const [x1, y1, x2, y2] = parts;
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null;
  if (y1 < -4 || y1 > 4 || y2 < -4 || y2 > 4) return null;
  return { x1, y1, x2, y2 };
}

function formatBezierEase(bezier: CubicBezierEase): HfMotionEase {
  return `bezier(${formatNumber(bezier.x1)},${formatNumber(bezier.y1)},${formatNumber(
    bezier.x2,
  )},${formatNumber(bezier.y2)})`;
}

function cubicBezierProgress(progress: number, bezier: CubicBezierEase): number {
  if (progress <= 0 || progress >= 1) return progress;

  let t = progress;
  for (let index = 0; index < 8; index += 1) {
    const x = cubicBezierAxis(t, bezier.x1, bezier.x2) - progress;
    const dx = cubicBezierAxisDerivative(t, bezier.x1, bezier.x2);
    if (Math.abs(x) < 0.000001) break;
    if (Math.abs(dx) < 0.000001) {
      t = solveBezierTByBisection(progress, bezier);
      break;
    }
    t = clamp(t - x / dx, 0, 1);
  }

  return cubicBezierAxis(t, bezier.y1, bezier.y2);
}

function solveBezierTByBisection(progress: number, bezier: CubicBezierEase): number {
  let lower = 0;
  let upper = 1;
  let t = progress;
  for (let index = 0; index < 16; index += 1) {
    t = (lower + upper) / 2;
    const x = cubicBezierAxis(t, bezier.x1, bezier.x2);
    if (Math.abs(x - progress) < 0.000001) break;
    if (x < progress) {
      lower = t;
    } else {
      upper = t;
    }
  }
  return t;
}

function cubicBezierAxis(t: number, p1: number, p2: number): number {
  const inverseT = 1 - t;
  return 3 * inverseT * inverseT * t * p1 + 3 * inverseT * t * t * p2 + t * t * t;
}

function cubicBezierAxisDerivative(t: number, p1: number, p2: number): number {
  const inverseT = 1 - t;
  return 3 * inverseT * inverseT * p1 + 6 * inverseT * t * (p2 - p1) + 3 * t * t * (1 - p2);
}

function outBounce(progress: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (progress < 1 / d1) return n1 * progress * progress;
  if (progress < 2 / d1) {
    const shifted = progress - 1.5 / d1;
    return n1 * shifted * shifted + 0.75;
  }
  if (progress < 2.5 / d1) {
    const shifted = progress - 2.25 / d1;
    return n1 * shifted * shifted + 0.9375;
  }
  const shifted = progress - 2.625 / d1;
  return n1 * shifted * shifted + 0.984375;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number): string {
  const normalized = Math.abs(value) < EPSILON ? 0 : value;
  const rounded = Math.round(normalized * 10000) / 10000;
  return Number.isInteger(rounded)
    ? `${rounded}`
    : rounded.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
