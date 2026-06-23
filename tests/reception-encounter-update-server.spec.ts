import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createReceptionEncounterUpdate,
  createSupabaseReceptionEncounterUpdateGateway,
} from "../src/features/reception/server-encounter-update-core";

const encounterId = "encounter-haru-260430";
const nonEditableEncounterId = "encounter-coco-260501";

const validInput = {
  department: "내과",
  durationMinutes: 45,
  memo: "접수 수정 메모",
  primaryVeterinarianId: "user-vet-doyun",
  visitPurpose: "구토 재진",
  weightKg: 4.8,
};

test("encounter update route requires an actor and preserves mock fallback", async ({
  request,
}) => {
  const unauthenticated = await request.patch(
    `/api/workspaces/clair-demo/reception/encounters/${encounterId}`,
    { data: validInput },
  );
  expect(unauthenticated.status()).toBe(401);
  await expect(unauthenticated.json()).resolves.toMatchObject({
    ok: false,
    denialReason: "unauthenticated",
  });

  const updated = await request.patch(
    `/api/workspaces/clair-demo/reception/encounters/${encounterId}`,
    {
      data: validInput,
      headers: { "x-clair-demo-session-user-id": "user-front-desk" },
    },
  );
  expect(updated.status()).toBe(200);
  const body = (await updated.json()) as {
    ok: true;
    enforcedBy: string;
    update: {
      encounter: {
        department?: string;
        durationMinutes?: number;
        primaryVeterinarianId?: string;
        visitPurpose?: string;
      };
      patient?: { weightKg?: number };
    };
  };

  expect(body.ok).toBe(true);
  expect(body.enforcedBy).toBe("reception-encounter-update");
  expect(body.update.encounter).toMatchObject({
    department: validInput.department,
    durationMinutes: validInput.durationMinutes,
    primaryVeterinarianId: validInput.primaryVeterinarianId,
    visitPurpose: validInput.visitPurpose,
  });
  expect(body.update.patient).toMatchObject({ weightKg: validInput.weightKg });
});

test("encounter update core enforces reception update permission", async () => {
  const denied = await createReceptionEncounterUpdate({
    actorUserId: "user-vet",
    encounterId,
    input: validInput,
    workspaceId: "clair-demo",
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-vet", status: "active" }],
      memberships: [
        {
          id: "membership-vet",
          workspaceId: "clair-demo",
          userId: "user-vet",
          roles: ["vet"],
          status: "active",
        },
      ],
    }),
  });

  expect(denied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
});

test("encounter update core validates editable state and weight", async () => {
  const missing = await createReceptionEncounterUpdate({
    actorUserId: "user-front-desk",
    encounterId: "encounter-missing",
    input: validInput,
    workspaceId: "clair-demo",
  });
  expect(missing).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "encounter_unavailable",
  });

  const nonEditable = await createReceptionEncounterUpdate({
    actorUserId: "user-front-desk",
    encounterId: nonEditableEncounterId,
    input: validInput,
    workspaceId: "clair-demo",
  });
  expect(nonEditable).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "encounter_not_editable",
  });

  const invalidWeight = await createReceptionEncounterUpdate({
    actorUserId: "user-front-desk",
    encounterId,
    input: { ...validInput, weightKg: 0 },
    workspaceId: "clair-demo",
  });
  expect(invalidWeight).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
  });

  const invalidDuration = await createReceptionEncounterUpdate({
    actorUserId: "user-front-desk",
    encounterId,
    input: { ...validInput, durationMinutes: 22 },
    workspaceId: "clair-demo",
  });
  expect(invalidDuration).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
    fieldErrors: {
      durationMinutes: "예상 진료시간은 15분 단위로 설정해 주세요.",
    },
  });
});

