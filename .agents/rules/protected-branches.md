# Protected branches

Never create commits directly on `development` or `main`.

## Required behavior before committing

1. Check the current branch.
2. If on `development` or `main`, create or check out a feature, docs, or fix
   branch first.
3. Commit only on the topic branch.

## Pull requests

- Pull requests normally target `development` for integration.
- Pull requests may target `main` for release.
- Do not push commits straight onto `development` or `main` unless explicitly
  overridden by the user for a specific action.

## Accidental local commit

If a commit lands on `development` or `main` by mistake:

1. Confirm the mistaken commit is local and unpushed.
2. Move it to a topic branch.
3. Reset the protected branch to match its remote only when safe and authorized.
