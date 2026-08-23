# Stack npm script aliases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add thin `package.json` aliases for stack lifecycle commands, build-all, and profile `switch` starters without changing `scripts/docker.mjs`.

**Architecture:** Mirror the existing `stack:doctor` / `stack:config` pattern: each new script is a one-line wrapper around `node scripts/docker.mjs …`. Extend the existing `validate.mjs` npm-script presence check so CI/`npm test` keeps the aliases honest. Document the aliases in `docs/container-operations.md` only (root README quick-start already stops at doctor/config and does not need bloating).

**Tech Stack:** Node.js `package.json` scripts, `scripts/validate.mjs`, Markdown docs.

## Global Constraints

- Thin `package.json` aliases only; do not change `scripts/docker.mjs` behavior
- Profile scripts call `switch PROFILE`; `stack:up` remains raw `up`
- Lifecycle aliases: `stack:up`, `stack:down`, `stack:status`, `stack:build` (all)
- Profile aliases: `stack:inference`, `stack:rag`, `stack:media`, `stack:comfy`
- Keep existing `stack`, `stack:doctor`, `stack:config`
- Never commit on `development` or `main`; commit only on a topic branch (current: `docs/stack-npm-script-aliases`)
- Do not start, stop, build, or recreate Docker services as part of verification
- Verify with `npm test` and `git diff --check`; Prettier on maintained Markdown when docs change

## File map

| File                           | Responsibility                                           |
| ------------------------------ | -------------------------------------------------------- |
| `package.json`                 | Declare the new script aliases                           |
| `scripts/validate.mjs`         | Assert required stack script names exist                 |
| `docs/container-operations.md` | Short alias table under Daily operations                 |
| `README.md`                    | No change (quick-start does not list lifecycle commands) |
| `scripts/docker.mjs`           | No change                                                |

---

### Task 1: Validate required aliases, then add `package.json` scripts

**Files:**

- Modify: `scripts/validate.mjs` (script presence loop near the existing `stack` / `models` check)
- Modify: `package.json` (`scripts` object)
- Test: `npm test` (runs `scripts/validate.mjs` via `npm run check`)

**Interfaces:**

- Consumes: existing `pkg.scripts` object from `package.json`
- Produces: required script keys listed below with exact command strings

Required scripts after this task:

| Key               | Value                                      |
| ----------------- | ------------------------------------------ |
| `stack:up`        | `node scripts/docker.mjs up`               |
| `stack:down`      | `node scripts/docker.mjs down`             |
| `stack:status`    | `node scripts/docker.mjs status`           |
| `stack:build`     | `node scripts/docker.mjs build`            |
| `stack:inference` | `node scripts/docker.mjs switch inference` |
| `stack:rag`       | `node scripts/docker.mjs switch rag`       |
| `stack:media`     | `node scripts/docker.mjs switch media`     |
| `stack:comfy`     | `node scripts/docker.mjs switch comfy`     |

- [ ] **Step 1: Extend the failing validation check**

In `scripts/validate.mjs`, replace the existing script presence loop:

```javascript
for (const script of ["stack", "models", "media", "repos:status"])
  if (!pkg.scripts?.[script]) throw new Error(`Missing npm script: ${script}`);
```

with:

```javascript
const requiredScripts = [
  "stack",
  "stack:doctor",
  "stack:config",
  "stack:up",
  "stack:down",
  "stack:status",
  "stack:build",
  "stack:inference",
  "stack:rag",
  "stack:media",
  "stack:comfy",
  "models",
  "media",
  "repos:status",
];
for (const script of requiredScripts) {
  if (!pkg.scripts?.[script]) throw new Error(`Missing npm script: ${script}`);
}
```

- [ ] **Step 2: Run validation and confirm it fails**

Run: `npm run check`

Expected: FAIL with `Missing npm script: stack:up` (or the first missing alias in the list)

- [ ] **Step 3: Add the aliases to `package.json`**

In `package.json`, keep the existing `scripts` entries and insert the new ones next to the other `stack:*` keys so the block reads:

```json
"scripts": {
  "stack": "node scripts/docker.mjs",
  "stack:doctor": "node scripts/docker.mjs doctor",
  "stack:config": "node scripts/docker.mjs config",
  "stack:up": "node scripts/docker.mjs up",
  "stack:down": "node scripts/docker.mjs down",
  "stack:status": "node scripts/docker.mjs status",
  "stack:build": "node scripts/docker.mjs build",
  "stack:inference": "node scripts/docker.mjs switch inference",
  "stack:rag": "node scripts/docker.mjs switch rag",
  "stack:media": "node scripts/docker.mjs switch media",
  "stack:comfy": "node scripts/docker.mjs switch comfy",
  "models": "node scripts/models.mjs",
  "media": "node scripts/media.mjs",
  "repos:status": "node scripts/repos.mjs status",
  "repos:fetch": "node scripts/repos.mjs fetch",
  "repos:update": "node scripts/repos.mjs update",
  "inventory": "node scripts/inventory.mjs",
  "check": "node scripts/validate.mjs",
  "test:unit": "node --test scripts/paths.test.mjs",
  "test": "npm run check && npm run test:unit"
}
```

