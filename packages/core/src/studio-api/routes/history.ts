import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { StudioEventBus } from "../events.js";
import type { EditHistoryActor, ProjectEditRequest } from "../history/editHistory.js";
import {
  adoptExternalProjectChanges,
  applyProjectHistoryTransition,
  ProjectHistoryError,
  readProjectHistorySnapshot,
  recordAppliedProjectEdit,
  recordProjectEdit,
} from "../history/projectHistoryStore.js";
import type { StudioApiAdapter } from "../types.js";

function errorResponse(c: { json: (data: unknown, status?: number) => Response }, error: unknown) {
  if (error instanceof ProjectHistoryError) {
    return c.json(
      {
        error: error.code,
        message: error.message,
        path: error.path,
        expectedHash: error.expectedHash,
        actualHash: error.actualHash,
      },
      error.status,
    );
  }
  throw error;
}

export function registerHistoryRoutes(
  api: Hono,
  adapter: StudioApiAdapter,
  events: StudioEventBus,
): void {
  api.get("/projects/:id/history", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    return c.json(await readProjectHistorySnapshot(project));
  });

  api.get("/projects/:id/edit-contract", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    return c.json({
      version: 1,
      projectId: project.id,
      endpoints: {
        submitEdit: `/api/projects/${project.id}/edits`,
        adoptExternal: `/api/projects/${project.id}/history/adopt-external`,
        undo: `/api/projects/${project.id}/history/undo`,
        redo: `/api/projects/${project.id}/history/redo`,
        events: `/api/projects/${project.id}/events`,
      },
      editRequest: {
        label: "Agent edit",
        kind: "agent",
        actor: { type: "agent", id: "codex" },
        files: {
          "index.html": {
            beforeHash: "hash from current content",
            after: "new file content",
          },
        },
      },
    });
  });

  api.post("/projects/:id/edits", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const body = (await c.req.json().catch(() => null)) as ProjectEditRequest | null;
    if (!body?.label || !body.kind || !body.files || typeof body.files !== "object") {
      return c.json({ error: "invalid-request" }, 400);
    }

    try {
      const result = await recordProjectEdit(project, body);
      if (result.changedPaths.length > 0) {
        events.publish({
          type: "project-edit",
          projectId: project.id,
          entryId: result.entryId,
          label: body.label,
          kind: body.kind,
          actor: body.actor,
          changedPaths: result.changedPaths,
          history: result.history,
        });
        events.publish({
          type: "file-change",
          projectId: project.id,
          changedPaths: result.changedPaths,
          source: body.actor?.type === "agent" ? "agent" : "studio",
        });
      }
      return c.json(result);
    } catch (error) {
      return errorResponse(c, error);
    }
  });

  api.post("/projects/:id/history/record-applied", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const body = (await c.req.json().catch(() => null)) as {
      label?: string;
      kind?: ProjectEditRequest["kind"];
      actor?: EditHistoryActor;
      coalesceKey?: string;
      files?: Record<string, { before: string; after: string }>;
    } | null;
    if (!body?.label || !body.kind || !body.files || typeof body.files !== "object") {
      return c.json({ error: "invalid-request" }, 400);
    }

    try {
      const result = await recordAppliedProjectEdit(project, {
        label: body.label,
        kind: body.kind,
        actor: body.actor,
        coalesceKey: body.coalesceKey,
        files: body.files,
      });
      if (result.entryId && result.changedPaths.length > 0) {
        events.publish({
          type: "project-edit",
          projectId: project.id,
          entryId: result.entryId,
          label: body.label,
          kind: body.kind,
          actor: body.actor,
          changedPaths: result.changedPaths,
          history: result.history,
        });
      }
      return c.json({ ok: true, ...result });
    } catch (error) {
      return errorResponse(c, error);
    }
  });

  api.post("/projects/:id/history/undo", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    try {
      const result = await applyProjectHistoryTransition(project, "undo");
      if (result.ok) {
        events.publish({
          type: "history-updated",
          projectId: project.id,
          changedPaths: result.changedPaths,
          history: result.history,
        });
        events.publish({
          type: "file-change",
          projectId: project.id,
          changedPaths: result.changedPaths,
          source: "studio",
        });
      }
      return c.json(
        result.ok ? result : { ...result, error: result.reason },
        result.ok ? 200 : 409,
      );
    } catch (error) {
      return errorResponse(c, error);
    }
  });

  api.post("/projects/:id/history/redo", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    try {
      const result = await applyProjectHistoryTransition(project, "redo");
      if (result.ok) {
        events.publish({
          type: "history-updated",
          projectId: project.id,
          changedPaths: result.changedPaths,
          history: result.history,
        });
        events.publish({
          type: "file-change",
          projectId: project.id,
          changedPaths: result.changedPaths,
          source: "studio",
        });
      }
      return c.json(
        result.ok ? result : { ...result, error: result.reason },
        result.ok ? 200 : 409,
      );
    } catch (error) {
      return errorResponse(c, error);
    }
  });

  api.post("/projects/:id/history/adopt-external", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const body = (await c.req.json().catch(() => null)) as {
      paths?: string[];
      label?: string;
      actor?: EditHistoryActor;
    } | null;
    if (!body?.paths || !Array.isArray(body.paths)) {
      return c.json({ error: "invalid-request" }, 400);
    }

    try {
      const result = await adoptExternalProjectChanges(project, {
        paths: body.paths,
        label: body.label,
        actor: body.actor ?? { type: "external" },
      });
      if (result.changedPaths.length > 0 || (result.unmanagedPaths?.length ?? 0) > 0) {
        if (result.entryId) {
          events.publish({
            type: "project-edit",
            projectId: project.id,
            entryId: result.entryId,
            label: result.label ?? "External edit",
            kind: body.actor?.type === "agent" ? "agent" : "manual",
            actor: body.actor ?? { type: "external" },
            changedPaths: result.changedPaths,
            unmanagedPaths: result.unmanagedPaths,
            history: result.history,
          });
        }
        events.publish({
          type: "file-change",
          projectId: project.id,
          changedPaths: result.changedPaths,
          unmanagedPaths: result.unmanagedPaths,
          source: body.actor?.type === "agent" ? "agent" : "external",
        });
      }
      return c.json({ ok: true, ...result });
    } catch (error) {
      return errorResponse(c, error);
    }
  });

  api.get("/projects/:id/events", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);

    return streamSSE(c, async (stream) => {
      const unsubscribe = events.subscribe(project.id, (event) => {
        stream
          .writeSSE({
            event: event.type,
            data: JSON.stringify(event),
          })
          .catch(() => {});
      });
      try {
        while (true) {
          await stream.writeSSE({
            event: "heartbeat",
            data: JSON.stringify({ projectId: project.id, now: Date.now() }),
          });
          await stream.sleep(15000);
        }
      } finally {
        unsubscribe();
      }
    });
  });
}
