# GitHub accounts and repository access

This guide documents repository ownership, Git transport, CLI account selection,
and credential boundaries for the hub and its managed forks.

## Account boundary

| Account                                     | Responsibility                         |
| ------------------------------------------- | -------------------------------------- |
| [likwidmack](https://github.com/likwidmack) | Owns this hub at `likwidmack/forkedAI` |
| [tamaramack](https://github.com/tamaramack) | Owns the five managed forks            |

The ownership boundary is stored in `config/accounts.json`; fork URLs and preferred SSH origins are stored in `config/repos.json`.

## Hub remote and SSH rewriting

The hub's raw `origin` should use the canonical GitHub SSH form:

```text
git@github.com:likwidmack/forkedAI.git
```

This workstation has a Git `url.*.insteadOf` rule that rewrites the canonical URL to the `github.com-lkpc` SSH host alias. Consequently, `git remote get-url origin` may display `git@github.com-lkpc:likwidmack/forkedAI.git`.

Do not store the already-rewritten alias in the raw remote while the rewrite rule is active; it can be rewritten a second time into an invalid hostname. Inspect both views when troubleshooting:

```powershell
git config --get-regexp '^url\..*\.insteadof$'
git config --local --get remote.origin.url
git remote get-url origin
ssh -T git@github.com-lkpc
```

## Managed fork remotes

The three original forks currently use SSH for `origin` and `upstream`. The two Comfy forks may use HTTPS. The management scripts support either transport and never rewrite remotes.

`config/repos.json` records a preferred `originSsh` for each fork, but that is metadata, not an instruction to mutate an existing local remote. Verify actual state with:

```powershell
npm run repos:status
git -C E:\git\ComfyUI remote -v
git -C E:\git\ComfyUI_frontend remote -v
```

`repos:status` changes nothing. `repos:fetch` fetches and prunes both remotes. `repos:update` fast-forwards only the checked-out local branch and does not push the GitHub fork.

## GitHub CLI account selection

Multiple GitHub CLI accounts can coexist. Check the active account before repository creation or other API writes:

```powershell
gh auth status --hostname github.com
gh auth switch --hostname github.com --user likwidmack
```

Git-over-SSH identity and GitHub CLI API identity are separate checks. Restore the previously active CLI account after a one-off operation.

## Token and key policy

- Keep one account-scoped credential and SSH key per GitHub identity.
- Never put a token in a remote URL, Markdown, JSON, npm configuration, shell history, or committed dotenv file.
- Prefer SSH for Git and the operating-system keyring for GitHub CLI tokens.
- Grant the minimum required permissions: read for status/fetch, write for push.
- If HTTPS credentials for multiple accounts share `github.com`, enable `credential.useHttpPath`.
- Verify account identity before pushing or creating a repository.
