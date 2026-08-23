# likwid-gaic public standards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the hub to likwid-gaic, ship a public-friendly README, MIT license, and standard GitHub/npm community metadata without migrating storage paths.

**Architecture:** Documentation and metadata-only change. Keep `private: true`, existing CI, and on-disk `forkedAI` storage roots. Update display names and GitHub identity strings to `likwidmack/likwid-gaic`.

**Tech Stack:** Node.js package metadata, Markdown docs, GitHub issue/PR templates, MIT license.

## Global Constraints

- Public name and package name: `likwid-gaic`
- License: MIT, copyright 2026 likwidmack
- Keep `"private": true` in package.json
- Do not change `D:\forkedAI` / `E:\data\forkedAI` / `.forkedai` path strings
- Do not add CD workflows or CODE_OF_CONDUCT.md
- Do not commit unless the user asks
- Verify with `npm test`, Prettier on maintained Markdown, `git diff --check`

---

### Task 1: npm package metadata

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1:** Set `name` to `likwid-gaic` and add description, license, homepage, repository, bugs, keywords; keep scripts/engines/private/type.
- [ ] **Step 2:** Mirror the package name in `package-lock.json` root and `packages[""]`.

### Task 2: LICENSE and community root docs

**Files:**

- Create: `LICENSE`
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`

- [ ] **Step 1:** Add MIT LICENSE (2026, likwidmack).
- [ ] **Step 2:** Add SECURITY.md (advisories; no secrets in issues).
- [ ] **Step 3:** Add CONTRIBUTING.md (`development`/`main`, `npm test`, link `docs/cicd.md`).

### Task 3: GitHub templates

**Files:**

- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/docs.yml`

- [ ] **Step 1:** Add PR template with summary, test plan, npm test checklist.
- [ ] **Step 2:** Add bug and docs issue forms; config.yml with blank_issues_enabled false and link to docs.

### Task 4: Public README

**Files:**

- Modify: `README.md`

- [ ] **Step 1:** Replace with concise public landing page per spec (title, one-liner, what you get, requirements, quick start, docs table, privacy, license).

### Task 5: Identity renames in docs and config

**Files:**

- Modify: `docs/README.md`
- Modify: `docs/github-access.md`
- Modify: `docs/localai-docker-setup.md` (hub phrasing only)
- Modify: `AGENTS.md` (product prose; keep clone path examples)
- Modify: `config/accounts.json`

- [ ] **Step 1:** Update hub display names and `likwidmack/likwid-gaic` references.
- [ ] **Step 2:** Change “managed forkedAI” → “managed likwid-gaic” in LocalAI guide.
- [ ] **Step 3:** Update accounts.json repository and purpose (public hub).

### Task 6: Verify

- [ ] **Step 1:** Format Markdown with Prettier (README + docs/\*.md excluding inventory.generated.md).
- [ ] **Step 2:** Run `npm test` and `git diff --check`.
- [ ] **Step 3:** Confirm storage path strings still contain `forkedAI` where intended.
