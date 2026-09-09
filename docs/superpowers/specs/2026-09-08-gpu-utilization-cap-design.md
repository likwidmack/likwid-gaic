# GPU power cap for headroom (target ~85% utilization)

## Goal

Keep GPU-heavy services (LocalAI, Stable Diffusion, Comfy, Ollama) from
running the single workstation GPU flat-out at 100% utilization under
sustained load, leaving thermal/power headroom instead. Give the user a way
to apply and verify an ~85% cap.

## Why this isn't a Compose/container setting

Docker's NVIDIA runtime controls *which* GPU(s) a container can see
(`deploy.resources.reservations.devices`); it has no cgroup-style knob for
*how much* of the GPU a container may use, the way CPU has `--cpus`.
`utilization.gpu` (what `nvidia-smi` reports and what `npm run stack --
resources` already prints) is a measured outcome of the workload, not a
settable dial.

The only widely-supported, portable dial that actually constrains sustained
utilization is the GPU's **power limit** (watts). Capping power indirectly
caps sustained throughput/utilization, because the GPU boosts clocks only as
far as its power budget allows. The two alternatives considered and rejected:

- **NVIDIA MPS** (`CUDA_MPS_ACTIVE_THREAD_PERCENTAGE`) directly caps compute
  thread percentage per process, but the MPS control daemon is Linux-only.
  This hub's reference host is Windows 11 + WSL2 + Docker Desktop
  (`.agents/README.md`), where MPS isn't available.
- **GPU clock locking** (`nvidia-smi -lgc`) is Windows/Linux-portable in
  principle, but is a less direct proxy for "utilization" than power (a
  locked-but-low clock still shows 100% `utilization.gpu` the instant any
  kernel runs — it's occupancy of the SMs, not their power draw, that the
  metric reports). Power limiting affects the same boost behavior more
  predictably across workloads (LLM decode vs. diffusion vs. Whisper).

## Where the cap must be applied

GPU power state is a physical-device property, not a per-container setting —
one `nvidia-smi -pl <watts>` call affects the whole GPU regardless of which
container is using it. Docker Desktop's WSL2 GPU passthrough reliably
supports *read* queries (`nvidia-smi --query-gpu=...`) from inside WSL2/
containers, but *write* operations (`-pl`, `-lgc`) require the native Windows
NVIDIA driver and elevation — they must run via `nvidia-smi.exe` on the
Windows host itself, not inside WSL2 or a container. This mirrors the
existing `.wslconfig` host-tuning step already documented in
`docs/resource-utilization.md`: a one-time (or per-boot) host action, not
something the Compose stack manages per container.

## Decisions (approved)

| Decision | Choice |
| -------- | ------ |
| Mechanism | `nvidia-smi -pl <watts>`, computed as a percentage of `power.max_limit` |
| Default percentage | `85` |
| Where it runs | The native Windows host, via a new Node CLI script (matches the existing all-Node tooling convention — no new PowerShell script) |
| Configurability | `GAIC_GPU_POWER_LIMIT_PERCENT` env var (1-100), read from `.env` |
| Elevation | The script detects a permission-denied failure from `nvidia-smi -pl` and prints a clear "re-run this terminal as Administrator" message rather than silently failing |
| Idempotency | If the current power limit already matches the computed target, the script reports that and exits 0 without re-issuing the command |
| Automatic application | Not wired into `npm run stack -- up`/`switch` — power state is host-wide and persists across container restarts, so re-applying it on every stack start is unnecessary churn; it's a one-time (or per-reboot, if not persisted) host command |
| Visibility | `npm run stack -- resources` gains `power.draw`/`power.limit`/`power.max_limit` in its existing `nvidia-smi` query, with a soft WARN when `power.limit` still equals `power.max_limit` (no cap applied) |
| Scope | NVIDIA + Windows only for the active script (matches the hub's reference host); Linux users get the same script (it's plain `nvidia-smi`, which exists on Linux too) but without the Windows-specific elevation message |

## File map

| File | Responsibility |
| ---- | --------------- |
| `scripts/stack-policy.mjs` | New pure helper `computePowerLimitWatts(maxWatts, percent)` |
| `scripts/cli-policy.test.mjs` | Unit tests for it |
| `scripts/gpu-power-cap.mjs` | New CLI: query, compute, apply, report |
| `package.json` | New `gpu:cap-power` script |
| `scripts/docker.mjs` | `resources` command: extend the `nvidia-smi` query, add the uncapped WARN |
| `.env.example` | Document `GAIC_GPU_POWER_LIMIT_PERCENT=85` |
| `docs/resource-utilization.md` | New subsection explaining the cap, the command, and troubleshooting |

## Non-goals

- Per-process/per-container utilization limits (would need MPS; out of
  scope given the Windows-first reference host)
- Automatically re-applying the cap on every `stack up`/`switch`
- GPU clock locking (`-lgc`) as an alternative/additional dial
- macOS support (no NVIDIA GPUs on Apple Silicon or modern Mac hardware)
