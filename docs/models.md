# Models and managed media

This guide covers model provenance, immutable downloads, local inventory, and
managed media storage.

## Sources of truth

- `config/storage.json` defines the shared model root: `C:\gaic\models` on
  Windows, `/mnt/c/gaic/models` in WSL, and `~/gaic/models` on macOS/Linux
  (`pathPosix`, with `~` expanded by the npm runner). All AI model weights for
  LocalAI, Ollama, Stable Diffusion WebUI, and ComfyUI live under this root
  (engine-specific subdirectories and Ollama library blobs). Rebuildable Hugging
  Face / Torch download caches stay on the D: scratch roots, not as a second
  model tree.
- `config/models.json` contains managed Hugging Face repository IDs, immutable revisions, selected files, destinations, and optional LocalAI metadata.
- `config/profile-artifacts.json` lists required and strongly recommended models, directories, plugins, and other objects per Compose profile.
- Model weights, generated media, and local inventories are never committed.

Legacy `E:\models` and fork-local model directories are not authoritative stack storage.

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
npm run models -- add my-model owner/repository 0123456789abcdef0123456789abcdef01234567 localai/my-model --include model.gguf
npm run models -- plan my-model
npm run models -- download my-model
npm run models -- verify my-model
```

`add` requires a full 40-character revision and at least one `--include` file so
new entries cannot fail `npm test` validation. After `add`, still review
`config/models.json` before committing:

- confirm license and model-card provenance;
- add LocalAI metadata only when LocalAI should load the artifact;
- keep the include list minimal and explicit.

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
npm run models -- ready inference
npm run models -- recommendations rag
npm run models -- recommendations media
npm run models -- recommendations comfy
```

`ready` exits with status 1 when any **required** artifact is missing (recommended gaps are reported but non-blocking).
| Profile | Required managed models / artifacts | Strongly recommended |
| ----------- | --------------------------------------------- | ---------------------------------------------------------- |
| `inference` | `chat-qwen2.5-3b`, LocalAI YAML, CUDA backend | 7B chat/coder, Whisper STT, Piper TTS |
| `rag` | Both LocalAI starter pins, YAML, documents | Sample docs; optional `chat-qwen2.5-7b` |
| `media` | `sd15-starter` plus WebUI checkpoint path | `sdxl-base` + hard link; reviewed extensions |
| `comfy` | `sd15-starter`, Comfy model layout dirs | `sdxl-base`; optional VAE/upscalers; reviewed custom nodes |
| `ollama` | `MODEL_ROOT` directory | Pull library models with `npm run ollama -- pull MODEL` |

Upstream fork quickstarts may suggest larger models (for example PrivateGPT with Ollama Qwen 35B or Comfy partner API nodes). This hub keeps smaller local GGUF starters, optional 7B upgrades, and disables Comfy API nodes by default for loopback privacy.

### Shared catalog (media / comfy / backends)

Every backend mounts the same host roots:

| Host                              | Container              | Notes                                                      |
| --------------------------------- | ---------------------- | ---------------------------------------------------------- |
| `C:\gaic\models`                  | `/shared/models` (RO)  | One weight catalog                                         |
| `C:\gaic\shared\tensors`          | `/shared/tensors` (RW) | Serialized exchange                                        |
| `E:\data\forkedAI\shared\objects` | `/shared/objects` (RW) | Durable shared artifacts                                   |
| `C:\gaic\shared\tools`            | `/shared/tools` (RO)   | Reviewed helpers                                           |
| `C:\gaic\shared\plugins`          | `/shared/plugins` (RO) | Per-service packs under `comfyui/`, `stable-diffusion/`, … |

Comfy and WebUI use different **folder names** for some model types. Canonical
(Comfy) dirs hold the files; WebUI aliases are directory bridges (junction on
Windows, symlink elsewhere), created by `npm run media -- init` and
`npm run models -- link-webui`:

| Comfy (canonical)                | WebUI (alias)             |
| -------------------------------- | ------------------------- |
| `checkpoints/` → file hard links | `Stable-diffusion/`       |
| `vae/`                           | `VAE/`                    |
| `loras/`                         | `Lora/`                   |
| `controlnet/`                    | `ControlNet/`             |
| `embeddings/`                    | `embeddings/` (same name) |

Put new ControlNet / VAE / LoRA weights under the Comfy names (`controlnet/`,
`vae/`, `loras/`). WebUI reads VAE and LoRA through the alias dirs
(`--vae-dir` / `--lora-dir`). After you promote the ControlNet extension, set
its models directory to `/shared/models/ControlNet` (same bytes as
`controlnet/` via the bridge). Do not add `--controlnet-dir` to the image CMD
until that extension is installed — A1111 rejects unknown launch args.

Plugins stay **service-specific** under the shared plugins root (A1111 extensions
≠ Comfy custom nodes). Stage under `plugins/inbox/<service>/` then promote.

### Shared checkpoint layout (media and comfy)

Managed image pins download under `checkpoints/`. ComfyUI reads that tree
directly. Stable Diffusion WebUI uses `--ckpt-dir Stable-diffusion`, so expose
the same bytes without duplicating the file.

