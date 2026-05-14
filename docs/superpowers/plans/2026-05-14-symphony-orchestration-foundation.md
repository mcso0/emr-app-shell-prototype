# Symphony Orchestration Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add the first repository-owned Symphony operating contract for Linear-driven Codex work, including a separate read-only CSO security audit workflow.

**Architecture:** Keep Symphony runtime configuration under `ops/symphony/` so the repo can support multiple workflows without overloading the project root. Keep durable operating guidance under `docs/engineering/agent-orchestration/`, and register the PR-sized work in `docs/work/agent-orchestration/`. Linear project identifiers remain placeholders until the real Linear project is created.

**Tech Stack:** OpenAI Codex app-server, OpenAI Symphony reference specification, Linear issue tracker, repository docs/work operating model, gstack CSO skill.

---

### Task 1: Create Symphony Plan Artifact

**Files:**
- Create: `docs/superpowers/plans/2026-05-14-symphony-orchestration-foundation.md`

- [x] **Step 1: Write this implementation plan**

Create a plan with explicit file ownership, workflow boundaries, verification commands, and execution order.

- [x] **Step 2: Confirm plan has no placeholder execution steps**

Search this file for unsupported planning placeholders:

```bash
rg "TB[D]|implement late[r]|fill in detail[s]|similar to Tas[k]" docs/superpowers/plans/2026-05-14-symphony-orchestration-foundation.md
```

Expected: no matches.

### Task 2: Add Symphony Runtime Contracts

**Files:**
- Create: `ops/symphony/README.md`
- Create: `ops/symphony/WORKFLOW.md`
- Create: `ops/symphony/WORKFLOW.security.md`

- [x] **Step 1: Create `ops/symphony/README.md`**

Add the local runbook that explains prerequisites, placeholder replacement, and first pilot constraints.

- [x] **Step 2: Create `ops/symphony/WORKFLOW.md`**

Add the general implementation workflow with Linear active states, bounded concurrency, workspace bootstrap, repo reading order, guardrails, and Human Review handoff.

- [x] **Step 3: Create `ops/symphony/WORKFLOW.security.md`**

Add the CSO-only workflow with read-only instructions, security report requirements, and no-code-change constraints.

- [x] **Step 4: Review workflow YAML front matter**

Run:

```bash
node -e "const fs=require('fs'); for (const f of ['ops/symphony/WORKFLOW.md','ops/symphony/WORKFLOW.security.md']) { const s=fs.readFileSync(f,'utf8'); if (!s.startsWith('---\\n')) throw new Error(f+' missing front matter'); const end=s.indexOf('\\n---',4); if (end < 0) throw new Error(f+' missing closing front matter'); console.log(f+' ok'); }"
```

Expected: both files print `ok`.

### Task 3: Add Engineering Orchestration Docs

**Files:**
- Create: `docs/engineering/agent-orchestration/README.md`
- Create: `docs/engineering/agent-orchestration/symphony-operations.md`
- Create: `docs/engineering/agent-orchestration/linear-agent-workflow.md`
- Create: `docs/engineering/agent-orchestration/cso-security-agent.md`
- Modify: `docs/engineering/README.md`

- [x] **Step 1: Create the area README**

Document the purpose of `agent-orchestration/` and link the three canonical guides.

- [x] **Step 2: Create Symphony operations guide**

Document architecture, local prerequisites, workflow files, first pilot plan, and explicit non-goals.

- [x] **Step 3: Create Linear workflow guide**

Document statuses, labels, issue templates, and team-style routing.

- [x] **Step 4: Create CSO security agent guide**

Document when to run CSO, what it may produce, what it must not do, and how findings become follow-up work.

- [x] **Step 5: Link the new area from engineering README**

Add `agent-orchestration/` to planned subareas and current canonical docs.

### Task 4: Register PR-Sized Work Item

**Files:**
- Create: `docs/work/agent-orchestration/SYMPHONY-PR-001-orchestration-foundation.md`
- Modify: `docs/work/index.md`

- [x] **Step 1: Create the work item**

Use the standard work item shape with goal, scope, out of scope, done criteria, verification, and handoff notes.

- [x] **Step 2: Add the work item to the status board**

Insert `SYMPHONY-PR-001` into `docs/work/index.md` with status `done` once the docs and workflow files are created.

### Task 5: Verify Documentation

**Files:**
- Read-only verification across docs and ops files.

- [x] **Step 1: Run docs link check**

Run:

```bash
npm run docs:check
```

Expected: command exits 0.

- [x] **Step 2: Run focused text checks**

Run:

```bash
rg "TODO_LINEAR_PROJECT_SLUG|Human Review|cso|WORKFLOW.security" ops/symphony docs/engineering/agent-orchestration docs/work/agent-orchestration
```

Expected: matches show the placeholder and safety gates are documented intentionally.

- [x] **Step 3: Review git diff**

Run:

```bash
git diff -- docs/superpowers/plans ops/symphony docs/engineering docs/work
```

Expected: only Symphony orchestration docs, workflow contracts, and work registration changed.
