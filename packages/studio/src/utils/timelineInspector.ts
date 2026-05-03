import type { TimelineElement } from "../player";

export const TIMELINE_INSPECTOR_BOUNDARY_EPSILON_SECONDS = 0.08;
const AUDIO_TIMELINE_TAGS = new Set(["audio", "music", "sfx", "sound", "narration"]);
const AUDIO_SOURCE_EXT_RE = /\.(aac|flac|m4a|mp3|ogg|opus|wav)(?:[?#].*)?$/i;

export function getTimelineElementKey(
  element: Pick<TimelineElement, "id" | "key"> | null | undefined,
): string | null {
  if (!element) return null;
  return element.key ?? element.id;
}

export function canInspectTimelineElement(
  element: Pick<TimelineElement, "tag" | "src"> | null | undefined,
): boolean {
  return !isAudioTimelineElement(element);
}

export function isAudioTimelineElement(
  element: Pick<TimelineElement, "tag" | "src"> | null | undefined,
): boolean {
  if (!element) return false;
  const tag = element.tag.trim().toLowerCase();
  if (AUDIO_TIMELINE_TAGS.has(tag)) return true;
  return Boolean(element.src && AUDIO_SOURCE_EXT_RE.test(element.src));
}

export function shouldShowTimelineInspectorBounds(
  currentTime: number,
  element: Pick<TimelineElement, "start" | "duration"> | null | undefined,
  epsilonSeconds = TIMELINE_INSPECTOR_BOUNDARY_EPSILON_SECONDS,
): boolean {
  if (!element) return false;
  if (!Number.isFinite(currentTime)) return false;
  if (!Number.isFinite(element.start) || !Number.isFinite(element.duration)) return false;
  const start = Math.max(0, element.start);
  const end = Math.max(start, start + Math.max(0, element.duration));
  const epsilon = Math.max(0, epsilonSeconds);
  return Math.abs(currentTime - start) <= epsilon || Math.abs(currentTime - end) <= epsilon;
}