`npm run models -- download sd15-starter` (and `sdxl-base`) automatically creates
the WebUI hard link when the download succeeds. You can also run:

```powershell
npm run models -- link-webui
npm run models -- link-webui sd15-starter
```

`link-webui` also ensures the VAE / LoRA / ControlNet directory bridges above.

Promoting a `checkpoints/…` file from the inbox also creates the matching
`Stable-diffusion/` hard link.

NTFS **junctions only work for directories**. For checkpoint _files_, use a hard
link (same volume) or a symbolic link. Prefer a hard link over copying
multi-gigabyte weights. Hard links require source and target on the same
filesystem volume. If the platform cannot hard-link, `link-webui` copies and
warns.

SD 1.5 starter (PowerShell on Windows):

```powershell
$models = "C:\gaic\models"
$target = Join-Path $models "Stable-diffusion\v1-5-pruned-emaonly-fp16.safetensors"
$source = Join-Path $models "checkpoints\v1-5-pruned-emaonly-fp16.safetensors"
New-Item -ItemType HardLink -Path $target -Target $source
```

SD 1.5 starter (bash on WSL; use `~/gaic/models` on macOS/Linux):

```bash
models="/mnt/c/gaic/models"   # macOS/Linux: models="$HOME/gaic/models"
ln "$models/checkpoints/v1-5-pruned-emaonly-fp16.safetensors" \
  "$models/Stable-diffusion/v1-5-pruned-emaonly-fp16.safetensors"
```

Optional SDXL (`sdxl-base`) on Windows:

```powershell
$models = "C:\gaic\models"
$target = Join-Path $models "Stable-diffusion\sd_xl_base_1.0.safetensors"
$source = Join-Path $models "checkpoints\sd_xl_base_1.0.safetensors"
New-Item -ItemType HardLink -Path $target -Target $source
```

Optional SDXL on WSL / macOS / Linux:

```bash
models="/mnt/c/gaic/models"   # macOS/Linux: models="$HOME/gaic/models"
ln "$models/checkpoints/sd_xl_base_1.0.safetensors" \
  "$models/Stable-diffusion/sd_xl_base_1.0.safetensors"
```

`npm run media -- init` creates both A1111 and Comfy directory trees under the shared model root, plus writable **inbox** staging trees.

To download several optional pins, sync LocalAI YAML, and create both WebUI
hard links in one step:

```bash
npm run models:bootstrap-optional
# or: bash scripts/bootstrap-optional-models.sh
```

PowerShell fallback:

```powershell
powershell -NoProfile -File scripts/bootstrap-optional-models.ps1
```

Use `--links-only` / `-LinksOnly` when the weights are already present and you
only need `Stable-diffusion/` hard links.

## Staging inbox and promote (UI / one-off downloads)

The canonical catalog (`/shared/models`, `/shared/plugins`) stays **read-only**
in containers so one backend cannot overwrite the shared library. A nested
writable overlay exists only under `inbox`:

| Host path             | Container path                                       | Access     |
| --------------------- | ---------------------------------------------------- | ---------- |
| `MODEL_ROOT/inbox/…`  | `/shared/models/inbox` (and LocalAI `/models/inbox`) | Read-write |
| `PLUGIN_ROOT/inbox/…` | `/shared/plugins/inbox`                              | Read-write |

Preferred flow when a UI offers auto-download, or you stage a one-off file:

1. Write into the matching inbox layout dir (for example
   `inbox/checkpoints/foo.safetensors` or `inbox/localai/bar.gguf`). Comfy sees
   this under `models/inbox/` because `/opt/comfyui/models` links to
   `/shared/models`.
2. Review license and format (prefer `.gguf` / `.safetensors`).
3. Promote into the catalog (same relative path without `inbox/`):

```powershell
npm run models -- inbox
npm run models -- promote checkpoints/foo.safetensors --dry-run
npm run models -- promote checkpoints/foo.safetensors
```

`.pth` / `.ckpt` / similar pickle-adjacent files require `--allow-pickle` and
are still discouraged. Use `--force` only when replacing an existing catalog
file deliberately.

### Plugins and custom nodes (no in-UI Manager)

Do not use ComfyUI-Manager or A1111 extension gallery installers against the
read-only mounts. On the host:

```powershell
# Stage under plugins/inbox/<service>/<pack>, review the code, then:
npm run models -- promote-plugin comfyui my-node-pack
npm run models -- promote-plugin stable-diffusion my-extension
```

Restart or recreate the affected profile after promote. Extensions remain
executable content.

Managed Hub pins still use `download` / `verify` / `sync-localai` directly into
the catalog (not the inbox).

## Upscalers (not managed)

RealESRGAN and similar Hub upscalers often ship as `.pth` checkpoints. Those
formats are treated as executable content and are **not** managed pins in
`config/models.json`. Prefer reviewed safetensors placed manually under
`upscale_models/` (Comfy) when you need an upscaler. See
[Troubleshooting](troubleshooting.md).

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
