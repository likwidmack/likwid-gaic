# GitHub accounts and repository access

## Account boundary

| Account | Responsibility |
| --- | --- |
| [likwidmack](https://github.com/likwidmack) | Owns this hub at `likwidmack/forkedAI` |
| [tamaramack](https://github.com/tamaramack) | Owns `LocalAI-Prt`, `private-gpt-tm`, and `stable-diffusion-ui` |

The connected GitHub app was verified as `likwidmack`. The three existing local fork remotes were verified under `tamaramack`.

## Token policy

- Keep one account-scoped credential per GitHub account.
- Never put a personal access token in a remote URL, Markdown, JSON, npm configuration, shell history, or committed `.env` file.
- Prefer Git Credential Manager or GitHub CLI authentication.
- Grant the minimum required repository permissions. Read access is sufficient for status/fetch; write access is needed to push.
- If both accounts use HTTPS credentials on `github.com`, enable path-aware credential selection:

  ```powershell
  git config --global credential.useHttpPath true
  ```

- For the clearest separation, use two SSH host aliases such as `github-likwidmack` and `github-tamaramack`, each backed by a different key.

## Intended remotes

This hub:

```text
origin  git@github.com-lkpc:likwidmack/forkedAI.git
```

Managed forks use `git@github.com:tamaramack/<repository>.git`; upstream remotes also use SSH. Windows OpenSSH verifies that `github.com` authenticates as `tamaramack` and `github.com-lkpc` authenticates as `likwidmack`.

## Repository creation status

At the time of setup, `likwidmack/forkedAI` did not exist. The GitHub connector could authenticate and inspect repositories but did not expose repository creation, while the local environment had no token or credential helper available for a secure API call.

Create an empty private repository named `forkedAI` under `likwidmack` without initializing a README, license, or gitignore. The local repository is already initialized and ready to push.
