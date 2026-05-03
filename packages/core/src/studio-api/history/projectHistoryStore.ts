import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { ResolvedProject } from "../types.js";
import { isSafePath } from "../helpers/safePath.js";
import {
  buildEditHistoryEntry,
  createEmptyEditHistory,
  hashEditHistoryContent,
  pushEditHistoryEntry,
  redoEditHistory,
  undoEditHistory,
  type BuildEditHistoryEntryInput,
  type EditHistoryActor,
  type EditHistoryState,
  type ProjectEditRequest,
  type ProjectEditResult,
  type ProjectHistorySummary,
} from "./editHistory.js";
import {
  primeProjectSnapshotCache,
  readCachedProjectChanges,
  updateProjectSnapshotCache,
} from "./projectSnapshotCache.js";

interface PersistedProjectHistory {
  version: 1;
  revision: number;
  state: EditHistoryState;
}

export interface ProjectHistoryStoreResult {
  entryId?: string;
  label?: string;
  changedPaths: string[];
  unmanagedPaths?: string[];
  history: ProjectHistorySummary;
}

export type ProjectHistoryFailureReason = "empty" | "content-mismatch";

export class ProjectHistoryError extends Error {
  readonly code:
    | "content-mismatch"
    | "invalid-path"
    | "not-found"
    | "invalid-request"
    | "write-failed";
  readonly path?: string;
  readonly expectedHash?: string;
  readonly actualHash?: string;
  readonly status: number;

  constructor(
    code: ProjectHistoryError["code"],
    message: string,
    options?: { path?: string; expectedHash?: string; actualHash?: string; status?: number },
  ) {
    super(message);
    this.name = "ProjectHistoryError";
    this.code = code;
    this.path = options?.path;
    this.expectedHash = options?.expectedHash;
    this.actualHash = options?.actualHash;
    this.status = options?.status ?? (code === "content-mismatch" ? 409 : 400);
  }
}

const HISTORY_PATH = ".hyperframes/studio-history-v1.json";
const projectQueues = new Map<string, Promise<void>>();
const recentInternalWrites = new Map<string, number>();
const INTERNAL_WRITE_SUPPRESSION_MS = 2000;

function historyFilePath(project: ResolvedProject): string {
  return resolve(project.dir, HISTORY_PATH);
}

function makeSummary(
  projectId: string,
  state: EditHistoryState,
  revision: number,
): ProjectHistorySummary {
  const undoEntry = state.undo[state.undo.length - 1];
  const redoEntry = state.redo[state.redo.length - 1];
  return {
    projectId,
    canUndo: Boolean(undoEntry),
    canRedo: Boolean(redoEntry),
    undoLabel: undoEntry?.label,
    redoLabel: redoEntry?.label,
    updatedAt: state.updatedAt,
    revision,
  };
}

function readPersistedHistory(project: ResolvedProject): PersistedProjectHistory {
  const filePath = historyFilePath(project);
  if (!existsSync(filePath)) {
    return { version: 1, revision: 0, state: createEmptyEditHistory() };
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      parsed.version === 1 &&
      "revision" in parsed &&
      typeof parsed.revision === "number" &&
      "state" in parsed &&
      typeof parsed.state === "object" &&
      parsed.state !== null
    ) {
      const state = parsed.state as EditHistoryState;
      if (state.version === 1 && Array.isArray(state.undo) && Array.isArray(state.redo)) {
        return { version: 1, revision: parsed.revision, state };
      }
    }
  } catch {
    /* fall back to empty history */
  }

  return { version: 1, revision: 0, state: createEmptyEditHistory() };
}

function writePersistedHistory(project: ResolvedProject, history: PersistedProjectHistory): void {
  const filePath = historyFilePath(project);
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, JSON.stringify(history, null, 2), "utf-8");
  renameSync(tempPath, filePath);
}

function normalizeProjectPath(project: ResolvedProject, path: string): string {
  if (!path || path.includes("\0")) {
    throw new ProjectHistoryError("invalid-path", "Invalid project path", { path, status: 400 });
  }
  const absPath = resolve(project.dir, path);
  if (!isSafePath(project.dir, absPath)) {
    throw new ProjectHistoryError("invalid-path", "Project path escapes project directory", {
      path,
      status: 403,
    });
  }
  const relativePath = path.split("\\").join("/");
  if (relativePath === HISTORY_PATH || relativePath.startsWith(".hyperframes/")) {
    throw new ProjectHistoryError("invalid-path", "Studio history files cannot be edited", {
      path,
      status: 403,
    });
  }
  return relativePath;
}

