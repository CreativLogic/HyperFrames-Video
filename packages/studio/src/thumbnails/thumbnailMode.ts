export type ThumbnailMode = "off" | "hover" | "visible" | "always";

export const THUMBNAIL_MODE_STORAGE_KEY = "hf-studio-thumbnail-mode-v2";
export const DEFAULT_THUMBNAIL_MODE: ThumbnailMode = "off";

export function normalizeThumbnailMode(value: unknown): ThumbnailMode {
  if (value === "visible" || value === "always" || value === "off") return value;
  if (value === "hover") return "visible";
  return DEFAULT_THUMBNAIL_MODE;
}

export function shouldRequestThumbnail(
  mode: ThumbnailMode,
  state: { hovered?: boolean; visible?: boolean } = {},
): boolean {
  if (mode === "always") return true;
  if (mode === "visible") return state.visible !== false;
  if (mode === "hover") return state.hovered === true;
  return false;
}

export function readStoredThumbnailMode(
  storage: Storage | undefined = getLocalStorage(),
): ThumbnailMode {
  if (!storage) return DEFAULT_THUMBNAIL_MODE;
  return normalizeThumbnailMode(storage.getItem(THUMBNAIL_MODE_STORAGE_KEY));
}

export function writeStoredThumbnailMode(
  mode: ThumbnailMode,
  storage: Storage | undefined = getLocalStorage(),
): void {
  storage?.setItem(THUMBNAIL_MODE_STORAGE_KEY, mode);
}

function getLocalStorage(): Storage | undefined {
  if (typeof localStorage === "undefined") return undefined;
  return localStorage;
}