Do not change `name`, `private`, `engines`, or other metadata.

- [ ] **Step 4: Run tests and list scripts**

Run:

```powershell
npm test
npm run
```

Expected:

- `npm test` exits 0
- `npm run` output includes `stack:up`, `stack:down`, `stack:status`, `stack:build`, `stack:inference`, `stack:rag`, `stack:media`, `stack:comfy`

Do **not** run `stack:up`, `stack:build`, or profile switch scripts (operational / long-running).

- [ ] **Step 5: Commit on the topic branch**

Confirm branch is not `development` or `main`:

```bash
git branch --show-current
```

Expected: a topic branch (e.g. `docs/stack-npm-script-aliases`)

```bash
git add package.json scripts/validate.mjs
git commit -m "$(cat <<'EOF'
Add stack lifecycle and profile npm script aliases.

EOF
)"
```

---

### Task 2: Document aliases in container operations

**Files:**

- Modify: `docs/container-operations.md` (Daily operations section)
- Skip: `README.md` (quick-start only lists `stack:doctor` / `stack:config`; no lifecycle catalog to extend)

**Interfaces:**

- Consumes: script names and semantics from Task 1 / the design spec
- Produces: operator-facing alias table stating `switch` vs raw `up`

- [ ] **Step 1: Insert an npm aliases subsection under Daily operations**

In `docs/container-operations.md`, immediately after the `## Daily operations` heading and **before** the existing `powershell` command block that starts with `npm run stack`, insert:

```markdown
Convenience aliases (thin wrappers around `scripts/docker.mjs`):

| Script                        | Behavior                                                                  |
| ----------------------------- | ------------------------------------------------------------------------- |
| `npm run stack:up -- PROFILE` | Raw `up` (refuses GPU conflicts unless `--allow-gpu-share`)               |
| `npm run stack:down`          | Stop and remove stack services (`down`, no `--volumes`)                   |
| `npm run stack:status`        | Show Compose status                                                       |
| `npm run stack:build`         | Build all buildable services (optional: `npm run stack:build -- SERVICE`) |
| `npm run stack:inference`     | `switch inference` (stops conflicting GPU services first)                 |
| `npm run stack:rag`           | `switch rag`                                                              |
| `npm run stack:media`         | `switch media`                                                            |
| `npm run stack:comfy`         | `switch comfy`                                                            |

Profile scripts use `switch`. Prefer them on a single-GPU host. Keep using
`npm run stack -- …` for commands without an alias (`pull`, `logs`, `stop`,
`resources`, `backend`, …).
```

Leave the existing daily-operations command block and the rest of the section unchanged.

- [ ] **Step 2: Format maintained Markdown**

Run (from repository root, PowerShell):

```powershell
$docs = (Get-ChildItem docs/*.md | Where-Object Name -ne "inventory.generated.md").FullName
npx --yes prettier@3.6.2 --write README.md $docs
```

Also format the edited file if Prettier did not already cover nested paths:

```powershell
npx --yes prettier@3.6.2 --write docs/container-operations.md
```

- [ ] **Step 3: Verify**

Run:

```powershell
npm test
git diff --check
```

Expected: both succeed; no whitespace errors.

- [ ] **Step 4: Commit on the topic branch**

```bash
git branch --show-current
git add docs/container-operations.md
git commit -m "$(cat <<'EOF'
Document stack npm script aliases in container operations.

EOF
)"
```

Expected branch: not `development` or `main`.

---

## Spec coverage checklist

| Spec requirement                             | Task                           |
| -------------------------------------------- | ------------------------------ |
| Thin package.json aliases                    | Task 1                         |
| `stack:up` / `down` / `status` / `build`     | Task 1                         |
| Profile `switch` scripts                     | Task 1                         |
| Keep `stack`, `stack:doctor`, `stack:config` | Task 1 (unchanged + validated) |
| No `docker.mjs` changes                      | File map / constraints         |
| Docs in container-operations                 | Task 2                         |
| README only if needed                        | Task 2 explicitly skips        |
| `npm test` + script listing                  | Task 1 Step 4, Task 2 Step 3   |
| No operational bring-up                      | Global constraints             |

## Out of scope (do not implement)

- `logs`, `pull`, `resources`, `backend` aliases
- Generating scripts from `config/stack.json`
- Changing GPU exclusivity or Compose files
- Running `up` / `switch` / `build` against a live Docker daemon for this change
