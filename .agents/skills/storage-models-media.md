# Storage, models, and media

## Storage policy

| Role | Root | Rule |
| --- | --- | --- |
| Read-mostly assets | `C:\gaic` | Models, plugins, tools, and shared tensor exchange |
| Rebuildable data | `D:\forkedAI` | Hugging Face / Torch caches and Comfy temp only |
| Durable state | `E:\data\forkedAI` | Media, documents, objects, runtime state, and Caddy CA |
| Host-only backup | `E:\VIMG` | Never mount into a container |

## Rules

- D: is non-redundant.
- Never place the only durable copy of an artifact on D:.
- Do not create a second unmanaged model tree to work around Windows bind-mount
performance.
- Media initialization and indexing are non-destructive.
- No media command may delete user content.
- Never commit model weights, generated media, private documents, databases,
runtime state, local inventories, caches, `.env`, keys, or tokens.
- Treat pickle, PyTorch checkpoints, plugins, extensions, and custom nodes as
executable content.
- Prefer GGUF or safetensors from reviewed sources.

## Model manifests

Model manifests must use:

- Full 40-character revision
- Explicit include list
- Safe relative destination
- Reviewed license and provenance

## Preferred model workflow

```powershell
npm run models -- plan ALIAS
npm run models -- download ALIAS
npm run models -- verify ALIAS
npm run models -- sync-localai
```

Hugging Face may warn about unselected remote files and unrelated local files.
The checksum result for the selected artifact is authoritative.
