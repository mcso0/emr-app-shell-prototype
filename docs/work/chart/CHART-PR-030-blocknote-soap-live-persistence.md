---
id: "CHART-PR-030"
status: "human_review"
area: "chart"
priority: "P0"
target_pr: "User-approved live BlockNote SOAP editor replacement"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/product/domain/outpatient-workflow-state-model.md"
  - "docs/engineering/data-model/emr-saas-db-structure-spec.ko.md"
  - "docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md"
  - "docs/engineering/auth-security/auth-login/live-mvp-audit-event-matrix.md"
  - "docs/work/chart/CHART-PR-029-blocknote-soap-editor-prototype.md"
dependencies:
  - "CHART-PR-026"
  - "CHART-PR-029"
updated: "2026-08-31"
---

# Live BlockNote SOAP Persistence

## Goal

Replace the live chart SOAP Tiptap editor with the approved BlockNote interaction while preserving the existing workspace, encounter, permission, optimistic-conflict, audit, and downstream clinical-read contracts.

## Approved Scope

- Store versioned BlockNote JSON as the canonical SOAP document.
- Keep `subjective`, `objective`, `assessment`, and `plan` as server-derived compatibility projections for chart history, preconsultation, and existing consumers.
- Hydrate legacy four-field notes into the default S/O/A/P BlockNote template without a destructive backfill.
- Switch the live SOAP panel to one continuous BlockNote document with its provided left add/drag controls, slash menu, and selection toolbar.
- Keep image, video, and optical-exam entries unavailable until their storage, permission, and device contracts exist.
- Preserve chart view/update permission checks, encounter lifecycle gates, optimistic `updated_at` conflict detection, and metadata-only audit events.
- Roll out in two compatible phases: add the V2 canonical-document writer while preserving the six-argument legacy writer, then deploy the application that calls V2.
- Prevent a stale legacy client from changing S/O/A/P projections after a note has acquired a canonical block document.
- Serialize autosaves so an older response cannot overwrite a newer local document, and preserve local content on errors or conflicts.
- Remove direct application Tiptap dependencies after the live editor no longer imports them. BlockNote's internal ProseMirror/Tiptap implementation remains an implementation detail.

## Out Of Scope

- Image/video upload, PACS, clinical attachments, or optical-device result ingestion.
- SOAP signing, amendment, revision history, collaboration, AI, comments, or paid BlockNote services.
- Remote Supabase migration execution and production deployment or merge until their separate release approvals are recorded.
- A destructive legacy-data backfill or changes to unrelated chart/order behavior.

## Document Contract V1

- Envelope: `{ schemaVersion: 1, blocks: BlockNoteBlock[] }`.
- Supported blocks: SOAP section marker, paragraph, heading, bullet list, numbered list, checklist, quote, and divider.
- A default SOAP section uses `scope: "default"` and one of `subjective`, `objective`, `assessment`, or `plan`.
- System templates use `scope: "system"`; they remain in the canonical document but do not overwrite the four legacy projections.
- The server rejects unsupported versions, unsupported block/inline types, duplicate IDs, invalid links, excessive depth/count/size, and a projected field over 10,000 characters.
- Reader responses omit `blockDocument` for legacy rows. The client then creates a BlockNote template from the legacy projection fields.
- Every new write requires a valid `blockDocument`; implicit legacy-shaped writes are rejected so they cannot erase canonical formatting or system-template content.

## Save and Failure Contract

| Case | Expected behavior |
| --- | --- |
| rapid edits while a save is in flight | coalesce pending edits and start the newest save only after the current response advances `expectedUpdatedAt` |
| stale `expectedUpdatedAt` | keep the local document, stop automatic retry, and show a conflict state |
| network/server failure | keep the local document and offer an explicit retry |
| write committed but its response was lost | retry with the same expected timestamp; on conflict, read the latest SOAP note and accept it as saved only when its canonical document exactly matches the pending local document |
| database audit append failure | fail the live SOAP writer transaction so the clinical mutation and audit evidence cannot diverge |
| encounter switch or unmount with pending edits | flush the encounter-scoped pending document without redirecting it to the next encounter |
| malformed/unsupported stored JSON | do not mount it in BlockNote; fall back to legacy projections and surface a recoverable warning |
| read-only/historical/completed chart | render BlockNote read-only and do not expose mutations |
| migration applied before the new application | preserve the six-argument legacy writer for legacy rows; expose the additive seven-argument `clair_save_chart_soap_note_v2` writer for the new application |
| stale legacy tab edits a canonical V2 row | reject with `soap_client_upgrade_required` so legacy projections cannot overwrite or diverge from the canonical document |

The authenticated database writer appends the metadata-only `chart.soap_saved` audit inside the same database transaction and returns its audit marker. The route does not duplicate a complete database audit. A missing or incomplete marker uses the route append boundary and fails closed if that append also fails.

## Review Remediations

