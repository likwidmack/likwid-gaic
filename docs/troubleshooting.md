# Troubleshooting

Cross-cutting fixes for the managed stack. Service-specific depth lives in the
guides linked below; profile lifecycle and GPU exclusivity live in
[Container operations](container-operations.md) and
[GPU and CPU resource utilization](resource-utilization.md).

## Quick checks

```powershell
npm run stack:doctor
npm run models -- ready inference
npm run stack -- smoke
npm run stack -- resources
```

`ready` exits non-zero when required profile artifacts are missing. `stack:doctor`
prints the same gaps as soft WARN lines (does not fail the doctor exit solely for
missing artifacts). `stack -- up` / `switch` also warn by default; pass
`--require-ready` to fail closed or `--skip-ready` to silence.

`smoke` prints the local switch matrix; add `--probe` to curl loopback HTTPS only for
services that are already running (nothing is started or stopped).

## Gateway returns 502 while the backend is healthy

After recreating LocalAI or another upstream, Caddy can briefly hold a stale
Docker DNS dial. The shared `bridge_upstream` probe should recover; if
`https://localhost:8443` (or another gateway port) stays on 502 while
`docker compose exec` into the backend succeeds, recreate or restart the
`gateway` service. See [Container operations](container-operations.md).

## GPU conflict / `up` refused

On a single-GPU host only one of `localai`, `stable-diffusion`, or
`comfy-backend` may run. Use `npm run stack -- switch PROFILE`, stop the
conflicting service, or pass `--allow-gpu-share` deliberately. Confirm with
`npm run stack -- resources`.

## LocalAI exits on empty `LOCALAI_THREADS`

Do not map `LOCALAI_THREADS=""` in Compose. Leave the variable unset, set a
real integer in a local override, or inject threads through
`npm run models -- sync-localai` with `FORKEDAI_CPU_THREADS` /
`LOCALAI_THREADS` in the shell.

## Windows Node vs WSL Docker / Hugging Face

On Windows, npm uses Windows Node and the Windows Docker toolchain. Interactive
WSL may resolve a different `docker` or `hf` first. Run `npm run stack:doctor`
from the repository root and compare client/server versions before changing
installs. Model downloads from Windows Node shell out to WSL `hf` with
`HF_HOME` on the WSL cache path.

## Media profile: checkpoint missing in WebUI

Managed SD pins land under `checkpoints/`. A1111 reads `--ckpt-dir
Stable-diffusion`, so create a hard link (same volume) after download. See
[Models and managed media](models.md). `npm run models -- ready media` reports
the WebUI path as missing until that link exists.

## UI auto-download / install failed (read-only models)

The shared model and plugin catalogs are read-only by design. Stage files under
`models/inbox/…` or `plugins/inbox/<service>/…`, then promote:

```powershell
npm run models -- inbox
npm run models -- promote checkpoints/your-file.safetensors
npm run models -- promote-plugin comfyui your-node-pack
```

Do not make `/shared/models` writable and do not use ComfyUI-Manager or A1111
gallery installers against the RO mounts. Details: [Models](models.md).

## STT / TTS after Whisper and Piper downloads

1. Download and verify `stt-whisper-base` / `tts-piper-en-us`.
2. `npm run models -- sync-localai`.
3. With inference up: install backends if the image does not already include
   them:

```powershell
npm run stack -- up inference
npm run stack -- backend
npm run stack -- backend whisper
npm run stack -- backend piper
```

On CPU hosts (`FORKEDAI_COMPUTE=cpu`), skip the CUDA llama-cpp default and
install `whisper` / `piper` only. Details:
[Use cases and models](use-cases-and-models.md) and
[LocalAI Docker setup](localai-docker-setup.md).

## Upscalers / RealESRGAN

There is no managed RealESRGAN pin. Hub `.pth` artifacts are treated as
executable content and must not be added to `config/models.json`. Place
reviewed safetensors manually under `upscale_models/` if needed.

## PrivateGPT model not found

Discovery registers LocalAI IDs with a `:latest` suffix. Keep
`PGPT_LLM_DEFAULT` / `PGPT_EMBEDDING_DEFAULT` aligned (for example
`qwen2.5-3b-instruct:latest`) and confirm YAML from `sync-localai`.

## Related guides

- [LocalAI Docker setup](localai-docker-setup.md)
- [PrivateGPT Docker setup](privategpt-docker-setup.md)
- [Stable Diffusion WebUI Docker setup](stable-diffusion-docker-setup.md)
- [ComfyUI Docker setup](comfyui-docker-setup.md)
- [Network security](network-security.md)
- [Models and managed media](models.md)
