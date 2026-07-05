---
id: "HOME-OPERATIONS-WORK-STATUS-READ-MODEL"
type: Engineering Contract
title: "Home Operations Work Status Read Model"
description: "Defines the implementation-facing API, read-model, source mapping, and failure-state contract for Home 원내 현황 operations work items."
status: implemented
area: engineering
doc_type: data-model
tags: [home, operations, api, read-model, work-status]
related_docs:
  - "docs/product/features/home/home-operations-work-status-contract-v0.md"
  - "docs/product/features/home/home-work-generation-rules-v0.md"
  - "docs/product/domain/order-fulfillment-handoff.md"
  - "docs/engineering/data-model/order-fulfillment-handoff-contract.md"
related_work:
  - "docs/work/home/HOME-PR-011-home-operations-live-work-items.md"
last_updated: 2026-07-05
---

# Home Operations Work Status Read Model

## Purpose

This document turns the product contract for Home `원내 현황` into the implementation-facing API and read-model contract.

Home operations must not derive hospital-wide work by merging mock data in the browser. The server must own workspace scope, permission filtering, source freshness, status normalization, and partial-read handling.

## Implemented In HOME-PR-011

The first implementation uses an additive Supabase RPC plus a Next.js read endpoint:

- RPC: `public.clair_list_home_operations_work_items(p_workspace_id, p_actor_user_id, p_operating_date, p_scope, p_include_completed, p_include_cancelled)`.
- API route: `GET /api/workspaces/[workspaceId]/operations/work-items`.
- Sources: appointments, reception/waiting queue entries, `order_fulfillment_work_items`, and billing invoice/invoice-line candidates.
- The route computes `isMyWork` from personal assignment plus processable team queues, and uses `scope=mine` to filter the response.
- The Home client uses this route for non-legacy workspaces and does not use mock fallback for read failures.

## Endpoint

Recommended first endpoint:

```text
GET /api/workspaces/[workspaceId]/operations/work-items
```

Query parameters:

| Parameter | Type | Default | Meaning |
|---|---|---|---|
| `date` | `YYYY-MM-DD` | workspace local today | Selected operating date. |
| `scope` | `all` \| `mine` | `all` | `mine` includes personal assignments plus processable team queues. |
| `includeCompleted` | boolean | `false` | Include completed work in response. |
| `includeCancelled` | boolean | `false` | Include cancelled work in response. |

Future filters such as `sourceTypes`, `teamQueueIds`, and `assigneeUserId` should be added only after the first aggregate API is stable.

The endpoint is read-only. Home mutation actions remain out of scope.

## Response Envelope

```ts
type HomeOperationsWorkItemsResponse = {
  ok: true;
  workspaceId: string;
  operatingDate: string;
  sourceStatus: "live" | "partial" | "empty";
  items: HomeOperationsWorkItem[];
  summary: HomeOperationsSummary;
  accessIssues?: HomeOperationsAccessIssue[];
  generatedAt: string;
} | {
  ok: false;
  workspaceId: string;
  operatingDate: string;
  sourceStatus: "permission_denied" | "error";
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
};
```

Rules:

- `empty` means all required source reads succeeded and no included work exists.
- `error` must not render as `원내 업무가 없습니다`.
- `partial` means at least one source read failed or was unavailable while other source reads succeeded.
- `permission_denied` means the actor cannot view the Home operations board at all.
- Per-card redaction is represented on each item with `permissionMode`.

## Normalized Work Item

```ts
type HomeOperationsWorkItem = {
  id: string;
  workspaceId: string;
  sourceType:
    | "reception"
    | "appointment"
    | "consultation"
    | "lab"
    | "imaging"
    | "dispensing"
    | "treatment"
    | "billing"
    | "inpatient";
  sourceId: string;
  sourceStatus: string;
  encounterId?: string;
  patientId?: string;
  guardianId?: string;
  title: string;
  patientName?: string;
  guardianName?: string;
  progressState: "waiting" | "in_progress" | "completed" | "cancelled";
  attentionSignals: Array<
    | "urgent"
    | "re_requested"
    | "assignment_missing"
    | "team_queue"
    | "long_stay"
  >;
  assigneeUserId?: string;
  assigneeName?: string;
  teamQueueId?: string;
  teamQueueLabel?: string;
  requestedAt: string;
  stateEnteredAt?: string;
  operatingDate: string;
  sourceHref: string;
  drawerSummary?: string;
  isMyWork?: boolean;
  permissionMode: "full" | "redacted" | "hidden";
};
```

Hidden items should be excluded from `items` but may contribute to redacted summary counts only if role policy explicitly allows aggregate counts.

## Summary Shape

