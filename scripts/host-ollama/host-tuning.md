# Host Ollama tuning notes

These notes apply only to a **host-installed** Ollama binary. For the managed
profile, use [Ollama Docker setup](../../docs/ollama-docker-setup.md) and
`npm run stack -- switch ollama`.

## Bind address

Default to localhost. Example safe startup env:

```bash
export OLLAMA_FLASH_ATTENTION=1
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_KV_CACHE_TYPE=q8_0
export OLLAMA_KEEP_ALIVE=5m
export OLLAMA_NUM_PARALLEL=1
# Integer bytes only — not "4G" (Ollama rejects "4G" and uses 0)
export OLLAMA_GPU_OVERHEAD=4294967296
# Optional: share Compose blobs
# export OLLAMA_MODELS=/c/gaic/models
# Leave OLLAMA_HOST unset for 127.0.0.1
ollama serve
```

Or run `npm run ollama:host -- serve` (preferred) or
`./scripts/host-ollama/start-ollama.sh`.

If you must listen beyond loopback, treat it like any other non-local bind:
firewall, authentication (for example Caddy basic auth), TLS, and a rollback
plan. See [Network security](../../docs/network-security.md). Do not copy
`OLLAMA_HOST=0.0.0.0` examples into production without those controls.

## Display / multi-monitor VRAM

The create script reserves **1.5 GB per `--monitors` count** when estimating
`num_gpu`. That is a heuristic for high-resolution displays, not a measured
display budget. `start-ollama.sh` also sets `OLLAMA_GPU_OVERHEAD` (default
4 GiB) at the server — avoid stacking both blindly; prefer one headroom
mechanism for a given workload.

## Single-GPU contention

Host `ollama serve` and Compose GPU profiles (`inference`, `media`, `comfy`,
`ollama`) compete for the same device. Prefer `npm run ollama:host -- serve`
(or `create` / `quick`): the wrapper refuses when any Compose GPU-exclusive
service is already running. Override only with `--allow-gpu-share` or
`GAIC_GPU_EXCLUSIVE=false`. On this hub, prefer
`npm run stack -- switch PROFILE` for managed consumers.

## Modelfile variants

Use `create-gpu-model.sh` after `ollama pull name:tag`:

- **optimized** — estimated layer count from usable VRAM (`num_gpu`)
- **offload** — `num_gpu 999` (push layers to GPU until VRAM fills)

Modelfile PARAMs used: `num_gpu`, `num_thread`, `num_ctx`, `num_batch`,
`seed`, `main_gpu` (plus optional mirostat knobs for 70B-ish names). Flash
attention and KV quantization stay on the **server** env
(`OLLAMA_FLASH_ATTENTION`, `OLLAMA_KV_CACHE_TYPE=q8_0`), matching Compose.

Verify with `ollama list`, `ollama ps`, and `nvidia-smi`.
