import type { PatchOperation } from "../../utils/sourcePatcher";

export type MotionPreset = "fade-up" | "slide" | "pop";
export type MotionDirection = "up" | "down" | "left" | "right";
export type MotionEasePreset =
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
export type MotionEase = MotionEasePreset | `bezier(${string})`;
export type MotionCurveTrackKey = "x" | "y" | "opacity" | "scale";
export type MotionVariableLane = "x" | "y" | "scale" | "rotate" | "opacity";
export type MotionVariableOwner = "hf" | "gsap" | "anime" | "css" | "waapi";
export type MotionVariableDriver = "hf" | "runtime";
export type MotionOwnershipKind =
  | "hf-motion"
  | "css"
  | "waapi"
  | "gsap"
  | "animejs"
  | "three"
  | "mixed"
  | "unsafe";
export type MotionOwnershipState = "Editable" | "Detected" | "Mixed" | "Unsafe";

export interface MotionKeyframeRange {
  from: number;
  to: number;
}

export interface MotionKeyframes {
  x: MotionKeyframeRange;
  y: MotionKeyframeRange;
  opacity: MotionKeyframeRange;
  scale: MotionKeyframeRange;
}

export interface MotionDraft {
  preset: MotionPreset;
  direction: MotionDirection;
  start: number;
  duration: number;
  ease: MotionEase;
  distance: number;
  keyframes?: MotionKeyframes;
}

export interface MotionCurveMarker {
  label: string;
  time: number;
  percent: number;
}

export interface MotionCurveTrack {
  key: MotionCurveTrackKey;
  label: string;
  from: number;
  to: number;
  unit: "px" | "";
  active: boolean;
  points: Array<{ percent: number; value: number }>;
}

export interface MotionCurveModel {
  start: number;
  duration: number;
  end: number;
  windowEnd: number;
  ease: MotionEase;
  markers: MotionCurveMarker[];
  tracks: MotionCurveTrack[];
}

export interface MotionOwnershipBadge {
  kind: MotionOwnershipKind;
  label: string;
  state: MotionOwnershipState;
  editable: boolean;
  description: string;
}

export interface MotionOwnershipReport {
  state: "none" | "editable" | "detected" | "mixed" | "unsafe";
  badges: MotionOwnershipBadge[];
  editable: boolean;
  summary: string;
}

export interface MotionOwnershipInput {
  element?: HTMLElement | null;
  dataAttributes?: Record<string, string>;
  computedStyles?: Record<string, string>;
}

export interface MotionAgentOwner {
  label: string;
  state: MotionOwnershipState;
  editable: boolean;
}

export interface MotionAgentCurveTrack {
  key: MotionCurveTrackKey;
  label: string;
  from: number;
  to: number;
  unit: "px" | "";
  active: boolean;
}

export interface MotionAgentContext {
  version: 1;
  state: MotionOwnershipReport["state"];
  summary: string;
  hfMotionAttribute?: string;
  owners: MotionAgentOwner[];
  curveTracks: MotionAgentCurveTrack[];
  instructions: string[];
}

export interface MotionEaseOption {
  label: string;
  value: MotionEasePreset;
  group: "Basic" | "Sine" | "Quad" | "Cubic" | "Quart" | "Quint" | "Expo" | "Circ" | "Back" | "FX";
}

