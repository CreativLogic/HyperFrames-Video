import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type { ResolvedProject } from "../types.js";
import { isSafePath } from "../helpers/safePath.js";
import { hashEditHistoryContent } from "./editHistory.js";

export interface ProjectSnapshotCacheEntry {
  content: string;
  hash: string;
  mtimeMs: number;
  size: number;
}

export interface CachedProjectChange {
  path: string;
  before: string;
  after: string;
  beforeHash: string;
  afterHash: string;
}

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".mdx",
  ".svg",
]);
const IGNORED_DIRS = new Set([".git", ".hyperframes", ".thumbnails", "node_modules", "renders"]);
const MAX_CACHED_BYTES = 2 * 1024 * 1024;

const projectCaches = new Map<string, Map<string, ProjectSnapshotCacheEntry>>();

function normalizeProjectPath(path: string): string {
  return path.split(sep).join("/");
}

function getExtension(path: string): string {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index).toLowerCase();
}

function shouldCachePath(path: string): boolean {
  if (!path || path.includes("\0")) return false;
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.some((part) => part === ".." || IGNORED_DIRS.has(part))) return false;
  return TEXT_EXTENSIONS.has(getExtension(path));
}

function getProjectCache(project: ResolvedProject): Map<string, ProjectSnapshotCacheEntry> {
  const key = resolve(project.dir);
  const existing = projectCaches.get(key);
  if (existing) return existing;
  const cache = new Map<string, ProjectSnapshotCacheEntry>();
  projectCaches.set(key, cache);
  return cache;
}

function readCacheEntry(project: ResolvedProject, path: string): ProjectSnapshotCacheEntry | null {
  if (!shouldCachePath(path)) return null;
  const absPath = resolve(project.dir, path);
  if (!isSafePath(project.dir, absPath) || !existsSync(absPath)) return null;
  const stat = statSync(absPath);
  if (!stat.isFile() || stat.size > MAX_CACHED_BYTES) return null;
  const content = readFileSync(absPath, "utf-8");
  return {
    content,
    hash: hashEditHistoryContent(content),
    mtimeMs: stat.mtimeMs,
    size: stat.size,
  };
}

function walkCacheableFiles(projectDir: string, dir: string, paths: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walkCacheableFiles(projectDir, join(dir, entry.name), paths);
      continue;
    }
    if (!entry.isFile()) continue;
    const relPath = normalizeProjectPath(relative(projectDir, join(dir, entry.name)));
    if (shouldCachePath(relPath)) paths.push(relPath);
  }
}

export function primeProjectSnapshotCache(project: ResolvedProject): void {
  const cache = getProjectCache(project);
  const paths: string[] = [];
  walkCacheableFiles(resolve(project.dir), resolve(project.dir), paths);
  for (const path of paths) {
    const entry = readCacheEntry(project, path);
    if (entry) cache.set(path, entry);
  }
}

export function getCachedProjectSnapshot(
  project: ResolvedProject,
  path: string,
): ProjectSnapshotCacheEntry | null {
  return getProjectCache(project).get(normalizeProjectPath(path)) ?? null;
}

export function updateProjectSnapshotCache(project: ResolvedProject, paths: string[]): void {
  const cache = getProjectCache(project);
  for (const path of paths) {
    const normalizedPath = normalizeProjectPath(path);
    const entry = readCacheEntry(project, normalizedPath);
    if (entry) {
      cache.set(normalizedPath, entry);
    } else {
      cache.delete(normalizedPath);
    }
  }
}

export function readCachedProjectChanges(
  project: ResolvedProject,
  paths: string[],
): { changes: CachedProjectChange[]; unmanagedPaths: string[] } {
  const cache = getProjectCache(project);
  const changes: CachedProjectChange[] = [];
  const unmanagedPaths: string[] = [];

  for (const path of paths) {
    const normalizedPath = normalizeProjectPath(path);
    if (!shouldCachePath(normalizedPath)) continue;
    const cached = cache.get(normalizedPath);
    const current = readCacheEntry(project, normalizedPath);
    if (!current) {
      if (cached) unmanagedPaths.push(normalizedPath);
      cache.delete(normalizedPath);
      continue;
    }
    if (!cached) {
      unmanagedPaths.push(normalizedPath);
      cache.set(normalizedPath, current);
      continue;
    }
    if (cached.hash !== current.hash) {
      changes.push({
        path: normalizedPath,
        before: cached.content,
        after: current.content,
        beforeHash: cached.hash,
        afterHash: current.hash,
      });
    }
  }

  return { changes, unmanagedPaths };
}
