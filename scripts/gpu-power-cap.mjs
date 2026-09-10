import { spawnSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parsePercent, parsePowerWatts, planPowerCapAction } from "./stack-policy.mjs";

function run(program, args) {
  const result = spawnSync(program, args, { encoding: "utf8", timeout: 10000 });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() || result.error?.message || ""
  };
}

/** True when a failed nvidia-smi apply call looks like an elevation problem. */
function looksLikePermissionError(text) {
  return /permission|privilege|insufficient|not permitted/i.test(text ?? "");
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const percent = parsePercent(process.env.GAIC_GPU_POWER_LIMIT_PERCENT);
  const query = run("nvidia-smi", [
    "--query-gpu=power.max_limit,power.limit,power.min_limit",
    "--format=csv,noheader,nounits"
  ]);
  if (!query.ok) {
    console.error(`nvidia-smi is required and did not respond: ${query.output}`);
    process.exitCode = 1;
    return;
  }
  const [maxRaw, currentRaw, minRaw] = query.output.split(",").map((part) => part.trim());
  const maxWatts = parsePowerWatts(maxRaw, "power.max_limit");
  const currentWatts = parsePowerWatts(currentRaw, "power.limit");
  const minWatts = parsePowerWatts(minRaw, "power.min_limit");

  const plan = planPowerCapAction({ maxWatts, currentWatts, minWatts, percent, dryRun });
  for (const message of plan.messages) {
    (plan.kind === "below-min" ? console.error : console.log)(message);
  }

  if (plan.kind !== "apply") {
    process.exitCode = plan.exitCode;
    return;
  }

  const apply = run("nvidia-smi", ["-pl", String(plan.targetWatts)]);
  if (!apply.ok) {
    console.error(`Failed to set power limit: ${apply.output}`);
    if (looksLikePermissionError(apply.output)) {
      console.error(
        process.platform === "win32"
          ? "If this is a permission error, re-run this terminal as Administrator and try again."
          : "If this is a permission error, re-run with sudo and try again."
      );
    }
    process.exitCode = 1;
    return;
  }
  console.log(`OK  GPU power limit set to ${plan.targetWatts}W.`);
}

const isDirectRun = (() => {
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
