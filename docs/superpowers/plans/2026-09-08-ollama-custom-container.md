# Ollama Custom Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `ollama` from a small custom Dockerfile (adds `curl` to the official image) instead of running the registry image directly, switch its healthcheck to an HTTP probe, and make `npm run stack -- build ollama` work.

**Architecture:** `docker/ollama.Dockerfile` layers `curl` onto the pinned `OLLAMA_IMAGE`. `compose.yaml`'s `ollama` service gains a `build:` block and `image: gaic/ollama:local`. A new pure helper `isBuildableService` in `scripts/stack-policy.mjs` replaces the `repository`-presence check in `scripts/docker.mjs`'s `build` command, driven by a new `buildable` flag in `config/stack.json`.

**Tech Stack:** Docker/Compose, Node.js (`node:test`), existing `scripts/validate.mjs` string-assertion style.

**Spec:** [docs/superpowers/specs/2026-09-08-ollama-custom-container-design.md](../specs/2026-09-08-ollama-custom-container-design.md)

## Global Constraints

- Base image stays the pinned `OLLAMA_IMAGE` build arg — no change to which Ollama version ships by default (`ollama/ollama:0.32.6`)
- `curl` is the only thing the Dockerfile adds; no entrypoint/CMD changes
- New Compose `image:` value: `gaic/ollama:local`
- New healthcheck: `["CMD", "curl", "-fsS", "http://127.0.0.1:11434/api/tags"]`
- `repository` in `config/stack.json` stays reserved for fork-sourced builds; buildability is now its own explicit `buildable: true` flag
- Verify with `npm test`; do not start/stop/recreate Docker services during automated verification — the final manual smoke step is the only place real containers run

## File map

| File | Responsibility |
| ---- | --------------- |
| `docker/ollama.Dockerfile` | New: `FROM ${OLLAMA_IMAGE}`, installs `curl` |
| `compose.yaml` | `ollama` service: `build:`, `image:`, healthcheck |
| `config/stack.json` | `buildable: true` on `ollama` + the four existing built services |
| `scripts/stack-policy.mjs` | New `isBuildableService(metadata)` |
| `scripts/cli-policy.test.mjs` | Tests for `isBuildableService` |
| `scripts/docker.mjs` | `build` command consumes `isBuildableService` |
| `scripts/validate.mjs` | Assert `ollama` has `build:` and the curl healthcheck |
| `docs/ollama-docker-setup.md` | Describe the built image and `build ollama` |

---

### Task 1: `isBuildableService` policy helper

**Files:**

- Modify: `scripts/stack-policy.mjs`
- Test: `scripts/cli-policy.test.mjs`

**Interfaces:**

- Consumes: nothing new
- Produces: `isBuildableService(metadata)` → `boolean`, exported from `scripts/stack-policy.mjs`

- [ ] **Step 1: Write the failing test**

Add to `scripts/cli-policy.test.mjs` (near the other `stack-policy.mjs` import/tests — add `isBuildableService` to the existing `import { ... } from "./stack-policy.mjs"` block):

```js
it("treats buildable as an explicit flag, not repository presence", () => {
  assert.equal(isBuildableService({ buildable: true }), true);
  assert.equal(isBuildableService({ buildable: true, repository: "LocalAI-Prt" }), true);
  assert.equal(isBuildableService({ repository: "LocalAI-Prt" }), false);
  assert.equal(isBuildableService({}), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/cli-policy.test.mjs`
Expected: FAIL — `isBuildableService is not a function` (not yet imported/exported)

- [ ] **Step 3: Implement the helper**

Add to `scripts/stack-policy.mjs` (near the other small pure predicates, e.g. next to `gpuServicesForProfile`):

```js
export function isBuildableService(metadata) {
  return metadata?.buildable === true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/cli-policy.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/stack-policy.mjs scripts/cli-policy.test.mjs
git commit -m "feat: add isBuildableService stack-policy helper"
```

---

### Task 2: `docker/ollama.Dockerfile`

**Files:**

- Create: `docker/ollama.Dockerfile`

**Interfaces:**

- Consumes: `OLLAMA_IMAGE` build arg (already defined as a Compose env var, default `ollama/ollama:0.32.6`)
- Produces: an image with `curl` installed, otherwise identical to the base

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1.19
ARG OLLAMA_IMAGE=ollama/ollama:0.32.6
FROM ${OLLAMA_IMAGE}

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Commit**

