import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockChartSoapNoteGateway,
  createSupabaseChartSoapNoteGateway,
  saveChartSoapNote,
} from "../src/features/chart/server-soap-note-persistence-core";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const migrationPath = "supabase/migrations/20260519180000_chart_soap_note_persistence_rpc.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

const validSoapInput = {
  encounterId,
  subjective: "보호자 설명: DEN-69 synthetic SOAP 저장 확인",
  objective: "활력 징후 기록",
  assessment: "업무 흐름 재현용 평가",
  plan: "업무 흐름 재현용 계획",
  mode: "autosave" as const,
};

test("SOAP note route requires an actor, saves via mock fallback, and reads after save", async ({
  request,
}) => {
  const unauthenticated = await request.patch(
    `/api/workspaces/${workspaceId}/chart/soap-notes`,
    { data: validSoapInput }
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const saved = await request.patch(`/api/workspaces/${workspaceId}/chart/soap-notes`, {
    data: validSoapInput,
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(saved.status()).toBe(200);
  const savedBody = await saved.json() as {
    ok: true;
    soapNote: {
      encounterId: string;
      subjective: string;
      status: string;
      autosavedAt?: string;
    };
    enforcedBy: string;
  };

  expect(savedBody.ok).toBe(true);
  expect(savedBody.enforcedBy).toBe("chart-soap-note-persistence");
  expect(savedBody.soapNote).toMatchObject({
    encounterId,
    subjective: validSoapInput.subjective,
    status: "autosaved",
  });
  expect(savedBody.soapNote.autosavedAt).toBeTruthy();

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/chart/soap-notes?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } }
  );
  expect(readBack.status()).toBe(200);
  const readBody = await readBack.json() as {
    ok: true;
    soapNote: { subjective: string };
  };
  expect(readBody.soapNote.subjective).toBe(validSoapInput.subjective);
});

test("SOAP note core enforces active workspace membership, chart update permission, and encounter scope", async () => {
  const frontDeskDenied = await saveChartSoapNote({
    actorUserId: "user-front-desk",
    workspaceId,
    input: validSoapInput,
    permissionAdapter: createMockWorkspacePermissionAdapter({
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
    }),
  });
  expect(frontDeskDenied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });

  const crossWorkspaceDenied = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId: "other-workspace",
    input: validSoapInput,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-vet", status: "active" }],
      memberships: [
        {
          id: "membership-vet-other",
          workspaceId: "other-workspace",
          userId: "user-vet",
          roles: ["vet"],
          status: "active",
        },
      ],
    }),
  });
  expect(crossWorkspaceDenied).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "encounter_unavailable",
  });

  const allowedVet = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId,
    input: validSoapInput,
    permissionAdapter: createMockWorkspacePermissionAdapter({
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
    gateway: createMockChartSoapNoteGateway(undefined, () => "2026-05-19T12:00:00.000Z"),
  });
  expect(allowedVet).toMatchObject({
    ok: true,
    status: 200,
    soapNote: {
      autosavedAt: "2026-05-19T12:00:00.000Z",
      status: "autosaved",
    },
  });
});

test("SOAP note Supabase gateway keeps workspace and encounter scope in RPC calls", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseChartSoapNoteGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_encounter_id}`);
      return {
        data: {
          id: "soap-db-den-69",
          encounterId,
          authorUserId: "00000000-0000-4000-8000-000000000002",
          subjective: validSoapInput.subjective,
          objective: validSoapInput.objective,
          assessment: validSoapInput.assessment,
          plan: validSoapInput.plan,
          status: "autosaved",
          autosavedAt: "2026-05-19T12:00:00.000Z",
          createdAt: "2026-05-19T12:00:00.000Z",
          updatedAt: "2026-05-19T12:00:00.000Z",
        },
        error: null,
      };
    },
  });

  const result = await gateway.saveSoapNote({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId,
    fields: {
      subjective: validSoapInput.subjective,
      objective: validSoapInput.objective,
      assessment: validSoapInput.assessment,
      plan: validSoapInput.plan,
    },
    mode: "autosave",
  });

  expect(calls).toEqual([`clair_save_chart_soap_note:${workspaceId}:${encounterId}`]);
  expect(result).toMatchObject({
    ok: true,
    soapNote: { id: "soap-db-den-69", encounterId },
  });
});

test("SOAP note persistence migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain("create or replace function public.clair_get_chart_soap_note");
  expect(migration).toContain("create or replace function public.clair_save_chart_soap_note");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migration).toContain("from public.encounters e");
  expect(migration).toContain("from public.soap_notes s");
  expect(migration).toContain("status = case when status = 'waiting' then 'in_consultation'");
  expect(migration).toContain("grant execute on function public.clair_save_chart_soap_note");
  expect(migration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
});

test("SOAP note route stays server-owned and secret-free", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/soap-notes/route.ts",
    "utf8"
  );
  const serverSource = readFileSync(
    "src/features/chart/server-soap-note-persistence.ts",
    "utf8"
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
