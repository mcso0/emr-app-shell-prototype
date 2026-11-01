---
id: CLINICAL-FULFILLMENT-PR-012
title: Overall instructions implementation
status: human_review
area: clinical-fulfillment
priority: P0
last_updated: "2026-11-01"
---

# Overall instructions implementation

## Goal and authorization

User instruction: `구현 계획 세웠으면 구현 작업들어가고` (2026-11-01). Implement the linked plan locally, with relevant non-destructive verification. This authorizes application code, additive migration files, and isolated synthetic SQL/browser tests. It does not authorize remote DB changes, real data, real notifications, publishing, merge, or deployment. Record unresolved product decisions before dependent implementation.

Base: `e3b7923a05d160b240e6beb330121cd14b5b66cd` (`origin/main`). Work in the isolated `codex/overall-instructions` checkout; preserve the source checkout's unrelated WIP.

## Scope

- Multi-scope append-only instructions and atomic/idempotent saves; workspace/chart permissions, current state and conflict checks.
- v45 authoring dialog, current/history/delete/undo/retry behavior and focused stories.
- Effective task instructions, immutable snapshots, explicit acknowledgement and authoritative transition guards.
- Persisted in-app change notification producer, dedupe, authorized navigation.
- Synthetic fixtures and focused checks; no external data/provider writes.

## Sources

- [PRD](../../product/features/chart/overall-instructions-prd.md)
- [Screen specification](../../design/screens/chart/specs/overall-instructions.md)
- [Implementation plan](../../engineering/architecture/overall-instructions-implementation-plan.md)

## Done criteria

Approved behavior works through UI/API/DB with synthetic evidence. Required checks pass; limitations and remaining release gates are documented. Preserve role policy, historical PO applicability, existing task outcomes and billing values. Human review is separate from implementation completion.

## Product decisions approved (2026-11-01)

- Legacy PO text retains its original applicability until a veterinarian explicitly applies it as a new dispensing instruction. Preserve historical rows and snapshots.
- A chart with no unfinished confirmed orders is read-only, including mixed completed/cancelled orders. Newly confirmed unfinished work restores editing, subject to existing chart permissions/status.
- Reuse explicit acknowledgement for the same actor, chart and relevant instruction-version vector. Preserve existing requester completion rights; viewing, closing and notification reads do not acknowledge.
- Other plan gaps will be resolved from owning contracts or raised only when materially consequential.

## Local implementation and verification — 2026-11-01

The approved local implementation is ready for human review. It is uncommitted in `codex/overall-instructions`; no remote DB, PR, merge, deployment, real notifications or clinical data was changed.

### Implemented behavior

- The actual Plan/Order entry now opens the v45 authoring dialog. Multiple scopes save atomically with per-scope conflict checks, append-only changes/deletions, command replay, history comparison and failure recovery. The chart store's existing navigation guard includes unsaved instructions.
- The current legacy PO value appears in the same dispensing field. Viewing it is not a dirty edit. Applying it explicitly promotes the content to dispensing; the field explains that consequence. Old PO revisions and snapshots retain their original meaning, and the old writer is retired only after promotion.
- Dispensing/treatment, lab/imaging, actual-result dialogs and chart-only result entry share effective instruction reads and explicit review. X, dialog close, notification read and ordinary reads do not acknowledge. A deleted instruction remains a version requiring review. A later relevant version shows a hidden bar again. When only the overall instruction applies, the same actor can reuse that review across categories; a category revision or deletion adds its own version.
- The DB checks the actual actor's current version at instruction, generic transition, direct-result and chart-only result writers. Immediate completion at task INSERT also checks acknowledgement. Persisted order review supports confirmation before a task exists. Requester completion rights remain intact; amendments do not masquerade as new performance.
- Immutable request/completion snapshots retain task, attempt and request-cycle identity. Historical attempts remain readable after re-request; an outdated attempt cannot acknowledge. Missing historical evidence is shown separately from an empty-instruction snapshot. The read model also includes frozen old PO snapshots, labeled with their original applicability. The obsolete PO capture trigger is retired; its table and read API remain. No historical backfill invents prior instructions.
- One in-app event per successful apply/chart/recipient is inserted in the save transaction. Recipients are the existing active individual assignees and set main assignee, with terminal/unrelated tasks excluded. Unassigned work does not broadcast. Navigation includes the real queue selector and Seoul operating date. The actor and scope are rechecked by the destination's existing permissions.
- Chart wrappers, instruction saves, acknowledgement and performing work share the encounter ownership advisory before row locks. The old PO writer uses the same order. Review found and fixed lock inversion, wrong lab/imaging selection keys, omitted notification dates, historical-attempt reads and encounter editability mismatch.

### Verified evidence