```ts
type HomeOperationsSummary = {
  totalVisible: number;
  bySourceType: Record<string, number>;
  byProgressState: Record<string, number>;
  byAttentionSignal: Record<string, number>;
  byAssignmentState: {
    personal: number;
    teamQueue: number;
    assignmentMissing: number;
  };
  completedCount: number;
  cancelledCount: number;
  mineCount: number;
};
```

## Source Mapping V0

| Source type | Likely source | Inclusion rule | State mapping |
|---|---|---|---|
| `appointment` | Reception appointments/calendar read model | Scheduled for selected operating date and not terminal, or checked in today. | Waiting until checked in/cancelled/no-show/completed. |
| `reception` | Reception encounter queue | Same-day reception queue entries plus unfinished carry-over. | Waiting or in-progress from queue status; completed/cancelled from terminal queue/encounter state. |
| `consultation` | Chart live queue / reception consultation queue | Active consultation queue work. | Waiting before chart start, in-progress after chart start, completed/cancelled terminal. |
| `lab` | `order_fulfillment_work_items` with lab queue type | Created by confirmed order and still included by operating-date/carry-over rule. | `requested`/`accepted` => waiting, `in_progress` => in_progress, `completed` => completed, `cancelled` => cancelled. |
| `imaging` | `order_fulfillment_work_items` with imaging queue type | Same as lab. | Same as lab. |
| `dispensing` | `order_fulfillment_work_items` with dispensing queue type | Same as lab. | Same as lab. |
| `treatment` | `order_fulfillment_work_items` with treatment queue type | Same as lab. | Same as lab. |
| `billing` | Billing/invoice candidate read model | Active billing candidates, issued/unpaid invoice work, selected-date candidates plus unpaid carry-over. | Waiting before checkout, in-progress during checkout/payment handling, completed when paid/closed, cancelled when candidate/invoice cancelled. |
| `inpatient` | Future inpatient care/read model | Active admission/care item on selected date plus active carry-over. | Deferred to v2 unless source exists. |

## Assignment Mapping

| Source data | Normalized output |
|---|---|
| `assigneeUserId` exists | Personal assignment. |
| No assignee user but `teamQueueId` or role queue exists | Team queue. Add `team_queue` signal. |
| Neither assignee nor team/role queue exists | Add `assignment_missing` signal. |

`scope=mine` includes:

- `assigneeUserId === currentUser.id`
- team/role queues the current user can process according to membership, role, and permission policy

## Attention Signal Mapping

| Signal | Required source |
|---|---|
| `urgent` | Explicit source flag from chart/order/request workflow. Do not infer from clinical values in Home. |
| `re_requested` | Source status such as returned, re-requested, rework, or result/order correction request. |
| `assignment_missing` | Missing personal assignment and missing team/role queue. |
| `team_queue` | Team/role queue exists with no personal assignee. |
| `long_stay` | Soft signal from `stateEnteredAt` ordering or approved source-specific threshold. Not official `지연`. |

## Permission Requirements

- All reads require authenticated actor or approved local/demo actor fallback.
- Every source read must validate `workspaceId`.
- General-or-higher active workspace members may view the full Home operations board in the current product policy.
- Future guest/restricted users must either hide cards or receive redacted cards/counts based on explicit role policy.
- Client-only permission gating is not sufficient.

## Failure And Empty State Rules

| Server state | UI state |
|---|---|
| `live` with items | Render board and side panel. |
| `empty` | Render source-empty state. |
| `partial` | Render board with visible warning and source issue details. |
| `permission_denied` | Render permission state. |
| `error` retryable | Render retry state. |
| `error` non-retryable | Render failure state and support handoff. |

Home must not show `원내 업무가 없습니다` for `partial`, `permission_denied`, or `error`.

## Mock Boundary

- Cheongdam/prepared-clinic operations data must be API-backed.
- Home operations should not use `getHomeMockData().hospitalTasks` as a fallback after the aggregate API is introduced.
- Local-only mock mode may remain for deliberately unconfigured development paths, but it must be visibly non-authoritative and must not mask API/readback failures.

## HOME-PR-011 Implementation Notes

Implemented:

1. Server contract and type definitions with mockless permission/error tests.
2. Additive aggregate RPC covering appointments, reception/waiting queue entries, fulfillment work items, and billing invoice/invoice-line candidates.
3. Next.js API route using the Supabase RPC gateway and server-side permission adapter.
4. Home main board and side panel adoption with loading, empty, error, permission, completed/cancelled toggles, and drawer navigation behavior.
5. Cheongdam regression coverage for no-work, API-error, and role/team queue behavior without Home operations mock fallback.

Remaining engineering follow-up:

1. Split the aggregate into independently failure-tolerant source adapters if `partial` source reads become required.
2. Add source-owned `stateEnteredAt` where current derivation from source timestamps is too coarse.
3. Add source-specific `long_stay` thresholds only after product SLA policy is approved.
4. Add inpatient source mapping after inpatient operations v2 has a durable source.
