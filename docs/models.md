# Models and managed media

This guide covers model provenance, immutable downloads, local inventory, and
managed media storage.

## Sources of truth

- `config/storage.json` defines the shared model root: `C:\gaic\models` on
  Windows, `/mnt/c/gaic/models` in WSL, and `~/gaic/models` on macOS/Linux
  (`pathPosix`, with `~` expanded by the npm runner).
- `config/models.json` contains managed Hugging Face repository IDs, immutable revisions, selected files, destinations, and optional LocalAI metadata.
- `config/profile-artifacts.json` lists required and strongly recommended models, directories, plugins, and other objects per Compose profile.
- Model weights, generated media, and local inventories are never committed.

Stable Diffusion and ComfyUI consume the same shared model tree. Legacy `E:\models` and fork-local model directories are not authoritative stack storage.

## Hugging Face CLI

Install and authenticate the current `hf` CLI (WSL on the Windows workstation,
or the host shell on macOS/Linux):

```bash
curl -LsSf https://hf.co/cli/install.sh | bash -s
hf version
hf auth login
```

On Windows, the task runner invokes `hf` through WSL and sets `HF_HOME` to the
configured rebuildable cache (`pathWsl`). On macOS and native Linux it calls
`hf` on the host with `HF_HOME` from `pathPosix`.

## Managed model workflow

```powershell
npm run models -- list
npm run models -- search "small instruct gguf"
npm run models -- add my-model owner/repository REVISION localai/my-model
npm run models -- plan my-model
npm run models -- download my-model
npm run models -- verify my-model
```

After `add`, edit `config/models.json` before committing:

- replace the revision with a full 40-character immutable commit;
- add an explicit, minimal `include` list;
- record LocalAI metadata only when LocalAI should load the artifact;
- review the repository license and model card.

`npm test` rejects floating revisions, empty include lists, duplicate aliases, paths that escape the model root, and unsafe LocalAI configuration filenames. `plan` performs an `hf download --dry-run`; `verify` checks selected local files against Hub metadata. Because multiple managed models share the `localai` directory and each manifest intentionally selects only a subset of its Hub repository, `hf` can warn about extra local files and unselected remote files; the checksum result for the selected artifact is the integrity result that matters.

The checked-in manifest pins:

| Alias                   | Selected artifact                     | Intended use                                 |
| ----------------------- | ------------------------------------- | -------------------------------------------- |
| `chat-qwen2.5-3b`       | Qwen2.5 3B Instruct Q4_K_M GGUF       | LocalAI chat and PrivateGPT default LLM      |
| `chat-qwen2.5-7b`       | Qwen2.5 7B Instruct Q4_K_M GGUF       | Stronger general chat (optional)             |
| `chat-qwen2.5-coder-7b` | Qwen2.5 Coder 7B Instruct Q4_K_M GGUF | Architecture and coding chat (optional)      |
| `embed-nomic-v1.5`      | Nomic Embed Text v1.5 Q4_K_M GGUF     | LocalAI embeddings and PrivateGPT RAG        |
| `stt-whisper-base`      | whisper.cpp ggml-base.bin             | LocalAI speech-to-text (optional)            |
| `tts-piper-en-us`       | Piper en_US lessac medium onnx        | LocalAI text-to-speech (optional)            |
| `sd15-starter`          | SD 1.5 pruned EMA fp16 safetensors    | Comfy `checkpoints/` and optional A1111 link |
| `sdxl-base`             | SDXL base 1.0 safetensors             | Higher-quality image checkpoint (optional)   |

Use-case mapping (finance, planning, research, image, audio):
[Use cases and models](use-cases-and-models.md).

Generate LocalAI YAML definitions after downloading:

```powershell
npm run models -- sync-localai
```

The command writes registered YAML under the shared `localai` model directory for
entries with `localAI` metadata. Chat and embedding use `llama-cpp`;
transcription uses `whisper` (or the configured backend); TTS uses `piper` (or
the configured backend). It does not download or delete weights. Optional
`threads` in `config/models.json` or `FORKEDAI_CPU_THREADS` /
`LOCALAI_THREADS` in the environment flow into chat/embedding YAML. For VRAM
tuning on single-GPU hosts, see [GPU and CPU resource utilization](resource-utilization.md).

## Profile requirements

Each Compose profile has a minimum artifact set before `npm run stack -- up PROFILE` succeeds in practice. The authoritative list is [config/profile-artifacts.json](../config/profile-artifacts.json). Overview of services and HTTPS endpoints: [Profiles](../README.md#profiles). Inspect presence on your workstation with:

```powershell
npm run models -- recommendations inference
npm run models -- recommendations rag
npm run models -- recommendations media
npm run models -- recommendations comfy
```

| Profile     | Required managed models / artifacts           | Strongly recommended                                       |
| ----------- | --------------------------------------------- | ---------------------------------------------------------- |
| `inference` | `chat-qwen2.5-3b`, LocalAI YAML, CUDA backend | 7B chat/coder, Whisper STT, Piper TTS                      |
| `rag`       | Both LocalAI starter pins, YAML, documents    | Sample docs; optional `chat-qwen2.5-7b`                    |
| `media`     | `sd15-starter` plus WebUI checkpoint path     | `sdxl-base` + junction; reviewed extensions                |
| `comfy`     | `sd15-starter`, Comfy model layout dirs       | `sdxl-base`; optional VAE/upscalers; reviewed custom nodes |

Upstream fork quickstarts may suggest larger models (for example PrivateGPT with Ollama Qwen 35B or Comfy partner API nodes). This hub keeps smaller local GGUF starters, optional 7B upgrades, and disables Comfy API nodes by default for loopback privacy.

### Shared checkpoint layout (media and comfy)

Managed image pins download under `checkpoints/`. ComfyUI reads that tree
directly. Stable Diffusion WebUI uses `--ckpt-dir Stable-diffusion`, so expose
the same bytes without duplicating the file.

SD 1.5 starter:

```powershell
$models = "C:\gaic\models"
$target = Join-Path $models "Stable-diffusion\v1-5-pruned-emaonly-fp16.safetensors"
$source = Join-Path $models "checkpoints\v1-5-pruned-emaonly-fp16.safetensors"
New-Item -ItemType Junction -Path $target -Target $source
```

Optional SDXL (`sdxl-base`):

```powershell
$models = "C:\gaic\models"
$target = Join-Path $models "Stable-diffusion\sd_xl_base_1.0.safetensors"
$source = Join-Path $models "checkpoints\sd_xl_base_1.0.safetensors"
New-Item -ItemType Junction -Path $target -Target $source
```

Prefer a junction or hard link over copying multi-gigabyte weights. `npm run media -- init` creates both A1111 and Comfy directory trees under the shared model root.

## Inventory

```powershell
npm run models -- inventory
npm run inventory
```

The first command summarizes recognized model files under the configured shared root. The second creates `docs/inventory.generated.md` with local repositories, the same model root, GPU information, and Docker state. That file is Git-ignored because it contains machine-specific paths and inventory.

Treat command output as authoritative instead of committing a size snapshot that becomes stale.

## Managed media

```powershell
npm run media -- init
npm run media -- status
npm run media -- latest images
npm run media -- index
```

`init` creates configured storage roots and service directories without deleting existing data. `index` writes metadata to `E:\data\forkedAI\media\.forkedai\index.json`, outside Git. Media commands have no deletion operation.

## Safety

Prefer GGUF or safetensors. Treat pickle, PyTorch checkpoint, extension, custom-node, and plugin content as executable. Pin revisions, verify checksums, review licenses, and keep tokens outside manifests and command history.
