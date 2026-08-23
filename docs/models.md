# Model and image asset inventory

## Docker Model Runner

| Model tag | Intended use |
| --- | --- |
| `ai/llama3.2:latest` | Lightweight chat |
| `ai/llama3.3:latest` | General chat |
| `ai/gemma3:latest` | General/multimodal prompting |
| `ai/qwen3:4B-F16` | Fast general chat |
| `ai/qwen3-coder:30B` | Coding |
| `ai/qwen3-vl:latest` | Vision-language prompting |
| `ai/gpt-oss:latest` | General reasoning |
| `ai/deepseek-r1-distill-llama:latest` | Reasoning |
| `ai/smolvlm:latest` | Lightweight vision |
| `ai/smollm2-vllm:latest` | Lightweight vLLM serving |
| `ai/stable-diffusion:Q4` | Image generation |

The weights remain in the Docker volume even though the Model Runner API is stopped.

## Shared image/video models

| Family | Detected assets |
| --- | --- |
| Flux 2 | 33.02 GiB diffusion model, 33.14 GiB Mistral encoder, VAE, LoRA |
| Wan 2.2 I2V | Two 13.31 GiB models, UMT5/Qwen VL encoders, acceleration LoRAs |
| Kandinsky 5 Lite | 4.26 GiB text-to-video and 4.26 GiB image-to-video models |
| Stable Diffusion 1.5 | 3.97 GiB checkpoint |

The same ComfyUI assets appear under `E:\models` and `E:\git\ComfyUI\models`, suggesting a shared path or junction. Do not duplicate them until confirmed.

Run `npm run inventory` for the detailed local snapshot.
