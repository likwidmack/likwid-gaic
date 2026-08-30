import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  parseModelAddArgv,
  resolveModelPromote,
  resolvePluginPromote,
  summarizeReady,
  webuiHardLinkFromPromote,
  webuiHardLinkPlans
} from "./model-policy.mjs";
import { hostPath, pathFlavor, pathModule } from "./paths.mjs";
import { ensureWebuiDirBridges } from "./webui-share.mjs";

const modelsUrl = new URL("../config/models.json", import.meta.url);
const storage = JSON.parse(readFileSync(new URL("../config/storage.json", import.meta.url), "utf8"));
const stack = JSON.parse(readFileSync(new URL("../config/stack.json", import.meta.url), "utf8"));
const profileArtifacts = JSON.parse(readFileSync(new URL("../config/profile-artifacts.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(modelsUrl, "utf8"));
const flavor = pathFlavor();
const windows = flavor === "windows";
const modelRoot = hostPath(storage.roots.models);
const pluginRoot = hostPath(storage.roots.plugins);
const inboxRoot = path.join(modelRoot, "inbox");
const pluginInboxRoot = path.join(pluginRoot, "inbox");
const runtimeRoot = hostPath(storage.roots.runtime);
const command = process.argv[2] ?? "list";
const extensions = new Set([".bin", ".ckpt", ".ggml", ".gguf", ".onnx", ".pt", ".pth", ".safetensors"]);
function modelLayoutDirs() {
  const layout = profileArtifacts.layout?.models ?? {};
  return [...new Set([...(layout.a1111 ?? []), ...(layout.comfy ?? [])])];
}
function pluginServices() {
  return [...new Set(profileArtifacts.layout?.plugins ?? ["localai", "private-gpt", "stable-diffusion", "comfyui"])];
}
function artifactEntries() {
  const entries = [];
  for (const [profile, spec] of Object.entries(profileArtifacts.profiles ?? {})) {
    for (const tier of ["required", "stronglyRecommended"]) {
      for (const entry of spec[tier] ?? []) entries.push({ ...entry, profile, tier });
    }
  }
  return entries;
}
function find(alias) {
  if (!alias) throw new Error("Model alias is required");
  const item = manifest.models.find((model) => model.alias === alias);
  if (item) return item;
  const artifacts = artifactEntries().filter((entry) => entry.id === alias || entry.modelAlias === alias);
  const manualArtifacts = artifacts.filter((entry) => !entry.modelAlias);
  if (manualArtifacts.length) {
    const guidance = manualArtifacts
      .map((artifact) => {
        const pathHint = artifact.relativePath ? ` at ${artifact.relativePath}` : "";
        return `  - ${artifact.profile}: ${artifact.kind}${pathHint} — ${artifact.purpose}\n    Run \`npm run models -- recommendations ${artifact.profile}\`.`;
      })
      .join("\n");
    throw new Error(
      `${alias} is a profile artifact, not a Hub model. Follow the setup guidance for each matching profile:\n${guidance}`
    );
  }
  throw new Error(`Unknown model alias: ${alias}. Use \`npm run models -- list\` for Hub pins.`);
}
function destination(item, style = flavor) {
  const module = pathModule(style);
  const root = hostPath(storage.roots.models, style);
  return module.join(root, item.localDir);
}
function expectedFiles(item) {
  return (item.include ?? []).filter((pattern) => !/[?*\[]/.test(pattern));
}
function isPresent(item) {
  const expected = expectedFiles(item);
  return expected.length ? expected.every((file) => existsSync(path.join(destination(item), file))) : existsSync(destination(item));
}
function localAiBackendState() {
  const backendsRoot = path.join(runtimeRoot, "localai", "backends");
  if (!existsSync(backendsRoot)) return "missing";
  try {
    const entries = readdirSync(backendsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    if (!entries.length) return "missing";
    const hasRunner = entries.some((entry) => existsSync(path.join(backendsRoot, entry.name, "run.sh")));
    return hasRunner ? "present" : "missing";
  } catch {
    return "missing";
  }
}
function artifactState(entry) {
  if (entry.id === "localai-backend") return localAiBackendState();
  if (entry.modelAlias) return isPresent(find(entry.modelAlias)) ? "present" : "missing";
  if (entry.storageRoot) {
    const root = hostPath(storage.roots[entry.storageRoot]);
    const target = entry.relativePath ? path.join(root, entry.relativePath) : root;
    return existsSync(target) ? "present" : "missing";
  }
  if (entry.relativePath) {
    const target = path.join(modelRoot, entry.relativePath);
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
      const downloadable = entry.modelAlias ? ` download: ${entry.modelAlias}` : " not a Hub download";
      console.log(`  [${state}] ${entry.kind} ${entry.id}:${downloadable} — ${entry.purpose}`);
    }
  }
  if (profileArtifacts.notes?.length) {
    console.log("\nNotes:");
    for (const note of profileArtifacts.notes) console.log(`  - ${note}`);
  }
}
function printReady(profile) {
  const spec = profileArtifacts.profiles?.[profile];
  if (!spec) throw new Error(`Unknown profile: ${profile}. Choose: ${stack.profiles.join(", ")}`);
  const requiredStates = (spec.required ?? []).map((entry) => ({
    id: entry.id,
    purpose: entry.purpose,
    state: artifactState(entry)
  }));
  const recommendedStates = (spec.stronglyRecommended ?? []).map((entry) => ({
    id: entry.id,
    purpose: entry.purpose,
    state: artifactState(entry)
  }));
  const summary = summarizeReady(requiredStates, recommendedStates);
  console.log(`Profile readiness: ${profile}`);
  for (const item of requiredStates) {
    console.log(`  [required/${item.state}] ${item.id}: ${item.purpose}`);
  }
  for (const item of recommendedStates) {
    console.log(`  [recommended/${item.state}] ${item.id}: ${item.purpose}`);
  }
  if (summary.manual.length) {
    console.log("\nOperator checks (manual):");
    for (const item of summary.manual) console.log(`  - ${item.id}: ${item.purpose}`);
  }
  if (summary.recommendedMissing.length) {
    console.log("\nMissing strongly recommended artifacts (non-blocking):");
    for (const item of summary.recommendedMissing) console.log(`  - ${item.id}`);
  }
  if (!summary.ok) {
    console.error("\nMissing required artifacts. Download/sync/link before `npm run stack -- up` / `switch`.");
    console.error("See docs/models.md and docs/troubleshooting.md.");
    process.exitCode = 1;
    return;
  }
  console.log("\nRequired artifacts present.");
}
function hfRunner() {
  if (windows) {
    return {
      program: "wsl.exe",
      prefix: ["-e", "bash", "-lc", 'export HF_HOME="$1"; shift; exec hf "$@"', "bash", storage.roots.huggingFaceCache.pathWsl],
      style: "wsl",
      env: process.env
    };
  }
  const style = flavor;
  return {
    program: "hf",
    prefix: [],
    style,
    env: { ...process.env, HF_HOME: hostPath(storage.roots.huggingFaceCache, style) }
  };
}
function runHf(args) {
  const runner = hfRunner();
  const result = spawnSync(runner.program, [...runner.prefix, ...args], { stdio: "inherit", env: runner.env });
  if (result.error || result.status == 127) throw new Error("Hugging Face CLI is unavailable. Install the current `hf` CLI; see docs/models.md.");
  const status = result.status ?? 1;
  process.exitCode = status;
  return status;
}
function ensureWebuiHardLinks(item, { dryRun = false, force = false } = {}) {
  const plans = webuiHardLinkPlans(item);
  if (!plans.length) return;
  for (const plan of plans) {
    const source = path.join(modelRoot, ...plan.sourceRel.split("/"));
    const target = path.join(modelRoot, ...plan.targetRel.split("/"));
    if (!existsSync(source)) {
      console.warn(`SKIP  WebUI hard link: missing source ${source}`);
      continue;
    }
    if (existsSync(target)) {
      if (!force) {
        console.log(`OK    WebUI hard link already present: ${target}`);
        continue;
      }
      if (!dryRun) rmSync(target, { force: true });
    }
    if (dryRun) {
      console.log(`DRY-RUN  hardlink ${source} -> ${target}`);
      continue;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    try {
      linkSync(source, target);
      console.log(`Linked ${source} -> ${target}`);
    } catch (error) {
      if (error && (error.code === "EXDEV" || error.code === "EPERM")) {
        copyFileSync(source, target);
        console.warn(`WARN  Hard link unavailable (${error.code}); copied instead: ${target}`);
      } else {
        throw error;
      }
    }
  }
}
function downloadArgs(item, dryRun = false) {
  const runner = hfRunner();
  const args = ["download", item.repo, "--revision", item.revision, "--local-dir", destination(item, runner.style)];
  for (const pattern of item.include ?? []) args.push("--include", pattern);
  if (dryRun) args.push("--dry-run");
  return args;
}
function localAIYamlLines(spec) {
  const threads = spec.threads ?? process.env.FORKEDAI_CPU_THREADS ?? process.env.LOCALAI_THREADS;
  switch (spec.type) {
    case "embedding": {
      const lines = [
        `name: ${JSON.stringify(spec.name)}`,
        "backend: llama-cpp",
        "parameters:",
        `  model: ${JSON.stringify(spec.model)}`,
        `context_size: ${spec.contextSize ?? 4096}`,
        `gpu_layers: ${spec.gpuLayers ?? 999}`,
        "f16: true",
        "embeddings: true"
      ];
      if (threads) lines.splice(6, 0, `threads: ${threads}`);
      return lines;
    }
    case "chat": {
      const lines = [
        `name: ${JSON.stringify(spec.name)}`,
        "backend: llama-cpp",
        "parameters:",
        `  model: ${JSON.stringify(spec.model)}`,
        `context_size: ${spec.contextSize ?? 4096}`,
        `gpu_layers: ${spec.gpuLayers ?? 999}`,
        "f16: true",
        "options:",
        "  - use_jinja:true"
      ];
      if (threads) lines.splice(6, 0, `threads: ${threads}`);
      return lines;
    }
    case "transcription":
      return [
        `name: ${JSON.stringify(spec.name)}`,
        `backend: ${spec.backend ?? "whisper"}`,
        "parameters:",
        `  model: ${JSON.stringify(spec.model)}`
      ];
    case "tts":
      return [
        `name: ${JSON.stringify(spec.name)}`,
        `backend: ${spec.backend ?? "piper"}`,
        "parameters:",
        `  model: ${JSON.stringify(spec.model)}`
      ];
    default: {
      const exhaustive = spec.type;
      throw new Error(`Unsupported LocalAI type for ${spec.name ?? "model"}: ${exhaustive}`);
    }
  }
}
function walk(root) {
  const files = [];
  if (!existsSync(root)) return files;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (current === root && entry.name === "inbox") continue;
      const file = path.join(current, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) pending.push(file);
      else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) files.push({ file, bytes: statSync(file).size });
    }
  }
  return files;
}
function walkAllFiles(root) {
  const files = [];
  if (!existsSync(root)) return files;
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) pending.push(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  return files;
}
function parseFlags(argv) {
  const flags = new Set();
  const positional = [];
  for (const token of argv) {
    if (token === "--dry-run" || token === "--force" || token === "--allow-pickle") flags.add(token.slice(2));
    else positional.push(token);
  }
  return { flags, positional };
}
function promotePath(source, target, { dryRun = false, force = false } = {}) {
  if (!existsSync(source)) throw new Error(`Missing staging path: ${source}`);
  if (existsSync(target) && !force) throw new Error(`Destination exists (pass --force to replace): ${target}`);
  if (dryRun) {
    console.log(`DRY-RUN  ${source} -> ${target}`);
    return;
  }
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  try {
    renameSync(source, target);
  } catch {
    const stats = statSync(source);
    if (stats.isDirectory()) throw new Error(`Cannot promote directory across volumes; move manually: ${source}`);
    copyFileSync(source, target);
    rmSync(source, { force: true });
  }
  console.log(`Promoted ${source} -> ${target}`);
}
function listInbox(root, label) {
  if (!existsSync(root)) {
    console.log(`${label} missing. Run \`npm run media -- init\`.`);
    return;
  }
  const files = walkAllFiles(root).sort();
  console.log(`${label}: ${root}`);
  if (!files.length) {
    console.log("  (empty)");
    return;
  }
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const bytes = statSync(file).size;
    console.log(`  ${(bytes / 2 ** 20).toFixed(2).padStart(10)} MiB  ${relative}`);
  }
}
if (command === "list") {
  if (!manifest.models.length) console.log("No Hub models are registered. Use `npm run models -- add ALIAS REPO REVISION LOCAL_DIR --include FILE`.");
  for (const item of manifest.models) console.log(`${item.alias}\n  repo: ${item.repo}@${item.revision}\n  path: ${destination(item)}\n  state: ${isPresent(item) ? "present" : "missing"}`);
} else if (command === "add") {
  const entry = parseModelAddArgv(process.argv.slice(3));
  if (manifest.models.some((model) => model.alias === entry.alias)) throw new Error(`Alias already exists: ${entry.alias}`);
  manifest.models.push({
    alias: entry.alias,
    repo: entry.repo,
    revision: entry.revision,
    localDir: entry.localDir,
    include: entry.include
  });
  writeFileSync(modelsUrl, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Registered ${entry.alias}. Review config/models.json, then run \`npm run models -- plan ${entry.alias}\`.`);
} else if (command === "plan") runHf(downloadArgs(find(process.argv[3]), true));
else if (command === "download") {
  const item = find(process.argv[3]);
  const status = runHf(downloadArgs(item));
  if (status === 0) ensureWebuiHardLinks(item);
} else if (command === "verify") {
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
    const lines = localAIYamlLines(spec);
    writeFileSync(temporary, `${lines.join("\n")}\n`);
    renameSync(temporary, target);
    console.log(`Wrote ${target}`);
  }
}
else if (command === "cache") {
  const runner = hfRunner();
  const cache = hostPath(storage.roots.huggingFaceCache, runner.style);
  runHf(["cache", "list", "--cache-dir", cache]);
}
else if (command === "recommendations") {
  const profile = process.argv[3];
  if (!profile) throw new Error(`Usage: npm run models -- recommendations PROFILE (${stack.profiles.join("|")})`);
  if (!stack.profiles.includes(profile)) throw new Error(`Unknown profile: ${profile}`);
  printRecommendations(profile);
} else if (command === "ready") {
  const profile = process.argv[3];
  if (!profile) throw new Error(`Usage: npm run models -- ready PROFILE (${stack.profiles.join("|")})`);
  if (!stack.profiles.includes(profile)) throw new Error(`Unknown profile: ${profile}`);
  printReady(profile);
} else if (command === "inbox") {
  listInbox(inboxRoot, "Model inbox");
  console.log("");
  listInbox(pluginInboxRoot, "Plugin inbox");
} else if (command === "promote") {
  const { flags, positional } = parseFlags(process.argv.slice(3));
  const relative = positional[0];
  if (!relative) {
    throw new Error(
      "Usage: npm run models -- promote REL_PATH_UNDER_INBOX [--dry-run] [--force] [--allow-pickle]\nExample: npm run models -- promote checkpoints/model.safetensors"
    );
  }
  const resolved = resolveModelPromote(relative, modelLayoutDirs(), { allowPickle: flags.has("allow-pickle") });
  const source = path.join(inboxRoot, ...resolved.relative.split("/"));
  const target = path.join(modelRoot, ...resolved.relative.split("/"));
  if (!resolved.preferred && !flags.has("allow-pickle")) {
    console.warn(`Note: ${resolved.extension || "(no extension)"} is not a preferred catalog format (.gguf/.safetensors/.onnx).`);
  }
  promotePath(source, target, { dryRun: flags.has("dry-run"), force: flags.has("force") });
  if (!flags.has("dry-run")) {
    const linkPlan = webuiHardLinkFromPromote(resolved.relative);
    if (linkPlan) {
      ensureWebuiHardLinks(
        { localDir: "checkpoints", include: [path.posix.basename(linkPlan.sourceRel)] },
        { force: flags.has("force") }
      );
    }
  }
} else if (command === "promote-plugin") {
  const { flags, positional } = parseFlags(process.argv.slice(3));
  const [service, relative] = positional;
  if (!service || !relative) {
    throw new Error(
      "Usage: npm run models -- promote-plugin SERVICE REL_PATH_UNDER_PLUGIN_INBOX [--dry-run] [--force]\nExample: npm run models -- promote-plugin comfyui my-node-pack"
    );
  }
  const resolved = resolvePluginPromote(service, relative, pluginServices());
  const source = path.join(pluginInboxRoot, resolved.service, ...resolved.relative.split("/"));
  const target = path.join(pluginRoot, resolved.service, ...resolved.relative.split("/"));
  promotePath(source, target, { dryRun: flags.has("dry-run"), force: flags.has("force") });
} else if (command === "link-webui") {
  const { flags, positional } = parseFlags(process.argv.slice(3));
  const alias = positional[0];
  const bridgeResult = ensureWebuiDirBridges(modelRoot, {
    dryRun: flags.has("dry-run"),
    force: flags.has("force")
  });
  for (const line of bridgeResult.ok) console.log(`OK    dir bridge ${line}`);
  for (const line of bridgeResult.skipped) console.log(`SKIP  dir bridge ${line}`);
  for (const line of bridgeResult.errors) console.error(`ERROR dir bridge ${line}`);
  if (bridgeResult.errors.length) process.exitCode = 1;
  const items = alias ? [find(alias)] : manifest.models.filter((item) => webuiHardLinkPlans(item).length);
  if (!items.length) {
    console.log("No checkpoint pins with WebUI hard-link plans.");
  }
  for (const item of items) {
    console.log(`WebUI links for ${item.alias}:`);
    ensureWebuiHardLinks(item, { dryRun: flags.has("dry-run"), force: flags.has("force") });
  }
} else if (command === "inventory") {
  const files = walk(modelRoot).sort((a, b) => b.bytes - a.bytes);
  const total = files.reduce((sum, item) => sum + item.bytes, 0);
  console.log(`${files.length} model files, ${(total / 2 ** 30).toFixed(2)} GiB under ${modelRoot}`);
  for (const item of files.slice(0, 25)) console.log(`${(item.bytes / 2 ** 30).toFixed(2).padStart(7)} GiB  ${item.file}`);
  if (files.length > 25) console.log(`... ${files.length - 25} more`);
} else {
  console.error(
    "Usage: npm run models -- <list|add|search|plan|download|verify|sync-localai|recommendations|ready|inbox|promote|promote-plugin|link-webui|auth|cache|inventory>"
  );
  process.exitCode = 2;
}