```bash
git add docker/ollama.Dockerfile
git commit -m "feat: add docker/ollama.Dockerfile with curl"
```

(No automated test here — Docker build correctness is verified in Task 6's manual smoke step, consistent with how the other Dockerfiles in this hub are handled.)

---

### Task 3: Wire the build into `compose.yaml` and `config/stack.json`

**Files:**

- Modify: `compose.yaml:321-352` (the `ollama` service block)
- Modify: `config/stack.json` (`services` array)

**Interfaces:**

- Consumes: `docker/ollama.Dockerfile` from Task 2
- Produces: an `ollama` Compose service buildable the same way `stable-diffusion`/`comfy-backend` are

- [ ] **Step 1: Update the `ollama` service in `compose.yaml`**

Replace:

```yaml
  ollama:
    <<: *security-defaults
    profiles: ["ollama"]
    image: ${OLLAMA_IMAGE:-ollama/ollama:0.32.6}
    init: true
    restart: unless-stopped
    # Official ollama/ollama images do not ship curl; use the CLI for health.
    healthcheck:
      test: ["CMD", "ollama", "list"]
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 30s
```

With:

```yaml
  ollama:
    <<: *security-defaults
    profiles: ["ollama"]
    image: gaic/ollama:local
    build:
      context: ${HUB_CONTEXT:-.}
      dockerfile: docker/ollama.Dockerfile
      args:
        OLLAMA_IMAGE: ${OLLAMA_IMAGE:-ollama/ollama:0.32.6}
    init: true
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://127.0.0.1:11434/api/tags"]
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 30s
```

- [ ] **Step 2: Add `buildable: true` in `config/stack.json`**

The `services` array currently has (no `buildable` field on any entry):

```json
{"name": "localai", "profile": "inference", "repository": "LocalAI-Prt", "url": "https://localhost:8443"},
{"name": "private-gpt", "profile": "rag", "repository": "private-gpt-tm", "url": "https://localhost:8444"},
{"name": "stable-diffusion", "profile": "media", "repository": "stable-diffusion-ui", "url": "https://localhost:8445"},
{"name": "comfy-backend", "profile": "comfy", "repository": "ComfyUI", "url": "https://localhost:8447"},
{"name": "comfy-frontend", "profile": "comfy", "repository": "ComfyUI_frontend", "url": "https://localhost:8446"},
{"name": "ollama", "profile": "ollama", "url": "https://localhost:8448"}
```

`localai` has no `build:` block in Compose (it uses a registry image), so it
stays non-buildable. Update the other five entries:

```json
{"name": "localai", "profile": "inference", "repository": "LocalAI-Prt", "url": "https://localhost:8443"},
{"name": "private-gpt", "profile": "rag", "repository": "private-gpt-tm", "url": "https://localhost:8444", "buildable": true},
{"name": "stable-diffusion", "profile": "media", "repository": "stable-diffusion-ui", "url": "https://localhost:8445", "buildable": true},
{"name": "comfy-backend", "profile": "comfy", "repository": "ComfyUI", "url": "https://localhost:8447", "buildable": true},
{"name": "comfy-frontend", "profile": "comfy", "repository": "ComfyUI_frontend", "url": "https://localhost:8446", "buildable": true},
{"name": "ollama", "profile": "ollama", "url": "https://localhost:8448", "buildable": true}
```

- [ ] **Step 3: Commit**

```bash
git add compose.yaml config/stack.json
git commit -m "feat: build ollama from docker/ollama.Dockerfile"
```

---

### Task 4: Update the `build` command to use `isBuildableService`

**Files:**

- Modify: `scripts/docker.mjs` (the `build` command, currently around line 466)

**Interfaces:**

- Consumes: `isBuildableService` from Task 1
- Produces: `npm run stack -- build ollama` no longer throws the registry-image error

- [ ] **Step 1: Import the helper**

In `scripts/docker.mjs`, add `isBuildableService` to the existing `import { ... } from "./stack-policy.mjs"` block.

- [ ] **Step 2: Replace the guard**

Replace:

```js
    if (!metadata.repository) {
      throw new Error(`Service "${service}" uses a registry image; use \`npm run stack -- pull\` instead of build.`);
    }
```

With:

```js
    if (!isBuildableService(metadata)) {
      throw new Error(`Service "${service}" uses a registry image; use \`npm run stack -- pull\` instead of build.`);
    }
