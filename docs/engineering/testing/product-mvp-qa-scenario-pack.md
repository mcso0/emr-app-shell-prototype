---
id: ENGINEERING-TESTING-PRODUCT-MVP-QA-SCENARIO-PACK
status: approved
area: engineering
doc_type: qa-pack
related_work:
  - DEN-181
supersedes: []
superseded_by: []
last_updated: 2026-07-16T00:00:00.000Z
---

# Product MVP QA Scenarios

This pack defines human-readable QA scenarios for reviewing Product MVP behavior. It complements automated tests; it is not a replacement for focused regression.

## Scenario 1: Approved Workspace Entry

Goal: confirm a user enters only an allowed workspace.

Checks:

* user can sign in through the scoped auth mode
* workspace selector shows only active memberships
* route/mutation denial is safe for missing or inactive membership
* role label is explanatory but not treated as security completion

## Scenario 2: Reception To Encounter

Goal: create or restore the outpatient visit path.

Checks:

* find or create guardian/patient using synthetic data
* create appointment or walk-in reception
* check-in creates encounter
* queue and calendar show consistent state
* reload checkpoint preserves local-first state where claimed

## Scenario 3: Chart And Order

Goal: verify clinical workflow continuity.

Checks:

* vet opens encounter
* SOAP draft/autosave/sign behavior is understandable
* diagnosis and order draft/confirmation are linked to encounter
* unauthorized role cannot mutate chart
* order appears in the relevant operational queue

## Scenario 4: Result Or Work Completion

Goal: verify order execution handoff.

Checks:

* technician or allowed user starts/completes assigned work
* result/manual output can be entered where scoped
* vet review requirement is visible or explicitly out of scope
* cancellation/correction path records reason or remains blocked

## Scenario 5: Billing Closure

Goal: verify invoice and payment-state integrity.

Checks:

* billable candidates flow from chart/order
* invoice line edits recalculate server-side where local-first is claimed
* unpaid or paid closure updates encounter appropriately
* client tampering cannot change trusted totals
* refund/payment provider behavior is not falsely claimed

## Scenario 6: Audit And Admin Review

Goal: confirm important mutations are reviewable.

Checks:

* workspace/member, reception, chart, order, billing, and denial events have event paths where scoped
* hospital admin can review safe event summaries
* audit payload does not expose secrets, tokens, raw provider payloads, or unnecessary sensitive data

## Scenario 7: Mock/Live Claim Review

Goal: prevent false launch claims.

Checks:

* scenario states mock/session-only, local-first, remote staging, or production/live
* remote/live work has explicit approval if mentioned
* real data, email, payment, provider, and production claims are absent unless approved

## Scenario 8: Staff Profile Side Panel V2

Goal: verify the non-modal staff profile flow, truthful live sources, self-service controls, and workspace isolation with synthetic/demo data only.

Checks:

* desktop uses a detached 380px panel with a 10px gap; narrow/mobile uses a full-width non-modal panel without backdrop, blur, focus trap, or background `inert`
* exactly `프로필` and `업무 현황` tabs remain visible and usable at 200% zoom-equivalent width, with long names, status text, and contact values
* keyboard open/close, `Escape`, menu/dialog focus return, loading, empty, partial error, retry, and pagination states are distinct
* published schedule, workspace status, Presence/last-seen, private avatar, and assigned fulfillment work come from their approved live sources without runtime dummy fallback
* active same-workspace members can read the approved projection; status/avatar mutation is self-only; other-user, inactive, anonymous, and cross-workspace access is denied by API plus DB/RLS/Storage boundaries
* JPEG/PNG/static WebP avatar validation, private direct upload, normalized signed read, pointer restore, and object cleanup pass without exposing bytes, tokens, URLs, or private metadata
* the transaction replay creates synthetic schedule/status/activity/assigned-work rows, proves read and denial paths, rolls back, and confirms zero retained probe rows; Presence untracks and Storage removes every probe object
* the deployed commit equals the final merged `origin/main`, and authenticated production smoke repeats profile/work/status/avatar/Presence checks against existing synthetic/demo identities only

## Pass/Blocker Policy

Blocker:

* cross-workspace data exposure
* unauthorized mutation
* core outpatient state lost after claimed reload path
* billing total cannot be trusted
* secret or real data appears in docs, logs, reports, or UI

Follow-up:

* unclear copy
* missing polish
* additional regression that improves confidence but does not block safe review

Post-MVP:

* provider integrations
* broad analytics
* full migration tooling
* production operations hardening

## Related Docs

* [Outpatient Workflow State Model](../../product/domain/outpatient-workflow-state-model.md)
* [Product MVP Scope](../../product/roadmap/product-mvp-scope.md)
* [MVP Pilot Readiness Criteria](https://github.com/mcso0/emr-app-shell-prototype/blob/main/docs/engineering/auth-security/auth-login/mvp-pilot-readiness-criteria.md)
