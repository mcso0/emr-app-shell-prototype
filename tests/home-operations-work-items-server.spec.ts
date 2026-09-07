import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockHomeOperationsWorkItemGateway,
  createSupabaseHomeOperationsWorkItemGateway,
  readHomeOperationsWorkItems,
} from "../src/features/home/server-home-operations-work-items-core";
import type { HomeOperationsWorkItem } from "../src/features/home/home.types";

const workspaceId = "workspace-clair-cheongdam";
const actorUserId = "49110000-0000-4000-8000-000000000001";
const operatingDate = "2026-07-05";
const migration = readFileSync(
  "supabase/migrations/20260705120000_home_operations_work_items_reader.sql",
  "utf8",
);

test("home operations core denies board access instead of returning empty work", async () => {
  const result = await readHomeOperationsWorkItems({
    actorUserId,
    workspaceId,
    filters: { date: operatingDate },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: actorUserId, status: "active" }],
      memberships: [],
    }),
    gateway: createMockHomeOperationsWorkItemGateway({
      ok: true,
      generatedAt: "2026-07-05T09:00:00+09:00",
      sourceStatus: "empty",
      items: [],
    }),
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    sourceStatus: "permission_denied",
    error: {
      code: "workspace_membership_missing",
    },
  });
});

test("home operations scope mine keeps only directly assigned personal work", async () => {
  const personal = createWorkItem({
    id: "lab:personal",
    assigneeUserId: actorUserId,
    sourceType: "lab",
  });
  const teamQueue = createWorkItem({
    id: "billing:team",
    sourceType: "billing",
    teamQueueId: "billing",
    teamQueueLabel: "수납팀 큐",
  });
  const assignmentMissing = createWorkItem({
    id: "imaging:missing",
    attentionSignals: ["assignment_missing"],
    sourceType: "imaging",
    teamQueueId: undefined,
    teamQueueLabel: undefined,
  });
  const result = await readHomeOperationsWorkItems({
    actorUserId,
    workspaceId,
    filters: { date: operatingDate, scope: "mine" },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: actorUserId, status: "active" }],
      memberships: [
        {
          id: "membership-general",
          workspaceId,
          userId: actorUserId,
          roles: ["technician"],
          status: "active",
        },
      ],
    }),
    gateway: createMockHomeOperationsWorkItemGateway({
      ok: true,
      generatedAt: "2026-07-05T09:00:00+09:00",
      sourceStatus: "live",
      items: [personal, teamQueue, assignmentMissing],
    }),
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    sourceStatus: "live",
    summary: {
      totalVisible: 1,
      mineCount: 1,
    },
  });
  expect(result.ok && result.items.map((item) => item.id)).toEqual([
    "lab:personal",
  ]);
});

function sourceClient(rows: Record<string, unknown[]> = {}, fulfillment: unknown[] = []) {
  const calls: string[] = [];
  return {
    calls,
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push(`${name}:${args.p_queue_type}`);
      if (name === "clair_get_home_operations_source_snapshot") {
        expect(args.p_workspace_id).toBe(workspaceId);
        const offset = Number(args.p_offset);
        const data = Object.fromEntries(["appointments", "encounters", "waiting_queue_entries", "patients", "guardians", "invoices", "invoice_lines", "orders", "user_memberships"].map((table) => {
          calls.push(`${table}:${offset}`);
          return [table, (rows[table] ?? []).slice(offset, offset + Number(args.p_limit)).map((value) => ({ workspace_id: workspaceId, assigned_staff_user_ids: [actorUserId], ...value as object }))];
        }));
        return { error: null, data };
      }
      expect(name).toBe("clair_list_fulfillment_work_items");
      expect(args.p_workspace_id).toBe(workspaceId);
      return { error: null, data: fulfillment };
    },

  };
}
const gatewayInput = { actorUserId, includeCancelled: false, includeCompleted: false, operatingDate, scope: "all" as const, workspaceId, allowedSourceTypes: ["reception", "appointment", "consultation", "lab", "billing"] as HomeOperationsWorkItem["sourceType"][] };
const permissionAdapter = createMockWorkspacePermissionAdapter({
  users: [{ id: actorUserId, status: "active" }],
  memberships: [{ id: "member", userId: actorUserId, workspaceId, roles: ["hospital_admin"], status: "active" }],
});

