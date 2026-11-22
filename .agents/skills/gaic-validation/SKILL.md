---
name: gaic-validation
description: Repository verification checklist for likwid-gaic. USE WHEN verifying a change, before handoff or commit, deciding which npm checks to run, or investigating the Local parity CI job.
---

# gaic repository validation

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
  Actions job named `Local parity` ([docs/cicd.md](../../../docs/cicd.md)). Do not
  add CD workflows unless explicitly requested.
- `stack:doctor` is read-only and checks Node.js, Docker, Compose, NVIDIA, the
  Hugging Face CLI, storage roots, and fork contexts.
- `stack:config` renders all profiles without starting or recreating services.
- Syntax-check changed JavaScript with `node --check`.
- Always run `git diff --check` and inspect `git status --short --branch`
  before handoff. If changes are staged, also run `git diff --cached --check`.

Related skills: `gaic-docs-maintenance` (Markdown formatting), `gaic-stack-ops`.
