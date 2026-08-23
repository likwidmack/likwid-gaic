# Local AI system architecture

This repository is the portable control plane for managed AI forks on Windows,
macOS, and Linux using Docker Compose. The reference validation host is a
Windows 11 / WSL2 / Docker Desktop / NVIDIA workstation. Machine-specific
inventory is generated locally and excluded from Git.

## Configuration model

| File                   | Responsibility                                                       |
| ---------------------- | -------------------------------------------------------------------- |
| `config/accounts.json` | GitHub account boundary, SSH host aliases, and credential policy     |
| `config/repos.json`    | Five managed fork identities and Windows / WSL / POSIX source paths  |
| `config/storage.json`  | Canonical host storage roots (Windows, WSL, and POSIX)               |
| `config/models.json`   | Pinned Hugging Face selections and LocalAI metadata                  |
| `config/stack.json`    | Profiles, services, networks, gateway ports, and shared mount policy |
| `.env.example`         | Generic, non-secret Compose override template (placeholders only)    |
| `compose.yaml`         | Executable container topology (NVIDIA defaults)                      |
| `compose.cpu.yaml`     | CPU overlay for inference/RAG when `FORKEDAI_COMPUTE=cpu`            |

The npm stack runner injects fork and storage paths from JSON configuration via
`scripts/paths.mjs`. `.env.example` lists every Compose variable with
portable placeholder paths; copy it to the ignored `.env` and replace those
values when running Compose directly. Canonical workstation roots remain in
`config/storage.json` and `config/repos.json`.

## Managed topology

1. `LocalAI-Prt` supplies the OpenAI-compatible inference API (CUDA or CPU image).
2. `private-gpt-tm` supplies private ingestion, retrieval, prompting, and document workflows.
3. `stable-diffusion-ui` supplies Stable Diffusion WebUI (NVIDIA only).
4. `ComfyUI` supplies the GPU workflow API (NVIDIA only).
5. `ComfyUI_frontend` supplies the workflow editor and proxies to the backend.
6. Caddy is the only host-facing service and terminates local HTTPS.
7. This hub supplies Compose orchestration, model metadata, media indexing, fork tracking, and validation.

See [Container operations](container-operations.md) for lifecycle commands and
[Network security](network-security.md) for trust boundaries.

## Host and storage assumptions

- **Windows / WSL:** Docker Desktop runs Linux containers through its WSL2
  backend and exposes the NVIDIA GPU through the current Windows driver. Do not
  install a second Docker Engine or NVIDIA Linux display driver inside the
  integrated WSL distribution.
- **macOS:** Docker Desktop without NVIDIA passthrough; default
  `FORKEDAI_COMPUTE=cpu` for inference/RAG.
- **Native Linux:** Docker Engine or Desktop; NVIDIA Container Toolkit for GPU
  profiles, or `FORKEDAI_COMPUTE=cpu` without a GPU.
- LocalAI uses the configured CUDA 13 image in nvidia mode, or the CPU tag in
  cpu mode. Stable Diffusion and ComfyUI images remain CUDA-based and
  NVIDIA-only.
- Windows reference layout: read-mostly assets on C:, rebuildable cache/scratch
  on D:, durable state on E:. POSIX defaults use `$HOME` trees from
  `pathPosix` (`~/gaic`, `~/forkedAI`, `~/data/forkedAI`).
- Published application ports bind to IPv4 loopback by default.

Shared filesystem mounts exchange serialized artifacts only. They do not share live GPU allocations, Python objects, CUDA contexts, or process memory. On a single-GPU host, at most one of `localai`, `stable-diffusion`, or `comfy-backend` should run at a time; see [GPU and CPU resource utilization](resource-utilization.md).

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
