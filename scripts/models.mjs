import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const modelsUrl = new URL("../config/models.json", import.meta.url);
const storage = JSON.parse(readFileSync(new URL("../config/storage.json", import.meta.url), "utf8"));
const stack = JSON.parse(readFileSync(new URL("../config/stack.json", import.meta.url), "utf8"));
const profileArtifacts = JSON.parse(readFileSync(new URL("../config/profile-artifacts.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(modelsUrl, "utf8"));
const windows = process.platform === "win32";
const hostPath = (entry) => entry[windows ? "pathWindows" : "pathWsl"];
const modelRoot = hostPath(storage.roots.models);
const command = process.argv[2] ?? "list";
const extensions = new Set([".bin", ".ckpt", ".ggml", ".gguf", ".onnx", ".pt", ".pth", ".safetensors"]);
function find(alias) {
  const item = manifest.models.find((model) => model.alias === alias);
  if (!item) throw new Error(`Unknown model alias: ${alias}`);
  return item;
}
function destination(item, style = windows ? "windows" : "wsl") {
  const flavor = style === "windows" ? path.win32 : path.posix;
  const root = storage.roots.models[style === "windows" ? "pathWindows" : "pathWsl"];
  return flavor.join(root, item.localDir);
}
function expectedFiles(item) {
  return (item.include ?? []).filter((pattern) => !/[?*\[]/.test(pattern));
}
function isPresent(item) {
  const expected = expectedFiles(item);
  return expected.length ? expected.every((file) => existsSync(path.join(destination(item), file))) : existsSync(destination(item));
}
function artifactState(entry) {
  if (entry.modelAlias) return isPresent(find(entry.modelAlias)) ? "present" : "missing";
  if (entry.storageRoot) {
    const root = hostPath(storage.roots[entry.storageRoot]);
    const target = entry.relativePath ? path.join(root, entry.relativePath) : root;
    return existsSync(target) ? "present" : "missing";
  }
  if (entry.relativePath) {
    const target = path.join(modelRoot, entry.relativePath);
    if (target.endsWith(path.sep) || !path.extname(entry.relativePath)) return existsSync(target) ? "present" : "missing";
    return existsSync(target) ? "present" : "missing";
  }
  return "manual";
}
function printRecommendations(profile) {
  const spec = profileArtifacts.profiles?.[profile];
  if (!spec) throw new Error(`Unknown profile: ${profile}. Choose: ${stack.profiles.join(", ")}`);
  console.log(`Profile: ${profile}`);
  if (spec.services?.length) console.log(`Services: ${spec.services.join(", ")}`);
  if (spec.gateway) console.log(`Gateway: ${spec.gateway}`);
  for (const tier of ["required", "stronglyRecommended"]) {
    const items = spec[tier] ?? [];
    if (!items.length) continue;
    console.log(`\n${tier === "required" ? "Required" : "Strongly recommended"}:`);
    for (const entry of items) {
      const state = artifactState(entry);
      const alias = entry.modelAlias ? ` (${entry.modelAlias})` : "";
      console.log(`  [${state}] ${entry.id}${alias}: ${entry.purpose}`);
    }
  }
  if (profileArtifacts.notes?.length) {
    console.log("\nNotes:");
    for (const note of profileArtifacts.notes) console.log(`  - ${note}`);
  }
}
function hfRunner() {
  if (!windows) return { program: "hf", prefix: [], style: "wsl", env: { ...process.env, HF_HOME: storage.roots.huggingFaceCache.pathWsl } };
  return {
    program: "wsl.exe",
    prefix: ["-e", "bash", "-lc", 'export HF_HOME="$1"; shift; exec hf "$@"', "bash", storage.roots.huggingFaceCache.pathWsl],
    style: "wsl",
    env: process.env
  };
}
function runHf(args) {
  const runner = hfRunner();
  const result = spawnSync(runner.program, [...runner.prefix, ...args], { stdio: "inherit", env: runner.env });
  if (result.error || result.status == 127) throw new Error("Hugging Face CLI is unavailable. Install the current `hf` CLI; see docs/models.md.");
  process.exitCode = result.status ?? 1;
}
function downloadArgs(item, dryRun = false) {
  const runner = hfRunner();
  const args = ["download", item.repo, "--revision", item.revision, "--local-dir", destination(item, runner.style)];
  for (const pattern of item.include ?? []) args.push("--include", pattern);
  if (dryRun) args.push("--dry-run");
  return args;
}
function walk(root) {
  const files = [];
  if (!existsSync(root)) return files;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) pending.push(file);
      else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push({ file, bytes: statSync(file).size });
    }
  }
  return files;
}
if (command === "list") {
  if (!manifest.models.length) console.log("No Hub models are registered. Use `npm run models -- add ALIAS REPO [REVISION] [LOCAL_DIR]`.");
  for (const item of manifest.models) console.log(`${item.alias}\n  repo: ${item.repo}@${item.revision}\n  path: ${destination(item)}\n  state: ${isPresent(item) ? "present" : "missing"}`);
} else if (command === "add") {
  const [alias, repo, revision = "main", localDir = alias] = process.argv.slice(3);
  if (!alias || !repo) throw new Error("Usage: npm run models -- add ALIAS REPO [REVISION] [LOCAL_DIR]");
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(alias)) throw new Error("Invalid alias");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("Repository must use owner/name");
  if (path.isAbsolute(localDir) || localDir.split(/[\\/]/).includes("..")) throw new Error("LOCAL_DIR must stay inside the model root");
  if (manifest.models.some((model) => model.alias === alias)) throw new Error(`Alias already exists: ${alias}`);
  manifest.models.push({ alias, repo, revision, localDir, include: [] });
  writeFileSync(modelsUrl, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Registered ${alias}. Review config/models.json, then run \`npm run models -- plan ${alias}\`.`);
} else if (command === "plan") runHf(downloadArgs(find(process.argv[3]), true));
else if (command === "download") runHf(downloadArgs(find(process.argv[3])));
else if (command === "verify") {
  const item = find(process.argv[3]);
  const missing = expectedFiles(item).filter((file) => !existsSync(path.join(destination(item), file)));
  if (missing.length) throw new Error(`Missing selected files for ${item.alias}: ${missing.join(", ")}`);
  const runner = hfRunner();
  runHf(["cache", "verify", item.repo, "--revision", item.revision, "--local-dir", destination(item, runner.style)]);
} else if (command === "search") {
  const query = process.argv.slice(3).join(" ");
  if (!query) throw new Error("Usage: npm run models -- search QUERY");
  runHf(["models", "list", "--search", query, "--limit", "10"]);
} else if (command === "auth") runHf(["auth", "whoami"]);
else if (command === "sync-localai") {
  const items = manifest.models.filter((item) => item.localAI);
  if (!items.length) console.log("No LocalAI model configurations are registered.");
  for (const item of items) {
    const spec = item.localAI;
    const directory = destination(item);
    mkdirSync(directory, { recursive: true });
    const target = path.join(directory, spec.configFile);
    const temporary = `${target}.tmp`;
    const lines = [
      `name: ${JSON.stringify(spec.name)}`,
      "backend: llama-cpp",
      "parameters:",
      `  model: ${JSON.stringify(spec.model)}`,
      `context_size: ${spec.contextSize ?? 4096}`,
      `gpu_layers: ${spec.gpuLayers ?? 999}`,
      "f16: true"
    ];
    const threads = spec.threads ?? process.env.FORKEDAI_CPU_THREADS ?? process.env.LOCALAI_THREADS;
    if (threads) lines.splice(6, 0, `threads: ${threads}`);
    if (spec.type === "embedding") lines.push("embeddings: true");
    else lines.push("options:", "  - use_jinja:true");
    writeFileSync(temporary, `${lines.join("\n")}\n`);
    renameSync(temporary, target);
    console.log(`Wrote ${target}`);
  }
}
else if (command === "cache") {
  const runner = hfRunner();
  const cache = storage.roots.huggingFaceCache[runner.style === "windows" ? "pathWindows" : "pathWsl"];
  runHf(["cache", "list", "--cache-dir", cache]);
}
else if (command === "recommendations") {
  const profile = process.argv[3];
  if (!profile) throw new Error(`Usage: npm run models -- recommendations PROFILE (${stack.profiles.join("|")})`);
  if (!stack.profiles.includes(profile)) throw new Error(`Unknown profile: ${profile}`);
  printRecommendations(profile);
} else if (command === "inventory") {
  const files = walk(modelRoot).sort((a, b) => b.bytes - a.bytes);
  const total = files.reduce((sum, item) => sum + item.bytes, 0);
  console.log(`${files.length} model files, ${(total / 2 ** 30).toFixed(2)} GiB under ${modelRoot}`);
  for (const item of files.slice(0, 25)) console.log(`${(item.bytes / 2 ** 30).toFixed(2).padStart(7)} GiB  ${item.file}`);
  if (files.length > 25) console.log(`... ${files.length - 25} more`);
} else {
  console.error("Usage: npm run models -- <list|add|search|plan|download|verify|sync-localai|recommendations|auth|cache|inventory>");
  process.exitCode = 2;
}
