# .agents

Repository-local agent guidance for `likwid-gaic`.

The root [AGENTS.md](../AGENTS.md) is the single source for repository purpose,
sources of truth, workstation boundary, safety rules, and definition of done.
Global rules, including protected-branch and pull request policy, live in
`E:\git\_ha\agent-system\agent\GLOBAL.md`. This folder holds only the
procedural skills that `AGENTS.md` points to.

## Skills

Each skill is a package at `skills/<name>/SKILL.md` with `name` and
`description` (USE WHEN...) frontmatter.

- [gaic-first-run](skills/gaic-first-run/SKILL.md): first-run setup on a new workstation
- [gaic-validation](skills/gaic-validation/SKILL.md): repository verification
- [gaic-docs-maintenance](skills/gaic-docs-maintenance/SKILL.md): documentation and Markdown formatting
- [gaic-stack-ops](skills/gaic-stack-ops/SKILL.md): Docker and Compose
- [gaic-model-storage](skills/gaic-model-storage/SKILL.md): storage, models, and media
- [gaic-managed-forks](skills/gaic-managed-forks/SKILL.md): managed forks and GitHub

There is no `rules/` folder and no `.cursor/rules` file for protected branches
or general safety. Those duplicated `AGENTS.md` and the global rules and are no
longer maintained here.

## External skill sources

Beyond this repo's own guidance above, [skills-catalog.json](skills-catalog.json)
indexes the Claude Code skill topics available from four forked skill
repositories (`superpowers-pr`, `matt-skills-pr`, `agent-skills-pr`,
`ui-ux-pro-max-skill-pr`, all tracked in `config/repos.json`). They are
installed as **user-scope Claude Code plugins** (`claude plugin list`), not
copied into this repo, so they apply in every project on this workstation —
this hub and the privateGPT, ComfyUI, and stable-diffusion-ui forks alike —
not just here. Use `npm run repos:fetch` / `repos:update` to keep the fork
clones current with upstream; the plugin installs point at those clones.

A related public Claude Code marketplace — one original bundled skill plus
curated links to the same upstream skill sources — is at
[likwidmack/gaic-skills-directory](https://github.com/likwidmack/gaic-skills-directory).
