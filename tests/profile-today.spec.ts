import { expect, test } from "@playwright/test";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { createMockCustomerProfileOverviewGateway, type CustomerProfileOverview } from "../src/features/customer/server-profile-overview-core";
import { createSupabaseProfileTodaySourceGateway, readCustomerProfileToday, type ProfileTodaySourceGateway } from "../src/features/customer/server-profile-today-core";
import { getProfileTodayItems, type ProfileTodayEncounter } from "../src/features/reception/profile-today";
import type { Appointment } from "../src/types/emr-domain";

const workspaceId = "workspace-a";
const date = "2026-10-04";
const at = "2026-10-04T01:00:00.000Z";
const now = new Date(at);
const patientNames = new Map([["patient-a", "초코"], ["patient-b", "코코"]]);
function appointment(id: string, patch: Partial<Appointment> = {}): Appointment {
  return { id, workspaceId, patientId: "patient-a", status: "confirmed", scheduledStartAt: at, createdAt: at, updatedAt: at, ...patch };
}
function encounter(id: string, patch: Partial<ProfileTodayEncounter> = {}): ProfileTodayEncounter {
  return { id, workspaceId, patientId: "patient-a", status: "waiting", checkedInAt: at, createdAt: at, ...patch };
}
function project(appointments: Appointment[], encounters: ProfileTodayEncounter[]) {
  return getProfileTodayItems({ appointments, encounters, patientNames, workspaceId, date });
}
function adapter(permissions: string[] = ["patient:view", "reception:view"], active = true, member = true) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: "user-a", status: active ? "active" : "inactive" }],
    memberships: member ? [{ id: "member-a", userId: "user-a", workspaceId, roles: ["front_desk"], status: "active" }] : [],
    permissionPolicies: [{ workspaceId, role: "front_desk", permissionIds: permissions as never }],
  });
}
const overview: CustomerProfileOverview = {
  subjectType: "patient", subjectId: "patient-a", profile: { id: "patient-a", workspaceId, name: "초코" }, relationships: { guardians: [] },
  access: {
    information: { allowed: true, requiredPermission: "patient:view" },
    history: { allowed: false, requiredPermission: "chart:view" },
    reservations: { allowed: true, requiredPermission: "reception:view" },
    billing: { allowed: false, requiredPermission: "billing:view" },
  },
};
async function read(profile = overview, sourceGateway: ProfileTodaySourceGateway = { readSources: async () => ({ ok: true, appointments: [], encounters: [encounter("e-a")] }) }) {
  return readCustomerProfileToday({ actorUserId: "user-a", permissionAdapter: adapter(), overviewGateway: createMockCustomerProfileOverviewGateway(profile), sourceGateway, subjectId: profile.subjectId, subjectType: profile.subjectType, workspaceId, now });
}

test("today includes only four states and orders consulting, waiting, billing, reservation", () => {
  const rows = project(
    [appointment("reserved"), appointment("cancelled", { status: "cancelled" }), appointment("missed", { status: "no_show" }), appointment("checked", { status: "checked_in" })],
    [encounter("waiting"), encounter("consulting", { status: "in_consultation" }), encounter("billing", { status: "ready_for_billing" }), encounter("ordered", { status: "ordered" }), encounter("completed", { status: "completed" }), encounter("cancelled", { status: "cancelled" })],
  );
  expect(rows.map((row) => row.status)).toEqual(["consulting", "waiting", "billing", "reservation"]);
  expect(rows.map((row) => row.title)).toEqual(["진료중", "진료 대기", "수납대기", "오늘 10시 00분 · 예약"]);
});

test("KST midnight and patient/workspace boundaries filter both source types", () => {
  const rows = project([
    appointment("midnight", { scheduledStartAt: "2026-10-03T15:00:00Z" }),
    appointment("yesterday", { scheduledStartAt: "2026-10-03T14:59:59Z" }),
    appointment("tomorrow", { scheduledStartAt: "2026-10-04T15:00:00Z" }),
    appointment("foreign", { workspaceId: "workspace-b" }),
    appointment("unlinked", { patientId: "patient-c" }),
  ], [encounter("foreign", { workspaceId: "workspace-b" }), encounter("unlinked", { patientId: "patient-c" }), encounter("old", { checkedInAt: "2026-10-03T14:59:59Z" })]);
  expect(rows.map((row) => row.id)).toEqual(["appointment:midnight"]);
});

test("check-in replaces reservation once, including excluded order/completed transitions", () => {
  for (const status of ["waiting", "ordered", "completed"] as const) {
    const e = encounter("e", { appointmentId: "a", status });
    expect(project([appointment("a")], [e, e]).map((row) => row.id)).toEqual(status === "waiting" ? ["encounter:e"] : []);
  }
  expect(project([appointment("older", { scheduledStartAt: "2026-10-02T01:00:00Z" })], [encounter("today", { appointmentId: "older" })])[0].id).toBe("encounter:today");
});

test("memo fallback trims blanks and never borrows another linked patient's memo", () => {
  expect(project([appointment("a", { visitPurpose: " 예약 목적 " })], [encounter("e", { appointmentId: "a", visitPurpose: " ", chiefComplaint: " 증상 " })])[0].description).toBe("증상");
  expect(project([appointment("a", { patientId: "patient-b", visitPurpose: "다른 환자 메모" })], [encounter("e", { appointmentId: "a", receptionMemo: " 접수 메모 " })])[0].description).toBe("접수 메모");
  expect(project([appointment("a")], [])[0].description).toBe("예약 메모가 입력되지 않았습니다.");
});

