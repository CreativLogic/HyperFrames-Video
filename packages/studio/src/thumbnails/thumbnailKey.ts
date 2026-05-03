export type ThumbnailKind = "composition" | "html-element" | "image" | "video" | "audio";

export interface ThumbnailKey {
  projectId: string;
  sourcePath: string;
  sourceHash: string;
  kind: ThumbnailKind;
  selector?: string;
  selectorIndex?: number;
  timeSeconds: number;
  width: number;
  height: number;
  devicePixelRatio: number;
  version: number;
}

export function serializeThumbnailKey(key: ThumbnailKey): string {
  const parts = [
    ["v", formatInteger(key.version)],
    ["project", key.projectId],
    ["source", key.sourcePath],
    ["hash", key.sourceHash],
    ["kind", key.kind],
    ["time", formatNumber(key.timeSeconds)],
    ["w", formatInteger(key.width)],
    ["h", formatInteger(key.height)],
    ["dpr", formatNumber(key.devicePixelRatio)],
  ];

  if (key.selector) parts.push(["selector", key.selector]);
  if (key.selectorIndex != null) parts.push(["selectorIndex", formatInteger(key.selectorIndex)]);

  return parts.map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join(";");
}

export function estimateThumbnailBytes(
  width: number,
  height: number,
  devicePixelRatio = 1,
): number {
  const pixelRatio = Math.max(1, devicePixelRatio);
  return (
    Math.max(1, Math.ceil(width * pixelRatio)) * Math.max(1, Math.ceil(height * pixelRatio)) * 4
  );
}

function formatInteger(value: number): string {
  return String(Math.max(0, Math.round(value)));
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}
