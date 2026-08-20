import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseDemoBillingPermissionAdapter,
  shouldUseSupabaseBillingPersistenceGateway,
} from "../src/features/billing/server-demo-billing-persistence-boundary";
import {
  createMockInvoiceLinePersistenceGateway,
  createSupabaseInvoiceLinePersistenceGateway,
  saveInvoiceLineEdits,
} from "../src/features/billing/server-invoice-line-persistence-core";

const workspaceId = "clair-demo";
const invoiceId = "invoice-kong-260501";
const invoiceLineId = "invoice-line-kong-fluid";
const migrationPath = "supabase/migrations/20260520100000_billing_invoice_line_persistence_rpc.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const a3Migration = readFileSync(
  "supabase/migrations/20260819150622_clinical_master_phase1a3_order_authority.sql",
  "utf8",
);

const validInput = {
  invoiceId,
  lines: [{ invoiceLineId, quantity: 2 }],
  confirmBilling: true,
};

test("invoice line route requires an actor, recalculates amounts, and confirms billing", async ({
  request,
}) => {
  const unauthenticated = await request.patch(
    `/api/workspaces/${workspaceId}/billing/invoice-lines`,
    { data: validInput }
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const saved = await request.patch(`/api/workspaces/${workspaceId}/billing/invoice-lines`, {
    data: validInput,
    headers: { "x-clair-demo-session-user-id": "user-tech" },
  });
  expect(saved.status()).toBe(200);
  const savedBody = await saved.json() as {
    ok: true;
    invoice: {
      id: string;
      issuedAt?: string;
      issuedByUserId?: string;
      status: string;
      subtotalAmount: number;
      totalAmount: number;
    };
    lines: Array<{
      id: string;
      invoiceId: string;
      lineTotal: number;
      quantity: number;
      unitPrice: number;
    }>;
    enforcedBy: string;
  };

  expect(savedBody.enforcedBy).toBe("billing-invoice-line-persistence");
  expect(savedBody.invoice).toMatchObject({
    id: invoiceId,
    issuedByUserId: "user-tech",
    status: "issued",
  });
  expect(savedBody.invoice.issuedAt).toBeTruthy();
  expect(savedBody.lines).toContainEqual(
    expect.objectContaining({
      id: invoiceLineId,
      invoiceId,
      lineTotal: 36000,
      quantity: 2,
      unitPrice: 18000,
    })
  );
  expect(savedBody.invoice.subtotalAmount).toBe(174500);
  expect(savedBody.invoice.totalAmount).toBe(174500);

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/billing/invoice-lines?invoiceId=${invoiceId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } }
  );
  expect(readBack.status()).toBe(200);
  const readBody = await readBack.json() as typeof savedBody;
  expect(readBody.invoice.status).toBe("issued");
  expect(readBody.lines).toContainEqual(expect.objectContaining({ id: invoiceLineId, quantity: 2 }));
});

test("invoice line core blocks unauthorized billing mutations and cross-workspace invoice access", async () => {
  const vetDenied = await saveInvoiceLineEdits({
    actorUserId: "user-vet",
    workspaceId,
    input: validInput,
  });
  expect(vetDenied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });

  const crossWorkspaceDenied = await saveInvoiceLineEdits({
    actorUserId: "user-tech",
    workspaceId: "other-workspace",
    input: validInput,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-tech", status: "active" }],
      memberships: [
        {
          id: "membership-tech-other",
          workspaceId: "other-workspace",
          userId: "user-tech",
          roles: ["technician"],
          status: "active",
        },
      ],
    }),
  });
  expect(crossWorkspaceDenied).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "invoice_unavailable",
  });
});

test("invoice line core validates quantities and keeps server-owned unit prices", async () => {
  const gateway = createMockInvoiceLinePersistenceGateway(undefined, () => "2026-05-20T10:00:00.000Z");
  const result = await saveInvoiceLineEdits({
    actorUserId: "user-tech",
    workspaceId,
    input: validInput,
    gateway,
  });
  expect(result).toMatchObject({
    ok: true,
    status: 200,
    invoice: {
      issuedAt: "2026-05-20T10:00:00.000Z",
      issuedByUserId: "user-tech",
      status: "issued",
      totalAmount: 174500,
    },
  });
  expect(result.ok ? result.lines : []).toContainEqual(
    expect.objectContaining({
      id: invoiceLineId,
      lineTotal: 36000,
      quantity: 2,
      unitPrice: 18000,
    })
  );

  const invalidQuantity = await saveInvoiceLineEdits({
    actorUserId: "user-tech",
    workspaceId,
    input: {
      invoiceId,
      lines: [{ invoiceLineId, quantity: 0 }],
    },
    gateway,
  });
  expect(invalidQuantity).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
  });
});