| Check | Result and limits |
| --- | --- |
| Contract tests | `npx playwright test --config playwright.catalog-contract.config.ts tests/overall-instructions-contract.spec.ts`: 19 passed. Covers scopes, explicit delete, no-op, legacy promotion, UTF16 length, conflicts, replay payload identity, forged acknowledgement fields, task/order response identity and error mapping. RPC transport is synthetic. |
| SQL migration and writers | `node scripts/test-dispensing-instruction-sql.mjs --overall-instructions`: passed in a temporary network-disabled PostgreSQL container, removed afterward. Includes actual migration and canonical writer bodies, atomic rollback, no-op events, requester completion, direct/chart-only results, immediate completion, stale acknowledgement, historical attempts, signed/terminal/encounter state, private table/function ACLs and anonymous/authenticated role checks. |
| Concurrent SQL sessions | Passed stale acknowledgement versus apply; chart-wrapper versus apply lock ordering; completion snapshot versus later apply; existing concurrent claim regression. These are local transactions, not hosted performance measurements. |
| Actual component stories | 43 passed across authoring (11), task review (7), execution result (7), chart actual history (4), and lifecycle actions (14). Includes actual chart adapter/store navigation, explicit legacy promotion, close/X versus acknowledgement, double click, stale version recovery, deletion, late responses, failed reads and existing completion/amendment flows. |
| Static/build checks | Full `npx tsc --noEmit`, focused ESLint, Next production build, Storybook production build, docs check and `git diff --check` passed. The existing large chart module produces a Babel size notice; no lint errors or warnings remain. |
| Visual checks | Existing authoring dialog: stable 560×560px, 496px add trigger/menu, no document overflow at 320px. New review dialog: 288px width/scrollWidth at 320px viewport; no document overflow. Restored viewport after inspection. Screenshots stay local in `output/overall-instructions/`. |

One existing amendment story was timing-sensitive while typing a Korean reason. Its fixture now sends a controlled change event and asserts the complete value before saving; the combined run then passed. The final 43-story run also covers legacy PO snapshot display. The initial response-identity regression exposed duplicate task responses being accepted; the adapter now rejects duplicate/missing identities and the regression passes.

### Evidence boundaries and remaining delivery gates

- SQL tests use the real changed functions against an isolated structural fixture. Membership/permission, clinical-validation, billing and some list/context dependencies are synthetic; this is not a replay of the entire Supabase migration history or proof of hosted RLS parity.
- Browser evidence uses actual components and the chart navigation store with synthetic transport. No authenticated hospital workflow or production acceptance is claimed. Existing modules without a performing UI are not newly created by this work; instruction scope follows canonical order/task categories at the DB boundary.
- The candidate migration is `supabase/migrations/20261101140000_overall_instructions.sql`. It depends on the existing oral/instruction workflow migrations. A hosted read-only preflight, exact release candidate, approved migration apply and authenticated scoped smoke remain release work.
- Do not enable the app candidate against a database missing the migration. After the new guards or dispensing promotion are in use, a rollback to an app with no acknowledgement path is not a valid operational rollback. Retain an acknowledgement-capable app or roll forward; preserve all revisions, snapshots and acknowledgement records. No destructive down migration is proposed.
- Human acceptance is pending. No remote actions were required to finish the authorized local implementation.

### Follow-up reconciliation — 2026-11-01

The user reaffirmed all three recommended policies and requested remaining implementation/verification. Reconciliation found no pending local implementation stage. Updated stale pre-implementation approval/status wording in the PRD, screen specification and plan so it agrees with the implemented policy table and local evidence. No application behavior or delivery authorization changed. `npm run docs:check` passed for 1,082 docs/agent markdown files; `git diff --check` passed. Earlier application checks were not rerun because this follow-up changed documentation only.

## Authorized delivery — 2026-11-01

Direct user instruction: create the PR, apply the remote DB change and deploy, including only this overall-instructions feature while preserving existing WIP. This is bounded authorization for the feature PR, one scoped migration, exact-head main merge and Production delivery after required checks. No unrelated migration, data backfill, real clinical/provider action or paid-resource change is included.

Release preparation is in progress. Local screenshots and evidence remain outside the PR. The shared Supabase target is verified as the existing CLAiR demo project; its historical staging name does not imply Preview data isolation. Preview and Production smoke will use only existing documented synthetic context, with no instruction, order or notification writes. Remote migration preflight/readback use schema catalogs. Preserve old PO rows and snapshots.

## Earlier authoring checkpoint

Before the three policy decisions were answered, the standalone editor/API preparation passed 13 contracts and 9 authoring stories. At that checkpoint there was no RPC or app integration. The later implementation and evidence above supersede that partial state.
