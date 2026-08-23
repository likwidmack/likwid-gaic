import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(new URL(`../config/${name}`, import.meta.url), "utf8"));
const repos = readJson("repos.json");
const storage = readJson("storage.json");
const stack = readJson("stack.json");
const windows = process.platform === "win32";
const hostPath = (entry) => entry[windows ? "pathWindows" : "pathWsl"];
const repoPath = (name) => {
  const item = repos.repositories.find((repo) => repo.name === name);
  if (!item) throw new Error(`Unknown repository: ${name}`);
  return hostPath(item);
};
const composeEnv = {
  ...process.env,
  HUB_CONTEXT: root,
  LOCALAI_CONTEXT: repoPath("LocalAI-Prt"),
  PRIVATE_GPT_CONTEXT: repoPath("private-gpt-tm"),
  STABLE_DIFFUSION_CONTEXT: repoPath("stable-diffusion-ui"),
  COMFY_CONTEXT: repoPath("ComfyUI"),
  COMFY_FRONTEND_CONTEXT: repoPath("ComfyUI_frontend"),
  MODEL_ROOT: hostPath(storage.roots.models),
  HF_CACHE_ROOT: hostPath(storage.roots.huggingFaceCache),
  MEDIA_ROOT: hostPath(storage.roots.media),
  DOCUMENT_ROOT: hostPath(storage.roots.documents),
  RUNTIME_ROOT: hostPath(storage.roots.runtime),
  SHARED_OBJECT_ROOT: hostPath(storage.roots.sharedObjects),
  TENSOR_ROOT: hostPath(storage.roots.tensors),
  PLUGIN_ROOT: hostPath(storage.roots.plugins),
  TOOL_ROOT: hostPath(storage.roots.tools)
};
function run(program, args, { capture = false, env = composeEnv } = {}) {
  const result = spawnSync(program, args, { cwd: root, env, encoding: "utf8", stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
  if (capture) return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() || result.error?.message || "no output" };
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const base = ["compose", "--project-name", stack.projectName, "--file", "compose.yaml"];
const compose = (args) => run("docker", [...base, ...args]);
const allProfiles = stack.profiles.flatMap((profile) => ["--profile", profile]);
const command = process.argv[2] ?? "status";

if (command === "doctor") {
  const hfCheck = windows ? ["wsl.exe", ["-e", "bash", "-lc", "hf version"]] : ["hf", ["version"]];
  const checks = [
    ["Node.js", process.execPath, ["--version"]],
    ["Docker client/server", "docker", ["version", "--format", "client={{.Client.Version}} server={{.Server.Version}}"]],
    ["Docker Compose", "docker", ["compose", "version"]],
    ["NVIDIA GPU", "nvidia-smi", ["--query-gpu=name,driver_version,memory.total,compute_cap", "--format=csv,noheader"]],
    ["Hugging Face CLI", ...hfCheck]
  ];
  let failures = 0;
  for (const [label, program, args] of checks) {
    const result = run(program, args, { capture: true, env: process.env });
    console.log(`${result.ok ? "OK" : "MISSING"}  ${label}: ${result.output}`);
    if (!result.ok) failures++;
  }
  console.log("\nConfigured paths:");
  for (const [name, entry] of Object.entries(storage.roots)) {
    const value = hostPath(entry);
    console.log(`${existsSync(value) ? "OK" : "MISSING"}  ${name}: ${value}`);
  }
  console.log("\nFork contexts:");
  for (const item of repos.repositories) {
    const value = hostPath(item);
    console.log(`${existsSync(value) ? "OK" : "MISSING"}  ${item.name}: ${value}`);
  }
  if (failures) {
    console.error("\nInstall missing tools before using the affected features. Run `npm run media -- init` to create storage paths.");
    process.exitCode = 1;
  }
} else if (command === "config") compose([...allProfiles, "config"]);
else if (command === "status" || command === "ps") compose([...allProfiles, "ps", "--all"]);
else if (command === "profiles") console.log(stack.profiles.join("\n"));
else if (command === "up") {
  const requested = process.argv[3];
  if (!requested) throw new Error(`Choose a profile: ${stack.profiles.join(", ")}, or all`);
  const profiles = requested === "all" ? stack.profiles : [requested];
  for (const profile of profiles) if (!stack.profiles.includes(profile)) throw new Error(`Unknown profile: ${profile}`);
  compose([...profiles.flatMap((profile) => ["--profile", profile]), "up", "--detach", "--wait", "--wait-timeout", "300"]);
} else if (command === "build") {
  const service = process.argv[3];
  if (service) {
    const metadata = stack.services.find((item) => item.name === service);
    if (!metadata) throw new Error(`Unknown service: ${service}`);
    compose(["--profile", metadata.profile, "build", service]);
  } else compose([...allProfiles, "build"]);
} else if (command === "backend") {
  const backend = process.argv[3] ?? "localai@cuda13-llama-cpp";
  if (!/^[a-z0-9@._-]+$/i.test(backend)) throw new Error("Invalid backend identifier");
  const directory = backend.split("@").at(-1);
  const running = run("docker", [...base, "--profile", "inference", "ps", "--status", "running", "--quiet", "localai"], { capture: true });
  if (!running.ok || !running.output) throw new Error("LocalAI is not running. Run `npm run stack -- up inference` first.");
  const installed = run("docker", [...base, "--profile", "inference", "exec", "-T", "localai", "test", "-x", `/backends/${directory}/run.sh`], { capture: true });
  if (installed.ok) console.log(`Already installed: ${backend}`);
  else {
    compose(["--profile", "inference", "exec", "-T", "localai", "/local-ai", "backends", "install", backend]);
    compose(["--profile", "inference", "up", "--detach", "--force-recreate", "--wait", "--wait-timeout", "300", "localai"]);
  }
} else if (command === "pull") compose([...allProfiles, "pull", "--ignore-buildable"]);
else if (command === "logs") compose([...allProfiles, "logs", "--follow", "--tail", "200", ...process.argv.slice(3)]);
else if (command === "stop") compose([...allProfiles, "stop", ...process.argv.slice(3)]);
else if (command === "down") compose([...allProfiles, "down", "--remove-orphans"]);
else {
  console.error("Usage: npm run stack -- <doctor|config|profiles|status|up PROFILE|build [SERVICE]|backend [ID]|pull|logs [SERVICE]|stop [SERVICE]|down>");
  process.exitCode = 2;
 }
