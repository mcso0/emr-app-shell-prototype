import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { resolveServerChartEncounterId } from "../src/features/chart/server-encounter-id-bridge-core";
import { chartOrderExpectedEtagHeader } from "../src/features/chart/order-version-contract";
import {
  createMockChartOrderDraftGateway,
  createSupabaseChartOrderDraftGateway,
  readChartOrderDraft,
  saveChartOrderDraft,
} from "../src/features/chart/server-order-draft-persistence-core";
import {
  createMockOrderCatalogGateway,
  type OrderSet,
} from "../src/features/hospital-admin/server-order-catalog-core";
import type { Encounter } from "../src/types/emr-domain";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const migrationPath =
  "supabase/migrations/20260519210000_chart_order_draft_persistence_rpc.sql";
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";
const catalogDraftMigrationPath =
  "supabase/migrations/20260528012632_chart_catalog_draft_order_insert.sql";
const catalogDraftMigration = existsSync(catalogDraftMigrationPath)
  ? readFileSync(catalogDraftMigrationPath, "utf8")
  : "";
const draftOrderIdBoundaryMigrationPath =
  "supabase/migrations/20260528075852_den_306_chart_draft_order_id_boundary.sql";
const draftOrderIdBoundaryMigration = existsSync(
  draftOrderIdBoundaryMigrationPath,
)
  ? readFileSync(draftOrderIdBoundaryMigrationPath, "utf8")
  : "";
const encounterIdBridgeMigrationPath =
  "supabase/migrations/20260529090000_den_307_chart_encounter_id_bridge.sql";
const encounterIdBridgeMigration = existsSync(encounterIdBridgeMigrationPath)
  ? readFileSync(encounterIdBridgeMigrationPath, "utf8")
  : "";
const stagingEncounterIdBridgeMigrationPath =
  "supabase/migrations/20260529090800_den_307_staging_demo_encounter_bridge_candidates.sql";
const stagingEncounterIdBridgeMigration = existsSync(
  stagingEncounterIdBridgeMigrationPath,
)
  ? readFileSync(stagingEncounterIdBridgeMigrationPath, "utf8")
  : "";
const a3Migration = readFileSync(
  "supabase/migrations/20260819150622_clinical_master_phase1a3_order_authority.sql",
  "utf8",
);

const validOrderDraftRows = [
  {
    rowType: "individual" as const,
    orderId: "order-coco-maropitant",
    workspaceCatalogItemId: "ord-med-maropitant",
    quantity: 1,
  },
  {
    rowType: "individual" as const,
    orderId: "order-coco-cbc",
    workspaceCatalogItemId: "ord-lab-cbc-baso",
    quantity: 1,
  },
  {
    rowType: "individual" as const,
    orderId: "order-coco-fluid",
    workspaceCatalogItemId: "ord-treatment-fluid",
    quantity: 1,
  },
  {
    rowType: "individual" as const,
    orderId: "order-coco-thorax",
    workspaceCatalogItemId: "ord-imaging-thorax",
    quantity: 1,
  },
];

const validEtag = `"${"0".repeat(64)}"`;

function strictDraftInput(
  expectedEtag = validEtag,
  targetEncounterId = encounterId,
) {
  return {
    encounterId: targetEncounterId,
    expectedEtag,
    removedOrderIds: [],
    rows: validOrderDraftRows,
  };
}

const waitingEncounter: Encounter = {
  id: "encounter-order-draft-waiting-lock",
  workspaceId,
  patientId: "patient-order-draft-waiting-lock",
  guardianId: "guardian-order-draft-waiting-lock",
  encounterNo: "E-ORDER-DRAFT-LOCK",
  status: "waiting",
  checkedInAt: "2026-06-25T14:15:00+09:00",
  createdAt: "2026-06-25T14:15:00+09:00",
  updatedAt: "2026-06-25T14:15:00+09:00",
};

const setRuntimeEncounter: Encounter = {
  ...waitingEncounter,
  id: "encounter-order-set-runtime",
  patientId: "patient-order-set-runtime",
  guardianId: "guardian-order-set-runtime",
  encounterNo: "E-ORDER-SET-RUNTIME",
  status: "in_consultation",
};

