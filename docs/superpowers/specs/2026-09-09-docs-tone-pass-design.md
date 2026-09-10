# Documentation tone and scannability pass

## Goal

Bring this hub's documentation up to one consistent, public-repo-ready
standard — clear for an AI agent to follow unambiguously, technically
precise for an engineer, and approachable for a first-time public reader —
without changing any documented behavior, command, path, or claim.

## Scope

40 files across three categories, reviewed and updated in this order:

1. **`.agents/` (8 files)** — `README.md`, `rules/protected-branches.md`,
   `rules/safety.md`, `skills/docker-compose.md`, `skills/documentation.md`,
   `skills/first-run.md`, `skills/managed-forks-github.md`,
   `skills/storage-models-media.md`, `skills/validation.md`
2. **`docs/*.md` (16 files)** — `README.md`, `architecture.md`, `cicd.md`,
   `comfyui-docker-setup.md`, `container-operations.md`,
   `github-access.md`, `localai-docker-setup.md`, `models.md`,
   `network-security.md`, `node-setup.md`, `ollama-docker-setup.md`,
   `privategpt-docker-setup.md`, `resource-utilization.md`,
   `stable-diffusion-docker-setup.md`, `troubleshooting.md`,
   `use-cases-and-models.md`
3. **`docs/superpowers/specs/` + `docs/superpowers/plans/` + `docs/plans/`
   (16 files)** — 9 specs, 6 superpowers plans, and 1 older-convention plan
   (`docs/plans/2026-08-30-001-feature-unified-inference-api-plan.md`,
   same kind of document, different/older directory). Tone/terminology
   only, no restructuring (see Non-goals)

## Explicitly out of scope

- `.agents/rules/user_profile.md` and `.aiassistant/` — personal
  configuration, not project documentation, now gitignored (unrelated
  privacy fix landed separately on this branch).
- The root `AGENTS.md` and `CONTRIBUTING.md`/`SECURITY.md`/`LICENSE` —
  not flagged as part of "the new documentation, rules and skills," and a
  full-repo sweep beyond the named scope risks unrelated churn. Can be a
  follow-up if this pass's style guide proves out.
- `docs/inventory.generated.md` — machine-generated, gitignored, not
  hand-authored documentation.

## Style guide (binding on every file this plan touches)

### Voice

- Second person, active voice, present tense. Address the reader as "you."
- No marketing language ("seamless," "blazingly fast," "just works").
- Expand or gloss any acronym or tool name the first time it appears in a
  given file (e.g., "MPS (NVIDIA's Multi-Process Service)"), even if a
  different file in this hub already explains it — each file must stand
  alone for a reader who lands on it directly from a search engine or a
  GitHub link.
- Never reference private context (an internal meeting, a Slack thread, a
  conversation the reader wasn't part of).

### Terminology (one term per concept, everywhere)

| Concept | Use | Not |
| ------- | --- | --- |
| This project | "the hub" | "the repo," "this project," "this thing" |
| A Compose profile (`inference`, `rag`, `media`, `comfy`, `ollama`) | "profile" | "mode" |
| Product names | `LocalAI`, `ComfyUI`, `PrivateGPT`, `Stable Diffusion WebUI`, `Ollama`, `Docker Compose`, `Docker Desktop` | inconsistent casing/spacing variants |
| The gateway service | "the gateway" | "the proxy," "Caddy" (unless specifically discussing the Caddy binary/config) |

### Scannability

- Paragraphs capped at 3-5 sentences.
- A heading (`##`/`###`) at least every 2-4 paragraphs of prose — no long
  uninterrupted prose blocks.
- Tables for anything enumerable (options, variables, comparisons) instead
  of comma-separated prose lists.
- **Bold** the first mention of a key term or concept being introduced.
- Bullet lists over run-on comma sentences when listing 3+ items.
- Every heading's own subsections stay logically nested under it — no
  top-level section inserted mid-sequence that orphans a sibling under the
  wrong parent (the exact class of bug fixed in this branch's
  `resource-utilization.md` change).

### Structure template — `docs/*.md` user guides only

1. Title + one-paragraph what/why (what this doc covers, when to reach for
   it)
2. Quick-start command block, if the doc has one obvious primary action
3. Detail sections
4. Troubleshooting and/or "Related guides" at the end

`.agents/` files keep their existing skill/rule format (frontmatter-free
Markdown, imperative instructions) — the structure template above applies
only to `docs/*.md`.

### Audience split

- **`.agents/` files** are agent-consumed: prioritize unambiguous,
  imperative instructions ("Run X before Y," not "You might want to run X
  before Y"). Precision over friendliness.
- **`docs/*.md` files** are public-repo-consumed: assume software
  engineering background, never assume prior exposure to this specific
  hub's internal conventions before they're introduced in that file.

## Non-goals

- No restructuring of `docs/superpowers/specs/` or `docs/superpowers/plans/`
  — these are dated historical/working records of already-completed
  decisions (some from August), not living reference docs a new reader
  browses for onboarding. They get the same terminology/voice cleanup
  (Style guide sections above) but keep their existing section order and
  format.
- No new content, no new sections beyond what the structure template
  requires, no removal of existing technical detail — this is a
  presentation pass, not a rewrite of what the hub does.
- No changes to any command, path, env var name, or technical claim. If a
  tone pass surfaces an actual inaccuracy (a stale command, a wrong path),
  flag it as a separate finding rather than silently "fixing" it inline —
  content accuracy fixes are out of scope for this specifically-scoped
  pass and should go through the same review rigor as any other doc-fact
  change.
- No change to `AGENTS.md` or repo-root policy files (see Scope).

## Per-file QA

Each file's before/after diff is checked against two things:

1. **Style-guide compliance** — voice, terminology table, scannability
   rules, structure template (where applicable).
2. **Technical fidelity** — every command, path, env var name, and
   technical claim in the "before" version must still be present and
   accurate in the "after" version. A reviewer flags any command/path/claim
   that changed, was dropped, or was added, for the same reason `code-review`
   flags out-of-scope diffs in this hub's application code.
