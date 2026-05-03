import { memo, useEffect, useRef, useState } from "react";
import { buildCompositionThumbnailUrl } from "../../player/components/CompositionThumbnail";
import { hashThumbnailSource } from "../../thumbnails/sourceHash";
import { getStudioThumbnailService } from "../../thumbnails/studioThumbnailService";
import { shouldRequestThumbnail, type ThumbnailMode } from "../../thumbnails/thumbnailMode";
import { getCompositionPreviewUrl } from "../../utils/compositionPaths";

interface CompositionsTabProps {
  compositions: string[];
  activeComposition: string | null;
  onSelect: (comp: string) => void;
  projectId?: string;
  resolveSourceContent?: (path: string) => Promise<string>;
}

const COMPOSITION_THUMBNAIL_WIDTH = 160;
const COMPOSITION_THUMBNAIL_HEIGHT = 90;
const DEFAULT_COMPOSITION_THUMBNAIL_TIME_SECONDS = 3;
const DEFAULT_COMPOSITION_WIDTH = 1920;
const DEFAULT_COMPOSITION_HEIGHT = 1080;
export const DEFAULT_COMPOSITION_THUMBNAIL_MODE: ThumbnailMode = "visible";

interface CompositionSourceMetadata {
  sourceHash: string;
  duration: number | null;
  width: number;
  height: number;
}

interface MiniPlayerApi {
  seek?: (timeSeconds: number) => void;
  renderSeek?: (timeSeconds: number) => void;
  play?: () => void;
  pause?: () => void;
  getTime?: () => number;
  getDuration?: () => number;
}

interface HyperframesPlayerElement extends HTMLElement {
  iframeElement: HTMLIFrameElement;
}

export function getCompositionDisplayName(comp: string): string {
  const name = comp.replace(/^compositions\//, "").replace(/\.html$/, "");
  return name || "index";
}

export function parseCompositionDurationFromHtml(html: string): number | null {
  return parseNumericCompositionAttribute(html, "data-duration");
}

export function parseCompositionDimensionsFromHtml(html: string): {
  width: number;
  height: number;
} {
  return {
    width: parseNumericCompositionAttribute(html, "data-width") ?? DEFAULT_COMPOSITION_WIDTH,
    height: parseNumericCompositionAttribute(html, "data-height") ?? DEFAULT_COMPOSITION_HEIGHT,
  };
}

export function getCompositionThumbnailTimeSeconds(duration: number | null | undefined): number {
  if (!Number.isFinite(duration) || duration == null || duration <= 0) {
    return DEFAULT_COMPOSITION_THUMBNAIL_TIME_SECONDS;
  }
  const time =
    duration < DEFAULT_COMPOSITION_THUMBNAIL_TIME_SECONDS
      ? duration / 2
      : DEFAULT_COMPOSITION_THUMBNAIL_TIME_SECONDS;
  return Math.round(time * 100) / 100;
}

function CompCard({
  comp,
  isActive,
  onSelect,
  projectId,
  resolveSourceContent,
}: {
  comp: string;
  isActive: boolean;
  onSelect: () => void;
  projectId?: string;
  resolveSourceContent?: (path: string) => Promise<string>;
}) {
  const name = getCompositionDisplayName(comp);
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [sourceMetadata, setSourceMetadata] = useState<CompositionSourceMetadata | null>(null);
  const shouldLoadThumbnail = shouldRequestThumbnail(DEFAULT_COMPOSITION_THUMBNAIL_MODE, {
    hovered,
    visible: isVisible,
  });

  useEffect(() => {
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry?.isIntersecting ?? false);
      },
      { rootMargin: "96px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoadThumbnail || !projectId) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setThumbnailFailed(false);

    void (async () => {
      const sourceContent = await readCompositionSourceContent({
        projectId,
        path: comp,
        signal: controller.signal,
        resolveSourceContent,
      });
      if (controller.signal.aborted || cancelled) return;

      const dimensions = parseCompositionDimensionsFromHtml(sourceContent);
      const metadata = {
        sourceHash: hashThumbnailSource(sourceContent),
        duration: parseCompositionDurationFromHtml(sourceContent),
        width: dimensions.width,
        height: dimensions.height,
      };
      setSourceMetadata(metadata);
      if (controller.signal.aborted || cancelled) return;

      const thumbnailTime = getCompositionThumbnailTimeSeconds(metadata.duration);
      const previewUrl = getCompositionPreviewUrl(projectId, comp);
      const thumbnailRequestUrl = buildCompositionThumbnailUrl({
        previewUrl,
        seekTime: thumbnailTime,
        duration: 0,
        origin: window.location.origin,
      });
      const objectUrl = await getStudioThumbnailService().getThumbnailUrl({
        key: {
          projectId,
          sourcePath: comp,
          sourceHash: metadata.sourceHash,
          kind: "composition",
          timeSeconds: thumbnailTime,
          width: COMPOSITION_THUMBNAIL_WIDTH,
          height: COMPOSITION_THUMBNAIL_HEIGHT,
          devicePixelRatio: window.devicePixelRatio || 1,
          version: 3,
        },
        url: thumbnailRequestUrl,
        priority: hovered ? "hover" : "idle",
        signal: controller.signal,
      });
      if (!cancelled && objectUrl) setThumbnailUrl(objectUrl);
    })().catch((error: unknown) => {
      if (!cancelled && !isAbortError(error)) setThumbnailFailed(true);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [comp, hovered, projectId, resolveSourceContent, shouldLoadThumbnail]);

  return (
    <button
      type="button"
      ref={cardRef}
      data-composition-path={comp}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={`w-full text-left px-2 py-1.5 flex items-center gap-2.5 transition-colors cursor-pointer ${
        isActive
          ? "bg-studio-accent/10 border-l-2 border-studio-accent"
          : "border-l-2 border-transparent hover:bg-neutral-800/50"
      }`}
    >
      <div className="relative h-[45px] w-20 flex-shrink-0 overflow-hidden rounded bg-neutral-900 ring-1 ring-white/5">
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
        )}
        <HoverCompositionPreview
          active={hovered}
          compositionPath={comp}
          duration={sourceMetadata?.duration ?? null}
          height={sourceMetadata?.height ?? DEFAULT_COMPOSITION_HEIGHT}
          projectId={projectId}
          width={sourceMetadata?.width ?? DEFAULT_COMPOSITION_WIDTH}
        />
        {!thumbnailUrl && (
          <>
            <div
              className="absolute inset-0 opacity-80"
              style={{
                backgroundImage:
                  "linear-gradient(120deg, rgba(60,230,172,0.18), transparent 44%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.2))",
              }}
            />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundSize: "12px 12px",
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              }}
            />
          </>
        )}
        {thumbnailFailed && (
          <div className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-300/70" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium text-neutral-300">{name}</span>
        <span className="block truncate text-[9px] text-neutral-600">{comp}</span>
      </div>
    </button>
  );
}

export const CompositionsTab = memo(function CompositionsTab({
  compositions,
  activeComposition,
  onSelect,
  projectId,
  resolveSourceContent,
}: CompositionsTabProps) {
  if (compositions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-xs text-neutral-600 text-center">No compositions found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {compositions.map((comp) => (
        <CompCard
          key={comp}
          comp={comp}
          isActive={activeComposition === comp}
          onSelect={() => onSelect(comp)}
          projectId={projectId}
          resolveSourceContent={resolveSourceContent}
        />
      ))}
    </div>
  );
});

