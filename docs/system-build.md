# System build and AI runtime review

Inventory date: 2026-08-23

## Hardware and host

| Component | Detected configuration | Assessment |
| --- | --- | --- |
| System | ASUS desktop | Suitable AI workstation |
| CPU | Intel Core Ultra 9 285K, 24 cores / 24 threads | Strong ingestion, preprocessing, and CPU fallback |
| Host RAM | 95.3 GiB usable (96 GB class) | Good for large indexes and model offload |
| WSL memory | 46 GiB exposed to Ubuntu | Adequate, but only about half of host RAM is exposed |
| GPU | NVIDIA GeForce RTX 5090 | Excellent local inference and image generation |
| VRAM | 32,607 MiB | Well suited to quantized 30B-class LLMs |
| Driver | NVIDIA 610.88; compute capability 12.0 | Prefer CUDA 13 images when supported |
| OS | Windows + WSL2 Ubuntu 24.04.3 LTS | Good Docker Desktop/Linux combination |
| Storage | C: 3.7 TB / 2.7 TB free; E: 1.9 TB / 1.4 TB free | Keep models on E: and source in `E:\git` |

## Recommended topology

1. `LocalAI-Prt` provides the OpenAI-compatible inference API on the RTX 5090.
2. `private-gpt-tm` provides ingestion, retrieval, prompting, and the private document UI/API.
3. `stable-diffusion-ui` and ComfyUI provide image/video generation.
4. `E:\models` is the canonical model store; project folders should link or mount into it.
5. This repository is the control plane and stores metadata/configuration, never binary weights.

## Runtime findings

- Docker client 29.1.3 is connected to server 29.7.2.
- `localai/localai:latest-gpu-nvidia-cuda-13` is installed and appropriate for this GPU.
- `localai-prt-api-1` exists but is stopped. Compose maps host 8080 to container 4300 and requests placeholder model `phi-2`, while its project model folder is empty.
- Docker Model Runner has 11 registered models and about 93 GB of blobs, but `docker model list` cannot reach `localhost:12434`. Enable Model Runner in Docker Desktop before relying on it.
- No active PrivateGPT/Ollama container was found. PrivateGPT supports an Ollama CUDA profile, but its local model folder is empty.
- Active non-AI containers occupy ports 3900/3901. Other stopped stacks use 4100, 4200, 4300, 5432, 8000, and 8080 configurations.

## Setup corrections

1. Enable Docker Desktop GPU support and Docker Model Runner, then confirm `docker model list` works.
2. Choose one primary LLM server. LocalAI best matches the existing fork and CUDA 13 image.
3. Replace LocalAI's `phi-2` placeholder with an explicit model configuration.
4. Mount `E:\models` read-only where practical instead of copying weights into repositories.
5. Keep generated images in `E:\data`, never in Git.
6. Review mass modifications in `private-gpt-tm` and `stable-diffusion-ui` before pulling. They may be line-ending normalization. The tracker blocks dirty-tree merges.

## Model fit

- Fast chat: Gemma 3, Llama 3.2, or Qwen3 4B.
- Coding: Qwen3 Coder 30B is a strong fit for 32 GB VRAM when quantized.
- Reasoning: GPT-OSS or DeepSeek R1 Distill, subject to quantization and context size.
- Vision: Qwen3-VL or SmolVLM.
- Images/video: SD 1.5 is light; Flux 2 and Wan 2.2 may require RAM offload.

Benchmark representative prompts one model at a time and record tokens/second, VRAM, context length, and quality.
