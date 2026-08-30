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
- Unset, `FORKEDAI_COMPUTE=auto`, or pinned `nvidia`/`cpu` (auto-detect probes host
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

| Item       | Value                                                                       |
| ---------- | --------------------------------------------------------------------------- |
| Profile    | `ollama`                                                                    |
| Service    | `ollama` (registry image `ollama/ollama`)                                   |
| HTTPS      | `https://localhost:8448`                                                    |
| Native API | `/api/*` and OpenAI-compatible `/v1/*`                                      |
| GPU        | Optional — exclusive with LocalAI, SD, Comfy when `FORKEDAI_COMPUTE=nvidia` |
| PrivateGPT | Not wired to Ollama in this hub                                             |

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

Through the gateway (recommended from the host):

```powershell
curl -k https://localhost:8448/api/tags
```

bash (macOS/Linux or WSL):

```bash
curl -k https://localhost:8448/api/tags
```

Ollama serves both its native API and an OpenAI-compatible surface on the same
port inside the container; Caddy forwards all paths to `ollama:11434`.

While the `ollama` profile holds the GPU, `https://localhost:8443` (LocalAI) is
not serving. Switch back with `npm run stack -- switch inference` or
`npm run stack:rag` when you need LocalAI or PrivateGPT again.

## Image and storage

- Default image: `ollama/ollama:0.32.6` (override with `OLLAMA_IMAGE` in `.env`)
- Host port: `OLLAMA_HTTPS_PORT` (default `8448`)
- Blob root: `MODEL_ROOT` → `/root/.ollama` in the container (npm runner resolves
  `pathWindows` / `pathWsl` / `pathPosix` from `config/storage.json`)

This whole-root read-write mount is the deliberate exception to the read-only
shared model mounts, because Ollama manages its own blob store in place.

The service uses the same NVIDIA Compose deploy reservation as LocalAI
(`driver: nvidia`, `count: all`, `capabilities: [gpu]`). Health checks use
`ollama list` because the official image does not ship `curl`.

## Troubleshooting

- **Slow on CPU:** Prefer smaller models (for example `llama3.2`) or set
  `FORKEDAI_COMPUTE=nvidia` on a CUDA workstation for GPU acceleration.
- **GPU conflict (NVIDIA hosts):** Run `npm run stack -- switch ollama` so
  conflicting GPU services stop first, or pass `--allow-gpu-share` only when you
  accept VRAM contention.
- **`pull` fails with "not running":** Start the profile before pulling.
- **502 on 8448 after recreate:** Restart or recreate the gateway if Caddy has a
  stale upstream dial (see [Troubleshooting](troubleshooting.md)).

## Related guides

- [LocalAI Docker setup](localai-docker-setup.md) — default inference engine
- [Models and managed media](models.md) — Hugging Face pins and LocalAI YAML
- [Network security](network-security.md) — loopback gateway and bridges