test("order draft route requires an actor, saves via mock fallback, and reads after save", async ({
  request,
}) => {
  const current = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-drafts?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } },
  );
  expect(current.status()).toBe(200);
  const currentBody = (await current.json()) as { etag: string };

  const standardHeaderOnly = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-drafts`,
    {
      data: strictDraftInput(currentBody.etag),
      headers: {
        "If-Match": currentBody.etag,
        "x-clair-demo-session-user-id": "user-vet",
      },
    },
  );
  expect(standardHeaderOnly.status()).toBe(428);
  await expectJson(standardHeaderOnly, {
    ok: false,
    error: "if_match_required",
  });

  const unauthenticated = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-drafts`,
    { data: strictDraftInput(currentBody.etag) },
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, {
    ok: false,
    denialReason: "unauthenticated",
  });

  const legacyPayload = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-drafts`,
    {
      data: {
        ...strictDraftInput(currentBody.etag),
        orders: [],
      },
      headers: {
        [chartOrderExpectedEtagHeader]: currentBody.etag,
        "x-clair-demo-session-user-id": "user-vet",
      },
    },
  );
  expect(legacyPayload.status()).toBe(400);
  await expectJson(legacyPayload, {
    ok: false,
    error: "invalid_input",
  });

  const saved = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-drafts`,
    {
      data: strictDraftInput(currentBody.etag),
      headers: {
        [chartOrderExpectedEtagHeader]: currentBody.etag,
        "x-clair-demo-session-user-id": "user-vet",
      },
    },
  );
  expect(saved.status()).toBe(200);
  expect(saved.headers()["etag"]).toBeUndefined();
  const savedBody = (await saved.json()) as {
    ok: true;
    etag: string;
    rows: Array<{
      rowType: string;
      encounterId: string;
      lineTotalSnapshot: number;
      orderId: string;
      quantity: number;
      unitPriceSnapshot: number | null;
    }>;
    enforcedBy: string;
  };

  expect(savedBody.enforcedBy).toBe("chart-order-draft-persistence");
  expect(savedBody.etag).toMatch(/^"[0-9a-f]{64}"$/);
  expect(savedBody.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rowType: "individual",
        encounterId,
        lineTotalSnapshot: 35000,
        orderId: "order-coco-cbc",
        quantity: 1,
        unitPriceSnapshot: 35000,
      }),
      expect.objectContaining({
        rowType: "individual",
        encounterId,
        lineTotalSnapshot: 18000,
        orderId: "order-coco-fluid",
        quantity: 1,
        unitPriceSnapshot: 18000,
      }),
    ]),
  );

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-drafts?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } },
  );
  expect(readBack.status()).toBe(200);
  const readBody = (await readBack.json()) as {
    ok: true;
    rows: Array<{ rowType: string; orderId: string }>;
  };
  expect(readBody.rows.map((row) => row.orderId)).toEqual([
    "order-coco-maropitant",
    "order-coco-cbc",
    "order-coco-fluid",
    "order-coco-thorax",
  ]);
  expect(readBody.rows.every((row) => row.rowType === "individual")).toBe(true);
});

