---
type: design-contract
title: SOAP document editor
description: Approved single-row SOAP toolbar and private attachment behavior.
status: implemented
related_work: CHART-PR-040
updated: 2026-09-22
---

# SOAP document editor

Approved through iterative HTML v7 review and implementation request on 2026-09-22. The existing scoped SOAP document and empty S/O/A/P section defaults remain authoritative; this changes editing controls, not clinical observations.

## Toolbar

- One fixed row; the body scrolls independently. Use existing EMR semantic tokens and shared button/menu/tooltip conventions.
- Neutral icon color for every action. Active formatting uses a selected background; unavailable actions use disabled styling and cannot execute.
- Every icon has an accessible name and hover/focus tooltip. Escape dismisses menus/tooltips with focus returned appropriately.
- Keep high-priority writing actions and photo/video entry visible as space permits. Move remaining actions to the final overflow button, never wrap or shrink all targets to fit.
- Overflow includes icon + Korean label, the same enabled/pressed state and command behavior, keyboard access, and no duplicate action. Wider panels restore original placement.
- Remove floating selection toolbar, left block add/drag controls and slash-command popups. Preserve normal document editing, headings/lists, links, keyboard shortcuts and existing stored blocks.

## Writing aids and records

- Insert blank-field writing aids into the active writing context without replacing existing text or inventing observed normal findings.
- Record insertion is explicit selection of available encounter/patient-scoped history or measurements with date/source. Do not insert mock fallback values during live loading/error or retain another encounter's items after switching.
- Existing diagnosis-system tabs and read-only encounter/permission rules remain in force. Optical-exam control is a named entry only, with a truthful unavailable explanation until its panel is implemented.
- Table insertion creates a native 2 × 3 table. Persisted tables are limited to 20 rows, 10 columns and 100 cells; merged cells and unsupported structures are rejected. Cell text contributes to the existing SOAP text projection. Table manipulation handles are hidden for this initial bounded version.

## Attachments

- The user explicitly included real private image/video persistence in the local implementation scope.
- Upload authorization, stable storage metadata, finalization, and read access are bound to workspace + encounter and existing chart permissions. A pending/failed upload must not enter the canonical SOAP document or block text saving.
- Do not send large videos through a Vercel function request body. Use a server-authorized direct private-storage upload and verify the stored object before finalization.
- Store stable authenticated attachment references, never browser blob URLs, data URLs, or expiring signed URLs. Resolve private read access at request time.
- Show progress, failure reason, retry, cancellation and completed attachment state. Failures preserve document text; retry must not create duplicate inserted blocks.
- Attach one file at a time, with an optional manually entered date and description. Multiple dropped files are rejected with guidance rather than silently dropping extras.
- Current implementation limits are bounded defaults (JPEG/PNG/WebP images up to 5 MiB; MP4/WebM videos up to 20 MiB) pending product acceptance. Validate bytes and metadata, not only filenames. Duration limits are not claimed unless validated.
- No public bucket or unauthenticated read. Removing an attachment from one draft must not destroy files referenced by another saved record; remote destructive cleanup is outside this change.

## Storage and operational contract

- The additive migration is `supabase/migrations/20260922090000_chart_soap_private_attachments.sql`, after the existing SOAP V1/V2 migrations. No new package dependency is required.
- `chart-soap-attachments` is private. The session client authorizes a pending path; the server verifies size, content type and format signature, then promotes verified bytes to a distinct immutable final path using a server-only `SUPABASE_SERVICE_ROLE_KEY`.
- Missing privileged storage configuration fails POST before upload begins. Never put this key in a browser/public environment variable. GET remains scoped by the current authenticated session and chart permission.
- The stable application reference redirects to a 60-second Storage read URL with `private, no-store`. Existing bearer read URLs can remain valid for that short lifetime; revocation does not retroactively revoke an already issued URL.
- A transaction rechecks author permission and writable encounter state before finalization, records the upload audit, and rejects direct SOAP references to pending, missing, cancelled or foreign attachments.
- Cancellation retains an immutable tombstone: existing signed upload tokens may still recreate pending bytes, but cannot expose them through the chart or change finalized content.
- `scripts/reconcile-soap-attachments.mjs` is a bounded, manual service-only maintenance command, dry-run by default. On an authorized target, `--apply` tombstones stale pending rows, then removes expired temporary bytes after a three-hour grace period. Completed final bytes are retained. Repeated batches skip already cleaned rows. No scheduled cleanup or remote application is included in local implementation.
- Finalized files not yet referenced by a saved note remain tracked. This change does not automatically delete completed attachments when a draft, tab or browser closes.

- New saves explicitly declare `editorCapability: media_table_v1`. The API never upgrades an old request implicitly. A database row guard blocks old writers when either the stored or incoming document contains media/table blocks; current editors can intentionally remove them. Retain this guard when rolling application code back.

## Verification boundary

Design approval is not proof of BlockNote selection/IME behavior, persistence, RLS, or deployment. Verify real editor focus/undo/readonly/overflow, synthetic private upload/readback, and save/reload separately. Production readiness also requires the migration and application deployment gates; do not claim those from local checks.

## Pattern sources

- [Fluent toolbar overflow](https://fluent2.microsoft.design/components/web/react/core/toolbar/usage)
- [SAP toolbar prioritization](https://experience.sap.com/fiori-design-web/toolbar-overview/)
- [BlockNote static toolbar](https://www.blocknotejs.org/examples/ui-components/static-formatting-toolbar)
- [Vercel function limits](https://vercel.com/docs/functions/limitations)
