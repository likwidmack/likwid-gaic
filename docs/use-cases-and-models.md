# Use cases and models

Map personal and company workloads to Compose profiles, free/low-cost managed
model pins, and Web UIs. Download workflow and provenance rules live in
[Models and managed media](models.md). Profile lifecycle and GPU exclusivity
live in [Container operations](container-operations.md) and
[GPU and CPU resource utilization](resource-utilization.md).

On a single-GPU host, run at most one of LocalAI, Stable Diffusion WebUI, or
ComfyUI at a time. Prefer `npm run stack -- switch PROFILE` (or
`npm run stack:PROFILE`) before opening a different UI.

## Profile quick map

| Workload                                                                                         | Profile              | HTTPS UI                                               | Starter pin                            | Recommended pin                             |
| ------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------ | -------------------------------------- | ------------------------------------------- |
| Chat, brainstorming, light Q&A                                                                   | `inference`          | LocalAI `https://localhost:8443`                       | `chat-qwen2.5-3b`                      | `chat-qwen2.5-7b`                           |
| Personal finance, business/project planning, IoT docs, deep research, statistics over your files | `rag`                | PrivateGPT `https://localhost:8444` (+ LocalAI `8443`) | `chat-qwen2.5-3b` + `embed-nomic-v1.5` | `chat-qwen2.5-7b` (override PrivateGPT LLM) |
| Software architecture and coding                                                                 | `inference` or `rag` | LocalAI / PrivateGPT                                   | `chat-qwen2.5-3b`                      | `chat-qwen2.5-coder-7b`                     |
| Image generation                                                                                 | `media` or `comfy`   | A1111 `8445` / Comfy `8446`                            | `sd15-starter`                         | `sdxl-base`                                 |
| Speech-to-text / text-to-speech                                                                  | `inference`          | LocalAI API (+ WebUI)                                  | —                                      | `stt-whisper-base`, `tts-piper-en-us`       |
| Video generation                                                                                 | —                    | —                                                      | —                                      | Out of scope (future Comfy custom nodes)    |

## Download recommended pins

```powershell
npm run models -- download chat-qwen2.5-7b
npm run models -- download chat-qwen2.5-coder-7b
npm run models -- download sdxl-base
npm run models -- download stt-whisper-base
npm run models -- download tts-piper-en-us
npm run models -- verify chat-qwen2.5-7b
npm run models -- sync-localai
```

Inspect readiness per profile:

```powershell
npm run models -- recommendations inference
npm run models -- recommendations rag
npm run models -- recommendations media
npm run models -- recommendations comfy
```

## Workload notes

### Finance, business planning, project planning

Use `rag` with reviewed documents under the documents storage root. Keep the
default 3B chat for first run; download `chat-qwen2.5-7b` when you need stronger
reasoning. After `sync-localai`, set `PGPT_LLM_DEFAULT=qwen2.5-7b-instruct:latest`
in `.env` and recreate PrivateGPT. See [PrivateGPT Docker setup](privategpt-docker-setup.md).

### Software architecture and IoT

Prefer `chat-qwen2.5-coder-7b` in LocalAI for code and architecture. For IoT
runbooks and datasheets, ingest them with PrivateGPT (`rag`) and keep
`embed-nomic-v1.5` so `PGPT_EMBED_DIM=768` stays valid.

### Deep research and statistics

PrivateGPT over your corpus is the primary path. Larger stretch models (14B+)
are catalog-only: add them with `npm run models -- add` only after confirming
VRAM headroom in [resource utilization](resource-utilization.md). Do not mark
stretch models required.

### Generative image

Start with `sd15-starter` on `media` or `comfy`. Download `sdxl-base` for
higher quality; junction the safetensors into `Stable-diffusion/` for A1111 as
described in [models.md](models.md). Service how-tos:
[Stable Diffusion WebUI](stable-diffusion-docker-setup.md) and
[ComfyUI](comfyui-docker-setup.md).

### Light audio (STT / TTS)

With `inference` healthy, LocalAI serves:

- Transcription: `POST /v1/audio/transcriptions` with model `whisper-base`
- Speech: `POST /tts` (or `/v1/audio/speech`) with model `en-us-lessac-medium`

Through the gateway, replace `http://localhost:8080` with
`https://localhost:8443` and trust the Caddy CA. Piper and Whisper backends are
separate from llama-cpp; install them via LocalAI’s backend mechanism if the
container image does not already include them.

### Video (out of scope)

Managed pins do not include video checkpoints or Comfy video custom nodes.
Treat video as a later, reviewed Comfy plugin workflow—not part of
`npm run models -- recommendations`.

## Free / low-cost catalog (stretch, not pinned)

| Role          | Example direction                        | Notes                                |
| ------------- | ---------------------------------------- | ------------------------------------ |
| Stronger chat | Qwen2.5 14B Instruct GGUF Q4             | Needs more VRAM than the 7B pin      |
| Image         | Flux-class / SDXL Turbo community builds | Review license and VRAM; not managed |
| Video         | Comfy video nodes + reviewed weights     | Custom nodes are executable content  |

## Related guides

- [LocalAI Docker setup](localai-docker-setup.md)
- [PrivateGPT Docker setup](privategpt-docker-setup.md)
- [Stable Diffusion WebUI Docker setup](stable-diffusion-docker-setup.md)
- [ComfyUI Docker setup](comfyui-docker-setup.md)