test("order draft core rejects invalid quantity and enforces permission plus encounter scope", async () => {
  const invalidQuantity = await saveChartOrderDraft({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      encounterId,
      expectedEtag: validEtag,
      rows: [
        {
          rowType: "individual",
          orderId: "order-coco-cbc",
          workspaceCatalogItemId: "ord-lab-cbc-baso",
          quantity: 0,
        },
      ],
    },
  });
  expect(invalidQuantity).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: { rows: "오더 선택과 수량을 확인해 주세요." },
  });

  const invalidRemovalIntent = await saveChartOrderDraft({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      encounterId,
      expectedEtag: validEtag,
      removedOrderIds: ["order-coco-cbc", "order-coco-cbc"],
      rows: validOrderDraftRows.filter(
        (row) => row.orderId !== "order-coco-cbc",
      ),
    },
  });
  expect(invalidRemovalIntent).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: {
      removedOrderIds: "삭제할 오더 후보를 확인해 주세요.",
    },
  });

  const frontDeskDenied = await saveChartOrderDraft({
    actorUserId: "user-front-desk",
    workspaceId,
    input: strictDraftInput(),
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

  let updateOnlyGatewayCalled = false;
  const updateOnlyDenied = await saveChartOrderDraft({
    actorUserId: "user-update-only",
    workspaceId,
    input: strictDraftInput(),
    gateway: {
      async saveOrderDraft() {
        updateOnlyGatewayCalled = true;
        throw new Error("gateway must not run without chart:view");
      },
    },
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-update-only", status: "active" }],
      memberships: [
        {
          id: "membership-update-only",
          workspaceId,
          userId: "user-update-only",
          roles: [],
          permissionRole: {
            key: "chart-update-only",
            label: "Chart update only",
            roleType: "custom",
            permissionIds: ["chart:update"],
          },
          status: "active",
        },
      ],
    }),
  });
  expect(updateOnlyDenied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });
  expect(updateOnlyGatewayCalled).toBe(false);

  const crossWorkspaceDenied = await saveChartOrderDraft({
    actorUserId: "user-vet",
    workspaceId: "other-workspace",
    input: strictDraftInput(),
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

  const allowedGateway = createMockChartOrderDraftGateway(
    undefined,
    () => "2026-05-19T15:00:00.000Z",
  );
  const allowedCurrent = await allowedGateway.readOrderDraft({
    workspaceId,
    encounterId,
  });
  const allowedVet = await saveChartOrderDraft({
    actorUserId: "user-vet",
    workspaceId,
    input: strictDraftInput(
      allowedCurrent.ok ? allowedCurrent.etag : validEtag,
    ),
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
    gateway: allowedGateway,
  });
  expect(allowedVet).toMatchObject({
    ok: true,
    status: 200,
  });
  expect(allowedVet.ok ? allowedVet.rows : []).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rowType: "individual",
        lineTotalSnapshot: 35000,
        orderId: "order-coco-cbc",
        updatedAt: "2026-05-19T15:00:00.000Z",
      }),
      expect.objectContaining({
        rowType: "individual",
        lineTotalSnapshot: 18000,
        orderId: "order-coco-fluid",
        updatedAt: "2026-05-19T15:00:00.000Z",
      }),
    ]),
  );
});

test("order draft core blocks chart mutation before consultation starts", async () => {
  const blocked = await saveChartOrderDraft({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      ...strictDraftInput(),
      encounterId: waitingEncounter.id,
    },
    gateway: createMockChartOrderDraftGateway({
      encounters: [{ ...waitingEncounter }],
      invoiceLines: [],
      orders: [],
    }),
  });

  expect(blocked).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "stale_status",
  });
});

