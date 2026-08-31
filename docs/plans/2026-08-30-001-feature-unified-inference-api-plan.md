---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
title: Unified inference API - Plan
date: 2026-08-30
---

# Unified inference API - Plan

## Goal Capsule

**Objective:** Give operators and tools one OpenAI-compatible HTTPS entry
(`https://localhost:8443/v1`) for chat/completions against whichever GPU
inference engine is active (LocalAI or Ollama), without merging their
containers.

**Product authority:** likwid-gaic hub owns gateway routing, refresh tooling,
and documentation. LocalAI and Ollama remain separate managed profiles, images,
and fork boundaries.

**Open blockers:** None.

**Not in scope:** Merged `/v1/models` across both engines while both are
stopped; automatic profile switching on model name; weight-format conversion;
PrivateGPT wired to Ollama.

## Product Contract

### Problem

Today LocalAI (`:8443`) and Ollama (`:8448`) expose separate OpenAI-compatible
APIs. Operators who switch between `inference`/`rag` and `ollama` must change
client base URLs. Clients that cache `/v1/models` can show stale model IDs after
a profile switch.

Single-GPU exclusivity remains: at most one of `localai` or `ollama` runs with
GPU access at a time. Unification is at the **gateway and tooling layer**, not
by colocating both runtimes in one container.

### Primary actor

Workstation operator or local tool (IDE, script, smoke test) calling the hub
gateway on loopback.

### Requirements

#### REQ-1: Single primary inference URL

- `https://localhost:8443/v1/*` is the canonical OpenAI-compatible inference
  surface for both LocalAI-backed and Ollama-backed chat when those profiles
  are active.
- When `inference` or `rag` is running, `:8443` serves LocalAI (unchanged
  behavior for existing clients).
- When `ollama` is running (and LocalAI is not), `:8443` serves Ollama.
- `:8448` may remain as a direct Ollama diagnostic/alternate port; docs treat
  it as secondary.

#### REQ-2: Active-engine-only model catalog

- `GET /v1/models` on `:8443` returns only models from the **currently healthy
  upstream** (LocalAI or Ollama).
- No merged catalog listing models from an engine that is not running.
- Responses must not imply both engines are simultaneously available on one GPU
  host.

#### REQ-3: Models refresh feature

**3a — Gateway cache policy**

- Caddy responses for `GET /v1/models` include `Cache-Control: no-store` so
  well-behaved HTTP clients do not reuse stale model lists across engine changes.

**3b — CLI refresh command**

- `npm run stack -- models-refresh` calls `https://localhost:8443/v1/models`
  (respects TLS/dev CA the same way other stack smoke commands do).
- Prints: active engine label (`localai` or `ollama`), model IDs, HTTP status.
- Exits non-zero when the gateway is unreachable, TLS fails, or no healthy
  inference upstream is available.
- Read-only (no container recreate, no model download).

**3c — Switch ergonomics**

- After `npm run stack -- switch` for `inference`, `rag`, or `ollama`, print a
  one-line hint to run `models-refresh` if clients cache model lists.

#### REQ-4: Preserve existing profile policy

- GPU exclusivity, `switch` stop/start behavior, and CPU-mode rules unchanged.
- PrivateGPT continues to use LocalAI over the internal Compose network.

#### REQ-5: Documentation

- Update container operations, architecture, README profile table, and Ollama
  setup for unified `:8443` and `models-refresh`.

### Acceptance examples

| ID   | Given                                                | When                              | Then                                               |
| ---- | ---------------------------------------------------- | --------------------------------- | -------------------------------------------------- |
| AE-1 | `inference` profile up, LocalAI healthy              | `GET :8443/v1/models`             | 200, LocalAI model IDs only                        |
| AE-2 | `ollama` profile up, Ollama healthy, LocalAI stopped | `GET :8443/v1/models`             | 200, Ollama model IDs only                         |
| AE-3 | Neither inference engine running                     | `GET :8443/v1/models`             | Gateway error (502/503), not wrong engine's models |
| AE-4 | After switch to `ollama`                             | `npm run stack -- models-refresh` | Prints `ollama` and current tags                   |
| AE-5 | `/v1/models` response                                | Inspect headers                   | `Cache-Control: no-store` present                  |
| AE-6 | `rag` profile up                                     | PrivateGPT chat                   | Still uses internal LocalAI URL; no regression     |

