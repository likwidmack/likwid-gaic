---
name: gaic-first-run
description: First-run setup sequence for likwid-gaic on a new workstation. USE WHEN bringing up the stack for the first time, setting up a new machine, or starting profiles before any other stack work.
---

# gaic first run

Use this sequence on a new workstation before starting profiles. Do not broaden
`GAIC_BIND_ADDRESS`, add gateway authentication, or configure managed-stack
`LOCALAI_API_KEY` unless explicitly requested.

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
npm run media -- init
npm test
npm run stack:doctor
npm run stack:config
npm run models -- download chat-qwen2.5-3b
npm run models -- download embed-nomic-v1.5
npm run models -- verify chat-qwen2.5-3b
npm run models -- verify embed-nomic-v1.5
npm run models -- sync-localai
npm run stack -- up inference
npm run stack -- backend
```

Trust the Caddy development CA, then verify `https://localhost:8443`. Use
`npm run media -- status` for a read-only storage check. The full profile order,
CA import commands, and optional `rag`, `media`, and `comfy` steps are in
[docs/container-operations.md](../../../docs/container-operations.md).

Related skills: `gaic-stack-ops`, `gaic-model-storage`, `gaic-validation`.