test("order draft persists explicit candidate removal and keeps omission non-destructive", async () => {
  const removalEncounter: Encounter = {
    ...setRuntimeEncounter,
    id: "encounter-order-draft-removal",
    patientId: "patient-order-draft-removal",
    guardianId: "guardian-order-draft-removal",
    encounterNo: "E-ORDER-DRAFT-REMOVAL",
  };
  const gateway = createMockChartOrderDraftGateway({
    encounters: [removalEncounter],
    invoiceLines: [],
    orders: [],
  });
  const initial = await gateway.readOrderDraft({
    encounterId: removalEncounter.id,
    workspaceId,
  });
  expect(initial.ok).toBe(true);
  if (!initial.ok) return;

  const rows = [
    {
      rowType: "individual" as const,
      orderId: "order-removal-a",
      workspaceCatalogItemId: "ord-lab-cbc-baso",
      quantity: 1,
    },
    {
      rowType: "individual" as const,
      orderId: "order-removal-b",
      workspaceCatalogItemId: "ord-treatment-fluid",
      quantity: 1,
    },
  ];
  const created = await gateway.saveOrderDraft({
    actorUserId: "user-vet",
    encounterId: removalEncounter.id,
    expectedEtag: initial.etag,
    removedOrderIds: [],
    rows,
    workspaceId,
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;

  const omittedOnly = await gateway.saveOrderDraft({
    actorUserId: "user-vet",
    encounterId: removalEncounter.id,
    expectedEtag: created.etag,
    removedOrderIds: [],
    rows: [rows[0]],
    workspaceId,
  });
  expect(omittedOnly).toMatchObject({
    ok: true,
    rows: expect.arrayContaining([
      expect.objectContaining({ orderId: "order-removal-a" }),
      expect.objectContaining({ orderId: "order-removal-b" }),
    ]),
  });
  if (!omittedOnly.ok) return;

  const removed = await gateway.saveOrderDraft({
    actorUserId: "user-vet",
    encounterId: removalEncounter.id,
    expectedEtag: omittedOnly.etag,
    removedOrderIds: ["order-removal-b"],
    rows: [rows[0]],
    workspaceId,
  });
  expect(removed).toMatchObject({
    ok: true,
    rows: [expect.objectContaining({ orderId: "order-removal-a" })],
  });

  const readback = await gateway.readOrderDraft({
    encounterId: removalEncounter.id,
    workspaceId,
  });
  expect(readback).toMatchObject({
    ok: true,
    rows: [expect.objectContaining({ orderId: "order-removal-a" })],
  });
});

test("shared draft persists editable details across devices and rejects a stale ETag without overwriting", async () => {
  const sharedEncounter: Encounter = {
    ...setRuntimeEncounter,
    id: "encounter-shared-draft-etag",
    patientId: "patient-shared-draft-etag",
    guardianId: "guardian-shared-draft-etag",
    encounterNo: "E-SHARED-DRAFT-ETAG",
  };
  const deviceA = createMockChartOrderDraftGateway({
    encounters: [sharedEncounter],
    invoiceLines: [],
    orders: [],
  });
  const deviceB = createMockChartOrderDraftGateway({
    encounters: [sharedEncounter],
    invoiceLines: [],
    orders: [],
  });
  const initial = await deviceA.readOrderDraft({
    encounterId: sharedEncounter.id,
    workspaceId,
  });
  expect(initial.ok).toBe(true);
  if (!initial.ok) return;

  const first = await deviceA.saveOrderDraft({
    actorUserId: "user-vet",
    encounterId: sharedEncounter.id,
    expectedEtag: initial.etag,
    rows: [
      {
        rowType: "individual",
        orderId: "order-shared-draft-lab",
        workspaceCatalogItemId: "ord-lab-cbc-baso",
        quantity: 1,
        detailInputs: {
          specimenType: "serum",
          collectionCondition: "fasted",
        },
        detailSchemaVersion: 1,
        priority: "urgent",
      },
    ],
    workspaceId,
  });
  expect(first.ok).toBe(true);
  if (!first.ok) return;

  const deviceBRead = await deviceB.readOrderDraft({
    encounterId: sharedEncounter.id,
    workspaceId,
  });
  expect(deviceBRead).toMatchObject({
    ok: true,
    rows: [
      expect.objectContaining({
        clinicalOrderType: "clinical_lab",
        destinationModule: "lab",
        detailInputs: {
          specimenType: "serum",
          collectionCondition: "fasted",
        },
        detailSchemaVersion: 1,
        executionMode: "routed",
        priority: "urgent",
      }),
    ],
  });
  if (!deviceBRead.ok) return;

  const second = await deviceB.saveOrderDraft({
    actorUserId: "user-vet",
    encounterId: sharedEncounter.id,
    expectedEtag: deviceBRead.etag,
    rows: [
      {
        rowType: "individual",
        orderId: "order-shared-draft-lab",
        workspaceCatalogItemId: "ord-lab-cbc-baso",
        quantity: 2,
        detailInputs: {
          specimenType: "blood",
          collectionCondition: "room temperature",
        },
        detailSchemaVersion: 1,
        priority: "normal",
      },
    ],
    workspaceId,
  });
  expect(second.ok).toBe(true);
  if (!second.ok) return;

  const staleWrite = await deviceA.saveOrderDraft({
    actorUserId: "user-vet",
    encounterId: sharedEncounter.id,
    expectedEtag: first.etag,
    rows: [
      {
        rowType: "individual",
        orderId: "order-shared-draft-lab",
        workspaceCatalogItemId: "ord-lab-cbc-baso",
        quantity: 99,
        detailInputs: { specimenType: "urine" },
        detailSchemaVersion: 1,
        priority: "urgent",
      },
    ],
    workspaceId,
  });
  expect(staleWrite).toMatchObject({
    ok: false,
    status: 409,
    error: "revision_conflict",
  });

  const finalRead = await deviceA.readOrderDraft({
    encounterId: sharedEncounter.id,
    workspaceId,
  });
  expect(finalRead).toMatchObject({
    ok: true,
    etag: second.etag,
    rows: [
      expect.objectContaining({
        quantity: 2,
        detailInputs: {
          specimenType: "blood",
          collectionCondition: "room temperature",
        },
        priority: "normal",
      }),
    ],
  });
});

test("order draft Supabase gateway keeps workspace, encounter, actor, and server amount fields in RPC calls", async () => {
  const calls: string[] = [];
  const rpcPayloads: Array<Record<string, unknown>> = [];
  const gateway = createSupabaseChartOrderDraftGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      rpcPayloads.push(args);
      calls.push(
        `${functionName}:${args.p_workspace_id}:${args.p_encounter_id}:${args.p_actor_user_id ?? "read"}`,
      );
      return {
        data: {
          etag: validEtag,
          rows: [
            {
              orderId: "00000000-0000-4000-8000-000000000101",
              encounterId,
              rowType: "individual",
              orderType: "lab",
              quantity: 2,
              lineTotalSnapshot: 90000,
              quantitySource: "manual",
              updatedAt: "2026-05-19T15:00:00.000Z",
            },
          ],
        },
        error: null,
      };
    },
  });

  const result = await gateway.saveOrderDraft({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId,
    expectedEtag: validEtag,
    removedOrderIds: ["00000000-0000-4000-8000-000000000199"],
    rows: [
      {
        rowType: "individual",
        orderId: "00000000-0000-4000-8000-000000000101",
        workspaceCatalogItemId: "ord-lab-cbc-baso",
        quantity: 2,
      },
    ],
  });

  expect(calls).toEqual([
    `clair_save_chart_order_draft:${workspaceId}:${encounterId}:00000000-0000-4000-8000-000000000002`,
  ]);
  expect(rpcPayloads[0]?.p_orders).toEqual({
    expectedEtag: validEtag,
    removedOrderIds: ["00000000-0000-4000-8000-000000000199"],
    rows: [
      {
        rowType: "individual",
        orderId: "00000000-0000-4000-8000-000000000101",
        workspaceCatalogItemId: "ord-lab-cbc-baso",
        quantity: 2,
      },
    ],
  });
  expect(result).toMatchObject({
    ok: true,
    rows: [
      {
        orderId: "00000000-0000-4000-8000-000000000101",
      },
    ],
  });
  expect(catalogDraftMigration).toContain("insert into public.orders");
  expect(catalogDraftMigration).toContain("source_order_id");
  expect(catalogDraftMigration).toContain("applied_snapshot");
  expect(catalogDraftMigration).toContain("'workspace_catalog'");
});

