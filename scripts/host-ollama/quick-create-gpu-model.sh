#!/usr/bin/env bash
# Thin wrapper around create-gpu-model.sh
# Usage: ./quick-create-gpu-model.sh <model> [version] [optimized|offload|both] [context_size] [monitors]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODEL="${1:-}"
VERSION="${2:-latest}"
TYPE="${3:-both}"
CONTEXT="${4:-16384}"
MONITORS="${5:-1}"

if [ -z "$MODEL" ]; then
  echo "Usage: $0 <model> [version] [optimized|offload|both] [context_size] [monitors]"
  echo "Example: $0 llama3.1 8b both 16384 2"
  echo ""
  echo "Prefer the managed Compose profile when possible:"
  echo "  npm run stack -- switch ollama"
  echo "  npm run ollama -- pull llama3.1:8b"
  exit 1
fi

ARGS=(-m "$MODEL" -v "$VERSION" --context-size "$CONTEXT" --monitors "$MONITORS")

case "$TYPE" in
  optimized) ARGS+=(--optimized-only) ;;
  offload) ARGS+=(--offload-only) ;;
  both) ARGS+=(--both) ;;
  *)
    echo "Type must be: optimized, offload, or both" >&2
    exit 1
    ;;
esac

exec "$SCRIPT_DIR/create-gpu-model.sh" "${ARGS[@]}"
