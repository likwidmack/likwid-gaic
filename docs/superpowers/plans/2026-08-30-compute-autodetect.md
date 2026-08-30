# Compute Mode Auto-Detect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `FORKEDAI_COMPUTE` is unset or `auto`, resolve `nvidia` vs `cpu` from a host `nvidia-smi` probe (CPU on failure), with explicit `nvidia`/`cpu` overrides unchanged.

**Architecture:** Extend `resolveComputeMode` in `scripts/paths.mjs` with an injectable probe and an `isAutoComputeEnv` helper. `scripts/docker.mjs` logs `Compute mode: <mode> (auto)` when the env was unset/`auto`. Docs and `.env.example` describe auto-detect as the default.

**Tech Stack:** Node.js (`spawnSync`), existing `node:test` suite, Compose overlay already driven by resolved mode.

## Global Constraints

- Spec: [docs/superpowers/specs/2026-08-30-compute-autodetect-design.md](../specs/2026-08-30-compute-autodetect-design.md)
- Valid values: `nvidia`, `cpu`, `auto`, or unset; anything else errors
- Probe: `nvidia-smi --query-gpu=name --format=csv,noheader` — exit 0 + non-empty stdout → `nvidia`, else → `cpu`
- Explicit `nvidia`/`cpu` never probe
- No Docker GPU smoke test; no result caching; no Metal/AMD
- Never commit on `development` or `main`; use topic branch (current: `feat/optional-ollama-profile`)
- Do not start/stop/recreate Docker services for verification
- Verify with `npm test` and `git diff --check`; Prettier on maintained Markdown when docs change

## File map

| File                                                                          | Responsibility                                         |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| `scripts/paths.mjs`                                                           | Probe helper, `resolveComputeMode`, `isAutoComputeEnv` |
| `scripts/paths.test.mjs`                                                      | Unit tests with injected probe (no real `nvidia-smi`)  |
| `scripts/docker.mjs`                                                          | Log `(auto)` when env was unset/`auto`                 |
| `.env.example`                                                                | Document auto default; example value `auto`            |
| `AGENTS.md`, `README.md`, `docs/container-operations.md`, related setup pages | Describe auto-detect + CPU fallback                    |

---

### Task 1: Failing tests for auto-detect and overrides

**Files:**

- Modify: `scripts/paths.test.mjs`
- Test: `node --test scripts/paths.test.mjs`

**Interfaces:**

- Consumes: current `resolveComputeMode(env, platform)` (will gain options in Task 2)
- Produces: tests that expect `resolveComputeMode(env, platform, { probe })` and `isAutoComputeEnv(env)`

- [ ] **Step 1: Replace the `resolveComputeMode` suite with failing tests**

Replace the existing `describe("resolveComputeMode", …)` block in `scripts/paths.test.mjs` with:

```js
describe("resolveComputeMode", () => {
  it("honors explicit nvidia and cpu values without probing", () => {
    let probed = 0;
    const probe = () => {
      probed += 1;
      return true;
    };
    assert.equal(
      resolveComputeMode({ FORKEDAI_COMPUTE: "nvidia" }, "darwin", { probe }),
      "nvidia",
    );
    assert.equal(
      resolveComputeMode({ FORKEDAI_COMPUTE: "CPU" }, "win32", { probe }),
      "cpu",
    );
    assert.equal(probed, 0);
  });

  it("treats unset and auto as probe-driven", () => {
    assert.equal(
      resolveComputeMode({}, "darwin", { probe: () => true }),
      "nvidia",
    );
    assert.equal(
      resolveComputeMode({ FORKEDAI_COMPUTE: "auto" }, "linux", {
        probe: () => true,
      }),
      "nvidia",
    );
    assert.equal(
      resolveComputeMode({}, "win32", { probe: () => false }),
      "cpu",
    );
    assert.equal(
      resolveComputeMode({ FORKEDAI_COMPUTE: "AUTO" }, "darwin", {
        probe: () => false,
      }),
      "cpu",
    );
  });

  it("rejects invalid values", () => {
    assert.throws(
      () =>
        resolveComputeMode({ FORKEDAI_COMPUTE: "metal" }, "darwin", {
          probe: () => true,
        }),
      /Invalid FORKEDAI_COMPUTE/,
    );
  });
});

describe("isAutoComputeEnv", () => {
  it("is true for unset and auto, false for pinned modes", () => {
    assert.equal(isAutoComputeEnv({}), true);
    assert.equal(isAutoComputeEnv({ FORKEDAI_COMPUTE: "auto" }), true);
    assert.equal(isAutoComputeEnv({ FORKEDAI_COMPUTE: " AUTO " }), true);
    assert.equal(isAutoComputeEnv({ FORKEDAI_COMPUTE: "nvidia" }), false);
    assert.equal(isAutoComputeEnv({ FORKEDAI_COMPUTE: "cpu" }), false);
  });
});
```

