import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { hostPath } from "./paths.mjs";
import { bridgeInitExitCode, ensureWebuiDirBridges } from "./webui-share.mjs";

const storage = JSON.parse(readFileSync(new URL("../config/storage.json", import.meta.url), "utf8"));
const profileArtifacts = JSON.parse(readFileSync(new URL("../config/profile-artifacts.json", import.meta.url), "utf8"));
const mediaRoot = hostPath(storage.roots.media);
const mediaBackupRoot = hostPath(storage.roots.mediaBackup);
const command = process.argv[2] ?? "status";
const extensionKind = new Map(Object.entries(storage.mediaKinds).flatMap(([kind, extensions]) => extensions.map((extension) => [extension, kind])));
function modelLayoutDirs() {
  const layout = profileArtifacts.layout?.models ?? {};
  return [...new Set([...(layout.a1111 ?? []), ...(layout.comfy ?? [])])];
}
function pluginLayoutDirs() {
  return [...new Set(profileArtifacts.layout?.plugins ?? ["localai", "private-gpt", "stable-diffusion", "comfyui"])];
}
function scan() {
  const files = [];
  if (!existsSync(mediaRoot)) return files;
  const pending = [mediaRoot];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (current === mediaRoot && entry.name === ".forkedai") continue;
      const file = path.join(current, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) pending.push(file);
      else if (entry.isFile()) {
        const stats = statSync(file);
        files.push({ path: path.relative(mediaRoot, file).split(path.sep).join("/"), kind: extensionKind.get(path.extname(entry.name).toLowerCase()) ?? "other", bytes: stats.size, modifiedAt: stats.mtime.toISOString() });
      }
    }
  }
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}
if (command === "init") {
  for (const entry of Object.values(storage.roots)) mkdirSync(hostPath(entry), { recursive: true });
  for (const kind of Object.keys(storage.mediaKinds)) mkdirSync(path.join(mediaRoot, kind), { recursive: true });
  const modelsRoot = hostPath(storage.roots.models);
  const pluginsRoot = hostPath(storage.roots.plugins);
  for (const subdir of modelLayoutDirs()) {
    mkdirSync(path.join(modelsRoot, subdir), { recursive: true });
    mkdirSync(path.join(modelsRoot, "inbox", subdir), { recursive: true });
  }
  mkdirSync(path.join(modelsRoot, "inbox"), { recursive: true });
  mkdirSync(path.join(pluginsRoot, "inbox"), { recursive: true });
  for (const subdir of pluginLayoutDirs()) {
    mkdirSync(path.join(pluginsRoot, subdir), { recursive: true });
    mkdirSync(path.join(pluginsRoot, "inbox", subdir), { recursive: true });
  }
  for (const subdir of ["caddy/data", "localai/data", "localai/backends", "localai/configuration", "private-gpt", "stable-diffusion/data", "stable-diffusion/repositories", "comfy/input", "comfy/user"]) mkdirSync(path.join(hostPath(storage.roots.runtime), subdir), { recursive: true });
  const authSnippet = path.join(hostPath(storage.roots.runtime), "caddy", "gateway-auth.caddy");
  if (!existsSync(authSnippet)) {
    const emptyAuth = readFileSync(new URL("../docker/gateway-auth.empty.caddy", import.meta.url), "utf8");
    writeFileSync(authSnippet, emptyAuth);
  }
  for (const subdir of ["inputs", "outputs", "workflows", "artifacts"]) mkdirSync(path.join(hostPath(storage.roots.sharedObjects), subdir), { recursive: true });
  for (const subdir of profileArtifacts.layout?.tensors ?? ["checkpoints", "embeddings", "intermediate"]) mkdirSync(path.join(hostPath(storage.roots.tensors), subdir), { recursive: true });
  for (const subdir of ["bin", "scripts", "configs"]) mkdirSync(path.join(hostPath(storage.roots.tools), subdir), { recursive: true });
  const bridges = ensureWebuiDirBridges(modelsRoot, { force: false });
  for (const line of bridges.ok) console.log(`WebUI dir bridge: ${line}`);
  for (const line of bridges.skipped) console.log(`WebUI dir bridge skipped: ${line}`);
  for (const line of bridges.errors) console.warn(`WebUI dir bridge needs manual action: ${line}`);
  const exitCode = bridgeInitExitCode(bridges);
  if (exitCode) {
    console.warn(
      "Storage roots were created, but WebUI dir bridges need manual merge before media/comfy share VAE/Lora/ControlNet."
    );
    process.exitCode = exitCode;
  } else {
    console.log("Initialized configured storage roots (including models/inbox and plugins/inbox staging).");
  }
} else if (command === "status") {
  const files = scan();
  const groups = new Map();
  for (const file of files) {
    const summary = groups.get(file.kind) ?? { count: 0, bytes: 0 };
    summary.count++; summary.bytes += file.bytes; groups.set(file.kind, summary);
  }
  console.log(`Media root: ${mediaRoot}${existsSync(mediaRoot) ? "" : " (missing; run init)"}`);
  console.log(`Media backup root: ${mediaBackupRoot}${existsSync(mediaBackupRoot) ? "" : " (missing; run init)"} (host-only)`);
  for (const [kind, summary] of [...groups].sort()) console.log(`${kind.padEnd(10)} ${String(summary.count).padStart(6)} files  ${(summary.bytes / 2 ** 30).toFixed(2).padStart(8)} GiB`);
  if (!files.length) console.log("No managed media files found.");
} else if (command === "latest") {
  const kind = process.argv[3];
  for (const item of scan().filter((entry) => !kind || entry.kind === kind).slice(0, 25)) console.log(`${item.modifiedAt}  ${item.kind.padEnd(10)}  ${item.path}`);
} else if (command === "index") {
  const files = scan();
  const stateDir = path.join(mediaRoot, ".forkedai");
  mkdirSync(stateDir, { recursive: true });
  const output = path.join(stateDir, "index.json");
  writeFileSync(output, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), root: mediaRoot, files }, null, 2)}\n`);
  console.log(`Indexed ${files.length} files in ${output}`);
} else {
  console.error("Usage: npm run media -- <init|status|latest [KIND]|index>");
  process.exitCode = 2;
}
