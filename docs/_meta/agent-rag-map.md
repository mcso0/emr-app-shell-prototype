# Agent RAG Map

This document defines the smallest useful reading set for Codex work in this repository. It is not a vector database or external RAG system. It is a routing map for choosing source documents before a task starts.

## Operating Goal

Read enough context to stay aligned, but do not reread the whole documentation tree. Prefer current source-of-truth documents, the active Linear issue, and the linked `docs/work/` item over historical reports.

## Lightweight Knowledge Ops

This repository does not maintain a separate LLM Wiki layer by default. Borrow LLM Wiki-style operations only as a lightweight practice over the existing docs:

- Query: use this map to choose the smallest current source-doc set, then cite or link the canonical docs that support the answer.
- Ingest: when durable knowledge changes, route it through `docs/_meta/intake-rules.md` and update the owning canonical doc instead of creating a duplicate generated summary.
- Catalog: use `docs/index.md`, the internal `/docs` CLAiR Docs viewer, area READMEs, and `docs/work/index.md` as navigation surfaces; do not create a second global index unless 승욱 explicitly approves it. `/prd` remains a compatibility path for product-doc links. `docs/SUMMARY.md` is legacy GitBook compatibility, not active navigation.
- Log: keep history near the owning area through work items, closeouts, changelogs, and current-status history; do not create a global LLM-maintained log by default.
- Lint: when reviewing docs health, check for stale claims, broken source links, duplicate source-of-truth paths, and mock/live or security-completion overclaims.

## OKF-Lite Metadata

Use Open Knowledge Format style only as lightweight metadata over the existing `docs/` system. Do not create a separate OKF bundle, `docs/wiki/`, generated summary layer, or global agent-maintained log unless 승욱 explicitly approves that scope.

For new or substantially touched canonical source docs, add these fields when they clarify agent routing:

- `type`: human-readable knowledge type, such as `Product Requirement`, `Domain Contract`, `Data Contract`, `Operating Rule`, `Decision`, `Work Item`, or `Closeout`.
- `title`: reader-facing title that matches or closely mirrors the first heading.
- `description`: one concise sentence explaining what the doc makes knowable.
- `tags`: short routing tags for area, workflow, or domain concepts.

Keep existing repo fields such as `id`, `status`, `area`, `doc_type`, `related_work`, and `last_updated`; they remain the internal source-of-truth lifecycle fields. Treat OKF-style metadata as optional routing help, not authority over product status, security completion, DB/RLS readiness, launch readiness, or work acceptance.

## Task-Conditional Startup

Start at the requested file or active issue. Use `docs/agent-start-here.md` only when choosing a reading path, and `docs/engineering/current-status.md` when product scope, mock/live state, permissions/data, or readiness matters. Already-loaded instructions do not need another read unless changed or incomplete for the task.

For PR-sized work, search the work index and reuse the matching item. For documentation/work-structure changes use `docs/_meta/intake-rules.md`. The table below lists candidate sources: choose the owner and relevant sections, not the entire row.

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