- Require the canonical BlockNote document in both the application core and direct database RPC.
- Preserve a queued `manual_save` mode behind an in-flight autosave so note status and audit metadata match the user's action.
- Align JavaScript validation and SQL projection at the exact depth boundary: depth 4 is allowed and depth 5 is rejected.
- Validate direct-RPC save mode values, including explicit `null`.
- Return the written SOAP row directly from the writer so a custom `chart:update` role does not acquire an undocumented `chart:view` dependency.
- Append the SOAP audit from the direct RPC in the same transaction and let the route consume its complete marker instead of creating duplicate events. An incomplete database marker uses the route fallback, which also fails closed.
- Use the same explicit HTTP(S), `mailto:`, and `tel:` link grammar and forbidden Unicode whitespace/control set in JavaScript and SQL so malformed links cannot pass one boundary and fail at another.
- Count bounded strings as Unicode code points in the document validator, route core, and PostgreSQL, and preserve one explicit boundary-whitespace set through validation, projection, and response mapping so emoji, ASCII whitespace, or NBSP cannot create a stored-document parity failure.
- Give each write a request ID and reconcile an ambiguous response by canonical readback equality, preventing a committed write from becoming a false conflict after retry.
- Keep the existing six-argument writer signature and update-only behavior intact and move canonical writes to an additive V2 RPC, making migration-first rollout compatible. Application deployment remains gated on the V2 migration. A trigger permits legacy writes on legacy rows but rejects projection-only changes after canonical adoption.
- Reissue the six-argument writer with the same `chart:update` contract but return its written row directly, so an update-only custom role does not silently acquire the enhanced reader's `chart:view` requirement during the migration window.

## Done Criteria

1. The database migration adds a nullable V1 block document while preserving legacy fields and all current direct-call permission gates.
2. The server validates the canonical document and derives the four legacy projections before persistence.
3. The live chart renders one BlockNote document and no longer mounts `SoapRichTextEditor`.
4. Autosave is debounced and single-flight; failures and conflicts preserve local input.
5. Unsupported media/device actions remain non-mutating and clearly unavailable.
6. Existing live/mock route behavior, workspace boundaries, history/preconsultation projections, and audit metadata remain covered by focused tests.
7. Direct Tiptap packages are removed only after all direct imports are gone.

## Verification Plan

- Document validation/projection unit tests, including malicious links, duplicate IDs, unsupported blocks/versions, size/depth/count limits, and legacy hydration.
- SOAP persistence route/core tests for permission, workspace/encounter scope, conflict, stale encounter status, canonical RPC payload, and audit-partial-failure semantics.
- Migration source-contract tests for nullable columns, JSON/version constraints, derived projections, search path, grants, and revoked unauthenticated access.
- Focused lint and TypeScript checks, Storybook build, Next.js build, docs link check, secret scan, and `git diff --check`.
- Manual browser smoke of add/drag, slash templates, selection formatting, autosave status, reload hydration, read-only mode, error retry, and conflict preservation.

## Verification Evidence

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- Focused document, autosave, persistence, RPC, and migration-contract tests: 30 passed.
- `tests/sql/chart_soap_block_document_migration_compatibility.sql`: passed against local Supabase with the candidate migration inside a rolled-back transaction. It proves an update-only actor can use the legacy writer while the enhanced reader remains denied, V2 persists and revises canonical JSON with audit evidence, stale legacy overwrite is rejected without changing the canonical row, grants remain scoped, and no fixture or schema residue remains.
- Focused chart browser tests covering shell geometry, one-document BlockNote editing, selection toolbar, manual save/reload, committed-response-loss reconciliation, slash menu, system-template deduplication, growing content, resize behavior, and the representative chart flow: 10 passed.
- `npm run build`, `npm run build-storybook`, `npm run docs:check`, `npm run security:secrets`, and `git diff --check`: passed during this local implementation slice.
- The migration was executed against the isolated local Supabase PostgreSQL database inside transactions and rolled back. Runtime checks passed for direct-RPC canonical save/projection, database audit creation and marker, request ID, grant matrix, actor mismatch, missing permission, unavailable encounter, stale encounter status, legacy-write rejection, invalid/null save modes, exact depth-4 accept/depth-5 reject behavior, valid-link accept/malformed-link reject parity, explicit NEL/BOM link rejection, 10,000-code-point emoji accept/10,001 reject, 200/100/2,048-code-point ID/label/link boundaries, and explicit boundary-whitespace parity.
- `tests/queue-loading-state.spec.ts` remains red in 7 unrelated pre-existing source/geometry assertions (current 40px icon versus stale 32px expectation, retired loading copy, and stale source-string contracts). Three tests in that file pass; this slice does not change those unrelated product contracts.

## Known Follow-up

- The pre-existing public `clair_append_audit_event` RPC is executable by authenticated members and does not fully bind supplied actor, membership, event target, and encounter values to `auth.uid()` and one workspace. The new SOAP writer supplies verified values, but the global audit log can still receive forged direct append calls. Hardening that shared RPC or moving it behind a private/internal boundary changes the authorization architecture and requires a separately approved security work item.
- Encounter switch and React unmount flush the latest encounter-scoped document, but a browser tab/process termination can still end transport before completion. A stronger browser-close delivery guarantee requires a separately designed server queue, durable client outbox, or equivalent transport contract.
- Remote migration application, remote grant readback, production data verification, deployment, and merge remain unperformed and approval-gated. The safe forward order is migration first, then the V2-calling application.

## Rollback

- Application rollback can redeploy the prior version while leaving the additive migration in place. Legacy rows remain editable; rows already saved through V2 stay readable through their projections but reject legacy projection-only edits with `soap_client_upgrade_required` to protect canonical-only content.
- Restoring legacy editing for a canonical row requires a separately reviewed compatibility migration or dual-write path. Clearing canonical JSON would discard formatting and system-template content and is not an automatic rollback step.
- Leave the nullable JSON columns, V2 writer, and guard in place during ordinary application rollback. Dropping them is a separate destructive migration and is unnecessary for service recovery.