test("order draft route bridge resolves demo encounter IDs before Supabase RPC calls", async () => {
  const calls: string[] = [];
  const resolvedEncounterId = "00000000-0000-4000-8000-000000002601";
  const resolved = await resolveServerChartEncounterId({
    client: {
      async rpc(functionName, args) {
        calls.push(
          `${functionName}:${args.p_workspace_id}:${args.p_encounter_id}`,
        );
        return { data: resolvedEncounterId, error: null };
      },
    },
    encounterId,
    workspaceId,
  });

  expect(resolved).toEqual({ ok: true, encounterId: resolvedEncounterId });
  expect(calls).toEqual([
    `clair_resolve_encounter_id:${workspaceId}:${encounterId}`,
  ]);

  const uuidPassthrough = await resolveServerChartEncounterId({
    client: {
      async rpc() {
        throw new Error(
          "uuid encounters should not need bridge RPC resolution",
        );
      },
    },
    encounterId: resolvedEncounterId,
    workspaceId,
  });
  expect(uuidPassthrough).toEqual({
    ok: true,
    encounterId: resolvedEncounterId,
  });
});

test("order draft route bridge tries staging synthetic candidates for every chart fixture encounter", async () => {
  const calls: string[] = [];
  const resolvedEncounterId = "19426000-0000-4000-8000-000000000004";
  const resolved = await resolveServerChartEncounterId({
    client: {
      async rpc(functionName, args) {
        calls.push(`${functionName}:${args.p_encounter_id}`);
        if (args.p_encounter_id === "E-DEN194-0004") {
          return { data: resolvedEncounterId, error: null };
        }
        return { data: null, error: { message: "encounter_unavailable" } };
      },
    },
    encounterId: "encounter-haru-260430",
    workspaceId,
  });

  expect(resolved).toEqual({ ok: true, encounterId: resolvedEncounterId });
  expect(calls).toEqual([
    "clair_resolve_encounter_id:encounter-haru-260430",
    "clair_resolve_encounter_id:E-260430-0005",
    "clair_resolve_encounter_id:E-DEN194-0004",
  ]);
});

