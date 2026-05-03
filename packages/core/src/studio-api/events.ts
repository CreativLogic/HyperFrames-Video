import type {
  EditHistoryActor,
  EditHistoryKind,
  ProjectHistorySummary,
} from "./history/editHistory.js";

export type StudioProjectEvent =
  | {
      type: "project-edit";
      projectId: string;
      entryId: string;
      label: string;
      kind: EditHistoryKind;
      actor?: EditHistoryActor;
      changedPaths: string[];
      unmanagedPaths?: string[];
      history: ProjectHistorySummary;
    }
  | {
      type: "history-updated";
      projectId: string;
      changedPaths: string[];
      unmanagedPaths?: string[];
      history: ProjectHistorySummary;
    }
  | {
      type: "file-change";
      projectId: string;
      changedPaths: string[];
      unmanagedPaths?: string[];
      source: "studio" | "agent" | "external";
    };

export type StudioProjectEventListener = (event: StudioProjectEvent) => void;

export interface StudioEventBus {
  publish(event: StudioProjectEvent): void;
  subscribe(projectId: string, listener: StudioProjectEventListener): () => void;
}

export function createStudioEventBus(): StudioEventBus {
  const listeners = new Map<string, Set<StudioProjectEventListener>>();

  return {
    publish(event) {
      const projectListeners = listeners.get(event.projectId);
      if (!projectListeners) return;
      for (const listener of projectListeners) {
        listener(event);
      }
    },
    subscribe(projectId, listener) {
      const projectListeners = listeners.get(projectId) ?? new Set<StudioProjectEventListener>();
      projectListeners.add(listener);
      listeners.set(projectId, projectListeners);
      return () => {
        projectListeners.delete(listener);
        if (projectListeners.size === 0) listeners.delete(projectId);
      };
    },
  };
}