test("home reads authorized sources, scheduled dates, identities, names and exact work targets", async () => {
  const client = sourceClient({
    appointments: [{ id: "appointment", patient_id: "patient", guardian_id: "guardian", status: "confirmed", created_at: "2026-06-20T09:00:00+09:00", scheduled_start_at: `${operatingDate}T10:00:00+09:00`, created_by_user_id: actorUserId, assigned_veterinarian_id: actorUserId }],
    patients: [{ id: "patient", name: "나나" }], guardians: [{ id: "guardian", name: "김보호" }],
    user_memberships: [{ id: "member", user_id: actorUserId, users: { display_name: "김수의" } }],
  }, [{ id: "work", workspaceId, patientId: "patient", encounterId: "encounter", queueType: "lab", status: "requested", createdAt: "2026-06-20T09:00:00+09:00", dueAt: `${operatingDate}T11:00:00+09:00`, requestedByUserId: actorUserId, assignedToUserId: actorUserId, sourceSnapshot: { patientName: "나나", orderDisplayName: "CBC" } }]);
  const response = await createSupabaseHomeOperationsWorkItemGateway(client).listHomeOperationsWorkItems(gatewayInput);
  expect(response.ok).toBe(true);
  if (!response.ok) return;
  const lab = response.items.find((item) => item.sourceType === "lab")!;
  expect(lab).toMatchObject({ patientId: "patient", operatingDate, requesterUserId: actorUserId, assigneeUserId: actorUserId, assigneeName: "김수의" });
  expect(lab.sourceHref).toContain("labResultId=live-lab-work");
  expect(lab.sourceHref).toContain(`date=${operatingDate}`);
  expect(lab.attentionSignals).not.toContain("long_stay");
  const appointment = response.items.find((item) => item.sourceType === "appointment")!;
  expect(appointment.operatingDate).toBe(operatingDate);
  expect(appointment.assigneeUserIds).toEqual([actorUserId]);
  expect(appointment.assigneeName).toBe("김수의");
  expect(response.sourceStatus).toBe("live");
  expect(appointment.requestedAt).toBe("2026-06-20T09:00:00+09:00");
  expect(appointment.attentionSignals).not.toContain("long_stay");
  expect(client.calls.filter((name) => name.startsWith("clair_list_fulfillment"))).toEqual(["clair_list_fulfillment_work_items:lab"]);
});

test("home enriches fulfillment context without snapshot names and fails closed on an incomplete reader response", async () => {
  const client = sourceClient({
    encounters: [{ id: "encounter", patient_id: "patient", guardian_id: "guardian", status: "completed", checked_in_at: "2026-01-01T09:00:00+09:00" }],
    patients: [{ id: "patient", name: "나나" }], guardians: [{ id: "guardian", name: "김보호" }],
  }, [{ id: "work", workspaceId, encounterId: "encounter", queueType: "lab", status: "requested", createdAt: `${operatingDate}T09:00:00+09:00`, sourceSnapshot: { orderDisplayName: "CBC" } }]);
  const result = await createSupabaseHomeOperationsWorkItemGateway(client).listHomeOperationsWorkItems(gatewayInput);
  expect(result.ok && result.items[0]).toMatchObject({ patientId: "patient", patientName: "나나", guardianName: "김보호" });
  const unavailable = await createSupabaseHomeOperationsWorkItemGateway({ async rpc() { return { data: {}, error: null }; } }).listHomeOperationsWorkItems(gatewayInput);
  expect(unavailable).toEqual({ ok: false, error: "db_read_failed", retryable: true });
});

