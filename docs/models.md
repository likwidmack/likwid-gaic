# Model and image asset inventory

## Managed model workflow

`config/models.json` stores Hugging Face repository IDs, revisions, include filters, and destinations, never weights or access tokens. Install the current `hf` CLI in WSL:

```bash
curl -LsSf https://hf.co/cli/install.sh | bash -s
hf auth login
```

Register, dry-run, download, and verify:

```powershell
npm run models -- add my-model owner/repository main localai/my-model
npm run models -- plan my-model
npm run models -- download my-model
npm run models -- verify my-model
```

Before downloading, set the `include` list on each entry when only selected GGUF or safetensors files are needed. `sync-localai` materializes LocalAI YAML files from registered `localAI` metadata. Other commands are `search`, `inventory`, `cache`, and `auth`. There is deliberately no deletion command.

The checked-in manifest currently pins:

| Alias | Hugging Face artifact | Use |
| --- | --- | --- |
| `chat-qwen2.5-3b` | Qwen2.5 3B Instruct Q4_K_M, 2.1 GB | LocalAI chat and PrivateGPT default LLM |
| `embed-nomic-v1.5` | Nomic Embed Text v1.5 Q4_K_M, 84.1 MB | LocalAI embeddings and PrivateGPT RAG, 768 dimensions |

Install them with `plan`, `download`, and `verify`, then run `npm run models -- sync-localai`. The repositories are pinned to immutable Hub revisions, and verification checks the selected files against Hub checksums.

## Managed media workflow

```powershell
npm run media -- init
npm run media -- status
npm run media -- latest images
npm run media -- index
```

The metadata-only index is stored outside Git at `E:\data\forkedAI\media\.forkedai\index.json`. Media commands never delete generated assets.


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
