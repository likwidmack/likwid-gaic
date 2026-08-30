# GPU and CPU resource utilization

This guide covers single-GPU profile switching, host sizing for WSL2 and Docker
Desktop, Compose environment tuning, model VRAM settings, and read-only
monitoring commands. GPU exclusivity metadata lives in `config/stack.json`
under `gpuExclusive`.

See [Container operations](container-operations.md) for profile lifecycle
commands, [Models and managed media](models.md) for download and LocalAI YAML
generation, and the root README
[Profiles](../README.md#profiles) /
[npm scripts](../README.md#npm-scripts) for the quick reference.

## Single-GPU exclusivity

Four GPU services request the NVIDIA GPU: `localai`, `stable-diffusion`,
`comfy-backend`, and `ollama`. Docker grants GPU access but does not serialize
workloads. On a single-GPU host, run **at most one** of those services at a time.

| Profile     | GPU service        | CPU companions              |
| ----------- | ------------------ | --------------------------- |
| `inference` | `localai`          | `gateway`                   |
| `rag`       | `localai`          | `private-gpt`, `gateway`    |
| `media`     | `stable-diffusion` | `gateway`                   |
| `comfy`     | `comfy-backend`    | `comfy-frontend`, `gateway` |
| `ollama`    | `ollama`           | `gateway`                   |

PrivateGPT is CPU-side for ingestion and orchestration; it calls LocalAI over
HTTP for LLM and embedding inference. Shared bind mounts exchange files only;
they do not share live VRAM or CUDA contexts.

### Switch profiles safely

Use `switch` to stop conflicting GPU services before starting the target profile:

```powershell
npm run stack -- switch inference
npm run stack -- switch rag
npm run stack -- switch media
npm run stack -- switch comfy
npm run stack -- switch ollama
```

Preview the stop/start plan without changing containers:

```powershell
npm run stack -- switch media --dry-run
```

`up` runs a GPU preflight check by default. It refuses to start a profile when
another GPU service is already running unless you pass `--allow-gpu-share`:

```powershell
npm run stack -- up media
npm run stack -- up inference --allow-gpu-share
```

Starting `up all` is blocked on single-GPU hosts because it causes VRAM
contention. Set `FORKEDAI_GPU_EXCLUSIVE=false` in `.env` only when you
deliberately want to disable preflight and switching behavior.

## Host sizing

### WSL2

Create or edit `%USERPROFILE%\.wslconfig` with values suited to your machine.
Replace placeholders with your physical RAM and core count:

```ini
[wsl2]
memory=72GB
processors=20
swap=16GB
localhostForwarding=true
```

Guidelines:

- Set `memory` to roughly 75–85% of installed RAM; leave headroom for Windows
  and the desktop compositor.
- Set `processors` to the **physical** core count, not logical threads.
- Use modest `swap` (8–16 GB) for brief RAM spikes during document ingestion;
  swap is not a substitute for RAM during sustained inference.

After editing, run `wsl --shutdown`, then restart Docker Desktop.

### Docker Desktop

- Match or stay slightly under the WSL memory cap in Docker Desktop settings.
- Enable WSL integration only for distributions that need Docker access.
- Keep the Docker disk image on a drive with adequate free space; D: scratch and
  E: durable data policies remain unchanged.

### Thread budget

| Layer                      | Setting                | Guidance                                               |
| -------------------------- | ---------------------- | ------------------------------------------------------ |
| LocalAI                    | `LOCALAI_THREADS`      | Physical cores minus 2–4                               |
| PrivateGPT ingestion       | `FORKEDAI_CPU_THREADS` | Same cap; sets `OMP_NUM_THREADS` and `MKL_NUM_THREADS` |
| Stable Diffusion / ComfyUI | PyTorch defaults       | GPU-bound; optional `FORKEDAI_CPU_THREADS` caps OpenMP |

`npm run stack:doctor` reports physical core count and a suggested
`LOCALAI_THREADS` value when the host tools are available.

## Compose environment variables

Copy `.env.example` to `.env` and tune these values for your workstation:

| Variable                      | Default | Purpose                                                                                                                       |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `NVIDIA_VISIBLE_DEVICES`      | `0`     | Pin the primary GPU                                                                                                           |
| `LOCALAI_THREADS`             | unset   | Cap LocalAI CPU threads (set only via local compose override or shell when syncing model YAML; never as an empty Compose env) |
| `LOCALAI_MAX_ACTIVE_BACKENDS` | `1`     | Keep one model hot in VRAM                                                                                                    |
| `FORKEDAI_CPU_THREADS`        | unset   | Cap OpenMP/MKL for CPU-heavy services (local compose override)                                                                |
| `FORKEDAI_GPU_EXCLUSIVE`      | `true`  | Enable preflight and switch behavior                                                                                          |

`LOCALAI_VRAM_WARM_LIMIT=0` remains set in Compose to disable gallery warm-up
probes at container start. See [LocalAI Docker setup](localai-docker-setup.md)
for GPU image selection and OOM troubleshooting.

## Model VRAM and threads

The checked-in Qwen 2.5 3B and Nomic embed models use full GPU offload
(`gpuLayers: 999`) and fit together on a high-VRAM GPU. For larger models:

- Lower `gpuLayers` or `contextSize` in `config/models.json`.
- Add `low_vram: true` to generated LocalAI YAML when needed.
- Offload the embedding model to CPU (`gpuLayers: 0`) if chat and embed exceed
  VRAM together.

Optional per-model `threads` in `config/models.json` flows into generated YAML.
When omitted, `npm run models -- sync-localai` uses `FORKEDAI_CPU_THREADS` or
`LOCALAI_THREADS` from the environment if set.

```powershell
npm run models -- sync-localai
```

## Monitoring

Read-only snapshots:

```powershell
npm run stack:doctor
npm run stack -- resources
npm run inventory
```

`doctor` reports GPU memory, physical cores, suggested thread counts, and warns
when multiple GPU services are running. `resources` adds Compose service state
and, when available, LocalAI model lists and ComfyUI `system_stats`.

## Manual smoke matrix

After changing resource settings, verify profile isolation. Print the checklist
(and optionally probe already-running gateways) without starting services:

```powershell
npm run stack -- smoke
npm run stack -- smoke --probe
npm run stack -- smoke --run
```

`smoke` alone prints the checklist. `--probe` curls already-running gateways.
`--run` executes the switch matrix on an **NVIDIA workstation** (starts/stops
profiles; not for CI or CPU mode). Or run the switches by hand:

1. `npm run stack -- switch inference` — only `localai` holds the GPU; chat API
   responds at `https://localhost:8443`.
2. `npm run stack -- switch media` — LocalAI stops; Stable Diffusion loads at
   `https://localhost:8445`.
3. `npm run stack -- switch rag` — LocalAI and PrivateGPT run; ingestion uses CPU
   while chat and embed hit the GPU through LocalAI.

Run `npm run stack -- resources` after each step to confirm a single GPU
service is active. For cross-cutting failures (502, empty threads, hard links,
STT/TTS), see [Troubleshooting](troubleshooting.md).

## Troubleshooting

- **OOM during inference:** Reduce quantization, context size, or concurrent
  models. See the memory table in [LocalAI Docker setup](localai-docker-setup.md).
- **LocalAI crash on start with `--threads` / empty int:** An empty
  `LOCALAI_THREADS=""` Compose env crashes LocalAI. Leave the variable unset
  (omit from Compose) or set a real integer via `compose.override.yaml`.
- **PrivateGPT default model not found:** Discovery registers LocalAI IDs with a
  `:latest` suffix. Keep `PGPT_LLM_DEFAULT` / `PGPT_EMBEDDING_DEFAULT` aligned
  (for example `qwen2.5-3b-instruct:latest`).
- **Preflight blocked `up`:** Another GPU profile is running. Use `switch` or
  stop the conflicting service manually.
- **Slow document ingestion:** Raise `FORKEDAI_CPU_THREADS` modestly or add
  WSL memory; avoid exceeding physical cores.
- **GPU not visible in containers:** Run `npm run stack:doctor` and the
  standalone `nvidia-smi` container test in
  [Container operations](container-operations.md).
