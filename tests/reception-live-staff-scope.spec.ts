import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";
import { transpileModule } from "typescript";
import { isPreparedEmptyClinicWorkspace } from "../src/lib/emr-domain/demo-workspaces";

// Execute the small source predicates/mappers without loading the rendered
// module or starting a browser. The three consumers must share the same scope.
const source = readFileSync("src/features/reception/module.tsx", "utf8");
const predicates = [...source.matchAll(/const liveStaffSourceEnabled = ([\s\S]*?);/g)]
  .map((match) => match[1]);
const pilot = "workspace-clinical-master-pilot-v1";

function staffScopes(workspaceId: string, liveAuth: boolean) {
  return predicates.map((expression) => runInNewContext(expression, {
    workspaceId,
    shouldUseSupabaseAuth: () => liveAuth,
    isPreparedEmptyClinicWorkspace,
  }));
}

function callSourceFunction(name: string, args: unknown[], globals = {}) {
  const declaration = source.match(new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}(?=\\n|$)`))?.[0];
  if (!declaration) throw new Error(`source function missing: ${name}`);
  return runInNewContext(`${transpileModule(declaration, {}).outputText}\n${name}(...args)`, { args, ...globals });
}

test("authenticated pilot enables the existing live staff path in sidebar, calendar and drawer", () => {
  expect(predicates).toHaveLength(3);
  expect(staffScopes(pilot, true)).toEqual([true, true, true]);
  expect(source).toContain("if (!liveStaffSourceEnabled) return Promise.resolve();");
  expect(source).toContain("const actorStaffUserId = liveStaffSourceEnabled\n    ? workspaceActorUserId");
});

test("Cheongdam, explicit legacy and unrelated mock workflows retain their existing scope", () => {
  for (const liveAuth of [false, true]) {
    expect(staffScopes("workspace-clair-cheongdam", liveAuth)).toEqual([true, true, true]);
    expect(staffScopes("clair-demo", liveAuth)).toEqual([false, false, false]);
    expect(staffScopes("unrelated-workspace", liveAuth)).toEqual([false, false, false]);
  }
  expect(staffScopes(pilot, false)).toEqual([false, false, false]);
});

test("existing scoped loader and selectors preserve real staff IDs and require an active vet role", async () => {
  const actorId = "10000000-0000-4000-8000-000000000001";
  const vetId = "10000000-0000-4000-8000-000000000002";
  const staff = [
    { id: actorId, displayName: "Synthetic admin", roles: ["hospital_admin"], status: "active" },
    { id: vetId, displayName: "Synthetic vet", roles: ["vet"], status: "active" },
    { id: "10000000-0000-4000-8000-000000000003", roles: ["vet"], status: "inactive" },
    { id: "10000000-0000-4000-8000-000000000004", roles: [], status: "active" },
  ];
  const calls: Array<{ url: string; init: { cache: string; headers: Record<string, string> } }> = [];
  const response = await callSourceFunction("loadWorkspaceStaff", [{ actorId, operatingDate: "2026-09-07", workspaceId: pilot }], {
    fetch: async (url: string, init: { cache: string; headers: Record<string, string> }) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ ok: true, actorUserId: actorId, staff }) };
    },
  });
  expect(calls).toEqual([{
    url: `/api/workspaces/${pilot}/staff?date=2026-09-07`,
    init: { cache: "no-store", headers: { "x-clair-demo-session-user-id": actorId } },
  }]);
  const mappedStaff = callSourceFunction("mapWorkspaceStaffToReceptionStaff", [response]) as Array<{ id: string }>;
  const mappedVets = callSourceFunction("mapWorkspaceStaffToVeterinarians", [response]) as Array<{ id: string }>;
  expect(mappedStaff.map((member) => member.id)).toEqual([actorId, vetId]);
  expect(mappedVets.map((member) => member.id)).toEqual([vetId]);
});

test("missing, denied and failed live staff remain empty or error instead of mock fallback", async () => {
  const failed = await callSourceFunction("loadWorkspaceStaff", [{ operatingDate: "2026-09-07", workspaceId: pilot }], {
    fetch: async () => { throw new Error("synthetic network failure"); },
  });
  expect(failed).toEqual({ ok: false, status: 500, error: "db_read_failed" });
  for (const response of [failed, { ok: false, status: 403, denialReason: "permission_missing" }, { ok: true, staff: [] }]) {
    expect(callSourceFunction("mapWorkspaceStaffToReceptionStaff", [response])).toEqual([]);
    expect(callSourceFunction("mapWorkspaceStaffToVeterinarians", [response])).toEqual([]);
  }
  const expression = source.match(/const calendarResourceState: CalendarResourceState = ([\s\S]*?);/)?.[1];
  expect(expression).toBeTruthy();
  for (const [status, expected] of [["idle", "loading"], ["loading", "loading"], ["error", "error"], ["ready", "empty"]]) {
    expect(runInNewContext(expression!, { liveStaffSourceEnabled: true, workspaceStaffReadStatus: status, veterinarians: [] })).toBe(expected);
  }
  expect(source).toContain("const staffMembers = liveStaffSourceEnabled\n    ? workspaceStaffMembers\n    : allReceptionStaff;");
  expect(source).toContain("const veterinarians = liveStaffSourceEnabled\n    ? workspaceVeterinarians\n    : allVeterinarians;");
});
