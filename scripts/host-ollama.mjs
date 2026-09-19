#!/usr/bin/env node
/**
 * Thin npm entry for optional host-native Ollama helpers.
 * Prefer managed Compose: npm run stack -- switch ollama && npm run ollama -- …
 *
 * Usage:
 *   npm run ollama:host -- create -m llama3.1 -v 8b
 *   npm run ollama:host -- quick llama3.1 8b both 16384 1
 *   npm run ollama:host -- serve
 *   npm run ollama:host -- create --allow-gpu-share -m …
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { hostPath, resolveComputeMode } from "./paths.mjs";
import { assertHostOllamaGpuPreflight } from "./stack-policy.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const scriptDir = path.join(root, "scripts", "host-ollama");
const stack = JSON.parse(readFileSync(new URL("../config/stack.json", import.meta.url), "utf8"));
const storage = JSON.parse(readFileSync(new URL("../config/storage.json", import.meta.url), "utf8"));
const computeMode = resolveComputeMode();
const gpuExclusiveEnabled = () => process.env.GAIC_GPU_EXCLUSIVE !== "false";

const scripts = {
  create: path.join(scriptDir, "create-gpu-model.sh"),
  quick: path.join(scriptDir, "quick-create-gpu-model.sh"),
  serve: path.join(scriptDir, "start-ollama.sh")
};

function run(program, args, { capture = false, env = process.env } = {}) {
  const result = spawnSync(program, args, {
    cwd: root,
    env,
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

function composeBase() {
  const base = ["compose", "--project-name", stack.projectName, "--file", "compose.yaml"];
  if (computeMode === "cpu") base.push("--file", "compose.cpu.yaml");
  return base;
}

function runningGpuServices() {
  const profiles = stack.profiles.flatMap((profile) => ["--profile", profile]);
  const result = run("docker", [...composeBase(), ...profiles, "ps", "--status", "running", "--format", "{{.Service}}"], {
    capture: true
  });
  if (!result.ok || !result.output) return [];
  const exclusive = new Set(stack.gpuExclusive?.services ?? []);
  return [
    ...new Set(
      result.output
        .split("\n")
        .map((line) => line.trim())
        .filter((service) => exclusive.has(service))
    )
  ];
}

function parseArgv(argv) {
  const flags = new Set();
  const positional = [];
  for (const token of argv) {
    if (token === "--allow-gpu-share" || token === "--skip-model-root") {
      flags.add(token.slice(2));
    } else {
      positional.push(token);
    }
  }
  return { command: positional[0] ?? "help", scriptArgs: positional.slice(1), flags };
}

function printHelp() {
  console.log(`Host-native Ollama helpers (optional bypass of Compose)

Prefer managed:
  npm run stack -- switch ollama
  npm run ollama -- pull|list|status

Commands:
  npm run ollama:host -- create [create-gpu-model.sh args…]
  npm run ollama:host -- quick  [quick-create-gpu-model.sh args…]
  npm run ollama:host -- serve
  npm run ollama:host -- help

Flags (consumed by this wrapper, not the shell scripts):
  --allow-gpu-share   Allow running while Compose GPU services are up
  --skip-model-root   Do not set OLLAMA_MODELS from config/storage.json

This wrapper:
  • refuses when Compose GPU-exclusive services are running (unless --allow-gpu-share)
  • sets OLLAMA_MODELS to hub MODEL_ROOT so host blobs can share Compose storage
`);
}

function resolveModelRootEnv(flags) {
  if (flags.has("skip-model-root")) return {};
  if (process.env.OLLAMA_MODELS) {
    console.log(`OK  Using existing OLLAMA_MODELS=${process.env.OLLAMA_MODELS}`);
    return {};
  }
  const modelRoot = hostPath(storage.roots.models);
  if (!existsSync(modelRoot)) {
    console.warn(
      `WARN  MODEL_ROOT does not exist yet (${modelRoot}). Continuing without OLLAMA_MODELS override.`
    );
    return {};
  }
  console.log(`OK  Setting OLLAMA_MODELS=${modelRoot} (hub MODEL_ROOT)`);
  return { OLLAMA_MODELS: modelRoot };
}

function main() {
  const { command, scriptArgs, flags } = parseArgv(process.argv.slice(2));
  if (command === "help" || command === "-h" || command === "--help") {
    printHelp();
    return;
  }

  const scriptPath = scripts[command];
  if (!scriptPath) {
    throw new Error(`Unknown command "${command}". Use create, quick, serve, or help.`);
  }
  if (!existsSync(scriptPath)) {
    throw new Error(`Missing helper script: ${scriptPath}`);
  }

  if (computeMode === "nvidia" || command === "serve" || command === "create" || command === "quick") {
    assertHostOllamaGpuPreflight(runningGpuServices(), {
      allowShare: flags.has("allow-gpu-share"),
      gpuExclusiveEnabled: gpuExclusiveEnabled()
    });
  }

  const env = {
    ...process.env,
    ...resolveModelRootEnv(flags)
  };

  // Git Bash / WSL / Linux — same convention as models:bootstrap-optional
  run("bash", [scriptPath, ...scriptArgs], { env });
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
