import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  normalizeCommandSearchQuery,
  shouldRunCommandSearch,
} from "../src/features/command/command-search";
import { searchCommand } from "../src/features/command/server-command-search-core";
import type { ReceptionPatientGuardianLookupItem } from "../src/features/reception/patient-guardian-lookup";
import type { ReceptionQueueReadRecord } from "../src/features/reception/reception-queue-read";
import type { WorkspaceStaffMember } from "../src/features/staff/server-workspace-staff-core";
import type { Guardian, Patient } from "../src/types/emr-domain";

const workspaceId = "workspace-clair-cheongdam";
const actorUserId = "user-front-desk";
const now = "2026-07-05T09:00:00+09:00";

test("command search normalizes query thresholds", () => {
  expect(normalizeCommandSearchQuery("  해피   박보호  ")).toBe("해피 박보호");
  expect(shouldRunCommandSearch("해")).toBe(true);
  expect(shouldRunCommandSearch("h")).toBe(true);
  expect(shouldRunCommandSearch("ha")).toBe(true);
  expect(shouldRunCommandSearch("010")).toBe(true);
  expect(shouldRunCommandSearch("0")).toBe(true);
});

test("command search returns seeded patient and guardian results from the lookup gateway", async () => {
  const patient = createPatient();
  const guardian = createGuardian();
  const result = await searchCommand({
    actorUserId,
    workspaceId,
    query: "해피",
    permissionAdapter: createCommandPermissionAdapter(["patient:view", "reception:view"]),
    patientGuardianGateway: createPatientGateway([{ patient, primaryGuardian: guardian }]),
    receptionQueueGateway: createQueueGateway([]),
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    sourceState: { patientGuardian: "ready", reception: "ready", staff: "ready" },
  });
  expect(result.ok && result.results.map((item) => item.id)).toEqual([
    "patient-patient-cheongdam-happy",
    "guardian-guardian-cheongdam-protector",
  ]);
  expect(result.ok && result.results[0]).toMatchObject({
    kind: "patient",
    title: "해피",
    href: `/w/${workspaceId}/reception?modulePanel=open&patientId=patient-cheongdam-happy&drawer=reception-patient%3Apatient-cheongdam-happy`,
  });
});

test("command search maps today appointment and encounter queue results", async () => {
  const patient = createPatient();
  const guardian = createGuardian();
  const result = await searchCommand({
    actorUserId,
    workspaceId,
    query: "해피",
    permissionAdapter: createCommandPermissionAdapter(["patient:view", "reception:view"]),
    patientGuardianGateway: createPatientGateway([]),
    receptionQueueGateway: createQueueGateway([
      {
        kind: "appointment",
        appointment: {
          id: "appointment-cheongdam-happy",
          workspaceId,
          patientId: patient.id,
          guardianId: guardian.id,
          scheduledStartAt: now,
          visitPurpose: "예방접종",
          status: "confirmed",
          createdAt: now,
          updatedAt: now,
        },
        patient,
        primaryGuardian: guardian,
      },
      {
        kind: "encounter_queue",
        encounter: {
          id: "encounter-cheongdam-happy",
          workspaceId,
          patientId: patient.id,
          guardianId: guardian.id,
          encounterNo: "CD-EN-001",
          receptionType: "walk_in",
          visitPurpose: "구토",
          status: "waiting",
          checkedInAt: now,
          createdAt: now,
          updatedAt: now,
        },
        patient,
        primaryGuardian: guardian,
        queueEntry: {
          id: "queue-cheongdam-happy",
          workspaceId,
          encounterId: "encounter-cheongdam-happy",
          queueType: "consultation",
          status: "waiting",
          priority: "normal",
          enteredAt: now,
        },
      },
    ]),
  });

  expect(result.ok && result.results.map((item) => item.id)).toEqual([
    "appointment-appointment-cheongdam-happy",
    "encounter-encounter-cheongdam-happy",
  ]);
});

