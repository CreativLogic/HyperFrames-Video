#!/usr/bin/env node
/**
 * Build script for @hyperframes/producer (public OSS package)
 *
 * Bundles src/server.ts → dist/public-server.js (standalone server).
 */

import { build } from "esbuild";
import { mkdirSync, rmSync, readFileSync, copyFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

const scriptDir = dirname(fileURLToPath(import.meta.url));

// On Windows, esbuild cannot follow npm package junctions when bundling.
// Mark all non-workspace dependencies as external — they install via package.json.
const pkg = JSON.parse(readFileSync(resolve(scriptDir, "package.json"), "utf8"));
const externalDeps = Object.keys(pkg.dependencies ?? {}).filter(
  (d) => !d.startsWith("@hyperframes/"),
);

const workspaceAliasPlugin = {
  name: "workspace-alias",
  setup(build) {
    build.onResolve({ filter: /^@hyperframes\/engine$/ }, () => ({
      path: resolve(scriptDir, "../engine/src/index.ts"),
    }));
    build.onResolve({ filter: /^@hyperframes\/core$/ }, () => ({
      path: resolve(scriptDir, "../core/src/index.ts"),
    }));
    build.onResolve({ filter: /^@hyperframes\/core\/lint$/ }, () => ({
      path: resolve(scriptDir, "../core/src/lint/index.ts"),
    }));
  },
};

await Promise.all([
  build({
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    external: externalDeps,
    plugins: [workspaceAliasPlugin],
    minify: false,
    sourcemap: true,
    entryPoints: ["src/index.ts"],
    outfile: "dist/index.js",
  }),
  build({
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    external: externalDeps,
    plugins: [workspaceAliasPlugin],
    minify: false,
    sourcemap: true,
    entryPoints: ["src/server.ts"],
    outfile: "dist/public-server.js",
  }),
]);

// Copy core runtime artifacts so the producer can find them at dist/
const coreDistDir = resolve(scriptDir, "../core/dist");
try {
  const manifestSrc = resolve(coreDistDir, "hyperframe.manifest.json");
  if (existsSync(manifestSrc)) {
    copyFileSync(manifestSrc, "dist/hyperframe.manifest.json");
    const manifest = JSON.parse(readFileSync(manifestSrc, "utf8"));
    const runtimeIife = manifest?.artifacts?.iife || "hyperframe.runtime.iife.js";
    copyFileSync(resolve(coreDistDir, runtimeIife), `dist/${runtimeIife}`);
    console.log(`[Build] Copied runtime: hyperframe.manifest.json, ${runtimeIife}`);
  }
} catch (e) {
  console.warn("[Build] Warning: Could not copy runtime artifacts:", e.message);
}

// Generate .d.ts declarations via the TypeScript compiler API (imported directly
// so Bun's junction-aware module resolver is used instead of spawning a Node.js
// child process, which fails on Windows with EPERM when stat-ing junctions).
import ts from "typescript";

const configPath = ts.findConfigFile(scriptDir, ts.sys.fileExists, "tsconfig.json");
if (!configPath) throw new Error("tsconfig.json not found");

const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
if (error) throw new Error(ts.formatDiagnostic(error, ts.createCompilerHost({})));

const { options, fileNames, errors } = ts.parseJsonConfigFileContent(
  config,
  ts.sys,
  dirname(configPath),
);
if (errors.length) {
  throw new Error(ts.formatDiagnostics(errors, ts.createCompilerHost(options)));
}

const program = ts.createProgram(fileNames, {
  ...options,
  declaration: true,
  declarationMap: true,
  emitDeclarationOnly: true,
  noEmit: false,
  // Allow emission even when type errors exist (e.g. on Windows where some
  // devDep junctions are not resolvable by ts.sys). The typecheck CI job
  // enforces correctness; here we only need the .d.ts output.
  noEmitOnError: false,
});

const { diagnostics, emitSkipped } = program.emit();
if (diagnostics.length) {
  const host = ts.createCompilerHost(options);
  console.warn(ts.formatDiagnostics(diagnostics, host));
}
if (emitSkipped) process.exit(1);

console.log("[Build] Complete: dist/index.js, dist/public-server.js, *.d.ts");
