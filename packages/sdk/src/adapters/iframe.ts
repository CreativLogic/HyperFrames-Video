/**
 * Same-origin iframe PreviewAdapter — WS-A1 (hit-test + selection) +
 * WS-A2 (applyDraft / commitPreview / cancelPreview → moveElement) +
 * WS-G (image-alpha hit-test, phase 1).
 *
 * Requirements:
 * - The iframe MUST be same-origin (srcdoc / blob URL). Cross-origin access to
 *   contentDocument throws a DOMException; this adapter does not guard that —
 *   the caller is responsible for ensuring same-origin.
 *
 * Image-alpha (phase 1):
 * - Replaces elementFromPoint with elementsFromPoint (z-stack) so transparent
 *   image hits fall through to the element behind.
 * - For <img> hits, maps the client point to the natural-pixel coordinate
 *   (object-fit/object-position aware), draws to an offscreen canvas (cached
 *   by src), samples alpha. Transparent pixel → miss, continue the stack.
 * - Cross-origin images taint the canvas → getImageData throws SecurityError
 *   → falls back to treating the pixel as OPAQUE (never drop an unverifiable
 *   hit). Callers must ensure CORS headers or accept the fallback behavior.
 * - Limitation: animated <img> (gif) or src swaps invalidate the cache only
 *   when currentSrc changes. Phase 1 is optimized for static images.
 * - Phase 2 (full per-pixel alpha via drawElement rasterization) is NOT built
 *   here — gated on a perf spike.
 */

import type { PreviewAdapter, ElementAtPointResult, DraftProps } from "./types.js";
import type { EditOp } from "../types.js";

// ─── CSS var names written onto elements during drag ─────────────────────────

const VAR_DX = "--hf-studio-dx";
const VAR_DY = "--hf-studio-dy";

// ─── Pure resolver (testable without a browser) ───────────────────────────────

/**
 * Walk from `el` upward through parentElement, looking for the nearest node
 * that carries `[data-hf-id]` and is NOT `[data-hf-root]`.
 *
 * Returns null when:
 * - The walk exits the tree without finding `[data-hf-id]`
 * - The matching node is `[data-hf-root]` (transparent to hit-testing)
 * - `isVisible(node)` returns false for the matching node
 *
 * Keeping this a pure function (no elementFromPoint, no window access) makes
 * it unit-testable in a plain Node environment.
 */
export function resolveNearestHfElement(
  el: Element | null,
  isVisible: (el: Element) => boolean,
): ElementAtPointResult | null {
  let node = el;
  while (node !== null) {
    const id = node.getAttribute("data-hf-id");
    if (id !== null) {
      if (node.hasAttribute("data-hf-root")) return null;
      if (!isVisible(node)) return null;
      return { id, tag: node.tagName.toLowerCase() };
    }
    node = node.parentElement;
  }
  return null;
}

// ─── Draft position math (pure — testable without a browser) ─────────────────

/**
 * Compute the new absolute x/y for a moveElement op given:
 * - the element's current `data-x` / `data-y` string values (may be null)
 * - the accumulated drag delta (dx, dy) from applyDraft calls
 *
 * `data-x` / `data-y` default to 0 when absent or non-numeric.
 */
export function computeDraftPosition(
  dataX: string | null,
  dataY: string | null,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const baseX = parseFloat(dataX ?? "0") || 0;
  const baseY = parseFloat(dataY ?? "0") || 0;
  return { x: baseX + dx, y: baseY + dy };
}

// ─── Image-alpha pure helpers (WS-G phase 1) ──────────────────────────────────

/**
 * Returns true when the first pixel in `imageData` has alpha >= threshold.
 *
 * Pure — no DOM access; unit-testable with a plain Uint8ClampedArray.
 * threshold defaults to 1 so a fully-transparent pixel (a=0) is a miss.
 */
export function alphaIsOpaque(imageData: ImageData, threshold = 1): boolean {
  // ImageData.data is [R, G, B, A, R, G, B, A, ...]
  const alpha = imageData.data[3] ?? 0;
  return alpha >= threshold;
}

/**
 * Map a client-space point to the natural-pixel coordinates of the image.
 *
 * Handles object-fit: fill | cover | contain (default=fill when unset).
 * object-position is parsed as two percentage/px values (default "50% 50%").
 *
 * Returns null when the point falls outside the rendered image area (e.g.
 * the letterbox region of a contain-fitted image). A null result means the
 * image does not own this pixel — the caller should continue the z-stack.
 *
 * Pure — no DOM/window access; unit-testable with plain objects.
 */
