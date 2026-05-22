#!/usr/bin/env node
// w2h-verify.mjs — verification report for a website-to-hyperframes project.
//
// Outputs facts the agent cannot fudge: asset usage %, storyboard-vs-build
// consistency, artifact existence. Result becomes the Step 6 deliverable —
// paste verbatim into the final user-facing summary.
//
// This script does PURE FILE ANALYSIS — it does not spawn lint/inspect.
// Run those separately via the CLI and include their summaries alongside.
//
// Usage:
//   node skills/website-to-hyperframes/scripts/w2h-verify.mjs <project-dir>
//
// Exit codes:
//   0 = all gates pass
//   1 = one or more gates failed (final summary must disclose)
//   2 = script error (project-dir not found, etc.)

import { readFile, readdir } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { existsSync } from "node:fs";

const PROJECT_DIR = resolve(process.argv[2] || ".");

// Thresholds — adjust here, not by interpretation.
const ASSET_USAGE_MIN_PCT = 30;
const SFX_DRIFT_TOLERANCE_S = 0.5;

const ASSET_EXTS = new Set([".jpg", ".jpeg", ".png", ".svg", ".webp", ".gif", ".mp4", ".webm"]);
const ASSET_EXCLUDE_PATTERNS = [/favicon/i, /apple-touch-icon/i];

const SHADER_NAMES = [
  "cross-warp-morph",
  "cross-warp",
  "cinematic-zoom",
  "gravitational-lens",
  "glitch",
  "light-leak",
  "flash-through-white",
  "whip-pan",
  "domain-warp",
  "thermal-bloom",
  "swirl",
  "ridged-noise",
  "sdf-reveal",
  "chromatic-aberration",
  "ripple",
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(PROJECT_DIR)) {
    console.error(`✗ Project directory not found: ${PROJECT_DIR}`);
    process.exit(2);
  }

  const results = [];
  results.push(await checkAssetUsage());
  results.push(await checkShaderTransitionsConsistency());
  results.push(await checkSfxTimestampConsistency());
  results.push(await checkAnimationMapExists());
  results.push(await checkMp4Exists());
  results.push(await checkStoryboardArtifactExists());

  printReport(results);

  const anyFail = results.some((r) => r.status === "FAIL");
  process.exit(anyFail ? 1 : 0);
}

// ─── Checks ──────────────────────────────────────────────────────────────────

async function checkAssetUsage() {
  const captureDir = join(PROJECT_DIR, "capture", "assets");
  if (!existsSync(captureDir)) {
    return {
      name: "Asset usage",
      status: "INFO",
      detail: "No capture/assets/ directory — capture may not have run",
    };
  }

  const captured = await listAssetFiles(captureDir);
  const compositionsDir = join(PROJECT_DIR, "compositions");
  const referencedSet = new Set();

  const filesToScan = [join(PROJECT_DIR, "index.html")];
  if (existsSync(compositionsDir)) {
    const compFiles = (await readdir(compositionsDir)).filter((f) => f.endsWith(".html"));
    for (const f of compFiles) filesToScan.push(join(compositionsDir, f));
  }

  for (const f of filesToScan) {
    if (!existsSync(f)) continue;
    const content = await readFile(f, "utf-8");
    for (const asset of captured) {
      if (content.includes(asset.path) || content.includes(basename(asset.path))) {
        referencedSet.add(asset.path);
      }
    }
  }

  const total = captured.length;
  const used = referencedSet.size;
  const pct = total > 0 ? Math.round((used * 100) / total) : 0;
  const pass = pct >= ASSET_USAGE_MIN_PCT;

  return {
    name: "Asset usage",
    status: pass ? "PASS" : "FAIL",
    detail: `${used}/${total} (${pct}%) — target ≥${ASSET_USAGE_MIN_PCT}%`,
    extra: pass
      ? null
      : `Unused brand assets are sitting in capture/assets/. The brand isn't visually present at ${pct}%.`,
  };
}

