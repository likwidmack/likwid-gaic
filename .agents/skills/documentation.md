# Documentation

## Location and scope

- Keep maintained documentation under `docs/`.
- Keep the root `README.md` concise and navigational.
- Update `docs/README.md` when adding, moving, or removing a guide.
- Keep architecture, operations, service setup, security, and troubleshooting
  guidance in their respective pages instead of repeating full procedures.

## Style

- Use sentence-case headings.
- Use fenced code blocks with a language.
- Use consistent tables.
- Use descriptive relative links.
- PowerShell examples run from the hub root.
- Label WSL examples as `bash`.

## Blending generic and hub-specific guidance

Some guides mix generic/standalone reference material (upstream Compose
examples, vendor defaults) with facts specific to this hub's managed stack.
Mark the hub-specific facts explicitly instead of leaving readers to guess
which parts apply here:

- Use an `### On this hub: <qualifier>` H3 subsection when a document
  section needs its own scannable block of hub-specific specifics (for
  example, `### On this hub: NVIDIA configuration`). Give each occurrence in
  the same document a distinct qualifier so headings don't collide — repeated
  identical H3 text produces duplicate anchor slugs, which breaks inbound
  links.
- Reserve a `> **On this hub:**` blockquote for a single-sentence blend, or
  for a document-opening callout placed before any headings exist. Do not use
  a blockquote for a fact important enough to need its own heading — it is
  invisible to heading-based navigation.

## Formatting

Format maintained Markdown with:

```powershell
$docs = (Get-ChildItem docs/*.md | Where-Object Name -ne "inventory.generated.md").FullName
npx --yes prettier@3.6.2 --write README.md $docs
```

## Generated inventory

Do not format or commit `docs/inventory.generated.md`.

It is local, generated, and may expose:

- Machine paths
- Installed models
- GPU details
- Docker state

## Mutable technical recommendations

Verify current Docker, NVIDIA, LocalAI, and other mutable technical
recommendations against official primary documentation before changing them.
