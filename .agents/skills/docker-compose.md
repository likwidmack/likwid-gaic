# Docker and Compose

## Preferred interface

Prefer `scripts/docker.mjs`. It injects canonical fork contexts and storage roots
and appends `compose.cpu.yaml` when the resolved mode is `cpu`.

## Compute modes

- `GAIC_COMPUTE=nvidia` uses the NVIDIA Compose path.
- `GAIC_COMPUTE=cpu` appends `compose.cpu.yaml`.
- Unset or `GAIC_COMPUTE=auto` probes `nvidia-smi`.
- CPU mode allows `inference`, `rag`, and `ollama`.
- CPU mode refuses `media` and `comfy`.

## Single-GPU rule

On a single-GPU host, at most one of these services may hold the GPU:

- `localai`
- `stable-diffusion`
- `comfy-backend`
- `ollama`

`up` refuses GPU conflicts unless `--allow-gpu-share` is passed.

## Safety rules

- Never set `LOCALAI_THREADS` or other LocalAI integer env vars to an empty string.
- Preserve `no-new-privileges:true`.
- Preserve read-only source mounts.
- Preserve health checks.
- Preserve private backend ports.
- Preserve segmented bridges.
- The gateway is the only service allowed to publish host ports.
- Treat Compose files, overrides, Dockerfiles, build contexts, bind mounts,
  device grants, and remote includes as executable trusted input.
- Inspect `npm run stack:config` before `up`.

## GPU declaration

The validated GPU declaration is the Compose Deploy reservation using:

- `driver: nvidia`
- `count: all`
- `capabilities: [gpu]`

CDI (the Container Device Interface) and `gpus: all` are alternatives, not
additions. Do not combine declaration styles without a tested migration.

## Images and rebuilds

- Use reviewed version tags for planned workstation upgrades.
- Use image digests when immutable bytes are required.
- Review each digest update.
- `npm run stack -- pull` refreshes registry-backed, non-buildable services.
- Use direct `docker compose build --pull` only for deliberate base-image refresh.
- Reserve `--no-cache` for clean rebuilds or cache diagnosis.
