import type { MediabunnyVideoThumbnailRequest } from "./mediabunnyVideoThumbnail";

export async function createBrowserVideoThumbnail({
  blob,
  timeSeconds,
  width,
  height,
  fit = "cover",
  type = "image/webp",
  quality = 0.82,
  signal,
}: MediabunnyVideoThumbnailRequest): Promise<Blob | null> {
  throwIfAborted(signal);
  if (typeof document === "undefined") return null;

  const objectUrl = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = objectUrl;

  try {
    await waitForVideoEvent(video, "loadedmetadata", signal);
    throwIfAborted(signal);

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = clamp(timeSeconds, 0, Math.max(0, duration));
    await waitForVideoEvent(video, "seeked", signal);
    throwIfAborted(signal);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return null;

    drawVideoFrame(context, video, canvas.width, canvas.height, fit);
    return await canvasToBlob(canvas, type, quality);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function drawVideoFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  fit: "fill" | "contain" | "cover",
): void {
  const videoWidth = Math.max(1, video.videoWidth);
  const videoHeight = Math.max(1, video.videoHeight);

  if (fit === "fill") {
    context.drawImage(video, 0, 0, width, height);
    return;
  }

  const scale =
    fit === "contain"
      ? Math.min(width / videoWidth, height / videoHeight)
      : Math.max(width / videoWidth, height / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;

  context.clearRect(0, 0, width, height);
  context.drawImage(video, x, y, drawWidth, drawHeight);
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: "loadedmetadata" | "seeked",
  signal: AbortSignal | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Failed to decode video thumbnail."));
    };
    const onAbort = () => {
      cleanup();
      reject(createAbortError(signal?.reason));
    };

    if (signal?.aborted) {
      reject(createAbortError(signal.reason));
      return;
    }

    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode browser video thumbnail canvas."));
      },
      type,
      quality,
    );
  });
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw createAbortError(signal.reason);
}

function createAbortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  if (typeof DOMException === "function") {
    return new DOMException("Browser video thumbnail request aborted.", "AbortError");
  }
  return new Error("Browser video thumbnail request aborted.");
}
