#!/usr/bin/env bash
# Host-native Ollama Modelfile helper (not the managed Compose profile).
# Prefer: npm run stack -- switch ollama && npm run ollama -- pull|list
#
# Usage: ./create-gpu-model.sh -m MODEL [-v VERSION] [OPTIONS]

set -euo pipefail

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
CYAN=$'\033[0;36m'
NC=$'\033[0m'

MODEL_NAME=""
MODEL_VERSION="latest"
CREATE_OPTIMIZED=true
CREATE_OFFLOAD=true
CONTEXT_SIZE=16384
BATCH_SIZE=1024
NUM_THREADS=""
VRAM_GB=""
MONITORS=1
MODEL_DIR="modelfiles"
VERBOSE=false
KEEP_FILES=true

print_error() { echo -e "${RED}✗ $1${NC}" >&2; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_info() { echo -e "${YELLOW}→ $1${NC}"; }
print_header() { echo -e "${CYAN}▶ $1${NC}"; }
print_debug() { [ "$VERBOSE" = true ] && echo -e "${BLUE}DEBUG: $1${NC}"; }

detect_cpu_cores() {
  if command -v nproc >/dev/null 2>&1; then
    nproc
  elif command -v getconf >/dev/null 2>&1; then
    getconf _NPROCESSORS_ONLN
  else
    echo "8"
  fi
}

detect_vram_gb() {
  if command -v nvidia-smi >/dev/null 2>&1; then
    local mb
    mb=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -d '[:space:]')
    if [[ "$mb" =~ ^[0-9]+$ ]] && [ "$mb" -gt 0 ]; then
      echo $((mb / 1024))
      return
    fi
  fi
  echo "8"
}

# Estimate GPU layers from usable VRAM after display overhead.
calculate_num_gpu() {
  local type="$1"
  local monitor_count="${2:-$MONITORS}"
  local vram_gb="${3:-$VRAM_GB}"

  if [ "$type" = "offload" ]; then
    echo "999"
    return
  fi

  local display_overhead usable_vram model_vram layers
  display_overhead=$(awk -v m="$monitor_count" 'BEGIN { printf "%.2f", m * 1.5 }')
  usable_vram=$(awk -v v="$vram_gb" -v d="$display_overhead" 'BEGIN { printf "%.2f", v - d }')
  model_vram=$(awk -v u="$usable_vram" 'BEGIN { printf "%.2f", u * 0.75 }')
  layers=$(awk -v m="$model_vram" 'BEGIN { printf "%d", m * 3.2 }')

  if [ "$layers" -lt 15 ]; then
    layers=15
  elif [ "$layers" -gt 180 ]; then
    layers=180
  fi

  echo "$layers"
}

show_help() {
  local display_gb available_gb opt_layers
  display_gb=$(awk -v m="$MONITORS" 'BEGIN { printf "%.2f", m * 1.5 }')
  available_gb=$(awk -v v="$VRAM_GB" -v d="$display_gb" 'BEGIN { printf "%.2f", v - d }')
  opt_layers=$(calculate_num_gpu "optimized" "$MONITORS" "$VRAM_GB")

  cat << EOF
${CYAN}Host Ollama GPU model creator${NC}
${YELLOW}=============================${NC}

Host-native helper for building optimized/offload Modelfile variants.
This does NOT replace the managed Compose profile:

  npm run stack -- switch ollama
  npm run ollama -- pull MODEL
  npm run ollama -- list

${GREEN}Detected defaults:${NC}
  • CPU cores: ${CPU_CORES}
  • VRAM: ${VRAM_GB}GB (override with --vram)
  • Threads: ${NUM_THREADS}
  • Monitors: ${MONITORS} (~${display_gb}GB display reserve → ~${available_gb}GB usable)
  • Optimized num_gpu estimate: ${opt_layers}
  • Offload num_gpu: 999

${GREEN}USAGE:${NC}
  $0 -m MODEL [-v VERSION] [OPTIONS]

${GREEN}REQUIRED:${NC}
  -m, --model MODEL         Base model name (e.g., llama3.1, mistral, qwen2)

${GREEN}OPTIONS:${NC}
  -v, --version VERSION     Model tag/version (default: latest)
  --both                    Create both optimized and offload (default)
  --optimized-only          Create only optimized model
  --offload-only            Create only offload model
  --context-size N          Context window size (default: 16384)
  --batch-size N            Batch size (default: 1024)
  --num-threads N           CPU threads (default: detected cores - 4, min 1)
  --vram N                  Total GPU VRAM in GB (default: nvidia-smi or 8)
  --monitors N              Display count for VRAM reserve (default: 1)
  --model-dir DIR           Directory for Modelfiles (default: modelfiles)
  --no-keep                 Don't keep Modelfiles after creation
  --verbose                 Show detailed output
  -h, --help                Show this help

${GREEN}EXAMPLES:${NC}
  $0 -m llama3.1 -v 8b
  $0 -m mistral -v 7b --optimized-only --monitors 2
  $0 -m llama3.1 -v 70b --vram 24 --model-dir ./modelfiles

EOF
}

