---
name: gaic-docs-maintenance
description: Documentation conventions and Markdown formatting for likwid-gaic. USE WHEN adding, editing, moving, or removing files under docs/, editing the root README.md, or formatting Markdown.
---

# gaic documentation maintenance

- Keep maintained documentation under `docs/`; keep the root `README.md`
  concise and navigational.
- Update `docs/README.md` when adding, moving, or removing a guide.
- Use sentence-case headings, fenced code blocks with a language, consistent
  tables, and descriptive relative links.
- PowerShell examples run from the repository root. Label WSL examples as
  `bash`.
- Format maintained Markdown with:

```powershell
$docs = (Get-ChildItem docs/*.md | Where-Object Name -ne "inventory.generated.md").FullName
npx --yes prettier@3.6.2 --write README.md $docs
```

- Do not format or commit `docs/inventory.generated.md`; it is local,
  generated, and may expose machine details.
- `scripts/validate.mjs` automatically discovers maintained Markdown under
  `docs/` and excludes only the generated inventory.
- Verify current Docker, NVIDIA, LocalAI, and other mutable technical
  recommendations against official primary documentation before changing them.
- Keep architecture, operations, service setup, security, and troubleshooting
  guidance in their respective pages instead of repeating full procedures.

Related skill: `gaic-validation` (run `npm test` after documentation changes).
