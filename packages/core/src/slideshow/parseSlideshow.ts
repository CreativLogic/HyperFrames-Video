// packages/core/src/slideshow/parseSlideshow.ts
import type {
  SlideshowManifest,
  SlideRef,
  ResolvedSlide,
  ResolvedSlideshow,
  ResolvedSlideSequence,
} from "./slideshow.types";

const ISLAND_TYPE = "application/hyperframes-slideshow+json";

interface SceneRange {
  id: string;
  start: number;
  duration: number;
}

/** Extract the JSON island from composition HTML. Returns null if absent. */
export function parseSlideshowManifest(html: string): SlideshowManifest | null {
  // Match <script type="application/hyperframes-slideshow+json"> ... </script>
  const re = new RegExp(
    `<script[^>]*type=["']${ISLAND_TYPE.replace(/[.+]/g, "\\$&")}["'][^>]*>([\\s\\S]*?)<\\/script>`,
    "i",
  );
  const match = re.exec(html);
  if (!match || match[1] === undefined) return null;
  const raw = match[1].trim();
  if (raw.length === 0) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!isManifest(parsed)) {
    throw new Error("slideshow island is not a valid SlideshowManifest");
  }
  return parsed;
}

function isManifest(v: unknown): v is SlideshowManifest {
  if (typeof v !== "object" || v === null) return false;
  if (!("slides" in v)) return false;
  return Array.isArray(v.slides);
}

function missingBoundError(sceneId: string, missing: "startTime" | "endTime"): string {
  const present = missing === "startTime" ? "endTime" : "startTime";
  return `slide "${sceneId}" sets ${present} but ${missing} cannot be resolved (no scene "${sceneId}")`;
}

// fallow-ignore-next-line complexity
function resolveTimeRange(
  ref: SlideRef,
  scene: SceneRange | undefined,
  errors: string[],
): { start: number; end: number } {
  const { startTime, endTime, sceneId } = ref;

  // Both explicit — use them directly, no scene needed.
  if (startTime !== undefined && endTime !== undefined) {
    return { start: startTime, end: endTime };
  }

  // Neither explicit — resolve both from scene.
  if (startTime === undefined && endTime === undefined) {
    if (!scene) {
      errors.push(`slide references unresolved sceneId "${sceneId}"`);
      return { start: 0, end: 0 };
    }
    return { start: scene.start, end: scene.start + scene.duration };
  }

  // Exactly one bound explicit — fill from scene, or report a clear error.
  if (!scene) {
    const missing = startTime === undefined ? "startTime" : "endTime";
    errors.push(missingBoundError(sceneId, missing));
    const bound = startTime ?? endTime ?? 0;
    return { start: bound, end: bound };
  }

  return {
    start: startTime ?? scene.start,
    end: endTime ?? scene.start + scene.duration,
  };
}

function validateFragments(
  sceneId: string,
  fragments: number[],
  start: number,
  end: number,
  errors: string[],
): void {
  for (const f of fragments) {
    if (f < start || f > end) {
      errors.push(`slide "${sceneId}" fragment ${f} is outside range [${start}, ${end}]`);
    }
  }
}

function resolveSlide(
  ref: SlideRef,
  sceneById: Map<string, SceneRange>,
  errors: string[],
): ResolvedSlide {
  const scene = sceneById.get(ref.sceneId);
  const { start, end } = resolveTimeRange(ref, scene, errors);
  const fragments = [...(ref.fragments ?? [])].sort((a, b) => a - b);
  validateFragments(ref.sceneId, fragments, start, end, errors);
  return { ...ref, start, end, fragments, hotspots: ref.hotspots ?? [] };
}

export function resolveSlideshow(
  manifest: SlideshowManifest,
  scenes: SceneRange[],
): { resolved: ResolvedSlideshow; errors: string[] } {
  const errors: string[] = [];
  const sceneById = new Map(scenes.map((s) => [s.id, s]));

  const sequences: Record<string, ResolvedSlideSequence> = {};
  for (const seq of manifest.slideSequences ?? []) {
    sequences[seq.id] = {
      id: seq.id,
      label: seq.label,
      slides: seq.slides.map((s) => resolveSlide(s, sceneById, errors)),
    };
  }

  const slides = manifest.slides.map((s) => resolveSlide(s, sceneById, errors));

  // Validate hotspot targets.
  const allSlides = [...slides, ...Object.values(sequences).flatMap((s) => s.slides)];
  for (const slide of allSlides) {
    for (const h of slide.hotspots) {
      if (!sequences[h.target]) {
        errors.push(`hotspot "${h.id}" targets unknown sequence "${h.target}"`);
      }
    }
  }

  // Validate no main-line overlap (sorted by start; adjacent compare).
  const ordered = [...slides].sort((a, b) => a.start - b.start);
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const curr = ordered[i];
    if (prev !== undefined && curr !== undefined && curr.start < prev.end) {
      errors.push(`main-line slides "${prev.sceneId}" and "${curr.sceneId}" overlap`);
    }
  }

  return { resolved: { slides, sequences }, errors };
}
