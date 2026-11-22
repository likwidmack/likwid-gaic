---
name: gaic-stack-ops
description: Docker and Compose rules for the likwid-gaic stack. USE WHEN editing compose.yaml, compose.cpu.yaml, Dockerfiles, .env.example, or config/stack.json, running npm run stack commands, switching GPU profiles, or changing GPU, port, or bind-address settings.
---

# gaic Docker and Compose operations

- Prefer `npm run stack -- ...`; `scripts/docker.mjs` injects canonical fork
  contexts and storage roots and appends `compose.cpu.yaml` when resolved mode is
  `cpu`. In CPU mode `inference`, `rag`, and `ollama` are allowed; `media` and
  `comfy` require `nvidia`.
- On a single-GPU host, at most one of `localai`, `stable-diffusion`,
  `comfy-backend`, or `ollama` may run. Use `npm run stack -- switch PROFILE` to stop
  conflicting GPU services before starting another profile. `up` refuses GPU
  conflicts unless `--allow-gpu-share` is passed. See
  [docs/resource-utilization.md](../../../docs/resource-utilization.md).
- `npm run stack -- resources` is a read-only GPU and service snapshot.
- `npm run gpu:cap-power` (without `--dry-run`) writes host GPU power state
  via `nvidia-smi -pl`. It affects the whole physical GPU, not a container,
  and must never be run by an agent without the user's explicit,
  in-the-moment consent. `nvidia-smi --query-gpu=...` reads and
  `npm run gpu:cap-power -- --dry-run` are always safe.
- Never set `LOCALAI_THREADS` (or other LocalAI integer env vars) to an empty
  string in Compose; LocalAI exits on `LOCALAI_THREADS=""`.
- Caddy is the only service allowed to publish host ports. The default bind
  address is `127.0.0.1`; do not broaden it without hostname, certificate,
  authentication, firewall, and rollback planning.
- Preserve `no-new-privileges:true`, read-only source mounts, health checks,
  private backend ports, and segmented bridges.
- The validated GPU declaration is the Compose Deploy reservation using
  `driver: nvidia`, `count: all`, and `capabilities: [gpu]`. CDI and
  `gpus: all` are alternatives, not additions. Do not combine declaration
  styles without a tested migration.
- Use reviewed version tags for planned workstation upgrades. Use image digests
  when immutable bytes are required, and review each digest update.
- `npm run stack -- pull` refreshes registry-backed, non-buildable services.
  Use direct `docker compose build --pull` with the ignored `.env` only for
  a deliberate base-image refresh. Reserve `--no-cache` for clean rebuilds or
  cache diagnosis.
- Treat Compose files, overrides, Dockerfiles, build contexts, bind mounts,
  device grants, and remote includes as executable trusted input. Inspect
  `npm run stack:config` before `up`.
- Prefer service-scoped Compose secrets when an application supports file-based
  credentials. Otherwise inject environment-only secrets from a protected
  process or operating-system secret store. Never commit or print credentials.
- Never add automatic volume deletion, `docker system prune`, or destructive
  cleanup to repository scripts.
- Rendering configuration does not update a running container. Do not recreate,
  pull, build, or restart services unless the user requests an operational
  change.

Related skills: `gaic-first-run`, `gaic-validation`.
