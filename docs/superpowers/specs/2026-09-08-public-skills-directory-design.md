# Public general skills directory

## Goal

Publish a small, standalone **public** repository that (a) is directly
installable as a Claude Code plugin marketplace, and (b) works as a curated,
browsable directory pointing at other worthwhile general-purpose skill
sources — separate from `likwid-gaic`'s private `.agents/skills-catalog.json`,
which only indexes forks for this hub's own internal use and is not meant to
be a public-facing product.

## Current state

- `.agents/skills-catalog.json` (private, inside `likwid-gaic`) catalogs 77
  skill topics from four forks tracked in `config/repos.json`
  (`superpowers-pr`, `matt-skills-pr`, `agent-skills-pr`,
  `ui-ux-pro-max-skill-pr`), installed as user-scope Claude Code plugins on
  this workstation.
- Per `docs/github-access.md`'s account boundary, `likwidmack` owns
  public-facing repos; `tamaramack` owns the private managed forks. A public
  directory belongs under `likwidmack`.
- None of the four forks' own marketplace names should be reused or
  vendored — copying their skill code in would duplicate maintenance and
  muddy attribution. The directory links to them instead.

## Decisions (approved)

| Decision | Choice |
| -------- | ------ |
| Repo name/owner | `likwidmack/gaic-skills-directory`, public |
| What it bundles directly | One genuinely original, general-purpose skill extracted from a pattern proven in `likwid-gaic`: `single-gpu-profile-switching` (teaches detecting/avoiding GPU-service contention on a single-GPU Docker Compose host — generalized from `scripts/stack-policy.mjs`'s `gpuSwitchPlan`/`assertGpuPreflight` logic, with no `likwid-gaic`-specific naming) |
| What it only links to | The four existing forks (via their marketplace names already registered on this workstation: `superpowers-dev`, `mattpocock`, `anthropic-agent-skills`, `ui-ux-pro-max-skill`), each with a one-line description and attribution/license note |
| Installable as a marketplace | Yes — `.claude-plugin/marketplace.json` lists the one bundled plugin, so `claude plugin marketplace add likwidmack/gaic-skills-directory` works immediately |
| License | MIT, matching the pattern used by the linked-to forks |
| Vendoring other forks' code | Out of scope — link only, never copy |
| Contribution model | `CONTRIBUTING.md` accepts PRs adding new bundled skills or new directory links |

## File map

| File | Responsibility |
| ---- | --------------- |
| `E:\git\gaic-skills-directory\.claude-plugin\marketplace.json` | Marketplace manifest, one plugin |
| `E:\git\gaic-skills-directory\.claude-plugin\plugin.json` | Plugin manifest for `single-gpu-profile-switching` |
| `E:\git\gaic-skills-directory\skills\single-gpu-profile-switching\SKILL.md` | The one bundled, original skill |
| `E:\git\gaic-skills-directory\README.md` | The curated public directory (categorized links + the bundled skill) |
| `E:\git\gaic-skills-directory\LICENSE` | MIT |
| `E:\git\gaic-skills-directory\CONTRIBUTING.md` | How to propose additions |
| `likwid-gaic`'s `.agents/README.md` and root `README.md` | Cross-link to the new public repo |

## Non-goals

- Vendoring or forking the four linked repos' code into this new repo
- A website/GitHub Pages front end — the GitHub README is the directory for v1
- Automated sync between `.agents/skills-catalog.json` (private) and the
  public README (manual curation for now; revisit if the list grows large)
- Issue templates / GitHub Actions CI for the new repo (kept minimal for v1)