test("invoice line demo ids stay on mock persistence even for Supabase sessions", async () => {
  const supabaseActorUserId = "00000000-0000-4000-8000-000000000002";

  expect(
    shouldUseSupabaseBillingPersistenceGateway({
      identitySource: "supabase_session",
      invoiceId,
    })
  ).toBe(false);
  expect(
    shouldUseSupabaseBillingPersistenceGateway({
      identitySource: "supabase_session",
      invoiceId: "00000000-0000-4000-8000-000000000401",
    })
  ).toBe(true);

  const result = await saveInvoiceLineEdits({
    actorUserId: supabaseActorUserId,
    workspaceId,
    input: validInput,
    gateway: createMockInvoiceLinePersistenceGateway(
      undefined,
      () => "2026-05-20T10:00:00.000Z",
      "supabase-demo-invoice-line-boundary-test"
    ),
    permissionAdapter: createSupabaseDemoBillingPermissionAdapter({
      actorUserId: supabaseActorUserId,
      workspaceId,
    }),
  });

  expect(result).toMatchObject({
    ok: true,
    invoice: {
      id: invoiceId,
      issuedByUserId: supabaseActorUserId,
      status: "issued",
    },
  });
});

test("invoice line Supabase gateway keeps actor, workspace, invoice, and line edits in RPC calls", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const gateway = createSupabaseInvoiceLinePersistenceGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ functionName, args });
      return {
        data: {
          invoice: {
            createdAt: "2026-05-01T10:22:00.000Z",
            discountAmount: 0,
            encounterId: "00000000-0000-4000-8000-000000000201",
            guardianId: "00000000-0000-4000-8000-000000000101",
            id: "00000000-0000-4000-8000-000000000401",
            invoiceNo: "INV-260501-0003",
            status: "issued",
            subtotalAmount: 174500,
            taxAmount: 0,
            issuedAt: "2026-05-20T10:00:00.000Z",
            issuedByUserId: "00000000-0000-4000-8000-000000000002",
            totalAmount: 174500,
            workspaceId,
          },
          lines: [
            {
              categoryGroup: "set",
              description: "피하 수액 처치",
              id: "00000000-0000-4000-8000-000000000501",
              invoiceId: "00000000-0000-4000-8000-000000000401",
              lineTotal: 36000,
              quantity: 2,
              sourceOrderSnapshot: { categoryGroup: "set" },
              unitPrice: 18000,
            },
          ],
        },
        error: null,
      };
    },
  });

  const result = await gateway.saveInvoiceLineEdits({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    input: {
      invoiceId: "00000000-0000-4000-8000-000000000401",
      lines: [{ invoiceLineId: "00000000-0000-4000-8000-000000000501", quantity: 2 }],
      confirmBilling: true,
    },
  });

  expect(calls).toEqual([
    {
      functionName: "clair_save_billing_invoice_lines",
      args: {
        p_workspace_id: workspaceId,
        p_actor_user_id: "00000000-0000-4000-8000-000000000002",
        p_invoice_id: "00000000-0000-4000-8000-000000000401",
        p_lines: [{ invoiceLineId: "00000000-0000-4000-8000-000000000501", quantity: 2 }],
        p_confirm_billing: true,
      },
    },
  ]);
  expect(result).toMatchObject({
    ok: true,
    invoice: { status: "issued", totalAmount: 174500 },
    lines: [{ billingCategory: "other", lineTotal: 36000 }],
  });
});

test("invoice line persistence migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain("create or replace function public.clair_get_billing_invoice_lines");
  expect(migration).toContain("create or replace function public.clair_save_billing_invoice_lines");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migration).toContain("invoice_lines");
  expect(migration).toContain("subtotal_amount");
  expect(migration).toContain("issued_by_user_id");
  expect(migration).toContain("grant execute on function public.clair_save_billing_invoice_lines");
  expect(migration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
});

test("A3 invoice line reads return frozen lineage and nullable prices without catalog rejoin", () => {
  const invoiceLineReadSource = a3Migration.slice(
    a3Migration.indexOf("create or replace function public.clair_get_billing_invoice_lines"),
  );
  expect(a3Migration).toContain("source_order_snapshot, tax_type, created_at, updated_at");
  expect(a3Migration).toContain("billingNameSnapshot', il.billing_name_snapshot");
  expect(a3Migration).toContain("sourceOrderSnapshot', il.source_order_snapshot");
  expect(a3Migration).toContain("workspaceCatalogItemId', il.source_order_snapshot->>'workspaceCatalogItemId'");
  expect(a3Migration).toContain("billingCategory', il.source_order_snapshot->>'billingCategory'");
  expect(invoiceLineReadSource).not.toContain("order_catalog_items");
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
