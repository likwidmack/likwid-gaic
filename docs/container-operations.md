# Container operations

The root `compose.yaml` is the control plane for the managed forks. It does not edit their worktrees. Docker build contexts point at the local forks, while hub-owned Dockerfiles cover projects that do not ship one.

`scripts/docker.mjs` injects fork contexts and storage roots from `config/`. Direct Docker Compose use must supply the equivalent variables, normally through an ignored `.env` copied from `.env.example`.

## Platforms and compute modes

| Host                      | Path keys used        | Default `FORKEDAI_COMPUTE`          | Supported profiles                  |
| ------------------------- | --------------------- | ----------------------------------- | ----------------------------------- |
| Windows (Node on Windows) | `pathWindows`         | `nvidia`                            | All (CUDA)                          |
| WSL (Node inside WSL)     | `pathWsl`             | `nvidia`                            | All (CUDA via Docker Desktop)       |
| macOS                     | `pathPosix` (`~/...`) | `cpu`                               | `inference`, `rag` only             |
| Native Linux              | `pathPosix` (`~/...`) | `nvidia` (set `cpu` without NVIDIA) | All with NVIDIA; else inference/rag |

Set `FORKEDAI_COMPUTE=cpu` or `nvidia` explicitly when needed. CPU mode appends
[`compose.cpu.yaml`](../compose.cpu.yaml) (CPU LocalAI image, no NVIDIA devices).
`media` and `comfy` require NVIDIA images and are refused in CPU mode.

## Current Docker recommendations

### Host baseline

**All platforms:** Git, Node.js 20+, Docker Engine or Docker Desktop with Compose,
and the Hugging Face `hf` CLI for model downloads.

**Windows / WSL2 (validated NVIDIA workstation):**

- Keep Docker Desktop and WSL current. Docker requires WSL 2.1.5 or newer and
  recommends the latest WSL release.
- Use Docker Desktop's Linux-container mode and enable WSL integration only for
  the distributions that need Docker access.
- Do not install a second Docker Engine or Docker CLI inside the integrated WSL
  distribution; use the CLI supplied through Docker Desktop.
- For NVIDIA on WSL, install the current Windows NVIDIA driver only. Do not
  install a Linux display driver inside WSL. The application images already
  contain their CUDA user-space runtimes.
- Configure WSL CPU, memory, swap, and Docker disk capacity when builds or
  inference contend with the host.

```powershell
wsl --version
Get-Command docker -All
docker version
docker compose version
wsl -e bash -lc "type -a docker; docker version"
```

The npm stack runner on Windows uses the Windows Node.js and Docker toolchain.
An interactive WSL shell can resolve a separately installed `/usr/bin/docker`
first; compare client and server versions before changing installs.

Docker recommends Linux-filesystem bind mounts for the highest WSL I/O
performance. The reference workstation keeps shared assets and durable data on
C:, D:, and E: for Windows interoperability and backup policy.

**macOS:** Docker Desktop (Linux containers). There is no NVIDIA GPU passthrough;
keep `FORKEDAI_COMPUTE=cpu` (the default on Darwin). Use host-native paths under
`$HOME` from `config/storage.json` `pathPosix` entries.

**Native Linux:** Docker Engine or Desktop plus the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
for GPU profiles. Without NVIDIA, set `FORKEDAI_COMPUTE=cpu`.

### Compose trust and credentials

Treat `compose.yaml`, override files, build contexts, Dockerfiles, and every
referenced host path as executable trusted input. Before `up`, inspect the
fully resolved model with `npm run stack:config`, especially after changing a
fork, override, image, device grant, network mode, or bind mount.

Use `.env` for machine-local interpolation and non-secret configuration, not
as the preferred credential store. When an application supports file-based
credentials, use a Compose secret granted only to that service; Compose mounts
it under `/run/secrets`. If an application accepts only an environment
variable, inject it from a protected process or operating-system secret store,
avoid printing the resolved environment, and never commit it.

