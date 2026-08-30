import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  cancelReceptionEncounter,
  createSupabaseReceptionEncounterCancelGateway,
} from "../src/features/reception/server-encounter-cancel-core";
import { normalizeSupabaseRequestId } from "../src/lib/supabase/server";

type SupabaseEncounterCancelClient = Parameters<
  typeof createSupabaseReceptionEncounterCancelGateway
>[0];

const workspaceId = "clair-demo";
const encounter = {
  id: "encounter-den510-cancel",
  workspaceId,
  patientId: "patient-coco",
  guardianId: "guardian-lee-jieun",
  primaryVeterinarianId: "user-vet-doyun",
  encounterNo: "E-DEN510-0001",
  receptionType: "walk_in" as const,
  durationMinutes: 30,
  chiefComplaint: "DEN-510 cancel",
  visitPurpose: "DEN-510 cancel",
  status: "waiting" as const,
  checkedInAt: "2026-06-16T14:20:00+09:00",
  createdAt: "2026-06-16T14:20:00+09:00",
  updatedAt: "2026-06-16T14:20:00+09:00",
};
const queueEntry = {
  id: "queue-den510-cancel",
  workspaceId,
  encounterId: encounter.id,
  queueType: "consultation" as const,
  status: "waiting" as const,
  priority: "normal" as const,
  sortOrder: 1,
  enteredAt: "2026-06-16T14:20:00+09:00",
};
const frontDeskPermissionAdapter = createMockWorkspacePermissionAdapter({
  users: [{ id: "user-front-desk", status: "active" }],
  memberships: [
    {
      id: "membership-front-desk",
      workspaceId,
      userId: "user-front-desk",
      roles: ["front_desk"],
      status: "active",
    },
  ],
});

test("DEN-510 mock encounter cancel marks encounter and consultation queue cancelled together", async () => {
  const result = await cancelReceptionEncounter({
    actorUserId: "user-front-desk",
    cancelReason: "보호자 요청으로 진료를 취소합니다.",
    encounterId: encounter.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
    gateway: {
      async cancelEncounter() {
        return {
          ok: true,
          cancellation: {
            encounter: {
              ...encounter,
              status: "cancelled",
              cancellationReason: "보호자 요청으로 진료를 취소합니다.",
            },
            queueEntry: { ...queueEntry, status: "cancelled" },
          },
        };
      },
    },
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    workspaceId,
    cancellation: {
      encounter: {
        id: encounter.id,
        status: "cancelled",
        cancellationReason: "보호자 요청으로 진료를 취소합니다.",
      },
      queueEntry: { id: queueEntry.id, status: "cancelled" },
    },
    enforcedBy: "reception-encounter-cancel",
  });
});

test("DEN-510 encounter cancel rejects non-cancelable encounter state", async () => {
  const result = await cancelReceptionEncounter({
    actorUserId: "user-front-desk",
    cancelReason: "보호자 요청으로 진료를 취소합니다.",
    encounterId: encounter.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
    gateway: {
      async cancelEncounter() {
        return {
          ok: false,
          status: 409,
          denialReason: "encounter_not_cancelable",
        };
      },
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "encounter_not_cancelable",
  });
});

test("DEN-510 encounter cancel requires a human-readable cancel reason", async () => {
  const result = await cancelReceptionEncounter({
    actorUserId: "user-front-desk",
    cancelReason: " ",
    encounterId: encounter.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
  });

  expect(result).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: { cancelReason: "진료 취소 사유를 입력해 주세요." },
  });
});

test("DEN-510 supabase encounter cancel gateway calls scoped RPC and maps response", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionEncounterCancelGateway({
    async rpc(functionName, args) {
      calls.push(
        `${functionName}:${args.p_workspace_id}:${args.p_encounter_id}:${args.p_cancel_reason}`,
      );
      return {
        data: {
          encounter: {
            ...encounter,
            status: "cancelled",
            cancellationReason: args.p_cancel_reason,
          },
          queueEntry: { ...queueEntry, status: "cancelled" },
          auditHandledBy: "database_transaction",
          auditEventId: "reception-cancel-audit-test",
        },
        error: null,
      };
    },
  } satisfies SupabaseEncounterCancelClient);

  const result = await gateway.cancelEncounter({
    actorUserId: "user-front-desk",
    cancelReason: "보호자 요청으로 진료를 취소합니다.",
    encounterId: encounter.id,
    workspaceId,
  });

  expect(calls).toEqual([
    "clair_cancel_reception_encounter:clair-demo:encounter-den510-cancel:보호자 요청으로 진료를 취소합니다.",
  ]);
  expect(result).toMatchObject({
    ok: true,
    auditHandledBy: "database_transaction",
    auditEventId: "reception-cancel-audit-test",
    cancellation: {
      encounter: {
        id: encounter.id,
        status: "cancelled",
        cancellationReason: "보호자 요청으로 진료를 취소합니다.",
      },
      queueEntry: { id: queueEntry.id, status: "cancelled" },
    },
  });
});