Update the import line to include `isAutoComputeEnv`:

```js
import {
  expandHome,
  hostPath,
  isAutoComputeEnv,
  pathFlavor,
  pathKey,
  pathModule,
  resolveComputeMode,
  usesPosixPaths,
} from "./paths.mjs";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/paths.test.mjs`

Expected: FAIL — `isAutoComputeEnv` not exported and/or unset still returns fixed `nvidia` without using `probe`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add scripts/paths.test.mjs
git commit -m "$(cat <<'EOF'
test: expect FORKEDAI_COMPUTE auto-detect via injectable probe.

EOF
)"
```

---

### Task 2: Implement probe + resolveComputeMode + isAutoComputeEnv

**Files:**

- Modify: `scripts/paths.mjs`
- Test: `node --test scripts/paths.test.mjs`

**Interfaces:**

- Consumes: Node `spawnSync`
- Produces:
  - `detectNvidiaSmi(spawn = spawnSync) => boolean`
  - `isAutoComputeEnv(env = process.env) => boolean`
  - `resolveComputeMode(env = process.env, platform = process.platform, { probe = detectNvidiaSmi } = {}) => "nvidia"|"cpu"`
  - Error text for invalid values: `use nvidia, cpu, or auto`

- [ ] **Step 1: Implement helpers and update `resolveComputeMode`**

In `scripts/paths.mjs`, add `spawnSync` import and replace the compute-mode section with:

```js
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

// ... existing path helpers unchanged ...

