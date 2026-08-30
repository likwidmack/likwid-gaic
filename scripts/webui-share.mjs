/** Ensure Comfy ↔ WebUI directory bridges under MODEL_ROOT (no Hub side effects, never deletes content). */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  rmdirSync,
  statSync,
  symlinkSync,
  unlinkSync
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { WEBUI_DIR_BRIDGES } from "./model-policy.mjs";

function pathsEquivalent(a, b) {
  if (process.platform === "win32") {
    return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
  }
  try {
    const left = statSync(a);
    const right = statSync(b);
    return left.dev === right.dev && left.ino === right.ino;
  } catch {
    return false;
  }
}

function readLinkTarget(fullPath) {
  try {
    return readlinkSync(fullPath);
  } catch {
    return null;
  }
}

function isLink(fullPath) {
  try {
    if (lstatSync(fullPath).isSymbolicLink()) return true;
  } catch {
    return false;
  }
  // Windows junctions can report as plain directories; readlink still resolves them.
  return process.platform === "win32" && Boolean(readLinkTarget(fullPath));
}

/** Remove a symlink or Windows junction without touching whatever it points at. */
function removeLink(fullPath) {
  try {
    unlinkSync(fullPath);
  } catch {
    rmdirSync(fullPath);
  }
}

/**
 * Create or verify WebUI alias directories that point at Comfy canonical dirs.
 *
 * Non-destructive by contract: a real directory holding content is reported as an
 * error for manual merge, never removed. `force` only repoints an existing link.
 * @returns {{ ok: string[], skipped: string[], errors: string[] }}
 */
export function ensureWebuiDirBridges(modelRoot, { dryRun = false, force = false } = {}) {
  const ok = [];
  const skipped = [];
  const errors = [];

  for (const { canonical, webui } of WEBUI_DIR_BRIDGES) {
    const canonicalPath = path.join(modelRoot, canonical);
    const webuiPath = path.join(modelRoot, webui);
    const label = `${webui} → ${canonical}`;

    mkdirSync(canonicalPath, { recursive: true });

    // Case-insensitive hosts may treat Lora/ and loras/ as one directory entry.
    // Do not follow symlinks here — a correct bridge must take the "already linked"
    // path below (Linux CI), not this skip.
    if (existsSync(webuiPath) && !isLink(webuiPath) && pathsEquivalent(canonicalPath, webuiPath)) {
      skipped.push(`${label} (same path on this filesystem)`);
      continue;
    }

    if (existsSync(webuiPath)) {
      if (isLink(webuiPath)) {
        const target = readLinkTarget(webuiPath);
        const resolved = target ? path.resolve(path.dirname(webuiPath), target) : null;
        if (resolved && pathsEquivalent(resolved, canonicalPath)) {
          ok.push(`${label} (already linked)`);
          continue;
        }
        if (!force) {
          errors.push(`${label}: existing link points elsewhere (${target}); pass force to repoint it`);
          continue;
        }
        if (!dryRun) removeLink(webuiPath);
      } else {
        let stats;
        try {
          stats = lstatSync(webuiPath);
        } catch (error) {
          errors.push(`${label}: cannot inspect ${webuiPath} (${error.message})`);
          continue;
        }
        if (!stats.isDirectory()) {
          errors.push(`${label}: ${webui} exists and is not a directory; move it aside manually`);
          continue;
        }
        let entries;
        try {
          entries = readdirSync(webuiPath);
        } catch (error) {
          errors.push(`${label}: cannot read ${webuiPath} (${error.message})`);
          continue;
        }
        if (entries.length) {
          errors.push(
            `${label}: ${webui}/ is a real directory with ${entries.length} entr${entries.length === 1 ? "y" : "ies"}; ` +
              `merge them into ${canonical}/ manually, remove the empty ${webui}/, then re-run`
          );
          continue;
        }
        if (!dryRun) rmdirSync(webuiPath);
      }
    }

    if (dryRun) {
      ok.push(`${label} (dry-run)`);
      continue;
    }

    try {
      if (process.platform === "win32") {
        symlinkSync(canonicalPath, webuiPath, "junction");
      } else {
        symlinkSync(canonical, webuiPath, "dir");
      }
      ok.push(label);
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }

  return { ok, skipped, errors };
}
