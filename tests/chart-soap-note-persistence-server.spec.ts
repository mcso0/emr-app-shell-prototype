import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockChartSoapNoteGateway,
  createSupabaseChartSoapNoteGateway,
  saveChartSoapNote,
} from "../src/features/chart/server-soap-note-persistence-core";
import type { Encounter } from "../src/types/emr-domain";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const migrationPath = "supabase/migrations/20260519180000_chart_soap_note_persistence_rpc.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const hotfixMigrationPath =
  "supabase/migrations/20260830203427_chart_soap_note_rpc_signature_drift_hotfix.sql";
const hotfixMigration = existsSync(hotfixMigrationPath)
  ? readFileSync(hotfixMigrationPath, "utf8")
  : "";
const blockDocumentMigrationPath =
  "supabase/migrations/20260831120000_chart_soap_block_document.sql";
const blockDocumentMigration = existsSync(blockDocumentMigrationPath)
  ? readFileSync(blockDocumentMigrationPath, "utf8")
  : "";

const validBlockDocument = {
  schemaVersion: 1 as const,
  blocks: [
    {
      id: "section-subjective",
      type: "soapSection",
      props: {
        kind: "subjective",
        label: "주관적",
        systemLabel: "기본 SOAP",
        scope: "default",
      },
      children: [
        {
          id: "subjective-text",
          type: "paragraph",
          props: {
            backgroundColor: "default",
            textColor: "default",
            textAlignment: "left",
          },
          content: [{ type: "text", text: "블록 보호자 진술", styles: {} }],
          children: [],
        },
      ],
    },
  ],
};

const validSoapInput = {
  encounterId,
  blockDocument: validBlockDocument,
  subjective: "블록 보호자 진술",
  objective: "",
  assessment: "",
  plan: "",
  mode: "autosave" as const,
};

const waitingEncounter: Encounter = {
  id: "encounter-soap-waiting-lock",
  workspaceId,
  patientId: "patient-soap-waiting-lock",
  guardianId: "guardian-soap-waiting-lock",
  encounterNo: "E-SOAP-LOCK",
  status: "waiting",
  checkedInAt: "2026-06-25T14:15:00+09:00",
  createdAt: "2026-06-25T14:15:00+09:00",
  updatedAt: "2026-06-25T14:15:00+09:00",
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

test("SOAP note core validates canonical JSON and derives legacy projections instead of trusting client fields", async () => {
  let receivedFields: Record<string, string> | undefined;
  const result = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      ...validSoapInput,
      subjective: "클라이언트가 보낸 불일치 문자열",
      blockDocument: validBlockDocument,
    },
    gateway: {
      async saveSoapNote(input) {
        receivedFields = input.fields;
        return {
          ok: true,
          soapNote: {
            id: "soap-block-document",
            encounterId,
            authorUserId: "user-vet",
            ...input.fields,
            blockDocument: input.blockDocument,
            status: "autosaved",
            createdAt: "2026-08-31T00:00:00.000Z",
            updatedAt: "2026-08-31T00:00:00.000Z",
          },
        };
      },
    },
  });

  expect(receivedFields).toEqual({
    subjective: "블록 보호자 진술",
    objective: "",
    assessment: "",
    plan: "",
  });
  expect(result).toMatchObject({
    ok: true,
    soapNote: {
      blockDocument: validBlockDocument,
      subjective: "블록 보호자 진술",
    },
  });

  const rejected = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      encounterId,
      blockDocument: { ...validBlockDocument, schemaVersion: 2 },
    },
  });
  expect(rejected).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
    fieldErrors: { blockDocument: "지원하지 않는 SOAP 문서 버전입니다." },
  });
});

