# Contributing

Thanks for helping improve **likwid-gaic**. This hub is configuration,
validation, Compose orchestration, and documentation for a local GPU AI
workstation.

## Branch model

| Branch        | Role                       |
| ------------- | -------------------------- |
| `development` | Default integration branch |
| `main`        | Release branch             |

Open pull requests against `development` unless you are deliberately targeting
a release fix on `main`.

## Before you open a PR

1. Keep changes scoped; do not commit `.env`, credentials, model weights, media,
   or local inventories.
2. From the repository root:

```powershell
npm test
```

3. If you changed Compose, Dockerfiles, environment templates, or storage
   defaults, also run:

```powershell
npm run stack:config
```

4. If you changed maintained Markdown under `docs/` or `README.md`, format with
   Prettier as described in [AGENTS.md](AGENTS.md).

CI runs **Local parity** (`npm ci` + `npm test`) on pull requests. Details and
skip-CI rules are in [docs/cicd.md](docs/cicd.md).

## Pull requests

- Describe why the change is needed.
- Note verification you ran.
- Prefer small, reviewable diffs.
- Do not add continuous deployment workflows unless maintainers request them.