test("command search returns matching staff members and routes to member management", async () => {
  const result = await searchCommand({
    actorUserId,
    workspaceId,
    query: "김",
    filter: "vet",
    permissionAdapter: createCommandPermissionAdapter(["patient:view", "reception:view"]),
    patientGuardianGateway: createPatientGateway([]),
    receptionQueueGateway: createQueueGateway([]),
    staffGateway: createStaffGateway([
      {
        id: "user-cheongdam-vet",
        displayName: "김청담",
        initial: "KD",
        roles: ["vet"],
        status: "active",
        title: "수의사",
        department: "진료팀",
      },
      {
        id: "user-cheongdam-desk",
        displayName: "박데스크",
        roles: ["front_desk"],
        status: "active",
        title: "데스크",
      },
    ]),
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    sourceState: { patientGuardian: "skipped", reception: "ready", staff: "ready" },
  });
  expect(result.ok && result.results).toEqual([
    expect.objectContaining({
      id: "staff-user-cheongdam-vet",
      kind: "staff",
      title: "김청담",
      badge: "구성원",
      href: `/w/${workspaceId}/hospital-admin?modulePanel=open&section=members`,
    }),
  ]);
});

test("command search does not leak patient data when patient permission is missing", async () => {
  const result = await searchCommand({
    actorUserId,
    workspaceId,
    query: "해피",
    permissionAdapter: createCommandPermissionAdapter(["reception:view"]),
    patientGuardianGateway: createPatientGateway([{ patient: createPatient(), primaryGuardian: createGuardian() }]),
    receptionQueueGateway: createQueueGateway([]),
  });

  expect(result).toMatchObject({
    ok: true,
    sourceState: { patientGuardian: "permission_denied", reception: "ready", staff: "ready" },
  });
  expect(result.ok && result.results).toEqual([]);
});

test("Cheongdam command search keeps legacy mock fixtures out of the default seed workspace", async () => {
  const result = await searchCommand({
    actorUserId,
    workspaceId,
    query: "콩이",
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    sourceState: { patientGuardian: "ready", reception: "ready", staff: "ready" },
  });
  expect(result.ok && result.results).toEqual([]);
});

test("command search route requires an authenticated actor and supports demo fallback explicitly", async ({
  request,
}) => {
  const unauthenticated = await request.get(
    "/api/workspaces/clair-demo/command/search?query=콩이",
  );
  expect(unauthenticated.status()).toBe(401);

  const demo = await request.get("/api/workspaces/clair-demo/command/search?query=콩이", {
    headers: { "x-clair-demo-session-user-id": "user-front-desk" },
  });
  expect(demo.status()).toBe(200);
  const body = await demo.json() as {
    ok: true;
    enforcedBy: string;
    results: Array<{ id: string; title: string }>;
  };

  expect(body.ok).toBe(true);
  expect(body.enforcedBy).toBe("command-search");
  expect(body.results.some((item) => item.id === "patient-patient-kong")).toBe(true);
});

function createCommandPermissionAdapter(permissionIds: string[]) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [
      {
        id: "membership-cheongdam-front-desk",
        workspaceId,
        userId: actorUserId,
        roles: ["front_desk"],
        permissionRole: {
          key: "test-role",
          label: "Test Role",
          roleType: "custom",
          permissionIds: permissionIds as never,
        },
        status: "active",
      },
    ],
  });
}

function createPatient(): Patient {
  return {
    id: "patient-cheongdam-happy",
    workspaceId,
    patientNo: "CD-P-0001",
    name: "해피",
    species: "dog",
    breed: "말티즈",
    sex: "female",
    neutered: true,
    handlingCautionLocked: true,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function createGuardian(): Guardian {
  return {
    id: "guardian-cheongdam-protector",
    workspaceId,
    name: "박보호",
    mobilePhone: "010-4911-0001",
    createdAt: now,
    updatedAt: now,
  };
}

function createPatientGateway(items: ReceptionPatientGuardianLookupItem[]) {
  return {
    async searchPatientGuardianLookup() {
      return { ok: true as const, patients: items };
    },
  };
}

function createQueueGateway(queue: ReceptionQueueReadRecord[]) {
  return {
    async listReceptionQueue() {
      return { ok: true as const, queue };
    },
  };
}

function createStaffGateway(staff: WorkspaceStaffMember[]) {
  return {
    async listWorkspaceStaff() {
      return { ok: true as const, staff };
    },
  };
}
