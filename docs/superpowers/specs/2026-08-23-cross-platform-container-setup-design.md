# Cross-platform container setup (Windows / macOS / Linux)

## Goal

Make the managed container control plane portable across **Windows**, **macOS**,
and **Linux** for orchestration, storage roots, model pins, and **inference/RAG**,
while keeping the validated **Windows/WSL2/NVIDIA** workstation as the default
GPU path. Do not claim media/Comfy GPU parity on non-NVIDIA hosts.

## Decisions (approved)

| Decision                      | Choice                                                         |
| ----------------------------- | -------------------------------------------------------------- |
| Scope                         | Dual compute: `nvidia` (default GPU) and `cpu` (inference/RAG) |
| Path keys                     | Keep `pathWindows` + `pathWsl`; add `pathPosix`                |
| Path selection                | `win32` → Windows; WSL → WSL; else → POSIX (`~/` expanded)     |
| Compute env                   | `FORKEDAI_COMPUTE=nvidia\|cpu`                                 |
| Compute default               | `cpu` on `darwin`; otherwise `nvidia` when unset               |
| CPU Compose                   | Overlay `compose.cpu.yaml` appended by `scripts/docker.mjs`    |
| CPU LocalAI image             | `localai/localai:v4.8.0`                                       |
| media / comfy                 | Refused in CPU mode with a clear error                         |
| Metal / ROCm / Intel / Vulkan | Out of scope                                                   |
| Windows on-disk roots         | Unchanged (`C:\gaic`, `D:\forkedAI`, `E:\data\forkedAI`)       |

## Path resolution

Shared helper: `scripts/paths.mjs`.

1. `win32` → `pathWindows`
2. WSL (`WSL_DISTRO_NAME` or Microsoft marker in `/proc/version`) → `pathWsl`
3. Otherwise → `pathPosix`, expanding a leading `~/` with `os.homedir()`

Default POSIX layout (under `$HOME`):

| Role              | Path                                                       |
| ----------------- | ---------------------------------------------------------- |
| Models            | `~/gaic/models`                                            |
| Plugins / tools   | `~/gaic/shared/plugins`, `~/gaic/shared/tools`             |
| Rebuildable cache | `~/forkedAI/cache/{huggingface,torch}`                     |
| Scratch           | `~/forkedAI/scratch/{tensors,comfy/temp}`                  |
| Durable state     | `~/data/forkedAI/{media,documents,runtime,shared/objects}` |
| Host-only backup  | `~/VIMG`                                                   |
| Managed forks     | `~/git/<repo-name>`                                        |

Windows `E:\VIMG` / WSL `/mnt/e/VIMG` pins remain for the workstation layout.
POSIX media backup is `~/VIMG`.

## Dual compute

```text
FORKEDAI_COMPUTE=nvidia  → compose.yaml only (CUDA LocalAI + NVIDIA devices)
FORKEDAI_COMPUTE=cpu     → compose.yaml + compose.cpu.yaml
```

`compose.cpu.yaml` must:

- Default `LOCALAI_IMAGE` to the CPU tag when unset
- Reset NVIDIA-only LocalAI environment keys
- Reset `deploy.resources.reservations.devices` on GPU services via Compose
  `!reset`

`npm run stack -- up|switch|build` for media/comfy (or their GPU services)
refuses in CPU mode. Inference and rag remain supported.

`stack:doctor` soft-warns when `nvidia-smi` is missing in CPU mode instead of
counting that check as a hard failure. Hugging Face CLI stays WSL-bridged on
Windows and native on macOS/Linux.

## Documentation

Container docs describe a platform matrix, PowerShell and bash first-run
blocks, and CA trust notes for Windows, macOS Keychain, and Linux. Mark
media/comfy as NVIDIA-only.

## Verification

- `npm test`, Prettier on touched Markdown, `git diff --check`
- `npm run stack:config` (nvidia default) and
  `FORKEDAI_COMPUTE=cpu npm run stack:config`
- Doctor does not fail solely for missing NVIDIA in CPU mode
- `up media` errors clearly when `FORKEDAI_COMPUTE=cpu`

## Out of scope

- Metal/MPS, ROCm, Intel, or Vulkan managed images
- Changing Windows storage drive letters
- Full media/comfy on CPU or macOS
- Product rename to likwid-gaic (separate design)
