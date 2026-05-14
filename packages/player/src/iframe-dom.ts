/**
 * DOM setup helpers for the player's shadow root.
 *
 * Keeps constructor boilerplate out of the web component class body.
 */

// Cached Constructable Stylesheet shared across all player instances.
let _sharedSheet: CSSStyleSheet | null = null;

/**
 * Adopt `cssText` into `shadow` via a shared Constructable Stylesheet when the
 * browser supports it, falling back to a `<style>` element injection. The sheet
 * is cached on first creation and reused across all player instances.
 */
export function adoptShadowStyles(shadow: ShadowRoot, cssText: string): void {
  if (typeof CSSStyleSheet !== "undefined") {
    try {
      if (!_sharedSheet) {
        _sharedSheet = new CSSStyleSheet();
        _sharedSheet.replaceSync(cssText);
      }
      shadow.adoptedStyleSheets = [_sharedSheet];
      return;
    } catch {
      /* fallthrough */
    }
  }
  const style = document.createElement("style");
  style.textContent = cssText;
  shadow.appendChild(style);
}

/**
 * Creates and configures the iframe element that hosts the composition, plus
 * the wrapper container div. Returns handles to both so the constructor can
 * attach them to the shadow root and track references without inlining the
 * boilerplate.
 */
export function createCompositionIframe(): {
  container: HTMLDivElement;
  iframe: HTMLIFrameElement;
} {
  const container = document.createElement("div");
  container.className = "hfp-container";

  const iframe = document.createElement("iframe");
  iframe.className = "hfp-iframe";
  iframe.sandbox.add("allow-scripts", "allow-same-origin");
  iframe.allow = "autoplay; fullscreen";
  iframe.referrerPolicy = "no-referrer";
  iframe.title = "HyperFrames Composition";

  container.appendChild(iframe);
  return { container, iframe };
}

/**
 * Scale the iframe so the composition fits inside the player element while
 * preserving aspect ratio. No-ops when the player has no painted size yet.
 */
export function scaleIframeToFit(
  playerElement: HTMLElement,
  iframe: HTMLIFrameElement,
  compositionWidth: number,
  compositionHeight: number,
): void {
  // Use offsetWidth/offsetHeight (layout dimensions) instead of getBoundingClientRect(),
  // which returns visual dimensions inflated by ancestor CSS zoom. Using the zoomed rect
  // would double-scale the iframe when an ancestor has CSS zoom applied.
  const width = playerElement.offsetWidth;
  const height = playerElement.offsetHeight;
  if (width === 0 || height === 0) return;
  const scale = Math.min(width / compositionWidth, height / compositionHeight);
  iframe.style.width = `${compositionWidth}px`;
  iframe.style.height = `${compositionHeight}px`;
  iframe.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
