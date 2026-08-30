# Compute mode auto-detect

## Goal

When `FORKEDAI_COMPUTE` is unset, resolve compute mode from the host NVIDIA
probe instead of a fixed platform default. Prefer GPU when `nvidia-smi` reports
a device; fall back to CPU when the probe fails. Keep explicit `nvidia` and
`cpu` as hard overrides.

## Decisions (approved)

| Decision | Choice |
| -------- | ------ |
| Unset behavior | Auto-detect via host `nvidia-smi` |
| Explicit `auto` | Same as unset (alias) |
| Probe success | Exit 0 and non-empty `--query-gpu=name` output → `nvidia` |
| Probe failure / ambiguous | → `cpu` (missing binary, non-zero exit, empty stdout, timeout) |
| Overrides | `nvidia` and `cpu` skip the probe |
| Invalid values | Reject (existing error path) |
| Docker GPU smoke | Out of scope |
| Result caching across processes | Out of scope |
| Metal / AMD / Intel / Vulkan | Out of scope |

## Resolution

Shared helper: `resolveComputeMode` in `scripts/paths.mjs`.

```text
FORKEDAI_COMPUTE=nvidia  → nvidia (no probe)
FORKEDAI_COMPUTE=cpu     → cpu (no probe)
FORKEDAI_COMPUTE=auto    → probe
unset                    → probe
```

Probe command:

```text
nvidia-smi --query-gpu=name --format=csv,noheader
```

Inject a runner/callback for unit tests so tests do not call the real binary.

`scripts/docker.mjs` continues to print the resolved mode and should indicate
auto when the env was unset or `auto`, for example:

```text
Compute mode: nvidia (auto)
Compute mode: cpu (auto)
Compute mode: nvidia
```

## Compose impact

Unchanged once mode is resolved:

```text
nvidia → compose.yaml only
cpu    → compose.yaml + compose.cpu.yaml
```

Profile policy stays the same: `inference`, `rag`, and `ollama` work in CPU
mode; `media` and `comfy` remain NVIDIA-only.

## Documentation

Update `.env.example`, `AGENTS.md`, `README.md`, and platform tables in
`docs/container-operations.md` (and related setup pages) so the default is
described as auto-detect with CPU fallback, not a fixed `nvidia` or Darwin
`cpu` default.

## Non-goals

- Detecting Docker Desktop GPU passthrough separately from host `nvidia-smi`
- Persisting the resolved mode into `.env`
- Changing GPU exclusivity / `switch` behavior beyond using the resolved mode
