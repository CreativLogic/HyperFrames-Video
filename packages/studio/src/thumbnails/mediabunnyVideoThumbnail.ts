export interface MediabunnyVideoThumbnailRequest {
  blob: Blob;
  timeSeconds: number;
  width: number;
  height: number;
  fit?: "fill" | "contain" | "cover";
  type?: "image/png" | "image/webp";
  quality?: number;
  signal?: AbortSignal;
}

export interface MediabunnyVideoThumbnailResult {
  blob: Blob;
  timestamp: number;
  duration: number;
}

type ThumbnailCanvas = HTMLCanvasElement | OffscreenCanvas;

export function canUseMediabunnyVideoThumbnails(): boolean {
  return typeof Blob !== "undefined" && typeof VideoDecoder !== "undefined";
}

export async function createMediabunnyVideoThumbnail({
  blob,
  timeSeconds,
  width,
  height,
  fit = "cover",
  type = "image/webp",
  quality = 0.82,
  signal,
}: MediabunnyVideoThumbnailRequest): Promise<MediabunnyVideoThumbnailResult | null> {
  throwIfAborted(signal);

  const { ALL_FORMATS, BlobSource, CanvasSink, Input } = await import("mediabunny");
  const input = new Input({
    source: new BlobSource(blob, { maxCacheSize: 8 * 1024 * 1024 }),
    formats: ALL_FORMATS,
  });

  const abort = () => input.dispose();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    throwIfAborted(signal);
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) return null;

    throwIfAborted(signal);
    const sink = new CanvasSink(videoTrack, {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      fit,
      poolSize: 1,
    });
    const frame = await sink.getCanvas(Math.max(0, timeSeconds), {
      skipLiveWait: true,
      verifyKeyPackets: false,
    });

    throwIfAborted(signal);
    if (!frame) return null;

    return {
      blob: await canvasToBlob(frame.canvas, type, quality),
      timestamp: frame.timestamp,
      duration: frame.duration,
    };
  } finally {
    signal?.removeEventListener("abort", abort);
    input.dispose();
  }
}

async function canvasToBlob(canvas: ThumbnailCanvas, type: string, quality: number): Promise<Blob> {
  if (hasConvertToBlob(canvas)) {
    return canvas.convertToBlob({ type, quality });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to encode Mediabunny thumbnail canvas."));
        }
      },
      type,
      quality,
    );
  });
}

function hasConvertToBlob(canvas: ThumbnailCanvas): canvas is OffscreenCanvas {
  return "convertToBlob" in canvas;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw createAbortError(signal.reason);
}

function createAbortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  if (typeof DOMException === "function") {
    return new DOMException("Mediabunny thumbnail request aborted.", "AbortError");
  }
  return new Error("Mediabunny thumbnail request aborted.");
}