test("RECEPTION-LIVE-PR-018 does not append a second audit after the transactional RPC", async () => {
  let auditAppendCount = 0;
  const result = await cancelReceptionEncounter({
    actorUserId: "user-front-desk",
    cancelReason: "보호자 요청으로 진료를 취소합니다.",
    encounterId: encounter.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
    gateway: {
      async cancelEncounter() {
        return {
          ok: true,
          auditHandledBy: "database_transaction",
          auditEventId: "reception-cancel-audit-test",
          cancellation: {
            encounter: {
              ...encounter,
              status: "cancelled",
              cancellationReason: "보호자 요청으로 진료를 취소합니다.",
            },
            queueEntry: { ...queueEntry, status: "cancelled" },
          },
        };
      },
    },
    auditGateway: {
      async appendEvent(input) {
        auditAppendCount += 1;
        return { ok: true, event: input };
      },
    },
  });

  expect(result).toMatchObject({ ok: true, status: 200 });
  expect(auditAppendCount).toBe(0);
});

test("RECEPTION-LIVE-PR-018 falls back to the server audit when the RPC marker is missing", async () => {
  let auditAppendCount = 0;
  const gateway = createSupabaseReceptionEncounterCancelGateway({
    async rpc(_functionName, args) {
      return {
        data: {
          encounter: {
            ...encounter,
            status: "cancelled",
            cancellationReason: args.p_cancel_reason,
          },
          queueEntry: { ...queueEntry, status: "cancelled" },
        },
        error: null,
      };
    },
  } satisfies SupabaseEncounterCancelClient);

  const result = await cancelReceptionEncounter({
    actorUserId: "user-front-desk",
    cancelReason: "보호자 요청으로 진료를 취소합니다.",
    encounterId: encounter.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
    gateway,
    auditGateway: {
      async appendEvent(input) {
        auditAppendCount += 1;
        return { ok: true, event: input };
      },
    },
  });

  expect(result).toMatchObject({ ok: true, status: 200 });
  expect(auditAppendCount).toBe(1);
});

test("RECEPTION-LIVE-PR-018 falls back to the server audit when the transactional audit id is missing", async () => {
  let auditAppendCount = 0;
  const result = await cancelReceptionEncounter({
    actorUserId: "user-front-desk",
    cancelReason: "보호자 요청으로 진료를 취소합니다.",
    encounterId: encounter.id,
    workspaceId,
    permissionAdapter: frontDeskPermissionAdapter,
    gateway: {
      async cancelEncounter() {
        return {
          ok: true,
          auditHandledBy: "database_transaction",
          cancellation: {
            encounter: {
              ...encounter,
              status: "cancelled",
              cancellationReason: "보호자 요청으로 진료를 취소합니다.",
            },
            queueEntry: { ...queueEntry, status: "cancelled" },
          },
        };
      },
    },
    auditGateway: {
      async appendEvent(input) {
        auditAppendCount += 1;
        return { ok: true, event: input };
      },
    },
  });

  expect(result).toMatchObject({ ok: true, status: 200 });
  expect(auditAppendCount).toBe(1);
});

test("RECEPTION-LIVE-PR-018 maps database actor and permission denials to HTTP 403", async () => {
  for (const message of [
    "actor_mismatch",
    "workspace_membership_missing",
    "permission_missing",
  ]) {
    const gateway = createSupabaseReceptionEncounterCancelGateway({
      async rpc() {
        return { data: null, error: { message } };
      },
    } satisfies SupabaseEncounterCancelClient);

    const gatewayResult = await gateway.cancelEncounter({
      actorUserId: "user-front-desk",
      cancelReason: "보호자 요청으로 진료를 취소합니다.",
      encounterId: encounter.id,
      workspaceId,
    });

    expect(gatewayResult).toEqual({
      ok: false,
      status: 403,
      denialReason: "permission_missing",
    });

    const result = await cancelReceptionEncounter({
      actorUserId: "user-front-desk",
      cancelReason: "보호자 요청으로 진료를 취소합니다.",
      encounterId: encounter.id,
      workspaceId,
      permissionAdapter: frontDeskPermissionAdapter,
      gateway,
    });

    expect(result).toEqual({
      ok: false,
      status: 403,
      denialReason: "permission_missing",
    });
  }
});