CPU_CORES=$(detect_cpu_cores)
VRAM_GB=$(detect_vram_gb)
NUM_THREADS=$((CPU_CORES > 4 ? CPU_CORES - 4 : 1))

while [[ $# -gt 0 ]]; do
  case $1 in
    -m|--model)
      MODEL_NAME="$2"
      shift 2
      ;;
    -v|--version)
      MODEL_VERSION="$2"
      shift 2
      ;;
    --both)
      CREATE_OPTIMIZED=true
      CREATE_OFFLOAD=true
      shift
      ;;
    --optimized-only)
      CREATE_OPTIMIZED=true
      CREATE_OFFLOAD=false
      shift
      ;;
    --offload-only)
      CREATE_OPTIMIZED=false
      CREATE_OFFLOAD=true
      shift
      ;;
    --context-size)
      CONTEXT_SIZE="$2"
      shift 2
      ;;
    --batch-size)
      BATCH_SIZE="$2"
      shift 2
      ;;
    --num-threads)
      NUM_THREADS="$2"
      shift 2
      ;;
    --vram)
      VRAM_GB="$2"
      shift 2
      ;;
    --model-dir)
      MODEL_DIR="$2"
      shift 2
      ;;
    --monitors)
      MONITORS="$2"
      shift 2
      ;;
    --no-keep)
      KEEP_FILES=false
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      print_error "Unknown option: $1"
      echo "Use -h or --help for usage information" >&2
      exit 1
      ;;
  esac
done

if [ -z "$MODEL_NAME" ]; then
  print_error "Model name is required!"
  echo "Use -m or --model to specify the model" >&2
  echo "Run with -h for help" >&2
  exit 1
fi

if ! [[ "$MONITORS" =~ ^[0-9]+$ ]] || [ "$MONITORS" -lt 1 ]; then
  print_error "Invalid --monitors value: ${MONITORS}"
  exit 1
fi

if ! [[ "$VRAM_GB" =~ ^[0-9]+$ ]] || [ "$VRAM_GB" -lt 1 ]; then
  print_error "Invalid --vram value: ${VRAM_GB}"
  exit 1
fi

DISPLAY_VRAM_GB=$(awk -v m="$MONITORS" 'BEGIN { printf "%.2f", m * 1.5 }')
AVAILABLE_VRAM=$(awk -v v="$VRAM_GB" -v d="$DISPLAY_VRAM_GB" 'BEGIN { printf "%.2f", v - d }')
if awk -v a="$AVAILABLE_VRAM" 'BEGIN { exit !(a <= 0) }'; then
  print_error "Display reserve (${DISPLAY_VRAM_GB}GB) leaves no usable VRAM from ${VRAM_GB}GB"
  exit 1
fi

