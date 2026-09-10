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

## Formatting

Format maintained Markdown with:

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
