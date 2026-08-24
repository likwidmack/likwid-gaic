# Documentation

This directory contains the maintained operating documentation for likwid-gaic.
Start with the architecture and container guides, then use the service-specific
pages when building or troubleshooting a profile.

## Start here

1. [Root README](../README.md) — product overview, plus
   [Profiles](../README.md#profiles) and
   [npm scripts](../README.md#npm-scripts) quick reference.
2. [System architecture](architecture.md) — configuration, topology, storage,
   and privacy boundaries.
3. [Node.js and npm setup](node-setup.md) — Node boundary, path flavors, and
   doctor checks across Windows, macOS, and Linux.
4. [Container operations](container-operations.md) — platforms, compute modes,
   profiles, first run, updates, storage mounts, and daily commands.
5. [GPU and CPU resource utilization](resource-utilization.md) — single-GPU
   profile switching, host sizing, and monitoring.

## Service guides

- [LocalAI Docker setup](localai-docker-setup.md)
- [PrivateGPT Docker setup](privategpt-docker-setup.md)
- [Stable Diffusion WebUI Docker setup](stable-diffusion-docker-setup.md)
- [ComfyUI Docker setup](comfyui-docker-setup.md)
- [Use cases and models](use-cases-and-models.md) — workload → profile → pins → UI

## Data and security

- [Models and managed media](models.md)
- [Network security](network-security.md)
- [GitHub accounts and repository access](github-access.md)
- [Continuous integration](cicd.md) — local-parity CI on PRs to `development`
  (default) and `main` (release)
- [Contributing](../CONTRIBUTING.md) · [Security policy](../SECURITY.md)

## Generated inventory

`inventory.generated.md` is created locally by `npm run inventory` and is
intentionally ignored by Git. It can contain workstation paths, installed
models, GPU details, and Docker state; review it before sharing.

## Documentation conventions

- PowerShell examples run from the repository root unless stated otherwise.
- Bash examples run on macOS, native Linux, or WSL (labeled when WSL-specific).
- `config/*.json` files are the source of truth for repositories, storage,
  models, profile artifacts, and stack topology (`pathWindows` / `pathWsl` /
  `pathPosix`).
- `.env.example` is a non-secret Compose override template with Windows
  examples from `config/storage.json` and fork names from `config/repos.json`;
  copy it to ignored `.env` and adjust for your layout. Never commit credentials.
- Canonical fork and storage paths live in `config/repos.json` and
  `config/storage.json`; the npm stack runner injects those values.
- `FORKEDAI_COMPUTE` selects nvidia vs cpu Compose rendering.
- Run `npm test` after changing documentation links or configuration examples.
