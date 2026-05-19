---
title: "Live MVP Audit Review Surface"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-86"
  - "docs/work/audit-security/AUDIT-SECURITY-PR-005-live-audit-review-surface.md"
---

# Live MVP Audit Review Surface

Linear: DEN-86
Project: `05 Audit, Security & MVP Readiness`

## Summary

DEN-86 adds a minimal hospital-admin audit review surface for the live MVP.

Hospital admins can open `병원관리 > 감사 로그` to review workspace-scoped audit events. The surface shows timestamp, event/action label, actor, target, and a safe summary. It uses the DEN-84/85 audit event contract and does not expose full SOAP/chart bodies, raw payloads, secrets, export/download tools, analytics charts, retention policy UI, or real data.

## Entry Point

- Module: `병원관리`
- Side panel item: `감사 로그`
- Component: `src/features/hospital-admin/module.tsx`

## Server Boundary

Route:

- `GET /api/workspaces/[workspaceId]/audit/events`

Server reader:

- `src/features/audit/server-audit-event-review-core.ts`
- `src/features/audit/server-audit-event-review.ts`

Local-first DB read RPC:

- `supabase/migrations/20260520130000_live_mvp_audit_event_review_rpc.sql`
- `public.clair_list_audit_events(...)`

Access control:

- Mock/demo route requires active `hospital_admin` via `role_permission:manage`.
- Supabase RPC requires `private.clair_is_workspace_admin(p_workspace_id)`.
- Non-admin users receive a denied state, not an empty success.

## Minimal Filters

- Search by actor, target, encounter, request id, or event text.
- Event type filter for the core DEN-85 event types.
- No export/download, analytics, retention policy, or external compliance dashboard.

## Verification

- `npx playwright test tests/audit-review-surface.spec.ts --reporter=line`
- `npx playwright test tests/auth.spec.ts --reporter=line`
- `npx tsc --noEmit`
- `npm run build`
- `npm run docs:check`
- `npm run security:secrets`
