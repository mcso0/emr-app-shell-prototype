# Agent RAG Map

This document defines the smallest useful reading set for Codex work in this repository. It is not a vector database or external RAG system. It is a routing map for choosing source documents before a task starts.

## Operating Goal

Read enough context to stay aligned, but do not reread the whole documentation tree. Prefer current source-of-truth documents, the active Linear issue, and the linked `docs/work/` item over historical reports.

## Default Startup Set

For most tasks, read only:

1. `AGENTS.md`
2. `docs/agent-start-here.md`
3. `docs/engineering/current-status.md`
4. The active Linear issue or `docs/work/` item
5. The task-specific source docs listed below

Read `docs/README.md`, `docs/_meta/README.md`, and `docs/_meta/intake-rules.md` when the task changes docs, planning, work routing, or durable operating rules.

## Do Not Read By Default

Skip these unless the active issue explicitly links them or the task needs historical detail:

- `docs/archive/**`
- `docs/completed/**`
- long status/history logs
- `docs/engineering/current-status-history.md`
- unrelated work items
- old compatibility stubs under `docs/implementation/**`
- generated or reference assets unless visual QA requires them

## Task-Specific Reading Map

| Task type | Read after startup | Notes |
| --- | --- | --- |
| Docs or work routing | `docs/README.md`, `docs/_meta/README.md`, `docs/_meta/intake-rules.md`, `docs/_meta/documentation-depth-rules.md`, `docs/work/index.md` | Use for new plans, source-of-truth changes, Linear shaping, and closeouts. |
| Product direction or MVP scope | `docs/product/README.md`, `docs/product/prd/clair-emr-saas-prd.md`, `docs/product/features/legacy-mvp-feature-spec.md`, `docs/product/user-flows/emr-saas-userflow.md` | Prefer future baseline docs once created: SaaS operating map, MVP scope, workflow state model, and domain entity map. |
| Role, auth, permission, or workspace policy | `docs/product/domain/workspace-auth-permissions.md`, `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`, `docs/engineering/auth-security/auth-login/README.md`, relevant auth-login status/work-order docs | Do not change role/permission policy without representative approval. |
| DB, data model, migration, RLS, or persistence | `docs/product/domain/README.md`, `docs/engineering/data-model/README.md`, `docs/engineering/data-model/emr-saas-db-structure-spec.ko.md`, relevant `docs/engineering/auth-security/auth-login/*persistence*` docs, active work item | Remote Supabase, migration push, RLS, and live data work remain approval-gated. |
| UI or screen work | `docs/design/README.md`, `docs/design/system/DESIGN.md`, `docs/design/reference-screen-index.md`, relevant `docs/design/screens/**` or `docs/design/flows/**`, active screen work item | For Next.js app code, read the relevant `node_modules/next/dist/docs/` guide before coding. |
| Design system or shared components | `docs/design/system/DESIGN.md`, `docs/design/system/component-ownership-rules.md`, `docs/design/system/ui-refactor-dod.md`, `docs/design/system/ui-refactor-operating-model.md` | Use existing tokens and shared primitives before adding new patterns. |
| QA or visual review | `docs/design/qa/README.md`, `docs/design/qa/core-workspace-ui-review-checklist.md`, `docs/design/qa/interaction-accessibility-audit.md`, `docs/design/qa/responsive-dense-layout-audit.md`, relevant Playwright specs | Use screenshots or browser verification when UI quality matters. |
| Testing, CI, or regression | `docs/engineering/testing/mvp-gap-analysis.md`, active work item verification section, relevant `tests/*.spec.ts` | Prefer narrow verification first, then broaden when risk requires it. |
| Release, deployment, or operations | `docs/engineering/operations/README.md`, `docs/engineering/auth-security/auth-login/live-supabase-readiness-execution-mode.md`, `docs/engineering/auth-security/auth-login/auth-db-env-secret-verification-gates.md`, relevant launch readiness docs | Production deploy, real email, payment, and remote Supabase remain approval-gated. |
| Linear operations | `docs/engineering/agent-orchestration/manual-linear-operations.md`, active Linear project/issue, `docs/work/index.md` | Keep one Linear issue, one owner, one branch, and one PR by default. |

## Reading Depth Rules

- Use README files as maps, not as permission to read every linked document.
- Open only the smallest section needed for the current task.
- If a source doc is too long, search within it for the relevant heading or term first.
- Prefer `rg` for local search and use exact paths from the active issue whenever available.
- If two documents conflict, treat `docs/engineering/current-status.md` and the most specific approved source-of-truth doc as current.
- If uncertainty affects product, security, data, or launch policy, stop and ask 승욱 instead of guessing.

## Standard Startup Prompt

승욱 can use this when starting work:

```text
루멘, agent-start-here와 current-status만 먼저 읽고,
이 Linear issue의 source docs와 agent-rag-map 기준으로
필요한 문서만 추가 확인해서 진행해줘.
archive/completed/history는 필요할 때만 봐줘.
```

## Maintenance

Update this map when:

- a new canonical source document is created
- a new workstream changes startup routing
- GitBook sidebar structure changes the human docs entry point
