# likwid-gaic public naming and repository standards

## Goal

Rename the public identity of this hub from **forkedAI** / `forked-ai` to
**likwid-gaic**, ship a concise friendly root README, and adopt standard npm
and GitHub community layout for a public, non-published Node tooling repository.

## Decisions (approved)

| Decision               | Choice                                                                         |
| ---------------------- | ------------------------------------------------------------------------------ |
| Public name            | `likwid-gaic`                                                                  |
| Package name           | `likwid-gaic`                                                                  |
| Approach               | Recommended: MIT + community files + README + package metadata                 |
| License                | MIT                                                                            |
| npm publish            | Keep `"private": true` (GitHub-first tooling; prevent accidental publish)      |
| Storage path migration | Out of scope; keep `D:\forkedAI`, `E:\data\forkedAI`, and related config paths |
| GitHub remote rename   | Documented as operator step; this change updates in-repo references            |
| Code of conduct        | Out of scope for this pass                                                     |
| Continuous deployment  | None (existing Local parity CI only)                                           |

## Product identity

**likwid-gaic** is a local-first control plane for a Windows / WSL2 / Docker
Desktop / NVIDIA AI workstation. It orchestrates Compose profiles, pinned
models, storage policy, managed forks, and validation. It is not the inference
or media applications themselves.

Suggested one-liner for README and `package.json` description:

> Local-first control plane for a GPU AI workstation: Compose profiles, model
> pins, storage policy, and managed forks.

Optional expansion once in README: **GAIC** = GPU AI Control (aligned with the
read-mostly `C:\gaic` asset root).

## Root README

Replace the current private-workstation dump with a public landing page:

1. Title `# likwid-gaic` and the one-liner above
2. Short “What you get” bullet list (orchestration, models, storage policy,
   fork tracking, validation) — no machine-specific disk letters
3. Requirements checklist (Windows 11, WSL2, Git, Node 20+, Docker Desktop,
   NVIDIA, Hugging Face CLI)
4. Quick start: small PowerShell block (`npm install`, `npm test`,
   `stack:doctor`, pointer to docs for first-run profiles)
5. Documentation table linking into `docs/`
6. Privacy note: source and non-secret config in Git; weights, media, secrets,
   and runtime state stay out
7. License badge/line pointing at `LICENSE`

Move long command catalogs, fork path tables, and disk-letter operating policy
out of the root README (they remain in `docs/`).

## npm package metadata

Update `package.json` and `package-lock.json` name to `likwid-gaic`.

Add fields:

- `description` — one-liner above
- `license` — `MIT`
- `homepage` — `https://github.com/likwidmack/likwid-gaic#readme`
- `repository` — `{ "type": "git", "url": "git+https://github.com/likwidmack/likwid-gaic.git" }`
- `bugs` — `{ "url": "https://github.com/likwidmack/likwid-gaic/issues" }`
- `keywords` — e.g. `local-ai`, `docker-compose`, `gpu`, `workstation`, `orchestration`
- Keep `type: module`, `engines.node: >=20`, existing scripts, `private: true`

Do not add runtime dependencies. Do not publish to the npm registry.

## GitHub community and layout

Add:

| Path                                    | Role                                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `LICENSE`                               | MIT, copyright year 2026, copyright holder `likwidmack` (or legal name if preferred later)                           |
| `SECURITY.md`                           | Supported versions note; private vulnerability reporting via GitHub Security Advisories; no secrets in public issues |
| `CONTRIBUTING.md`                       | Branch model (`development` default, `main` release); run `npm test`; PR expectations; pointer to `docs/cicd.md`     |
| `.github/PULL_REQUEST_TEMPLATE.md`      | Summary, test plan, checklist (`npm test`, docs if needed)                                                           |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Config-driven bug report                                                                                             |
| `.github/ISSUE_TEMPLATE/docs.yml`       | Documentation request                                                                                                |
| `.github/ISSUE_TEMPLATE/config.yml`     | Disable blank issues or route to docs                                                                                |

Keep existing:

- `.github/workflows/ci.yml` — Local parity on PRs to `development` and `main`
- `.github/dependabot.yml` — npm and GitHub Actions monthly

Do not add release/CD workflows.

## In-repo naming updates

Update display and GitHub identity references from forkedAI / `likwidmack/forkedAI`
to likwid-gaic / `likwidmack/likwid-gaic` in:

- `README.md`
- `docs/README.md`
- `AGENTS.md` (title and product prose; keep current Windows/WSL clone path
  examples until the operator renames the local directory)
- `docs/github-access.md`
- `config/accounts.json` (`repository`, and purpose text: public hub, not
  “private”)
- Narrative “managed forkedAI” phrasing in service docs → “managed likwid-gaic”
  where it refers to this hub (not upstream forks)

**Do not change** in this pass:

- Host storage path strings under `D:\forkedAI` / `E:\data\forkedAI`
- Media index side-path `.forkedai` unless a follow-up migrates durable state
- Managed fork repository names under `tamaramack`
- Local clone directory name `E:\git\_lk\forkedAI` (operator rename later)

## Operator steps outside this change set

1. Rename the GitHub repository to `likwidmack/likwid-gaic` (Settings → Rename)
2. Optionally rename the local clone folder to match
3. Update any workstation bookmarks, SSH insteadOf expectations remain valid
   if the remote URL path changes after rename (GitHub redirects old URLs)

## Verification

- `npm test`
- Prettier on maintained Markdown when docs change
- `git diff --check`
- Confirm `package.json` name matches lockfile
- No secrets introduced; `.env` remains ignored

## Out of scope

- Renaming on-disk storage roots
- Publishing to npm
- CODE_OF_CONDUCT.md
- Changing CI job name (`Local parity`) or skip-CI policy
- Managed-fork remote rewrites
- GitHub repository rename itself (manual)
