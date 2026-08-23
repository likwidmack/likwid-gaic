# GitHub accounts and repository access

## Account boundary

| Account | Responsibility |
| --- | --- |
| [likwidmack](https://github.com/likwidmack) | Owns this hub at `likwidmack/forkedAI` |
| [tamaramack](https://github.com/tamaramack) | Owns `LocalAI-Prt`, `private-gpt-tm`, `stable-diffusion-ui`, `ComfyUI`, and `ComfyUI_frontend` |

The connected GitHub app was verified as `likwidmack`. The five existing local fork remotes were verified under `tamaramack`.

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

## Repository status

The local operations hub is initialized on `main`, tracks `origin/main`, and uses the `github.com-lkpc` SSH alias. Managed fork operations remain separate and use the `tamaramack` credentials described above.
