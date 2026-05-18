---
id: ENGINEERING-AUTH-RECEPTION-QUEUE-READ
status: implemented
area: engineering
doc_type: api_boundary
related_work:
  - "DEN-62"
  - "docs/work/reception/RECEPTION-LIVE-PR-009-reception-queue-read.md"
supersedes: []
superseded_by: []
last_updated: 2026-05-19
---

# Reception Queue Read

Updated: 2026-05-19
Linear: DEN-62
Project: `03 Reception & Encounter Persistence`

## Summary

DEN-62 adds the first persisted read boundary for the reception queue and side panel.

The new route reads workspace-scoped waiting queue rows plus linked encounters and can hydrate the reception side panel state from a server response. Mock demo fixtures remain the fallback for local demo mode.

## Boundary

Route:

- `GET /api/workspaces/[workspaceId]/reception/queue`

Server modules:

- `src/features/reception/server-reception-queue-read.ts`
- `src/features/reception/server-reception-queue-read-core.ts`
- `src/features/reception/reception-queue-read.ts`

The route follows the Project 02/03 read pattern:

1. Resolve actor identity with `readServerSession()`.
2. Allow demo actor headers only in mock fallback mode.
3. Check active workspace membership and `reception:view`.
4. In mock mode, return an empty persisted overlay so existing demo fixtures remain visible.
5. In Supabase mode, call the local-first reader function.
6. Return typed `{ ok, status, queue, enforcedBy }` or stable denial/error values.

## DB Reader

Migration:

- `supabase/migrations/20260519140000_reception_queue_reader.sql`

Function:

- `public.clair_list_reception_queue(p_workspace_id, p_limit)`

The reader:

- requires `private.clair_is_active_workspace_member(p_workspace_id)`
- reads `waiting_queue_entries` joined to `encounters`
- filters to consultation/billing queue rows and active operational encounter states
- orders waiting rows first, then `sort_order`, then `entered_at`
- returns camelCase JSON for the Next.js route adapter

## UI Connection

`ReceptionContent` loads the queue route and calls `applyPersistedReceptionQueue(...)` on success.

The reception store keeps persisted queue rows separate from session-created rows through a `source` tag, replaces the previous persisted overlay on reload, and preserves local session/mock behavior. The side panel exposes compact loading/error states while the route is being read.

## Out Of Scope

- Calendar persisted read conversion.
- Chart, SOAP, order, billing, audit, provider, file storage, or payment persistence.
- Queue status mutation.
- Final domain RLS policy SQL.
- Remote Supabase link/push.
- Real patient, guardian, hospital, clinic, or staff data.

## Verification

- `npx playwright test tests/reception-queue-read-server.spec.ts --reporter=line`: 5 passed
- `npx playwright test tests/reception.spec.ts -g "server-backed reception queue read" --reporter=line`: 1 passed
- `npx playwright test tests/reception.spec.ts --reporter=line`: 26 passed
- `npx tsc --noEmit`: passed
- `npm run build`: passed
- `npm run security:secrets`: passed
- `npm run docs:check`: passed

Broader final verification is recorded in the DEN-62 report:

- `docs/completed/reception/2026-05-19-den-62-reception-queue-read-report.html`