/** @returns {boolean} */
export function detectNvidiaSmi(spawn = spawnSync) {
  try {
    const result = spawn(
      "nvidia-smi",
      ["--query-gpu=name", "--format=csv,noheader"],
      {
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
      },
    );
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
export function resolveComputeMode(
  env = process.env,
  platform = process.platform,
  { probe = detectNvidiaSmi } = {},
) {
  void platform;
  const raw = (env.FORKEDAI_COMPUTE ?? "").trim().toLowerCase();
  if (raw === "nvidia" || raw === "cpu") return raw;
  if (raw && raw !== "auto") {
    throw new Error(
      `Invalid FORKEDAI_COMPUTE=${env.FORKEDAI_COMPUTE}; use nvidia, cpu, or auto`,
    );
  }
  return probe() ? "nvidia" : "cpu";
}
```

Keep `assertPathExists` and all other exports unchanged.

- [ ] **Step 2: Run unit tests**

Run: `node --test scripts/paths.test.mjs`

Expected: PASS for `resolveComputeMode` and `isAutoComputeEnv` suites.

- [ ] **Step 3: Commit**

```bash
git add scripts/paths.mjs
git commit -m "$(cat <<'EOF'
feat: auto-detect FORKEDAI_COMPUTE from host nvidia-smi.

EOF
)"
```

---

### Task 3: Log `(auto)` from docker.mjs

**Files:**

- Modify: `scripts/docker.mjs` (imports + compute resolution + doctor/resources logs)
- Test: `node --check scripts/docker.mjs` and `npm test`

**Interfaces:**

- Consumes: `resolveComputeMode`, `isAutoComputeEnv` from `./paths.mjs`
- Produces: log lines `Compute mode: nvidia (auto)` / `Compute mode: cpu (auto)` / `Compute mode: nvidia`

- [ ] **Step 1: Capture auto flag before overwriting compose env**

Near the top of `scripts/docker.mjs`, change:

```js
import { hostPath, resolveComputeMode } from "./paths.mjs";
```

to:

```js
import { hostPath, isAutoComputeEnv, resolveComputeMode } from "./paths.mjs";
```

Then replace:

```js
const computeMode = resolveComputeMode();
```

with:

```js
const computeAuto = isAutoComputeEnv();
const computeMode = resolveComputeMode();
const computeModeLabel = `${computeMode}${computeAuto ? " (auto)" : ""}`;
```

(`composeEnv` continues to set `FORKEDAI_COMPUTE: computeMode` so child Compose sees a concrete mode.)

- [ ] **Step 2: Update log sites**

Replace doctor log:

```js
console.log(
  `Compute mode: ${computeMode}${process.env.FORKEDAI_COMPUTE ? "" : " (default)"}`,
);
```

with:

```js
console.log(`Compute mode: ${computeModeLabel}`);
```

Replace resources log:

```js
console.log(`Compute mode: ${computeMode}`);
```

with:

```js
console.log(`Compute mode: ${computeModeLabel}`);
```

If any other `Compute mode:` prints exist in this file, use `computeModeLabel` the same way.

- [ ] **Step 3: Verify**

Run:

```bash
node --check scripts/docker.mjs
npm test
```

Expected: syntax OK; `npm test` 36+ tests pass (paths suite still green).

Optional read-only: `npm run stack:doctor` should print `Compute mode: nvidia (auto)` on this workstation when `.env` has unset/`auto` (skip if doctor fails for unrelated missing tools).

- [ ] **Step 4: Commit**

```bash
git add scripts/docker.mjs
git commit -m "$(cat <<'EOF'
feat: label auto-resolved compute mode in stack doctor logs.

EOF
)"
```

---

### Task 4: Docs and `.env.example`

**Files:**

- Modify: `.env.example`
- Modify: `AGENTS.md` (workstation boundary + Docker skill compute bullets)
- Modify: `README.md` (requirements / compute paragraphs)
- Modify: `docs/container-operations.md` (platform table + macOS notes)
- Modify: `docs/architecture.md`, `docs/localai-docker-setup.md`, `docs/ollama-docker-setup.md` as needed for consistency
- Test: Prettier + `npm test`

**Interfaces:**

- Consumes: approved wording from the design spec
- Produces: docs that say unset/`auto` → `nvidia-smi` probe, failure → `cpu`; pinned `nvidia`/`cpu` still supported

- [ ] **Step 1: Update `.env.example` header**

Replace the compute block with:

```dotenv
# Compute mode: unset or auto = detect via host nvidia-smi (cpu if probe fails).
# Pin with nvidia or cpu. media/comfy require nvidia after resolution.
FORKEDAI_COMPUTE=auto
```

Keep the later CPU overlay comments accurate (`compose.cpu.yaml` when resolved mode is `cpu`).

- [ ] **Step 2: Update operator docs**

In `docs/container-operations.md` platform table, set Default `FORKEDAI_COMPUTE` for all hosts to something like:

`auto` (`nvidia` if `nvidia-smi` ok, else `cpu`)

Update macOS/Linux prose: do not claim a fixed Darwin `cpu` default; say unset/`auto` probes and falls back to `cpu` when there is no NVIDIA.

Align one-liners in `AGENTS.md`, `README.md`, `docs/architecture.md`, `docs/localai-docker-setup.md`, and `docs/ollama-docker-setup.md` with the same rule. Do not edit `docs/inventory.generated.md`.

- [ ] **Step 3: Format and validate**

PowerShell from repo root:

```powershell
$docs = (Get-ChildItem docs/*.md | Where-Object Name -ne "inventory.generated.md").FullName
npx --yes prettier@3.6.2 --write README.md $docs
npm test
git diff --check
```

Expected: Prettier OK; `npm test` pass; no whitespace errors.

- [ ] **Step 4: Commit**

```bash
git add .env.example AGENTS.md README.md docs/container-operations.md docs/architecture.md docs/localai-docker-setup.md docs/ollama-docker-setup.md
git commit -m "$(cat <<'EOF'
docs: describe FORKEDAI_COMPUTE auto-detect default.

EOF
)"
```

Only stage files actually changed in this task.

---

## Self-review (plan vs spec)

| Spec requirement                | Task                      |
| ------------------------------- | ------------------------- |
| Unset → probe                   | Task 2                    |
| `auto` alias                    | Tasks 1–2                 |
| Probe success → `nvidia`        | Task 2                    |
| Probe failure → `cpu`           | Task 2                    |
| Explicit overrides skip probe   | Tasks 1–2                 |
| Invalid values error            | Tasks 1–2                 |
| Injectable probe for tests      | Tasks 1–2                 |
| Log `(auto)` in docker.mjs      | Task 3                    |
| Docs / `.env.example`           | Task 4                    |
| No Docker smoke / cache / Metal | Out of scope (not tasked) |

No TBD/placeholder steps. Signatures are consistent across tasks (`probe` option, `isAutoComputeEnv`, `computeModeLabel`).
