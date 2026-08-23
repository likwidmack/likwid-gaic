# Local AI system architecture

This repository is the portable control plane for a personal Windows, WSL2, Docker Desktop, and NVIDIA AI workstation. Machine-specific inventory is deliberately generated locally and excluded from Git.

## Host assumptions

- Docker Desktop exposes the NVIDIA GPU to Linux containers.
- The current LocalAI image uses CUDA 13; the Stable Diffusion image uses PyTorch 2.8 with CUDA 12.8.
- Model, media, document, cache, and runtime roots live outside source repositories and are configurable in `config/storage.json`.
- Published application ports bind to `127.0.0.1` unless the operator deliberately selects another host address.

## Managed topology

1. `LocalAI-Prt` supplies the OpenAI-compatible GPU inference API.
2. `private-gpt-tm` supplies private ingestion, retrieval, prompting, and document workflows.
3. `stable-diffusion-ui` supplies image generation.
4. `ComfyUI` supplies the containerized GPU workflow execution API.
5. `ComfyUI_frontend` supplies the Comfy workflow editor and proxies to the backend over the shared bridge.
6. This repository supplies Compose orchestration, pinned model metadata, media indexing, fork tracking, and safety validation.

## Data and privacy boundary

- The repository stores configuration and documentation, never model weights, generated media, private documents, credentials, vector databases, or machine inventories.
- Models and source documents are mounted read-only where practical.
- Runtime state and generated media use external storage roots.
- `npm run inventory` writes `docs/inventory.generated.md` locally. That file can contain hardware, model, container, image, branch, and absolute-path metadata and is intentionally Git-ignored.
- The root `.dockerignore` and Dockerfile copy exclusions keep unrelated workspace data out of image build layers.

## Operating checks

```powershell
npm run stack:doctor
npm run stack:config
npm run repos:status
npm run models -- inventory
npm run media -- status
npm run stack
```

Review the local inventory before sharing it. Benchmark representative prompts one model at a time and record performance results outside Git unless they are intentionally anonymized.
