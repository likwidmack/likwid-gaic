# Documentation

This directory contains the maintained operating documentation for forkedAI.
Start with the architecture and container guides, then use the service-specific
pages when building or troubleshooting a profile.

## Start here

1. [System architecture](architecture.md) — configuration, topology, storage,
   and privacy boundaries.
2. [Node.js and npm setup](node-setup.md) — the supported Windows and WSL
   command boundary.
3. [Container operations](container-operations.md) — profiles, first run,
   updates, storage mounts, and daily commands.
4. [GPU and CPU resource utilization](resource-utilization.md) — single-GPU
   profile switching, host sizing, and monitoring.

## Service guides

- [LocalAI Docker setup](localai-docker-setup.md)
- [ComfyUI Docker setup](comfyui-docker-setup.md)

## Data and security

- [Models and managed media](models.md)
- [Network security](network-security.md)
- [GitHub accounts and repository access](github-access.md)
- [Continuous integration](cicd.md) — local-parity CI on PRs to `development`
  (default) and `main` (release)

## Generated inventory

`inventory.generated.md` is created locally by `npm run inventory` and is
intentionally ignored by Git. It can contain workstation paths, installed
models, GPU details, and Docker state; review it before sharing.

## Documentation conventions

- PowerShell examples run from the repository root unless stated otherwise.
- Bash examples run in WSL.
- `config/*.json` files are the source of truth for repositories, storage,
  models, and stack topology.
- `.env.example` is a generic Compose override template; copy it to ignored
  `.env` and replace placeholder paths. Never commit credentials.
- Canonical fork and storage paths live in `config/repos.json` and
  `config/storage.json`; the npm stack runner injects those values.
- Run `npm test` after changing documentation links or configuration examples.