async function checkShaderTransitionsConsistency() {
  const storyboardPath = join(PROJECT_DIR, "STORYBOARD.md");
  const indexPath = join(PROJECT_DIR, "index.html");
  if (!existsSync(storyboardPath) || !existsSync(indexPath)) {
    return {
      name: "Shader transitions",
      status: "INFO",
      detail: "STORYBOARD.md or index.html missing — cannot check",
    };
  }

  const storyboard = await readFile(storyboardPath, "utf-8");
  const index = await readFile(indexPath, "utf-8");

  // Match longest names first so "cross-warp-morph" doesn't double-count as "cross-warp" too.
  const sortedNames = [...SHADER_NAMES].sort((a, b) => b.length - a.length);
  let sbScratch = storyboard;
  const declared = [];
  for (const name of sortedNames) {
    if (sbScratch.includes(name)) {
      declared.push(name);
      sbScratch = sbScratch.split(name).join(""); // strip all matches before next probe
    }
  }
  if (declared.length === 0) {
    return {
      name: "Shader transitions",
      status: "PASS",
      detail: "STORYBOARD declared none — no shader transitions expected",
    };
  }

  const present = declared.filter((name) => index.includes(name));
  const missing = declared.filter((name) => !index.includes(name));
  const pass = missing.length === 0;

  return {
    name: "Shader transitions",
    status: pass ? "PASS" : "FAIL",
    detail: `STORYBOARD declared ${declared.length}, ${present.length} present in index.html, ${missing.length} missing`,
    extra: pass
      ? null
      : `Missing from build: ${missing.join(", ")}. STORYBOARD.md and index.html disagree.`,
  };
}

async function checkSfxTimestampConsistency() {
  const storyboardPath = join(PROJECT_DIR, "STORYBOARD.md");
  const indexPath = join(PROJECT_DIR, "index.html");
  if (!existsSync(storyboardPath) || !existsSync(indexPath)) {
    return { name: "SFX timestamps", status: "INFO", detail: "STORYBOARD.md or index.html missing" };
  }

  const storyboard = await readFile(storyboardPath, "utf-8");
  const index = await readFile(indexPath, "utf-8");

  const sfxRefs = [];
  for (const line of storyboard.split("\n")) {
    const fileMatch = line.match(/sfx\/([\w-]+\.mp3)/);
    const timeMatch = line.match(/\|\s*(\d+(?:\.\d+)?)s?\s*\|/);
    if (fileMatch && timeMatch) {
      sfxRefs.push({ file: fileMatch[1], storyboardT: parseFloat(timeMatch[1]) });
    }
  }

  if (sfxRefs.length === 0) {
    return { name: "SFX timestamps", status: "INFO", detail: "No SFX entries detected in STORYBOARD.md" };
  }

  const indexSfx = new Map();
  const audioRegex =
    /<audio[^>]*src=["'](?:[^"']*\/)?sfx\/([\w-]+\.mp3)["'][^>]*?data-start=["']([0-9.]+)["']/g;
  let m;
  while ((m = audioRegex.exec(index)) !== null) {
    indexSfx.set(m[1], parseFloat(m[2]));
  }

  const drifts = [];
  const missing = [];
  for (const ref of sfxRefs) {
    if (!indexSfx.has(ref.file)) {
      missing.push(ref.file);
      continue;
    }
    const indexT = indexSfx.get(ref.file);
    const drift = Math.abs(indexT - ref.storyboardT);
    if (drift > SFX_DRIFT_TOLERANCE_S) {
      drifts.push({ file: ref.file, storyboardT: ref.storyboardT, indexT, drift });
    }
  }

  const pass = missing.length === 0 && drifts.length === 0;
  return {
    name: "SFX timestamps",
    status: pass ? "PASS" : "FAIL",
    detail: `${sfxRefs.length} SFX in STORYBOARD · ${indexSfx.size} in index.html · ${missing.length} missing · ${drifts.length} drifted >${SFX_DRIFT_TOLERANCE_S}s`,
    extra: pass
      ? null
      : [
          ...missing.map((f) => `MISSING in index.html: ${f}`),
          ...drifts.map(
            (d) =>
              `DRIFT: ${d.file} storyboard=${d.storyboardT}s index=${d.indexT}s drift=${d.drift.toFixed(2)}s`,
          ),
        ].join("\n  "),
  };
}

async function checkAnimationMapExists() {
  const path = join(PROJECT_DIR, "animation-map.json");
  if (existsSync(path)) {
    return { name: "animation-map.json", status: "PASS", detail: "exists" };
  }
  return {
    name: "animation-map.json",
    status: "FAIL",
    detail: "missing — run `node <repo>/skills/hyperframes/scripts/animation-map.mjs <project-dir>`",
  };
}

async function checkMp4Exists() {
  const candidates = [PROJECT_DIR, join(PROJECT_DIR, "output"), join(PROJECT_DIR, "renders")];
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    try {
      const files = await readdir(dir);
      if (files.some((f) => f.endsWith(".mp4"))) {
        return {
          name: "Rendered MP4",
          status: "PASS",
          detail: `found .mp4 in ${dir.replace(PROJECT_DIR, ".")}`,
        };
      }
    } catch {
      /* ignore */
    }
  }
  return {
    name: "Rendered MP4",
    status: "INFO",
    detail:
      "no .mp4 found — preview-only delivery; if claiming verified motion, render is required (Path 2 of audio+motion verification)",
  };
}

