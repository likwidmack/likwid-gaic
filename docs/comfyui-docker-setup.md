# ComfyUI Docker setup

This guide covers the requirements, recommended configuration, initial setup,
and routine operation of the ComfyUI Docker profile managed by this repository.

## Services and endpoints

The `comfy` profile runs two services:

| Service          | Purpose                                        | Local endpoint           |
| ---------------- | ---------------------------------------------- | ------------------------ |
| `comfy-backend`  | ComfyUI Python backend with NVIDIA GPU support | `https://localhost:8447` |
| `comfy-frontend` | Standalone ComfyUI frontend and backend proxy  | `https://localhost:8446` |

The Caddy gateway is the only service that publishes host ports. Both HTTPS
ports bind only to the local computer by default; backend container ports remain
private.

## Requirements

### Software

- Docker Desktop configured to use Linux containers.
- Docker Compose v2, included with current Docker Desktop releases.
- WSL 2.1.5 or newer, preferably updated with `wsl --update`.
- WSL 2 integration with access to the configured `C:`, `D:`, and `E:` storage drives.
- A current NVIDIA Windows driver with Docker GPU support.
- Node.js 20 or newer for the repository management scripts.
- Internet access during the first build.

A separate CUDA toolkit installation on the host is not required. The backend
image supplies its own CUDA runtime through the official PyTorch base image.
Do not install a Linux NVIDIA display driver or a second Docker Engine inside
the integrated WSL distribution. If Docker behaves differently between
PowerShell and WSL, compare `Get-Command docker -All` with `type -a docker`;
a separately installed WSL client can shadow Docker Desktop's CLI.

### Repository layout

The default configuration expects these checkouts:

```text
E:\git\_lk\forkedAI
E:\git\ComfyUI
E:\git\ComfyUI_frontend
```

Override `COMFY_CONTEXT` or `COMFY_FRONTEND_CONTEXT` in `.env` if the source
repositories are stored elsewhere.

### Storage and drive roles

The default configuration separates read-mostly, disposable, and durable data:

```text
C:\gaic                 Models, reviewed plugins, and shared tools
D:\forkedAI             Rebuildable caches and disposable scratch data
E:\data\forkedAI        Durable runtime state, shared objects, and media
```

Allow at least 20–30 GB of free Docker storage in addition to the space needed
for model files. Actual model storage can range from a few gigabytes to hundreds
of gigabytes.

### Ports

Ports `8446` and `8447` must be available. They can be changed in `.env`:

```dotenv
COMFY_HTTPS_PORT=8446
COMFY_API_HTTPS_PORT=8447
```

## Initial setup

From PowerShell:

```powershell
Set-Location E:\git\_lk\forkedAI
Copy-Item .env.example .env -ErrorAction SilentlyContinue
npm run media -- init
npm run stack:doctor
npm run stack:config
npm run models -- recommendations comfy
npm run models -- download sd15-starter
npm run models -- verify sd15-starter
npm run stack -- build comfy-backend
npm run stack -- build comfy-frontend
npm run stack -- up comfy
```

The storage initialization command is idempotent and can be run again safely.

Open `https://localhost:8446` after the gateway and both services report healthy.
Direct API access is available through the gateway at
`https://localhost:8447`. Caddy uses a persistent internal development CA, so
the browser may require the local CA to be trusted before it stops displaying a
certificate warning.

## Verify NVIDIA GPU access

Test Docker GPU support independently before troubleshooting ComfyUI:

```powershell
docker run --rm --gpus all nvidia/cuda:13.0.0-base-ubuntu24.04 nvidia-smi
```

Inspect the running profile:

```powershell
docker compose --project-name forkedai --file compose.yaml --profile comfy ps
docker compose --project-name forkedai --file compose.yaml --profile comfy logs --tail 200 comfy-backend
```

The API gateway should return system, PyTorch, CUDA, and GPU details. With
PowerShell 7, `-SkipCertificateCheck` can be used for a local diagnostic before
the Caddy CA is trusted:

```powershell
Invoke-RestMethod -SkipCertificateCheck https://localhost:8447/system_stats
```

## Model layout

Models are mounted read-only from `C:\gaic\models` to `/shared/models`. Use
ComfyUI's standard directory names under that root:

```text
C:\gaic\models\
├── checkpoints\
├── clip\
├── clip_vision\
├── controlnet\
├── diffusion_models\
├── embeddings\
├── loras\
├── text_encoders\
├── unet\
├── upscale_models\
└── vae\
```

Keeping this mount read-only prevents a container or workflow from modifying the
canonical model collection.

## Persistent data