test("billing uses invoice guardian context when encounter guardian is absent", async () => {
  const client = sourceClient({
    encounters: [{ id: "encounter", patient_id: "patient", status: "completed", checked_in_at: "2026-01-01T09:00:00+09:00" }],
    patients: [{ id: "patient", name: "나나" }], guardians: [{ id: "invoice-guardian", name: "김보호" }],
    invoices: [{ id: "invoice", encounter_id: "encounter", guardian_id: "invoice-guardian", status: "draft", billing_requested_at: `${operatingDate}T09:00:00+09:00`, created_at: `${operatingDate}T09:00:00+09:00` }],
    invoice_lines: [{ id: "line", invoice_id: "invoice", billing_candidate_id: "candidate", created_at: `${operatingDate}T09:00:00+09:00` }],
  });
  const result = await createSupabaseHomeOperationsWorkItemGateway(client).listHomeOperationsWorkItems(gatewayInput);
  expect(result.ok && result.items.find((item) => item.sourceType === "billing")).toMatchObject({ patientName: "나나", guardianName: "김보호" });
});

test("home paginates beyond one page and separates current patient counts from selected work date", async () => {
  const client = sourceClient({
    appointments: Array.from({ length: 503 }, (_, index) => ({ id: `appointment-${index}`, status: "confirmed", scheduled_start_at: `${operatingDate}T10:00:00+09:00` })),
    encounters: [
      { id: "one", patient_id: "patient-a", status: "waiting", checked_in_at: "2026-01-01T09:00:00+09:00" },
      { id: "two", patient_id: "patient-a", status: "in_consultation", checked_in_at: "2026-01-01T09:00:00+09:00" },
      { id: "billing-first", patient_id: "patient-b", status: "ready_for_billing", checked_in_at: "2026-01-01T09:00:00+09:00" },
      { id: "three", patient_id: "patient-b", status: "waiting", checked_in_at: "2026-01-01T09:00:00+09:00" },
      { id: "four", patient_id: "patient-c", status: "completed", checked_in_at: "2026-01-01T09:00:00+09:00" },
    ],
  });
  const response = await createSupabaseHomeOperationsWorkItemGateway(client).listHomeOperationsWorkItems(gatewayInput);
  expect(response).toMatchObject({ ok: true, currentPatients: { present: 2, waiting: 1, inProgress: 1 } });
  expect(response.ok && response.items.filter((item) => item.sourceType === "appointment")).toHaveLength(503);
  expect(client.calls).toContain("appointments:500");
});

test("home excludes future work, old completed work, foreign fulfillment and unanchored invoices", async () => {
  const work = { workspaceId, patientId: "patient", encounterId: "encounter", queueType: "lab", status: "requested", createdAt: "2026-07-04T09:00:00+09:00" };
  const client = sourceClient({
    invoices: [{ id: "invoice", encounter_id: "encounter", created_at: `${operatingDate}T09:00:00+09:00`, status: "draft" }],
    invoice_lines: [{ id: "line", invoice_id: "invoice", order_id: "order", created_at: `${operatingDate}T09:00:00+09:00` }],
    orders: [{ id: "order", billing_candidate_id: null }],
  }, [{ ...work, id: "previous" }, { ...work, id: "future", dueAt: "2026-07-06T09:00:00+09:00" }, { ...work, id: "completed", status: "completed" }, { ...work, id: "foreign", workspaceId: "another" }]);
  const response = await createSupabaseHomeOperationsWorkItemGateway(client).listHomeOperationsWorkItems({ ...gatewayInput, includeCompleted: true });
  expect(response.ok && response.items.map((item) => item.id)).toEqual(["lab:previous"]);
  expect(response.ok && response.items[0].sourceHref).toContain("date=2026-07-04");
});