export interface MotionBezierEase {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MotionVarsConfig {
  version: 1;
  id: string;
  lanes: MotionVariableLane[];
  owner: MotionVariableOwner;
  driver: MotionVariableDriver;
}

export type MotionEditConfidence = "safe" | "needs-import" | "read-only" | "unsafe";

export interface MotionVariableLanePatch {
  lane: MotionVariableLane;
  keyframes: MotionKeyframeRange;
}

export interface MotionVariableSourcePatch {
  confidence: "safe";
  operations: PatchOperation[];
}

export interface MotionVariableAdapterEditContract<TTarget = unknown> {
  detect: (target: TTarget) => MotionOwnershipReport;
  canImport: (target: TTarget) => MotionEditConfidence;
  importToVariableLanes: (target: TTarget) => MotionVariableSourcePatch | null;
  canPatch: (target: TTarget) => MotionEditConfidence;
  patchVariableLane: (
    target: TTarget,
    lane: MotionVariableLane,
    keyframes: MotionKeyframeRange,
  ) => MotionVariableSourcePatch | null;
}

const MOTION_VERSION = 1;
const DEFAULT_START = 0;
const DEFAULT_DISTANCE = 32;
const DEFAULT_DURATION = 0.6;
const MIN_MOTION_DURATION = 0.05;
const POP_DURATION = 0.4;
const POP_SCALE_FROM = 0.92;
const SUPPORTED_PRESETS = new Set<MotionPreset>(["fade-up", "slide", "pop"]);
const SUPPORTED_DIRECTIONS = new Set<MotionDirection>(["up", "down", "left", "right"]);
const MOTION_VAR_LANES: MotionVariableLane[] = ["x", "y", "scale", "rotate", "opacity"];
const SUPPORTED_MOTION_VAR_LANES = new Set<MotionVariableLane>(MOTION_VAR_LANES);
const SUPPORTED_MOTION_VAR_OWNERS = new Set<MotionVariableOwner>([
  "hf",
  "gsap",
  "anime",
  "css",
  "waapi",
]);
const SUPPORTED_MOTION_VAR_DRIVERS = new Set<MotionVariableDriver>(["hf", "runtime"]);
export const DEFAULT_CUSTOM_MOTION_BEZIER: MotionBezierEase = {
  x1: 0.16,
  y1: 1,
  x2: 0.3,
  y2: 1,
};
export const MOTION_EASE_OPTIONS: MotionEaseOption[] = [
  { label: "Linear", value: "linear", group: "Basic" },
  { label: "CSS Ease", value: "ease", group: "Basic" },
  { label: "In Sine", value: "inSine", group: "Sine" },
  { label: "Out Sine", value: "outSine", group: "Sine" },
  { label: "In Out Sine", value: "inOutSine", group: "Sine" },
  { label: "In Quad", value: "inQuad", group: "Quad" },
  { label: "Out Quad", value: "outQuad", group: "Quad" },
  { label: "In Out Quad", value: "inOutQuad", group: "Quad" },
  { label: "In Cubic", value: "inCubic", group: "Cubic" },
  { label: "Out Cubic", value: "outCubic", group: "Cubic" },
  { label: "In Out Cubic", value: "inOutCubic", group: "Cubic" },
  { label: "In Quart", value: "inQuart", group: "Quart" },
  { label: "Out Quart", value: "outQuart", group: "Quart" },
  { label: "In Out Quart", value: "inOutQuart", group: "Quart" },
  { label: "In Quint", value: "inQuint", group: "Quint" },
  { label: "Out Quint", value: "outQuint", group: "Quint" },
  { label: "In Out Quint", value: "inOutQuint", group: "Quint" },
  { label: "In Expo", value: "inExpo", group: "Expo" },
  { label: "Out Expo", value: "outExpo", group: "Expo" },
  { label: "In Out Expo", value: "inOutExpo", group: "Expo" },
  { label: "In Circ", value: "inCirc", group: "Circ" },
  { label: "Out Circ", value: "outCirc", group: "Circ" },
  { label: "In Out Circ", value: "inOutCirc", group: "Circ" },
  { label: "In Back", value: "inBack", group: "Back" },
  { label: "Out Back", value: "outBack", group: "Back" },
  { label: "In Out Back", value: "inOutBack", group: "Back" },
  { label: "In Bounce", value: "inBounce", group: "FX" },
  { label: "Out Bounce", value: "outBounce", group: "FX" },
  { label: "In Out Bounce", value: "inOutBounce", group: "FX" },
  { label: "In Elastic", value: "inElastic", group: "FX" },
  { label: "Out Elastic", value: "outElastic", group: "FX" },
  { label: "In Out Elastic", value: "inOutElastic", group: "FX" },
];
const SUPPORTED_EASES = new Set<string>(MOTION_EASE_OPTIONS.map((option) => option.value));

interface ParsedMotionAttribute {
  preset: MotionPreset;
  start: number;
  duration: number;
  ease: MotionEase;
  keyframes: MotionKeyframes;
}

export function buildDefaultMotionDraft(
  preset: MotionPreset = "fade-up",
  base?: Partial<MotionDraft>,
): MotionDraft {
  const draft = {
    preset,
    direction: base?.direction && SUPPORTED_DIRECTIONS.has(base.direction) ? base.direction : "up",
    start: normalizeFiniteNumber(base?.start, DEFAULT_START, 0),
    duration:
      preset === "pop"
        ? normalizeFiniteNumber(base?.duration, POP_DURATION, MIN_MOTION_DURATION)
        : normalizeFiniteNumber(base?.duration, DEFAULT_DURATION, MIN_MOTION_DURATION),
    ease: base?.ease ? (normalizeMotionEase(base.ease) ?? "outCubic") : "outCubic",
    distance: normalizeFiniteNumber(base?.distance, DEFAULT_DISTANCE, 0),
  };

  if (!base?.keyframes) return draft;
  return {
    ...draft,
    keyframes: normalizeMotionKeyframes(base.keyframes, getPresetKeyframes(draft)),
  };
}

export function clampMotionDraftToTimeline(
  draft: MotionDraft,
  timelineDuration: number | null | undefined,
): MotionDraft {
  const normalized = buildDefaultMotionDraft(draft.preset, draft);
  if (timelineDuration == null || !Number.isFinite(timelineDuration) || timelineDuration <= 0) {
    return normalized;
  }

  const maxTimelineTime = Math.max(MIN_MOTION_DURATION, timelineDuration);
  const maxStart = Math.max(0, maxTimelineTime - MIN_MOTION_DURATION);
  const start = roundMotionNumber(Math.min(maxStart, Math.max(0, normalized.start)));
  const durationMax = Math.max(MIN_MOTION_DURATION, maxTimelineTime - start);
  const duration = roundMotionNumber(
    Math.min(durationMax, Math.max(MIN_MOTION_DURATION, normalized.duration)),
  );

  return {
    ...normalized,
    start,
    duration,
  };
}

export function serializeMotionDraft(draft: MotionDraft): string {
  const normalized = buildDefaultMotionDraft(draft.preset, draft);
  const keyframes = resolveMotionKeyframes(normalized);

  return [
    `v=${MOTION_VERSION}`,
    `preset=${normalized.preset}`,
    `start=${formatNumber(normalized.start)}`,
    `duration=${formatNumber(normalized.duration)}`,
    `ease=${normalized.ease}`,
    `x=${formatPositionRange(keyframes.x)}`,
    `y=${formatPositionRange(keyframes.y)}`,
    `opacity=${formatRange(keyframes.opacity)}`,
    `scale=${formatRange(keyframes.scale)}`,
  ].join(";");
}

export function parseMotionDraft(value: string | null | undefined): MotionDraft | null {
  const parsed = parseMotionAttribute(value);
  if (!parsed) return null;
  const { x, y } = parsed.keyframes;
  const dominantOffset =
    Math.max(Math.abs(x.from), Math.abs(x.to)) >= Math.max(Math.abs(y.from), Math.abs(y.to))
      ? Math.abs(x.from) >= Math.abs(x.to)
        ? x.from
        : x.to
      : Math.abs(y.from) >= Math.abs(y.to)
        ? y.from
        : y.to;
  const direction = resolveDirection(x.from, y.from);

  return buildDefaultMotionDraft(parsed.preset, {
    direction,
    start: parsed.start,
    duration: parsed.duration,
    ease: parsed.ease,
    distance: Math.abs(dominantOffset),
    keyframes: parsed.keyframes,
  });
}

export function buildDomEditMotionPatchOperation(draft: MotionDraft | null): PatchOperation {
  return {
    type: "attribute",
    property: "hf-motion",
    value: draft ? serializeMotionDraft(draft) : null,
  };
}

export function buildMotionVarsId(seed: string | null | undefined): string {
  const normalized = (seed ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[.#]+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return normalized || "layer";
}

export function buildMotionVarsAttribute(id: string): string {
  return serializeMotionVarsAttribute({
    version: 1,
    id,
    lanes: MOTION_VAR_LANES,
    owner: "hf",
    driver: "hf",
  });
}

export function serializeMotionVarsAttribute(config: MotionVarsConfig): string {
  const id = buildMotionVarsId(config.id);
  const lanes: MotionVariableLane[] = [];
  for (const lane of config.lanes) {
    if (!SUPPORTED_MOTION_VAR_LANES.has(lane)) continue;
    if (!lanes.includes(lane)) lanes.push(lane);
  }
  const owner = SUPPORTED_MOTION_VAR_OWNERS.has(config.owner) ? config.owner : "hf";
  const driver = SUPPORTED_MOTION_VAR_DRIVERS.has(config.driver) ? config.driver : "hf";
  return [
    `v=${MOTION_VERSION}`,
    `id=${id}`,
    `lanes=${lanes.length > 0 ? lanes : MOTION_VAR_LANES}`,
    `owner=${owner}`,
    `driver=${driver}`,
  ].join(";");
}

export function parseMotionVarsAttribute(
  value: string | null | undefined,
): MotionVarsConfig | null {
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

  if (parts.get("v") !== `${MOTION_VERSION}`) return null;
  const id = parts.get("id");
  if (!id || buildMotionVarsId(id) !== id) return null;
  const lanes: MotionVariableLane[] = [];
  for (const rawLane of parts.get("lanes")?.split(",") ?? []) {
    const lane = rawLane.trim() as MotionVariableLane;
    if (!SUPPORTED_MOTION_VAR_LANES.has(lane)) return null;
    if (!lanes.includes(lane)) lanes.push(lane);
  }
  if (lanes.length === 0) return null;

  const owner = parts.get("owner") as MotionVariableOwner | undefined;
  if (!owner || !SUPPORTED_MOTION_VAR_OWNERS.has(owner)) return null;
  const driver = parts.get("driver") as MotionVariableDriver | undefined;
  if (!driver || !SUPPORTED_MOTION_VAR_DRIVERS.has(driver)) return null;

  return {
    version: 1,
    id,
    lanes,
    owner,
    driver,
  };
}

export function buildDomEditMotionPatchOperations(
  draft: MotionDraft | null,
  motionVarsId: string,
): PatchOperation[] {
  return [
    buildDomEditMotionPatchOperation(draft),
    {
      type: "attribute",
      property: "hf-motion-vars",
      value: draft ? buildMotionVarsAttribute(motionVarsId) : null,
    },
  ];
}

export function buildMotionCurveModel(draft: MotionDraft): MotionCurveModel {
  const normalized = buildDefaultMotionDraft(draft.preset, draft);
  const keyframes = resolveMotionKeyframes(normalized);
  const start = roundMotionNumber(normalized.start);
  const duration = roundMotionNumber(normalized.duration);
  const end = roundMotionNumber(start + duration);
  const windowEnd = Math.max(end, duration, 0.001);
  const startPercent = roundMotionNumber((start / windowEnd) * 100);

  const tracks: MotionCurveTrack[] = [
    buildCurveTrack("x", "X", keyframes.x.from, keyframes.x.to, "px", startPercent),
    buildCurveTrack("y", "Y", keyframes.y.from, keyframes.y.to, "px", startPercent),
    buildCurveTrack(
      "opacity",
      "Opacity",
      keyframes.opacity.from,
      keyframes.opacity.to,
      "",
      startPercent,
    ),
    buildCurveTrack("scale", "Scale", keyframes.scale.from, keyframes.scale.to, "", startPercent),
  ];

  return {
    start,
    duration,
    end,
    windowEnd,
    ease: normalized.ease,
    markers: [
      { label: "Start", time: start, percent: startPercent },
      { label: "End", time: end, percent: 100 },
    ],
    tracks,
  };
}

export function buildMotionAgentContext({
  hfMotionAttribute,
  draft,
  ownership,
}: {
  hfMotionAttribute?: string;
  draft: MotionDraft | null;
  ownership: MotionOwnershipReport;
}): MotionAgentContext {
  const model = draft ? buildMotionCurveModel(draft) : null;
  return {
    version: 1,
    state: ownership.state,
    summary: ownership.summary,
    hfMotionAttribute: hfMotionAttribute?.trim() || undefined,
    owners: ownership.badges.map((badge) => ({
      label: badge.label,
      state: badge.state,
      editable: badge.editable,
    })),
    curveTracks:
      model?.tracks.map((track) => ({
        key: track.key,
        label: track.label,
        from: track.from,
        to: track.to,
        unit: track.unit,
        active: track.active,
      })) ?? [],
    instructions: [
      "Patch the existing runtime library only when the target is static, element-specific, and not shared with unrelated layers.",
      "Do not blindly rewrite dynamic selectors, unresolved variables, shared timelines, function-valued properties, or arbitrary Three.js scene graph mutations.",
      "Use HF Motion when the requested result should become Studio-owned and deterministic.",
      "Use an outer layout wrapper when transform ownership is mixed or layout positioning would be corrupted.",
      "After editing, reload Studio, select this element, seek the preview, and confirm the animation persists in source.",
    ],
  };
}

export function detectMotionOwnership(input: MotionOwnershipInput): MotionOwnershipReport {
  const element = input.element ?? null;
  const badges: MotionOwnershipBadge[] = [];
  const motionVars = parseMotionVarsAttribute(
    input.dataAttributes?.["hf-motion-vars"] ?? element?.getAttribute("data-hf-motion-vars"),
  );
  const hasHfMotion = Boolean(
    input.dataAttributes?.["hf-motion"] || element?.hasAttribute("data-hf-motion"),
  );

  if (hasHfMotion || motionVars?.owner === "hf") {
    badges.push({
      kind: "hf-motion",
      label: motionVars ? "HF Motion Vars" : "HF Motion",
      state: "Editable",
      editable: true,
      description: motionVars
        ? "Studio-authored motion uses canonical CSS variable lanes."
        : "Studio-authored deterministic motion.",
    });
  }

  if (motionVars && motionVars.owner !== "hf") {
    const variableOwner = getMotionVariableOwnerBadge(motionVars.owner);
    badges.push({
      kind: variableOwner.kind,
      label: `${variableOwner.label} Vars`,
      state: "Detected",
      editable: false,
      description:
        "Canonical CSS variable lanes detected. Direct source patching still requires safe importer confidence.",
    });
  }

  if (hasCssMotion(input)) {
    badges.push({
      kind: "css",
      label: "CSS",
      state: "Detected",
      editable: false,
      description: "CSS animation or transition detected. Read-only for now.",
    });
  }

  if (hasWaapiMotion(element)) {
    badges.push({
      kind: "waapi",
      label: "WAAPI",
      state: "Detected",
      editable: false,
      description: "Web Animations API motion detected. Read-only for now.",
    });
  }

  if (hasGsapMotion(element)) {
    badges.push({
      kind: "gsap",
      label: "GSAP",
      state: "Detected",
      editable: false,
      description: "Registered GSAP timeline targets this element. Read-only for now.",
    });
  }

  if (hasAnimeMotion(element)) {
    badges.push({
      kind: "animejs",
      label: "anime.js",
      state: "Detected",
      editable: false,
      description: "Registered anime.js instance targets this element. Read-only for now.",
    });
  }

  if (hasThreeMotion(element)) {
    badges.push({
      kind: "three",
      label: "Three",
      state: "Detected",
      editable: false,
      description: "Three.js time bridge detected. Read-only for now.",
    });
  }

  const ownerCount = badges.length;
  if (ownerCount > 1) {
    badges.push({
      kind: "mixed",
      label: "Mixed",
      state: "Mixed",
      editable: false,
      description: "Multiple motion owners touch this layer; Studio will not rewrite them.",
    });
  }

  if (ownerCount === 0) {
    return {
      state: "none",
      badges: [],
      editable: false,
      summary: "No runtime-owned motion detected.",
    };
  }

  const hasEditableOwner = badges.some((badge) => badge.kind === "hf-motion");
  const state = ownerCount > 1 ? "mixed" : hasEditableOwner ? "editable" : "detected";
  return {
    state,
    badges,
    editable: state === "editable",
    summary:
      state === "editable"
        ? "Studio-authored motion is editable."
        : state === "mixed"
          ? "Multiple motion owners detected; external owners are read-only."
          : "External runtime motion is detected and read-only.",
  };
}

function getMotionVariableOwnerBadge(owner: MotionVariableOwner): {
  kind: MotionOwnershipKind;
  label: string;
} {
  switch (owner) {
    case "gsap":
      return { kind: "gsap", label: "GSAP" };
    case "anime":
      return { kind: "animejs", label: "anime.js" };
    case "css":
      return { kind: "css", label: "CSS" };
    case "waapi":
      return { kind: "waapi", label: "WAAPI" };
    case "hf":
    default:
      return { kind: "hf-motion", label: "HF Motion" };
  }
}

function parseMotionAttribute(value: string | null | undefined): ParsedMotionAttribute | null {
  if (!value) return null;
  const parts = new Map<string, string>();
  for (const rawPart of value.split(";")) {
    const part = rawPart.trim();
    if (!part) continue;
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) return null;
    parts.set(part.slice(0, separatorIndex).trim(), part.slice(separatorIndex + 1).trim());
  }

  if (parts.get("v") !== `${MOTION_VERSION}`) return null;
  const preset = parts.get("preset") as MotionPreset | undefined;
  if (!preset || !SUPPORTED_PRESETS.has(preset)) return null;
  const ease = normalizeMotionEase(parts.get("ease") ?? "outCubic");
  if (!ease) return null;

  const start = parseFiniteNumber(parts.get("start") ?? "0");
  const duration = parseFiniteNumber(parts.get("duration"));
  const x = parseRange(parts.get("x"), { from: 0, to: 0 }, 0);
  const y = parseRange(parts.get("y"), { from: 0, to: 0 }, 0);
  const opacity = parseRange(parts.get("opacity"), { from: 1, to: 1 });
  const scale = parseRange(parts.get("scale"), { from: 1, to: 1 });
  if (
    start == null ||
    start < 0 ||
    duration == null ||
    duration <= 0 ||
    !x ||
    !y ||
    !opacity ||
    !scale
  ) {
    return null;
  }

  return {
    preset,
    start,
    duration,
    ease,
    keyframes: normalizeMotionKeyframes({ x, y, opacity, scale }, getPresetKeyframes({ preset })),
  };
}

function getPresetOffsets(draft: MotionDraft): { x: number; y: number } {
  if (draft.preset === "pop") return { x: 0, y: 0 };
  switch (draft.direction) {
    case "down":
      return { x: 0, y: -draft.distance };
    case "left":
      return { x: draft.distance, y: 0 };
    case "right":
      return { x: -draft.distance, y: 0 };
    case "up":
    default:
      return { x: 0, y: draft.distance };
  }
}

function getPresetKeyframes(
  draft: Pick<MotionDraft, "preset"> & Partial<MotionDraft>,
): MotionKeyframes {
  const presetDraft = {
    preset: draft.preset,
    direction:
      draft.direction && SUPPORTED_DIRECTIONS.has(draft.direction) ? draft.direction : "up",
    start: 0,
    duration: draft.preset === "pop" ? POP_DURATION : DEFAULT_DURATION,
    ease: "outCubic",
    distance: normalizeFiniteNumber(draft.distance, DEFAULT_DISTANCE, 0),
  } satisfies MotionDraft;
  const offsets = getPresetOffsets(presetDraft);
  return {
    x: { from: offsets.x, to: 0 },
    y: { from: offsets.y, to: 0 },
    opacity: { from: draft.preset === "slide" ? 1 : 0, to: 1 },
    scale: { from: draft.preset === "pop" ? POP_SCALE_FROM : 1, to: 1 },
  };
}

function resolveMotionKeyframes(draft: MotionDraft): MotionKeyframes {
  return normalizeMotionKeyframes(draft.keyframes, getPresetKeyframes(draft));
}

function normalizeMotionKeyframes(
  keyframes: Partial<MotionKeyframes> | undefined,
  fallback: MotionKeyframes,
): MotionKeyframes {
  return {
    x: normalizeRange(keyframes?.x, fallback.x),
    y: normalizeRange(keyframes?.y, fallback.y),
    opacity: normalizeRange(keyframes?.opacity, fallback.opacity, 0, 1),
    scale: normalizeRange(keyframes?.scale, fallback.scale, 0),
  };
}

function normalizeRange(
  range: Partial<MotionKeyframeRange> | undefined,
  fallback: MotionKeyframeRange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): MotionKeyframeRange {
  return {
    from: clampFiniteNumber(range?.from, fallback.from, min, max),
    to: clampFiniteNumber(range?.to, fallback.to, min, max),
  };
}

function buildCurveTrack(
  key: MotionCurveTrackKey,
  label: string,
  from: number,
  to: number,
  unit: "px" | "",
  startPercent: number,
): MotionCurveTrack {
  const roundedFrom = roundMotionNumber(from);
  const roundedTo = roundMotionNumber(to);
  return {
    key,
    label,
    from: roundedFrom,
    to: roundedTo,
    unit,
    active: Math.abs(roundedFrom - roundedTo) > 0.0001,
    points: [
      { percent: startPercent, value: roundedFrom },
      { percent: 100, value: roundedTo },
    ],
  };
}

function resolveDirection(x: number, y: number): MotionDirection {
  if (Math.abs(x) >= Math.abs(y) && Math.abs(x) > 0) {
    return x > 0 ? "left" : "right";
  }
  if (Math.abs(y) > 0) {
    return y > 0 ? "up" : "down";
  }
  return "up";
}

export function normalizeMotionEase(value: string): MotionEase | null {
  const trimmed = value.trim();
  if (isMotionEasePreset(trimmed)) return trimmed;
  const bezier = parseMotionBezierEase(trimmed);
  return bezier ? formatMotionBezierEase(bezier) : null;
}

function isMotionEasePreset(value: string): value is MotionEasePreset {
  return SUPPORTED_EASES.has(value);
}

export function isMotionBezierEase(value: string): value is `bezier(${string})` {
  return parseMotionBezierEase(value) != null;
}

export function parseMotionBezierEase(value: string): MotionBezierEase | null {
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

export function formatMotionBezierEase(bezier: MotionBezierEase): MotionEase {
  return `bezier(${formatNumber(bezier.x1)},${formatNumber(bezier.y1)},${formatNumber(
    bezier.x2,
  )},${formatNumber(bezier.y2)})`;
}

export function getMotionEaseLabel(ease: MotionEase): string {
  const option = MOTION_EASE_OPTIONS.find((entry) => entry.value === ease);
  if (option) return option.label;
  const bezier = parseMotionBezierEase(ease);
  return bezier ? `Custom ${formatMotionBezierEase(bezier).replace("bezier", "")}` : "Out Cubic";
}

export function sampleMotionEase(ease: MotionEase, progress: number): number {
  const t = clampFiniteNumber(progress, 0, 0, 1);
  const bezier = parseMotionBezierEase(ease);
  if (bezier) return cubicBezierProgress(t, bezier);

  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  const c3 = c1 + 1;
  const c4 = (2 * Math.PI) / 3;
  const c5 = (2 * Math.PI) / 4.5;

  switch (ease) {
    case "ease":
      return cubicBezierProgress(t, { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 });
    case "inSine":
      return 1 - Math.cos((t * Math.PI) / 2);
    case "outSine":
      return Math.sin((t * Math.PI) / 2);
    case "inOutSine":
      return -(Math.cos(Math.PI * t) - 1) / 2;
    case "inQuad":
      return t * t;
    case "outQuad":
      return 1 - (1 - t) * (1 - t);
    case "inOutQuad":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case "inCubic":
      return t * t * t;
    case "outCubic":
      return 1 - Math.pow(1 - t, 3);
    case "inOutCubic":
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case "inQuart":
      return t * t * t * t;
    case "outQuart":
      return 1 - Math.pow(1 - t, 4);
    case "inOutQuart":
      return t < 0.5 ? 8 * Math.pow(t, 4) : 1 - Math.pow(-2 * t + 2, 4) / 2;
    case "inQuint":
      return Math.pow(t, 5);
    case "outQuint":
      return 1 - Math.pow(1 - t, 5);
    case "inOutQuint":
      return t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2;
    case "inExpo":
      return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    case "outExpo":
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case "inOutExpo":
      return t === 0
        ? 0
        : t === 1
          ? 1
          : t < 0.5
            ? Math.pow(2, 20 * t - 10) / 2
            : (2 - Math.pow(2, -20 * t + 10)) / 2;
    case "inCirc":
      return 1 - Math.sqrt(1 - Math.pow(t, 2));
    case "outCirc":
      return Math.sqrt(1 - Math.pow(t - 1, 2));
    case "inOutCirc":
      return t < 0.5
        ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
        : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
    case "inBack":
      return c3 * t * t * t - c1 * t * t;
    case "outBack":
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    case "inOutBack":
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    case "inBounce":
      return 1 - sampleOutBounce(1 - t);
    case "outBounce":
      return sampleOutBounce(t);
    case "inOutBounce":
      return t < 0.5 ? (1 - sampleOutBounce(1 - 2 * t)) / 2 : (1 + sampleOutBounce(2 * t - 1)) / 2;
    case "inElastic":
      return t === 0
        ? 0
        : t === 1
          ? 1
          : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    case "outElastic":
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    case "inOutElastic":
      return t === 0
        ? 0
        : t === 1
          ? 1
          : t < 0.5
            ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
            : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
    case "linear":
    default:
      return t;
  }
}

function cubicBezierProgress(progress: number, bezier: MotionBezierEase): number {
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
    t = clampFiniteNumber(t - x / dx, t, 0, 1);
  }

  return cubicBezierAxis(t, bezier.y1, bezier.y2);
}

function solveBezierTByBisection(progress: number, bezier: MotionBezierEase): number {
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

function sampleOutBounce(progress: number): number {
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

function parseFiniteNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRange(
  value: string | undefined,
  fallback: MotionKeyframeRange,
  singleValueTo?: number,
): MotionKeyframeRange | null {
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

function normalizeFiniteNumber(value: number | undefined, fallback: number, min: number): number {
  return value != null && Number.isFinite(value) ? Math.max(min, value) : fallback;
}

function clampFiniteNumber(value: number | undefined, fallback: number, min: number, max: number) {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function formatPositionRange(range: MotionKeyframeRange): string {
  return Math.abs(range.to) < 0.0001
    ? formatNumber(range.from)
    : `${formatNumber(range.from)}:${formatNumber(range.to)}`;
}

function formatRange(range: MotionKeyframeRange): string {
  return `${formatNumber(range.from)}:${formatNumber(range.to)}`;
}

function formatNumber(value: number): string {
  const normalized = Math.abs(value) < 0.0001 ? 0 : value;
  const rounded = Math.round(normalized * 1000) / 1000;
  return Number.isInteger(rounded)
    ? `${rounded}`
    : rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function roundMotionNumber(value: number): number {
  const normalized = Math.abs(value) < 0.0001 ? 0 : value;
  return Math.round(normalized * 1000) / 1000;
}

function hasCssMotion(input: MotionOwnershipInput): boolean {
  const animationName = getMotionStyleValue(input, "animation-name");
  if (animationName && animationName !== "none") return true;

  const animationDuration = getMotionStyleValue(input, "animation-duration");
  if (hasNonZeroCssTime(animationDuration)) return true;

  const transitionProperty = getMotionStyleValue(input, "transition-property");
  const transitionDuration = getMotionStyleValue(input, "transition-duration");
  return Boolean(
    transitionProperty && transitionProperty !== "none" && hasNonZeroCssTime(transitionDuration),
  );
}

function getMotionStyleValue(input: MotionOwnershipInput, property: string): string | undefined {
  const supplied = input.computedStyles?.[property];
  if (supplied) return supplied.trim();
  const element = input.element;
  if (!element) return undefined;
  try {
    return element.ownerDocument.defaultView
      ?.getComputedStyle(element)
      .getPropertyValue(property)
      .trim();
  } catch {
    return undefined;
  }
}

function hasNonZeroCssTime(value: string | undefined): boolean {
  if (!value) return false;
  return value.split(",").some((part) => {
    const trimmed = part.trim();
    if (!trimmed) return false;
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return false;
    return trimmed.endsWith("ms") ? parsed > 0 : parsed > 0;
  });
}

function hasWaapiMotion(element: HTMLElement | null): boolean {
  const getAnimations = element?.getAnimations;
  if (typeof getAnimations !== "function") return false;
  try {
    return getAnimations.call(element).some((animation: Animation) => {
      const constructorName = animation.constructor?.name ?? "";
      return constructorName !== "CSSAnimation" && constructorName !== "CSSTransition";
    });
  } catch {
    return false;
  }
}

function hasGsapMotion(element: HTMLElement | null): boolean {
  const runtimeWindow = getOwnerWindow(element) as GsapMotionWindow | null;
  const timelines = runtimeWindow?.__timelines;
  if (!element || !timelines) return false;

  for (const timeline of Object.values(timelines)) {
    const children = getGsapChildren(timeline);
    if (children.some((child) => targetMatchesElement(resolveGsapTargets(child), element))) {
      return true;
    }
  }
  return false;
}

function hasAnimeMotion(element: HTMLElement | null): boolean {
  const runtimeWindow = getOwnerWindow(element) as AnimeMotionWindow | null;
  if (!element || !Array.isArray(runtimeWindow?.__hfAnime)) return false;
  return runtimeWindow.__hfAnime.some((instance) =>
    targetMatchesElement(resolveAnimeTargets(instance), element),
  );
}

function hasThreeMotion(element: HTMLElement | null): boolean {
  const runtimeWindow = getOwnerWindow(element) as ThreeMotionWindow | null;
  return Boolean(
    element?.tagName.toLowerCase() === "canvas" &&
    runtimeWindow &&
    "__hfThreeTime" in runtimeWindow,
  );
}

function getOwnerWindow(element: HTMLElement | null): Window | null {
  return element?.ownerDocument.defaultView ?? (typeof window !== "undefined" ? window : null);
}

function getGsapChildren(timeline: unknown): unknown[] {
  if (!timeline || typeof timeline !== "object") return [];
  const getChildren = (timeline as { getChildren?: (...args: boolean[]) => unknown }).getChildren;
  if (typeof getChildren !== "function") return [];
  try {
    const children = getChildren.call(timeline, true, true, true);
    return Array.isArray(children) ? children : [];
  } catch {
    return [];
  }
}

function resolveGsapTargets(child: unknown): unknown {
  if (!child || typeof child !== "object") return null;
  const targets = (child as { targets?: () => unknown }).targets;
  if (typeof targets === "function") {
    try {
      return targets.call(child);
    } catch {
      return null;
    }
  }
  return (
    (child as { vars?: { targets?: unknown }; _targets?: unknown }).vars?.targets ??
    (child as { _targets?: unknown })._targets ??
    null
  );
}

function resolveAnimeTargets(instance: unknown): unknown {
  if (!instance || typeof instance !== "object") return null;
  const typed = instance as {
    animatables?: Array<{ target?: unknown }>;
    animations?: Array<{ animatable?: { target?: unknown }; target?: unknown }>;
    targets?: unknown;
    _targets?: unknown;
  };
  if (Array.isArray(typed.animatables)) {
    return typed.animatables.map((animatable) => animatable.target);
  }
  if (Array.isArray(typed.animations)) {
    return typed.animations.map((animation) => animation.animatable?.target ?? animation.target);
  }
  return typed.targets ?? typed._targets ?? null;
}

function targetMatchesElement(targets: unknown, element: HTMLElement): boolean {
  if (!targets) return false;
  if (targets === element) return true;
  if (typeof targets === "string") {
    try {
      return element.matches(targets);
    } catch {
      return false;
    }
  }
  if (Array.isArray(targets)) {
    return targets.some((target) => targetMatchesElement(target, element));
  }
  if (
    typeof NodeList !== "undefined" &&
    targets instanceof NodeList &&
    Array.from(targets).includes(element)
  ) {
    return true;
  }
  return false;
}

interface GsapMotionWindow extends Window {
  __timelines?: Record<string, unknown>;
}

interface AnimeMotionWindow extends Window {
  __hfAnime?: unknown[];
}

interface ThreeMotionWindow extends Window {
  __hfThreeTime?: number;
}
