import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import {
  appendLiveAuditEvent,
  createMockLiveAuditAppendGateway,
  createSupabaseLiveAuditAppendGateway,
} from "../src/features/audit/server-audit-log-persistence-core";

const migrationPath = "supabase/migrations/20260520120000_live_mvp_audit_events.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

test("live audit schema defines append-only workspace-scoped audit events", () => {
  expect(migration).toContain("create table if not exists public.audit_events");
  expect(migration).toContain("workspace_id text not null references public.workspaces(id) on delete cascade");
  expect(migration).toContain("actor_user_id uuid references public.users(id) on delete set null");
  expect(migration).toContain("before_snapshot jsonb not null default '{}'::jsonb");
  expect(migration).toContain("after_snapshot jsonb not null default '{}'::jsonb");
  expect(migration).toContain("metadata jsonb not null default '{}'::jsonb");
  expect(migration).toContain("alter table public.audit_events enable row level security");
  expect(migration).toContain("revoke all on table public.audit_events from public, anon, authenticated");
  expect(migration).toContain("create or replace function public.clair_append_audit_event");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
});

test("live audit schema includes query indexes and canonical event constraints", () => {
  for (const indexName of [
    "audit_events_workspace_occurred_idx",
    "audit_events_workspace_event_type_idx",
    "audit_events_workspace_target_idx",
    "audit_events_workspace_encounter_idx",
    "audit_events_workspace_actor_idx",
  ]) {
    expect(migration).toContain(indexName);
  }

  for (const eventType of [
    "workspace.membership_roles_changed",
    "reception.walk_in_created",
    "chart.soap_saved",
    "order.confirmed",
    "billing.payment_state_changed",
  ]) {
    expect(migration).toContain(`'${eventType}'`);
  }
});

test("live audit helper accepts canonical membership lifecycle events", async () => {
  for (const eventType of [
    "workspace.membership_archived",
    "workspace.membership_restored",
    "workspace.membership_deactivated",
    "workspace.membership_reactivated",
  ] as const) {
    const result = await appendLiveAuditEvent({
      input: {
        workspaceId: "clair-demo",
        eventType,
        targetType: "membership",
        targetId: "membership-demo",
      },
    });
    expect(result.ok).toBe(true);
  }
});

test("live audit append helper builds deterministic safe records", async () => {
  const gateway = createMockLiveAuditAppendGateway();
  const result = await appendLiveAuditEvent({
    gateway,
    now: () => "2026-05-20T12:00:00.000Z",
    input: {
      workspaceId: "clair-demo",
      actorUserId: "00000000-0000-4000-8000-000000000011",
      eventType: "billing.payment_state_changed",
      targetType: "invoice",
      targetId: "invoice-kong-260501",
      encounterId: "00000000-0000-4000-8000-000000000201",
      before: { paymentState: "unpaid" },
      after: { paymentState: "paid" },
      metadata: { paymentMethod: "card", amount: 156500 },
    },
  });

  expect(result).toMatchObject({
    ok: true,
    status: 201,
    enforcedBy: "live-audit-append-helper",
    event: {
      workspaceId: "clair-demo",
      eventType: "billing.payment_state_changed",
      targetType: "invoice",
      targetId: "invoice-kong-260501",
      occurredAt: "2026-05-20T12:00:00.000Z",
      before: { paymentState: "unpaid" },
      after: { paymentState: "paid" },
      metadata: { paymentMethod: "card", amount: 156500 },
    },
  });
  expect(result.ok ? result.event.id : "").toMatch(/^audit_[a-f0-9]{24}$/);
  expect(gateway.events).toHaveLength(1);

  const repeated = await appendLiveAuditEvent({
    gateway,
    now: () => "2026-05-20T12:00:00.000Z",
    input: {
      workspaceId: "clair-demo",
      actorUserId: "00000000-0000-4000-8000-000000000011",
      eventType: "billing.payment_state_changed",
      targetType: "invoice",
      targetId: "invoice-kong-260501",
      encounterId: "00000000-0000-4000-8000-000000000201",
      before: { paymentState: "unpaid" },
      after: { paymentState: "paid" },
      metadata: { amount: 156500, paymentMethod: "card" },
    },
  });

  expect(repeated.ok && result.ok ? repeated.event.id === result.event.id : false).toBe(true);
});

test("live audit append helper rejects sensitive payload keys before gateway write", async () => {
  const gateway = createMockLiveAuditAppendGateway();
  const result = await appendLiveAuditEvent({
    gateway,
    input: {
      workspaceId: "clair-demo",
      eventType: "workspace.invitation_created",
      targetType: "workspace_invitation",
      targetId: "invite-demo",
      metadata: {
        inviteToken: "should-not-be-stored",
      },
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 400,
    error: "sensitive_audit_payload",
  });
  expect(gateway.events).toHaveLength(0);
});

test("live audit Supabase gateway passes the full append contract to the RPC", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const gateway = createSupabaseLiveAuditAppendGateway({
    async rpc(functionName, args) {
      calls.push({ functionName, args });
      return {
        data: {
          id: args.p_id,
          workspaceId: args.p_workspace_id,
          actorUserId: args.p_actor_user_id,
          actorMembershipId: args.p_actor_membership_id,
          eventType: args.p_event_type,
          targetType: args.p_target_type,
          targetId: args.p_target_id,
          encounterId: args.p_encounter_id,
          patientId: args.p_patient_id,
          guardianId: args.p_guardian_id,
          requestId: args.p_request_id,
          reason: args.p_reason,
          before: args.p_before_snapshot,
          after: args.p_after_snapshot,
          metadata: args.p_metadata,
          occurredAt: args.p_occurred_at,
          createdAt: args.p_occurred_at,
        },
        error: null,
      };
    },
  });

  const result = await appendLiveAuditEvent({
    gateway,
    input: {
      id: "audit-fixed",
      workspaceId: "clair-demo",
      actorUserId: "00000000-0000-4000-8000-000000000011",
      actorMembershipId: "00000000-0000-4000-8000-000000000012",
      eventType: "chart.soap_saved",
      targetType: "soap_note",
      targetId: "soap-demo",
      encounterId: "00000000-0000-4000-8000-000000000201",
      requestId: "req-demo",
      occurredAt: "2026-05-20T12:05:00.000Z",
      before: { status: "draft" },
      after: { status: "autosaved" },
      metadata: { saveMode: "autosave" },
    },
  });

  expect(result).toMatchObject({ ok: true, event: { id: "audit-fixed" } });
  expect(calls).toEqual([
    {
      functionName: "clair_append_audit_event",
      args: expect.objectContaining({
        p_id: "audit-fixed",
        p_workspace_id: "clair-demo",
        p_actor_user_id: "00000000-0000-4000-8000-000000000011",
        p_actor_membership_id: "00000000-0000-4000-8000-000000000012",
        p_event_type: "chart.soap_saved",
        p_target_type: "soap_note",
        p_target_id: "soap-demo",
        p_request_id: "req-demo",
        p_before_snapshot: { status: "draft" },
        p_after_snapshot: { status: "autosaved" },
        p_metadata: { saveMode: "autosave" },
      }),
    },
  ]);
});
