import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { assertCpuAllowsProfile } from "./stack-policy.mjs";
import { resolveComputeMode } from "./paths.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const stack = JSON.parse(readFileSync(new URL("../config/stack.json", import.meta.url), "utf8"));
const computeMode = resolveComputeMode();
const command = process.argv[2] ?? "status";
const gatewayUrl = stack.services.find((item) => item.name === "ollama")?.url ?? "https://localhost:8448";

function run(program, args, { capture = false } = {}) {
  const result = spawnSync(program, args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit"
  });
  if (capture) {
    return {
      ok: result.status === 0,
      stdout: (result.stdout ?? "").trim(),
      stderr: (result.stderr ?? "").trim(),
      output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() || result.error?.message || ""
    };
  }
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const base = ["compose", "--project-name", stack.projectName, "--file", "compose.yaml"];
if (computeMode === "cpu") base.push("--file", "compose.cpu.yaml");

function assertOllamaAllowed() {
  assertCpuAllowsProfile(computeMode, "ollama");
}

function ollamaRunning() {
  const result = run("docker", [...base, "--profile", "ollama", "ps", "--status", "running", "--quiet", "ollama"], {
    capture: true
  });
  // docker compose ps --quiet exits 0 with empty stdout when the service is down.
  return result.ok && Boolean(result.stdout);
}

function requireRunningOllama() {
  if (!ollamaRunning()) {
    throw new Error("Ollama is not running. Start it with `npm run stack -- switch ollama`.");
  }
}

function fetchTags() {
  // Prefer the Caddy gateway from the host. The ollama image does not ship curl.
  const viaGateway = run("curl", ["-kfsS", "--connect-timeout", "3", "--max-time", "15", `${gatewayUrl}/api/tags`], {
    capture: true
  });
  if (viaGateway.ok && viaGateway.stdout) {
    try {
      const payload = JSON.parse(viaGateway.stdout);
      return Array.isArray(payload.models) ? payload.models : [];
    } catch {
      throw new Error("Ollama gateway returned an unexpected /api/tags payload.");
    }
  }

  // Fallback when gateway is briefly unavailable but the container is up.
  const viaCli = run("docker", [...base, "--profile", "ollama", "exec", "-T", "ollama", "ollama", "list", "--format", "json"], {
    capture: true
  });
  if (viaCli.ok && viaCli.stdout) {
    try {
      const payload = JSON.parse(viaCli.stdout);
      if (Array.isArray(payload)) {
        return payload.map((item) => ({
          name: item.name ?? item.model,
          size: item.size ?? item.Size
        }));
      }
      if (Array.isArray(payload.models)) return payload.models;
    } catch {
      // Fall through to plain `ollama list` table parsing.
    }
  }

  const table = run("docker", [...base, "--profile", "ollama", "exec", "-T", "ollama", "ollama", "list"], {
    capture: true
  });
  if (!table.ok) {
    throw new Error(table.output || viaGateway.output || "Failed to read Ollama tags.");
  }
  const lines = table.stdout.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];
  return lines.slice(1).map((line) => {
    const name = line.trim().split(/\s+/)[0];
    return { name };
  });
}

function printTags(models) {
  if (!models.length) {
    console.log("No Ollama models pulled yet. Run `npm run ollama -- pull MODEL`.");
    return;
  }
  for (const model of models) {
    const name = model.name ?? model.model ?? "(unknown)";
    const size = model.size ? `${(model.size / 2 ** 30).toFixed(2)} GiB` : "unknown size";
    console.log(`${name.padEnd(40)} ${size}`);
  }
}

if (command === "pull") {
  assertOllamaAllowed();
  const name = process.argv[3];
  if (!name) throw new Error("Usage: npm run ollama -- pull MODEL");
  requireRunningOllama();
  run("docker", [...base, "--profile", "ollama", "exec", "-T", "ollama", "ollama", "pull", name]);
} else if (command === "list") {
  assertOllamaAllowed();
  requireRunningOllama();
  printTags(fetchTags());
} else if (command === "status") {
  assertOllamaAllowed();
  if (!ollamaRunning()) {
    console.log("Ollama: not running");
    console.log(`Gateway (when up): ${gatewayUrl}`);
    console.log("Start with `npm run stack -- switch ollama`.");
    process.exitCode = 1;
  } else {
    console.log("Ollama: running");
    console.log(`Gateway: ${gatewayUrl}`);
    printTags(fetchTags());
  }
} else {
  console.error("Usage: npm run ollama -- <pull MODEL|list|status>");
  process.exitCode = 2;
}
