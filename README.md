# likwid-gaic

Local-first control plane for a GPU AI workstation: Compose profiles, model
pins, storage policy, and managed forks.

**GAIC** stands for GPU AI Control (aligned with a read-mostly model/asset root
such as `C:\gaic` on the reference workstation).

## What you get

- Docker Compose profiles for inference, RAG, media, and ComfyUI
- Pinned Hugging Face model metadata and LocalAI sync helpers
- Storage policy that keeps durable data off disposable disks
- Read-only tracking for five managed upstream forks
- Validation that keeps configuration, privacy rules, and docs consistent

This repository is the ops hub. It does not replace LocalAI, private-gpt,
Stable Diffusion WebUI, or ComfyUI themselves.

## Requirements

- Git, Node.js 20+, and npm
- Docker Desktop or Docker Engine with Compose
- **NVIDIA path (Windows/WSL or Linux):** current NVIDIA driver / Container Toolkit for GPU profiles
- **CPU path (macOS default, or Linux without NVIDIA):** `FORKEDAI_COMPUTE=cpu` for inference/RAG
- Hugging Face `hf` CLI (WSL on the Windows workstation; host PATH on macOS/Linux)

## Quick start

**PowerShell:**

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
npm install
npm test
npm run stack:doctor
npm run stack:config
```

**Bash:**

```bash
cp -n .env.example .env || true
npm install
npm test
npm run stack:doctor
npm run stack:config
```

For first-run profiles, compute modes, model downloads, and HTTPS trust, see
[Container operations](docs/container-operations.md).

## Documentation

| Area            | Guide                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| Index           | [Documentation](docs/README.md)                                                       |
| System design   | [Architecture](docs/architecture.md)                                                  |
| Daily operation | [Container operations](docs/container-operations.md)                                  |
| Service setup   | [LocalAI](docs/localai-docker-setup.md) · [ComfyUI](docs/comfyui-docker-setup.md)     |
| Data            | [Models and managed media](docs/models.md)                                            |
| Security        | [Network security](docs/network-security.md) · [GitHub access](docs/github-access.md) |
| Contributing    | [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md)                       |

## Privacy

Source, non-secret configuration, validation, and documentation belong in Git.
Model weights, generated media, private documents, credentials, databases, and
runtime state do not.

## License

[MIT](LICENSE)
