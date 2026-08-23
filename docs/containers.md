# Container operations

The root `compose.yaml` is the control plane for the managed forks. It does not edit their worktrees. Docker build contexts point at the local forks, while hub-owned Dockerfiles cover projects that do not ship one.

## Profiles

| Profile | Services | Host endpoints |
| --- | --- | --- |
| `inference` | LocalAI CUDA 13 | `http://localhost:8080` |
| `rag` | LocalAI + PrivateGPT | `http://localhost:8080`, `http://localhost:8001` |
| `media` | Stable Diffusion WebUI | `http://localhost:7860` |
| `comfy` | ComfyUI frontend proxy | `http://localhost:8189` |

The Comfy frontend expects a ComfyUI backend on host port 8188. Override `COMFY_BACKEND` if the backend is elsewhere.

## Shared bridge

Every service explicitly joins the user-defined `forkedai-shared` bridge. Docker provides service-name DNS on this network, so PrivateGPT reaches LocalAI at `http://localai:8080`; fixed container IP addresses are unnecessary. Compose creates the bridge on first `up` and removes it on `down` after the last attached container is gone.

Published ports bind to `127.0.0.1` by default. They are available to applications and browsers on this computer but not intentionally exposed to the LAN. Compose does not opt into standalone attachment, each service runs with `no-new-privileges`, and Docker-daemon access remains a privileged administrative boundary.

```powershell
docker network inspect forkedai-shared
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Networks}}"
```

Set `FORKEDAI_NETWORK_NAME` only when a name collision exists. See [Personal-computer network security](network-security.md) before changing `FORKEDAI_BIND_ADDRESS` or exposing an endpoint beyond localhost.

## First run

```powershell
npm run stack:doctor
npm run media -- init
npm run stack:config
npm run models -- download chat-qwen2.5-3b
npm run models -- download embed-nomic-v1.5
npm run models -- verify chat-qwen2.5-3b
npm run models -- verify embed-nomic-v1.5
npm run models -- sync-localai
npm run stack -- up inference
npm run stack -- backend
npm run stack -- up rag
```

`doctor` is read-only. `media init` creates configured directories. `stack:config` renders and validates the complete Compose model. `up` starts containers and waits up to five minutes for health. The backend command installs `localai@cuda13-llama-cpp` only when missing, persists it under the runtime root, and recreates LocalAI once so the backend registry refreshes.

Build fork-backed images explicitly:

```powershell
npm run stack -- build private-gpt
npm run stack -- build stable-diffusion
npm run stack -- build comfy-frontend
```

The hub's root `.dockerignore` is default-deny and admits only `docker/`. The Stable Diffusion and Comfy Dockerfiles separately exclude Git metadata, dotenv files, local environments, dependency caches, models, outputs, and other generated state from their named fork contexts before copying source into build layers.

The Stable Diffusion image pins PyTorch 2.8.0 with CUDA 12.8 for RTX 5090 support while staying closer to this older WebUI fork than newer PyTorch releases.

LocalAI scans GGUF headers on first start, which can take roughly two minutes on the Windows-mounted model directory. The Stable Diffusion image installs the fork's pinned Python dependencies at build time; its first start clones pinned helper repositories into the runtime root. The WebUI uses the public `w-e-w/stablediffusion` mirror for the exact upstream commit formerly hosted in the removed Stability AI repository.

The Stable Diffusion image marks its five known helper repository directories as Git-safe because they live on a Windows bind mount whose reported owner can differ after container replacement. The entries are explicit for compatibility with the image's Git 2.34; other repositories retain Git's normal ownership checks.

## Daily operations

```powershell
npm run stack
npm run stack -- logs localai
npm run stack -- stop stable-diffusion
npm run stack -- down
```

`down` never adds `--volumes`; models, indexes, configuration, and generated media remain on `E:`. No command runs Docker system prune.

## Storage mounts

- Models are mounted read-only into inference/media containers; LocalAI sees only `E:\models\localai`.
- Generated images land in `E:\data\forkedAI\media\images`.
- PrivateGPT state lives in `E:\data\forkedAI\runtime\private-gpt`.
- Private documents are mounted read-only from `E:\data\forkedAI\documents`.
- Hugging Face cache data is centralized under `E:\models\.cache\huggingface`.

Override the network name, bind address, ports, or Comfy backend in a local `.env` copied from `.env.example`. Never commit tokens.
