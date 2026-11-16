---
type: "implementation-plan"
title: "총괄 지시사항 — origin/main implementation plan"
description: "Pinned source findings, implemented local architecture, staged verification, and delivery boundaries for overall instructions."
status: draft
area: chart
doc_type: architecture
tags: [chart, instructions, fulfillment, implementation-plan]
related_work: [CLINICAL-FULFILLMENT-PR-010, CLINICAL-FULFILLMENT-PR-012]
last_updated: "2026-11-01"
---

# 총괄 지시사항 — implementation plan

## Outcome and boundary

Implement the approved chart-wide and category-specific instruction workflow described in the [PRD](../../product/features/chart/overall-instructions-prd.md) and [screen specification](../../design/screens/chart/specs/overall-instructions.md). Keep current instructions, historical request/completion snapshots, explicit performer acknowledgements, and notification reads distinct.

The user authorized local implementation on 2026-11-01 and subsequently authorized this feature PR, one remote migration and Production delivery. Execution, exact scope and limits are tracked in [CLINICAL-FULFILLMENT-PR-012](../../work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-012-overall-instructions.md); [PR #1033](https://github.com/mcso0/emr-app-shell-prototype/pull/1033) records live release results. Unrelated migrations, real clinical/provider actions and paid-resource changes remain outside scope. Existing dirty work must remain untouched.

The existing CLINICAL-FULFILLMENT-PR-010 is a foundation reference, not approval for this feature. The work index was searched before implementation; PR-012 now owns this feature and its evidence. Do not create duplicate plans under `docs/implementation/`.

## Pinned source baseline

- Fetched `origin/main` on 2026-11-01.
- Inspected commit: `e3b7923a05d160b240e6beb330121cd14b5b66cd`.
- Commit subject: `test(chart): scope set catalog trigger and restore synthetic fixture (#1031)`.
- Inspection used `git show origin/main:<path>` and `git grep ... origin/main`, not modified working-tree application files.
- Source findings establish repository behavior only. Hosted schema parity, authenticated UI behavior, and production permissions were not tested.

| Area / source owner at pinned commit | Observed behavior | Required change |
| --- | --- | --- |
| `src/features/chart/module.tsx` around 14697 and 14846 | Renders `ChartOralInstructionEditor`; separate `총괄 지시사항` button is disabled with `준비 중` | Replace entry ownership with one overall-instructions flow; avoid duplicate legacy entry |
| `src/features/chart/chart-oral-instruction-editor.tsx` | GET/PATCH one PO instruction, revision check, loading/error, success closes dialog | Multi-scope draft model, atomic apply, conflict recovery, result reconciliation, success toast, v45 layout |
| `src/features/chart/chart-oral-instruction-contract.ts` | One instruction string, numeric revision, history, optional `canEdit`; 5,000-character command limit | Explicit scope changes, eligibility, reasoned editability, apply identity, deletion, per-scope versions |
| `src/app/api/workspaces/[workspaceId]/chart/charts/[chartId]/oral-instruction/route.ts` | Supabase-session-only GET/PATCH, no demo fallback, no-store, RPC mapping including 403/404/409 | New scoped route/contract with the same session boundary; preserve compatible old clients during transition |
| `supabase/migrations/20261027130000_chart_oral_instructions.sql` | Private append-only PO revisions and requested/completed snapshots; authenticated RPCs; active workspace, chart view/update and chart status checks; locks work items and chart; updates PO work-item revisions | Scope-aware storage and atomic apply; server eligibility/terminal-state guards; all-category snapshots; preserve old PO meaning |
| `src/features/chart/order-execution-domain.ts` | Category and execution destination differ. `system_exam`, chart-only and billing-only paths can complete immediately | Derive instruction scope from confirmed order category, not queue name; settle immediate-completion policy |
| `src/features/fulfillment/instruction-contract.ts`, `server-instruction.ts` | Shared instruction document currently covers dispensing/treatment; PO data is optional; no explicit latest-instruction acknowledgement | Add scoped instructions and acknowledgement status without granting chart-edit permission to performers |
| `src/features/dispensing/components/oral-instruction-infobar.tsx` | Text and local hidden revision; empty text returns null; no compare/acknowledge flow | Existing Info bar gets `변경됨` / `변경 내용 확인`; support deletion-only changes and reopen after × |
| `supabase/migrations/20261031120000_instruction_review_fixes.sql` | Claim/start/item/resume/completion permissions and requester exceptions; direct result completion and generic transitions are separate paths | Enforce acknowledgement in every effective start/complete path, including implicit starts; preserve actor and requester rules |
| `src/features/fulfillment/server-fulfillment-work-item-core.ts`, `server-execution-result-core.ts` | Call `clair_transition_fulfillment_work_item` and `clair_record_order_execution_result` | Guard at authoritative RPC boundary, not only UI; verify lab/imaging callers as well as instruction workspace |
| `src/features/notifications/server-notification-persistence.ts` | Persisted notification gateway exists | Add server-derived instruction-change producer and recipient/source resolution |
| `src/features/notifications/server-notifications-core.ts` | Defaults include demo event/state stores | Explicitly select persisted production path; demo success is not delivery evidence |
| Notification SQL: `20260705133000_notification_event_persistence.sql`, `20261003090000_notification_waiting_threshold_idempotency.sql` | Event allowlist, emitter permissions, active recipients, workspace route validation, unique scope/dedupe key; latest wrapper delegates non-waiting events to legacy writer | Add exact event/producer support. Existing generic emitter does not by itself implement instruction delivery; preserve waiting/order-set behavior |
| `src/shell/use-shell-notification-navigation.ts` | Read action and destination navigation | Instruction notification must navigate safely; read remains separate from acknowledgement |
| `src/components/emr/dialog-shell.tsx`, `src/components/ui/dropdown-menu.tsx` | Dialog exposes feature styling slots; wide-form defaults 680px; menu uses Base UI | Feature-only 560px fixed-size override; same-width anchored menu using installed component contract |

Relevant existing tests include `tests/dispensing-instruction-contract.spec.ts`, `tests/dispensing-instruction-review.spec.ts`, `tests/fulfillment-work-item-server.spec.ts`, `tests/fulfillment-assignee-server.spec.ts`, `tests/notification-persistence-contract.spec.ts`, `tests/notification-live-api-server.spec.ts`, `tests/sql/dispensing-instruction.sql`, and `tests/sql/instruction-review-fixes.sql`. They are starting points, not evidence that new behavior passes.

## Approved product rules to preserve

| Policy | Implementation invariant |
| --- | --- |
| D-01 | Later confirmed orders in the same chart receive latest overall + matching category instructions. Do not inherit across charts or rewrite historical snapshots. |
| D-02 / D-03 | All-completed and all-cancelled charts retain reads/history and reject ordinary writes. Preserve existing correction boundaries. |
| D-04 | Relevant changed versions require explicit user acknowledgement before effective start/complete. Same acknowledged version does not prompt again. ×, viewing, and notification read are not acknowledgements. |
| D-05 | Existing in-app notification only: one event per successful apply + chart + affected unfinished-task assignee. Exclude unrelated categories and completed work. |
| D-06 | New `조제 지시` applies to all dispensing-category orders, not PO only. Remove separate legacy copy UI; preserve historical PO scope/content/revisions/snapshots. |
| UI v45 | Centered scope chooser with retained icon box; outline secondary buttons; no header explanation/divider; 4px input top padding; stable 560×560 dialog; body scroll; inline transparent dashed add area and equal-width menu; history left and disabled when absent. |

## Local implementation architecture

PR-012 now implements the authoring entry, scoped read/save RPCs, performer review, transition guards, immutable snapshots and atomic in-app notifications. Migration `20261101140000_overall_instructions.sql` is verified locally, not applied remotely. Exact evidence and limits are in the work item.

Private stores: `chart_instruction_revisions`, `chart_instruction_applies`, `task_instruction_snapshots`, and `chart_instruction_acknowledgements`. Chart RPCs: `clair_get_overall_instructions` and `clair_apply_overall_instructions`. Task/order review and acknowledgement use `/api/workspaces/[workspaceId]/fulfillment/instruction-review`; persisted order targets cover immediate confirmation before task creation.

All chart wrappers acquire the encounter ownership advisory before encounter/chart/work row locks. The actual start/completion writers enforce the actor's version vector, including immediate completed task INSERT. Requests and completions capture immutable content; no snapshot backfill infers missing history.

### Data model and read contract

Use a chart instruction aggregate keyed by workspace + chart, with an append-only revision stream per scope (`overall` or canonical order category). Keep an apply record shared by all revisions in one transaction. A scope revision records body or tombstone, actor, server time, and prior revision. Preserve source provenance for legacy PO records; never relabel them as historical all-dispensing instructions.

Represent the effective instruction version as the relevant overall revision + category revision, including deletion revisions. Do not use the aggregate apply sequence as the only acknowledgement identity: an unrelated category edit must not invalidate another category's confirmation.

Store immutable requested/completed snapshots with task/request-cycle identity, applicable scope versions, content, and historical applicability. Derive current instructions separately. A record with no historical snapshot must remain distinguishable from a snapshot of empty instructions.

Persist explicit acknowledgement against workspace + chart + actor + applicable scope-version vector. Bind task authorization and request cycle when reading/writing it; revalidate effective versions at transition time. The approved actor/chart/relevant-version policy reuses acknowledgement across applicable tasks. Do not let another actor's acknowledgement satisfy the current performer's obligation without an approved policy.

Read responses need scope eligibility, current bodies, versions, last applied metadata, history presence, editability and reason, plus current effective instructions/acknowledgement state for authorized task reads. Avoid giving performers the whole chart/history merely because their work item is visible.

### Atomic save and recovery

Implemented chart route: `/api/workspaces/[workspaceId]/chart/charts/[chartId]/overall-instructions`. Request: `commandId`, explicit changed scopes, each expected revision and `set`/`delete` intent. Do not infer deletion from an omitted scope. Use server-defined scope membership, actor, and timestamps.

1. Authenticate active workspace membership and existing chart permissions. Validate chart relationship, target confirmed orders, signed/terminal state, allowed scopes, lengths, and explicit deletion rules.
2. Acquire a documented consistent lock order across chart/apply/work items. Reconcile with the existing PO writer and lifecycle locks; do not introduce a chart-first/work-item-first inversion.
3. Compare expected revisions for all changed scopes. Return conflict details without writing any scope. Unchanged unrelated scopes should not be overwritten.
4. Append changed revisions and one apply result atomically. True no-op saves create no clinical revision or notification.
5. Record notification delivery intent in the same transaction (or insert the final in-app events atomically when recipient rules permit). A post-response client call alone is insufficient.
6. Return authoritative current values and a stable apply identity. A command result lookup/replay returns the original outcome; the same ID with a different payload is rejected. Unknown network outcomes keep drafts and reconcile before retry.

Keep `no-store`, abort/context guards, and stale response checks. Switching chart/workspace must prevent late responses from replacing another chart's content, toast, or focus. Preserve all drafts on failure/conflict; require explicit reconciliation before resubmission. Do not reuse the current single-string editor's reload behavior if it discards the user's draft.

### Performer reads and transition enforcement

Reuse the existing Info bar and instruction workspace where present. Introduce a shared read/compare/acknowledge model, then adapt each real module. Dispensing/treatment integration does not prove lab/imaging support. Resolve consultation/external-lab/hospitalization/other/system-exam ownership explicitly; unsupported modules remain documented gaps rather than synthetic success.

The comparison dialog records acknowledgement only on `최신 지시 확인`. A stale comparison must return latest-version conflict, not confirm unseen changes. Show a meaningful deletion change even when current body is empty. Closing the bar hides its display only; new relevant revisions show it again. Provide a reopen path for the current revision.

The authoritative transition transaction must compare current effective versions with the actor's recorded acknowledgement. Audit `claim` if it starts work, `start`, `start_item`, `resume`, `complete`, `complete_all`, direct result completion, and generic work-item transitions. Keep existing permissions and requester-completion exceptions. An API bypass must fail identically to the UI. Starting/completing after a new edit during acknowledgement must require the new version.

### Notifications

Add a dedicated instruction-change event type to TypeScript and SQL allowlists, with a server-owned producer. Use stable dedupe identity `(workspace, chart, applyId, recipientUserId)` across all changed scopes and tasks. Read assignees and affected unfinished tasks from authoritative data; never accept arbitrary recipients from the browser.

Use a durable delivery-intent record if notification processing is separate from the save transaction. Retry delivery without replaying the clinical change. Do not report a saved instruction as unsaved because delivery is delayed. Existing waiting-threshold idempotency is specific and must not be assumed to cover this event.

Choose an authorized destination from the affected tasks. Notification payloads should carry minimal identifiers and safe labels, not full clinical instruction text. Recheck access on navigation. Preserve notification read as its own state. Do not add external email/SMS/provider calls.

### Legacy PO transition

Use additive schema/read adapters first. Preserve original rows and snapshots. Keep old readers valid while new readers are rolled out; prevent old and new writers from diverging on separate current values. Retire the old entry only after the replacement and all required readers are verified.

The approved cutover preserves current PO-only applicability until an authorized veterinarian explicitly applies the content as a new dispensing instruction. No automatic backfill or historical scope expansion is implemented. Old request/completion snapshots remain frozen. The isolated synthetic rehearsal covers explicit promotion and history preservation; remote migration remains separately gated.

Rollback must retain append-only history and any new instructions. Disable new writes via the approved release mechanism if needed, retain compatible reads, and reconcile before reenabling. Do not define rollback as dropping new data or silently reopening an incompatible old writer.

## Implementation stages and exit criteria

The user authorized the local stages and isolated synthetic verification under PR-012. These stages are implemented and locally verified; remote execution and release retain their own gates.

| Stage | Scope and owners | Dependencies | Observable exit |
| --- | --- | --- | --- |
| 0. Close product gaps | PRD decisions and schema/API contract; confirmed-order category mapping and terminal semantics | Open decisions below | Decision record names affected populations and transition rules; no inferred clinical behavior |
| 1. Persistence and migration rehearsal | New contract/server route, additive migration, synthetic fixtures; preserve existing oral-instruction API boundary | Stage 0 material data decisions | Atomic multiscoped save, conflicts, replay, isolation, snapshots and legacy preservation pass API/SQL tests |
| 2. Authoring UI | New feature editor/hook/history components, `module.tsx` entry; existing dialog/button/menu/textarea primitives | Stage 1 reads/writes | v45 states, session drafts, error recovery, fixed geometry, successful reopen and relevant Storybook stories verified |
| 3. Performer integration | Fulfillment instruction contracts/readers, existing Info bar, lab/imaging and other confirmed owners, acknowledgement RPC, transition guards | Stages 0–1 | Every actual start/complete path rejects unseen latest changes; per-actor confirmation, deletion-only changes and historical snapshots verified |
| 4. In-app notifications | Dedicated producer, persistence/allowlists, shell navigation and dedupe tests | Stage 1 apply identity; recipient decisions | One event per apply/chart/recipient, durable retries, authorized destinations, no read-to-ack coupling |
| 5. Integration and delivery candidate | Combined fixtures, app usage/stories, migration dry run, release evidence and rollback instructions | Stages 1–4 | Required checks pass; candidate SHA and known gaps documented. Request any remaining remote/release approval only with concrete evidence |

A stage passing does not make the whole feature production-ready. Keep incomplete paths inaccessible until the end-to-end boundary is correct; do not ship a client-only acknowledgement gate as completed D-04.

## Resolved implementation details and delivery preconditions

| ID | Gap | Proposed handling / blocking scope |
| --- | --- | --- |
| D-07 | Empty field layout across refresh | Keep it in the edit session; do not create clinical versions. Persisting layout is not required for initial implementation unless requested. |
| D-08 | Readding overall inserts at top but scrolls to bottom in prototype | Readded fields append and receive visible focus; this is an edit-session layout choice. |
| D-09 | Directly clearing saved text versus explicit delete; whitespace normalization | Implemented explicit delete/undo and tombstones; whitespace-only content is rejected consistently with browser trimming. Clearing saved text cannot silently delete it. |
| D-10 | Role versus `chart:update`, category mapping, `system_exam`/no-task paths | Canonical chart/queue permissions and task categories are preserved. Chart-only V1 confirmation and V2 actual results are covered; no new role policy or absent module is introduced. |
| P-01 | Mixed completed/cancelled chart; only terminal work in one category; later new confirmed work | D-02/03 cover homogeneous terminal cases. Approved 2026-11-01: mixed terminal/no unfinished orders is read-only; new confirmed unfinished work restores editing. |
| P-02 | Legacy current PO content cutover to all dispensing | Approved 2026-11-01: keep PO-only meaning until explicit veterinarian apply; retain provenance. |
| P-03 | Unassigned tasks, reassignment race, multiple target pages | Reuse active item assignee and set main assignee; exclude unassigned/terminal/unrelated work. Dedupe per apply/chart/recipient and navigate to a relevant current item with its Seoul date and actual selector. |
| P-04 | First instruction versus changed instruction, assignment changes, immediate completion, requester completion, cross-task acknowledgement reuse | Approved 2026-11-01: actor/chart/relevant-version acknowledgement may be reused across tasks; preserve requester completion and existing role authority. |

The policy questions required for local implementation are resolved. Hosted migration application, authenticated smoke and release remain separately gated. Routine component/file choices and validation commands remain engineering decisions.

## Verification plan

The integrated local implementation has layered evidence in [PR-012](../../work/clinical-fulfillment/CLINICAL-FULFILLMENT-PR-012-overall-instructions.md). The table below records the intended coverage; PR-012 distinguishes actual passing evidence from full migration replay and hosted/browser limits.

| Layer | Required evidence |
| --- | --- |
| Contract/unit | Scope eligibility, no-op, explicit delete, 5,000-character boundary, version vectors, same/different scope conflicts, deterministic recipient grouping |
| API + isolated SQL | Unauthorized/other workspace/other chart requests, signed/terminal targets, atomic rollback, duplicate command and payload mismatch, late cancel/confirm races, concurrent lock behavior |
| Historical data | Later confirmation captures latest; old PO records remain PO; request/completion snapshots never rewritten; repeat migration/replay creates no duplicates |
| Performer state | Unacknowledged start/complete rejected at every RPC entry; acknowledge then new edit is rejected; different actor not implicitly acknowledged; X/read/compare-open do not acknowledge |
| UI/Storybook | Empty chooser, saved scopes, no history, deleted current with history, read-only, loading/error/retry, pending deletion/undo, long content, same-width dropdown, mobile/keyboard/focus |
| Persistence UX | Double click, failure, response loss, successive edits, conflict and reconflict, refresh/reopen, chart/workspace switch during load/save; draft retained and unrelated context unchanged |
| Notification | Multi-scope/multi-task dedupe, no event for no-op/failed apply, retry after worker failure, excluded completed/unrelated tasks, safe current destination, notification read separate from acknowledgement |
| Regression | Existing set/item instructions, requester and assignee authority, task outcomes, structured doses/units, billing/payment values, old reader compatibility |

During implementation, inspect each test's targets and effects first. Run focused tests from `package.json`/Playwright config, type checks (`npx tsc --noEmit`), lint, applicable Storybook browser tests, and `npm run docs:check`. Run build when integrating the feature. Use only synthetic fixtures and the approved isolated database. A mock session does not establish live authorization; record API/SQL/browser evidence separately. Remote migration, main merge, production deployment and alias changes follow the release skill and explicit target/scope approval.

## Earlier documentation delivery evidence

- Prototype v45: input section top padding 4px; browser measured dialog 560×560px after scope selection. No application source was edited for this request.
- PRD and screen specification updated to v45; earlier UI decisions were replaced where later user choices superseded them. D-01–D-06 remain preserved; unresolved policy and prototype gaps are explicit.
- `npm run docs:check` passed (1,284 docs/agent markdown files). `git diff --check` and focused checks of all three documents passed; relative links resolve and both prototype SHA-256 values match. No application test pass is claimed by this plan.
