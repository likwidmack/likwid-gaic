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