| Task type | Candidate sources | Selection rule |
| --- | --- | --- |
| Docs or work routing | `docs/_meta/intake-rules.md`; `docs/_meta/documentation-depth-rules.md` when record depth is unclear; `docs/README.md` for viewer/navigation changes | Search `docs/work/index.md` only for PR-sized work. |
| System architecture, app/API boundaries, or repo structure | `docs/engineering/architecture/system-architecture-overview.md`, `docs/engineering/architecture/mock-live-boundary-map.md`, `docs/engineering/api-boundaries/api-boundary-integration-guide.md`, `docs/engineering/data-model/README.md`, active work item | Use the overview as the routing map, then open only the specific architecture, API, data, auth/security, or testing contract needed for the task. |
| Product direction or MVP scope | `docs/product/README.md`, `docs/product/prd/clair-emr-saas-prd.md`, `docs/product/features/legacy-mvp-feature-spec.md`, `docs/product/user-flows/emr-saas-userflow.md` | Humans may use `/docs` as a read-only viewer, but agents should still read the source Markdown paths. |
| Home 원내 현황 or operations work-status board | `docs/product/features/home/home-operations-work-status-contract-v0.md`, `docs/engineering/data-model/home-operations-work-status-read-model.md`, `docs/product/features/home/home-work-generation-rules-v0.md`, `docs/product/domain/order-fulfillment-handoff.md`, active Home work item | Use the operations contract for hospital-wide `원내 현황`; use the older work-generation rules for the `내 업무` lens only. |
| Owner study or project learning notes | `docs/study/README.md`, `docs/study/curriculum.md`, relevant `docs/study/sessions/**` lesson note, and source docs linked from the lesson | Study notes are local/internal learning aids. Product, design, engineering, security, DB, and launch truth still belongs in the owning canonical docs. |
| Role, auth, permission, or workspace policy | `docs/product/domain/workspace-auth-permissions.md`, `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`, `docs/engineering/auth-security/auth-login/README.md`, relevant auth-login status/work-order docs | Do not change role/permission policy without representative approval. |
| DB, data model, migration, RLS, or persistence | `docs/product/domain/README.md`, `docs/engineering/data-model/README.md`, `docs/engineering/data-model/emr-saas-db-structure-spec.ko.md`, relevant `docs/engineering/auth-security/auth-login/*persistence*` docs, active work item | Scoped synthetic/demo Supabase, migration, RLS, and persistence work may proceed when an active issue includes it. Stop for real data, destructive remote changes, secret/security exposure, or high-cost external effects. |
| UI or screen work | `docs/design/README.md`, `docs/design/system/DESIGN.md`, `docs/design/reference-screen-index.md`, relevant `docs/design/screens/**` or `docs/design/flows/**`, active screen work item | Read installed Next.js docs only for changes depending on framework APIs, configuration, or behavior. |
| Design system or shared components | `docs/design/system/DESIGN.md`, `docs/design/system/component-ownership-rules.md`, `docs/design/system/ui-refactor-dod.md`, `docs/design/system/ui-refactor-operating-model.md` | Use existing tokens and shared primitives before adding new patterns. |
| QA or visual review | `docs/design/qa/README.md`, `docs/design/qa/core-workspace-ui-review-checklist.md`, `docs/design/qa/interaction-accessibility-audit.md`, `docs/design/qa/responsive-dense-layout-audit.md`, relevant Playwright specs | Use screenshots or browser verification when UI quality matters. |
| Testing, CI, or regression | `docs/engineering/testing/mvp-gap-analysis.md`, active work item verification section, relevant `tests/*.spec.ts` | Prefer narrow verification first, then broaden when risk requires it. |
| Release, deployment, or operations | `.agents/skills/release-deployment-ops/SKILL.md`; the target-specific release/merge runbook | PR previews use work branches; the active release path is PR to `main`, with no staging integration step. Production and `main` retain current-candidate verification and explicit approval, including reusable bounded conditional approval under the release policy. Automatic PR checks are the default; inspect the active work item for Preview activation status. Read data/env contracts when those boundaries are involved. |
| Linear operations | `.agents/skills/manual-linear-ops/SKILL.md`, active issue; the full manual for placement, milestones, status ambiguity, or grouped release work | One issue/branch/PR remains the default; approved bundles can group issues. Only perform authorized external updates. |
| Owner OS routing or work packet creation | `docs/product/service/clair-owner-os-product-plan.md`, `.agents/skills/clair-owner-os-router/SKILL.md`, `.agents/skills/subagent-decision/SKILL.md` when subagent use is relevant, active Linear issue or `docs/work/agent-orchestration/OWNER-OS-*.md` | Use packet/depth detail for broad routing or an explicitly requested packet, not as a prerequisite for a clear local fix. |
| Owner Safety OS or 안전 점검 게이트 | `docs/_meta/owner-safety-os.md`, `docs/_meta/non-developer-codex-workflow.md`, `.agents/skills/emr-owner-safety-os/SKILL.md` | For explicit Safety OS gate requests, start with lightweight intake and wait for scope approval. Ordinary requested read-only review proceeds directly with relevant checks. `작업 점검 하자` remains a legacy alias. |

## Reading Depth Rules

- Use README files as maps, not as permission to read every linked document.
- Open only the smallest section needed for the current task.
- If a source doc is too long, search within it for the relevant heading or term first.
- Prefer `rg` for local search and use exact paths from the active issue whenever available.
- Treat `docs/work/index.md`, long logs, generated artifacts, and broad test output as high-token surfaces. Query them with `rg` or bounded ranges before opening larger sections.
- Use `AGENTS.md` for project operating boundaries, `docs/engineering/current-status.md` for product status, and the most specific approved contract for behavior. A document or generated packet does not grant itself authorization.
- Ask when unresolved uncertainty materially changes product behavior, security, data, or launch scope. Continue independent authorized preparation.

## Standard Startup Prompt

승욱 can use this when starting work:

```text
루멘, 이 요청과 직접 관련된 코드·문서부터 확인하고 진행해줘.
범위나 mock/live 상태가 필요하면 current-status를 확인해줘.
승인된 구현·검증·오류 수정까지 마치고 결과를 알려줘.
```

## Maintenance

Update this map when:

- a new canonical source document is created
- a new workstream changes startup routing
- `/docs` viewer registry or human docs entry point changes