SAFE_MODEL_NAME=$(echo "$MODEL_NAME" | sed 's/[\/:]/_/g')
SAFE_MODEL_VERSION=$(echo "$MODEL_VERSION" | sed 's/[\/:]/_/g')
MODEL_DIR_FULL="${MODEL_DIR}/${SAFE_MODEL_NAME}_${SAFE_MODEL_VERSION}"
BASE_TAG="${MODEL_NAME}:${MODEL_VERSION}"

OPTIMIZED_NUM_GPU=$(calculate_num_gpu "optimized")
OFFLOAD_NUM_GPU=$(calculate_num_gpu "offload")

print_header "Host Ollama GPU model creator"
echo ""
echo "  • CPU cores: ${CPU_CORES}"
echo "  • VRAM: ${VRAM_GB}GB"
echo "  • Monitors: ${MONITORS} (${DISPLAY_VRAM_GB}GB reserved for display)"
echo "  • Available VRAM for AI: ${AVAILABLE_VRAM}GB"
echo "  • Model: ${BASE_TAG}"
echo "  • Context: ${CONTEXT_SIZE} tokens"
echo "  • Threads: ${NUM_THREADS}"
echo "  • Batch: ${BATCH_SIZE}"
echo "  • Model Dir: ${MODEL_DIR_FULL}"
echo ""

print_info "Checking for ${BASE_TAG}..."
# ollama list NAME column is name:tag (e.g. llama3.1:8b)
if ! ollama list 2>/dev/null | awk -v tag="$BASE_TAG" 'NR > 1 && $1 == tag { found=1 } END { exit !found }'; then
  print_error "Model not found locally!"
  echo ""
  print_info "Pull it first:"
  echo "  ollama pull ${BASE_TAG}"
  echo ""
  print_info "Managed Compose alternative:"
  echo "  npm run stack -- switch ollama"
  echo "  npm run ollama -- pull ${BASE_TAG}"
  exit 1
fi
print_success "Base model found"

mkdir -p "$MODEL_DIR_FULL"
print_success "Created directory: ${MODEL_DIR_FULL}"

estimate_model_size() {
  local tag="$1"
  local size_info
  size_info=$(ollama list 2>/dev/null | awk -v tag="$tag" 'NR > 1 && $1 == tag { print $2; exit }')
  if [ -n "$size_info" ]; then
    echo "$size_info"
  else
    echo "unknown"
  fi
}

print_info "GPU settings: optimized=${OPTIMIZED_NUM_GPU}, offload=${OFFLOAD_NUM_GPU}"

create_modelfile() {
  local suffix="$1"
  local num_gpu="$2"
  local model_file="${MODEL_DIR_FULL}/Modelfile-${suffix}"
  local new_model_name="${MODEL_NAME}-${suffix}:${MODEL_VERSION}"
  local effective_batch="$BATCH_SIZE"

  print_info "Creating ${new_model_name}..."
  print_debug "Modelfile path: ${model_file}"

  if ! ollama show --modelfile "${BASE_TAG}" > "$model_file" 2>/dev/null; then
    print_error "Failed to get Modelfile for ${BASE_TAG}"
    return 1
  fi

  # Portable in-place edit (GNU and BSD sed)
  if sed --version >/dev/null 2>&1; then
    sed -i '/^PARAMETER num_gpu/d' "$model_file"
  else
    sed -i.bak '/^PARAMETER num_gpu/d' "$model_file"
    rm -f "${model_file}.bak"
  fi

  if [ "$MONITORS" -ge 3 ]; then
    effective_batch=$(awk -v b="$BATCH_SIZE" 'BEGIN { printf "%d", b * 0.8 }')
  fi

  cat >> "$model_file" << EOF

# Host GPU optimizations
# Base: ${BASE_TAG}
# Monitors: ${MONITORS} (${DISPLAY_VRAM_GB}GB reserved)
# Available VRAM: ${AVAILABLE_VRAM}GB
# Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)

PARAMETER num_gpu ${num_gpu}
PARAMETER num_thread ${NUM_THREADS}
PARAMETER num_ctx ${CONTEXT_SIZE}
PARAMETER batch_size ${effective_batch}
PARAMETER seed 42
PARAMETER numa true
PARAMETER main_gpu 0
PARAMETER flash_attn true
PARAMETER kv_cache_type f16
PARAMETER mmap true
PARAMETER mlock false

EOF

  if [[ "$MODEL_NAME" == *"70b"* ]] || [[ "$MODEL_VERSION" == *"70b"* ]]; then
    cat >> "$model_file" << EOF
PARAMETER mirostat 2
PARAMETER mirostat_tau 5.0
PARAMETER mirostat_eta 0.1
PARAMETER repeat_penalty 1.1

EOF
  fi

  print_debug "Creating with: ollama create ${new_model_name} -f ${model_file}"
  if ollama create "${new_model_name}" -f "$model_file" >/dev/null 2>&1; then
    print_success "Created ${new_model_name}"
    return 0
  fi

  print_error "Failed to create ${new_model_name}"
  return 1
}

