# .agents

Repository-local agent guidance for `likwid-gaic`.

These files mirror and split the repository agent instructions into smaller
skill and rule documents. Apply them to the repository root and all descendants.

## Start here

- [Safety rules](rules/safety.md)
- [Protected branches](rules/protected-branches.md)
- [First run](skills/first-run.md)
- [Validation](skills/validation.md)
- [Documentation](skills/documentation.md)
- [Docker and Compose](skills/docker-compose.md)
- [Storage, models, and media](skills/storage-models-media.md)
- [Managed forks and GitHub](skills/managed-forks-github.md)

## Repository purpose

`likwid-gaic` is a local-first operations hub for managed AI forks. It owns
orchestration, storage policy, model metadata, media inventory, fork management,
validation, and documentation across Windows, macOS, and Linux.

The reference validation host is a Windows 11 / WSL2 / Docker Desktop / NVIDIA
workstation. The repo must not absorb private runtime data or silently modify
managed fork worktrees.

## Sources of truth

- `config/accounts.json` â€” GitHub account boundary, SSH aliases, credential policy.
- `config/repos.json` â€” managed fork identities, paths, preferred origins.
- `config/storage.json` â€” canonical Windows, WSL, and POSIX storage roots.
- `config/models.json` â€” immutable Hugging Face selections and LocalAI metadata.
- `config/profile-artifacts.json` â€” required and recommended artifacts per profile.
- `config/stack.json` â€” profiles, services, networks, ports, shared mounts.
- `compose.yaml` / `compose.cpu.yaml` â€” executable container topology.
- `.env.example` â€” complete non-secret Compose override template.
- `docs/README.md` â€” documentation index and conventions.
- `scripts/*.mjs` â€” supported automation.

Prefer npm scripts over ad hoc commands when an equivalent workflow exists.
