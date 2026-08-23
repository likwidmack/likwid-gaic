# LocalAI Docker setup

LocalAI has no fixed hardware minimum. The main constraint is having enough system RAM, GPU VRAM, and storage for the models you intend to run. A GPU is optional, although it is strongly recommended for larger models or interactive response times.

This repository already manages LocalAI through the `inference` and `rag`
profiles in `compose.yaml`. For this workstation, use the npm commands in
[Container operations](container-operations.md). The standalone Compose examples
below are reference material for a separate deployment and should not be layered
on top of the managed stack.

Official references:

- [LocalAI container installation](https://localai.io/installation/containers/)
- [GPU acceleration](https://localai.io/docs/features/gpu-acceleration/)
- [Model gallery and memory estimates](https://localai.io/models/)

## Requirements

- Docker Engine or Docker Desktop with Docker Compose v2.
- A supported 64-bit platform, normally Linux/WSL2 on `amd64` or `arm64`.
- An available TCP port, normally `8080`.
- Persistent storage for models, backends, configuration, and application data.
- Internet access during the initial image, backend, and model downloads. For an offline installation, these artifacts must be staged in advance.
- Enough RAM or VRAM for the selected model, including its context/KV cache and runtime overhead.

### GPU-specific requirements

| Hardware | Host requirement                                                                          | Recommended image                                                                          |
| -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| CPU only | No additional runtime                                                                     | `localai/localai:v4.8.0`                                                                   |
| NVIDIA   | Current NVIDIA driver and GPU container support; NVIDIA Container Toolkit on native Linux | `localai/localai:v4.8.0-gpu-nvidia-cuda-12` or `localai/localai:v4.8.0-gpu-nvidia-cuda-13` |
| AMD      | Supported ROCm GPU and access to `/dev/kfd` and `/dev/dri`                                | `localai/localai:v4.8.0-gpu-hipblas`                                                       |
| Intel    | Intel GPU and access to `/dev/dri`                                                        | `localai/localai:v4.8.0-gpu-intel`                                                         |
| Vulkan   | Working Vulkan host driver and appropriate device passthrough                             | `localai/localai:v4.8.0-gpu-vulkan`                                                        |

Use a CUDA 13 image instead when the installed NVIDIA driver and hardware require or support that image variant.

## Practical hardware recommendations

These are approximate starting points for quantized GGUF chat models, not strict LocalAI requirements:

| Model class | Recommended system RAM | Typical Q4 GPU VRAM |
| ----------- | ---------------------: | ------------------: |
| 1-3B        |                8-16 GB |              2-4 GB |
| 7-8B        |                  16 GB |              6-8 GB |
| 13-14B      |                  32 GB |            10-16 GB |
| 30-34B      |               48-64 GB |            20-28 GB |
| 70B         |          96 GB or more |       48 GB or more |

Actual consumption varies with model architecture, quantization, context size, batch size, GPU offloading, and concurrency. Use the LocalAI model gallery's memory estimate before installation and leave headroom for the operating system and Docker.

Additional recommendations:

- Use SSD or NVMe storage. Model loading from an HDD is significantly slower.
- Reserve at least 30-50 GB for a small installation; 100 GB or more is preferable when evaluating several models.
- Start with a `Q4_K_M` GGUF quantization.
- Begin with a moderate context size and increase it only when needed.
- For CPU inference, use approximately the number of physical CPU cores rather than the number of logical threads.
- Avoid loading multiple large models simultaneously until memory use has been measured.

## Recommended Docker Compose configuration

The following CPU configuration binds LocalAI only to the local machine, persists all application state, enables authentication, and includes a startup health check.

```yaml
services:
  localai:
    image: localai/localai:v4.8.0
    container_name: local-ai
    init: true
    restart: unless-stopped

    ports:
      - "127.0.0.1:8080:8080"

    environment:
      LOCALAI_API_KEY: ${LOCALAI_API_KEY}

    volumes:
      - localai-models:/models
      - localai-backends:/backends
      - localai-configuration:/configuration
      - localai-data:/data

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/readyz"]
      interval: 30s
      timeout: 10s
      retries: 10
      start_period: 5m

volumes:
  localai-models:
  localai-backends:
  localai-configuration:
  localai-data:
```

Save this as `compose.yaml`. Set a long random API key, then start LocalAI:

```bash
export LOCALAI_API_KEY='replace-with-a-long-random-secret'
docker compose up -d
docker compose logs -f localai
```

The WebUI and API will be available at `http://localhost:8080`.

The managed forkedAI profile instead uses the pinned CUDA 13 image declared by `LOCALAI_IMAGE`, publishes only the Caddy HTTPS endpoint at `https://localhost:8443`, and stores models under `C:\gaic\models`.

Mounting all four persistent locations is recommended:

| Container path   | Contents                                                     |
| ---------------- | ------------------------------------------------------------ |
| `/models`        | Installed model files                                        |
| `/backends`      | Downloaded and custom inference backends                     |
| `/configuration` | Dynamic LocalAI configuration                                |
| `/data`          | Collections, agents, tasks, jobs, and other application data |

Container files outside persistent volumes can be lost when the container is recreated or upgraded.

## NVIDIA configuration

Change the image in the standalone Compose file and add GPU access. The managed profile already requests the GPU and defaults to the versioned CUDA 13 image:

```yaml
services:
  localai:
    image: localai/localai:v4.8.0-gpu-nvidia-cuda-12

    environment:
      LOCALAI_API_KEY: ${LOCALAI_API_KEY}
      NVIDIA_DRIVER_CAPABILITIES: "compute,utility"

    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia.com/gpu
              count: all
              capabilities: [gpu, utility]
```

LocalAI recommends the CDI configuration above for NVIDIA Container Toolkit 1.14 and later. Older installations may require the legacy `nvidia` driver configuration.

The managed forkedAI profile uses Docker's standard `driver: nvidia` device
reservation because that configuration is validated on this Docker Desktop
workstation. For a standalone native-Linux deployment, use LocalAI's CDI example
when the installed NVIDIA Container Toolkit supports it. Compose 2.30 and newer
also accepts `gpus: all`; choose one GPU declaration style rather than combining
them.

Before starting LocalAI, verify that Docker can access the NVIDIA GPU:

```bash
docker run --rm --gpus all \
  nvidia/cuda:12.8.0-base-ubuntu24.04 nvidia-smi
```

If that test fails, fix Docker/NVIDIA GPU passthrough before troubleshooting LocalAI.

## AMD configuration

Use the ROCm image and expose the required devices:

```yaml
services:
  localai:
    image: localai/localai:v4.8.0-gpu-hipblas
    devices:
      - /dev/kfd:/dev/kfd
      - /dev/dri:/dev/dri
    group_add:
      - video
```

Confirm the host recognizes the GPU with `rocminfo` and verify that the Docker user can access both device paths.

## Intel configuration

Use the Intel image and expose the Direct Rendering Infrastructure devices:

```yaml
services:
  localai:
    image: localai/localai:v4.8.0-gpu-intel
    devices:
      - /dev/dri:/dev/dri
```

LocalAI documents a known SYCL issue with memory mapping. If an Intel model hangs during loading, set `mmap: false` in its model configuration.

## Windows and WSL2 recommendations

- Keep WSL current with `wsl --update`; Docker requires WSL 2.1.5 or newer.
- Use Docker Desktop with the WSL2 backend and Linux containers.
- Enable Docker Desktop integration only for the WSL distributions that need it.
- Do not install a second Docker Engine or Docker CLI inside an integrated WSL
  distribution.
- Install a current Windows NVIDIA driver that supports WSL2. Do not install a
  Linux NVIDIA display driver inside WSL.
- For a standalone LocalAI-only deployment, Linux-filesystem storage generally loads models faster than `/mnt/c` or `/mnt/e`. This repository deliberately uses `C:\gaic\models` as the canonical, cross-tool collection; expect the first scan to be slower and do not create a second unmanaged model copy merely to follow the standalone example.
- Allocate sufficient RAM, CPU, swap, and Docker disk capacity to Docker
  Desktop/WSL2.
- Confirm GPU access with the NVIDIA Docker test before starting LocalAI.

## Security recommendations

- Keep the port bound to `127.0.0.1` for local-only use.
- Set `LOCALAI_API_KEY` even for a workstation installation if other local applications or users are not fully trusted.
- Simple API keys grant full administrative access. For multi-user deployments, use LocalAI's user authentication with `LOCALAI_AUTH=true`.
- If remote access is required, place LocalAI behind a TLS-enabled reverse proxy and restrict network access with a firewall or VPN.
- Prefer a Compose secret when the application supports a file-based credential.
  LocalAI's environment-only settings should be injected from a protected
  session or operating-system secret store and kept out of logs.
- Do not commit API keys or the `.env` file containing them to source control.
- Pin a tested version tag instead of using `latest` in a production deployment, then upgrade intentionally.
- Pin an image digest when an audited deployment requires immutable image bytes;
  review digest updates as dependency changes.

## Validation checklist

```bash
# Confirm that the container is running
docker compose ps

# Inspect startup and backend logs
docker compose logs -f localai

# Check readiness
curl http://localhost:8080/readyz

# Query installed models with authentication
curl http://localhost:8080/v1/models \
  -H "Authorization: Bearer ${LOCALAI_API_KEY}"
```

Then open `http://localhost:8080`, install a small model from the gallery, and test a short chat request before adding larger models or increasing context size.

## Troubleshooting priorities

1. Verify the container runtime is running with `docker ps`.
2. Check that port `8080` is not already in use.
3. Read `docker compose logs localai` for the backend's actual error.
4. For NVIDIA, verify the standalone CUDA `nvidia-smi` container test.
5. For an out-of-memory error, choose a smaller quantization, reduce context size, reduce concurrent models, or add RAM/VRAM.
6. If model loading is slow, ensure the model is stored on SSD-backed Linux storage rather than an HDD or Windows-mounted filesystem.