// fallow-ignore-next-line complexity
export function mapPointToImagePixel(
  rect: { left: number; top: number; width: number; height: number },
  natural: { width: number; height: number },
  objectFit: string,
  objectPosition: string,
  point: { x: number; y: number },
): { px: number; py: number } | null {
  // Local coords within the CSS box
  const lx = point.x - rect.left;
  const ly = point.y - rect.top;

  if (lx < 0 || ly < 0 || lx > rect.width || ly > rect.height) return null;

  const fit = objectFit || "fill";

  // For fill (or unrecognized values): the natural image is stretched to the
  // box; direct linear mapping.
  if (fit === "fill" || (fit !== "cover" && fit !== "contain" && fit !== "none")) {
    if (rect.width === 0 || rect.height === 0) return null;
    const px = Math.floor((lx / rect.width) * natural.width);
    const py = Math.floor((ly / rect.height) * natural.height);
    return { px: clamp(px, 0, natural.width - 1), py: clamp(py, 0, natural.height - 1) };
  }

  // For none: image is drawn at its natural size; no scaling.
  if (fit === "none") {
    const pos = parseObjectPosition(objectPosition, rect, natural);
    const ox = pos.x;
    const oy = pos.y;
    const px = Math.floor(lx - ox);
    const py = Math.floor(ly - oy);
    if (px < 0 || py < 0 || px >= natural.width || py >= natural.height) return null;
    return { px, py };
  }

  // cover: scale uniformly so the image covers the box; may clip edges.
  // contain: scale uniformly so the image fits within the box; may letterbox.
  const scaleX = rect.width / natural.width;
  const scaleY = rect.height / natural.height;
  const scale = fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);

  const renderedW = natural.width * scale;
  const renderedH = natural.height * scale;

  const pos = parseObjectPosition(objectPosition, rect, {
    width: renderedW,
    height: renderedH,
  });

  // Offset of the rendered image's top-left within the CSS box
  const imgLeft = pos.x;
  const imgTop = pos.y;

  // Local coords relative to the rendered image's top-left
  const rx = lx - imgLeft;
  const ry = ly - imgTop;

  if (rx < 0 || ry < 0 || rx > renderedW || ry > renderedH) return null;

  if (scale === 0) return null;

  const px = Math.floor(rx / scale);
  const py = Math.floor(ry / scale);
  return { px: clamp(px, 0, natural.width - 1), py: clamp(py, 0, natural.height - 1) };
}

// ─── object-position parser (pure) ───────────────────────────────────────────

/**
 * Parse a CSS object-position value into x/y offsets (top-left of the
 * rendered content relative to the CSS box top-left).
 *
 * Supports the common subset: keyword pairs, percentage pairs, pixel pairs,
 * and single-value shorthand. Mixed units (e.g. "50% 10px") are supported.
 *
 * Pure — no DOM access.
 */
