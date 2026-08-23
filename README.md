# forkedAI

Private, local-first AI operations hub for this Windows, WSL2, Docker Desktop, NVIDIA workstation.

## Managed forks

| Fork                                                                     | Upstream                                                                 | Local path                   | Role                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------- | ------------------------------------- |
| [LocalAI-Prt](https://github.com/tamaramack/LocalAI-Prt)                 | [LocalAI](https://github.com/mudler/LocalAI)                             | `E:\git\LocalAI-Prt`         | OpenAI-compatible local inference     |
| [private-gpt-tm](https://github.com/tamaramack/private-gpt-tm)           | [private-gpt](https://github.com/zylon-ai/private-gpt)                   | `E:\git\private-gpt-tm`      | Private ingestion, RAG, and prompting |
| [stable-diffusion-ui](https://github.com/tamaramack/stable-diffusion-ui) | [AUTOMATIC1111](https://github.com/AUTOMATIC1111/stable-diffusion-webui) | `E:\git\stable-diffusion-ui` | Stable Diffusion WebUI                |
| [ComfyUI](https://github.com/tamaramack/ComfyUI)                         | [ComfyUI](https://github.com/Comfy-Org/ComfyUI)                          | `E:\git\ComfyUI`             | GPU workflow execution                |
| [ComfyUI_frontend](https://github.com/tamaramack/ComfyUI_frontend)       | [ComfyUI_frontend](https://github.com/Comfy-Org/ComfyUI_frontend)        | `E:\git\ComfyUI_frontend`    | Workflow editor and web client        |

`config/repos.json` is the source of truth for fork locations and identities. Storage, models, and stack topology are defined separately in `config/storage.json`, `config/models.json`, and `config/stack.json`.

## Documentation

Use the [documentation index](docs/README.md) to navigate the complete guide set.

| Area            | Guide                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| System design   | [Architecture](docs/architecture.md)                                                  |
| Daily operation | [Container operations](docs/container-operations.md)                                  |
| Service setup   | [LocalAI](docs/localai-docker-setup.md) · [ComfyUI](docs/comfyui-docker-setup.md)     |
| Data            | [Models and managed media](docs/models.md)                                            |
| Security        | [Network security](docs/network-security.md) · [GitHub access](docs/github-access.md) |
| Workstation     | [Node.js and npm setup](docs/node-setup.md)                                           |

## Requirements

- Windows 11 with WSL2 Ubuntu
- Git
- Node.js 20 or newer and npm
- Docker Desktop with Compose and WSL integration
- NVIDIA driver and Docker GPU support
- Hugging Face `hf` CLI in WSL for model operations

This npm project has no runtime dependencies. The scripts use Node.js as a portable task runner around Git, Docker Compose, storage, and model workflows.

## First verification

```powershell
npm install
npm test
npm run stack:doctor
npm run media -- init
npm run stack:config
npm run repos:status
npm run models -- list
```

`stack:doctor` checks tools, configured storage roots, and all five fork contexts. `stack:config` renders every profile without starting containers.

## Common operations

```powershell
npm run stack -- profiles
npm run stack -- up inference
npm run stack -- up rag
npm run stack -- up media
npm run stack -- up comfy
npm run stack -- up all
npm run stack -- logs localai
npm run stack -- down

npm run models -- plan chat-qwen2.5-3b
npm run models -- download chat-qwen2.5-3b
npm run models -- verify chat-qwen2.5-3b
npm run models -- sync-localai
npm run models -- inventory

npm run media -- status
npm run media -- latest images
npm run media -- index

npm run repos:status
npm run repos:fetch
npm run repos:update
npm run inventory
```

The profiles are `inference`, `rag`, `media`, and `comfy`. Storage roots and fork build contexts are injected from `config/` when commands run through npm. Copy `.env.example` to `.env` only for local overrides; never commit the resulting file.

`repos:status` is read-only. `repos:fetch` refreshes `origin` and `upstream`. `repos:update` additionally fast-forwards the checked-out branch from the upstream default branch, but refuses dirty or detached worktrees and never resets, rebases, force-pushes, deletes, or automatically pushes a fork.

## Operating policy

- Source, non-secret configuration, validation, and durable documentation belong in Git.
- Model weights, generated media, private documents, credentials, databases, local inventories, and runtime state do not.
- Read-mostly models, plugins, and tools live under `C:\gaic` and are mounted read-only.
- Durable media, documents, shared objects, service state, and the Caddy CA live under `E:\data\forkedAI`.
- Host-only media backups live under `E:\VIMG`; containers do not receive this path.
- Rebuildable caches and disposable tensor/temp data live under `D:\forkedAI`; D: is not the only copy of a durable artifact.
- Record model provenance, license, immutable revision, selected files, checksum verification, and intended use.
