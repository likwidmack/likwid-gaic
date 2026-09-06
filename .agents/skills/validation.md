# Validation

Use the smallest applicable verification set, then expand in proportion to the
change.

## Common checks## Rules

- `npm test` is the main local parity gate.
- Pull requests to `development` and `main` run the GitHub Actions job named
  `Local parity`.
- Do not add CD workflows unless explicitly requested.
- `stack:doctor` is read-only.
- `stack:config` renders all profiles without starting or recreating services.
- Syntax-check changed JavaScript with `node --check`.
- Always run `git diff --check` before handoff.
- Inspect `git status --short --branch` before handoff.
- If changes are staged, also run `git diff --cached --check`.

## What `npm test` covers

`npm test` validates:

- Configuration shape
- Storage defaults
- Immutable model pins
- Privacy rules
- Docker artifacts
- Compose topology
- Environment coverage
- Local Markdown links
- Unit tests