test("core derives assigned and requested independently and rejects foreign or unauthorized rows before counts", async () => {
  const result = await readHomeOperationsWorkItems({ actorUserId, workspaceId, filters: { date: operatingDate }, permissionAdapter,
    gateway: createMockHomeOperationsWorkItemGateway({ ok: true, generatedAt: "now", sourceStatus: "live", items: [
      createWorkItem({ id: "assigned", assigneeUserId: actorUserId }),
      createWorkItem({ id: "requested", requesterUserId: actorUserId }),
      createWorkItem({ id: "foreign", workspaceId: "another" }),
      createWorkItem({ id: "hidden", permissionMode: "hidden" }),
    ] }),
  });
  expect(result.ok && result.items.map(({ id, isMyWork, isRequestedWork }) => ({ id, isMyWork, isRequestedWork }))).toEqual([
    { id: "assigned", isMyWork: true, isRequestedWork: false }, { id: "requested", isMyWork: false, isRequestedWork: true },
  ]);
  let sources: string[] = [];
  await readHomeOperationsWorkItems({ actorUserId, workspaceId, filters: {}, permissionAdapter: {
    ...permissionAdapter, memberships: [{ ...permissionAdapter.memberships[0], roles: [], permissionRole: { key: "home-only", label: "Home", roleType: "custom", permissionIds: ["reception:view"] } }],
  }, gateway: { async listHomeOperationsWorkItems(input) { sources = input.allowedSourceTypes; return { ok: true, generatedAt: "now", sourceStatus: "empty", items: [] }; } } });
  expect(sources).toEqual(["reception", "appointment"]);
});

test("operational walk-in assignees are personal reception work independently of clinical owner", async () => {
  const client = sourceClient({
    encounters: [{ id: "encounter", patient_id: "patient", status: "waiting", checked_in_at: `${operatingDate}T09:00:00+09:00`, primary_veterinarian_id: "another-vet" }],
    waiting_queue_entries: [{ id: "queue", encounter_id: "encounter", queue_type: "consultation", status: "waiting", entered_at: `${operatingDate}T09:00:00+09:00` }],
    user_memberships: [{ id: "member", user_id: actorUserId, users: { display_name: "접수 담당" } }],
  });
  const result = await readHomeOperationsWorkItems({ actorUserId, workspaceId, filters: { date: operatingDate, scope: "mine" }, permissionAdapter, gateway: createSupabaseHomeOperationsWorkItemGateway(client) });
  expect(result.ok && result.items.map((item) => item.id)).toEqual(["reception:encounter"]);
  expect(result.ok && result.items[0]).toMatchObject({ assigneeUserIds: [actorUserId], assigneeName: "접수 담당", sourceHref: `/w/${workspaceId}/reception?encounterId=encounter&modulePanel=open` });
});

test("home operations migration is additive and exposes read-only aggregate RPC", () => {
  expect(migration).toContain(
    "create or replace function public.clair_list_home_operations_work_items",
  );
  expect(migration).toContain("from public.appointments");
  expect(migration).toContain("from public.waiting_queue_entries");
  expect(migration).toContain("from public.order_fulfillment_work_items");
  expect(migration).toContain("from public.invoice_lines");
  expect(migration).toContain(
    "grant execute on function public.clair_list_home_operations_work_items",
  );
  expect(migration).not.toMatch(/\b(drop|truncate|delete\s+from|update\s+public\.)\b/i);
});

function createWorkItem(
  overrides: Partial<HomeOperationsWorkItem>,
): HomeOperationsWorkItem {
  return {
    id: "lab:default",
    workspaceId,
    sourceType: "lab",
    sourceId: "00000000-0000-4000-8000-000000000001",
    sourceStatus: "requested",
    title: "CBC 검사",
    progressState: "waiting",
    attentionSignals: ["team_queue"],
    requestedAt: "2026-07-05T09:00:00+09:00",
    operatingDate,
    sourceHref: `/w/${workspaceId}/lab?modulePanel=open`,
    permissionMode: "full",
    teamQueueId: "lab",
    teamQueueLabel: "임상병리팀 큐",
    ...overrides,
  };
}