### GPUs and images

In **nvidia** mode, the checked-in GPU reservation uses Docker's supported
Compose Deploy syntax: `driver: nvidia`, `count: all`, and
`capabilities: [gpu]`. Compose 2.30 and newer also supports the shorter
`gpus: all` service attribute. Keep the existing explicit reservation for this
validated stack; do not declare both forms on one service.

LocalAI in nvidia mode sets `NVIDIA_VISIBLE_DEVICES=${NVIDIA_VISIBLE_DEVICES:-0}`,
`NVIDIA_DRIVER_CAPABILITIES=compute,utility`, `LOCALAI_F16=true`,
`LOCALAI_MAX_ACTIVE_BACKENDS=1`, and
`LOCALAI_FORCE_META_BACKEND_CAPABILITY=nvidia-cuda-13` so CUDA 13 backends stay
selected when NVML probing is flaky under Docker Desktop. Confirm GPU access
with `npm run stack:doctor` or an `nvidia-smi` container test before treating
inference failures as application bugs.

In **cpu** mode, `compose.cpu.yaml` defaults LocalAI to
`localai/localai:v4.8.0`, resets NVIDIA device reservations, and clears
CUDA-only LocalAI environment pins. `stack:doctor` treats a missing
`nvidia-smi` as a warning, not a hard failure.

On a single-GPU workstation, use `npm run stack -- switch PROFILE` to stop
conflicting GPU services before starting a new profile. See
[GPU and CPU resource utilization](resource-utilization.md) for host sizing,
environment variables, and monitoring.

Versioned image tags make upgrades intentional but tags remain mutable. Pin an
image digest when byte-for-byte reproducibility or an audited deployment
requires it. Treat each digest change as a reviewed dependency update. For a
normal workstation, retain reviewed version tags and refresh them deliberately
so security fixes are not blocked indefinitely.

Official references:

