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
GPU exclusivity (`stack -- switch`), the gateway, and Compose env defaults.

## Scripts

| Script                      | Purpose                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| `create-gpu-model.sh`       | Build optimized / offload Modelfile variants from a pulled base tag    |
| `quick-create-gpu-model.sh` | Positional-arg wrapper around `create-gpu-model.sh`                    |
| `start-ollama.sh`           | Host `ollama serve` with safe defaults (localhost bind, byte overhead) |

## Usage

From the repository root (Git Bash / WSL / Linux / macOS):

```bash
chmod +x scripts/host-ollama/*.sh

# Pull a base model on the host first
ollama pull llama3.1:8b

# Create both optimized and offload variants (detects VRAM via nvidia-smi)
./scripts/host-ollama/create-gpu-model.sh -m llama3.1 -v 8b

# Two displays, optimized only
./scripts/host-ollama/create-gpu-model.sh -m mistral -v 7b --optimized-only --monitors 2

# Quick wrapper
./scripts/host-ollama/quick-create-gpu-model.sh llama3.1 8b both 16384 1

# Host serve (optional; conflicts with Compose ollama on the same GPU)
./scripts/host-ollama/start-ollama.sh
```

Hardware defaults come from the host (`nproc`, `nvidia-smi`). Override with
`--vram`, `--num-threads`, and `--monitors`.

## Network and security

- Leave `OLLAMA_HOST` unset so Ollama binds to localhost.
- Do not publish `0.0.0.0` without the controls in
  [Network security](../../docs/network-security.md).
- `OLLAMA_GPU_OVERHEAD` must be an integer byte count (default `4294967296` =
  4 GiB). Values like `4G` are rejected and fall back to `0`.

## Tuning notes

Short host-tuning guidance: [host-tuning.md](host-tuning.md).
