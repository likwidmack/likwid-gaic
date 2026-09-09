# GPU Power Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a host-level command that caps the GPU's power limit to ~85% of its max (configurable), plus read-only visibility in `npm run stack -- resources` showing whether the cap is applied.

**Architecture:** A pure `computePowerLimitWatts(maxWatts, percent)` helper in `scripts/stack-policy.mjs`, consumed by a new `scripts/gpu-power-cap.mjs` CLI that queries `nvidia-smi`, computes the target, and applies it (with a clear elevation-required message on failure). `scripts/docker.mjs`'s `resources` command gains power fields in its existing `nvidia-smi` query and a soft WARN when uncapped.

**Tech Stack:** Node.js (`spawnSync`, `node:test`), `nvidia-smi` CLI.

**Spec:** [docs/superpowers/specs/2026-09-08-gpu-utilization-cap-design.md](../specs/2026-09-08-gpu-utilization-cap-design.md)

## Global Constraints

- Default cap: 85% of `power.max_limit`, overridable via `GAIC_GPU_POWER_LIMIT_PERCENT` (integer 1-100)
- The apply step only runs on the native host (documented as a manual, Administrator-elevated step on Windows) — never wired into `stack up`/`switch`
- Idempotent: re-running the apply script when already capped at the target is a no-op that exits 0
- `resources`' new WARN is soft (does not change the command's exit code) — matches the existing soft-check pattern used elsewhere in `docker.mjs`
- Verify with `npm test`; the actual `nvidia-smi -pl` apply step can only be verified manually, on real NVIDIA hardware

## File map

| File | Responsibility |
| ---- | --------------- |
| `scripts/stack-policy.mjs` | `computePowerLimitWatts` |
| `scripts/cli-policy.test.mjs` | Tests for it |
| `scripts/gpu-power-cap.mjs` | New CLI |
| `package.json` | `gpu:cap-power` script |
| `scripts/docker.mjs` | `resources` command power visibility |
| `.env.example` | `GAIC_GPU_POWER_LIMIT_PERCENT` |
| `docs/resource-utilization.md` | New subsection |

---

### Task 1: `computePowerLimitWatts` pure helper

**Files:**

- Modify: `scripts/stack-policy.mjs`
- Test: `scripts/cli-policy.test.mjs`

**Interfaces:**

- Consumes: nothing
- Produces: `computePowerLimitWatts(maxWatts, percent)` → `number` (whole watts, floored), exported from `scripts/stack-policy.mjs`

- [ ] **Step 1: Write the failing test**

Add `computePowerLimitWatts` to the existing `import { ... } from "./stack-policy.mjs"` block in `scripts/cli-policy.test.mjs`, then add:

```js
it("computes a whole-watt power limit from a percentage of max", () => {
  assert.equal(computePowerLimitWatts(320, 85), 272);
  assert.equal(computePowerLimitWatts(450, 85), 382);
  assert.equal(computePowerLimitWatts(320, 100), 320);
  assert.equal(computePowerLimitWatts(320, 1), 3);
});

it("rejects an out-of-range percentage", () => {
  assert.throws(() => computePowerLimitWatts(320, 0), /percent/i);
  assert.throws(() => computePowerLimitWatts(320, 101), /percent/i);
  assert.throws(() => computePowerLimitWatts(320, -5), /percent/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/cli-policy.test.mjs`
Expected: FAIL — `computePowerLimitWatts is not a function`

- [ ] **Step 3: Implement the helper**

Add to `scripts/stack-policy.mjs`:

```js
export function computePowerLimitWatts(maxWatts, percent) {
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
    throw new Error(`Invalid power limit percent: ${percent} (must be 1-100)`);
  }
  return Math.floor(maxWatts * percent / 100);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/cli-policy.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/stack-policy.mjs scripts/cli-policy.test.mjs
git commit -m "feat: add computePowerLimitWatts stack-policy helper"
```

---

### Task 2: `scripts/gpu-power-cap.mjs` CLI

**Files:**

- Create: `scripts/gpu-power-cap.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: `computePowerLimitWatts` from Task 1
- Produces: `npm run gpu:cap-power` — an idempotent apply-and-report command

- [ ] **Step 1: Write the script**

Create `scripts/gpu-power-cap.mjs`:

```js
import { spawnSync } from "node:child_process";
import process from "node:process";
import { computePowerLimitWatts } from "./stack-policy.mjs";