| Data                        | Host location                          |
| --------------------------- | -------------------------------------- |
| Generated images            | `E:\data\forkedAI\media\images`        |
| Inputs                      | `E:\data\forkedAI\runtime\comfy\input` |
| User settings and workflows | `E:\data\forkedAI\runtime\comfy\user`  |
| Caddy CA and state          | `E:\data\forkedAI\runtime\caddy\data`  |
| Shared serialized objects   | `E:\data\forkedAI\shared\objects`      |
| Temporary files             | `D:\forkedAI\scratch\comfy\temp`       |
| Shared tensor files         | `D:\forkedAI\scratch\tensors`          |
| Torch cache                 | `D:\forkedAI\cache\torch`              |
| Hugging Face cache          | `D:\forkedAI\cache\huggingface`        |
| Reviewed custom nodes       | `C:\gaic\shared\plugins\comfyui`       |

Back up the user directory and generated media according to their importance.

## Recommended configuration

- Allocate enough memory and disk space to Docker Desktop. Around 32 GB of RAM
  is comfortable for larger workflows, although requirements depend on the
  selected model and nodes.
- Keep both published ports bound to `127.0.0.1` unless authenticated remote
  access is deliberately added.
- Keep models read-only and runtime/cache locations writable.
- Preserve the Hugging Face and Torch caches between container rebuilds.
- Keep reviewed version tags for planned upgrades; pin the PyTorch base image by
  digest when exact image reproducibility matters.
- Periodically rebuild with `docker compose build --pull` so a maintained base
  tag can receive upstream fixes. Reserve `--no-cache` for deliberate clean
  rebuilds.
- Review source and dependencies before installing third-party custom nodes.
- Keep API-backed nodes disabled unless they are specifically required.
- Keep the gateway bound to `127.0.0.1`. Add authentication and restricted
  Windows Firewall rules before exposing it to a LAN or VPN address.
- Treat the D: paths as disposable. Do not place the only copy of a workflow,
  generated artifact, certificate, or private data there.

## Custom nodes

The Docker build context excludes locally installed third-party custom nodes.
Reviewed nodes are supplied from `C:\gaic\shared\plugins\comfyui` and mounted
read-only at `/opt/comfyui/custom_nodes`. This prevents a running container from
silently changing host-side plugins.

Pin reviewed custom-node revisions and install their Python dependencies in a
controlled backend image layer. Restart or rebuild the backend after host-side
plugin changes. Never place credentials in the shared plugin directory.

## API nodes and credentials

The backend starts with `--disable-api-nodes`. To enable remote API-backed nodes,
remove that argument from `docker/comfyui.Dockerfile`, rebuild the image, and
provide required credentials with a service-scoped Compose secret when the node
supports a file-based credential. Otherwise inject them from a protected session
or operating-system secret store rather than committing them to `.env`.
Never commit credentials to either ComfyUI repository or this operations hub.

## Updates and rebuilds

After updating either ComfyUI source checkout, rebuild and restart the profile:

```powershell
npm run stack -- build comfy-backend
npm run stack -- build comfy-frontend
npm run stack -- up comfy
```

For a maintenance rebuild that refreshes the tagged PyTorch base image:

```powershell
docker compose --project-name forkedai --file compose.yaml --profile comfy build --pull comfy-backend comfy-frontend
npm run stack -- up comfy
```

Validate the repository configuration before starting:

```powershell
npm test
npm run stack:config
```

Stop only the ComfyUI services with:

```powershell
docker compose --project-name forkedai --file compose.yaml --profile comfy stop comfy-frontend comfy-backend
```

## Troubleshooting

### Docker cannot access the GPU

Update the NVIDIA Windows driver and Docker Desktop, confirm WSL integration is
enabled, restart Docker Desktop, and rerun the standalone `nvidia-smi` test.

### A port is already in use

Change `COMFY_HTTPS_PORT` or `COMFY_API_HTTPS_PORT` in `.env`, then recreate the
profile.

### The backend is unhealthy

Inspect `comfy-backend` logs. Common causes include inaccessible bind mounts,
missing runtime directories, insufficient Docker memory, or incompatible custom
nodes.

### Models do not appear

Confirm the files use ComfyUI's expected subdirectories under
`C:\gaic\models`, then restart the backend. Also verify Docker Desktop has
permission to access the drive.

### The frontend loads but cannot reach the backend

Confirm the gateway and both Comfy services are healthy. The frontend uses the
internal Compose address `http://comfy-backend:8188`; it does not require a
host-gateway exception. Local clients should use `https://localhost:8446`, not
the private container address.
