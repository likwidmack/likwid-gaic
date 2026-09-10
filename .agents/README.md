# .agents

Hub-local agent guidance for `likwid-gaic`.

These files mirror and split the hub's agent instructions into smaller
skill and rule documents. Apply them to the hub root and all descendants.

## Start here

- [Safety rules](rules/safety.md)
- [Protected branches](rules/protected-branches.md)
- [First run](skills/first-run.md)
- [Validation](skills/validation.md)
- [Documentation](skills/documentation.md)
- [Docker and Compose](skills/docker-compose.md)
- [Storage, models, and media](skills/storage-models-media.md)
- [Managed forks and GitHub](skills/managed-forks-github.md)

## External skill sources

Beyond the hub's own guidance above, [skills-catalog.json](skills-catalog.json)
indexes the Claude Code skill topics available from four forked skill
repositories (`superpowers-pr`, `matt-skills-pr`, `agent-skills-pr`,
`ui-ux-pro-max-skill-pr`, all tracked in `config/repos.json`). They are
installed as **user-scope Claude Code plugins** (`claude plugin list`), not
copied into the hub, so they apply in every project on this workstation —
this hub and the PrivateGPT, ComfyUI, and stable-diffusion-ui forks alike —
not just here. Use `npm run repos:fetch` / `repos:update` to keep the fork
clones current with upstream; the plugin installs point at those clones.

## Hub purpose

`likwid-gaic` is a **local-first operations hub** for managed AI forks. It owns
orchestration, storage policy, model metadata, media inventory, fork management,
validation, and documentation across Windows, macOS, and Linux.

The reference validation host is a Windows 11 / WSL2 / Docker Desktop / NVIDIA
workstation. The hub must not absorb private runtime data or silently modify
managed fork worktrees.

## Sources of truth

- `config/accounts.json` — GitHub account boundary, SSH aliases, credential policy.
- `config/repos.json` — managed fork identities, paths, preferred origins.
- `config/storage.json` — canonical Windows, WSL, and POSIX storage roots.
- `config/models.json` — immutable Hugging Face selections and LocalAI metadata.
- `config/profile-artifacts.json` — required and recommended artifacts per profile.
- `config/stack.json` — profiles, services, networks, ports, shared mounts.
- `compose.yaml` / `compose.cpu.yaml` — executable container topology.
- `.env.example` — complete non-secret Compose override template.
- `docs/README.md` — documentation index and conventions.
- `scripts/*.mjs` — supported automation.

Prefer npm scripts over ad hoc commands when an equivalent workflow exists.
