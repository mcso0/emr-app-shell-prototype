import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseReceptionPatientGuardianRegistrationGateway,
  registerReceptionPatientGuardian,
} from "../src/features/reception/server-patient-guardian-registration-core";

const validRegistrationInput = {
  mode: "new_guardian_patient" as const,
  guardian: {
    birthDate: "1993-11-23",
    name: "김새봄",
    mobilePhone: "010-2222-3333",
    privacyConsent: true,
    marketingConsent: true,
  },
  patient: {
    name: "새롬",
    species: "dog" as const,
    breed: "푸들",
    estimatedAgeText: "2년",
    sex: "male" as const,
    neutered: true,
  },
};

test("reception patient guardian registration route requires an actor and preserves mock fallback", async ({
  request,
}) => {
  const unauthenticated = await request.post(
    "/api/workspaces/clair-demo/reception/patient-guardian-registration",
    { data: validRegistrationInput }
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const mockFallback = await request.post(
    "/api/workspaces/clair-demo/reception/patient-guardian-registration",
    {
      data: validRegistrationInput,
      headers: { "x-clair-demo-session-user-id": "user-front-desk" },
    }
  );
  expect(mockFallback.status()).toBe(201);
  const body = await mockFallback.json() as {
    ok: true;
    workspaceId: string;
    registration: {
      guardian: { id: string; workspaceId: string; name: string };
      patient: { id: string; workspaceId: string; name: string };
      patientGuardian: { patientId: string; guardianId: string; isPrimary: boolean };
      consents: Array<{ consentType: string }>;
    };
    enforcedBy: string;
  };

  expect(body.ok).toBe(true);
  expect(body.workspaceId).toBe("clair-demo");
  expect(body.enforcedBy).toBe("reception-patient-guardian-registration");
  expect(body.registration.guardian).toMatchObject({
    workspaceId: "clair-demo",
    name: "김새봄",
  });
  expect(body.registration.patient).toMatchObject({
    workspaceId: "clair-demo",
    name: "새롬",
  });
  expect(body.registration.patientGuardian).toMatchObject({
    patientId: body.registration.patient.id,
    guardianId: body.registration.guardian.id,
    isPrimary: true,
  });
  expect(body.registration.consents.map((consent) => consent.consentType)).toContain("privacy");
  expect(body.registration.consents.map((consent) => consent.consentType)).toContain("marketing");
});

test("reception registration core enforces reception create permission", async () => {
  const denied = await registerReceptionPatientGuardian({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    input: validRegistrationInput,
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

test("reception registration core rejects missing or future birth dates", async () => {
  const missingDates = await registerReceptionPatientGuardian({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: {
      ...validRegistrationInput,
      guardian: {
        ...validRegistrationInput.guardian,
        birthDate: undefined,
      },
      patient: {
        ...validRegistrationInput.patient,
        estimatedAgeText: undefined,
      },
    },
  });

  expect(missingDates).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: {
      guardianBirthDate: "보호자 생년월일은 필수입니다.",
      patientAge: "환자 나이 또는 생년월일은 필수입니다.",
    },
  });

  const futureDates = await registerReceptionPatientGuardian({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: {
      ...validRegistrationInput,
      guardian: {
        ...validRegistrationInput.guardian,
        birthDate: "2026-05-02",
      },
      patient: {
        ...validRegistrationInput.patient,
        birthDate: "2026-05-02",
      },
    },
  });

  expect(futureDates).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: {
      guardianBirthDate: "보호자 생년월일을 올바르게 입력해 주세요.",
      patientBirthDate: "환자 생년월일을 올바르게 입력해 주세요.",
    },
  });
});

test("reception registration core returns stable duplicate denials", async () => {
  const duplicateGuardian = await registerReceptionPatientGuardian({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: {
      ...validRegistrationInput,
      guardian: {
        ...validRegistrationInput.guardian,
        mobilePhone: "010-3245-1188",
      },
    },
  });

  expect(duplicateGuardian).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "duplicate_guardian_mobile_phone",
  });

  const duplicateMicrochip = await registerReceptionPatientGuardian({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: {
      ...validRegistrationInput,
      guardian: {
        ...validRegistrationInput.guardian,
        mobilePhone: "010-2999-0000",
      },
      patient: {
        ...validRegistrationInput.patient,
        microchipNo: "410098765432109",
      },
    },
  });

  expect(duplicateMicrochip).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "duplicate_patient_microchip",
  });
});