test("order draft ID boundary migration avoids casting catalog source IDs as order UUIDs", () => {
  expect(draftOrderIdBoundaryMigration).toContain("private.clair_safe_uuid");
  expect(draftOrderIdBoundaryMigration).toContain("gen_random_uuid()");
  expect(draftOrderIdBoundaryMigration).toContain("source_order_id");
  expect(draftOrderIdBoundaryMigration).toContain("sourcePresetId");
  expect(draftOrderIdBoundaryMigration).not.toContain(
    "nullif(row_data.value->>'orderId', '')::uuid",
  );
  expect(draftOrderIdBoundaryMigration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("DEN-307 encounter bridge migration resolves demo IDs without exposing secrets", () => {
  expect(encounterIdBridgeMigration).toContain("clair_resolve_encounter_id");
  expect(encounterIdBridgeMigration).toContain(
    "private.clair_demo_encounter_no",
  );
  expect(encounterIdBridgeMigration).toContain("encounter-kong-260501");
  expect(encounterIdBridgeMigration).toContain("E-260501-0003");
  expect(stagingEncounterIdBridgeMigration).toContain(
    "private.clair_demo_encounter_no_candidates",
  );
  expect(stagingEncounterIdBridgeMigration).toContain("E-DEN194-0001");
  expect(stagingEncounterIdBridgeMigration).toContain("E-DEN194-0005");
  expect(encounterIdBridgeMigration).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(
    `${encounterIdBridgeMigration}\n${stagingEncounterIdBridgeMigration}`,
  ).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
});

test("order draft persistence migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain(
    "create or replace function public.clair_get_chart_order_draft",
  );
  expect(migration).toContain(
    "create or replace function public.clair_save_chart_order_draft",
  );
  expect(migration).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(migration).toContain("from public.encounters e");
  expect(migration).toContain("from public.orders o");
  expect(migration).toContain("billing_display_name");
  expect(migration).toContain("quantity");
  expect(migration).toContain("line_total_snapshot");
  expect(migration).toContain(
    "grant execute on function public.clair_save_chart_order_draft",
  );
  expect(migration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("A3 order drafts use workspace catalog lineage and nullable server snapshots", () => {
  expect(a3Migration).toContain("workspace_catalog_item_id text");
  expect(a3Migration).toContain("private.clair_build_catalog_order_snapshot");
  expect(a3Migration).toContain("service_item_id, workspace_catalog_item_id");
  expect(a3Migration).toContain("unit_price_snapshot, requested_by_user_id");
  expect(a3Migration).toContain(
    "applied_snapshot = private.clair_build_catalog_order_snapshot",
  );
  expect(a3Migration).toContain("unitPriceSnapshot', o.unit_price_snapshot");
  expect(a3Migration).toContain("serviceItemId', o.service_item_id");
});

test("order draft route stays server-owned and secret-free", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/order-drafts/route.ts",
    "utf8",
  );
  const serverSource = readFileSync(
    "src/features/chart/server-order-draft-persistence.ts",
    "utf8",
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(routeSource).toContain("resolveServerChartEncounterId");
  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});

test("set draft keeps explicit leaf intent and runtime identity across reload and CAS retry", async () => {
  const catalog = createMockOrderCatalogGateway();
  const catalogResult = await catalog.listChartSearch({ workspaceId });
  const setRow = catalogResult.rows.find(
    (row) => row.rowType === "set" && row.sourceSetId === "set-vomit-basic",
  );
  expect(setRow).toBeTruthy();

  const gateway = createMockChartOrderDraftGateway({
    encounters: [setRuntimeEncounter],
    orders: [],
  });
  const permissionAdapter = createMockWorkspacePermissionAdapter({
    users: [{ id: "user-vet", status: "active" }],
    memberships: [
      {
        id: "membership-order-set-runtime",
        workspaceId,
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });
  const parentOrderId = "set-parent-runtime-1";
  const selectionIntent = {
    items: [
      {
        revisionItemId: "setitem-vomit-baso",
        selected: false,
        quantity: 1,
      },
      {
        revisionItemId: "setitem-vomit-maropitant",
        selected: true,
        quantity: 5,
      },
    ],
  };
  const initialSetDraft = await gateway.readOrderDraft({
    workspaceId,
    encounterId: setRuntimeEncounter.id,
  });
  expect(initialSetDraft.ok).toBe(true);

  const firstSave = await saveChartOrderDraft({
    actorUserId: "user-vet",
    gateway,
    input: {
      encounterId: setRuntimeEncounter.id,
      expectedEtag: initialSetDraft.ok ? initialSetDraft.etag : validEtag,
      rows: [
        {
          rowType: "set",
          orderId: parentOrderId,
          sourceSetId: setRow!.sourceSetId!,
          sourceSetRevisionId: setRow!.sourceSetRevisionId!,
          sourceSetRevisionNo: setRow!.sourceSetRevisionNo!,
          selectionIntent,
        },
      ],
    },
    permissionAdapter,
    workspaceId,
  });
  expect(firstSave.ok).toBe(true);
  if (!firstSave.ok) return;
  expect(firstSave.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        orderId: parentOrderId,
        rowType: "set",
        sourceSetId: setRow!.sourceSetId,
        sourceSetRevisionId: setRow!.sourceSetRevisionId,
        snapshotSchemaVersion: 1,
      }),
      expect.objectContaining({
        parentOrderId,
        rowType: "set_child",
        sourceSetRevisionItemId: "setitem-vomit-maropitant",
        quantity: 5,
        quantitySource: "manual_at_apply",
      }),
    ]),
  );
  const firstChild = firstSave.rows.find(
    (row) => row.rowType === "set_child" && row.parentOrderId === parentOrderId,
  );
  const firstParent = firstSave.rows.find(
    (row) => row.orderId === parentOrderId,
  );
  expect(firstChild?.orderId).toBeTruthy();
  expect(firstParent?.snapshotHash).toBeNull();

  const reloaded = await readChartOrderDraft({
    actorUserId: "user-vet",
    encounterId: setRuntimeEncounter.id,
    gateway,
    permissionAdapter,
    workspaceId,
  });
  expect(reloaded.ok).toBe(true);
  if (!reloaded.ok) return;
  expect(reloaded.rows.map((row) => row.rowType)).toEqual(["set", "set_child"]);
  expect(reloaded.rows[1]).toMatchObject({
    orderId: firstChild!.orderId,
    parentOrderId,
    sourceSetId: setRow!.sourceSetId,
    sourceSetRevisionId: setRow!.sourceSetRevisionId,
    sourceSetRevisionItemId: "setitem-vomit-maropitant",
    quantity: 5,
  });

  const retry = await saveChartOrderDraft({
    actorUserId: "user-vet",
    gateway,
    input: {
      encounterId: setRuntimeEncounter.id,
      expectedEtag: reloaded.etag,
      rows: [
        {
          rowType: "set",
          orderId: parentOrderId,
          sourceSetId: setRow!.sourceSetId!,
          sourceSetRevisionId: setRow!.sourceSetRevisionId!,
          sourceSetRevisionNo: setRow!.sourceSetRevisionNo!,
          selectionIntent: {
            items: [
              selectionIntent.items[0],
              { ...selectionIntent.items[1], quantity: 6 },
            ],
          },
        },
      ],
    },
    permissionAdapter,
    workspaceId,
  });
  expect(retry.ok).toBe(true);
  if (!retry.ok) return;
  expect(retry.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        orderId: firstChild!.orderId,
        parentOrderId,
        quantity: 6,
      }),
    ]),
  );
  const retryParent = retry.rows.find((row) => row.orderId === parentOrderId);
  expect(retryParent?.snapshotHash).toBeNull();
  expect(retry.etag).not.toBe(firstSave.etag);
});

