# Stable Diffusion WebUI Docker setup

This guide covers the managed `media` profile: Automatic1111 Stable Diffusion
WebUI behind the Caddy HTTPS gateway. NVIDIA compute is required
(`FORKEDAI_COMPUTE=nvidia`).

## Service and endpoint

| Service            | Purpose           | Local endpoint           |
| ------------------ | ----------------- | ------------------------ |
| `stable-diffusion` | A1111 WebUI (GPU) | `https://localhost:8445` |

Only the gateway publishes host ports. Defaults bind to `127.0.0.1`.

## Requirements

- Docker Desktop with Linux containers, Compose v2, WSL2 integration (Windows).
- Current NVIDIA driver with Docker GPU support.
- Shared model tree from `config/storage.json` (default `C:\gaic\models`).
- At least one checkpoint: managed `sd15-starter`, plus a hard link into
  `Stable-diffusion/` for WebUI’s `--ckpt-dir` (see
  [Models and managed media](models.md)).

On a single-GPU host, stop LocalAI or Comfy before starting `media`
(`npm run stack -- switch media`).

## First run

```powershell
Set-Location E:\git\_lk\forkedAI
Copy-Item .env.example .env -ErrorAction SilentlyContinue
npm run media -- init
npm run models -- recommendations media
npm run models -- download sd15-starter
npm run models -- verify sd15-starter
```

Expose the checkpoint for WebUI without copying multi-gigabyte weights:

```powershell
$models = "C:\gaic\models"
$target = Join-Path $models "Stable-diffusion\v1-5-pruned-emaonly-fp16.safetensors"
$source = Join-Path $models "checkpoints\v1-5-pruned-emaonly-fp16.safetensors"
New-Item -ItemType HardLink -Path $target -Target $source -Force
```

Build and start:

```powershell
npm run stack -- build stable-diffusion
npm run stack -- switch media
```

Trust the Caddy CA, then open `https://localhost:8445`.

## Using the Web UI

1. Confirm the checkpoint appears in the WebUI checkpoint dropdown.
2. Run a short txt2img smoke test at modest resolution (for example 512×512 for
   SD 1.5).
3. Write outputs under the durable media root; use
   `npm run media -- latest images` and `npm run media -- index` for inventory.

### Optional SDXL upgrade

```powershell
npm run models -- download sdxl-base
npm run models -- verify sdxl-base
$models = "C:\gaic\models"
$target = Join-Path $models "Stable-diffusion\sd_xl_base_1.0.safetensors"
$source = Join-Path $models "checkpoints\sd_xl_base_1.0.safetensors"
New-Item -ItemType HardLink -Path $target -Target $source -Force
```

Select `sd_xl_base_1.0.safetensors` in the UI and use SDXL-appropriate sizes
(for example 1024×1024). Expect higher VRAM use than SD 1.5.

## Extensions

The extensions mount is read-only. Install only reviewed extensions under the
plugins storage root for Stable Diffusion. Do not auto-install untrusted
gallery extensions.

## Daily commands

```powershell
npm run stack -- switch media
npm run stack -- status
npm run stack -- down
npm run media -- status
```

Aliases: `npm run stack:media`, `npm run stack:status`, `npm run stack:down`.

## Troubleshooting

- **No checkpoint in UI:** confirm the hard link under `Stable-diffusion/` and
  that `npm run media -- init` created the directory tree.
- **502 on 8445:** wait for gateway probes or recreate the gateway after a
  WebUI recreate.
- **CUDA / OOM:** close other GPU profiles; lower resolution or use SD 1.5
  before SDXL; see [resource utilization](resource-utilization.md).
- **CPU mode:** `media` is refused when `FORKEDAI_COMPUTE=cpu`.

## Related guides

- [ComfyUI Docker setup](comfyui-docker-setup.md) — node-graph alternative
- [Use cases and models](use-cases-and-models.md)
- [Models and managed media](models.md)
- [Network security](network-security.md)