test("supabase reception registration gateway keeps workspace scope in the RPC write", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseReceptionPatientGuardianRegistrationGateway({
    async rpc(functionName, args) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_registration.patient.name}`);
      return {
        data: {
          guardian: {
            id: "guardian-db-saebom",
            workspaceId: "clair-demo",
            name: "김새봄",
            mobilePhone: "010-2222-3333",
            createdAt: "2026-05-19T00:00:00.000Z",
            updatedAt: "2026-05-19T00:00:00.000Z",
          },
          patient: {
            id: "patient-db-saerom",
            workspaceId: "clair-demo",
            patientNo: "P-DB-0002",
            name: "새롬",
            species: "dog",
            breed: "푸들",
            sex: "male",
            neutered: true,
            handlingCautionLocked: true,
            status: "active",
            createdAt: "2026-05-19T00:00:00.000Z",
            updatedAt: "2026-05-19T00:00:00.000Z",
          },
          patientGuardian: {
            id: "pg-db-saerom",
            patientId: "patient-db-saerom",
            guardianId: "guardian-db-saebom",
            relationship: "주보호자",
            isPrimary: true,
            canReceiveMessages: true,
            createdAt: "2026-05-19T00:00:00.000Z",
          },
          consents: [],
        },
        error: null,
      };
    },
  });

  const result = await gateway.registerPatientGuardian({
    actorUserId: "user-front-desk",
    workspaceId: "clair-demo",
    input: validRegistrationInput,
  });

  expect(calls).toEqual([
    "clair_register_reception_patient_guardian:clair-demo:새롬",
  ]);
  expect(result).toMatchObject({
    ok: true,
    registration: {
      guardian: { id: "guardian-db-saebom", workspaceId: "clair-demo" },
      patient: { id: "patient-db-saerom", workspaceId: "clair-demo" },
    },
  });
});

test("supabase reception registration gateway rejects a non-UUID existing guardian before RPC", async () => {
  let rpcCallCount = 0;
  const gateway = createSupabaseReceptionPatientGuardianRegistrationGateway({
    async rpc() {
      rpcCallCount += 1;
      return { data: null, error: null };
    },
  });

  const result = await gateway.registerPatientGuardian({
    actorUserId: "user-front-desk",
    workspaceId: "workspace-clair-cheongdam",
    input: {
      mode: "existing_guardian_patient",
      existingGuardianId: "guardian-lee-jieun",
      patient: validRegistrationInput.patient,
    },
  });

  expect(rpcCallCount).toBe(0);
  expect(result).toEqual({
    ok: false,
    status: 409,
    denialReason: "guardian_unavailable",
  });
});

test("reception registration route stays server-owned and avoids secret-shaped values", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/reception/patient-guardian-registration/route.ts",
    "utf8"
  );
  const serverSource = readFileSync(
    "src/features/reception/server-patient-guardian-registration.ts",
    "utf8"
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseWorkspacePermissionGateway");
  expect(routeSource).toContain("permissionAdapter");
  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

test("reception registration writer migration keeps writes workspace-scoped", () => {
  const migrationSource = readFileSync(
    "supabase/migrations/20260519110000_reception_patient_guardian_registration_writer.sql",
    "utf8"
  );

  expect(migrationSource).toContain("create or replace function public.clair_register_reception_patient_guardian");
  expect(migrationSource).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migrationSource).toContain("p_workspace_id");
  expect(migrationSource).toContain("insert into public.guardians");
  expect(migrationSource).toContain("insert into public.patients");
  expect(migrationSource).toContain("insert into public.patient_guardians");
  expect(migrationSource).toContain("insert into public.consents");
  expect(migrationSource).toContain("grant execute on function public.clair_register_reception_patient_guardian");
  expect(migrationSource).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
