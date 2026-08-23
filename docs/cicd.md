# Continuous integration

GitHub Actions runs **local parity** on pull requests to `main`. This hub has
no continuous deployment: it does not publish images, deploy environments, or
re-run a CD pipeline after merge.

## Flow

```
PR → main → CI (Local parity: npm ci, npm test)
```

Workstation Docker, GPU, and storage checks stay local (`npm run stack:doctor`,
`npm run stack:config`). They are not GitHub Actions jobs.

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
