# Host Ollama helpers

Optional **host-native** scripts for creating GPU-tuned Ollama Modelfile
variants and starting a local `ollama serve`. They are not part of the managed
Compose stack.

## Prefer the managed profile

On this hub, use Compose first:

```powershell
npm run stack -- switch ollama
npm run ollama -- pull llama3.1:8b
npm run ollama -- list
npm run ollama -- status
```

See [Ollama Docker setup](../../docs/ollama-docker-setup.md). Host helpers bypass
the gateway and Compose env defaults. The npm wrapper still respects GPU
exclusivity (see below).

## Recommended entry: `npm run ollama:host`

Prefer the wrapper so GPU preflight and `OLLAMA_MODELS` alignment run first:

```powershell
# Create Modelfile variants (Git Bash / WSL / Linux)
npm run ollama:host -- create -m llama3.1 -v 8b
npm run ollama:host -- quick llama3.1 8b both 16384 1

# Host serve (refuses if Compose GPU services are up)
npm run ollama:host -- serve

# Explicit share (not recommended on a single GPU)
npm run ollama:host -- serve --allow-gpu-share
```

The wrapper:

- refuses when Compose GPU-exclusive services (`localai`, `stable-diffusion`,
  `comfy-backend`, `ollama`) are running, unless `--allow-gpu-share` or
  `GAIC_GPU_EXCLUSIVE=false`
- sets `OLLAMA_MODELS` from hub `MODEL_ROOT` (`config/storage.json`) when unset
  (skip with `--skip-model-root`)

## Scripts

| Script                      | Purpose                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| `create-gpu-model.sh`       | Build optimized / offload Modelfile variants from a pulled base tag    |
| `quick-create-gpu-model.sh` | Positional-arg wrapper around `create-gpu-model.sh`                    |
| `start-ollama.sh`           | Host `ollama serve` with safe defaults (localhost bind, byte overhead) |

Calling the `.sh` files directly skips npm preflight; use `ollama:host` unless
you know Compose GPU consumers are already stopped.

## Usage (direct bash)

From the repository root (Git Bash / WSL / Linux / macOS):

```bash
chmod +x scripts/host-ollama/*.sh

# Share Compose blobs (optional but recommended on this hub)
# Windows example — match config/storage.json MODEL_ROOT:
#   export OLLAMA_MODELS=/c/gaic/models
# Then pull once and create variants in that store:
ollama pull llama3.1:8b

./scripts/host-ollama/create-gpu-model.sh -m llama3.1 -v 8b
./scripts/host-ollama/create-gpu-model.sh -m mistral -v 7b --optimized-only --monitors 2
./scripts/host-ollama/quick-create-gpu-model.sh llama3.1 8b both 16384 1

# Host serve (conflicts with Compose GPU profiles on the same device)
./scripts/host-ollama/start-ollama.sh
```

Hardware defaults come from the host (`nproc`, `nvidia-smi`). Override with
`--vram`, `--num-threads`, and `--monitors`. Layer counts are a heuristic
(1.5 GB/monitor reserve, 75% of remainder, ~3.2 layers/GB, clamped 15–180) —
confirm with `ollama ps` and `nvidia-smi`.

Modelfiles land under `./modelfiles/` relative to the current working directory
(override with `--model-dir`). That directory is gitignored.

## Network and security

- Leave `OLLAMA_HOST` unset so Ollama binds to localhost. `start-ollama.sh`
  warns if `OLLAMA_HOST` is already set to a non-loopback value.
- Do not publish `0.0.0.0` without the controls in
  [Network security](../../docs/network-security.md).
- `OLLAMA_GPU_OVERHEAD` must be an integer byte count (script default
  `4294967296` = 4 GiB). If you override with a value like `4G`, **Ollama**
  rejects it and falls back to `0` — the script does not coerce the override.

## Storage caveat

Compose mounts hub `MODEL_ROOT` at `/root/.ollama`. Host `ollama` uses
`OLLAMA_MODELS` or `~/.ollama` unless you point it at the same root. Without
that alignment, host `pull`/`create` and Compose `npm run ollama -- list` see
different stores. `npm run ollama:host` sets `OLLAMA_MODELS` automatically when
possible.

## Tuning notes

Short host-tuning guidance: [host-tuning.md](host-tuning.md).