```

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS (51+ existing tests plus Task 1's new test)

- [ ] **Step 4: Commit**

```bash
git add scripts/docker.mjs
git commit -m "refactor: drive build-eligibility from isBuildableService"
```

---

### Task 5: Validator coverage for the new Ollama container

**Files:**

- Modify: `scripts/validate.mjs` (near the existing `ollamaBlock` scoped assertion added for GPU/memory tuning)

**Interfaces:**

- Consumes: the `ollamaBlock` slice already computed in `scripts/validate.mjs` (`compose.slice(compose.indexOf("\n  ollama:"), compose.indexOf("\nnetworks:"))`)
- Produces: two new hard failures if the built image or curl healthcheck regress

- [ ] **Step 1: Add the assertions**

Immediately after the existing `if (!ollamaBlock.includes("driver: nvidia")) throw ...` line, add:

```js
if (!ollamaBlock.includes("dockerfile: docker/ollama.Dockerfile")) throw new Error("Ollama must build from docker/ollama.Dockerfile");
if (!ollamaBlock.includes("curl") || !ollamaBlock.includes("api/tags")) throw new Error("Ollama healthcheck must use the curl-based /api/tags probe");
```

- [ ] **Step 2: Run the validator**

Run: `node scripts/validate.mjs`
Expected: `Configuration is valid.` / `Storage, model, media, and Compose configuration is valid.`

- [ ] **Step 3: Regression-check the assertions**

Temporarily remove the `dockerfile: docker/ollama.Dockerfile` line from `compose.yaml`, confirm `node scripts/validate.mjs` fails with the new error message, then restore the line (`git checkout -- compose.yaml` if no other uncommitted changes are present, or re-add the line manually) and confirm it passes again.

- [ ] **Step 4: Commit**

```bash
git add scripts/validate.mjs
git commit -m "test: assert ollama builds from docker/ollama.Dockerfile"
```

---

### Task 6: Docs and manual smoke verification

**Files:**

- Modify: `docs/ollama-docker-setup.md` ("Image and storage" section)

**Interfaces:**

- Consumes: nothing
- Produces: accurate docs; a manually-verified working container

- [ ] **Step 1: Update the docs**

In `docs/ollama-docker-setup.md`, replace:

```markdown
- Default image: `ollama/ollama:0.32.6` (override with `OLLAMA_IMAGE` in `.env`)
- Host port: `OLLAMA_HTTPS_PORT` (default `8448`)
- Blob root: `MODEL_ROOT` → `/root/.ollama` in the container (npm runner resolves
  `pathWindows` / `pathWsl` / `pathPosix` from `config/storage.json`)

This whole-root read-write mount is the deliberate exception to the read-only
shared model mounts, because Ollama manages its own blob store in place.

The service uses the same NVIDIA Compose deploy reservation as LocalAI
(`driver: nvidia`, `count: all`, `capabilities: [gpu]`). Health checks use
`ollama list` because the official image does not ship `curl`.
```

With:

```markdown
- Built from `docker/ollama.Dockerfile`, which layers `curl` onto the pinned
  base image (override the base with `OLLAMA_IMAGE` in `.env`, default
  `ollama/ollama:0.32.6`). Rebuild after changing `OLLAMA_IMAGE` with
  `npm run stack -- build ollama`.
- Host port: `OLLAMA_HTTPS_PORT` (default `8448`)
- Blob root: `MODEL_ROOT` → `/root/.ollama` in the container (npm runner resolves
  `pathWindows` / `pathWsl` / `pathPosix` from `config/storage.json`)

This whole-root read-write mount is the deliberate exception to the read-only
shared model mounts, because Ollama manages its own blob store in place.

The service uses the same NVIDIA Compose deploy reservation as LocalAI
(`driver: nvidia`, `count: all`, `capabilities: [gpu]`). Health checks curl
`http://127.0.0.1:11434/api/tags`, matching LocalAI's HTTP-based healthcheck
style now that the image carries `curl`.
```

- [ ] **Step 2: Manual smoke test (NVIDIA workstation only)**

```powershell
npm run stack -- build ollama
npm run stack -- switch ollama
npm run stack -- resources
```

Expected: build succeeds; `docker compose ps` (inside `resources` output)
shows `ollama` healthy within ~30s; `npm run ollama -- status` reports the
gateway URL responding.

- [ ] **Step 3: Commit**

```bash
git add docs/ollama-docker-setup.md
git commit -m "docs: describe the built Ollama image and curl healthcheck"
```