- [Docker Desktop WSL best practices](https://docs.docker.com/desktop/features/wsl/best-practices/)
- [GPU access with Compose](https://docs.docker.com/compose/how-tos/gpu-support/)
- [Compose trust model](https://docs.docker.com/compose/trust-model/)
- [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
- [Docker build best practices](https://docs.docker.com/build/building/best-practices/)

## Profiles

Quick reference (services, HTTPS ports, compute modes, and start aliases):
[Profiles](../README.md#profiles) in the root README. npm script catalog:
[npm scripts](../README.md#npm-scripts).

| Profile     | Services                              | HTTPS gateway endpoint                             | Compute     |
| ----------- | ------------------------------------- | -------------------------------------------------- | ----------- |
| `inference` | LocalAI (CUDA 13 or CPU image)        | `https://localhost:8443`                           | nvidia, cpu |
| `rag`       | LocalAI + PrivateGPT                  | `https://localhost:8443`, `https://localhost:8444` | nvidia, cpu |
| `media`     | Stable Diffusion WebUI                | `https://localhost:8445`                           | nvidia only |
| `comfy`     | ComfyUI CUDA backend + frontend proxy | `https://localhost:8447`, `https://localhost:8446` | nvidia only |

The Caddy gateway is the only service with published host ports. It terminates HTTPS on loopback ports 8443 through 8447 and forwards plain HTTP over the appropriate private bridge. The Comfy frontend reaches its backend at `http://comfy-backend:8188`; direct backend ports are not published.

The gateway declares optional `depends_on` entries with `condition: service_healthy` and `required: false`, so profile-scoped starts still wait for backends that are in the active project without failing when a backend is omitted. LocalAI overrides the image's long `HEALTHCHECK` start period with a Compose healthcheck against `http://127.0.0.1:8080/v1/models` so `--wait` and dependents observe API readiness promptly.

Caddy's `bridge_upstream` snippet probes each backend, sets a short dial timeout, and uses `fail_duration` so Docker DNS is re-resolved after a backend recreate. Without that, a recreated LocalAI (or other upstream) can leave `https://localhost:8443` stuck on 502 until the gateway is restarted manually.

## Segmented bridges

Services explicitly join one trust-zone bridge. `localai` and `private-gpt` use `forkedai-inference`; Stable Diffusion and both Comfy services use `forkedai-media`; the gateway joins those networks plus `forkedai-edge`. Docker provides service-name DNS within each network, so fixed container IP addresses are unnecessary. The gateway is the only multi-homed service. A 502 from the gateway while `docker exec` into the backend succeeds usually means a stale upstream dial after recreate, not a missing bridge attachment—recreate or restart the gateway if probes have not recovered yet.

The gateway binds to `127.0.0.1` by default. It is available to applications and browsers on this computer but not intentionally exposed to the LAN. Compose does not opt into standalone attachment, each service runs with `no-new-privileges`, and Docker-daemon access remains a privileged administrative boundary.

The five `*_HTTPS_PORT` variables change host-side published ports only; Caddy continues to listen on container ports 8443 through 8447. Changing `FORKEDAI_BIND_ADDRESS` does not by itself configure a usable LAN hostname, certificate, authentication policy, or firewall rule.

See the dedicated [LocalAI setup guide](localai-docker-setup.md),
[PrivateGPT setup guide](privategpt-docker-setup.md),
[Stable Diffusion WebUI setup guide](stable-diffusion-docker-setup.md), and
[ComfyUI setup guide](comfyui-docker-setup.md) for service-specific requirements
and troubleshooting. Workload-to-model mapping:
[Use cases and models](use-cases-and-models.md).

```powershell
docker network inspect forkedai-edge forkedai-inference forkedai-media
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Networks}}"
```

Set the three `FORKEDAI_*_NETWORK_NAME` variables only when a name collision
exists. See [Network security](network-security.md) before changing
`FORKEDAI_BIND_ADDRESS` or exposing the gateway beyond localhost.

## Trusting the local HTTPS certificate

Caddy creates a private development CA under `RUNTIME_ROOT/caddy/data`. After
starting any profile, inspect the CA and trust it for the current user only
after verifying the path and thumbprint belong to this stack. Removing
`RUNTIME_ROOT/caddy/data` rotates the CA. The CA private key is sensitive
runtime state and must not be committed or shared.

**Windows:**

```powershell
$ca = "E:\data\forkedAI\runtime\caddy\data\caddy\pki\authorities\local\root.crt"
Get-PfxCertificate -FilePath $ca | Format-List Subject, Thumbprint, NotAfter
Import-Certificate -FilePath $ca -CertStoreLocation Cert:\CurrentUser\Root
```

**macOS** (Keychain; adjust the path if you override `RUNTIME_ROOT`):

```bash
CA="$HOME/data/forkedAI/runtime/caddy/data/caddy/pki/authorities/local/root.crt"
security add-trusted-cert -r trustRoot -k ~/Library/Keychains/login.keychain-db "$CA"
```

**Linux** (distribution-specific; example for a user NSS DB or system store
requires admin rights—prefer browser trust for loopback-only development when
unsure):

```bash
CA="$HOME/data/forkedAI/runtime/caddy/data/caddy/pki/authorities/local/root.crt"
openssl x509 -in "$CA" -noout -subject -fingerprint -sha256
```

## First run

Review profile requirements before starting services:

```powershell
npm run models -- recommendations inference
npm run models -- recommendations rag
```

**PowerShell (Windows NVIDIA workstation):**

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
npm run stack:doctor
npm run media -- init
npm run stack:config
npm run models -- download chat-qwen2.5-3b
npm run models -- download embed-nomic-v1.5
npm run models -- verify chat-qwen2.5-3b
npm run models -- verify embed-nomic-v1.5
npm run models -- sync-localai
npm run models -- ready inference
npm run stack -- up inference
npm run stack -- backend
npm run stack -- up rag
```

**Bash (macOS CPU, or Linux):**

```bash
cp -n .env.example .env || true
# macOS defaults to cpu; on Linux without NVIDIA:
# export FORKEDAI_COMPUTE=cpu
npm run stack:doctor
npm run media -- init
npm run stack:config
npm run models -- download chat-qwen2.5-3b
npm run models -- download embed-nomic-v1.5
npm run models -- verify chat-qwen2.5-3b
npm run models -- verify embed-nomic-v1.5
npm run models -- sync-localai
npm run models -- ready inference
npm run stack -- up inference
npm run stack -- up rag
```

Skip `npm run stack -- backend` in CPU mode (CUDA backend install is
NVIDIA-only). For optional Whisper/Piper audio backends after downloading those
pins, see [Troubleshooting](troubleshooting.md) and
[Use cases and models](use-cases-and-models.md). Optional media and Comfy
starters (**nvidia** compute only; download once; see
[Models and managed media](models.md) for the WebUI hard link):

```powershell
npm run models -- recommendations media
npm run models -- download sd15-starter
npm run models -- verify sd15-starter
npm run stack -- build stable-diffusion
npm run stack -- up media
npm run models -- recommendations comfy
npm run stack -- build comfy-backend
npm run stack -- build comfy-frontend
npm run stack -- up comfy
```

`doctor` is read-only. `media init` creates configured directories. `stack:config`
renders and validates the complete Compose model (`FORKEDAI_COMPUTE=cpu npm run
stack:config` to preview the CPU overlay). `up` starts containers and waits up
to five minutes for health. The backend command installs
`localai@cuda13-llama-cpp` only when missing, persists it under the runtime
root, and recreates LocalAI once so the backend registry refreshes.

Build fork-backed images explicitly:

```powershell
npm run stack -- build private-gpt
npm run stack -- build stable-diffusion
npm run stack -- build comfy-backend
npm run stack -- build comfy-frontend
```

The hub's root `.dockerignore` is default-deny and admits only `docker/`. The Stable Diffusion and Comfy Dockerfiles separately exclude Git metadata, dotenv files, local environments, dependency caches, models, outputs, and other generated state from their named fork contexts before copying source into build layers.

The Stable Diffusion image pins PyTorch 2.8.0 with CUDA 12.8 for RTX 5090 support while staying closer to this older WebUI fork than newer PyTorch releases.

The ComfyUI image pins the official PyTorch 2.13.0 CUDA 13.0 runtime. Its build keeps the base image's matching Torch packages and installs the remaining ComfyUI requirements. API nodes are disabled by default to prevent workflow nodes from calling external services; override the service command deliberately if those nodes are required.

LocalAI scans GGUF headers on first start, which can take roughly two minutes on the Windows-mounted model directory. The Stable Diffusion image installs the fork's pinned Python dependencies at build time; its first start clones pinned helper repositories into the runtime root. The WebUI uses the public `w-e-w/stablediffusion` mirror for the exact upstream commit formerly hosted in the removed Stability AI repository.

The Stable Diffusion image marks its five known helper repository directories as Git-safe because they live on a Windows bind mount whose reported owner can differ after container replacement. The entries are explicit for compatibility with the image's Git 2.34; other repositories retain Git's normal ownership checks.

## Daily operations

Convenience aliases (thin wrappers around `scripts/docker.mjs`). Full catalog:
[npm scripts](../README.md#npm-scripts) in the root README.

| Script                        | Behavior                                                                  |
| ----------------------------- | ------------------------------------------------------------------------- |
| `npm run stack:up -- PROFILE` | Raw `up` (refuses GPU conflicts unless `--allow-gpu-share`)               |
| `npm run stack:down`          | Stop and remove stack services (`down`, no `--volumes`)                   |
| `npm run stack:status`        | Show Compose status                                                       |
| `npm run stack:build`         | Build all buildable services (optional: `npm run stack:build -- SERVICE`) |
| `npm run stack:inference`     | `switch inference` (stops conflicting GPU services first)                 |
| `npm run stack:rag`           | `switch rag`                                                              |
| `npm run stack:media`         | `switch media`                                                            |
| `npm run stack:comfy`         | `switch comfy`                                                            |

Profile scripts use `switch`. Prefer them on a single-GPU host. Keep using
`npm run stack -- …` for commands without an alias (`pull`, `logs`, `stop`,
`resources`, `backend`, …).

```powershell
npm run stack
npm run stack -- pull
npm run stack -- logs localai
npm run stack -- stop stable-diffusion
npm run stack -- down
```

`pull` refreshes registry-backed services such as Caddy and LocalAI but skips
locally buildable images. Run `up` afterward so Compose recreates services whose
image changed. `down` never adds `--volumes`; host-mounted models, indexes,
configuration, and generated media remain on their configured drives. No command
runs Docker system prune.

For a maintenance rebuild that refreshes a Dockerfile's base image, use direct
Compose with the ignored `.env` in place, then return to the npm runner:

```powershell
docker compose --project-name forkedai --file compose.yaml --profile comfy build --pull comfy-backend comfy-frontend
npm run stack -- up comfy
```

Use `--no-cache` only for a deliberate clean rebuild or cache investigation;
it is not required for routine source changes. `--pull` refreshes the base
image, while `--no-cache` re-executes Dockerfile layers—each solves a different
problem.

## Shared storage mounts

Each backend receives the same five canonical paths:

| Container path    | Host root                         | Access     | Purpose                                                    |
| ----------------- | --------------------------------- | ---------- | ---------------------------------------------------------- |
| `/shared/models`  | `C:/gaic/models`                  | Read-only  | Model weights and LocalAI model definitions                |
| `/shared/tensors` | `D:/forkedAI/scratch/tensors`     | Read-write | Disposable serialized tensors and intermediate arrays      |
| `/shared/objects` | `E:/data/forkedAI/shared/objects` | Read-write | Durable workflows, inputs, outputs, and exchange artifacts |
| `/shared/plugins` | `C:/gaic/shared/plugins`          | Read-only  | Reviewed plugins and custom nodes                          |
| `/shared/tools`   | `C:/gaic/shared/tools`            | Read-only  | Reviewed helper binaries, scripts, and configuration       |

`npm run media -- init` creates all host roots and service-specific plugin directories. Stable Diffusion maps `plugins/stable-diffusion` to its extensions directory, and ComfyUI maps `plugins/comfyui` to `custom_nodes`; both mounts remain read-only at runtime. Add or update reviewed plugin code from the host, then rebuild or restart the affected service.

Shared objects and tensors are filesystem artifacts only. Live CUDA tensors, GPU memory, Python objects, and process memory cannot be shared through these mounts; serialize them to a safe, documented format first. Treat pickle and arbitrary PyTorch checkpoint files as executable content and load them only from trusted sources.

The drive layout separates workloads by durability and SSD role. Read-mostly models, plugins, and tools use C:. Durable shared objects, generated media, documents, service state, and the Caddy CA stay on E:. Host-only media backups use `E:/VIMG`; this path is initialized by `npm run media -- init` but is intentionally not mounted into any container. The non-redundant D: Storage Space holds only rebuildable Hugging Face/Torch caches and disposable tensors and Comfy temporary files. A D: failure must not remove the only copy of an artifact.

Override fork contexts, storage roots, network names, gateway bind address or HTTPS ports, images, or the Comfy backend in a local `.env` copied from `.env.example`. The example file uses Windows paths from `config/storage.json` and fork names from `config/repos.json`; replace them for your layout or rely on the npm runner, which injects those config values. Overrides are needed only when the local layout differs from those config files.

`npm test` requires every Compose variable to appear in `.env.example` and requires every storage default in Compose to match `config/storage.json`.

Before starting containers after a change, run:

```powershell
npm test
npm run stack:config
```