async function checkStoryboardArtifactExists() {
  const required = ["STORYBOARD.md", "DESIGN.md", "SCRIPT.md", "index.html"];
  const missing = required.filter((f) => !existsSync(join(PROJECT_DIR, f)));
  if (missing.length === 0) {
    return { name: "Required artifacts", status: "PASS", detail: required.join(", ") };
  }
  return {
    name: "Required artifacts",
    status: "FAIL",
    detail: `missing: ${missing.join(", ")}`,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function listAssetFiles(dir) {
  const out = [];
  async function walk(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) {
        await walk(full);
        continue;
      }
      const ext = e.name.slice(e.name.lastIndexOf(".")).toLowerCase();
      if (!ASSET_EXTS.has(ext)) continue;
      if (ASSET_EXCLUDE_PATTERNS.some((re) => re.test(e.name))) continue;
      const rel = full.replace(PROJECT_DIR + "/", "");
      out.push({ path: rel, name: e.name });
    }
  }
  await walk(dir);
  return out;
}

// ─── Report ──────────────────────────────────────────────────────────────────

function printReport(results) {
  const cols = { name: 26, status: 8, detail: 60 };
  const line = "─".repeat(cols.name + cols.status + cols.detail + 6);

  console.log("");
  console.log(`w2h-verify · ${PROJECT_DIR}`);
  console.log(line);
  console.log(
    "Check".padEnd(cols.name) + " │ " + "Status".padEnd(cols.status) + " │ " + "Detail",
  );
  console.log(line);

  for (const r of results) {
    const symbol = r.status === "PASS" ? "✓" : r.status === "FAIL" ? "✗" : "·";
    console.log(
      r.name.padEnd(cols.name) +
        " │ " +
        `${symbol} ${r.status}`.padEnd(cols.status) +
        " │ " +
        (r.detail || ""),
    );
    if (r.extra) {
      console.log(
        "".padEnd(cols.name) +
          " │ " +
          "".padEnd(cols.status) +
          " │   " +
          r.extra.split("\n").join("\n" + " ".repeat(cols.name + cols.status + 6 + 4)),
      );
    }
  }

  console.log(line);
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const info = results.filter((r) => r.status === "INFO").length;
  console.log(`SUMMARY: ${pass} PASS · ${fail} FAIL · ${info} INFO`);

  if (fail > 0) {
    console.log("");
    console.log("Step 6 NOT done. Fix FAIL items, OR include this report verbatim in your final");
    console.log("summary's \"What I did NOT verify\" section so the user knows what's broken.");
  } else {
    console.log("");
    console.log("All gates pass. Paste this report into your final user-facing summary as evidence.");
  }
  console.log("");
}

main().catch((e) => {
  console.error("w2h-verify script error:", e);
  process.exit(2);
});
