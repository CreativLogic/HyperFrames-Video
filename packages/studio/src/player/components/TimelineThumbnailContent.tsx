import { memo, useEffect, useState } from "react";
import type { TimelineElement } from "../store/playerStore";
import { buildCompositionThumbnailUrl } from "./CompositionThumbnail";
import { getStudioThumbnailService } from "../../thumbnails/studioThumbnailService";
import { getCompositionPreviewUrl, isSourceCompositionPath } from "../../utils/compositionPaths";
import { formatTime } from "../lib/time";

export interface TimelineThumbnailContentProps {
  element: TimelineElement;
  projectId: string;
  style: { clip: string; label: string; accent?: string };
  resolveSourceHash: (path: string) => Promise<string>;
}

const TIMELINE_THUMBNAIL_WIDTH = 220;
const TIMELINE_THUMBNAIL_HEIGHT = 72;
const VIDEO_THUMBNAIL_IDLE_DELAY_MS = 1200;
const VIDEO_SOURCE_EXT = /\.(mp4|m4v|mov|webm|ogv)(?:$|[?#])/i;

export interface TimelineThumbnailSource {
  kind: "composition" | "element" | "video";
  sourcePath: string;
  selector?: string;
  selectorIndex?: number;
}

export function resolveTimelineThumbnailSource(
  element: TimelineElement,
): TimelineThumbnailSource | null {
  const compositionPath = resolveTimelineThumbnailSourcePath(element);
  if (compositionPath && element.compositionSrc) {
    return { kind: "composition", sourcePath: compositionPath };
  }

  const videoPath = resolveTimelineVideoThumbnailSourcePath(element);
  if (videoPath) return { kind: "video", sourcePath: videoPath };

  const elementPath = resolveTimelineElementThumbnailSourcePath(element);
  if (elementPath && element.selector) {
    return {
      kind: "element",
      sourcePath: elementPath,
      selector: element.selector,
      selectorIndex: element.selectorIndex,
    };
  }

  if (compositionPath) return { kind: "composition", sourcePath: compositionPath };

  return null;
}

export function resolveTimelineThumbnailSourcePath(element: TimelineElement): string | null {
  const candidates = [element.compositionSrc, element.sourceFile];
  for (const candidate of candidates) {
    const normalized = normalizeCompositionPath(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export function resolveTimelineVideoThumbnailSourcePath(element: TimelineElement): string | null {
  const src = element.src;
  if (!src || !isVideoTimelineSource(element, src)) return null;
  return normalizeProjectAssetPath(src, element.sourceFile);
}

export function resolveTimelineElementThumbnailSourcePath(element: TimelineElement): string | null {
  const direct = normalizeCompositionPath(element.sourceFile);
  if (direct) return direct;

  const keyed = normalizeCompositionPath(extractSourcePathFromTimelineKey(element.key));
  if (keyed) return keyed;

  return element.selector ? "index.html" : null;
}

export function getTimelineThumbnailTimeSeconds(element: TimelineElement): number {
  const start = Number.isFinite(element.playbackStart)
    ? Math.max(0, element.playbackStart ?? 0)
    : 0;
  const duration = Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0;
  return Math.round((start + duration / 2) * 100) / 100;
}

export function getTimelineThumbnailCaptureTimeSeconds(
  element: TimelineElement,
  source: TimelineThumbnailSource | null,
): number {
  if (source?.kind !== "element") return getTimelineThumbnailTimeSeconds(element);
  const start = Number.isFinite(element.start) ? Math.max(0, element.start) : 0;
  const duration = Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0;
  return Math.round((start + duration / 2) * 100) / 100;
}

export const TimelineThumbnailContent = memo(function TimelineThumbnailContent({
  element,
  projectId,
  style,
  resolveSourceHash,
}: TimelineThumbnailContentProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const thumbnailSource = resolveTimelineThumbnailSource(element);
  const sourceKind = thumbnailSource?.kind ?? null;
  const sourcePath = thumbnailSource?.sourcePath ?? null;
  const selector = thumbnailSource?.selector;
  const selectorIndex = thumbnailSource?.selectorIndex;
  const timeSeconds = getTimelineThumbnailCaptureTimeSeconds(element, thumbnailSource);

  useEffect(() => {
    const onCleared = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (!detail?.projectId || detail.projectId === projectId) setThumbnailUrl(null);
    };
    window.addEventListener("hf:thumbnail-cache-cleared", onCleared);
    return () => window.removeEventListener("hf:thumbnail-cache-cleared", onCleared);
  }, [projectId]);

  useEffect(() => {
    if (!sourceKind || !sourcePath) {
      setThumbnailUrl(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const requestThumbnail = () => {
      void (async () => {
        const objectUrl =
          sourceKind === "composition"
            ? await requestCompositionThumbnailUrl({
                projectId,
                sourcePath,
                timeSeconds,
                signal: controller.signal,
                resolveSourceHash,
              })
            : sourceKind === "element"
              ? await requestCompositionThumbnailUrl({
                  projectId,
                  sourcePath,
                  timeSeconds,
                  signal: controller.signal,
                  resolveSourceHash,
                  selector,
                  selectorIndex,
                })
              : await requestVideoThumbnailUrl({
                  projectId,
                  sourcePath,
                  timeSeconds,
                  signal: controller.signal,
                });
        if (!cancelled && objectUrl) setThumbnailUrl(objectUrl);
      })().catch((error: unknown) => {
        if (!isAbortError(error)) setThumbnailUrl(null);
      });
    };

    const delay =
      sourceKind === "video"
        ? window.setTimeout(requestThumbnail, VIDEO_THUMBNAIL_IDLE_DELAY_MS)
        : null;
    if (delay == null) requestThumbnail();

    return () => {
      cancelled = true;
      if (delay != null) window.clearTimeout(delay);
      controller.abort();
    };
  }, [
    element.id,
    projectId,
    resolveSourceHash,
    selector,
    selectorIndex,
    sourceKind,
    sourcePath,
    timeSeconds,
  ]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {thumbnailUrl && (sourceKind === "composition" || sourceKind === "element") && (
        <img
          src={thumbnailUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
      )}
      {thumbnailUrl && sourceKind === "video" && (
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `url(${thumbnailUrl})`,
            backgroundSize: `${TIMELINE_THUMBNAIL_WIDTH}px 100%`,
            backgroundRepeat: "repeat-x",
            backgroundPosition: "left center",
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: thumbnailUrl
            ? "linear-gradient(90deg, rgba(0,0,0,0.72), rgba(0,0,0,0.2) 48%, rgba(0,0,0,0.65))"
            : `linear-gradient(120deg, ${style.clip}22, transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.18))`,
        }}
      />
      <div className="absolute inset-0 flex h-full min-h-0 items-end px-6 py-3">
        <div className="flex items-center">
          <span className="max-w-full truncate rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-none text-white/70">
            {formatTime(element.start)} {"\u2192"} {formatTime(element.start + element.duration)}
          </span>
        </div>
      </div>
    </div>
  );
});

async function requestCompositionThumbnailUrl({
  projectId,
  sourcePath,
  timeSeconds,
  signal,
  resolveSourceHash,
  selector,
  selectorIndex,
}: {
  projectId: string;
  sourcePath: string;
  timeSeconds: number;
  signal: AbortSignal;
  resolveSourceHash: (path: string) => Promise<string>;
  selector?: string;
  selectorIndex?: number;
}): Promise<string | null> {
  const sourceHash = await resolveSourceHash(sourcePath);
  if (signal.aborted) return null;
  const previewUrl = getCompositionPreviewUrl(projectId, sourcePath);
  const thumbnailRequestUrl = buildCompositionThumbnailUrl({
    previewUrl,
    seekTime: timeSeconds,
    duration: 0,
    selector,
    selectorIndex,
    origin: window.location.origin,
  });
  return getStudioThumbnailService().getThumbnailUrl({
    key: {
      projectId,
      sourcePath,
      sourceHash,
      kind: "composition",
      timeSeconds,
      width: TIMELINE_THUMBNAIL_WIDTH,
      height: TIMELINE_THUMBNAIL_HEIGHT,
      devicePixelRatio: window.devicePixelRatio || 1,
      version: selector ? 4 : 3,
    },
    url: thumbnailRequestUrl,
    priority: "visible",
    signal,
  });
}

async function requestVideoThumbnailUrl({
  projectId,
  sourcePath,
  timeSeconds,
  signal,
}: {
  projectId: string;
  sourcePath: string;
  timeSeconds: number;
  signal: AbortSignal;
}): Promise<string | null> {
  return getStudioThumbnailService().getVideoThumbnailUrl({
    key: {
      projectId,
      sourcePath,
      sourceHash: `media:${sourcePath}`,
      kind: "video",
      timeSeconds,
      width: TIMELINE_THUMBNAIL_WIDTH,
      height: TIMELINE_THUMBNAIL_HEIGHT,
      devicePixelRatio: window.devicePixelRatio || 1,
      version: 1,
    },
    loadBlob: (nextSignal) => fetchProjectAssetBlob(projectId, sourcePath, nextSignal),
    priority: "visible",
    signal,
    fit: "cover",
  });
}

function normalizeCompositionPath(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = value.startsWith("http") ? new URL(value) : null;
    if (parsed) {
      const marker = "/preview/comp/";
      const markerIndex = parsed.pathname.indexOf(marker);
      if (markerIndex >= 0) {
        const encodedPath = parsed.pathname.slice(markerIndex + marker.length);
        const path = decodeURIComponent(encodedPath);
        return isSourceCompositionPath(path) ? path : null;
      }
      return null;
    }
  } catch {
    return null;
  }
  const cleanPath = value.split("?")[0] ?? value;
  return isSourceCompositionPath(cleanPath) ? cleanPath : null;
}

function extractSourcePathFromTimelineKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const hashIndex = key.indexOf("#");
  const selectorIndex = key.indexOf(":");
  const splitIndex =
    hashIndex >= 0 && selectorIndex >= 0
      ? Math.min(hashIndex, selectorIndex)
      : Math.max(hashIndex, selectorIndex);
  return splitIndex > 0 ? key.slice(0, splitIndex) : undefined;
}

function isVideoTimelineSource(element: TimelineElement, src: string): boolean {
  return element.tag.toLowerCase() === "video" || VIDEO_SOURCE_EXT.test(src);
}

function normalizeProjectAssetPath(value: string, sourceFile: string | undefined): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return null;

  const previewPath = extractPreviewAssetPath(trimmed);
  if (previewPath) return previewPath;

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

  const cleanPath = trimmed.split(/[?#]/)[0] ?? trimmed;
  const baseDir = sourceFile?.includes("/") ? sourceFile.slice(0, sourceFile.lastIndexOf("/")) : "";
  const normalized = normalizeRelativePath(baseDir ? `${baseDir}/${cleanPath}` : cleanPath);
  return normalized && VIDEO_SOURCE_EXT.test(normalized) ? normalized : null;
}

function extractPreviewAssetPath(value: string): string | null {
  try {
    const parsed = value.startsWith("http") ? new URL(value) : null;
    const path = parsed?.pathname ?? value;
    const marker = "/preview/";
    const markerIndex = path.indexOf(marker);
    if (markerIndex < 0) return null;
    const encodedPath = path.slice(markerIndex + marker.length);
    if (!encodedPath || encodedPath.startsWith("comp/")) return null;
    const decoded = decodeURIComponent(encodedPath);
    return VIDEO_SOURCE_EXT.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function normalizeRelativePath(path: string): string | null {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

async function fetchProjectAssetBlob(
  projectId: string,
  sourcePath: string,
  signal: AbortSignal,
): Promise<Blob | null> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/preview/${encodeRoutePath(sourcePath)}`,
    { signal },
  );
  if (!response.ok) return null;
  return response.blob();
}

function encodeRoutePath(path: string): string {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function isAbortError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}