SUCCESS_COUNT=0
FAILED_COUNT=0
CREATED_FILES=()

if [ "$CREATE_OPTIMIZED" = true ]; then
  echo ""
  print_header "Creating Optimized Model (num_gpu=${OPTIMIZED_NUM_GPU})"
  if create_modelfile "optimized" "$OPTIMIZED_NUM_GPU"; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    CREATED_FILES+=("${MODEL_DIR_FULL}/Modelfile-optimized")
  else
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
fi

if [ "$CREATE_OFFLOAD" = true ]; then
  echo ""
  print_header "Creating Offload Model (num_gpu=${OFFLOAD_NUM_GPU})"
  if create_modelfile "offload" "$OFFLOAD_NUM_GPU"; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    CREATED_FILES+=("${MODEL_DIR_FULL}/Modelfile-offload")
  else
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
fi

if [ "$KEEP_FILES" = false ]; then
  print_info "Cleaning up Modelfiles (--no-keep specified)..."
  for file in "${CREATED_FILES[@]}"; do
    if [ -f "$file" ]; then
      rm -f "$file"
      print_debug "Removed: $file"
    fi
  done
  rmdir "$MODEL_DIR_FULL" 2>/dev/null || true
fi

echo ""
print_header "Creation summary"
echo ""
echo "  VRAM Allocation (${MONITORS} monitors):"
echo "    • Total VRAM: ${VRAM_GB}GB"
echo "    • Display overhead: ${DISPLAY_VRAM_GB}GB"
echo "    • Available for AI: ${AVAILABLE_VRAM}GB"
echo ""

if [ "$CREATE_OPTIMIZED" = true ]; then
  echo "  ${MODEL_NAME}-optimized:${MODEL_VERSION}  (num_gpu=${OPTIMIZED_NUM_GPU})"
fi
if [ "$CREATE_OFFLOAD" = true ]; then
  echo "  ${MODEL_NAME}-offload:${MODEL_VERSION}  (num_gpu=${OFFLOAD_NUM_GPU})"
fi
echo ""

if [ "$FAILED_COUNT" -eq 0 ]; then
  print_success "Created ${SUCCESS_COUNT} model(s) successfully!"
else
  print_error "${FAILED_COUNT} model(s) failed to create"
fi

echo ""
print_header "How to run"
echo ""
if [ "$CREATE_OPTIMIZED" = true ]; then
  echo "  ollama run ${MODEL_NAME}-optimized:${MODEL_VERSION}"
fi
if [ "$CREATE_OFFLOAD" = true ]; then
  echo "  ollama run ${MODEL_NAME}-offload:${MODEL_VERSION}"
fi
echo ""
echo "  # Or via the managed Compose profile:"
echo "  npm run stack -- switch ollama"
echo "  npm run ollama -- list"
echo ""

if [ "$FAILED_COUNT" -gt 0 ]; then
  exit 1
fi