test("SOAP note core preserves the canonical Unicode field-length boundary", async () => {
  const maxDocument = structuredClone(validBlockDocument);
  maxDocument.blocks[0]!.children[0]!.content[0]!.text = "😀".repeat(10_000);

  const accepted = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      encounterId,
      blockDocument: maxDocument,
    },
    gateway: {
      async saveSoapNote(input) {
        return {
          ok: true,
          soapNote: {
            id: "soap-unicode-max",
            encounterId,
            authorUserId: "user-vet",
            ...input.fields,
            blockDocument: input.blockDocument,
            status: "autosaved",
            createdAt: "2026-08-31T00:00:00.000Z",
            updatedAt: "2026-08-31T00:00:00.000Z",
          },
        };
      },
    },
  });
  expect(accepted).toMatchObject({
    ok: true,
    soapNote: { subjective: "😀".repeat(10_000) },
  });

  const oversizedDocument = structuredClone(maxDocument);
  oversizedDocument.blocks[0]!.children[0]!.content[0]!.text = "😀".repeat(10_001);
  const rejected = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      encounterId,
      blockDocument: oversizedDocument,
    },
  });
  expect(rejected).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
    fieldErrors: { blockDocument: "SOAP 문서가 허용된 크기를 초과했습니다." },
  });
});

test("SOAP note core rejects an implicit legacy-shaped write that omits the canonical document", async () => {
  const result = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      encounterId,
      subjective: "이 요청은 기존 canonical 문서를 지우면 안 됩니다.",
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
    fieldErrors: { blockDocument: "SOAP 블록 문서가 필요합니다." },
  });
});

test("SOAP note core fails closed when a required audit append fails", async () => {
  const result = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId,
    input: validSoapInput,
    auditGateway: {
      async appendEvent() {
        return { ok: false, status: 500, error: "db_write_failed" };
      },
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 500,
    error: "db_write_failed",
  });
});

test("SOAP note core falls back when a database audit marker is false or incomplete", async () => {
  let fallbackAuditCalls = 0;
  const incompleteMarkers = [
    {
      auditHandledBy: "database_transaction" as const,
      auditRecorded: false,
    },
    {
      auditHandledBy: "database_transaction" as const,
      auditRecorded: true,
    },
  ];

  for (const marker of incompleteMarkers) {
    const result = await saveChartSoapNote({
      actorUserId: "user-vet",
      workspaceId,
      input: validSoapInput,
      gateway: {
        async saveSoapNote(input) {
          return {
            ok: true,
            soapNote: {
              id: `soap-fallback-audit-${fallbackAuditCalls}`,
              encounterId,
              authorUserId: "user-vet",
              ...input.fields,
              blockDocument: input.blockDocument,
              status: "autosaved",
              createdAt: "2026-08-31T00:00:00.000Z",
              updatedAt: "2026-08-31T00:00:00.000Z",
            },
            ...marker,
          };
        },
      },
      auditGateway: {
        async appendEvent(event) {
          fallbackAuditCalls += 1;
          return { ok: true, event };
        },
      },
    });

    expect(result).toMatchObject({ ok: true, auditRecorded: true });
  }

  expect(fallbackAuditCalls).toBe(2);
});

test("SOAP note core trusts a complete database-transaction audit marker without appending a duplicate", async () => {
  let fallbackAuditCalls = 0;
  const result = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId,
    input: validSoapInput,
    gateway: {
      async saveSoapNote(input) {
        return {
          ok: true,
          soapNote: {
            id: "soap-transactional-audit",
            encounterId,
            authorUserId: "user-vet",
            ...input.fields,
            blockDocument: input.blockDocument,
            status: "autosaved",
            createdAt: "2026-08-31T00:00:00.000Z",
            updatedAt: "2026-08-31T00:00:00.000Z",
          },
          auditHandledBy: "database_transaction",
          auditRecorded: true,
          auditEventId: "chart-soap-save-audit-1",
        };
      },
    },
    auditGateway: {
      async appendEvent() {
        fallbackAuditCalls += 1;
        return { ok: false, status: 500, error: "db_write_failed" };
      },
    },
  });

  expect(fallbackAuditCalls).toBe(0);
  expect(result).toMatchObject({ ok: true, auditRecorded: true });
});

test("SOAP note core rejects stale expectedUpdatedAt when another tab saved first", async () => {
  const nowValues = [
    "2026-05-19T12:00:00.000Z",
    "2026-05-19T12:01:00.000Z",
  ];
  const gateway = createMockChartSoapNoteGateway(
    undefined,
    () => nowValues.shift() ?? "2026-05-19T12:02:00.000Z",
  );
  const permissionAdapter = createMockWorkspacePermissionAdapter({
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
  });

  const firstSave = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId,
    input: { ...validSoapInput },
    permissionAdapter,
    gateway,
  });
  expect(firstSave).toMatchObject({
    ok: true,
    status: 200,
    soapNote: { updatedAt: "2026-05-19T12:00:00.000Z" },
  });

  const staleSave = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      ...validSoapInput,
      subjective: "다른 탭의 오래된 저장",
      expectedUpdatedAt: "2026-05-19T11:59:00.000Z",
    },
    permissionAdapter,
    gateway,
  });
  expect(staleSave).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "soap_note_conflict",
  });
});

