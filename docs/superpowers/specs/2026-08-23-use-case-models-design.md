# Use-case models and UI how-tos

## Goal

Map personal and company workloads (finance, architecture, IoT, research,
planning, generative image/audio) to Compose profiles, curated free/low-cost
managed model pins, and Docker/Web UI how-tos—without changing default
PrivateGPT model IDs or broadening gateway exposure.

## Decisions (approved)

| Decision            | Choice                                                            |
| ------------------- | ----------------------------------------------------------------- |
| Deliverable         | Docs plus a small curated set of managed Hub pins                 |
| GenAI depth         | Image + light audio (STT/TTS); video out of scope                 |
| LocalAI YAML        | Extend `sync-localai` for `transcription` and `tts`               |
| Required starters   | Unchanged (`chat-qwen2.5-3b`, `embed-nomic-v1.5`, `sd15-starter`) |
| New pins            | Optional downloads; selective `stronglyRecommended` only          |
| PrivateGPT defaults | Stay on 3B chat + nomic; document env override for 7B             |
| Checkpoint sharing  | Hard links for files (`HardLink`); junctions are directories-only |

## Managed pins

| Alias                   | Repo                                       | Artifact                                | LocalAI type   |
| ----------------------- | ------------------------------------------ | --------------------------------------- | -------------- |
| `chat-qwen2.5-7b`       | `bartowski/Qwen2.5-7B-Instruct-GGUF`       | `Qwen2.5-7B-Instruct-Q4_K_M.gguf`       | chat           |
| `chat-qwen2.5-coder-7b` | `Qwen/Qwen2.5-Coder-7B-Instruct-GGUF`      | `qwen2.5-coder-7b-instruct-q4_k_m.gguf` | chat           |
| `sdxl-base`             | `stabilityai/stable-diffusion-xl-base-1.0` | `sd_xl_base_1.0.safetensors`            | (weights only) |
| `stt-whisper-base`      | `ggerganov/whisper.cpp`                    | `ggml-base.bin`                         | transcription  |
| `tts-piper-en-us`       | `rhasspy/piper-voices`                     | lessac medium onnx + json               | tts            |

Catalog-only in docs (no pin): 14B+ chat, Flux-class image, video models.

## Code

- `config/models.json` — add the five aliases with 40-character revisions.
- `scripts/models.mjs` — branch `sync-localai` on `type`.
- `scripts/validate.mjs` — allow `chat` \| `embedding` \| `transcription` \| `tts`; require `contextSize` / `gpuLayers` only for chat and embedding.
- `config/profile-artifacts.json` — strongly recommend 7B chat (inference/rag), SDXL (media/comfy), Whisper + Piper (inference).

## Documentation

- `docs/use-cases-and-models.md` — use case → profile → models → UI → switch.
- `docs/privategpt-docker-setup.md` — managed `rag` / `8444`.
- `docs/stable-diffusion-docker-setup.md` — managed `media` / `8445`.
- Update `docs/README.md`, `docs/models.md`, and container-operations service-guide links.

## Out of scope

- Video pipelines / ComfyUI-Manager auto-install
- Changing Compose `PGPT_*` defaults
- Gateway bind address or `LOCALAI_API_KEY`
- CI weight downloads / committing binaries
