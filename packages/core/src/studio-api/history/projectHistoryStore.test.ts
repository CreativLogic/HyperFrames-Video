import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ResolvedProject } from "../types.js";
import { hashEditHistoryContent } from "./editHistory.js";
import {
  adoptExternalProjectChanges,
  applyProjectHistoryTransition,
  ProjectHistoryError,
  readProjectHistorySnapshot,
  recordAppliedProjectEdit,
  recordProjectEdit,
} from "./projectHistoryStore.js";
import { primeProjectSnapshotCache } from "./projectSnapshotCache.js";

const cleanupDirs: string[] = [];

function createProject(): ResolvedProject {
  const dir = mkdtempSync(join(tmpdir(), "hf-history-"));
  cleanupDirs.push(dir);
  return { id: "project-1", dir, title: "Project 1" };
}

afterEach(() => {
  for (const dir of cleanupDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("project history store", () => {
  it("records a transaction edit and applies undo/redo", async () => {
    const project = createProject();
    writeFileSync(join(project.dir, "index.html"), "before", "utf-8");

    const result = await recordProjectEdit(project, {
      label: "Agent edit",
      kind: "agent",
      actor: { type: "agent", id: "codex" },
      files: {
        "index.html": {
          beforeHash: hashEditHistoryContent("before"),
          after: "after",
        },
      },
    });

    expect(result.changedPaths).toEqual(["index.html"]);
    expect(readFileSync(join(project.dir, "index.html"), "utf-8")).toBe("after");
    expect((await readProjectHistorySnapshot(project)).canUndo).toBe(true);

    const undo = await applyProjectHistoryTransition(project, "undo");
    expect(undo.ok).toBe(true);
    expect(readFileSync(join(project.dir, "index.html"), "utf-8")).toBe("before");

    const redo = await applyProjectHistoryTransition(project, "redo");
    expect(redo.ok).toBe(true);
    expect(readFileSync(join(project.dir, "index.html"), "utf-8")).toBe("after");
  });

  it("rejects stale before hashes", async () => {
    const project = createProject();
    writeFileSync(join(project.dir, "index.html"), "current", "utf-8");

    await expect(
      recordProjectEdit(project, {
        label: "Agent edit",
        kind: "agent",
        files: {
          "index.html": {
            beforeHash: hashEditHistoryContent("stale"),
            after: "after",
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "content-mismatch",
      path: "index.html",
    } satisfies Partial<ProjectHistoryError>);
  });

  it("records already-applied Studio edits without writing files again", async () => {
    const project = createProject();
    writeFileSync(join(project.dir, "index.html"), "after", "utf-8");

    const result = await recordAppliedProjectEdit(project, {
      label: "Move layer",
      kind: "manual",
      files: {
        "index.html": { before: "before", after: "after" },
      },
    });

    expect(result.changedPaths).toEqual(["index.html"]);
    expect((await readProjectHistorySnapshot(project)).undoLabel).toBe("Move layer");
  });

  it("adopts free-form external edits when a previous snapshot is cached", async () => {
    const project = createProject();
    writeFileSync(join(project.dir, "index.html"), "before", "utf-8");
    primeProjectSnapshotCache(project);
    writeFileSync(join(project.dir, "index.html"), "after", "utf-8");

    const result = await adoptExternalProjectChanges(project, {
      paths: ["index.html"],
      actor: { type: "agent", id: "codex" },
    });

    expect(result.changedPaths).toEqual(["index.html"]);
    expect(result.unmanagedPaths).toEqual([]);
    expect((await readProjectHistorySnapshot(project)).undoLabel).toBe("Agent edit");
  });

  it("does not create undo history when previous content is missing", async () => {
    const project = createProject();
    writeFileSync(join(project.dir, "index.html"), "after", "utf-8");

    const result = await adoptExternalProjectChanges(project, {
      paths: ["index.html"],
      actor: { type: "external" },
    });

    expect(result.changedPaths).toEqual([]);
    expect(result.unmanagedPaths).toEqual(["index.html"]);
    expect((await readProjectHistorySnapshot(project)).canUndo).toBe(false);
  });

  it("does not adopt a server undo write as a new external edit", async () => {
    const project = createProject();
    writeFileSync(join(project.dir, "index.html"), "before", "utf-8");
    primeProjectSnapshotCache(project);
    await recordProjectEdit(project, {
      label: "Agent edit",
      kind: "agent",
      files: {
        "index.html": {
          beforeHash: hashEditHistoryContent("before"),
          after: "after",
        },
      },
    });

    const undo = await applyProjectHistoryTransition(project, "undo");
    expect(undo.ok).toBe(true);
    const adopted = await adoptExternalProjectChanges(project, {
      paths: ["index.html"],
      actor: { type: "external" },
    });

    expect(adopted.changedPaths).toEqual([]);
    const summary = await readProjectHistorySnapshot(project);
    expect(summary.canUndo).toBe(false);
    expect(summary.canRedo).toBe(true);
  });
});