test("SOAP note core blocks chart mutation before consultation starts", async () => {
  const blocked = await saveChartSoapNote({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      ...validSoapInput,
      encounterId: waitingEncounter.id,
    },
    gateway: createMockChartSoapNoteGateway({
      encounters: [{ ...waitingEncounter }],
      soapNotes: [],
    }),
  });

  expect(blocked).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "stale_status",
  });
});

test("SOAP note Supabase gateway keeps workspace and encounter scope in RPC calls", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const gateway = createSupabaseChartSoapNoteGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ functionName, args });
      return {
        data: {
          id: "soap-db-den-69",
          encounterId,
          authorUserId: "00000000-0000-4000-8000-000000000002",
          subjective: "\u00a0블록 보호자 진술\u00a0",
          objective: validSoapInput.objective,
          assessment: validSoapInput.assessment,
          plan: validSoapInput.plan,
          status: "autosaved",
          autosavedAt: "2026-05-19T12:00:00.000Z",
          createdAt: "2026-05-19T12:00:00.000Z",
          updatedAt: "2026-05-19T12:00:00.000Z",
          auditHandledBy: "database_transaction",
          auditRecorded: true,
          auditEventId: "chart-soap-save-db-audit",
        },
        error: null,
      };
    },
  });

  const result = await gateway.saveSoapNote({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId,
    expectedUpdatedAt: "2026-05-19T12:00:00.000Z",
    fields: {
      subjective: validSoapInput.subjective,
      objective: validSoapInput.objective,
      assessment: validSoapInput.assessment,
      plan: validSoapInput.plan,
    },
    blockDocument: validBlockDocument,
    mode: "autosave",
    requestId: "request-soap-save-1",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    functionName: "clair_save_chart_soap_note_v2",
    args: {
      p_workspace_id: workspaceId,
      p_actor_user_id: "00000000-0000-4000-8000-000000000002",
      p_encounter_id: encounterId,
      p_expected_updated_at: "2026-05-19T12:00:00.000Z",
      p_mode: "autosave",
      p_request_id: "request-soap-save-1",
      p_note: {
        blockDocument: validBlockDocument,
        subjective: validSoapInput.subjective,
      },
    },
  });
  expect(result).toMatchObject({
    ok: true,
    soapNote: {
      id: "soap-db-den-69",
      encounterId,
      subjective: "\u00a0블록 보호자 진술\u00a0",
    },
    auditHandledBy: "database_transaction",
    auditRecorded: true,
    auditEventId: "chart-soap-save-db-audit",
  });
});