function parseObjectPosition(
  objectPosition: string,
  box: { width: number; height: number },
  content: { width: number; height: number },
): { x: number; y: number } {
  const raw = (objectPosition || "50% 50%").trim();
  const parts = raw.split(/\s+/);

  // Resolve a single token into a pixel offset along the given axis.
  // `available` is the "slack" (box dimension - content dimension).
  // fallow-ignore-next-line complexity
  function resolveToken(token: string, available: number, _isX: boolean): number {
    if (token === "left" || token === "top") return 0;
    if (token === "right" || token === "bottom") return available;
    if (token === "center") return available / 2;
    if (token.endsWith("%")) {
      const pct = parseFloat(token) / 100;
      return isNaN(pct) ? available / 2 : pct * available;
    }
    if (token.endsWith("px")) {
      const px = parseFloat(token);
      return isNaN(px) ? available / 2 : px;
    }
    // Bare number — treat as px
    const n = parseFloat(token);
    return isNaN(n) ? available / 2 : n;
  }

  const availX = box.width - content.width;
  const availY = box.height - content.height;

  if (parts.length === 1) {
    const tokenX = parts[0] ?? "50%";
    // Single value: if it's a vertical keyword the x defaults to center
    if (tokenX === "top" || tokenX === "bottom") {
      return { x: availX / 2, y: resolveToken(tokenX, availY, false) };
    }
    return { x: resolveToken(tokenX, availX, true), y: availY / 2 };
  }

  const t0 = parts[0] ?? "50%";
  const t1 = parts[1] ?? "50%";
  return {
    x: resolveToken(t0, availX, true),
    y: resolveToken(t1, availY, false),
  };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

// ─── Visibility check ─────────────────────────────────────────────────────────

/**
 * Returns true when no element in the ancestor chain (inclusive) has
 * computed opacity === 0. Checks ancestors because a parent at opacity:0
 * makes the child invisible even if the child's own opacity is 1.
 *
 * This reflects the current GSAP timeline state (whatever the player has
 * seeked to). For atTime values matching the live playhead this is always
 * accurate. For speculative times this is NOT seeked — WS-A1 does not mutate
 * the timeline; accurate out-of-band opacity queries are WS-G follow-on.
 */
function isOpacityVisible(el: Element, win: Window & typeof globalThis): boolean {
  let node: Element | null = el;
  while (node !== null) {
    const style = win.getComputedStyle(node);
    if (parseFloat(style.opacity) === 0) return false;
    node = node.parentElement;
  }
  return true;
}

// ─── Image-alpha canvas cache (WS-G phase 1) ─────────────────────────────────

/**
 * Cache of offscreen canvases keyed by image currentSrc.
 *
 * Canvases are drawn once; the same canvas is reused across hit-tests.
 * Animated images (gif) or dynamic src swaps are NOT tracked — this is a
 * phase-1 static-image optimization. A tainted entry stores null to record
 * that the image is cross-origin and all pixels should be treated as opaque.
 *
 * Exported for tests that need to reset the cache between runs.
 */
export const _imgCanvasCache = new Map<string, OffscreenCanvas | null>();

/**
 * Sample the alpha at (clientX, clientY) for an <img> element.
 *
 * Returns true (opaque) when:
 * - The image has not finished loading (naturalWidth/naturalHeight === 0)
 * - The point maps outside the rendered image area (not this image's pixel)
 * - The canvas is tainted (cross-origin, SecurityError) — fallback: opaque
 * - Alpha >= 1
 *
 * Returns false (transparent/miss) only when the canvas is readable AND the
 * alpha at the mapped pixel is 0.
 *
 * `win` is the iframe's contentWindow, used to call getComputedStyle on the
 * element which lives in the iframe's document.
 */
// fallow-ignore-next-line complexity
function imageAlphaOpaqueAt(
  img: HTMLImageElement,
  clientX: number,
  clientY: number,
  win: Window & typeof globalThis,
): boolean {
  // Not loaded yet — treat as opaque (safe fallback)
  if (img.naturalWidth === 0 || img.naturalHeight === 0) return true;

  const src = img.currentSrc || img.src;
  if (!src) return true;

  const rect = img.getBoundingClientRect();
  const style = win.getComputedStyle(img);
  const objectFit = style.objectFit || "fill";
  const objectPosition = style.objectPosition || "50% 50%";

  const mapped = mapPointToImagePixel(
    { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    { width: img.naturalWidth, height: img.naturalHeight },
    objectFit,
    objectPosition,
    { x: clientX, y: clientY },
  );

  // Point is outside the rendered image area — not this image's pixel.
  // Continue the z-stack (return false = miss on this element).
  if (mapped === null) return false;

  // Retrieve or build the offscreen canvas for this src.
  let canvas: OffscreenCanvas | null | undefined = _imgCanvasCache.get(src);
  if (canvas === undefined) {
    // First time: draw to an offscreen canvas and cache.
    try {
      const oc = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = oc.getContext("2d");
      if (!ctx) {
        // OffscreenCanvas 2D unavailable — treat as opaque.
        _imgCanvasCache.set(src, null);
        return true;
      }
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
      // Attempt a pixel read immediately to detect taint at draw time.
      // Some browsers taint lazily (on getImageData), so we also guard below.
      ctx.getImageData(0, 0, 1, 1);
      _imgCanvasCache.set(src, oc);
      canvas = oc;
    } catch {
      // SecurityError from tainted canvas — record null and fall back opaque.
      _imgCanvasCache.set(src, null);
      return true;
    }
  }

  // null means we already know this src is tainted — treat as opaque.
  if (canvas === null) return true;

  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const data = ctx.getImageData(mapped.px, mapped.py, 1, 1);
    return alphaIsOpaque(data);
  } catch {
    // Taint discovered on getImageData — update cache and fall back opaque.
    _imgCanvasCache.set(src, null);
    return true;
  }
}

// ─── IframePreviewAdapter ─────────────────────────────────────────────────────

type SelectionHandler = (ids: string[]) => void;

class IframePreviewAdapter implements PreviewAdapter {
  private readonly iframe: HTMLIFrameElement;
  private readonly _dispatch: ((op: EditOp) => void) | undefined;

  private _selection: string[] = [];
  private _handlers: SelectionHandler[] = [];

  /** Tracked id and element for the in-progress drag. */
  private _draftId: string | null = null;
  private _draftEl: HTMLElement | null = null;

  constructor(iframe: HTMLIFrameElement, dispatch?: (op: EditOp) => void) {
    this.iframe = iframe;
    this._dispatch = dispatch;
  }

  /**
   * Synchronous hit-test. Returns the nearest `[data-hf-id]` element under
   * (x, y) in the iframe's coordinate space, or null for a transparent hit
   * (root, opacity-0, nothing at all, or a transparent image pixel).
   *
   * WS-G phase 1: uses elementsFromPoint (z-stack) so a transparent-image hit
   * falls through to the layer behind. For <img> elements, the alpha at the
   * mapped natural pixel is sampled from an offscreen canvas. Cross-origin
   * images that taint the canvas are treated as opaque (safe fallback).
   *
   * atTime: reflects the GSAP state at the playhead when this is called.
   * Seeking to a different time to check visibility is WS-G follow-on.
   */
  elementAtPoint(x: number, y: number, _opts?: { atTime?: number }): ElementAtPointResult | null {
    const doc = this.iframe.contentDocument;
    if (!doc) return null;
    const win = this.iframe.contentWindow as (Window & typeof globalThis) | null;
    if (!win) return null;

    const stack = doc.elementsFromPoint(x, y);
    const isVisible = (el: Element) => isOpacityVisible(el, win);

    for (const candidate of stack) {
      // Check opacity visibility first — skip entirely invisible branches.
      if (!isOpacityVisible(candidate, win)) continue;

      // Image-alpha check: if this is an <img>, verify the pixel is opaque.
      if (candidate instanceof win.HTMLImageElement) {
        if (!imageAlphaOpaqueAt(candidate, x, y, win)) {
          // Transparent pixel — fall through to the next element in the stack.
          continue;
        }
      }

      // Resolve the nearest hf element from this candidate.
      const result = resolveNearestHfElement(candidate, isVisible);
      if (result !== null) return result;
    }

    return null;
  }

  /**
   * Write draft CSS custom properties (`--hf-studio-dx`, `--hf-studio-dy`) onto
   * the target element inside the iframe at 60fps. The composition's CSS uses
   * these vars to visually translate the element without touching the model.
   *
   * Calling applyDraft with a new id replaces the tracked element (does not
   * cancel the prior draft — call cancelPreview first if switching targets).
   *
   * width/height in DraftProps are not yet wired (resize → setStyle, future op).
   */
  applyDraft(id: string, props: DraftProps): void {
    const doc = this.iframe.contentDocument;
    if (!doc) return;

    // Reuse the tracked element across the 60fps drag; only re-query when the id
    // changes or the cached node detached (e.g. an iframe reload mid-drag).
    const cached = id === this._draftId && this._draftEl?.isConnected ? this._draftEl : null;
    const el =
      cached ??
      doc.querySelector<HTMLElement>(
        `[data-hf-id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`,
      );
    if (!el) return;

    this._draftId = id;
    this._draftEl = el;

    if (props.dx !== undefined) el.style.setProperty(VAR_DX, String(props.dx));
    if (props.dy !== undefined) el.style.setProperty(VAR_DY, String(props.dy));
  }

  /**
   * Read the accumulated draft deltas, derive a moveElement op, dispatch it,
   * then clear the CSS vars and draft state.
   *
   * No-ops when:
   * - No applyDraft was called (nothing to commit)
   * - No dispatch callback was provided at construction
   */
  commitPreview(): void {
    if (!this._draftId || !this._draftEl || !this._dispatch) {
      this._clearDraft();
      return;
    }

    const el = this._draftEl;
    const dx = parseFloat(el.style.getPropertyValue(VAR_DX) || "0") || 0;
    const dy = parseFloat(el.style.getPropertyValue(VAR_DY) || "0") || 0;
    const dataX = el.getAttribute("data-x");
    const dataY = el.getAttribute("data-y");
    const { x, y } = computeDraftPosition(dataX, dataY, dx, dy);

    this._dispatch({ type: "moveElement", target: this._draftId, x, y });
    this._clearDraft();
  }

  /** Revert draft CSS vars without dispatching any op. */
  cancelPreview(): void {
    this._clearDraft();
  }

  private _clearDraft(): void {
    if (this._draftEl) {
      this._draftEl.style.removeProperty(VAR_DX);
      this._draftEl.style.removeProperty(VAR_DY);
    }
    this._draftId = null;
    this._draftEl = null;
  }

  // Selection -----------------------------------------------------------------

  select(ids: string[], opts?: { additive?: boolean }): void {
    if (opts?.additive) {
      const merged = new Set([...this._selection, ...ids]);
      this._selection = [...merged];
    } else {
      this._selection = [...ids];
    }
    this._emit();
  }

  on(event: "selection", handler: SelectionHandler): () => void {
    if (event !== "selection") return () => {};
    this._handlers.push(handler);
    return () => {
      this._handlers = this._handlers.filter((h) => h !== handler);
    };
  }

  private _emit(): void {
    const ids = [...this._selection];
    for (const h of this._handlers) h(ids);
  }
}

export function createIframePreviewAdapter(
  iframe: HTMLIFrameElement,
  dispatch?: (op: EditOp) => void,
): PreviewAdapter {
  return new IframePreviewAdapter(iframe, dispatch);
}
