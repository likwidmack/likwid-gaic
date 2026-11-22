# likwid-gaic agent guide

Global rules: read `E:\git\_ha\agent-system\agent\GLOBAL.md` first; this file adds project rules on top.

This file records repository-specific boundaries, workflows, and safety rules for
agents working on likwid-gaic. Procedures live in `.agents/skills/`. Apply these
instructions to the repository root and all descendants.

## Repository purpose

likwid-gaic is the local-first operations hub for five managed AI forks. It owns
orchestration, storage policy, model metadata, media inventory, fork management,
validation, and documentation across Windows, macOS, and Linux. The reference
validation host is a Windows 11 / WSL2 / Docker Desktop / NVIDIA workstation.
It must not absorb private runtime data or silently modify the managed fork
worktrees.

## Sources of truth

- `config/accounts.json`: GitHub account boundary (`likwidmack` hub,
  `tamaramack` forks), SSH host aliases, and credential policy.
- `config/repos.json`: managed fork identities, paths, and preferred origins.
- `config/storage.json`: canonical Windows, WSL, and POSIX storage roots.
- `config/models.json`: immutable Hugging Face selections and LocalAI metadata.
- `config/profile-artifacts.json`: required and strongly recommended models,
  directories, plugins, and objects per Compose profile.
- `config/stack.json`: profiles, services, networks, ports, and shared mounts.
- `compose.yaml` / `compose.cpu.yaml`: executable container topology and CPU overlay.
- `.env.example`: complete non-secret Compose override template.
- `docs/README.md`: documentation index and conventions.
- `scripts/*.mjs`: supported automation. Prefer npm scripts over ad hoc
  commands when an equivalent workflow exists.

Do not duplicate configuration values in documentation when they can be linked
or derived from these files.

## Workstation boundary

- Reference Windows path: `E:\git\_lk\forkedAI` (local clone name may still be
  forkedAI until renamed).
- Reference WSL path: `/mnt/e/git/_lk/forkedai`.
- POSIX defaults: `~/git/...` forks and `~/gaic` / `~/forkedAI` / `~/data/forkedAI`
  storage from `pathPosix` (see `scripts/paths.mjs`).
- Run repository npm workflows from the repository root.
- On Windows, the npm runner uses Windows Node.js and the Windows Docker
  toolchain. Interactive WSL can resolve a separate `/usr/bin/docker` first;
  compare client and server versions before changing installs.
- Use Docker Desktop in Linux-container mode with current WSL2 integration on
  Windows. Do not recommend a second Docker Engine or Linux NVIDIA display
  driver inside the integrated WSL distribution.
- Unset or `GAIC_COMPUTE=auto` probes host `nvidia-smi` and resolves `nvidia`
  or `cpu`. Pin `nvidia` or `cpu` to skip the probe. `media` and `comfy` require
  `nvidia` after resolution.

## Workflow: first run

Skill: [`gaic-first-run`](.agents/skills/gaic-first-run/SKILL.md). Use it on a
new workstation before starting profiles. Do not broaden `GAIC_BIND_ADDRESS`, add
gateway authentication, or configure managed-stack `LOCALAI_API_KEY` unless
explicitly requested.

## Workflow: repository validation

Skill: [`gaic-validation`](.agents/skills/gaic-validation/SKILL.md). Use the
smallest applicable verification set, then expand in proportion to the change.
`npm test` is the local parity gate and runs as the `Local parity` CI job on
pull requests to `development` and `main` ([docs/cicd.md](docs/cicd.md)). Do not
add CD workflows unless explicitly requested. Always run `git diff --check` and
inspect `git status --short --branch` before handoff.

## Workflow: documentation

Skill: [`gaic-docs-maintenance`](.agents/skills/gaic-docs-maintenance/SKILL.md).
Keep maintained documentation under `docs/`, update `docs/README.md` when
guides change, and never format or commit `docs/inventory.generated.md`.

## Workflow: Docker and Compose

Skill: [`gaic-stack-ops`](.agents/skills/gaic-stack-ops/SKILL.md). Prefer
`npm run stack -- ...`. Caddy is the only service allowed to publish host ports,
and the default bind address stays `127.0.0.1`. Never add automatic volume
deletion, `docker system prune`, or destructive cleanup to repository scripts.
Do not recreate, pull, build, or restart services unless the user requests an
operational change. Never run `npm run gpu:cap-power` without `--dry-run`
unless the user explicitly consents in the moment.

## Workflow: storage, models, and media

Skill: [`gaic-model-storage`](.agents/skills/gaic-model-storage/SKILL.md). Storage
roots are defined in `config/storage.json`; the skill holds the role table and
model workflow. D: is non-redundant, and `E:\VIMG` is never mounted into a
container. Never commit model weights, generated media, private documents,
databases, runtime state, local inventories, caches, `.env`, keys, or tokens.

## Workflow: managed forks and GitHub

Skill: [`gaic-managed-forks`](.agents/skills/gaic-managed-forks/SKILL.md). The hub
belongs to `likwidmack/likwid-gaic`; managed forks belong to `tamaramack`.
Never reset, rebase, force-push, delete branches, discard dirty fork changes,
rewrite remotes, or automatically push managed forks. Do not commit, push,
create a pull request, or mutate GitHub state unless explicitly requested.
Branch policy: never commit or push directly on `development` or `main`; use a
topic branch and a pull request into `development` (global rules and user
rules apply).

## Editing and safety rules

- Preserve user-owned and concurrent changes. Re-read `git status` before and
  after significant edits because the index may change during a task.
- Use `apply_patch` for content edits and `git mv` for intentional tracked
  file moves. If the patch helper is unavailable, report the tooling failure and
  use the narrowest safe patch mechanism available.
- Keep edits scoped to the request. Do not deploy a documentation change or fix
  unrelated dirty fork worktrees.
- Avoid destructive commands. Resolve exact targets before any cleanup and ask
  for approval when removal or overwrite is not explicitly authorized.
- Do not expose secrets, private inventory, model prompts, local paths beyond
  what the repository already documents, or generated user content in logs or
  commits.

## Definition of done

1. Relevant sources of truth and existing user changes were inspected.
2. The requested change is implemented and documentation is consistent.
3. `npm test` passes.
4. Markdown formatting passes when documentation changed.
5. `npm run stack:config` passes when Compose, Dockerfiles, environment, storage,
   or Docker recommendations changed.
6. Changed scripts parse and relevant read-only workflows were exercised.
7. Staged and unstaged diffs are clean and reviewed.
8. The handoff states verification results, uncommitted or staged state, and any
   operational action deliberately not taken.