function HoverCompositionPreview({
  active,
  compositionPath,
  duration,
  height,
  projectId,
  width,
}: {
  active: boolean;
  compositionPath: string;
  duration: number | null;
  height: number;
  projectId?: string;
  width: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active || !projectId) return;
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let player: HyperframesPlayerElement | null = null;
    let retryTimer: ReturnType<typeof window.setTimeout> | null = null;
    let frameHandle = 0;

    const cleanup = () => {
      if (retryTimer != null) window.clearTimeout(retryTimer);
      retryTimer = null;
      if (frameHandle) window.cancelAnimationFrame(frameHandle);
      frameHandle = 0;
      const api = readMiniPlayer(player);
      api?.pause?.();
      player?.remove();
      player = null;
    };

    void import("@hyperframes/player").then(() => {
      if (cancelled) return;
      player = document.createElement("hyperframes-player") as HyperframesPlayerElement;
      player.setAttribute("src", getCompositionPreviewUrl(projectId, compositionPath));
      player.setAttribute("width", String(width || DEFAULT_COMPOSITION_WIDTH));
      player.setAttribute("height", String(height || DEFAULT_COMPOSITION_HEIGHT));
      player.setAttribute("muted", "");
      player.style.display = "block";
      player.style.height = "100%";
      player.style.pointerEvents = "none";
      player.style.width = "100%";
      host.replaceChildren(player);

      const startPlayback = () => {
        if (frameHandle) return;
        if (retryTimer != null) {
          window.clearTimeout(retryTimer);
          retryTimer = null;
        }
        const api = readMiniPlayer(player);
        if (!api) {
          retryTimer = window.setTimeout(startPlayback, 50);
          return;
        }
        api.pause?.();
        const runtimeDuration = api.getDuration?.();
        const loopDuration =
          duration && duration > 0
            ? duration
            : runtimeDuration && runtimeDuration > 0
              ? runtimeDuration
              : 3;
        const seek = api.renderSeek ?? api.seek;
        if (!seek) return;
        const startTimeMs = performance.now();

        const tick = () => {
          if (cancelled) return;
          const elapsedSeconds = (performance.now() - startTimeMs) / 1000;
          seek(Math.min(loopDuration, elapsedSeconds % loopDuration));
          frameHandle = window.requestAnimationFrame(tick);
        };

        seek(0);
        frameHandle = window.requestAnimationFrame(tick);
      };

      const iframe = player.iframeElement;
      iframe.addEventListener("load", startPlayback, { once: true });
      retryTimer = window.setTimeout(startPlayback, 80);
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [active, compositionPath, duration, height, projectId, width]);

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 z-10 overflow-hidden bg-black transition-opacity duration-150 ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}

function readMiniPlayer(player: HyperframesPlayerElement | null): MiniPlayerApi | null {
  const api = (player?.iframeElement.contentWindow as (Window & { __player?: unknown }) | null)
    ?.__player;
  if (!api || typeof api !== "object") return null;
  return api as MiniPlayerApi;
}

async function readCompositionSourceContent({
  path,
  projectId,
  resolveSourceContent,
  signal,
}: {
  path: string;
  projectId: string;
  resolveSourceContent?: (path: string) => Promise<string>;
  signal: AbortSignal;
}): Promise<string> {
  if (resolveSourceContent) return resolveSourceContent(path);
  const response = await fetch(`/api/projects/${projectId}/files/${encodeURIComponent(path)}`, {
    signal,
  });
  if (!response.ok) throw new Error(`Failed to read ${path}`);
  const data = (await response.json()) as { content?: string };
  return data.content ?? "";
}

function parseNumericCompositionAttribute(html: string, attribute: string): number | null {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*=\\s*["']([^"']+)["']`, "i").exec(html);
  const value = match?.[1] == null ? Number.NaN : Number.parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}
