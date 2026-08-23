# Stack npm script aliases

## Goal

Add thin, discoverable npm script aliases for common Compose lifecycle commands
and for starting each supported profile, without changing `scripts/docker.mjs`
behavior.

## Decisions (approved)

| Decision              | Choice                                                                  |
| --------------------- | ----------------------------------------------------------------------- |
| Implementation        | Thin `package.json` aliases only (same pattern as `stack:doctor`)       |
| Profile scripts       | Call `switch PROFILE` (stop conflicting GPU services, then start)       |
| Raw `up`              | Separate `stack:up` that still invokes `docker.mjs up` with passthrough |
| Lifecycle alias scope | Minimal: `up`, `down`, `status` only                                    |
| CLI / GPU policy      | Unchanged; aliases are wrappers                                         |

## Scripts

Keep existing: `stack`, `stack:doctor`, `stack:config`.

| Script            | Invokes                                    |
| ----------------- | ------------------------------------------ |
| `stack:up`        | `node scripts/docker.mjs up`               |
| `stack:down`      | `node scripts/docker.mjs down`             |
| `stack:status`    | `node scripts/docker.mjs status`           |
| `stack:inference` | `node scripts/docker.mjs switch inference` |
| `stack:rag`       | `node scripts/docker.mjs switch rag`       |
| `stack:media`     | `node scripts/docker.mjs switch media`     |
| `stack:comfy`     | `node scripts/docker.mjs switch comfy`     |

Argument passthrough follows npm conventions: e.g.
`npm run stack:up -- inference`, `npm run stack:up -- media --allow-gpu-share`.
Profile scripts take no required args for the happy path; optional flags still
passthrough (e.g. `npm run stack:media -- --dry-run`).

## Documentation

Add a short subsection (or table) in
[docs/container-operations.md](../../container-operations.md) listing the new
aliases and stating that profile scripts use `switch`, while `stack:up` remains
raw `up`. Do not rewrite every existing `npm run stack -- …` example unless it
improves clarity in that page's quick-reference area.

Update root [README.md](../../../README.md) only if its quick-start already
enumerates stack commands and a single alias line fits without bloating the
landing page.

## Verification

- Confirm `npm run` lists the new scripts
- `node --check` not required unless `docker.mjs` changes (it should not)
- `npm test` passes (no config/Compose changes expected)
- `git diff --check`

## Out of scope

- Changing `docker.mjs` command semantics or GPU exclusivity
- Generating aliases from `config/stack.json`
- Full command mirror (`logs`, `build`, `pull`, `resources`, `backend`, …)
- Top-level script names outside the `stack:` namespace
- Operational stack bring-up on the workstation as part of this change
