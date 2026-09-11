# Host Ollama tuning notes

These notes apply only to a **host-installed** Ollama binary. For the managed
profile, use [Ollama Docker setup](../../docs/ollama-docker-setup.md) and
`npm run stack -- switch ollama`.

## Bind address

Default to localhost. Example safe startup env:

```bash
export OLLAMA_FLASH_ATTENTION=1
export OLLAMA_KV_CACHE_TYPE=q8_0
export OLLAMA_KEEP_ALIVE=5m
export OLLAMA_NUM_PARALLEL=1
# Integer bytes only — not "4G"
export OLLAMA_GPU_OVERHEAD=4294967296
# Leave OLLAMA_HOST unset for 127.0.0.1
ollama serve
```

Or run `./scripts/host-ollama/start-ollama.sh`.

If you must listen beyond loopback, treat it like any other non-local bind:
firewall, authentication (for example Caddy basic auth), TLS, and a rollback
plan. See [Network security](../../docs/network-security.md). Do not copy
`OLLAMA_HOST=0.0.0.0` examples into production without those controls.

## Display / multi-monitor VRAM

Reserve roughly 1–1.5 GB per active high-resolution display when estimating
`num_gpu` for Modelfiles. The create script does this via `--monitors`.

## Single-GPU contention

Host `ollama serve` and Compose GPU profiles (`inference`, `media`, `comfy`,
`ollama`) compete for the same device. Stop conflicting GPU consumers before
starting another. On this hub, prefer `npm run stack -- switch PROFILE`.

## Modelfile variants

Use `create-gpu-model.sh` after `ollama pull name:tag`:

- **optimized** — estimated layer count from usable VRAM
- **offload** — `num_gpu 999` (push layers to GPU until VRAM fills)

Verify with `ollama list`, `ollama ps`, and `nvidia-smi`.
