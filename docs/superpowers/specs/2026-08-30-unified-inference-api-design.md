# Unified inference API (gateway + models refresh)

## Goal

Expose one OpenAI-compatible HTTPS entry at `https://localhost:8443/v1` for
whichever GPU inference engine is active (LocalAI or Ollama), without merging
their containers. Add operator tooling to refresh and inspect `/v1/models`
after profile switches.

## Decisions (approved)

| Decision              | Choice                                                                |
| --------------------- | --------------------------------------------------------------------- |
| Container integration | **No** — keep `localai` and `ollama` as separate Compose services     |
| Unification layer     | **Caddy** on existing `:8443` listener                                |
| `/v1/models` catalog  | **Active engine only** — no merged list across stopped engines        |
| Secondary Ollama port | Keep `:8448` for direct access / debugging                            |
| GPU exclusivity       | Unchanged — one of `localai`, `ollama`, SD, Comfy at a time on NVIDIA |
| PrivateGPT            | Stays on internal `http://localai:8080/v1`; out of scope              |
| Models refresh        | **CLI** + **Cache-Control: no-store** on gateway `/v1/models`         |

## Architecture

```text
Client / tool
    │
    ▼
https://localhost:8443/v1/*     ← canonical inference URL
    │
    ▼
Caddy (gateway)
    │  health-checked reverse_proxy
    ├─► localai:8080     (when inference/rag profile)
    └─► ollama:11434    (when ollama profile)
```

Only one upstream is healthy at a time on a single-GPU workstation. Caddy
selects the healthy backend; the other is absent or failing health checks.

`:8448` continues to proxy Ollama directly for operators who want an
engine-specific URL without changing `:8443` behavior.

## Caddy behavior

### Unified `:8443` upstream

Replace the single `reverse_proxy localai:8080` block with a multi-upstream
configuration:

- Upstream A: `localai:8080` — health URI `/readyz` (existing)
- Upstream B: `ollama:11434` — health URI `/api/tags` (existing on `:8448`)

Use Caddy active health checks so only the running service receives traffic.
When both are down, `:8443` returns gateway error (502/503), not a stale
catalog from the wrong engine.

### Cache headers for model catalog

For responses from `/v1/models` (match path prefix in Caddy):

```caddy
header Cache-Control "no-store"
```

Apply at the `:8443` site so clients and proxies do not cache model lists
across profile switches. Optional extension to all `/v1/*` is acceptable if
it does not break streaming chat responses; prefer scoping to `/v1/models` first.

## Models refresh feature

### CLI: `npm run stack -- models-refresh`

Implement in `scripts/docker.mjs` (alongside `resources`, `doctor`):

1. Resolve gateway URL `https://localhost:8443/v1/models` (honor
   `GATEWAY_HOSTNAME` / port env if already used elsewhere).
2. Fetch with same TLS behavior as other stack HTTPS probes (dev CA).
3. Infer active engine:
   - Prefer which container is running (`localai` vs `ollama` from compose ps).
   - Cross-check response shape if useful (Ollama vs LocalAI JSON differences).
4. Print:
   - `Active engine: localai|ollama|none`
   - Model IDs (one per line or compact table)
   - Gateway HTTP status
5. Exit code 0 on success; non-zero if unreachable or no engine up.

Read-only — no `pull`, no `switch`, no container recreate.

### Switch hint

After successful `switch` to `inference`, `rag`, or `ollama`, print:

```text
Tip: run `npm run stack -- models-refresh` before pointing clients at /v1/models.
```

Optional one-line print is enough; automatic refresh on every switch is not
required (avoids extra HTTPS noise on scripted switches).

## Operator flows

| Step | Action                                             |
| ---- | -------------------------------------------------- |
| 1    | `npm run stack -- switch ollama` (or `inference`)  |
| 2    | `npm run stack -- models-refresh`                  |
| 3    | Point OpenAI client at `https://localhost:8443/v1` |

## Documentation updates

- `docs/container-operations.md` — unified URL, refresh command, switch hint
- `docs/ollama-docker-setup.md` — `:8443` primary, `:8448` secondary
- `docs/architecture.md` — gateway diagram note
- `README.md` — profiles / npm scripts table
- `docs/README.md` — index link if new section warrants it

## Validation

- `scripts/validate.mjs` — assert Caddy `:8443` references both upstreams and
  `Cache-Control` or `/v1/models` header snippet
- Unit test for refresh output parsing if logic is extracted (optional)
- `npm test`, `npm run stack:config` after Compose/Caddy changes

## Non-goals

- Merged `/v1/models` listing LocalAI + Ollama names while both are stopped
- `?refresh=1` query param unless both engines natively support it (defer)
- Hub model-router sidecar (future if merged catalog is needed)
- Weight sharing between GGUF and Ollama blob formats

## Implementation sequence (for planning)

1. Caddy dual-upstream + `/v1/models` cache header
2. `models-refresh` in `docker.mjs`
3. Switch hint + docs
4. Validation/tests