test("ties sort by operating time then source ID deterministically", () => {
  expect(project([], [encounter("b"), encounter("a"), encounter("c", { checkedInAt: "2026-10-04T00:00:00Z" })]).map((row) => row.id)).toEqual(["encounter:c", "encounter:a", "encounter:b"]);
});

for (const scenario of ["unauthenticated", "patient", "reception", "inactive", "membership"] as const) {
  test(`${scenario} denial never reads profile or today's source`, async () => {
    let reads = 0;
    const gateway = createMockCustomerProfileOverviewGateway(overview);
    const result = await readCustomerProfileToday({
      actorUserId: scenario === "unauthenticated" ? null : "user-a",
      permissionAdapter: adapter(scenario === "patient" ? ["reception:view"] : scenario === "reception" ? ["patient:view"] : undefined, scenario !== "inactive", scenario !== "membership"),
      overviewGateway: { ...gateway, readOverview: async () => { reads += 1; return { ok: true, overview }; } },
      sourceGateway: { readSources: async () => { reads += 1; return { ok: true, appointments: [], encounters: [] }; } },
      subjectId: "patient-a", subjectType: "patient", workspaceId, now,
    });
    expect(result).toMatchObject({ ok: false, status: scenario === "unauthenticated" ? 401 : 403 });
    expect(reads).toBe(0);
  });
}

test("guardian accepts canonical SQL relationship shape without workspaceId and includes additional patients", async () => {
  const profile: CustomerProfileOverview = { ...overview, subjectType: "guardian", subjectId: "guardian-a", profile: { id: "guardian-a", workspaceId, name: "예시 보호자" }, relationships: { patients: [
    { id: "patient-a", name: "초코", isPrimary: true }, { id: "patient-b", name: "코코", isPrimary: false }, { id: "patient-c", name: "다른 병원", workspaceId: "workspace-b" },
  ] } };
  const result = await read(profile, { readSources: async ({ patientIds }) => {
    expect([...patientIds]).toEqual(["patient-a", "patient-b"]);
    return { ok: true, appointments: [], encounters: [encounter("a"), encounter("b", { patientId: "patient-b" }), encounter("c", { patientId: "patient-c" }), encounter("d", { workspaceId: "workspace-b" })] };
  } });
  expect(result).toMatchObject({ ok: true, date, items: [{ patientName: "초코" }, { patientName: "코코" }] });
});

test("profile mismatch, denied access, and no linked patients avoid source reads", async () => {
  let reads = 0;
  const source: ProfileTodaySourceGateway = { readSources: async () => { reads += 1; return { ok: true, appointments: [], encounters: [] }; } };
  expect(await read({ ...overview, profile: { ...overview.profile, workspaceId: "workspace-b" } }, source)).toMatchObject({ ok: false, status: 404 });
  expect(await read({ ...overview, access: { ...overview.access, reservations: { allowed: false, requiredPermission: "reception:view" } } }, source)).toMatchObject({ ok: false, status: 403 });
  expect(await read({ ...overview, subjectType: "guardian", relationships: { patients: [] } }, source)).toMatchObject({ ok: true, items: [] });
  expect(reads).toBe(0);
});

test("complete operational snapshot preserves patient beyond 500 rows and old appointment check-in without queue mutations", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseProfileTodaySourceGateway({ rpc: async (name, args) => {
    calls.push(name);
    if (name === "clair_get_home_operations_source_snapshot_v2") {
      expect(args).toEqual({ p_workspace_id: workspaceId, p_date: date, p_include_completed: true, p_include_cancelled: true });
      return { error: null, data: { encounters: [
        ...Array.from({ length: 501 }, (_, i) => ({ id: `unlinked-${i}`, workspace_id: workspaceId, patient_id: "patient-c", status: "waiting", checked_in_at: at })),
        { id: "last", workspace_id: workspaceId, patient_id: "patient-a", appointment_id: "older", status: "waiting", checked_in_at: at, visit_purpose: "이전 예약의 오늘 접수" },
      ], invoices: [{ total_amount: 999999 }] } };
    }
    expect(name).toBe("clair_list_reception_day_calendar");
    return { error: null, data: [] };
  } });
  const result = await read(overview, gateway);
  expect(result).toMatchObject({ ok: true, items: [{ id: "encounter:last", description: "이전 예약의 오늘 접수" }] });
  expect(calls).toEqual(["clair_get_home_operations_source_snapshot_v2", "clair_list_reception_day_calendar"]);
  expect(JSON.stringify(result)).not.toContain("invoices");
  expect(JSON.stringify(result)).not.toContain("999999");
});

test("source RPC errors and malformed snapshot remain errors rather than empty schedules", async () => {
  for (const payload of [{ error: { code: "42501" }, data: null }, { error: null, data: {} }]) {
    const source = createSupabaseProfileTodaySourceGateway({ rpc: async () => payload });
    expect(await read(overview, source)).toMatchObject({ ok: false, status: 500, error: "db_read_failed" });
  }
});

test("today route rejects unauthenticated requests", async ({ request }) => {
  const response = await request.get("/api/workspaces/workspace-clair-cheongdam/customer/patient/49121000-0000-4000-8000-000000000999/profile-overview/today");
  expect(response.status()).toBe(401);
});
