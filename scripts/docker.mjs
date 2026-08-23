import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import process from "node:process";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(new URL(`../config/${name}`, import.meta.url), "utf8"));
const repos = readJson("repos.json");
const storage = readJson("storage.json");
const stack = readJson("stack.json");
const gpuExclusive = stack.gpuExclusive;
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
  TORCH_CACHE_ROOT: hostPath(storage.roots.torchCache),
  COMFY_TEMP_ROOT: hostPath(storage.roots.comfyTemp),
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
const gpuServices = gpuExclusive.services;
const gpuExclusiveEnabled = () => process.env.FORKEDAI_GPU_EXCLUSIVE !== "false";

function gpuServicesForProfile(profile) {
  const needed = new Set();
  for (const [service, profiles] of Object.entries(gpuExclusive.profilesByService)) {
    if (profiles.includes(profile)) needed.add(service);
  }
  return needed;
}

function runningServices() {
  const result = run("docker", [...base, ...allProfiles, "ps", "--status", "running", "--format", "{{.Service}}"], { capture: true });
  if (!result.ok || !result.output) return [];
  return [...new Set(result.output.split("\n").map((line) => line.trim()).filter(Boolean))];
}

function runningGpuServices() {
  return runningServices().filter((service) => gpuServices.includes(service));
}

function gpuConflictsForProfile(profile) {
  const needed = gpuServicesForProfile(profile);
  return runningGpuServices().filter((service) => !needed.has(service));
}

function physicalCoreCount() {
  if (windows) {
    const result = run("powershell.exe", ["-NoProfile", "-Command", "(Get-CimInstance Win32_Processor | Measure-Object -Property NumberOfCores -Sum).Sum"], { capture: true, env: process.env });
    const cores = Number.parseInt(result.output, 10);
    return Number.isFinite(cores) && cores > 0 ? cores : null;
  }
  const result = run("bash", ["-lc", "lscpu -p=CORE,ONLINE 2>/dev/null | awk -F, '$2==\"yes\" {print $1}' | sort -u | wc -l"], { capture: true, env: process.env });
  const cores = Number.parseInt(result.output, 10);
  return Number.isFinite(cores) && cores > 0 ? cores : null;
}

function suggestedLocalAiThreads() {
  const cores = physicalCoreCount();
  if (!cores) return null;
  return Math.max(1, cores - 4);
}

function assertGpuPreflight(profile, { allowShare = false } = {}) {
  if (!gpuExclusiveEnabled()) return;
  if (profile === "all") {
    throw new Error("Starting all profiles on a single GPU host causes VRAM contention. Start one profile at a time or use `npm run stack -- switch PROFILE`.");
  }
  const conflicts = gpuConflictsForProfile(profile);
  if (conflicts.length && !allowShare) {
    throw new Error(
      `GPU conflict for profile "${profile}": ${conflicts.join(", ")} already running. Stop them, run \`npm run stack -- switch ${profile}\`, or pass --allow-gpu-share.`
    );
  }
}

function parseProfileCommand(argv, startIndex = 3) {
  const flags = new Set();
  const positional = [];
  for (let index = startIndex; index < argv.length; index++) {
    const token = argv[index];
    if (token === "--dry-run" || token === "--force" || token === "--allow-gpu-share") flags.add(token.slice(2));
    else positional.push(token);
  }
  return { profile: positional[0], flags };
}

const command = process.argv[2] ?? "status";

