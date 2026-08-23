# likwid-gaic agent guide

This file records repository-specific skills, workflows, and safety rules for
agents working on likwid-gaic. Apply these instructions to the repository root
and all descendants.

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
- Set `FORKEDAI_COMPUTE=cpu` on macOS (default) or non-NVIDIA Linux for
  inference/RAG; `media`/`comfy` require `nvidia`.

## Skill: first run

Use this sequence on a new workstation before starting profiles. Do not broaden
`FORKEDAI_BIND_ADDRESS`, add gateway authentication, or configure managed-stack
`LOCALAI_API_KEY` unless explicitly requested.

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
npm run media -- init
npm test
npm run stack:doctor
npm run stack:config
npm run models -- download chat-qwen2.5-3b
npm run models -- download embed-nomic-v1.5
npm run models -- verify chat-qwen2.5-3b
npm run models -- verify embed-nomic-v1.5
npm run models -- sync-localai
npm run stack -- up inference
npm run stack -- backend
```

Trust the Caddy development CA, then verify `https://localhost:8443`. Use
`npm run media -- status` for a read-only storage check. The full profile order,
CA import commands, and optional `rag`, `media`, and `comfy` steps are in
[docs/container-operations.md](docs/container-operations.md).

## Skill: repository validation

Use the smallest applicable verification set, then expand in proportion to the
change:

```powershell
npm test
npm run stack:doctor
npm run stack:config
npm run repos:status
npm run models -- list
npm run media -- status
```

- `npm test` validates configuration, storage defaults, immutable model pins,
  privacy rules, Docker artifacts, Compose topology, environment coverage, and
  local Markdown links. Pull requests to `development` (the default integration
  branch) and `main` (the release branch) run the same command as the GitHub
  Actions job named `Local parity` ([docs/cicd.md](docs/cicd.md)). Do not add
  CD workflows unless explicitly requested.
- `stack:doctor` is read-only and checks Node.js, Docker, Compose, NVIDIA, the
  Hugging Face CLI, storage roots, and fork contexts.
- `stack:config` renders all profiles without starting or recreating services.
- Syntax-check changed JavaScript with `node --check`.
- Always run `git diff --check` and inspect `git status --short --branch`
  before handoff. If changes are staged, also run `git diff --cached --check`.

## Skill: documentation

- Keep maintained documentation under `docs/`; keep the root `README.md`
  concise and navigational.
- Update `docs/README.md` when adding, moving, or removing a guide.
- Use sentence-case headings, fenced code blocks with a language, consistent
  tables, and descriptive relative links.
- PowerShell examples run from the repository root. Label WSL examples as
  `bash`.
- Format maintained Markdown with:

```powershell
$docs = (Get-ChildItem docs/*.md | Where-Object Name -ne "inventory.generated.md").FullName
npx --yes prettier@3.6.2 --write README.md $docs
```

- Do not format or commit `docs/inventory.generated.md`; it is local,
  generated, and may expose machine details.
- `scripts/validate.mjs` automatically discovers maintained Markdown under
  `docs/` and excludes only the generated inventory.
- Verify current Docker, NVIDIA, LocalAI, and other mutable technical
  recommendations against official primary documentation before changing them.
- Keep architecture, operations, service setup, security, and troubleshooting
  guidance in their respective pages instead of repeating full procedures.

## Skill: Docker and Compose

- Prefer `npm run stack -- ...`; `scripts/docker.mjs` injects canonical fork
  contexts and storage roots and appends `compose.cpu.yaml` when
  `FORKEDAI_COMPUTE=cpu` (default on macOS).
- Supported profiles are `inference`, `rag`, `media`, and `comfy`. In CPU mode
  only `inference` and `rag` are allowed; media/comfy require `nvidia`.
- On a single-GPU host, at most one of `localai`, `stable-diffusion`, or
  `comfy-backend` may run. Use `npm run stack -- switch PROFILE` to stop
  conflicting GPU services before starting another profile. `up` refuses GPU
  conflicts unless `--allow-gpu-share` is passed. See
  [docs/resource-utilization.md](docs/resource-utilization.md).
- `npm run stack -- resources` is a read-only GPU and service snapshot.
- Never set `LOCALAI_THREADS` (or other LocalAI integer env vars) to an empty
  string in Compose; LocalAI exits on `LOCALAI_THREADS=""`.
