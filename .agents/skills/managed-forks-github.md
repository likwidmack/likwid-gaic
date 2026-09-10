# Managed forks and GitHub

## Account boundary

- Hub repository: `likwidmack/likwid-gaic`
- Managed forks: `tamaramack`

## Command behavior

- `npm run repos:status` is read-only.
- `npm run repos:fetch` refreshes remote references only.
- `npm run repos:update` performs fetch plus fast-forward-only upstream updates.
- `repos:update` must refuse dirty or detached worktrees.

## Prohibited actions unless explicitly requested

Do not:

- Reset managed forks
- Rebase managed forks
- Force-push
- Delete branches
- Discard dirty fork changes
- Rewrite remotes
- Automatically push managed forks
- Commit unrelated changes
- Stage unrelated changes
- Create a pull request
- Mutate GitHub state

## Remotes and identities

- Preserve mixed remote transports.
- The Comfy forks may use HTTPS while other forks use SSH.
- The hub raw origin should remain `git@github.com:likwidmack/likwid-gaic.git`.
- A workstation `insteadOf` rule may display the `github.com-lkpc` alias.
- Do not store an already rewritten alias as the raw remote because it can be
  rewritten twice.
- Git SSH identity and GitHub CLI API identity are separate.
- Check GitHub CLI authentication before GitHub API writes.

## Before authorized commit or push

1. Review staged and unstaged diffs.
2. Run relevant verification.
3. Confirm branch.
4. Confirm destination account.
5. Report exactly what changed.
