New-Item -ItemType Directory -Force .agents, .agents/skills, .agents/rules | Out-Null

@'
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
'@ | Set-Content -Encoding UTF8 .agents/README.md

@'
# Safety rules

## General editing

- Preserve user-owned and concurrent changes.
- Re-read Git state before and after significant edits.
- Keep edits scoped to the request.
- Do not stage, commit, push, or create pull requests unless explicitly requested.
- Do not mutate GitHub state unless explicitly requested.
- Avoid destructive commands.
- Resolve exact targets before cleanup.
- Ask before removal or overwrite when not explicitly authorized.

## Secrets and private data

Never commit, print, or expose:

- Credentials
- Tokens
- Keys
- `.env`
- Model weights
- Generated media
- Private documents
- Databases
- Runtime state
- Local inventories
- Caches
- User-generated content

## Operational safety

- Do not deploy a documentation change.
- Do not restart, recreate, pull, build, or start services unless requested.
- Do not add automatic volume deletion.
- Do not add `docker system prune`.
- Do not add destructive cleanup to repository scripts.

## Network safety

- Caddy is the only service allowed to publish host ports.
- The default bind address is `127.0.0.1`.
- Do not broaden `FORKEDAI_BIND_ADDRESS` without hostname, certificate,
  authentication, firewall, and rollback planning.

## Definition of done

1. Relevant sources of truth and existing user changes were inspected.
2. Requested changes are implemented and documentation is consistent.
3. `npm test` passes when applicable.
4. Markdown formatting passes when maintained docs changed.
5. `npm run stack:config` passes when Compose, Dockerfiles, environment, storage,
   or Docker recommendations changed.
6. Changed scripts parse and relevant read-only workflows were exercised.
7. Staged and unstaged diffs are clean and reviewed.
8. Handoff states verification results, uncommitted or staged state, and any
   operational action deliberately not taken.
'@ | Set-Content -Encoding UTF8 .agents/rules/safety.md

@'
# Protected branches

Never create commits directly on `development` or `main`.

## Required behavior before committing

1. Check the current branch.
2. If on `development` or `main`, create or check out a feature, docs, or fix
   branch first.
3. Commit only on the topic branch.

## Pull requests

- Pull requests normally target `development` for integration.
- Pull requests may target `main` for release.
- Do not push commits straight onto `development` or `main` unless explicitly
  overridden by the user for a specific action.

## Accidental local commit

If a commit lands on `development` or `main` by mistake:

1. Confirm the mistaken commit is local and unpushed.
2. Move it to a topic branch.
3. Reset the protected branch to match its remote only when safe and authorized.
'@ | Set-Content -Encoding UTF8 .agents/rules/protected-branches.md

@'
# First run

Use this sequence on a new workstation before starting profiles.

Do not broaden `FORKEDAI_BIND_ADDRESS`, add gateway authentication, or configure
managed-stack `LOCALAI_API_KEY` unless explicitly requested.

## Windows / PowerShell
