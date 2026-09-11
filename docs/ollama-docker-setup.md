# Ollama Docker setup

This repository optionally runs [Ollama](https://ollama.com/) as a fifth Compose
profile. Ollama is **not** part of first-run setup. LocalAI remains the default
OpenAI-compatible engine for `inference` and `rag`. Use Ollama when you want the
Ollama library and `ollama pull` workflow alongside the hub's Hugging Face pins.

For lifecycle commands, GPU switching, and HTTPS trust, see
[Container operations](container-operations.md). For single-GPU rules, see
[GPU and CPU resource utilization](resource-utilization.md).

## Requirements

- Docker Desktop or Docker Engine with Compose v2
- Unset, `GAIC_COMPUTE=auto`, or pinned `nvidia`/`cpu` (auto-detect probes host
  `nvidia-smi`; failure resolves to `cpu`)
- Shared model root at `MODEL_ROOT` (from `config/storage.json`: `C:\gaic\models` on
  the reference Windows workstation, `/mnt/c/gaic/models` in WSL,
  `~/gaic/models` on macOS/Linux). Every stack engine stores weights under this
  tree; Ollama mounts it as `/root/.ollama` and writes `blobs/`, `manifests/`,
  and related library files next to `localai/`, `Stable-diffusion/`,
  `checkpoints/`, and the other catalog directories.

On CPU hosts, `compose.cpu.yaml` clears NVIDIA device reservations for Ollama.
Use smaller models for acceptable latency. On NVIDIA hosts, Ollama still
participates in single-GPU exclusivity with LocalAI, Stable Diffusion, and Comfy
(see [GPU and CPU resource utilization](resource-utilization.md)).

Ollama weights use Ollama's blob format. They do not appear in
`config/models.json` or LocalAI YAML under `localai/`.

## Profile summary

| Item       | Value                                                                              |
| ---------- | ---------------------------------------------------------------------------------- |
| Profile    | `ollama`                                                                           |
| Service    | `ollama` (built image `gaic/ollama:local`, base `ollama/ollama`)                   |
| HTTPS      | `https://localhost:8443` (unified OpenAI `/v1`), `https://localhost:8448` (direct) |
| Native API | `/api/*` and OpenAI-compatible `/v1/*`                                             |
| GPU        | Optional — exclusive with LocalAI, SD, Comfy when `GAIC_COMPUTE=nvidia`            |
| PrivateGPT | Not wired to Ollama in this hub                                                    |

## Start Ollama

On a single-GPU host, switch away from LocalAI, Stable Diffusion, or Comfy
before starting Ollama:

```powershell
npm run stack -- switch ollama
```

Alias:

```powershell
npm run stack:ollama
```

Verify readiness (blob directory present; zero pulled models is OK):

```powershell
npm run models -- ready ollama
```

Trust the Caddy development CA if you have not already (see
[Container operations](container-operations.md#trusting-the-local-https-certificate)).

## Pull and inspect models

Pull library models into the container (requires the `ollama` profile running):

```powershell
npm run ollama -- pull llama3.2
npm run ollama -- list
npm run ollama -- status
```

Blobs persist under the shared model root `MODEL_ROOT` (see `config/storage.json`).

## API access

**Primary (unified inference URL):** point OpenAI clients at
`https://localhost:8443/v1` after `npm run stack -- switch ollama`. The gateway
forwards to Ollama when LocalAI is not running.

**Secondary (direct Ollama):** engine-specific debugging on `:8448`.

Through the gateway (recommended from the host):

```powershell
curl -k https://localhost:8443/v1/models
npm run stack -- models-refresh
curl -k https://localhost:8448/api/tags
```

Ollama serves both its native API and an OpenAI-compatible surface on the same
port inside the container. Switch back with `npm run stack -- switch inference`
or `npm run stack:rag` when you need LocalAI or PrivateGPT again, then run
`npm run stack -- models-refresh`.

## Image and storage

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

## GPU and memory tuning

Compose sets these Ollama environment variables with single-GPU-workstation
defaults, overridable in `.env` (see [GPU and CPU resource
utilization](resource-utilization.md#compose-environment-variables) for the
full tuning table):

| Variable                   | Default | Effect                                                                                                      |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `OLLAMA_MAX_LOADED_MODELS` | `1`     | Keeps only one model resident in VRAM, avoiding contention with a second large model                        |
| `OLLAMA_NUM_PARALLEL`      | `1`     | Limits concurrent request slots; each slot adds its own KV-cache allocation                                 |
| `OLLAMA_FLASH_ATTENTION`   | `1`     | Enables flash attention on supported NVIDIA GPUs, reducing attention memory                                 |
| `OLLAMA_KV_CACHE_TYPE`     | `q8_0`  | Quantizes the KV cache to roughly halve context memory versus `f16`, with minor quality impact              |
| `OLLAMA_KEEP_ALIVE`        | `5m`    | How long an idle model stays loaded; lower it (e.g. `0`) to free VRAM immediately before switching profiles |

These defaults assume the same single-GPU, one-model-at-a-time posture as the
rest of this hub's GPU-exclusive switching. Raise `OLLAMA_NUM_PARALLEL` or
`OLLAMA_MAX_LOADED_MODELS` only when `npm run stack -- resources` shows spare
VRAM after loading your usual model; set `OLLAMA_KV_CACHE_TYPE=f16` if you hit
quality regressions on long-context workloads and have the VRAM to spare.

## Host helpers (optional)

Optional scripts under [`scripts/host-ollama/`](../scripts/host-ollama/) create
GPU-tuned Modelfile variants against a **host-installed** Ollama binary. Prefer
`npm run stack -- switch ollama` for day-to-day use.

Use the npm wrapper so GPU preflight and storage alignment run first:

```powershell
npm run ollama:host -- create -m llama3.1 -v 8b
npm run ollama:host -- serve
```

Important caveats:

- `npm run ollama:host` refuses when Compose GPU-exclusive services are running
  (unless `--allow-gpu-share` or `GAIC_GPU_EXCLUSIVE=false`). Direct `.sh`
  invocation skips that check.
- The wrapper sets `OLLAMA_MODELS` from hub `MODEL_ROOT` when unset so host and
  Compose can share blobs. Host `serve` still listens on loopback `:11434` and
  does **not** replace gateway `:8443` / `:8448`.
- See [scripts/host-ollama/README.md](../scripts/host-ollama/README.md) and
  [host-tuning.md](../scripts/host-ollama/host-tuning.md).

## Troubleshooting

- **Slow on CPU:** Prefer smaller models (for example `llama3.2`) or set
  `GAIC_COMPUTE=nvidia` on a CUDA workstation for GPU acceleration.
- **GPU conflict (NVIDIA hosts):** Run `npm run stack -- switch ollama` so
  conflicting GPU services stop first, or pass `--allow-gpu-share` only when you
  accept VRAM contention. `npm run ollama:host` refuses the same way when a
  Compose GPU service is already up.
- **`pull` fails with "not running":** Start the profile before pulling.
- **502 on 8448 after recreate:** Restart or recreate the gateway if Caddy has a
  stale upstream dial (see [Troubleshooting](troubleshooting.md)).

## Related guides

- [LocalAI Docker setup](localai-docker-setup.md) — default inference engine
- [Models and managed media](models.md) — Hugging Face pins and LocalAI YAML
- [Network security](network-security.md) — loopback gateway and bridges
- [Host Ollama helpers](../scripts/host-ollama/README.md) — optional host-native scripts
