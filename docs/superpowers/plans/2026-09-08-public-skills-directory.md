# Public Skills Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `likwidmack/gaic-skills-directory` — a public, installable Claude Code plugin marketplace bundling one original skill, plus a curated README linking to four other worthwhile skill sources.

**Architecture:** A new, standalone git repo (sibling to the other forks at `E:\git\gaic-skills-directory`) with a standard Claude Code marketplace layout (`.claude-plugin/marketplace.json` + `skills/<name>/SKILL.md`), a curated `README.md`, and `likwid-gaic` cross-linking to it once published.

**Tech Stack:** Plain Markdown/JSON — no build step. GitHub CLI (`gh`) for repo creation.

**Spec:** [docs/superpowers/specs/2026-09-08-public-skills-directory-design.md](../specs/2026-09-08-public-skills-directory-design.md)

## Global Constraints

- New repo path: `E:\git\gaic-skills-directory` (sibling to the existing forks under `E:\git\`)
- Owner: `likwidmack` (public-repo account per `likwid-gaic`'s `docs/github-access.md`); switch the active `gh` account there before creating the repo, and switch back to `tamaramack` afterward, exactly as done for `likwid-gaic` PR #32
- License: MIT
- Only one skill is bundled directly (`single-gpu-profile-switching`); the other four sources are links only, never vendored
- Verify by actually installing the published marketplace with `claude plugin marketplace add likwidmack/gaic-skills-directory` and confirming the skill is listed

## File map

| File | Responsibility |
| ---- | --------------- |
| `.claude-plugin/marketplace.json` | Marketplace manifest |
| `.claude-plugin/plugin.json` | Plugin manifest |
| `skills/single-gpu-profile-switching/SKILL.md` | The bundled skill |
| `README.md` | Curated directory |
| `LICENSE` | MIT |
| `CONTRIBUTING.md` | Contribution guide |

---

### Task 1: Scaffold the repo

**Files:**

- Create: `E:\git\gaic-skills-directory\.git` (via `git init`)
- Create: `E:\git\gaic-skills-directory\LICENSE`
- Create: `E:\git\gaic-skills-directory\.gitignore`

**Interfaces:**

- Consumes: nothing
- Produces: an empty, initialized repo ready for content

- [ ] **Step 1: Create the directory and initialize git**

```bash
mkdir -p /e/git/gaic-skills-directory
cd /e/git/gaic-skills-directory
git init
git config user.name "Tamara Mack"
git config user.email "tamaramack0508@gmail.com"
```

- [ ] **Step 2: Add the MIT license**

Create `LICENSE`:

```text
MIT License

Copyright (c) 2026 Tamara Mack

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Add `.gitignore`**

Create `.gitignore`:

```text
.DS_Store
Thumbs.db
node_modules/
```

- [ ] **Step 4: Commit**

```bash
git add LICENSE .gitignore
git commit -m "chore: initialize gaic-skills-directory"
```

---

### Task 2: Write the bundled skill

**Files:**

- Create: `skills/single-gpu-profile-switching/SKILL.md`

**Interfaces:**

- Consumes: nothing (self-contained guidance skill, no scripts)
- Produces: a real, complete SKILL.md a marketplace can reference

- [ ] **Step 1: Write the skill**

Create `skills/single-gpu-profile-switching/SKILL.md`:

```markdown
---
name: single-gpu-profile-switching
description: Use when a Docker Compose project runs multiple GPU-hungry services (LLM inference, image generation, etc.) on a host with exactly one GPU, and you need to start/stop them without VRAM contention or silent OOM crashes.
---

# Single-GPU profile switching

## The problem

Docker's NVIDIA runtime happily lets N containers all request the same GPU at
once. Nothing in Docker itself serializes access. On a workstation with one
GPU and several optional services — a chat model, an image generator, a
speech model — starting a second GPU-heavy container while the first is still
warm doesn't fail loudly. It either OOMs mid-inference, or both processes
silently share VRAM and both get slower and less reliable. The fix is not a
runtime flag; it's making "only one GPU consumer at a time" an explicit,
checked policy in your own tooling.

## The pattern

1. **Declare which services are GPU-exclusive, and which of those are
   simultaneously required by which "profile" (mode) of your stack.**
   Represent this as data, not as scattered `if` statements — a
   `{ services: [...], profilesByService: { service: [profiles] } }` map
   works well and is easy to unit test.

2. **Before starting a profile, compute a stop/keep plan, don't just start.**
   Given "GPU services currently running" and "profile about to start",
   derive two sets: services to stop (currently running, not needed by the
   target profile) and services to keep/start (needed by the target
   profile). Stop-then-start, in that order, never the reverse — starting
   before stopping is exactly the race that causes contention.

3. **Preflight-check on every start, not just on explicit "switch".**
   A user (or an agent) will eventually run the "start this one service"
   command directly instead of the "switch to this profile" command. Both
   paths need to consult the same conflict check before starting a
   container — one that throws on "you're about to start service B while
   GPU-exclusive service A is already running", with an explicit
   `--allow-gpu-share`-style opt-out for when contention is actually
   intended (a developer debugging both at once, a GPU with genuinely
   spare VRAM for two small models).

4. **Give an escape hatch for CPU-only hosts and for hosts where the whole
   policy doesn't apply.** Auto-detect compute mode where possible (probe
   for the GPU vendor's CLI tool — `nvidia-smi`, for example — and fall back
   to CPU on failure or absence), and let it be pinned explicitly. On CPU
   hosts, GPU-exclusivity checks are moot; skip them rather than special-
   casing every call site.

5. **Make the check pure and unit-testable.** The "which services must stop,
   which must stay" computation is pure logic — no I/O — and should live in
   its own function taking `(runningServices, targetProfile, exclusivityMap)`
   and returning `{ toStop, toKeep }`. Keep the actual `docker compose stop`
   /`docker compose up` calls in a thin wrapper around it. This is the
   difference between a policy you can unit-test in milliseconds and one you
   can only verify by actually starting containers.

## Signals this skill applies

- The user mentions running multiple AI/ML services (LLM server, image
  generation, TTS/STT, etc.) via Docker Compose on one machine
- Symptoms described: CUDA out-of-memory errors that only happen when
  "switching" between two services, or GPU services silently getting slower
  when more than one is up
- A request to add a new GPU-heavy service to an existing Compose stack that
  already has one

## What this skill does NOT cover

- Multi-GPU scheduling or spreading models across GPUs — that's a different
  problem (device selection, not exclusivity)
- NVIDIA MPS or time-slicing setups on shared/multi-tenant Linux hosts
- Kubernetes GPU scheduling (its device-plugin model already solves this at
  the orchestrator level)
```

- [ ] **Step 2: Commit**

```bash
git add skills/single-gpu-profile-switching/SKILL.md
git commit -m "feat: add single-gpu-profile-switching skill"
```

---

### Task 3: Marketplace and plugin manifests

**Files:**

- Create: `.claude-plugin/marketplace.json`
- Create: `.claude-plugin/plugin.json`

**Interfaces:**

- Consumes: `skills/single-gpu-profile-switching/SKILL.md` from Task 2
- Produces: a marketplace `claude plugin marketplace add` can register

- [ ] **Step 1: Write `plugin.json`**

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "single-gpu-profile-switching",
  "description": "Guidance for safely switching between GPU-exclusive services in a Docker Compose stack on a single-GPU host.",
  "version": "1.0.0",
  "source": "./",
  "author": {
    "name": "Tamara Mack",
    "email": "tamaramack0508@gmail.com"
  },
  "skills": ["./skills/single-gpu-profile-switching"]
}
```

- [ ] **Step 2: Write `marketplace.json`**

Create `.claude-plugin/marketplace.json`:

```json
{
  "name": "gaic-skills-directory",
  "description": "A small public directory of general-purpose Claude Code skills, plus links to other worthwhile skill sources.",
  "owner": {
    "name": "Tamara Mack",
    "email": "tamaramack0508@gmail.com"
  },
  "plugins": [
    {
      "name": "single-gpu-profile-switching",
      "description": "Guidance for safely switching between GPU-exclusive services in a Docker Compose stack on a single-GPU host.",
      "version": "1.0.0",
      "source": "./",
      "author": {
        "name": "Tamara Mack"
      },
      "keywords": ["docker", "gpu", "nvidia", "compose", "infrastructure"],
      "category": "engineering",
      "skills": ["./skills/single-gpu-profile-switching"]
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/
git commit -m "feat: add marketplace and plugin manifests"
```

---

### Task 4: The curated directory README

**Files:**

- Create: `README.md`

**Interfaces:**

- Consumes: nothing
- Produces: the public-facing directory page

- [ ] **Step 1: Write `README.md`**

Create `README.md`:

`````markdown
# gaic Skills Directory

A small public directory of general-purpose [Claude Code](https://claude.com/claude-code)
skills. One skill is bundled directly here and installable as a plugin; the
rest are links to other maintainers' work, credited and licensed on their own
terms.

## Install this marketplace

````
claude plugin marketplace add likwidmack/gaic-skills-directory
claude plugin install single-gpu-profile-switching@gaic-skills-directory
````

## Bundled here

| Skill | What it's for |
| ----- | -------------- |
| [single-gpu-profile-switching](skills/single-gpu-profile-switching/SKILL.md) | Safely switch between GPU-exclusive services in a Docker Compose stack on a single-GPU host |

## Directory: other worthwhile skill sources

These are **not** vendored into this repo — install them from their own
marketplaces.

### Engineering

- [obra/superpowers](https://github.com/obra/superpowers) (MIT) — TDD,
  systematic debugging, brainstorming, plan-writing/execution, git worktrees,
  subagent dispatch, code-review handoffs.
  `claude plugin marketplace add obra/superpowers`
- [mattpocock/skills](https://github.com/mattpocock/skills) (MIT) — spec/
  ticket workflows, TDD, domain modeling, code review, "grilling" interview-
  style planning skills.
  `claude plugin marketplace add mattpocock/skills`

### Documents, design, and API reference

- [anthropics/skills](https://github.com/anthropics/skills) (Apache-2.0) —
  Word/Excel/PowerPoint/PDF document skills, MCP server building, algorithmic
  art, frontend design, and the Claude API reference skill.
  `claude plugin marketplace add anthropics/skills`
- [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
  (MIT) — searchable UI style, color palette, font pairing, and UX guideline
  databases across 22 tech stacks.
  `claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) to propose a new bundled skill or a
new directory link.

## License

MIT — see [LICENSE](LICENSE). Linked repositories carry their own licenses;
check each before use.
`````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add the curated directory README"
```

---

### Task 5: Contribution guide

**Files:**

- Create: `CONTRIBUTING.md`

**Interfaces:**

- Consumes: nothing
- Produces: contribution guidance for future PRs

- [ ] **Step 1: Write `CONTRIBUTING.md`**

Create `CONTRIBUTING.md`:

```markdown
# Contributing

## Adding a directory link

Open a PR adding a row to the relevant category table in `README.md`
(or a new category if none fits). Include: repo link, license, a one-line
description, and the exact `claude plugin marketplace add` command. Do not
vendor the linked repo's code into this repo.

## Proposing a new bundled skill

Bundled skills in this repo must be general-purpose — not specific to any
one project or company's internal tooling. Open a PR with:

1. `skills/<skill-name>/SKILL.md` following the existing skill's structure
   (frontmatter `name` + `description`, then the guidance body).
2. A new entry in `.claude-plugin/marketplace.json`'s `plugins` array and a
   matching `.claude-plugin/plugin.json` if the skill ships as its own
   plugin.
3. A row in `README.md`'s "Bundled here" table.

Skills that only make sense inside a specific proprietary codebase belong in
that codebase's own `.agents/` or `.claude/skills/` directory, not here.
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING.md"
```

---

### Task 6: Publish and verify

**Files:**

- None (publishing step; no repo files change beyond the git remote)

**Interfaces:**

- Consumes: the fully-scaffolded local repo from Tasks 1-5
- Produces: a live public GitHub repo, verified installable

- [ ] **Step 1: Switch the active `gh` account to the hub owner**

```bash
gh auth switch --hostname github.com --user likwidmack
```

- [ ] **Step 2: Create and push the public repo**

```bash
cd /e/git/gaic-skills-directory
gh repo create likwidmack/gaic-skills-directory --public --source=. --remote=origin
git push -u origin HEAD
```

- [ ] **Step 3: Verify the marketplace installs**

```bash
claude plugin marketplace add likwidmack/gaic-skills-directory
claude plugin install single-gpu-profile-switching@gaic-skills-directory
claude plugin list
```

Expected: `single-gpu-profile-switching@gaic-skills-directory` appears with
`Status: ✔ enabled`.

- [ ] **Step 4: Restore the previously active `gh` account**

```bash
gh auth switch --hostname github.com --user tamaramack
```

- [ ] **Step 5: Cross-link from `likwid-gaic`**

In `likwid-gaic`'s `.agents/README.md`, under the existing "External skill
sources" section, add one sentence pointing at the new public directory (for
example: "A curated public spin-off of this catalog, with one original
bundled skill, is published at
[likwidmack/gaic-skills-directory](https://github.com/likwidmack/gaic-skills-directory).").
Add a matching one-line mention in the root `README.md` wherever it lists
related resources or links.

```bash
cd /e/git/_lk/forkedAI
git add .agents/README.md README.md
git commit -m "docs: link the public gaic-skills-directory"
```
```
