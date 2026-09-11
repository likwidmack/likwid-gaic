#!/usr/bin/env bash
# Host-native Ollama serve helper (bypasses the managed Compose profile).
# Prefer: npm run stack -- switch ollama
#
# Bind stays on Ollama's localhost default unless you export OLLAMA_HOST yourself.
# Do not set OLLAMA_HOST=0.0.0.0 without firewall, auth, and rollback planning
# (see docs/network-security.md).
#
# Blob store: set OLLAMA_MODELS to the hub MODEL_ROOT (see config/storage.json)
# if you want host create/serve to share Compose blobs. Otherwise host Ollama
# uses its own default store (~/.ollama), separate from the managed profile.

set -euo pipefail

if ! command -v ollama >/dev/null 2>&1; then
  echo "ollama not found on PATH" >&2
  echo "Prefer: npm run stack -- switch ollama" >&2
  exit 1
fi

if [ -n "${OLLAMA_HOST:-}" ] && [[ ! "${OLLAMA_HOST}" =~ ^(127\.0\.0\.1|localhost)(:|$) ]]; then
  echo "Warning: OLLAMA_HOST=${OLLAMA_HOST} is not loopback." >&2
  echo "Broaden binds only with firewall, auth, TLS, and rollback planning." >&2
fi

# Flash attention on supported NVIDIA GPUs
export OLLAMA_FLASH_ATTENTION="${OLLAMA_FLASH_ATTENTION:-1}"

# Integer bytes only (Ollama rejects values like 4G and falls back to 0 itself).
# Default: 4 GiB display headroom.
export OLLAMA_GPU_OVERHEAD="${OLLAMA_GPU_OVERHEAD:-4294967296}"

# Align with managed Compose defaults unless overridden
export OLLAMA_MAX_LOADED_MODELS="${OLLAMA_MAX_LOADED_MODELS:-1}"
export OLLAMA_KV_CACHE_TYPE="${OLLAMA_KV_CACHE_TYPE:-q8_0}"
export OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-5m}"
export OLLAMA_NUM_PARALLEL="${OLLAMA_NUM_PARALLEL:-1}"

exec ollama serve
