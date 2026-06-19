import { expect, test } from "@playwright/test";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  getReceptionMutationPermissionContract,
  receptionMutationPermissionMatrix,
} from "../src/features/reception/reception-mutation-permissions";
import { createReceptionAppointmentCheckIn } from "../src/features/reception/server-appointment-check-in-core";
import { restoreReceptionAppointment } from "../src/features/reception/server-appointment-restore-core";
import { cancelReceptionEncounter } from "../src/features/reception/server-encounter-cancel-core";
import { restoreReceptionEncounter } from "../src/features/reception/server-encounter-restore-core";
import { createReceptionEncounterUpdate } from "../src/features/reception/server-encounter-update-core";
import { registerReceptionPatientGuardian } from "../src/features/reception/server-patient-guardian-registration-core";
import { createReceptionWalkInEncounter } from "../src/features/reception/server-walk-in-encounter-core";

const workspaceId = "clair-demo";
const appointmentId = "appointment-nabi-260501";

const validRegistrationInput = {
  mode: "new_guardian_patient" as const,
  guardian: {
    name: "김새봄",
    mobilePhone: "010-2222-3333",
    privacyConsent: true,
  },
  patient: {
    name: "새롬",
    species: "dog" as const,
    breed: "푸들",
  },
};

const validWalkInInput = {
  patientId: "patient-coco",
  guardianId: "guardian-lee-jieun",
  durationMinutes: 30,
  visitPurpose: "구토 재진 상담",
};

const activeFrontDeskPermissionAdapter = createMockWorkspacePermissionAdapter({
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

const deniedPermissionCases = [
  {
    name: "missing actor",
    actorUserId: null,
    adapter: activeFrontDeskPermissionAdapter,
    status: 401,
    denialReason: "unauthenticated",
  },
  {
    name: "inactive app user",
    actorUserId: "user-front-desk",
    adapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-front-desk", status: "inactive" }],
      memberships: [
        {
          id: "membership-front-desk",
          workspaceId,
          userId: "user-front-desk",
          roles: ["front_desk"],
          status: "active",
        },
      ],
    }),
    status: 403,
    denialReason: "inactive_user",
  },
  {
    name: "cross-workspace membership",
    actorUserId: "user-front-desk",
    adapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-front-desk", status: "active" }],
      memberships: [
        {
          id: "membership-other-workspace",
          workspaceId: "other-workspace",
          userId: "user-front-desk",
          roles: ["front_desk"],
          status: "active",
        },
      ],
    }),
    status: 403,
    denialReason: "workspace_membership_missing",
  },
  {
    name: "inactive workspace membership",
    actorUserId: "user-front-desk",
    adapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-front-desk", status: "active" }],
      memberships: [
        {
          id: "membership-front-desk",
          workspaceId,
          userId: "user-front-desk",
          roles: ["front_desk"],
          status: "inactive",
        },
      ],
    }),
    status: 403,
    denialReason: "workspace_membership_inactive",
  },
  {
    name: "role without reception create",
    actorUserId: "user-vet",
    adapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-vet", status: "active" }],
      memberships: [
        {
          id: "membership-vet",
          workspaceId,
          userId: "user-vet",
          roles: ["vet"],
          status: "active",
        },
      ],
    }),
    status: 403,
    denialReason: "permission_missing",
  },
] as const;

test("DEN-61 reception mutation permission matrix keeps all mutation writes on reception create", () => {
  expect(receptionMutationPermissionMatrix).toMatchObject({
    appointment_create: { requiredPermission: "reception:create" },
    appointment_check_in: { requiredPermission: "reception:create" },
    appointment_restore: { requiredPermission: "reception:update" },
    encounter_cancel: { requiredPermission: "reception:update" },
    encounter_restore: { requiredPermission: "reception:update" },
    encounter_update: { requiredPermission: "reception:update" },
    patient_guardian_registration: { requiredPermission: "reception:create" },
    walk_in_encounter_create: { requiredPermission: "reception:create" },
  });

  for (const mutationId of Object.keys(receptionMutationPermissionMatrix) as Array<
    keyof typeof receptionMutationPermissionMatrix
  >) {
    const contract = getReceptionMutationPermissionContract(mutationId);
    expect(contract.auditHookPoint).toMatch(/^reception\./);
  }
});