test("range-based set preview requires explicit input and rejects no-match values", async () => {
  const rangeSet = (
    rangeBasis: "patient_weight_kg" | "manual_value",
  ): OrderSet => ({
    id: `set-range-${rangeBasis}`,
    workspaceId,
    sourceSetVersion: "v1",
    setCategory: "범위 세트",
    setName: `${rangeBasis} 세트`,
    billingName: `${rangeBasis} 세트`,
    availabilityStatus: "active",
    amountBasis: "range_price",
    setPriceKrw: 0,
    rangeBasis,
    taxType: "taxable",
    priceRanges: [
      {
        id: "range-0-10",
        sortOrder: 1,
        lowerBound: 0,
        upperBound: 10,
        priceKrw: 1000,
      },
      {
        id: "range-20-open",
        sortOrder: 2,
        lowerBound: 20,
        upperBound: null,
        priceKrw: 2000,
      },
    ],
    salesUnit: "per_each",
    billingReflectionEnabled: true,
    targetSpecies: ["dog", "cat", "other"],
    includedOrders: [
      {
        id: `range-item-${rangeBasis}`,
        childOrderId: "ord-med-maropitant",
        sortOrder: 10,
        defaultSelected: true,
        billingReflectionDefault: true,
        defaultQuantity: 1,
        quantitySource: "fixed_one",
        unitPriceSnapshotKrw: 4500,
      },
    ],
  });

  for (const rangeBasis of ["patient_weight_kg", "manual_value"] as const) {
    const gateway = createMockOrderCatalogGateway({
      orderSets: [rangeSet(rangeBasis)],
    });
    const baseInput = {
      encounterId,
      orderSetId: `set-range-${rangeBasis}`,
      revisionId: "range-revision-1",
      workspaceId,
    };
    const items = [
      {
        revisionItemId: `range-item-${rangeBasis}`,
        selected: true,
        quantity: 1,
      },
    ];
    const missing = await gateway.previewOrderSet!({
      ...baseInput,
      selectionIntent: { items },
    });
    expect(missing).toMatchObject({
      ok: false,
      status: 422,
      error: "order_set_range_input_required",
    });
    const noMatch = await gateway.previewOrderSet!({
      ...baseInput,
      selectionIntent: { items, rangeInput: 15 },
    });
    expect(noMatch).toMatchObject({
      ok: false,
      status: 422,
      error: "order_set_range_no_match",
    });
    const valid = await gateway.previewOrderSet!({
      ...baseInput,
      selectionIntent: { items, rangeInput: 5 },
    });
    expect(valid).toMatchObject({
      ok: true,
      preview: {
        set: { rangeBasis },
        pricing: { rangeInput: 5, selectedRangeId: "range-0-10" },
      },
    });
  }
});

async function expectJson(
  response: { json(): Promise<unknown> },
  expected: Record<string, unknown>,
) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