- Caddy is the only service allowed to publish host ports. The default bind
  address is `127.0.0.1`; do not broaden it without hostname, certificate,
  authentication, firewall, and rollback planning.
- Preserve `no-new-privileges:true`, read-only source mounts, health checks,
  private backend ports, and segmented bridges.
- The validated GPU declaration is the Compose Deploy reservation using
  `driver: nvidia`, `count: all`, and `capabilities: [gpu]`. CDI and
  `gpus: all` are alternatives, not additions. Do not combine declaration
  styles without a tested migration.
- Use reviewed version tags for planned workstation upgrades. Use image digests
  when immutable bytes are required, and review each digest update.
- `npm run stack -- pull` refreshes registry-backed, non-buildable services.
  Use direct `docker compose build --pull` with the ignored `.env` only for
  a deliberate base-image refresh. Reserve `--no-cache` for clean rebuilds or
  cache diagnosis.
- Treat Compose files, overrides, Dockerfiles, build contexts, bind mounts,
  device grants, and remote includes as executable trusted input. Inspect
  `npm run stack:config` before `up`.
- Prefer service-scoped Compose secrets when an application supports file-based
  credentials. Otherwise inject environment-only secrets from a protected
  process or operating-system secret store. Never commit or print credentials.
- Never add automatic volume deletion, `docker system prune`, or destructive
  cleanup to repository scripts.
- Rendering configuration does not update a running container. Do not recreate,
  pull, build, or restart services unless the user requests an operational
  change.

## Skill: storage, models, and media

Storage policy:

| Role               | Root               | Rule                                                   |
| ------------------ | ------------------ | ------------------------------------------------------ |
| Read-mostly assets | `C:\gaic`          | Models, reviewed plugins, and tools                    |
| Rebuildable data   | `D:\forkedAI`      | Caches, tensors, and temporary files only              |
| Durable state      | `E:\data\forkedAI` | Media, documents, objects, runtime state, and Caddy CA |
| Host-only backup   | `E:\VIMG`          | Never mount into a container                           |

- D: is non-redundant. Never place the only durable copy of an artifact there.
- Do not create a second unmanaged model tree to work around Windows bind-mount
  performance.
- Model manifests must use a full 40-character revision, explicit include list,
  safe relative destination, and reviewed license/provenance.
- Preferred model workflow:

```powershell
npm run models -- plan ALIAS
npm run models -- download ALIAS
npm run models -- verify ALIAS
npm run models -- sync-localai
```

- Multiple managed models share `C:\gaic\models\localai`. Hugging Face may
  warn about unselected remote files and unrelated local files; the checksum
  result for the selected artifact is authoritative.
- Media initialization and indexing are non-destructive. No media command may
  delete user content.
- Never commit model weights, generated media, private documents, databases,
  runtime state, local inventories, caches, `.env`, keys, or tokens.
- Treat pickle, PyTorch checkpoints, plugins, extensions, and custom nodes as
  executable content. Prefer GGUF or safetensors from reviewed sources.

## Skill: managed forks and GitHub

- The hub belongs to `likwidmack/likwid-gaic`; managed forks belong to
  `tamaramack`.
- `npm run repos:status` is read-only.
- `npm run repos:fetch` refreshes remote references only.
- `npm run repos:update` performs fetch plus fast-forward-only upstream
  updates and must refuse dirty or detached worktrees.
- Never reset, rebase, force-push, delete branches, discard dirty fork changes,
  rewrite remotes, or automatically push managed forks.
- Preserve mixed remote transports; the Comfy forks may use HTTPS while the
  other forks use SSH.
- The hub's raw origin should remain the canonical
  `git@github.com:likwidmack/likwid-gaic.git`. A workstation `insteadOf` rule
  may display the `github.com-lkpc` alias. Do not store an already rewritten
  alias as the raw remote because it can be rewritten twice.
- Git SSH identity and GitHub CLI API identity are separate. Check
  `gh auth status --hostname github.com` before GitHub API writes.
- Do not commit, stage unrelated changes, push, create a pull request, or mutate
  GitHub state unless explicitly requested. Before an authorized commit or push,
  review staged and unstaged diffs, run verification, confirm the branch and
  destination account, and report exactly what changed.

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
