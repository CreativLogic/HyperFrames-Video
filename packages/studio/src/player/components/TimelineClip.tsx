import type { TimelineTrackStyle } from "./timelineTheme";
// TimelineClip — Visual clip component for the NLE timeline.

import { memo, useState, type ReactNode } from "react";
import type { TimelineElement } from "../store/playerStore";
import { defaultTimelineTheme, getClipHandleOpacity, type TimelineTheme } from "./timelineTheme";
import { getTimelineEditCapabilities } from "./timelineEditing";

interface TimelineClipProps {
  el: TimelineElement;
  pps: number;
  clipY: number;
  isSelected: boolean;
  isHovered: boolean;
  isDragging?: boolean;
  hasCustomContent: boolean;
  theme?: TimelineTheme;
  trackStyle: TimelineTrackStyle;
  isComposition: boolean;
  isInspectorActive?: boolean;
  isThumbnailActive?: boolean;
  thumbnailLabel?: string;
  childCount?: number;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onResizeStart?: (edge: "start" | "end", e: React.PointerEvent) => void;
  onInspectorClick?: (e: React.MouseEvent) => void;
  onThumbnailClick?: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  children?: ReactNode;
}

export const TimelineClip = memo(function TimelineClip({
  el,
  pps,
  clipY,
  isSelected,
  isHovered,
  isDragging = false,
  hasCustomContent,
  theme = defaultTimelineTheme,
  trackStyle,
  isComposition,
  isInspectorActive = false,
  isThumbnailActive = false,
  thumbnailLabel = "thumbnail",
  childCount = 0,
  onHoverStart,
  onHoverEnd,
  onPointerDown,
  onResizeStart,
  onInspectorClick,
  onThumbnailClick,
  onClick,
  onDoubleClick,
  children,
}: TimelineClipProps) {
  const [localHovered, setLocalHovered] = useState(false);
  const effectiveHovered = isHovered || localHovered;
  const leftPx = el.start * pps;
  const widthPx = Math.max(el.duration * pps, 4);
  const handleOpacity = getClipHandleOpacity({
    isHovered: effectiveHovered,
    isSelected,
    isDragging,
  });
  const borderColor = isSelected
    ? theme.clipBorderActive
    : effectiveHovered
      ? theme.clipBorderHover
      : theme.clipBorder;
  const boxShadow = isDragging
    ? theme.clipShadowDragging
    : isSelected
      ? theme.clipShadowActive
      : effectiveHovered
        ? theme.clipShadowHover
        : theme.clipShadow;
  const capabilities = getTimelineEditCapabilities(el);
  const displayLabel = el.label || el.id || el.tag;
  const showHandles = handleOpacity > 0.01;
  const baseBackgroundImage = isSelected ? theme.clipBackgroundActive : theme.clipBackground;
  const glossBackgroundImage = isSelected
    ? "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0))"
    : "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))";
  const accentBackgroundImage = `linear-gradient(120deg, ${trackStyle.accent}${
    isSelected ? "22" : "1e"
  }, transparent 28%)`;
  const compositionStripeBackgroundImage =
    isComposition && !hasCustomContent
      ? "repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.05) 6px)"
      : undefined;
  const clipBackgroundImage = [
    compositionStripeBackgroundImage,
    glossBackgroundImage,
    accentBackgroundImage,
    baseBackgroundImage,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      data-clip="true"
      className={
        hasCustomContent ? "absolute overflow-hidden" : "absolute flex items-center overflow-hidden"
      }
      style={{
        left: leftPx,
        width: widthPx,
        top: clipY,
        bottom: clipY,
        borderRadius: theme.clipRadius,
        backgroundImage: clipBackgroundImage,
        border: `1px solid ${borderColor}`,
        boxShadow,
        transition:
          "border-color 120ms ease-out, box-shadow 140ms ease-out, background 140ms ease-out",
        zIndex: isDragging ? 20 : isSelected ? 10 : effectiveHovered ? 5 : 1,
        cursor: capabilities.canMove ? "grab" : "default",
        transform: isDragging ? "translateY(-1px)" : undefined,
        contain: "layout paint style",
      }}
      title={
        isComposition
          ? `${el.compositionSrc} \u2022 Double-click to open`
          : `${displayLabel} \u2022 ${el.start.toFixed(1)}s \u2013 ${(el.start + el.duration).toFixed(1)}s`
      }
      onPointerEnter={() => {
        setLocalHovered(true);
        onHoverStart();
      }}
      onPointerLeave={() => {
        setLocalHovered(false);
        onHoverEnd();
      }}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {childCount > 0 && !isDragging && (
        <button
          type="button"
          className={`absolute left-1.5 top-1.5 z-20 flex h-5 items-center gap-1 rounded-md border px-1.5 text-[9px] font-semibold tabular-nums transition-colors ${
            isInspectorActive
              ? "border-studio-accent/70 bg-studio-accent/20 text-studio-accent"
              : "border-white/10 bg-black/40 text-neutral-300 hover:border-studio-accent/50 hover:bg-studio-accent/10 hover:text-studio-accent"
          }`}
          data-timeline-layer-count={childCount}
          aria-label={`Show ${childCount} nested selectable layer${childCount === 1 ? "" : "s"} for ${el.label || el.id || el.tag}`}
          aria-pressed={isInspectorActive}
          title={`Show ${childCount} nested selectable layer${childCount === 1 ? "" : "s"}`}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onInspectorClick?.(event);
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 7h16" />
            <path d="M7 12h13" />
            <path d="M10 17h10" />
          </svg>
          {childCount}
        </button>
      )}
      <div
        aria-hidden="true"
        role="presentation"
        onPointerDown={(e) => onResizeStart?.("start", e)}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 18,
          opacity: showHandles && capabilities.canTrimStart ? 1 : 0,
          pointerEvents: onResizeStart && capabilities.canTrimStart ? "auto" : "none",
          zIndex: 4,
          transition: "opacity 120ms ease-out",
          cursor: "col-resize",
          background:
            showHandles && capabilities.canTrimStart
              ? `linear-gradient(90deg, ${trackStyle.accent}4d 0%, ${trackStyle.accent}22 42%, transparent 100%)`
              : "transparent",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 6,
            top: 7,
            bottom: 7,
            width: 3,
            borderRadius: 999,
            background: theme.handleColor,
            boxShadow: `0 0 0 1px ${trackStyle.accent}38, 0 0 12px ${trackStyle.accent}18`,
            opacity: handleOpacity,
            pointerEvents: "none",
          }}
        />
      </div>
      <div
        aria-hidden="true"
        role="presentation"
        onPointerDown={(e) => onResizeStart?.("end", e)}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 18,
          opacity: showHandles && capabilities.canTrimEnd ? 1 : 0,
          pointerEvents: onResizeStart && capabilities.canTrimEnd ? "auto" : "none",
          zIndex: 4,
          transition: "opacity 120ms ease-out",
          cursor: "col-resize",
          background:
            showHandles && capabilities.canTrimEnd
              ? `linear-gradient(270deg, ${trackStyle.accent}4d 0%, ${trackStyle.accent}22 42%, transparent 100%)`
              : "transparent",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 6,
            top: 7,
            bottom: 7,
            width: 3,
            borderRadius: 999,
            background: theme.handleColor,
            boxShadow: `0 0 0 1px ${trackStyle.accent}38, 0 0 12px ${trackStyle.accent}18`,
            opacity: handleOpacity,
            pointerEvents: "none",
          }}
        />
      </div>
      {(onThumbnailClick || onInspectorClick) && !isDragging && (
        <div className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1">
          {onThumbnailClick && (
            <button
              type="button"
              data-timeline-thumbnail-button="true"
              aria-label={`${isThumbnailActive ? "Hide" : "Show"} ${thumbnailLabel} for ${el.label || el.id || el.tag}`}
              aria-pressed={isThumbnailActive}
              title={
                isThumbnailActive ? `Hide clip ${thumbnailLabel}` : `Show clip ${thumbnailLabel}`
              }
              className={`flex h-5 w-5 items-center justify-center rounded-md border text-[10px] transition-colors ${
                isThumbnailActive
                  ? "border-studio-accent/70 bg-studio-accent/20 text-studio-accent"
                  : "border-white/10 bg-black/35 text-neutral-400 hover:border-studio-accent/50 hover:bg-studio-accent/10 hover:text-studio-accent"
              }`}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onThumbnailClick(event);
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="8" cy="10" r="1.5" />
                <path d="m21 16-5-5L5 19" />
              </svg>
            </button>
          )}
          {onInspectorClick && (
            <button
              type="button"
              data-timeline-inspector-button="true"
              aria-label={`Inspect ${el.label || el.id || el.tag}`}
              aria-pressed={isInspectorActive}
              title={isInspectorActive ? "Disable clip inspector" : "Inspect clip in preview"}
              className={`flex h-5 w-5 items-center justify-center rounded-md border text-[10px] transition-colors ${
                isInspectorActive
                  ? "border-studio-accent/70 bg-studio-accent/20 text-studio-accent"
                  : "border-white/10 bg-black/35 text-neutral-400 hover:border-studio-accent/50 hover:bg-studio-accent/10 hover:text-studio-accent"
              }`}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onInspectorClick(event);
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
});
