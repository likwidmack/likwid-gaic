#!/usr/bin/env bash
# Download managed Hub pins, verify them, sync LocalAI YAML, and create
# Stable Diffusion WebUI hard links under Stable-diffusion/.
#
# Run from the repository root (or any cwd; the script locates the hub):
#   bash scripts/bootstrap-optional-models.sh
#   bash scripts/bootstrap-optional-models.sh --starters
#   bash scripts/bootstrap-optional-models.sh --all
#   bash scripts/bootstrap-optional-models.sh chat-qwen2.5-7b sdxl-base
#   bash scripts/bootstrap-optional-models.sh --links-only
#   bash scripts/bootstrap-optional-models.sh --force-links
#
# On Windows without bash in PATH, use the PowerShell twin:
#   powershell -NoProfile -File scripts/bootstrap-optional-models.ps1
# npm run models:bootstrap-optional invokes this bash script.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STARTERS=(chat-qwen2.5-3b embed-nomic-v1.5 sd15-starter)
OPTIONAL=(chat-qwen2.5-7b chat-qwen2.5-coder-7b sdxl-base stt-whisper-base tts-piper-en-us)

LINKS_ONLY=0
FORCE_LINKS=0
SKIP_SYNC=0
ALIASES=()

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --starters) ALIASES+=("${STARTERS[@]}"); shift ;;
    --optional) ALIASES+=("${OPTIONAL[@]}"); shift ;;
    --all) ALIASES+=("${STARTERS[@]}" "${OPTIONAL[@]}"); shift ;;
    --links-only) LINKS_ONLY=1; shift ;;
    --force-links) FORCE_LINKS=1; shift ;;
    --skip-sync) SKIP_SYNC=1; shift ;;
    --) shift; ALIASES+=("$@"); break ;;
    -*)
      echo "Unknown option: $1" >&2
      usage 2
      ;;
    *) ALIASES+=("$1"); shift ;;
  esac
done

if [[ ${#ALIASES[@]} -eq 0 && "$LINKS_ONLY" -eq 0 ]]; then
  ALIASES=("${OPTIONAL[@]}")
fi

# Deduplicate while preserving order
if [[ ${#ALIASES[@]} -gt 0 ]]; then
  mapfile -t ALIASES < <(printf '%s\n' "${ALIASES[@]}" | awk 'NF && !seen[$0]++')
fi

MODELS_ROOT="$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { hostPath } from './scripts/paths.mjs';
const storage = JSON.parse(readFileSync('./config/storage.json', 'utf8'));
process.stdout.write(hostPath(storage.roots.models));
")"

if [[ -z "$MODELS_ROOT" ]]; then
  echo "Could not resolve models root from config/storage.json" >&2
  exit 1
fi

echo "Models root: $MODELS_ROOT"
mkdir -p "$MODELS_ROOT/Stable-diffusion" "$MODELS_ROOT/checkpoints"

hardlink() {
  local source="$1"
  local target="$2"
  if [[ ! -f "$source" ]]; then
    echo "Skip link (missing source): $source"
    return 0
  fi
  mkdir -p "$(dirname "$target")"
  if [[ -e "$target" || -L "$target" ]]; then
    if [[ "$FORCE_LINKS" -eq 1 ]]; then
      rm -f "$target"
    else
      echo "Skip link (exists): $target"
      return 0
    fi
  fi
  ln "$source" "$target"
  echo "Hard-linked: $target -> $source"
}

create_webui_links() {
  hardlink \
    "$MODELS_ROOT/checkpoints/v1-5-pruned-emaonly-fp16.safetensors" \
    "$MODELS_ROOT/Stable-diffusion/v1-5-pruned-emaonly-fp16.safetensors"
  hardlink \
    "$MODELS_ROOT/checkpoints/sd_xl_base_1.0.safetensors" \
    "$MODELS_ROOT/Stable-diffusion/sd_xl_base_1.0.safetensors"
}

if [[ "$LINKS_ONLY" -eq 0 ]]; then
  for alias in "${ALIASES[@]}"; do
    echo ""
    echo "=== download $alias ==="
    npm run models -- download "$alias"
    echo "=== verify $alias ==="
    npm run models -- verify "$alias"
  done
  if [[ "$SKIP_SYNC" -eq 0 ]]; then
    echo ""
    echo "=== sync-localai ==="
    npm run models -- sync-localai
  fi
fi

echo ""
echo "=== WebUI hard links ==="
create_webui_links

echo ""
echo "Done. Re-check with: npm run models -- recommendations media"
