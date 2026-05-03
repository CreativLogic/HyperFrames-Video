import type {
  MediabunnyVideoThumbnailRequest,
  MediabunnyVideoThumbnailResult,
} from "./mediabunnyVideoThumbnail";

export type VideoThumbnailRequest = MediabunnyVideoThumbnailRequest;

export async function createVideoThumbnail(request: VideoThumbnailRequest): Promise<Blob | null> {
  if (canTryMediabunny()) {
    const mediabunnyResult = await tryCreateMediabunnyThumbnail(request);
    if (mediabunnyResult) return mediabunnyResult.blob;
  }

  const { createBrowserVideoThumbnail } = await import("./browserVideoThumbnail");
  return createBrowserVideoThumbnail(request);
}

function canTryMediabunny(): boolean {
  return typeof Blob !== "undefined" && typeof VideoDecoder !== "undefined";
}

async function tryCreateMediabunnyThumbnail(
  request: VideoThumbnailRequest,
): Promise<MediabunnyVideoThumbnailResult | null> {
  try {
    const { createMediabunnyVideoThumbnail } = await import("./mediabunnyVideoThumbnail");
    return createMediabunnyVideoThumbnail(request);
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}
