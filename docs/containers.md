# Container operations

The root `compose.yaml` is the control plane for the managed forks. It does not edit their worktrees. Docker build contexts point at the local forks, while hub-owned Dockerfiles cover projects that do not ship one.

## Profiles

| Profile | Services | HTTPS gateway endpoint |
| --- | --- | --- |
| `inference` | LocalAI CUDA 13 | `https://localhost:8443` |
| `rag` | LocalAI + PrivateGPT | `https://localhost:8443`, `https://localhost:8444` |
| `media` | Stable Diffusion WebUI | `https://localhost:8445` |
| `comfy` | ComfyUI CUDA backend + frontend proxy | `https://localhost:8447`, `https://localhost:8446` |

The Caddy gateway is the only service with published host ports. It terminates HTTPS on loopback ports 8443 through 8447 and forwards plain HTTP over the appropriate private bridge. The Comfy frontend reaches its backend at `http://comfy-backend:8188`; direct backend ports are not published.

## Segmented bridges

Services explicitly join one trust-zone bridge. `localai` and `private-gpt` use `forkedai-inference`; Stable Diffusion and both Comfy services use `forkedai-media`; the gateway joins those networks plus `forkedai-edge`. Docker provides service-name DNS within each network, so fixed container IP addresses are unnecessary. The gateway is the only multi-homed service.

The gateway binds to `127.0.0.1` by default. It is available to applications and browsers on this computer but not intentionally exposed to the LAN. Compose does not opt into standalone attachment, each service runs with `no-new-privileges`, and Docker-daemon access remains a privileged administrative boundary.

```powershell
docker network inspect forkedai-edge forkedai-inference forkedai-media
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Networks}}"
```

Set the three `FORKEDAI_*_NETWORK_NAME` variables only when a name collision exists. See [Personal-computer network security](network-security.md) before changing `FORKEDAI_BIND_ADDRESS` or exposing the gateway beyond localhost.

## Trusting the local HTTPS certificate

Caddy creates a private development CA under `RUNTIME_ROOT/caddy/data`. After starting any profile, inspect the CA certificate and then trust it for the current Windows user:

```powershell
$ca = "E:\data\forkedAI\runtime\caddy\data\caddy\pki\authorities\local\root.crt"
Get-PfxCertificate -FilePath $ca | Format-List Subject, Thumbprint, NotAfter
Import-Certificate -FilePath $ca -CertStoreLocation Cert:\CurrentUser\Root
```

Trust the certificate only after verifying that the path and thumbprint belong to this stack. Removing `RUNTIME_ROOT/caddy/data` rotates the CA and requires trusting the replacement. The CA private key is sensitive runtime state and must not be committed or shared.

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
npm run stack -- build comfy-backend
npm run stack -- build comfy-frontend
npm run stack -- up comfy
```

`doctor` is read-only. `media init` creates configured directories. `stack:config` renders and validates the complete Compose model. `up` starts containers and waits up to five minutes for health. The backend command installs `localai@cuda13-llama-cpp` only when missing, persists it under the runtime root, and recreates LocalAI once so the backend registry refreshes.

Build fork-backed images explicitly:

```powershell
npm run stack -- build private-gpt
npm run stack -- build stable-diffusion
npm run stack -- build comfy-backend
npm run stack -- build comfy-frontend
```

The hub's root `.dockerignore` is default-deny and admits only `docker/`. The Stable Diffusion and Comfy Dockerfiles separately exclude Git metadata, dotenv files, local environments, dependency caches, models, outputs, and other generated state from their named fork contexts before copying source into build layers.

The Stable Diffusion image pins PyTorch 2.8.0 with CUDA 12.8 for RTX 5090 support while staying closer to this older WebUI fork than newer PyTorch releases.

The ComfyUI image pins the official PyTorch 2.13.0 CUDA 13.0 runtime. Its build keeps the base image's matching Torch packages and installs the remaining ComfyUI requirements. API nodes are disabled by default to prevent workflow nodes from calling external services; override the service command deliberately if those nodes are required.

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

## Shared storage mounts

Each backend receives the same five canonical paths:

| Container path | Host root | Access | Purpose |
| --- | --- | --- | --- |
| `/shared/models` | `MODEL_ROOT` (default `E:/models`) | Read-only | Model weights and LocalAI model definitions |
| `/shared/tensors` | `TENSOR_ROOT` | Read-write | Serialized tensors, embeddings, checkpoints, and intermediate arrays |
| `/shared/objects` | `SHARED_OBJECT_ROOT` | Read-write | Workflows, inputs, outputs, and exchange artifacts |
| `/shared/plugins` | `PLUGIN_ROOT` | Read-only | Reviewed plugins and custom nodes |
| `/shared/tools` | `TOOL_ROOT` | Read-only | Reviewed helper binaries, scripts, and configuration |

`npm run media -- init` creates all host roots and service-specific plugin directories. Stable Diffusion maps `plugins/stable-diffusion` to its extensions directory, and ComfyUI maps `plugins/comfyui` to `custom_nodes`; both mounts remain read-only at runtime. Add or update reviewed plugin code from the host, then rebuild or restart the affected service.

Shared objects and tensors are filesystem artifacts only. Live CUDA tensors, GPU memory, Python objects, and process memory cannot be shared through these mounts; serialize them to a safe, documented format first. Treat pickle and arbitrary PyTorch checkpoint files as executable content and load them only from trusted sources.

Generated images land in `E:/data/forkedAI/media/images`. ComfyUI input, user state, temporary files, and Torch cache remain under the service-specific runtime root. PrivateGPT state and documents also keep their narrowly scoped mounts, and the Hugging Face cache remains centralized under `E:/models/.cache/huggingface`.

Override storage roots, network names, gateway bind address or HTTPS port, or the Comfy backend in a local `.env` copied from `.env.example`. Never commit tokens, certificates, private keys, or shared artifacts.
