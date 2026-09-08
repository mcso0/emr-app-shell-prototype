---
id: PRODUCT-DOMAIN-ENCOUNTER-MULTI-CHART
status: approved
area: product
doc_type: domain-contract
related_work:
  - CHART-PR-037
last_updated: 2026-09-09
---

# Multiple Charts Within One Encounter

This is the target behavior authorized on 2026-09-09; delivery evidence belongs to CHART-PR-037. It does not claim deployed support.

## Identity and Time

An encounter remains one reception/visit episode. A chart is an independently authored SOAP note within that encounter. Reuse `soap_notes.id` as chart identity; retain the canonical V2 system scopes inside each note. A system scope is not another chart.

`+ 새 차트` creates a blank draft and selects it without creating an encounter, queue entry, order, or invoice. Creation is allowed only for `in_consultation` and `ordered` encounters. A retry with the same creation request ID returns the same note. The clinical timestamp defaults to now and is stored separately from immutable creation time. Crossing midnight does not change encounter identity. Display times in the workspace timezone (existing Korean workspace convention); visit counts remain encounter counts.

## Clinical Records

- SOAP content and optimistic revision belong to the selected chart.
- Signed charts require an amendment reason; retain the prior document and actor/time/reason before accepting a correction. Do not silently reopen a signed chart on autosave.
- Diagnoses remain encounter-owned with stable IDs. A chart records the diagnoses it assessed and preserves its recorded assessment/status independently of later encounter diagnosis updates/retirement.
- Orders retain encounter ownership for execution and billing and an immutable originating chart. Set descendants inherit their root's origin. Changing details, revisions, assignment, cancellation, or actual execution must not move the origin.
- A new chart never clones prior orders. The UI distinguishes selected-chart orders from encounter-wide orders; mutation must validate the actual owner regardless of display filtering.
- Results remain order-owned. Reviewing a morning result in an afternoon chart does not move the order; the afternoon SOAP can record the interpretation.

## Completion

`차트 완료` signs only the selected note. It does not sign another draft, close a queue, or create billing work. Encounter-level `진료 종료` is separate and rejects unfinished draft/autosaved charts with an actionable message. Users must explicitly complete each unfinished chart before ending the encounter. Adding/reopening charts in `ready_for_billing`, `completed`, or `cancelled` encounters is excluded from this slice.

## Persistence and Compatibility

Existing SOAP IDs, documents, authors, timestamps, and revisions remain intact. Do not fabricate notes for encounters without SOAP. Existing orders without provable chart provenance remain labeled as encounter legacy records, never assigned by guessed timestamps. Legacy encounter-only writers must reject ambiguous multi-chart access instead of selecting the newest record. Chart-specific requests validate workspace, encounter, chart, user, permission, and expected revision at the database boundary and record audit atomically.

After multiple notes exist, rollback means disabling new creation while preserving chart-aware reads/writes and data. Restoring the old encounter unique index is not an acceptable rollback.
