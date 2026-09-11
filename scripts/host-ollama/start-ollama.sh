#!/usr/bin/env bash
# Host-native Ollama serve helper (bypasses the managed Compose profile).
# Prefer: npm run stack -- switch ollama
#
# Bind stays on Ollama's localhost default unless you export OLLAMA_HOST yourself.
# Do not set OLLAMA_HOST=0.0.0.0 without firewall, auth, and rollback planning
# (see docs/network-security.md).

set -euo pipefail

# Flash attention on supported NVIDIA GPUs
export OLLAMA_FLASH_ATTENTION="${OLLAMA_FLASH_ATTENTION:-1}"

# Integer bytes only (Ollama rejects values like 4G). Default: 4 GiB display headroom.
export OLLAMA_GPU_OVERHEAD="${OLLAMA_GPU_OVERHEAD:-4294967296}"

# Align with managed Compose default unless overridden
export OLLAMA_KV_CACHE_TYPE="${OLLAMA_KV_CACHE_TYPE:-q8_0}"
export OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-5m}"
export OLLAMA_NUM_PARALLEL="${OLLAMA_NUM_PARALLEL:-1}"

exec ollama serve
