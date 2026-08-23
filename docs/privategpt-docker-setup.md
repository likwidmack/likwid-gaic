# PrivateGPT Docker setup

This guide covers the managed `rag` profile: PrivateGPT plus LocalAI behind the
Caddy HTTPS gateway. For standalone PrivateGPT upstream docs, use the fork
README; do not layer a second Compose stack on top of this hub.

## Services and endpoints

| Service       | Purpose                              | Local endpoint           |
| ------------- | ------------------------------------ | ------------------------ |
| `localai`     | OpenAI-compatible LLM and embeddings | `https://localhost:8443` |
| `private-gpt` | Document RAG UI and API over LocalAI | `https://localhost:8444` |

Only the gateway publishes host ports. Defaults bind to `127.0.0.1`.

## Requirements

- Node.js 20+, Docker Desktop (Linux containers), Compose v2.
- On Windows: WSL2 integration and NVIDIA GPU support when
  `FORKEDAI_COMPUTE=nvidia`.
- Required models: `chat-qwen2.5-3b`, `embed-nomic-v1.5`, plus LocalAI YAML from
  `npm run models -- sync-localai`.
- Documents under the configured documents root (`DOCUMENT_ROOT` /
  `config/storage.json`).

CPU mode (`FORKEDAI_COMPUTE=cpu`) supports `rag`. Media/comfy stay NVIDIA-only.

## First run

```powershell
Set-Location E:\git\_lk\forkedAI
Copy-Item .env.example .env -ErrorAction SilentlyContinue
npm run media -- init
npm run models -- download chat-qwen2.5-3b
npm run models -- download embed-nomic-v1.5
npm run models -- verify chat-qwen2.5-3b
npm run models -- verify embed-nomic-v1.5
npm run models -- sync-localai
npm run stack -- backend
npm run models -- recommendations rag
npm run stack -- switch rag
```

Trust the Caddy development CA (see
[Container operations](container-operations.md#trusting-the-local-https-certificate)),
then open `https://localhost:8444`.

Place reviewed files under the documents root before or after start. The mount
is read-only inside the container; PrivateGPT ingests from that tree according
to its UI/API.

## Using the Web UI

1. Confirm LocalAI lists models: `https://localhost:8443` (or
   `Invoke-RestMethod -SkipCertificateCheck https://localhost:8443/v1/models`).
2. Open PrivateGPT at `https://localhost:8444`.
3. Ingest documents from the mounted documents root; ask questions grounded in
   that corpus.
4. Keep a single GPU profile active—PrivateGPT is CPU-side orchestration but
   depends on LocalAI for inference.

## Stronger chat model (optional)

Defaults stay on the 3B starter so first run fits modest VRAM:

| Compose env (see `compose.yaml`) | Default                        |
| -------------------------------- | ------------------------------ |
| `PGPT_LLM_DEFAULT`               | `qwen2.5-3b-instruct:latest`   |
| `PGPT_EMBEDDING_DEFAULT`         | `nomic-embed-text-v1.5:latest` |
| `PGPT_EMBED_DIM`                 | `768`                          |

To use the managed 7B pin:

```powershell
npm run models -- download chat-qwen2.5-7b
npm run models -- verify chat-qwen2.5-7b
npm run models -- sync-localai
```

Set in `.env`:

```dotenv
PGPT_LLM_DEFAULT=qwen2.5-7b-instruct:latest
```

Recreate PrivateGPT (and LocalAI if needed) so the env change applies. Do not
change `PGPT_EMBED_DIM` unless you also change the embedding model.

Workload mapping: [Use cases and models](use-cases-and-models.md).

## Daily commands

```powershell
npm run stack -- switch rag
npm run stack -- status
npm run stack -- down
```

Aliases: `npm run stack:rag`, `npm run stack:status`, `npm run stack:down`.

## Troubleshooting

- **502 on 8444 while PrivateGPT is healthy inside Docker:** wait for Caddy
  upstream probes, or recreate the gateway after a backend recreate.
- **Empty answers / wrong model:** confirm LocalAI `/v1/models` includes the
  names referenced by `PGPT_*` and that YAML was generated with `sync-localai`.
- **Embedding dimension errors:** keep `embed-nomic-v1.5` with
  `PGPT_EMBED_DIM=768`.
- **GPU contention:** stop media/comfy before `switch rag`; see
  [resource utilization](resource-utilization.md).

## Related guides

- [LocalAI Docker setup](localai-docker-setup.md)
- [Models and managed media](models.md)
- [Network security](network-security.md)