## Key technical decisions (KTD)

| ID    | Decision                                                            | Rationale                                                                 |
| ----- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| KTD-1 | Do not merge containers                                             | Preserves fork boundaries and GPU exclusivity                             |
| KTD-2 | Unify at Caddy `:8443` via `(inference_upstream)` snippet           | Reuses `bridge_upstream`; minimal new moving parts                        |
| KTD-3 | LocalAI primary + `handle_errors` fallback to Ollama                | Caddy 2.11 shares one `health_uri` per handler; separate paths per engine |
| KTD-4 | LocalAI health `/readyz`; Ollama health `/api/tags`                 | Matches existing single-upstream routes on `:8443` and `:8448`            |
| KTD-5 | `Cache-Control: no-store` scoped to `/v1/models*` on `:8443`        | Avoids interfering with streaming chat on other `/v1/*` paths             |
| KTD-6 | Parse/ infer helpers in `stack-policy.mjs`; command in `docker.mjs` | Keeps Docker I/O in runner; pure functions unit-tested                    |
| KTD-7 | Keep `:8448` as secondary Ollama port                               | Low-risk debugging path unchanged                                         |

## Implementation units

### U1 — Caddy dual upstream (`docker/Caddyfile`)

- [x] Add `(inference_upstream)` snippet: LocalAI `reverse_proxy` with
      `/readyz`, Ollama fallback via `handle_errors` and `/api/tags`.
- [x] Apply snippet to `:8443`; add `handle /v1/models*` with
      `Cache-Control: no-store`.
- [x] Leave `:8444`–`:8448` routes unchanged.

**Verify:** `MSYS_NO_PATHCONV=1 docker run … caddy validate` (or
`npm run stack:config` after gateway mount exists); manual switch between
`inference` and `ollama` on a GPU host.

### U2 — `models-refresh` CLI (`scripts/docker.mjs`, `scripts/stack-policy.mjs`)

- [x] `gatewayModelsUrl`, `parseGatewayModelIds`, `inferActiveEngine` in
      `stack-policy.mjs`.
- [x] `models-refresh` command: `curl -kfsS` probe, print engine/models/status,
      exit non-zero on failure.
- [x] `printModelsRefreshHint` after successful `switch` for `inference`, `rag`,
      `ollama`.

**Verify:** `npm run stack -- models-refresh` with inference up; repeat after
`switch ollama` (requires trusted dev CA or `-k` parity).

### U3 — Validation and tests

- [x] `scripts/validate.mjs`: assert `:8443` dual upstream, health paths,
      `no-store`, `models-refresh` wiring.
- [x] `scripts/cli-policy.test.mjs`: URL builder, JSON parse, engine inference.

**Verify:** `npm test`.

### U4 — Documentation

- [x] `docs/container-operations.md` — unified URL, refresh command, switch hint.
- [x] `docs/ollama-docker-setup.md` — `:8443` primary, `:8448` secondary.
- [x] `docs/architecture.md` — gateway routing note.
- [x] `README.md` — profiles table and npm scripts.

**Verify:** `npm test` (Markdown link check); Prettier on maintained Markdown.

## Verification checklist

```powershell
npm test
npm run stack:config
git diff --check
node --check scripts/docker.mjs
node --check scripts/stack-policy.mjs
node --check scripts/validate.mjs
```

Manual (workstation with trusted Caddy CA):

1. `npm run stack -- switch inference` → `npm run stack -- models-refresh` → LocalAI IDs.
2. `npm run stack -- switch ollama` → `models-refresh` → Ollama IDs (same `:8443` URL).
3. `curl -kI https://localhost:8443/v1/models` → `Cache-Control: no-store`.

## Success criteria

- One documented inference URL for operators.
- Profile switch + refresh yields correct model list without changing client port.
- CI/validation covers Caddy config and refresh parsing without live GPU.