if (command === "doctor") {
  const hfCheck = windows ? ["wsl.exe", ["-e", "bash", "-lc", "hf version"]] : ["hf", ["version"]];
  const checks = [
    ["Node.js", process.execPath, ["--version"]],
    ["Docker client/server", "docker", ["version", "--format", "client={{.Client.Version}} server={{.Server.Version}}"]],
    ["Docker Compose", "docker", ["compose", "version"]],
    ["NVIDIA GPU", "nvidia-smi", ["--query-gpu=name,driver_version,memory.total,memory.free,compute_cap", "--format=csv,noheader"]],
    ["Hugging Face CLI", ...hfCheck]
  ];
  let failures = 0;
  for (const [label, program, args] of checks) {
    const result = run(program, args, { capture: true, env: process.env });
    console.log(`${result.ok ? "OK" : "MISSING"}  ${label}: ${result.output}`);
    if (!result.ok) failures++;
  }
  const cores = physicalCoreCount();
  const threads = suggestedLocalAiThreads();
  if (cores) console.log(`\nHost CPU: ${cores} physical cores${threads ? `; suggested LOCALAI_THREADS=${threads}` : ""}`);
  const activeGpu = runningGpuServices();
  if (activeGpu.length > 1) {
    console.warn(`\nWARN  Multiple GPU services running (${activeGpu.join(", ")}). On a single GPU, run one profile at a time.`);
  } else if (activeGpu.length === 1) {
    console.log(`\nGPU workload: ${activeGpu[0]}`);
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
} else if (command === "resources") {
  const gpu = run("nvidia-smi", ["--query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu", "--format=csv,noheader"], { capture: true, env: process.env });
  console.log(gpu.ok ? `GPU\n${gpu.output}` : `GPU\nunavailable: ${gpu.output}`);
  const activeGpu = runningGpuServices();
  console.log(`\nRunning GPU services: ${activeGpu.length ? activeGpu.join(", ") : "none"}`);
  if (activeGpu.length > 1) console.warn("WARN  More than one GPU service is running; expect VRAM contention on a single GPU.");
  const services = run("docker", [...base, ...allProfiles, "ps", "--format", "table {{.Service}}\t{{.Status}}\t{{.Image}}"], { capture: true });
  if (services.ok && services.output) console.log(`\nCompose services\n${services.output}`);
  if (runningServices().includes("localai")) {
    const models = run("docker", [...base, "--profile", "inference", "exec", "-T", "localai", "curl", "-fsS", "http://127.0.0.1:8080/v1/models"], { capture: true });
    if (models.ok) console.log(`\nLocalAI models\n${models.output}`);
  }
  if (runningServices().includes("comfy-backend")) {
    const stats = run("docker", [...base, "--profile", "comfy", "exec", "-T", "comfy-backend", "curl", "-fsS", "http://127.0.0.1:8188/system_stats"], { capture: true });
    if (stats.ok) console.log(`\nComfyUI system_stats\n${stats.output}`);
  }
} else if (command === "switch") {
  const { profile, flags } = parseProfileCommand(process.argv);
  if (!profile) throw new Error(`Choose a profile: ${stack.profiles.join(", ")}`);
  if (!stack.profiles.includes(profile)) throw new Error(`Unknown profile: ${profile}`);
  const toStop = gpuConflictsForProfile(profile);
  const toKeep = [...gpuServicesForProfile(profile)];
  console.log(`Switch plan for profile "${profile}":`);
  console.log(`  stop GPU services: ${toStop.length ? toStop.join(", ") : "none"}`);
  console.log(`  keep/start GPU services: ${toKeep.length ? toKeep.join(", ") : "none"}`);
  if (flags.has("dry-run")) process.exit(0);
  if (toStop.length) compose(["stop", ...toStop]);
  assertGpuPreflight(profile, { allowShare: flags.has("allow-gpu-share") });
  compose([...["--profile", profile], "up", "--detach", "--wait", "--wait-timeout", "300"]);
} else if (command === "config") compose([...allProfiles, "config"]);
else if (command === "status" || command === "ps") compose([...allProfiles, "ps", "--all"]);
else if (command === "profiles") console.log(stack.profiles.join("\n"));
else if (command === "up") {
  const { profile, flags } = parseProfileCommand(process.argv);
  if (!profile) throw new Error(`Choose a profile: ${stack.profiles.join(", ")}, or all`);
  const profiles = profile === "all" ? stack.profiles : [profile];
  for (const item of profiles) if (!stack.profiles.includes(item)) throw new Error(`Unknown profile: ${item}`);
  for (const item of profiles) assertGpuPreflight(item, { allowShare: flags.has("allow-gpu-share") });
  compose([...profiles.flatMap((item) => ["--profile", item]), "up", "--detach", "--wait", "--wait-timeout", "300"]);
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
  console.error("Usage: npm run stack -- <doctor|config|profiles|status|resources|switch PROFILE [--dry-run]|up PROFILE [--allow-gpu-share]|build [SERVICE]|backend [ID]|pull|logs [SERVICE]|stop [SERVICE]|down>");
  process.exitCode = 2;
}
