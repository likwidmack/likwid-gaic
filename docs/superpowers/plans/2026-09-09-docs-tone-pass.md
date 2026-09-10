# Documentation Tone and Scannability Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 41 in-scope documentation files up to the spec's style guide (voice, terminology, scannability, structure) without changing any documented command, path, env var name, or technical claim.

**Architecture:** Nine batch tasks grouped by file category and theme (not one task per file — this is prose editing, not code, and the style guide is the shared "interface" every task applies). Each task's implementer reads the listed files, applies the full style guide from the spec, fixes the specific known issues called out in the task, and produces a diff. Each task's reviewer checks the diff against the style guide AND verifies zero technical-fact drift (commands/paths/env vars/claims unchanged).

**Tech Stack:** Markdown only. No build step, no tests to run — "verification" is the style-guide + technical-fidelity review described in the spec's "Per-file QA" section.

**Spec:** [docs/superpowers/specs/2026-09-09-docs-tone-pass-design.md](../specs/2026-09-09-docs-tone-pass-design.md)

## Global Constraints

- Style guide (voice, terminology table, scannability rules, structure template, audience split) — copied in full in the spec; every task's requirements implicitly include it in full, not just the per-file notes below
- Terminology: "the hub" (not "the repo"/"this project"/"this repository"), "profile" (not "mode"), consistent product capitalization (LocalAI, ComfyUI, PrivateGPT, Docker Compose, Docker Desktop)
- Zero technical-fact drift: every command, path, env var name, and technical claim present in the "before" version of a file must still be present and accurate in the "after" version
- `.agents/` files keep their existing frontmatter-free, imperative-instruction format — the `docs/*.md` structure template does NOT apply to them
- `docs/superpowers/specs/`, `docs/superpowers/plans/`, and `docs/plans/*.md` get tone/terminology only — no restructuring, no new headings, keep existing section order
- Out of scope, do not touch: `.agents/rules/user_profile.md`, `.aiassistant/`, root `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, `docs/inventory.generated.md`
- Commit after each task; each task is independently reviewable

## File map

| Task | Files | Category |
| ---- | ----- | -------- |
| 1 | `.agents/README.md`, `.agents/rules/protected-branches.md`, `.agents/rules/safety.md` | Agent overview + rules |
| 2 | `.agents/skills/*.md` (6 files) | Agent skills |
| 3 | `docs/README.md`, `docs/architecture.md`, `docs/cicd.md`, `docs/github-access.md` | Hub overview/meta |
| 4 | `docs/node-setup.md`, `docs/container-operations.md`, `docs/network-security.md`, `docs/troubleshooting.md` | Operations |
| 5 | `docs/localai-docker-setup.md`, `docs/privategpt-docker-setup.md`, `docs/ollama-docker-setup.md` | Inference service setup |
| 6 | `docs/stable-diffusion-docker-setup.md`, `docs/comfyui-docker-setup.md`, `docs/resource-utilization.md` | Media service setup + resources |
| 7 | `docs/models.md`, `docs/use-cases-and-models.md` | Models |
| 8 | `docs/superpowers/specs/*.md` (9 files) | Historical specs (tone-only) |
| 9 | `docs/superpowers/plans/*.md` (6 files) + `docs/plans/2026-08-30-001-feature-unified-inference-api-plan.md` | Historical plans (tone-only) |

---

### Task 1: Agent overview and rules

**Files:**
- Modify: `.agents/README.md`
- Modify: `.agents/rules/protected-branches.md`
- Modify: `.agents/rules/safety.md`

**Interfaces:**
- Consumes: the spec's full style guide (voice, terminology, scannability — NOT the `docs/*.md` structure template, which doesn't apply here)
- Produces: nothing later tasks depend on structurally; sets the terminology/voice baseline the other `.agents/` task (Task 2) should match

- [ ] **Step 1: Read all three files and the spec's style guide**

Read `.agents/README.md`, `.agents/rules/protected-branches.md`, `.agents/rules/safety.md`, and `docs/superpowers/specs/2026-09-09-docs-tone-pass-design.md` in full before editing anything.

- [ ] **Step 2: Apply the style guide, fixing at minimum these known issues**

- `.agents/README.md`: check every cross-reference link in the "Start here" and "External skill sources" lists still resolves (file paths may have shifted); ensure "Sources of truth" section uses "the hub" consistently, not "this repository" (currently mixes both).
- `.agents/rules/safety.md` and `.agents/rules/protected-branches.md`: these are short, imperative rule files — verify they already match the "unambiguous, imperative" agent-facing voice from the audience-split section; fix any hedging language ("you might want to," "it's probably best to") into direct imperatives ("do X," "never do Y").
- All three: apply the terminology table (the hub / profile / product capitalization) throughout.

Apply the rest of the style guide (voice, scannability) to the full text of each file, not only the items listed above — the items above are the confirmed minimum, not the ceiling.

- [ ] **Step 3: Verify zero technical-fact drift**

Diff your changes against the original. Every command, file path, env var name, and technical claim that existed before your edit must still be present and accurate after it. If you find an actual inaccuracy (not a tone issue) while editing, do NOT silently fix it — leave the fact as-is and note it in your report as a separate finding.

- [ ] **Step 4: Commit**

```bash
git add .agents/README.md .agents/rules/protected-branches.md .agents/rules/safety.md
git commit -m "docs: tone/scannability pass for .agents overview and rules"
```

---

### Task 2: Agent skills

**Files:**
- Modify: `.agents/skills/docker-compose.md`
- Modify: `.agents/skills/documentation.md`
- Modify: `.agents/skills/first-run.md`
- Modify: `.agents/skills/managed-forks-github.md`
- Modify: `.agents/skills/storage-models-media.md`
- Modify: `.agents/skills/validation.md`

**Interfaces:**
- Consumes: the spec's style guide; the terminology baseline Task 1 established (read Task 1's diff or commit if available, for consistency)
- Produces: nothing later tasks depend on structurally

- [ ] **Step 1: Read all six files and the spec's style guide**

- [ ] **Step 2: Apply the style guide, fixing at minimum these known issues**

- All six files: these are agent-facing (imperative-instruction voice, per the audience split) — check each for any passive or hedging phrasing and convert to direct imperatives.
- Apply the terminology table (the hub / profile / product capitalization) throughout all six.
- Check for acronym/tool-name expansion on first use per file (e.g., if `MPS`, `CDI`, or similar acronyms appear, gloss them the first time within that specific file — each file must stand alone).

Apply the rest of the style guide to the full text of each file, not only the items listed above.

- [ ] **Step 3: Verify zero technical-fact drift**

Same check as Task 1 Step 3 — diff against the original, confirm every command/path/env var/claim survives unchanged, report (don't silently fix) any actual inaccuracy found.

- [ ] **Step 4: Commit**

```bash
git add .agents/skills/docker-compose.md .agents/skills/documentation.md .agents/skills/first-run.md .agents/skills/managed-forks-github.md .agents/skills/storage-models-media.md .agents/skills/validation.md
git commit -m "docs: tone/scannability pass for .agents skills"
```

---

### Task 3: Hub overview and meta docs

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/cicd.md`
- Modify: `docs/github-access.md`

**Interfaces:**
- Consumes: the spec's style guide, including the `docs/*.md` structure template (title → what/why → quick-start if applicable → detail → troubleshooting/related-links)
- Produces: nothing later tasks depend on structurally

- [ ] **Step 1: Read all four files and the spec's style guide**

- [ ] **Step 2: Apply the style guide, fixing at minimum these known issues**

- `docs/architecture.md`: replace "This repository is the portable control plane..." and other "this repository" phrasing with "the hub" per the terminology table. The "Host and storage assumptions" section's last paragraph (starting "Shared filesystem mounts exchange...") is a single dense paragraph mixing two ideas (mount isolation + single-GPU exclusivity) — split into two paragraphs or a short list. Otherwise this file already uses tables and headers well; keep that structure.
- `docs/README.md`, `docs/cicd.md`, `docs/github-access.md`: apply terminology table and voice rules. Check each against the structure template — `docs/README.md` in particular is the documentation index, confirm it opens with a one-paragraph what/why before its link list.

Apply the rest of the style guide to the full text of each file, not only the items listed above.

- [ ] **Step 3: Verify zero technical-fact drift**

Same check as prior tasks.

- [ ] **Step 4: Commit**

```bash
git add docs/README.md docs/architecture.md docs/cicd.md docs/github-access.md
git commit -m "docs: tone/scannability pass for hub overview and meta docs"
```

---

### Task 4: Operations docs

**Files:**
- Modify: `docs/node-setup.md`
- Modify: `docs/container-operations.md`
- Modify: `docs/network-security.md`
- Modify: `docs/troubleshooting.md`

**Interfaces:**
- Consumes: the spec's style guide, including the `docs/*.md` structure template
- Produces: nothing later tasks depend on structurally

- [ ] **Step 1: Read all four files and the spec's style guide**

- [ ] **Step 2: Apply the style guide, fixing at minimum these known issues**

- `docs/node-setup.md`: short and already well-structured; apply terminology table and voice rules only, no restructuring needed.
- `docs/container-operations.md`, `docs/network-security.md`, `docs/troubleshooting.md`: apply terminology table (the hub / profile) throughout — these three commonly say "profile" already but double-check for stray "mode" usage referring to a Compose profile (not compute mode, which is a different, correct use of "mode" — do not change `GAIC_COMPUTE` mode terminology, only Compose-profile references).
- `docs/troubleshooting.md`: confirm every entry still follows the existing "Problem: fix" bullet pattern; this file's format is already scannable — tone/terminology only, no structural change needed here beyond the template's top-level what/why paragraph if missing.

Apply the rest of the style guide to the full text of each file, not only the items listed above.

- [ ] **Step 3: Verify zero technical-fact drift**

Same check as prior tasks. `docs/troubleshooting.md` and `docs/network-security.md` in particular contain many exact commands and port numbers — be careful not to alter any of them while editing surrounding prose.

- [ ] **Step 4: Commit**

```bash
git add docs/node-setup.md docs/container-operations.md docs/network-security.md docs/troubleshooting.md
git commit -m "docs: tone/scannability pass for operations docs"
```

---

### Task 5: Inference service setup docs

**Files:**
- Modify: `docs/localai-docker-setup.md`
- Modify: `docs/privategpt-docker-setup.md`
- Modify: `docs/ollama-docker-setup.md`

**Interfaces:**
- Consumes: the spec's style guide, including the `docs/*.md` structure template
- Produces: nothing later tasks depend on structurally

- [ ] **Step 1: Read all three files and the spec's style guide**

- [ ] **Step 2: Apply the style guide, fixing at minimum these known issues**

- `docs/localai-docker-setup.md` (the largest, most in-need-of-restructuring file in this batch): the file currently interleaves two audiences in the same sections — generic standalone-LocalAI reference material (copied from upstream-style docs) and this hub's managed-profile specifics (called out inline as "The managed likwid-gaic profile instead uses..."). This blending hurts scannability: a reader wanting only the managed-profile facts has to read past unrelated standalone-deployment content in the same paragraph. Restructure each major section (starting with "Recommended Docker Compose configuration" and "NVIDIA configuration") so the managed-hub-specific facts are visually separated from the standalone-reference material — a clearly labeled subsection or a callout block per section, not blended into one paragraph. Do not delete the standalone reference material; it stays, just visually separated. Also replace "likwid-gaic" with "the hub" per terminology (keep "likwid-gaic" only where it's literally naming the npm package, e.g. in a path or install command).
- `docs/privategpt-docker-setup.md`, `docs/ollama-docker-setup.md`: already close to the target structure template (title → what/why → requirements → first-run → detail → troubleshooting → related guides). Apply terminology table and voice rules; no restructuring needed.

Apply the rest of the style guide to the full text of each file, not only the items listed above.

- [ ] **Step 3: Verify zero technical-fact drift**

Same check as prior tasks. `docs/localai-docker-setup.md`'s restructuring work is the highest-risk step in this task for accidentally dropping a fact during reorganization — after restructuring, re-read the full file once more specifically checking every YAML block, env var table, and command against the pre-edit version.

- [ ] **Step 4: Commit**

```bash
git add docs/localai-docker-setup.md docs/privategpt-docker-setup.md docs/ollama-docker-setup.md
git commit -m "docs: tone/scannability pass for inference service setup docs"
```

---

### Task 6: Media service setup and resource docs

**Files:**
- Modify: `docs/stable-diffusion-docker-setup.md`
- Modify: `docs/comfyui-docker-setup.md`
- Modify: `docs/resource-utilization.md`

**Interfaces:**
- Consumes: the spec's style guide, including the `docs/*.md` structure template
- Produces: nothing later tasks depend on structurally

- [ ] **Step 1: Read all three files and the spec's style guide**

- [ ] **Step 2: Apply the style guide, fixing at minimum these known issues**

- `docs/stable-diffusion-docker-setup.md`: already well-structured (title → requirements → first-run → usage → troubleshooting → related guides); apply terminology table and voice rules only.
- `docs/comfyui-docker-setup.md`: long but already uses headers/tables well. The "Software" section's paragraph after the bullet list ("A separate CUDA toolkit installation...") and the "API nodes and credentials" section are dense multi-sentence paragraphs — apply the 3-5 sentence paragraph cap, splitting where needed. Replace "this repository" with "the hub" per terminology.
- `docs/resource-utilization.md`: this file was already restructured once this session (the "GPU power headroom" section was moved to fix a heading-hierarchy bug) — do not re-move any sections; apply terminology and voice rules only, verify heading hierarchy is still correct after your edits (every `###` still sits under the right `##` parent).

Apply the rest of the style guide to the full text of each file, not only the items listed above.

- [ ] **Step 3: Verify zero technical-fact drift**

Same check as prior tasks. `docs/resource-utilization.md` contains an env var reference table — verify every row's variable name, default, and purpose text is unchanged.

- [ ] **Step 4: Commit**

```bash
git add docs/stable-diffusion-docker-setup.md docs/comfyui-docker-setup.md docs/resource-utilization.md
git commit -m "docs: tone/scannability pass for media service setup and resource docs"
```

---

### Task 7: Models docs

**Files:**
- Modify: `docs/models.md`
- Modify: `docs/use-cases-and-models.md`

**Interfaces:**
- Consumes: the spec's style guide, including the `docs/*.md` structure template
- Produces: nothing later tasks depend on structurally

- [ ] **Step 1: Read both files and the spec's style guide**

- [ ] **Step 2: Apply the style guide, fixing at minimum these known issues**

- `docs/models.md`: apply terminology table and voice rules; already reasonably well-structured with tables for the model manifest and shared catalog — no restructuring needed, tone pass only.
- `docs/use-cases-and-models.md`: apply terminology table and voice rules. Verify the single-GPU-exclusive service list (currently `LocalAI`, `Stable Diffusion WebUI`, `ComfyUI`, `Ollama`) still reads correctly after edits — this exact list was corrected for a stale-docs bug earlier this session; do not drop `Ollama` from it.

Apply the rest of the style guide to the full text of each file, not only the items listed above.

- [ ] **Step 3: Verify zero technical-fact drift**

Same check as prior tasks. `docs/models.md`'s model alias table (aliases, artifacts, intended use) must be byte-identical in content after the pass — tone-edit surrounding prose only, never table data cells that are technical facts (aliases, filenames).

- [ ] **Step 4: Commit**

```bash
git add docs/models.md docs/use-cases-and-models.md
git commit -m "docs: tone/scannability pass for models docs"
```

---

### Task 8: Historical specs (tone-only)

**Files:**
- Modify: `docs/superpowers/specs/2026-08-23-cross-platform-container-setup-design.md`
- Modify: `docs/superpowers/specs/2026-08-23-likwid-gaic-public-standards-design.md`
- Modify: `docs/superpowers/specs/2026-08-23-stack-npm-script-aliases-design.md`
- Modify: `docs/superpowers/specs/2026-08-23-use-case-models-design.md`
- Modify: `docs/superpowers/specs/2026-08-30-compute-autodetect-design.md`
- Modify: `docs/superpowers/specs/2026-08-30-unified-inference-api-design.md`
- Modify: `docs/superpowers/specs/2026-09-08-gpu-utilization-cap-design.md`
- Modify: `docs/superpowers/specs/2026-09-08-ollama-custom-container-design.md`
- Modify: `docs/superpowers/specs/2026-09-08-public-skills-directory-design.md`

**Interfaces:**
- Consumes: the spec's style guide (voice, terminology only — the Non-goals section explicitly excludes restructuring for this category)
- Produces: nothing later tasks depend on structurally

- [ ] **Step 1: Read all nine files and the spec's style guide, paying particular attention to the Non-goals section**

- [ ] **Step 2: Apply terminology and voice only — explicitly do NOT restructure**

Per the spec's Non-goals: these are dated historical/working records, not living reference docs. Fix voice (no marketing language, active voice) and the terminology table (the hub / profile / product capitalization) wherever it appears. Do NOT add headings, do NOT reorder sections, do NOT apply the `docs/*.md` structure template — these keep their existing "Goal / Decisions / File map / Non-goals" or similar spec-shaped format as-is.

Two of these files (`2026-09-08-gpu-utilization-cap-design.md`, `2026-09-08-ollama-custom-container-design.md`) were written this session in the target voice/terminology already — use them as your reference for what "already compliant" looks like when editing the other seven, which predate this style guide and are more likely to need terminology fixes (older files may still say "FORKEDAI_COMPUTE" in places if quoting historical env var names from before the `GAIC_` rename — check the spec/plan's own context before changing an env var name inside a historical file: if the file is specifically documenting what the code was CALLED AT THAT TIME (e.g. a commit message or code snippet from before the rename), leave the historical name as accurate history; only fix terminology in the surrounding prose voice, never inside a quoted historical code/command block).

- [ ] **Step 3: Verify zero technical-fact drift**

Same check as prior tasks, plus the historical-accuracy caveat from Step 2 — a quoted old commit message or old env var name inside a historical spec is a fact about the past, not a tone issue, and must not be "corrected" to current terminology.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/
git commit -m "docs: tone pass for historical spec documents"
```

---

### Task 9: Historical plans (tone-only)

**Files:**
- Modify: `docs/superpowers/plans/2026-08-23-likwid-gaic-public-standards.md`
- Modify: `docs/superpowers/plans/2026-08-23-stack-npm-script-aliases.md`
- Modify: `docs/superpowers/plans/2026-08-30-compute-autodetect.md`
- Modify: `docs/superpowers/plans/2026-09-08-gpu-utilization-cap.md`
- Modify: `docs/superpowers/plans/2026-09-08-ollama-custom-container.md`
- Modify: `docs/superpowers/plans/2026-09-08-public-skills-directory.md`
- Modify: `docs/plans/2026-08-30-001-feature-unified-inference-api-plan.md`

**Interfaces:**
- Consumes: the spec's style guide (voice, terminology only, same Non-goals exclusion as Task 8)
- Produces: nothing later tasks depend on structurally

- [ ] **Step 1: Read all seven files and the spec's style guide, paying particular attention to the Non-goals section**

- [ ] **Step 2: Apply terminology and voice only — explicitly do NOT restructure**

Same rules as Task 8 Step 2: these keep the mandatory plan-document header format (Goal/Architecture/Tech Stack/Spec/Global Constraints, Task N sections with Files/Interfaces/Steps) required by this hub's `writing-plans` skill convention — do not alter that structure. Fix voice and terminology in the prose (task descriptions, context notes, commit message text you are NOT meant to change since those are literal `git commit -m` strings already executed — leave every code block, command, and commit message string verbatim; edit only the surrounding prose). `2026-09-08-gpu-utilization-cap.md` and `2026-09-08-ollama-custom-container.md` were written this session already in the target voice — use them as your compliance reference.

`docs/plans/2026-08-30-001-feature-unified-inference-api-plan.md` predates the `docs/superpowers/plans/` convention and may use an older format — apply terminology/voice only, do not migrate its format to match the newer files' structure (that would be a restructuring change, out of scope).

- [ ] **Step 3: Verify zero technical-fact drift**

Same check as prior tasks. These files contain literal code blocks (test code, implementation code, exact commit messages) from when the work was actually done — every one of those blocks must remain byte-for-byte identical; only prose paragraphs outside code blocks are eligible for tone edits.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/ docs/plans/
git commit -m "docs: tone pass for historical plan documents"
```