for (const permissionCase of deniedPermissionCases) {
  test(`DEN-61 patient guardian registration denies ${permissionCase.name}`, async () => {
    const result = await registerReceptionPatientGuardian({
      actorUserId: permissionCase.actorUserId,
      workspaceId,
      input: validRegistrationInput,
      permissionAdapter: permissionCase.adapter,
    });

    expect(result).toMatchObject({
      ok: false,
      status: permissionCase.status,
      denialReason: permissionCase.denialReason,
    });
  });

  test(`DEN-61 walk-in encounter creation denies ${permissionCase.name}`, async () => {
    const result = await createReceptionWalkInEncounter({
      actorUserId: permissionCase.actorUserId,
      workspaceId,
      input: validWalkInInput,
      permissionAdapter: permissionCase.adapter,
    });

    expect(result).toMatchObject({
      ok: false,
      status: permissionCase.status,
      denialReason: permissionCase.denialReason,
    });
  });

  test(`DEN-61 appointment check-in denies ${permissionCase.name}`, async () => {
    const result = await createReceptionAppointmentCheckIn({
      actorUserId: permissionCase.actorUserId,
      appointmentId,
      workspaceId,
      permissionAdapter: permissionCase.adapter,
    });

    expect(result).toMatchObject({
      ok: false,
      status: permissionCase.status,
      denialReason: permissionCase.denialReason,
    });
  });

  test(`DEN-510 encounter cancel denies ${permissionCase.name}`, async () => {
    const result = await cancelReceptionEncounter({
      actorUserId: permissionCase.actorUserId,
      encounterId: "encounter-coco-260501",
      workspaceId,
      permissionAdapter: permissionCase.adapter,
    });

    expect(result).toMatchObject({
      ok: false,
      status: permissionCase.status,
      denialReason: permissionCase.denialReason,
    });
  });

  test(`reception encounter restore denies ${permissionCase.name}`, async () => {
    const result = await restoreReceptionEncounter({
      actorUserId: permissionCase.actorUserId,
      encounterId: "encounter-coco-260501",
      workspaceId,
      permissionAdapter: permissionCase.adapter,
    });

    expect(result).toMatchObject({
      ok: false,
      status: permissionCase.status,
      denialReason: permissionCase.denialReason,
    });
  });

  test(`reception appointment restore denies ${permissionCase.name}`, async () => {
    const result = await restoreReceptionAppointment({
      actorUserId: permissionCase.actorUserId,
      appointmentId,
      workspaceId,
      permissionAdapter: permissionCase.adapter,
    });

    expect(result).toMatchObject({
      ok: false,
      status: permissionCase.status,
      denialReason: permissionCase.denialReason,
    });
  });

  test(`DEN-517 encounter update denies ${permissionCase.name}`, async () => {
    const result = await createReceptionEncounterUpdate({
      actorUserId: permissionCase.actorUserId,
      encounterId: "encounter-coco-260501",
      workspaceId,
      input: { durationMinutes: 30, visitPurpose: "구토 재진" },
      permissionAdapter: permissionCase.adapter,
    });

    expect(result).toMatchObject({
      ok: false,
      status: permissionCase.status,
      denialReason: permissionCase.denialReason,
    });
  });
}

test("DEN-61 front desk mutation permission still allows existing mock fallback writes", async () => {
  const registration = await registerReceptionPatientGuardian({
    actorUserId: "user-front-desk",
    workspaceId,
    input: validRegistrationInput,
    permissionAdapter: activeFrontDeskPermissionAdapter,
  });
  expect(registration.ok).toBe(true);

  const walkIn = await createReceptionWalkInEncounter({
    actorUserId: "user-front-desk",
    workspaceId,
    input: validWalkInInput,
    permissionAdapter: activeFrontDeskPermissionAdapter,
  });
  expect(walkIn.ok).toBe(true);

  const appointmentCheckIn = await createReceptionAppointmentCheckIn({
    actorUserId: "user-front-desk",
    appointmentId,
    workspaceId,
    permissionAdapter: activeFrontDeskPermissionAdapter,
  });
  expect(appointmentCheckIn.ok).toBe(true);

  const cancel = await cancelReceptionEncounter({
    actorUserId: "user-front-desk",
    encounterId: "encounter-haru-260430",
    workspaceId,
    permissionAdapter: activeFrontDeskPermissionAdapter,
  });
  expect(cancel.ok).toBe(true);
});
