# First run

Use this sequence on a new workstation before starting profiles.

Do not broaden `GAIC_BIND_ADDRESS`, add gateway authentication, or configure
managed-stack `LOCALAI_API_KEY` unless explicitly requested.

## Windows / PowerShell
Trust the Caddy development CA, then verify `https://localhost:8443`.

Use this read-only storage check:

```powershell
npm run media -- status
```

For the full profile order, CA import commands, and optional `rag`, `media`, and
`comfy` steps, see `docs/container-operations.md`.
