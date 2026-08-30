import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

function isWsl() {
  if (process.platform !== "linux") return false;
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  try {
    return /microsoft|wsl/i.test(readFileSync("/proc/version", "utf8"));
  } catch {
    return false;
  }
}

/** @returns {"windows"|"wsl"|"posix"} */
export function pathFlavor() {
  if (process.platform === "win32") return "windows";
  if (isWsl()) return "wsl";
  return "posix";
}

export function expandHome(value) {
  if (typeof value !== "string" || value.length === 0) return value;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) return path.join(os.homedir(), value.slice(2));
  return value;
}

const keyByFlavor = {
  windows: "pathWindows",
  wsl: "pathWsl",
  posix: "pathPosix"
};

export function hostPath(entry, flavor = pathFlavor()) {
  const key = keyByFlavor[flavor];
  const raw = entry?.[key];
  if (!raw) throw new Error(`Path entry is missing ${key}`);
  return expandHome(raw);
}

export function pathKey(flavor = pathFlavor()) {
  return keyByFlavor[flavor];
}

export function usesPosixPaths(flavor = pathFlavor()) {
  return flavor !== "windows";
}

export function pathModule(flavor = pathFlavor()) {
  return flavor === "windows" ? path.win32 : path.posix;
}

/** @returns {boolean} */
export function detectNvidiaSmi(spawn = spawnSync) {
  try {
    const result = spawn("nvidia-smi", ["--query-gpu=name", "--format=csv,noheader"], {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true
    });
    if (result.error || result.status !== 0) return false;
    return String(result.stdout ?? "").trim().length > 0;
  } catch {
    return false;
  }
}

export function isAutoComputeEnv(env = process.env) {
  const raw = (env.FORKEDAI_COMPUTE ?? "").trim().toLowerCase();
  return raw === "" || raw === "auto";
}

/** @returns {"nvidia"|"cpu"} */
export function resolveComputeMode(env = process.env, platform = process.platform, { probe = detectNvidiaSmi } = {}) {
  void platform;
  const raw = (env.FORKEDAI_COMPUTE ?? "").trim().toLowerCase();
  if (raw === "nvidia" || raw === "cpu") return raw;
  if (raw && raw !== "auto") {
    throw new Error(`Invalid FORKEDAI_COMPUTE=${env.FORKEDAI_COMPUTE}; use nvidia, cpu, or auto`);
  }
  return probe() ? "nvidia" : "cpu";
}

export function assertPathExists(label, value) {
  return existsSync(value) ? "OK" : "MISSING";
}