function run(program, args) {
  const result = spawnSync(program, args, { encoding: "utf8" });
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

function main() {
  const percent = parsePercent(process.env.GAIC_GPU_POWER_LIMIT_PERCENT);
  const query = run("nvidia-smi", ["--query-gpu=power.max_limit,power.limit", "--format=csv,noheader,nounits"]);
  if (!query.ok) {
    console.error(`nvidia-smi is required and did not respond: ${query.output}`);
    process.exitCode = 1;
    return;
  }
  const [maxRaw, currentRaw] = query.output.split(",").map((part) => part.trim());
  const maxWatts = Number.parseFloat(maxRaw);
  const currentWatts = Number.parseFloat(currentRaw);
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

main();
```

- [ ] **Step 2: Add the npm script**

In `package.json`'s `"scripts"` block, add (alphabetically near the other
top-level entries, e.g. after `"inventory"`):

```json
"gpu:cap-power": "node scripts/gpu-power-cap.mjs",
```

- [ ] **Step 3: Verify the script loads without a GPU**

Run: `node scripts/gpu-power-cap.mjs`
Expected on a host without `nvidia-smi`: prints `nvidia-smi is required and did not respond: ...` and exits 1 (confirms the script doesn't crash before reaching the GPU check).

- [ ] **Step 4: Commit**

```bash
git add scripts/gpu-power-cap.mjs package.json
git commit -m "feat: add gpu:cap-power CLI"
```

---

### Task 3: Power visibility in `npm run stack -- resources`

**Files:**

- Modify: `scripts/docker.mjs:405-427` (the `resources` command)

**Interfaces:**

- Consumes: nothing new
- Produces: `power.draw`/`power.limit`/`power.max_limit` printed alongside the existing GPU line, plus a soft WARN when uncapped

- [ ] **Step 1: Extend the `nvidia-smi` query**

Replace:

```js
  const gpu = run("nvidia-smi", ["--query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu", "--format=csv,noheader"], { capture: true, env: process.env });
  console.log(gpu.ok ? `GPU\n${gpu.output}` : `GPU\nunavailable: ${gpu.output}`);
```

With:

```js
  const gpu = run("nvidia-smi", ["--query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,power.draw,power.limit,power.max_limit", "--format=csv,noheader"], { capture: true, env: process.env });
  console.log(gpu.ok ? `GPU\n${gpu.output}` : `GPU\nunavailable: ${gpu.output}`);
  if (gpu.ok) {
    const fields = gpu.output.split(",").map((part) => part.trim());
    const powerLimit = Number.parseFloat(fields[8]);
    const powerMax = Number.parseFloat(fields[9]);
    if (Number.isFinite(powerLimit) && Number.isFinite(powerMax) && Math.round(powerLimit) >= Math.round(powerMax)) {
      console.warn(`WARN  GPU power limit is uncapped (${fields[8]} = max). Run \`npm run gpu:cap-power\` for headroom.`);
    }
  }
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS (no unit test exercises this branch directly — `resources` is manual/interactive, consistent with how the rest of that command is tested)

- [ ] **Step 3: Commit**

```bash
git add scripts/docker.mjs
git commit -m "feat: surface GPU power-limit headroom in stack -- resources"
```

---

### Task 4: Document the cap

**Files:**

- Modify: `.env.example`
- Modify: `docs/resource-utilization.md`

**Interfaces:**

- Consumes: nothing
- Produces: accurate, discoverable docs

- [ ] **Step 1: Add the env var to `.env.example`**

In the existing "GPU and CPU resource tuning (single-GPU workstation
defaults)" block (the same block the Ollama tuning vars were added to),
append:

```dotenv
# Cap sustained GPU power draw to leave thermal/power headroom. Apply with
# `npm run gpu:cap-power` (Windows: run the terminal as Administrator).
GAIC_GPU_POWER_LIMIT_PERCENT=85
```

- [ ] **Step 2: Document the mechanism in `docs/resource-utilization.md`**

Add a new subsection right after "## Host sizing" and before "### Thread
budget" (i.e. as a new top-level `##` section following "Host sizing"):

```markdown
## GPU power headroom

Docker/NVIDIA have no per-container "utilization percentage" limit —
`utilization.gpu` (shown by `npm run stack -- resources`) is a measured
outcome, not a settable dial. The supported way to keep the GPU from
running flat-out at 100% under sustained load is to cap its power limit,
which indirectly caps how far it boosts clocks.

```powershell
npm run gpu:cap-power
```

This is a **host-level, one-time (or per-boot) command** — it is not part of
`stack up`/`switch` and does not run inside WSL2 or a container, because
setting the power limit needs the native Windows NVIDIA driver and
Administrator elevation. Re-run the terminal as Administrator if it reports
a permission error.

Default target is 85% of the GPU's max power limit; override with
`GAIC_GPU_POWER_LIMIT_PERCENT` in `.env` (1-100). `npm run stack --
resources` reports the current `power.draw`/`power.limit`/`power.max_limit`
and warns if the limit is still uncapped.
```

- [ ] **Step 3: Add a troubleshooting entry**

In `docs/resource-utilization.md`'s existing `## Troubleshooting` section,
add:

```markdown
- **`gpu:cap-power` reports a permission error:** Re-run the terminal as
  Administrator (Windows) or with `sudo` (Linux); GPU power-limit changes
  require elevated privileges.
```

- [ ] **Step 4: Commit**

```bash
git add .env.example docs/resource-utilization.md
git commit -m "docs: document the GPU power-cap command"
```

---

### Task 5: Manual verification (NVIDIA workstation only)

**Files:**

- None

**Interfaces:**

- Consumes: everything from Tasks 1-4
- Produces: confirmation the cap actually applies on real hardware

- [ ] **Step 1: Check current state**

```powershell
npm run stack -- resources
```

Expected: GPU line includes power fields; if uncapped, the new WARN appears.

- [ ] **Step 2: Apply the cap**

```powershell
npm run gpu:cap-power
```

Expected: on first run (uncapped), prints the applied wattage; on a
non-elevated terminal, prints the Administrator-elevation message instead —
re-run elevated and confirm it then succeeds.

- [ ] **Step 3: Confirm idempotency and visibility**

```powershell
npm run gpu:cap-power
npm run stack -- resources
```

Expected: second `gpu:cap-power` run reports "Already capped..."; `resources`
no longer prints the uncapped WARN and shows `power.limit` at the reduced
value.
