# Local AI system architecture

This repository is the portable control plane for a personal Windows, WSL2, Docker Desktop, NVIDIA AI workstation. Machine-specific inventory is generated locally and excluded from Git.

## Configuration model

| File                  | Responsibility                                                       |
| --------------------- | -------------------------------------------------------------------- |
| `config/repos.json`   | Five managed fork identities and Windows/WSL source paths            |
| `config/storage.json` | Canonical host storage roots                                         |
| `config/models.json`  | Pinned Hugging Face selections and LocalAI metadata                  |
| `config/stack.json`   | Profiles, services, networks, gateway ports, and shared mount policy |
| `.env.example`        | Generic, non-secret Compose override template (placeholders only)    |
| `compose.yaml`        | Executable container topology                                        |

The npm stack runner injects fork and storage paths from JSON configuration.
`.env.example` lists every Compose variable with portable placeholder paths;
copy it to the ignored `.env` and replace those values when running Compose
directly. Canonical workstation roots remain in `config/storage.json` and
`config/repos.json`.

## Managed topology

1. `LocalAI-Prt` supplies the OpenAI-compatible GPU inference API.
2. `private-gpt-tm` supplies private ingestion, retrieval, prompting, and document workflows.
3. `stable-diffusion-ui` supplies Stable Diffusion WebUI.
4. `ComfyUI` supplies the GPU workflow API.
5. `ComfyUI_frontend` supplies the workflow editor and proxies to the backend.
6. Caddy is the only host-facing service and terminates local HTTPS.
7. This hub supplies Compose orchestration, model metadata, media indexing, fork tracking, and validation.

See [Container operations](container-operations.md) for lifecycle commands and
[Network security](network-security.md) for trust boundaries.

## Host and storage assumptions

- Docker Desktop runs Linux containers through its WSL2 backend and exposes the
  NVIDIA GPU through the current Windows driver.
- Docker Desktop supplies Docker access to the integrated WSL distribution; a
  second Docker Engine or NVIDIA Linux display driver is not installed there.
- LocalAI uses the configured CUDA 13 image; Stable Diffusion uses PyTorch 2.8 with CUDA 12.8; ComfyUI uses the configured CUDA 13 PyTorch image.
- Read-mostly models, plugins, and tools live on C:.
- Rebuildable caches and disposable tensor/temp data live on non-redundant D: storage.
- Durable media, documents, shared objects, runtime state, and the Caddy CA live on E:.
- Published application ports bind to IPv4 loopback by default.

Shared filesystem mounts exchange serialized artifacts only. They do not share live GPU allocations, Python objects, CUDA contexts, or process memory.

## Privacy boundary

The repository stores source, non-secret configuration, validation, and documentation. It excludes model weights, generated media, private documents, credentials, vector databases, runtime state, and local inventory.

The root `.dockerignore` is default-deny. Named fork contexts use explicit Dockerfile exclusions for Git metadata, dotenv files, environments, dependency caches, models, output, and other generated state.

## Verification

```powershell
npm test
npm run stack:doctor
npm run stack:config
npm run repos:status
npm run models -- list
npm run models -- inventory
npm run media -- status
npm run inventory
```

`npm test` checks configuration shape, immutable model pins, storage defaults, Compose variable coverage, privacy rules, service/network topology, Dockerfile safeguards, gateway routes, and local Markdown links. `stack:config` asks Docker Compose to render all profiles without starting them.

Review `docs/inventory.generated.md` before sharing it. Benchmark results and prompt data stay outside Git unless deliberately anonymized.