function readExistingTextFile(project: ResolvedProject, path: string): string {
  const absPath = resolve(project.dir, path);
  if (!existsSync(absPath) || !statSync(absPath).isFile()) {
    throw new ProjectHistoryError("not-found", "File not found", { path, status: 404 });
  }
  return readFileSync(absPath, "utf-8");
}

function writeTextFilesWithRollback(
  project: ResolvedProject,
  files: Record<string, string>,
  rollbackFiles: Record<string, string>,
): void {
  const writtenPaths: string[] = [];
  try {
    for (const [path, content] of Object.entries(files)) {
      const absPath = resolve(project.dir, path);
      const dir = dirname(absPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(absPath, content, "utf-8");
      writtenPaths.push(path);
    }
  } catch (error) {
    try {
      for (const path of writtenPaths.reverse()) {
        const rollback = rollbackFiles[path];
        if (typeof rollback === "string") {
          writeFileSync(resolve(project.dir, path), rollback, "utf-8");
        }
      }
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Failed to write project files and rollback did not complete",
      );
    }
    throw new ProjectHistoryError("write-failed", "Failed to write project files", {
      status: 500,
    });
  }
}

function createEntryId(): string {
  return `edit-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

function internalWriteKey(project: ResolvedProject, path: string): string {
  return `${resolve(project.dir)}:${path}`;
}

function markInternalWrites(project: ResolvedProject, paths: string[]): void {
  const now = Date.now();
  for (const path of paths) {
    recentInternalWrites.set(internalWriteKey(project, path), now);
  }
}

function isRecentInternalWrite(project: ResolvedProject, path: string): boolean {
  const key = internalWriteKey(project, path);
  const timestamp = recentInternalWrites.get(key);
  if (!timestamp) return false;
  if (Date.now() - timestamp > INTERNAL_WRITE_SUPPRESSION_MS) {
    recentInternalWrites.delete(key);
    return false;
  }
  return true;
}

function entryMatchesSnapshots(
  entry: { files: ReturnType<typeof buildEditHistoryEntry>["files"] },
  snapshots: BuildEditHistoryEntryInput["files"],
): boolean {
  const entryPaths = Object.keys(entry.files).sort();
  const snapshotPaths = Object.keys(snapshots).sort();
  if (entryPaths.length !== snapshotPaths.length) return false;
  for (let index = 0; index < entryPaths.length; index += 1) {
    const path = entryPaths[index];
    if (!path || path !== snapshotPaths[index]) return false;
    const entrySnapshot = entry.files[path];
    const snapshot = snapshots[path];
    if (!entrySnapshot || !snapshot) return false;
    if (
      entrySnapshot.beforeHash !== hashEditHistoryContent(snapshot.before) ||
      entrySnapshot.afterHash !== hashEditHistoryContent(snapshot.after)
    ) {
      return false;
    }
  }
  return true;
}

function entryInvertsSnapshots(
  entry: { files: ReturnType<typeof buildEditHistoryEntry>["files"] },
  snapshots: BuildEditHistoryEntryInput["files"],
): boolean {
  const entryPaths = Object.keys(entry.files).sort();
  const snapshotPaths = Object.keys(snapshots).sort();
  if (entryPaths.length !== snapshotPaths.length) return false;
  for (let index = 0; index < entryPaths.length; index += 1) {
    const path = entryPaths[index];
    if (!path || path !== snapshotPaths[index]) return false;
    const entrySnapshot = entry.files[path];
    const snapshot = snapshots[path];
    if (!entrySnapshot || !snapshot) return false;
    if (
      entrySnapshot.afterHash !== hashEditHistoryContent(snapshot.before) ||
      entrySnapshot.beforeHash !== hashEditHistoryContent(snapshot.after)
    ) {
      return false;
    }
  }
  return true;
}

async function withProjectQueue<T>(project: ResolvedProject, fn: () => T | Promise<T>): Promise<T> {
  const key = resolve(project.dir);
  const previous = projectQueues.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const next = new Promise<void>((resolveQueue) => {
    release = resolveQueue;
  });
  const chained = previous.then(
    () => next,
    () => next,
  );
  projectQueues.set(key, chained);

  await previous.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (projectQueues.get(key) === chained) projectQueues.delete(key);
  }
}

export async function readProjectHistorySnapshot(
  project: ResolvedProject,
): Promise<ProjectHistorySummary> {
  primeProjectSnapshotCache(project);
  const history = readPersistedHistory(project);
  return makeSummary(project.id, history.state, history.revision);
}

export async function recordProjectEdit(
  project: ResolvedProject,
  request: ProjectEditRequest,
): Promise<ProjectEditResult> {
  return withProjectQueue(project, () => {
    const persisted = readPersistedHistory(project);
    const snapshots: BuildEditHistoryEntryInput["files"] = {};
    const rollbackFiles: Record<string, string> = {};

    for (const [path, file] of Object.entries(request.files)) {
      const relativePath = normalizeProjectPath(project, path);
      const before = readExistingTextFile(project, relativePath);
      const beforeHash = hashEditHistoryContent(before);
      if (file.beforeHash && file.beforeHash !== beforeHash) {
        throw new ProjectHistoryError("content-mismatch", "File changed before edit was applied", {
          path: relativePath,
          expectedHash: file.beforeHash,
          actualHash: beforeHash,
        });
      }
      if (before !== file.after) {
        snapshots[relativePath] = { before, after: file.after };
        rollbackFiles[relativePath] = before;
      }
    }

    const changedPaths = Object.keys(snapshots);
    const entryId = createEntryId();
    if (changedPaths.length === 0) {
      return {
        ok: true,
        entryId,
        changedPaths,
        history: makeSummary(project.id, persisted.state, persisted.revision),
      };
    }

    writeTextFilesWithRollback(
      project,
      Object.fromEntries(
        Object.entries(snapshots).map(([path, snapshot]) => [path, snapshot.after]),
      ),
      rollbackFiles,
    );
    markInternalWrites(project, changedPaths);

    const entry = buildEditHistoryEntry({
      id: entryId,
      projectId: project.id,
      label: request.label,
      kind: request.kind,
      actor: request.actor,
      coalesceKey: request.coalesceKey,
      now: Date.now(),
      files: snapshots,
    });
    const state = pushEditHistoryEntry(persisted.state, entry);
    const revision = persisted.revision + 1;
    writePersistedHistory(project, { version: 1, revision, state });
    updateProjectSnapshotCache(project, changedPaths);

    return {
      ok: true,
      entryId,
      changedPaths,
      history: makeSummary(project.id, state, revision),
    };
  });
}

export async function recordAppliedProjectEdit(
  project: ResolvedProject,
  input: {
    label: string;
    kind: ProjectEditRequest["kind"];
    actor?: EditHistoryActor;
    coalesceKey?: string;
    files: BuildEditHistoryEntryInput["files"];
  },
): Promise<ProjectHistoryStoreResult> {
  return withProjectQueue(project, () => {
    const persisted = readPersistedHistory(project);
    const snapshots: BuildEditHistoryEntryInput["files"] = {};

    for (const [path, snapshot] of Object.entries(input.files)) {
      const relativePath = normalizeProjectPath(project, path);
      const current = readExistingTextFile(project, relativePath);
      const currentHash = hashEditHistoryContent(current);
      const expectedHash = hashEditHistoryContent(snapshot.after);
      if (currentHash !== expectedHash) {
        throw new ProjectHistoryError("content-mismatch", "Applied file content does not match", {
          path: relativePath,
          expectedHash,
          actualHash: currentHash,
        });
      }
      if (snapshot.before !== snapshot.after) {
        snapshots[relativePath] = snapshot;
      }
    }

    const changedPaths = Object.keys(snapshots);
    if (changedPaths.length === 0) {
      return {
        changedPaths,
        history: makeSummary(project.id, persisted.state, persisted.revision),
      };
    }

    const latestEntry = persisted.state.undo[persisted.state.undo.length - 1];
    if (latestEntry && entryMatchesSnapshots(latestEntry, snapshots)) {
      updateProjectSnapshotCache(project, changedPaths);
      return {
        entryId: latestEntry.id,
        label: latestEntry.label,
        changedPaths: [],
        history: makeSummary(project.id, persisted.state, persisted.revision),
      };
    }

    const entryId = createEntryId();
    const entry = buildEditHistoryEntry({
      id: entryId,
      projectId: project.id,
      label: input.label,
      kind: input.kind,
      actor: input.actor,
      coalesceKey: input.coalesceKey,
      now: Date.now(),
      files: snapshots,
    });
    const state = pushEditHistoryEntry(persisted.state, entry);
    const revision = persisted.revision + 1;
    writePersistedHistory(project, { version: 1, revision, state });
    updateProjectSnapshotCache(project, changedPaths);
    return {
      entryId,
      label: input.label,
      changedPaths,
      history: makeSummary(project.id, state, revision),
    };
  });
}

export async function applyProjectHistoryTransition(
  project: ResolvedProject,
  direction: "undo" | "redo",
): Promise<
  | (ProjectHistoryStoreResult & { ok: true })
  | {
      ok: false;
      reason: ProjectHistoryFailureReason;
      path?: string;
      history: ProjectHistorySummary;
    }
> {
  return withProjectQueue(project, () => {
    const persisted = readPersistedHistory(project);
    const entry =
      direction === "undo"
        ? persisted.state.undo[persisted.state.undo.length - 1]
        : persisted.state.redo[persisted.state.redo.length - 1];
    if (!entry) {
      return {
        ok: false,
        reason: "empty",
        history: makeSummary(project.id, persisted.state, persisted.revision),
      };
    }

    const currentFiles: Record<string, string> = {};
    const currentHashes: Record<string, string> = {};
    for (const path of Object.keys(entry.files)) {
      const current = readExistingTextFile(project, normalizeProjectPath(project, path));
      currentFiles[path] = current;
      currentHashes[path] = hashEditHistoryContent(current);
    }

    const result =
      direction === "undo"
        ? undoEditHistory(persisted.state, currentHashes, Date.now())
        : redoEditHistory(persisted.state, currentHashes, Date.now());
    if (!result.ok) {
      return {
        ok: false,
        reason: result.reason,
        path: result.path,
        history: makeSummary(project.id, persisted.state, persisted.revision),
      };
    }

    writeTextFilesWithRollback(project, result.filesToWrite, currentFiles);
    const revision = persisted.revision + 1;
    writePersistedHistory(project, { version: 1, revision, state: result.state });
    const changedPaths = Object.keys(result.filesToWrite);
    markInternalWrites(project, changedPaths);
    updateProjectSnapshotCache(project, changedPaths);

    return {
      ok: true,
      entryId: result.entry.id,
      label: result.entry.label,
      changedPaths,
      history: makeSummary(project.id, result.state, revision),
    };
  });
}

export async function adoptExternalProjectChanges(
  project: ResolvedProject,
  input: { paths: string[]; label?: string; actor?: EditHistoryActor },
): Promise<ProjectHistoryStoreResult> {
  return withProjectQueue(project, () => {
    const persisted = readPersistedHistory(project);
    const normalizedPaths = input.paths.map((path) => normalizeProjectPath(project, path));
    const suppressedPaths = normalizedPaths.filter((path) => isRecentInternalWrite(project, path));
    if (suppressedPaths.length > 0) updateProjectSnapshotCache(project, suppressedPaths);
    const { changes, unmanagedPaths } = readCachedProjectChanges(project, normalizedPaths);
    const snapshots: BuildEditHistoryEntryInput["files"] = {};
    for (const change of changes) {
      snapshots[change.path] = { before: change.before, after: change.after };
    }

    const changedPaths = Object.keys(snapshots);
    if (changedPaths.length === 0) {
      updateProjectSnapshotCache(project, unmanagedPaths);
      return {
        changedPaths,
        unmanagedPaths,
        history: makeSummary(project.id, persisted.state, persisted.revision),
      };
    }

    const latestEntry = persisted.state.undo[persisted.state.undo.length - 1];
    if (latestEntry && entryMatchesSnapshots(latestEntry, snapshots)) {
      updateProjectSnapshotCache(project, [...changedPaths, ...unmanagedPaths]);
      return {
        entryId: latestEntry.id,
        label: latestEntry.label,
        changedPaths: [],
        unmanagedPaths,
        history: makeSummary(project.id, persisted.state, persisted.revision),
      };
    }
    if (latestEntry && entryInvertsSnapshots(latestEntry, snapshots)) {
      updateProjectSnapshotCache(project, [...changedPaths, ...unmanagedPaths]);
      return {
        entryId: latestEntry.id,
        label: latestEntry.label,
        changedPaths: [],
        unmanagedPaths,
        history: makeSummary(project.id, persisted.state, persisted.revision),
      };
    }
    const redoEntry = persisted.state.redo[persisted.state.redo.length - 1];
    if (redoEntry && entryInvertsSnapshots(redoEntry, snapshots)) {
      updateProjectSnapshotCache(project, [...changedPaths, ...unmanagedPaths]);
      return {
        entryId: redoEntry.id,
        label: redoEntry.label,
        changedPaths: [],
        unmanagedPaths,
        history: makeSummary(project.id, persisted.state, persisted.revision),
      };
    }

    const entryId = createEntryId();
    const label = input.label ?? (input.actor?.type === "agent" ? "Agent edit" : "External edit");
    const entry = buildEditHistoryEntry({
      id: entryId,
      projectId: project.id,
      label,
      kind: input.actor?.type === "agent" ? "agent" : "manual",
      actor: input.actor,
      coalesceKey: `external:${changedPaths.sort().join(",")}`,
      now: Date.now(),
      files: snapshots,
    });
    const state = pushEditHistoryEntry(persisted.state, entry, { coalesceMs: 500 });
    const revision = persisted.revision + 1;
    writePersistedHistory(project, { version: 1, revision, state });
    updateProjectSnapshotCache(project, [...changedPaths, ...unmanagedPaths]);

    return {
      entryId,
      label,
      changedPaths,
      unmanagedPaths,
      history: makeSummary(project.id, state, revision),
    };
  });
}