test("SOAP BlockNote migration keeps canonical JSON and legacy projections inside the guarded RPC boundary", () => {
  expect(blockDocumentMigration).toContain("add column if not exists block_document jsonb");
  expect(blockDocumentMigration).toContain("block_document_schema_version smallint");
  expect(blockDocumentMigration).toContain("soap_notes_block_document_pair_check");
  expect(blockDocumentMigration).toContain("octet_length(block_document::text) <= 262144");
  expect(blockDocumentMigration).toContain("private.clair_soap_document_field");
  expect(blockDocumentMigration).toContain("private.clair_soap_document_is_valid");
  expect(blockDocumentMigration).toContain(
    "and jsonb_array_length(v_block->'children') > 0",
  );
  expect(blockDocumentMigration).toContain("v_block_count > 400");
  expect(blockDocumentMigration).toContain("or v_id = any(v_ids)");
  expect(blockDocumentMigration).toContain("private.clair_soap_inline_is_valid");
  expect(blockDocumentMigration).toContain("private.clair_soap_link_is_valid");
  expect(blockDocumentMigration).toContain(
    "or not private.clair_soap_link_is_valid(v_inline->>'href')",
  );
  expect(blockDocumentMigration).toContain("private.clair_soap_styles_are_valid");
  expect(blockDocumentMigration).toContain(
    "private.clair_soap_trim_boundary_whitespace",
  );
  expect(blockDocumentMigration).toContain("char_length(v_subjective) > 10000");
  expect(blockDocumentMigration).toContain("if p_depth = 0 then");
  expect(blockDocumentMigration).toContain("jsonb_typeof(p_document) is distinct from 'object'");
  expect(blockDocumentMigration).toContain("soap_document_projection_mismatch");
  expect(blockDocumentMigration).toContain(
    "private.clair_guard_legacy_soap_projection_update",
  );
  expect(blockDocumentMigration).toContain(
    "raise exception 'soap_client_upgrade_required'",
  );
  expect(blockDocumentMigration).toContain("'blockDocument', case");
  expect(blockDocumentMigration).toContain("block_document = v_document->'blocks'");
  expect(blockDocumentMigration).toContain("raise exception 'block_document_required'");
  expect(blockDocumentMigration).toContain(
    "if p_mode is null or p_mode not in ('autosave', 'manual_save')",
  );
  expect(blockDocumentMigration).toContain("raise exception 'invalid_save_mode'");
  expect(blockDocumentMigration).toContain("public.clair_append_audit_event");
  expect(blockDocumentMigration).toContain("'auditHandledBy', 'database_transaction'");
  expect(blockDocumentMigration).not.toContain(
    "select public.clair_get_chart_soap_note(p_workspace_id, p_encounter_id)",
  );
  expect(blockDocumentMigration).toContain(
    "create or replace function public.clair_save_chart_soap_note(",
  );
  expect(blockDocumentMigration).toContain("set search_path = ''");
  expect(blockDocumentMigration).toContain("chart:view");
  expect(blockDocumentMigration).toContain("chart:update");
  expect(blockDocumentMigration).toContain("v_actor_user_id is distinct from auth.uid()");
  expect(blockDocumentMigration).toContain("raise exception 'soap_note_conflict'");
  expect(blockDocumentMigration).toContain(
    "revoke all on function public.clair_get_chart_soap_note(text, uuid) from anon",
  );
  expect(blockDocumentMigration).toContain(
    "grant execute on function public.clair_save_chart_soap_note_v2(text, text, uuid, jsonb, timestamptz, text, text) to authenticated",
  );
  expect(blockDocumentMigration).toContain(
    "grant execute on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) to authenticated",
  );
  expect(blockDocumentMigration).not.toContain(
    "drop function if exists public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text)",
  );
  expect(blockDocumentMigration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("SOAP note persistence migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain("create or replace function public.clair_get_chart_soap_note");
  expect(migration).toContain("create or replace function public.clair_save_chart_soap_note");
  expect(migration).toContain("p_expected_updated_at timestamptz default null");
  expect(migration).toContain("raise exception 'soap_note_conflict'");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migration).toContain("from public.encounters e");
  expect(migration).toContain("from public.soap_notes s");
  expect(migration).toContain("status = case when status = 'waiting' then 'in_consultation'");
  expect(migration).toContain("grant execute on function public.clair_save_chart_soap_note");
  expect(migration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
});

test("SOAP note forward migration converges the live RPC signature and enforces direct-call gates", () => {
  expect(hotfixMigration).toContain(
    "drop function if exists public.clair_save_chart_soap_note(text, text, uuid, jsonb, text)"
  );
  expect(hotfixMigration).toContain(
    "drop function if exists public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text)"
  );
  expect(hotfixMigration).toContain("p_expected_updated_at timestamptz default null");
  expect(hotfixMigration).toContain("v_actor_user_id is distinct from auth.uid()");
  expect(hotfixMigration).toContain(
    "private.clair_current_user_has_workspace_permission(p_workspace_id, 'chart:update')"
  );
  expect(hotfixMigration).toContain("v_encounter_status not in ('in_consultation', 'ordered')");
  expect(hotfixMigration).toContain("raise exception 'soap_note_conflict'");
  expect(hotfixMigration).toContain("set search_path = ''");
  expect(hotfixMigration).toContain(
    "grant execute on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) to authenticated"
  );
  expect(hotfixMigration).toContain(
    "revoke all on function public.clair_save_chart_soap_note(text, text, uuid, jsonb, timestamptz, text) from anon"
  );
  expect(hotfixMigration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i
  );
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
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("permissionAdapter");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
