# Continuous integration

`development` is the default integration branch. `main` is the release branch.
GitHub Actions runs **local parity** on pull requests to both. This hub has
no continuous deployment: it does not publish images, deploy environments, or
re-run a CD pipeline after merge.

## Flow

```text
PR → development (default/integration) | main (release)
  → CI (Local parity: npm ci, npm test)
```

`npm test` runs configuration validation (`npm run check`) and Node unit tests
(`npm run test:unit`, currently `scripts/paths.test.mjs`).

Workstation Docker, GPU, and storage checks stay local (`npm run stack:doctor`,
`npm run stack:config`). They are not GitHub Actions jobs.

GitHub does not start `pull_request` workflows while a PR has merge conflicts.
Resolve conflicts against the base branch and push so Local parity can run.

## Required check

The job name is `Local parity`. Status-check names must match that string
exactly if branch rulesets require CI.

## Skip-CI (required checks still green)

The workflow **runs** and exits successfully when **any** of these are true:

| Signal        | Example              |
| ------------- | -------------------- |
| Branch prefix | `ci/version-bump-*`  |
| PR label      | `skip-ci`            |
| PR title      | `[skip ci]` in title |

Do not put `[skip ci]` in **commit** messages. GitHub then skips every
workflow, so required checks never report.

Prefer squash merge with title = PR title and a blank squash body so old
commit subjects cannot reintroduce skip tokens.

## What CI does not run

- Docker Compose `up`, image builds, or GPU tests
- Model downloads
- Deploy, release, or environment promotion
