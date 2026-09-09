import { spawnSync } from "node:child_process";
import process from "node:process";
import { computePowerLimitWatts } from "./stack-policy.mjs";

function run(program, args) {
  const result = spawnSync(program, args, { encoding: "utf8", timeout: 10000 });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() || result.error?.message || ""
  };
}

function parsePercent(raw) {
  const value = Number.parseInt((raw ?? "85").trim(), 10);
  if (!Number.isFinite(value)) throw new Error(`Invalid GAIC_GPU_POWER_LIMIT_PERCENT: ${raw}`);
  return value;
}

/**
 * Parses a wattage value out of raw nvidia-smi CSV output and validates it.
 * nvidia-smi can emit "[N/A]" or an empty field for power.max_limit / power.limit
 * on some GPUs/driver states; Number.parseFloat would silently turn that into NaN,
 * so we fail loudly here instead of letting NaN flow into computePowerLimitWatts
 * or an `nvidia-smi -pl NaN` apply call.
 */
function parsePowerWatts(raw, label) {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`nvidia-smi returned an unusable ${label} value: ${raw && raw.length ? raw : "(empty)"}`);
  }
  return value;
}

function main() {
  const percent = parsePercent(process.env.GAIC_GPU_POWER_LIMIT_PERCENT);
  const query = run("nvidia-smi", ["--query-gpu=power.max_limit,power.limit", "--format=csv,noheader,nounits"]);
  if (!query.ok) {
    console.error(`nvidia-smi is required and did not respond: ${query.output}`);
    process.exitCode = 1;
    return;
  }
  const [maxRaw, currentRaw] = query.output.split(",").map((part) => part.trim());
  const maxWatts = parsePowerWatts(maxRaw, "power.max_limit");
  const currentWatts = parsePowerWatts(currentRaw, "power.limit");
  const targetWatts = computePowerLimitWatts(maxWatts, percent);
  if (Math.round(currentWatts) === targetWatts) {
    console.log(`Already capped at ${targetWatts}W (${percent}% of ${maxWatts}W max).`);
    return;
  }
  console.log(`Applying power limit: ${currentWatts}W -> ${targetWatts}W (${percent}% of ${maxWatts}W max)`);
  const apply = run("nvidia-smi", ["-pl", String(targetWatts)]);
  if (!apply.ok) {
    console.error(`Failed to set power limit: ${apply.output}`);
    if (process.platform === "win32") {
      console.error("Re-run this terminal as Administrator and try again.");
    } else {
      console.error("Re-run with sudo and try again.");
    }
    process.exitCode = 1;
    return;
  }
  console.log(`OK  GPU power limit set to ${targetWatts}W.`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
