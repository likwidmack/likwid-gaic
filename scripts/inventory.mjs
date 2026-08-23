import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import process from "node:process";

const config = JSON.parse(readFileSync(new URL("../config/repos.json", import.meta.url)));
const output = new URL("../docs/inventory.generated.md", import.meta.url);
const extensions = new Set([".gguf", ".ggml", ".safetensors", ".ckpt", ".onnx", ".pt", ".pth"]);
const localPath = (item) => process.platform === "win32" ? item.pathWindows : item.pathWsl;
function command(program, args) {
  try { return execFileSync(program, args, { encoding: "utf8", timeout: 20000 }).trim(); }
  catch (error) { return `Unavailable: ${error.stderr?.toString().trim() || error.message}`; }
}
function walk(root, files = []) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else if (extensions.has(extname(entry.name).toLowerCase())) files.push({ path, bytes: statSync(path).size });
  }
  return files;
}
const lines = ["# Generated local inventory", "", `Generated: ${new Date().toISOString()}`, "", "> Local-only metadata. This file is intentionally Git-ignored; review it before sharing.", "", "## Repositories", ""];
for (const repo of config.repositories) {
  const path = localPath(repo);
  const branch = existsSync(path) ? command("git", ["-C", path, "branch", "--show-current"]) : "missing";
  lines.push(`- [${repo.name}](${repo.github}) — \`${path}\` — branch \`${branch}\``);
}
lines.push("", "## Model files", "");
for (const root of config.modelRoots) {
  const path = localPath(root);
  lines.push(`### ${root.name}`, "");
  if (!existsSync(path)) { lines.push(`Missing: \`${path}\``, ""); continue; }
  lines.push("| Size (GiB) | File |", "| ---: | --- |");
  for (const model of walk(path).sort((a, b) => b.bytes - a.bytes)) {
    lines.push(`| ${(model.bytes / 2 ** 30).toFixed(2)} | \`${model.path}\` |`);
  }
  lines.push("");
}
lines.push(
  "## NVIDIA GPU", "", "~~~text",
  command("nvidia-smi", ["--query-gpu=name,driver_version,memory.total,memory.free,compute_cap", "--format=csv,noheader"]),
  "~~~", "", "## Docker containers", "", "~~~text",
  command("docker", ["ps", "-a", "--format", "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"]),
  "~~~", "", "## Docker images", "", "~~~text",
  command("docker", ["images", "--format", "table {{.Repository}}:{{.Tag}}\\t{{.Size}}\\t{{.CreatedSince}}"]),
  "~~~", ""
);
writeFileSync(output, `${lines.join("\n")}\n`);
console.log(`Wrote ${output.pathname}`);
