# Safety rules

## General editing

- Preserve user-owned and concurrent changes.
- Re-read Git state before and after significant edits.
- Keep edits scoped to the request.
- Do not stage, commit, push, or create pull requests unless explicitly requested.
- Do not mutate GitHub state unless explicitly requested.
- Avoid destructive commands.
- Resolve exact targets before cleanup.
- Ask before removal or overwrite when not explicitly authorized.

## Secrets and private data

Never commit, print, or expose:

- Credentials
- Tokens
- Keys
- `.env`
- Model weights
- Generated media
- Private documents
- Databases
- Runtime state
- Local inventories
- Caches
- User-generated content

## Operational safety

- Do not deploy a documentation change.
- Do not restart, recreate, pull, build, or start services unless requested.
- Do not add automatic volume deletion.
- Do not add `docker system prune`.
- Do not add destructive cleanup to the hub's scripts.

## Network safety

- The gateway is the only service allowed to publish host ports.
- The default bind address is `127.0.0.1`.
- Do not broaden `GAIC_BIND_ADDRESS` without hostname, certificate,
  authentication, firewall, and rollback planning.

## Definition of done

1. Relevant sources of truth and existing user changes were inspected.
2. Requested changes are implemented and documentation is consistent.
3. `npm test` passes when applicable.
4. Markdown formatting passes when maintained docs changed.
5. `npm run stack:config` passes when Compose, Dockerfiles, environment, storage,
   or Docker recommendations changed.
6. Changed scripts parse and relevant read-only workflows were exercised.
7. Staged and unstaged diffs are clean and reviewed.
8. Handoff states verification results, uncommitted or staged state, and any
   operational action deliberately not taken.
