import { useCallback, useEffect, useState } from "react";
import type {
  BuildEditHistoryEntryInput,
  EditHistoryKind,
  ProjectHistorySummary,
} from "@hyperframes/core/studio-history";

interface RecordEditInput {
  label: string;
  kind: EditHistoryKind;
  coalesceKey?: string;
  files: BuildEditHistoryEntryInput["files"];
}

interface ApplyCallbacks {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
}

interface UseSharedEditHistoryOptions {
  projectId: string | null;
}

interface ApplyResult {
  ok: boolean;
  reason?: "empty" | "content-mismatch";
  label?: string;
}

interface SharedHistorySnapshot {
  loaded: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  revision: number;
}

const EMPTY_HISTORY: SharedHistorySnapshot = {
  loaded: false,
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  revision: 0,
};

function toSnapshot(summary: ProjectHistorySummary, loaded = true): SharedHistorySnapshot {
  return {
    loaded,
    canUndo: summary.canUndo,
    canRedo: summary.canRedo,
    undoLabel: summary.undoLabel ?? null,
    redoLabel: summary.redoLabel ?? null,
    revision: summary.revision,
  };
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function readApplyResult(data: unknown, fallbackOk: boolean): ApplyResult {
  if (typeof data !== "object" || data === null) return { ok: fallbackOk };
  const result = data as { ok?: unknown; error?: unknown; reason?: unknown; label?: unknown };
  if (result.ok === true) {
    return {
      ok: true,
      label: typeof result.label === "string" ? result.label : undefined,
    };
  }
  const reason = result.reason ?? result.error;
  return {
    ok: false,
    reason: reason === "content-mismatch" || reason === "empty" ? reason : undefined,
  };
}

function dispatchProjectHistoryEvent(data: unknown): void {
  window.dispatchEvent(new CustomEvent("hf:project-history-event", { detail: data }));
}

function refreshPreviewFrames(): void {
  for (const frame of document.querySelectorAll("iframe")) {
    if (!(frame instanceof HTMLIFrameElement) || !frame.src.includes("/preview/")) continue;
    const url = new URL(frame.src);
    url.searchParams.set("hfRefresh", String(Date.now()));
    frame.src = url.toString();
  }
}

export function useSharedEditHistory(options: UseSharedEditHistoryOptions) {
  const [snapshot, setSnapshot] = useState<SharedHistorySnapshot>(EMPTY_HISTORY);
  const projectId = options.projectId;

  useEffect(() => {
    if (!projectId) {
      setSnapshot({ ...EMPTY_HISTORY, loaded: true });
      return;
    }

    let cancelled = false;
    setSnapshot(EMPTY_HISTORY);

    fetch(`/api/projects/${projectId}/history`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load project history");
        return (await response.json()) as ProjectHistorySummary;
      })
      .then((summary) => {
        if (!cancelled) setSnapshot(toSnapshot(summary));
      })
      .catch(() => {
        if (!cancelled) setSnapshot({ ...EMPTY_HISTORY, loaded: true });
      });

    const events = new EventSource(`/api/projects/${projectId}/events`);
    events.addEventListener("project-edit", (event) => {
      const data = JSON.parse(event.data) as { history?: ProjectHistorySummary };
      dispatchProjectHistoryEvent(data);
      refreshPreviewFrames();
      if (!cancelled && data.history) setSnapshot(toSnapshot(data.history));
    });
    events.addEventListener("history-updated", (event) => {
      const data = JSON.parse(event.data) as { history?: ProjectHistorySummary };
      dispatchProjectHistoryEvent(data);
      refreshPreviewFrames();
      if (!cancelled && data.history) setSnapshot(toSnapshot(data.history));
    });
    events.addEventListener("file-change", (event) => {
      dispatchProjectHistoryEvent(JSON.parse(event.data));
      refreshPreviewFrames();
    });

    return () => {
      cancelled = true;
      events.close();
    };
  }, [projectId]);

  const recordEdit = useCallback(
    async (input: RecordEditInput) => {
      if (!projectId) return;
      const response = await fetch(`/api/projects/${projectId}/history/record-applied`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          actor: { type: "user" },
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error("Failed to record project edit");
      if (typeof data === "object" && data !== null && "history" in data) {
        const history = data.history;
        if (typeof history === "object" && history !== null) {
          dispatchProjectHistoryEvent(data);
          refreshPreviewFrames();
          setSnapshot(toSnapshot(history as ProjectHistorySummary));
        }
      }
    },
    [projectId],
  );

  const applyTransition = useCallback(
    async (direction: "undo" | "redo"): Promise<ApplyResult> => {
      if (!projectId) return { ok: false, reason: "empty" };
      const response = await fetch(`/api/projects/${projectId}/history/${direction}`, {
        method: "POST",
      });
      const data = await readJson(response);
      if (typeof data === "object" && data !== null && "history" in data) {
        const history = data.history;
        if (typeof history === "object" && history !== null) {
          dispatchProjectHistoryEvent(data);
          refreshPreviewFrames();
          setSnapshot(toSnapshot(history as ProjectHistorySummary));
        }
      }
      if (!response.ok) return readApplyResult(data, false);
      return readApplyResult(data, true);
    },
    [projectId],
  );

  const undo = useCallback(
    async (_callbacks: ApplyCallbacks): Promise<ApplyResult> => applyTransition("undo"),
    [applyTransition],
  );

  const redo = useCallback(
    async (_callbacks: ApplyCallbacks): Promise<ApplyResult> => applyTransition("redo"),
    [applyTransition],
  );

  return {
    ...snapshot,
    recordEdit,
    undo,
    redo,
  };
}
