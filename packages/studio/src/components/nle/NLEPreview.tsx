import { memo, type Ref } from "react";
import { Player } from "../../player";

interface NLEPreviewProps {
  projectId: string;
  iframeRef: Ref<HTMLIFrameElement>;
  onIframeLoad: () => void;
  portrait?: boolean;
  directUrl?: string;
}

export function getPreviewPlayerKey({
  projectId,
  directUrl,
}: {
  projectId: string;
  directUrl?: string;
}): string {
  return directUrl ?? projectId;
}

/**
 * Manages the composition preview identity.
 * Routine source refreshes happen inside the existing iframe via
 * useTimelinePlayer.refreshPlayer(); this only remounts when the project or
 * drilled-in composition URL changes.
 */
export const NLEPreview = memo(function NLEPreview({
  projectId,
  iframeRef,
  onIframeLoad,
  portrait,
  directUrl,
}: NLEPreviewProps) {
  const playerKey = getPreviewPlayerKey({ projectId, directUrl });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="relative flex-1 flex items-center justify-center p-2 overflow-hidden min-h-0 outline-none focus:ring-1 focus:ring-studio-accent/40"
        tabIndex={0}
        aria-label="Composition preview"
      >
        <Player
          key={playerKey}
          ref={iframeRef}
          projectId={directUrl ? undefined : projectId}
          directUrl={directUrl}
          onLoad={onIframeLoad}
          portrait={portrait}
        />
      </div>
    </div>
  );
});
