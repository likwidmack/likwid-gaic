# Ollama custom container

## Goal

Give `ollama` the same custom-built-image treatment the other four backends
(`private-gpt`, `stable-diffusion`, `comfy-backend`, `comfy-frontend`) already
get, primarily to fix a documented papercut: the official `ollama/ollama`
image ships no `curl`, so its healthcheck and future HTTP probing can't match
the pattern used everywhere else in this hub (`curl -fsS http://.../...`).

## Current state

- `compose.yaml`'s `ollama` service uses the registry image directly
  (`image: ${OLLAMA_IMAGE:-ollama/ollama:0.32.6}`), with no `build:` block.
- Its healthcheck is `["CMD", "ollama", "list"]` — a CLI-based check, called
  out in `docs/ollama-docker-setup.md` as a workaround for missing `curl`.
- `config/stack.json`'s `ollama` service entry has no `repository` field
  (unlike the four built services, which point at a forked source repo).
- `scripts/docker.mjs`'s `build` command refuses to build any service whose
  `config/stack.json` entry lacks `repository`:
  `if (!metadata.repository) throw new Error('Service "..." uses a registry
  image; use npm run stack -- pull instead of build.')`. Adding a `build:`
  block to `ollama` in Compose without also fixing this guard would leave
  `npm run stack -- build ollama` broken.

## Decisions (approved)

| Decision | Choice |
| -------- | ------ |
| Base image | Official `ollama/ollama` image, pinned via existing `OLLAMA_IMAGE` build arg (no vendored source, no fork needed) |
| What the Dockerfile adds | `curl` only, via `apt-get` (Ollama's image is Ubuntu-based) |
| Compose `image:` | `gaic/ollama:local`, matching the `gaic/<service>:local` convention used by the other four built services |
| Healthcheck | `curl -fsS http://127.0.0.1:11434/api/tags` — matches LocalAI's HTTP-healthcheck style and the `/api/tags` path `stack-policy.mjs`'s `gatewayProbeTargets` already probes externally |
| Buildability guard | `scripts/docker.mjs`'s `build` command guard changes from "has `repository`" to a new explicit `buildable` flag, since Ollama's build context needs no external fork — `repository` stays reserved for services that pull source from a managed fork |
| `config/stack.json` schema | Add `"buildable": true` to the `ollama` service entry; the four fork-built services also get `"buildable": true` (explicit rather than inferred from `repository` presence, so future registry-only services default safely to unbuildable) |
| Entrypoint/CMD | Unchanged — inherited from the base image |

## File map

| File | Responsibility |
| ---- | --------------- |
| `docker/ollama.Dockerfile` | New. `FROM` the pinned Ollama image, installs `curl` |
| `compose.yaml` | `ollama` service gains `build:`, `image: gaic/ollama:local`, curl-based healthcheck |
| `config/stack.json` | `buildable: true` on `ollama` and the four existing built services |
| `scripts/stack-policy.mjs` | New pure helper `isBuildableService(metadata)` |
| `scripts/cli-policy.test.mjs` | Unit tests for `isBuildableService` |
| `scripts/docker.mjs` | `build` command uses `isBuildableService` instead of checking `repository` directly |
| `scripts/validate.mjs` | Assert the `ollama` Compose block has a `build:` key and the curl healthcheck |
| `docs/ollama-docker-setup.md` | Update "Image and storage" section: built image, new healthcheck, `npm run stack -- build ollama` |

## Non-goals

- Baking model pre-pull automation into the image (stays a separate, later
  enhancement — this plan only fixes the container/healthcheck gap)
- Changing the Ollama entrypoint, CMD, or exposed API surface
- Multi-arch image builds
