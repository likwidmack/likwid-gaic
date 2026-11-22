---
name: gaic-model-storage
description: Storage roots, model manifests, and media rules for likwid-gaic. USE WHEN downloading or verifying models, editing config/models.json, config/storage.json, or config/profile-artifacts.json, working with media init or status, or deciding where an artifact may live.
---

# gaic storage, models, and media

Storage policy:

| Role               | Root               | Rule                                                   |
| ------------------ | ------------------ | ------------------------------------------------------ |
| Read-mostly assets | `C:\gaic`          | Models, plugins, tools, and shared tensor exchange     |
| Rebuildable data   | `D:\forkedAI`      | Hugging Face / Torch caches and Comfy temp only        |
| Durable state      | `E:\data\forkedAI` | Media, documents, objects, runtime state, and Caddy CA |
| Host-only backup   | `E:\VIMG`          | Never mount into a container                           |

- D: is non-redundant. Never place the only durable copy of an artifact there.
- Do not create a second unmanaged model tree to work around Windows bind-mount
  performance.
- Model manifests must use a full 40-character revision, explicit include list,
  safe relative destination, and reviewed license/provenance.
- Preferred model workflow:

```powershell
npm run models -- plan ALIAS
npm run models -- download ALIAS
npm run models -- verify ALIAS
npm run models -- sync-localai
```

- Multiple managed models share `C:\gaic\models\localai`. Hugging Face may
  warn about unselected remote files and unrelated local files; the checksum
  result for the selected artifact is authoritative.
- Media initialization and indexing are non-destructive. No media command may
  delete user content.
- Never commit model weights, generated media, private documents, databases,
  runtime state, local inventories, caches, `.env`, keys, or tokens.
- Treat Python-serialized model files, PyTorch checkpoints, plugins,
  extensions, and custom nodes as executable content. Prefer GGUF or
  safetensors from reviewed sources.

Related skills: `gaic-first-run`, `gaic-validation`.