test("supabase encounter update gateway keeps workspace scope in the RPC write", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionEncounterUpdateGateway({
    async rpc(functionName, args) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_encounter_id}`);
      return {
        data: {
          encounter: {
            id: encounterId,
            workspaceId: "clair-demo",
            patientId: "patient-coco",
            guardianId: "guardian-choi-dohyun",
            primaryVeterinarianId: validInput.primaryVeterinarianId,
            encounterNo: "E-260616-DBD0F0",
            receptionType: "walk_in",
            department: validInput.department,
            durationMinutes: validInput.durationMinutes,
            chiefComplaint: validInput.visitPurpose,
            visitPurpose: validInput.visitPurpose,
            receptionMemo: validInput.memo,
            status: "waiting",
            checkedInAt: "2026-06-16T12:12:00+09:00",
            createdAt: "2026-06-16T12:12:00+09:00",
            updatedAt: "2026-06-16T12:30:00+09:00",
          },
          patient: {
            id: "patient-coco",
            patientNo: "CD-P-004",
            workspaceId: "clair-demo",
            name: "초코",
            species: "dog",
            breed: "푸들",
            sex: "unknown",
            neutered: false,
            weightKg: validInput.weightKg,
            handlingCautionLocked: true,
            status: "active",
            createdAt: "2026-01-01T00:00:00+09:00",
            updatedAt: "2026-06-16T12:30:00+09:00",
          },
          queueEntry: {
            id: "queue-coco",
            workspaceId: "clair-demo",
            encounterId,
            queueType: "consultation",
            status: "waiting",
            priority: "normal",
            enteredAt: "2026-06-16T12:12:00+09:00",
          },
        },
        error: null,
      };
    },
  });

  const result = await gateway.updateEncounter({
    actorUserId: "user-front-desk",
    encounterId,
    input: validInput,
    workspaceId: "clair-demo",
  });

  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected encounter update success");
  expect(result.update.encounter.visitPurpose).toBe(validInput.visitPurpose);
  expect(result.update.patient?.weightKg).toBe(validInput.weightKg);
  expect(calls).toEqual([
    `clair_update_reception_encounter:clair-demo:${encounterId}`,
  ]);
});

test("supabase encounter update gateway preserves assigned and unassigned veterinarian patches", async () => {
  const chiefVetId = "49110000-0000-4000-8000-000000000001";
  const patches: Array<{ readonly primaryVeterinarianId?: string }> = [];
  const gateway = createSupabaseReceptionEncounterUpdateGateway({
    async rpc(_functionName, args) {
      patches.push(args.p_patch);
      return {
        data: {
          encounter: {
            id: encounterId,
            workspaceId: "workspace-clair-cheongdam",
            patientId: "49121000-0000-4000-8000-000000000081",
            guardianId: "49120000-0000-4000-8000-000000000081",
            primaryVeterinarianId: args.p_patch.primaryVeterinarianId,
            encounterNo: "E-260623-VET",
            receptionType: "walk_in",
            department: args.p_patch.department,
            durationMinutes: args.p_patch.durationMinutes,
            chiefComplaint: args.p_patch.visitPurpose,
            visitPurpose: args.p_patch.visitPurpose,
            receptionMemo: args.p_patch.memo,
            status: "waiting",
            checkedInAt: "2026-06-23T10:30:00+09:00",
            createdAt: "2026-06-23T10:30:00+09:00",
            updatedAt: "2026-06-23T10:35:00+09:00",
          },
          queueEntry: {
            id: "queue-cheongdam-vet-assignment",
            workspaceId: "workspace-clair-cheongdam",
            encounterId,
            queueType: "consultation",
            status: "waiting",
            priority: "normal",
            enteredAt: "2026-06-23T10:30:00+09:00",
          },
        },
        error: null,
      };
    },
  });

  const assigned = await gateway.updateEncounter({
    actorUserId: "49110000-0000-4000-8000-000000000005",
    encounterId,
    input: { ...validInput, primaryVeterinarianId: chiefVetId },
    workspaceId: "workspace-clair-cheongdam",
  });
  const unassigned = await gateway.updateEncounter({
    actorUserId: "49110000-0000-4000-8000-000000000005",
    encounterId,
    input: { ...validInput, primaryVeterinarianId: undefined },
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(assigned).toMatchObject({
    ok: true,
    update: { encounter: { primaryVeterinarianId: chiefVetId } },
  });
  expect(unassigned).toMatchObject({
    ok: true,
    update: { encounter: { primaryVeterinarianId: undefined } },
  });
  expect(patches).toEqual([
    expect.objectContaining({ primaryVeterinarianId: chiefVetId }),
    expect.not.objectContaining({ primaryVeterinarianId: expect.any(String) }),
  ]);
});

test("supabase encounter update gateway maps invalid veterinarian denial", async () => {
  const gateway = createSupabaseReceptionEncounterUpdateGateway({
    async rpc() {
      return {
        data: null,
        error: { message: "primary_veterinarian_unavailable" },
      };
    },
  });

  const result = await gateway.updateEncounter({
    actorUserId: "49110000-0000-4000-8000-000000000005",
    encounterId,
    input: {
      ...validInput,
      primaryVeterinarianId: "00000000-0000-4000-8000-000000000099",
    },
    workspaceId: "workspace-clair-cheongdam",
  });

  expect(result).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "primary_veterinarian_unavailable",
  });
});

test("encounter update route stays server-owned and avoids secret-shaped values", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/encounters/[encounterId]/route.ts",
    "utf8",
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseWorkspacePermissionGateway");
  expect(routeSource).toContain("permissionAdapter");
  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(routeSource).not.toContain("SUPABASE_SERVICE_ROLE");
  expect(routeSource).not.toContain("service_role");
});

test("encounter update writer migration updates encounter and patient weight", () => {
  const migration = readFileSync(
    "supabase/migrations/20260616102000_reception_encounter_update_writer.sql",
    "utf8",
  );

  expect(migration).toContain("clair_update_reception_encounter");
  expect(migration).toContain("v_actor_user_id");
  expect(migration).toContain("from public.user_memberships");
  expect(migration).not.toContain(
    "private.clair_is_active_workspace_member(p_workspace_id, p_actor_user_id)",
  );
  expect(migration).toContain("update public.encounters");
  expect(migration).toContain("update public.patients");
  expect(migration).toContain("duration_minutes");
  expect(migration).toContain("checked_in_at");
  expect(migration).toContain("entered_at");
  expect(migration).toContain("weight_kg");
  expect(migration).toContain("reception.encounter_updated");
  expect(migration).toContain("grant execute on function public.clair_update_reception_encounter");
});
