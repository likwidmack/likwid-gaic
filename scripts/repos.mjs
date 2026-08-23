import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";
import { hostPath } from "./paths.mjs";

const config = JSON.parse(readFileSync(new URL("../config/repos.json", import.meta.url)));
const action = process.argv[2] ?? "status";
if (!["status", "fetch", "update"].includes(action)) {
  console.error("Usage: node scripts/repos.mjs <status|fetch|update>");
  process.exit(2);
}
const pathFor = (repo) => hostPath(repo);
function git(path, args, inherit = false) {
  return execFileSync("git", ["-C", path, ...args], {
    encoding: "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"]
  })?.trim() ?? "";
}
function upstreamBranch(path) {
  try {
    return git(path, ["symbolic-ref", "--short", "refs/remotes/upstream/HEAD"]).replace(/^upstream\//, "");
  } catch {
    for (const name of ["main", "master"]) {
      try { git(path, ["show-ref", "--verify", `refs/remotes/upstream/${name}`]); return name; } catch {}
    }
  }
  throw new Error("cannot determine the upstream default branch");
}
let failures = 0;
for (const repo of config.repositories) {
  const path = pathFor(repo);
  console.log(`\n${repo.name}\n  GitHub: ${repo.github}`);
  if (!existsSync(path)) { console.error(`  Missing: ${path}`); failures++; continue; }
  try {
    if (action !== "status") {
      console.log("  Fetching origin and upstream...");
      git(path, ["fetch", "--prune", "origin"], true);
      git(path, ["fetch", "--prune", "upstream"], true);
    }
    const branch = git(path, ["branch", "--show-current"]) || "(detached)";
    const dirty = git(path, ["status", "--porcelain"]) !== "";
    const upstream = upstreamBranch(path);
    console.log(`  Branch: ${branch}`);
    console.log(`  Worktree: ${dirty ? "DIRTY — update blocked" : "clean"}`);
    if (action === "update") {
      if (dirty) throw new Error("refusing to merge into a dirty worktree");
      if (branch === "(detached)") throw new Error("refusing to update detached HEAD");
      console.log(`  Fast-forwarding from upstream/${upstream}...`);
      git(path, ["merge", "--ff-only", `upstream/${upstream}`], true);
    } else {
      const [ahead, behind] = git(path, ["rev-list", "--left-right", "--count", `HEAD...upstream/${upstream}`]).split(/\s+/);
      console.log(`  vs upstream/${upstream}: ${ahead} ahead, ${behind} behind`);
    }
  } catch (error) {
    console.error(`  ERROR: ${error.message}`);
    failures++;
  }
}
process.exitCode = failures ? 1 : 0;