test("RECEPTION-LIVE-PR-018 accepts only bounded safe audit request ids", () => {
  expect(normalizeSupabaseRequestId(" request-id_2026.08:30 ")).toBe(
    "request-id_2026.08:30",
  );
  expect(normalizeSupabaseRequestId("request id with spaces")).toBeNull();
  expect(normalizeSupabaseRequestId("요청-id")).toBeNull();
  expect(normalizeSupabaseRequestId("x".repeat(129))).toBeNull();
  expect(normalizeSupabaseRequestId("   ")).toBeNull();
  expect(normalizeSupabaseRequestId(null)).toBeNull();
});

test("DEN-510 encounter cancel route and server wrapper keep write boundary explicit", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/encounters/[encounterId]/cancel/route.ts",
    "utf8",
  );
  const serverSource = readFileSync(
    "src/features/reception/server-encounter-cancel.ts",
    "utf8",
  );
  const supabaseServerSource = readFileSync(
    "src/lib/supabase/server.ts",
    "utf8",
  );

  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(routeSource).toContain("reception_encounter_cancel");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain(
    "normalizeSupabaseRequestId(getAuditRequestId(request))",
  );
  expect(routeSource).toContain("createClient({ requestId: auditRequestId })");
  expect(supabaseServerSource).toContain(
    'headers: { "x-request-id": requestId }',
  );
  expect(supabaseServerSource).toContain("safeRequestIdPattern");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});

test("RECEPTION-LIVE-PR-018 migration repairs and hardens the live cancel contract", () => {
  const migrationSource = readFileSync(
    "supabase/migrations/20260830110234_reception_encounter_cancel_contract_repair.sql",
    "utf8",
  );

  expect(migrationSource).toContain(
    "add column if not exists cancellation_reason text",
  );
  expect(migrationSource).toContain("encounters_cancelled_reason_check");
  expect(migrationSource).toContain(
    "cancelled_encounter_reason_backfill_required",
  );
  expect(migrationSource).toContain(
    "create or replace function public.clair_cancel_reception_encounter",
  );
  expect(migrationSource).toContain("p_actor_user_id text");
  expect(migrationSource).toContain("p_encounter_id text");
  expect(migrationSource).toContain("p_cancel_reason text");
  expect(migrationSource).toContain("auth.uid() is null");
  expect(migrationSource).toContain("actor_mismatch");
  expect(migrationSource).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(migrationSource).toContain(
    "private.clair_current_user_has_workspace_permission",
  );
  expect(migrationSource).toContain("'reception:update'");
  expect(migrationSource).toContain("for update");
  expect(migrationSource).toContain("status = 'cancelled'");
  expect(migrationSource).toContain("cancel_reason_required");
  expect(migrationSource).toContain("cancellation_reason = v_cancel_reason");
  expect(migrationSource).toContain("public.clair_append_audit_event");
  expect(migrationSource).toContain("'reception.encounter_cancelled'");
  expect(migrationSource).toContain("p_request_id => v_request_id");
  expect(migrationSource).toContain("'auditHandledBy', 'database_transaction'");
  expect(migrationSource).toContain("'auditEventId', v_audit_event ->> 'id'");
  expect(migrationSource).toContain("v_before_snapshot");
  expect(migrationSource).toContain("v_after_snapshot");
  expect(migrationSource).toContain("queue_type = 'consultation'");
  expect(migrationSource).toContain("'waiting', 'in_consultation'");
  expect(migrationSource).toContain("'waiting', 'called', 'in_progress'");
  expect(migrationSource).toContain(
    "grant execute on function public.clair_cancel_reception_encounter",
  );
  expect(migrationSource).toMatch(
    /revoke all on function public\.clair_cancel_reception_encounter\(text, text, text\)[\s\S]*from public, anon, authenticated/,
  );
  expect(migrationSource).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});
