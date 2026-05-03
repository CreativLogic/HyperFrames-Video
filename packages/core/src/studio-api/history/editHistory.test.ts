import { describe, expect, it } from "vitest";
import {
  buildEditHistoryEntry,
  canApplyEditHistoryEntry,
  createEmptyEditHistory,
  hashEditHistoryContent,
  pushEditHistoryEntry,
  redoEditHistory,
  undoEditHistory,
} from "./editHistory.js";

describe("shared edit history", () => {
  it("records actor metadata and changed file snapshots", () => {
    const entry = buildEditHistoryEntry({
      id: "entry-1",
      projectId: "project-1",
      label: "Agent edit",
      kind: "agent",
      actor: { type: "agent", id: "codex", label: "Codex" },
      now: 100,
      files: {
        "index.html": { before: "before", after: "after" },
        "same.html": { before: "same", after: "same" },
      },
    });

    const state = pushEditHistoryEntry(createEmptyEditHistory(), entry);

    expect(state.undo).toHaveLength(1);
    expect(state.undo[0].actor).toEqual({ type: "agent", id: "codex", label: "Codex" });
    expect(Object.keys(state.undo[0].files)).toEqual(["index.html"]);
    expect(state.undo[0].files["index.html"].beforeHash).toBe(hashEditHistoryContent("before"));
    expect(state.undo[0].files["index.html"].afterHash).toBe(hashEditHistoryContent("after"));
  });

  it("moves entries through undo and redo with content-hash checks", () => {
    const entry = buildEditHistoryEntry({
      id: "entry-1",
      projectId: "project-1",
      label: "Move layer",
      now: 100,
      files: {
        "index.html": { before: "before", after: "after" },
      },
    });
    const state = pushEditHistoryEntry(createEmptyEditHistory(), entry);

    const undo = undoEditHistory(state, { "index.html": hashEditHistoryContent("after") }, 200);
    expect(undo.ok).toBe(true);
    expect(undo.filesToWrite).toEqual({ "index.html": "before" });

    const redo = redoEditHistory(
      undo.state,
      { "index.html": hashEditHistoryContent("before") },
      300,
    );
    expect(redo.ok).toBe(true);
    expect(redo.filesToWrite).toEqual({ "index.html": "after" });
  });

  it("rejects history application when any current hash does not match", () => {
    const entry = buildEditHistoryEntry({
      id: "entry-1",
      projectId: "project-1",
      label: "Update files",
      now: 100,
      files: {
        "index.html": { before: "a", after: "b" },
        "scene.html": { before: "c", after: "d" },
      },
    });

    expect(
      canApplyEditHistoryEntry(entry, "undo", {
        "index.html": hashEditHistoryContent("b"),
        "scene.html": hashEditHistoryContent("external"),
      }),
    ).toEqual({ ok: false, reason: "content-mismatch", path: "scene.html" });
  });

  it("coalesces matching edit groups inside the coalesce window", () => {
    const first = buildEditHistoryEntry({
      id: "entry-1",
      projectId: "project-1",
      label: "Edit source",
      kind: "source",
      coalesceKey: "source:index.html",
      now: 100,
      files: {
        "index.html": { before: "a", after: "b" },
      },
    });
    const second = buildEditHistoryEntry({
      id: "entry-2",
      projectId: "project-1",
      label: "Edit source",
      kind: "source",
      coalesceKey: "source:index.html",
      now: 300,
      files: {
        "index.html": { before: "b", after: "c" },
      },
    });

    const state = pushEditHistoryEntry(
      pushEditHistoryEntry(createEmptyEditHistory(), first),
      second,
      { coalesceMs: 1000 },
    );

    expect(state.undo).toHaveLength(1);
    expect(state.undo[0].id).toBe("entry-2");
    expect(state.undo[0].files["index.html"].before).toBe("a");
    expect(state.undo[0].files["index.html"].after).toBe("c");
  });
});
