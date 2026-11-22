---
name: gaic-managed-forks
description: Rules for the managed AI forks and GitHub identity in likwid-gaic. USE WHEN running npm run repos commands, touching managed fork worktrees or remotes, editing config/repos.json or config/accounts.json, or doing any GitHub write (commit, push, pull request).
---

# gaic managed forks and GitHub

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
- Branch and pull request policy (topic branch, pull request into `development`,
  never push `development` or `main`) is in the global rules at
  `E:\git\_ha\agent-system\agent\GLOBAL.md`.

Related skill: `gaic-validation`.
