/** Pure model-manifest and profile-readiness helpers (no Hub/CLI side effects). */

import path from "node:path";

export const REVISION_PATTERN = /^[0-9a-f]{40}$/i;
export const ALIAS_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
export const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

/**
 * Validate arguments for `models add` before writing config/models.json.
 * @returns {{ alias: string, repo: string, revision: string, localDir: string, include: string[] }}
 */
export function validateModelAddArgs({ alias, repo, revision, localDir, include }) {
  if (!alias || !repo) {
    throw new Error(
      "Usage: npm run models -- add ALIAS REPO REVISION LOCAL_DIR --include FILE [--include FILE...]"
    );
  }
  if (!ALIAS_PATTERN.test(alias)) throw new Error("Invalid alias");
  if (!REPO_PATTERN.test(repo)) throw new Error("Repository must use owner/name");
  if (!revision || !REVISION_PATTERN.test(revision)) {
    throw new Error("REVISION must be a full 40-character git commit SHA (immutable pin)");
  }
  if (!localDir) throw new Error("LOCAL_DIR is required");
  if (path.isAbsolute(localDir) || localDir.split(/[\\/]/).includes("..")) {
    throw new Error("LOCAL_DIR must stay inside the model root");
  }
  const files = Array.isArray(include) ? include.filter(Boolean) : [];
  if (!files.length) {
    throw new Error("At least one --include FILE is required (explicit Hub file selection)");
  }
  return { alias, repo, revision: revision.toLowerCase(), localDir, include: files };
}

/**
 * Parse `add` argv after the subcommand: ALIAS REPO REVISION LOCAL_DIR --include a [--include b]
 */
export function parseModelAddArgv(argv) {
  const positional = [];
  const include = [];
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === "--include") {
      const file = argv[++index];
      if (!file) throw new Error("--include requires a file path");
      include.push(file);
      continue;
    }
    if (token.startsWith("--")) throw new Error(`Unknown flag: ${token}`);
    positional.push(token);
  }
  const [alias, repo, revision, localDir = alias] = positional;
  return validateModelAddArgs({ alias, repo, revision, localDir, include });
}

export function summarizeReady(requiredStates, recommendedStates) {
  const requiredMissing = requiredStates.filter((item) => item.state === "missing");
  const recommendedMissing = recommendedStates.filter((item) => item.state === "missing");
  const manual = [...requiredStates, ...recommendedStates].filter((item) => item.state === "manual");
  return {
    ok: requiredMissing.length === 0,
    requiredMissing,
    recommendedMissing,
    manual
  };
}

/** Extensions treated as executable / pickle-adjacent; require --allow-pickle to promote. */
export const PICKLE_EXTENSIONS = new Set([".pt", ".pth", ".ckpt", ".bin", ".pkl", ".pickle"]);

/** Preferred weight formats for the shared catalog. */
export const PREFERRED_WEIGHT_EXTENSIONS = new Set([".gguf", ".safetensors", ".onnx", ".ggml"]);

export function normalizeRelativePath(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Relative path is required");
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized === "." || path.isAbsolute(value) || normalized.split("/").includes("..")) {
    throw new Error("Path must stay inside the staging inbox (no absolute paths or ..)");
  }
  return normalized;
}

/**
 * Resolve a promote from models/inbox/<rel> into models/<rel> (same relative layout).
 * @param {string} relativeFromInbox path under inbox
 * @param {string[]} allowedTopDirs catalog layout directories (checkpoints, localai, …)
 */
export function resolveModelPromote(relativeFromInbox, allowedTopDirs, { allowPickle = false } = {}) {
  const relative = normalizeRelativePath(relativeFromInbox);
  const top = relative.split("/")[0];
  if (!allowedTopDirs.includes(top)) {
    throw new Error(
      `Inbox path must start with an allowed layout directory (${allowedTopDirs.join(", ")}), got: ${top}`
    );
  }
  const extension = path.posix.extname(relative).toLowerCase();
  if (PICKLE_EXTENSIONS.has(extension) && !allowPickle) {
    throw new Error(
      `Refusing to promote ${extension} without --allow-pickle (treat as executable). Prefer .gguf or .safetensors.`
    );
  }
  return {
    relative,
    top,
    extension,
    preferred: PREFERRED_WEIGHT_EXTENSIONS.has(extension) || extension === ""
  };
}

/**
 * Resolve plugin promote: plugins/inbox/<service>/<name> -> plugins/<service>/<name>
 * @param {"comfyui"|"stable-diffusion"|"localai"|"private-gpt"} service
 */
export function resolvePluginPromote(service, relativeFromInbox, allowedServices) {
  if (!allowedServices.includes(service)) {
    throw new Error(`Unknown plugin service: ${service}. Choose: ${allowedServices.join(", ")}`);
  }
  const relative = normalizeRelativePath(relativeFromInbox);
  return { service, relative };
}

/**
 * Plan A1111 hard links from a managed checkpoint pin into Stable-diffusion/.
 * @returns {{ sourceRel: string, targetRel: string, file: string }[]}
 */
export function webuiHardLinkPlans(item) {
  if (!item || item.localDir !== "checkpoints") return [];
  const files = (item.include ?? []).filter((pattern) => typeof pattern === "string" && !/[?*\[]/.test(pattern));
  return files.map((file) => {
    const base = path.posix.basename(file.replace(/\\/g, "/"));
    return {
      file: base,
      sourceRel: path.posix.join("checkpoints", base),
      targetRel: path.posix.join("Stable-diffusion", base)
    };
  });
}

/**
 * Plan a WebUI hard link after promoting a checkpoints/ inbox file.
 * @returns {{ sourceRel: string, targetRel: string } | null}
 */
export function webuiHardLinkFromPromote(relativeCatalogPath) {
  const relative = normalizeRelativePath(relativeCatalogPath);
  const parts = relative.split("/");
  if (parts[0] !== "checkpoints" || parts.length !== 2) return null;
  const file = parts[1];
  if (!file || file.includes("..")) return null;
  return {
    sourceRel: relative,
    targetRel: path.posix.join("Stable-diffusion", file)
  };
}
