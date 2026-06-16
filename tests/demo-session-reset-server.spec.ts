import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createSupabaseDemoSessionResetGateway,
  resetDemoSession,
} from "../src/features/demo-session/server-demo-session-reset-core";

const workspaceId = "workspace-clair-cheongdam";
const adminActorId = "user-admin";

test("demo session reset is limited to the Cheongdam prepared clinic workspace", async () => {
  const result = await resetDemoSession({
    actorUserId: adminActorId,
    workspaceId: "clair-demo",
  });

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "unsupported_workspace",
  });
});

test("demo session reset requires hospital admin permission", async () => {
  const result = await resetDemoSession({
    actorUserId: "user-front-desk",
    workspaceId,
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

  expect(result).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_admin_required",
  });
});

test("demo session reset preserves mock fallback as local-only reset", async () => {
  const result = await resetDemoSession({
    actorUserId: adminActorId,
    workspaceId,
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
    workspaceId,
    mode: "local_only",
    enforcedBy: "demo-session-reset",
    counts: {
      encounters: 0,
      generatedPatients: 0,
    },
  });
});

test("supabase demo reset gateway calls the scoped RPC and maps counts", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseDemoSessionResetGateway({
    async rpc(functionName, args) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_actor_user_id}`);
      return {
        data: {
          appointments: 1,
          encounters: 2,
          waitingQueueEntries: 3,
          soapNotes: 4,
          diagnoses: 5,
          orderGroups: 6,
          orders: 7,
          fulfillmentWorkItems: 8,
          billingCheckoutSessions: 9,
          billingCheckoutSessionInvoices: 10,
          billingInvoiceStatusEvents: 11,
          invoiceAdjustments: 12,
          paymentAllocations: 13,
          invoices: 14,
          invoiceLines: 15,
          payments: 16,
          generatedPatients: 17,
          generatedGuardians: 18,
        },
        error: null,
      };
    },
  });

  const result = await gateway.resetSession({
    actorUserId: "49110000-0000-4000-8000-000000000001",
    workspaceId,
  });

  expect(calls).toEqual([
    "clair_reset_cheongdam_demo_session:workspace-clair-cheongdam:49110000-0000-4000-8000-000000000001",
  ]);
  expect(result).toMatchObject({
    ok: true,
    mode: "remote_supabase",
    counts: {
      encounters: 2,
      fulfillmentWorkItems: 8,
      billingCheckoutSessions: 9,
      billingCheckoutSessionInvoices: 10,
      billingInvoiceStatusEvents: 11,
      invoiceAdjustments: 12,
      paymentAllocations: 13,
      generatedPatients: 17,
      generatedGuardians: 18,
    },
  });
});

test("demo reset route stays server-owned and avoids secret-shaped values", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/demo/session-reset/route.ts",
    "utf8"
  );
  const serverSource = readFileSync(
    "src/features/demo-session/server-demo-session-reset.ts",
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

test("demo reset migration keeps reset scoped and preserves Cheongdam seed master data", () => {
  const migrationSource = readFileSync(
    "supabase/migrations/20260616054000_demo_session_reset_rpc.sql",
    "utf8"
  );

  expect(migrationSource).toContain(
    "create or replace function public.clair_reset_cheongdam_demo_session"
  );
  expect(migrationSource).toContain("v_allowed_workspace_id constant text := 'workspace-clair-cheongdam'");
  expect(migrationSource).toContain("auth.uid() is null");
  expect(migrationSource).toContain("v_actor_uuid <> auth.uid()");
  expect(migrationSource).toContain("private.clair_is_workspace_admin(p_workspace_id)");
  expect(migrationSource).toContain("patient.patient_no ~ '^P-[0-9]{6}-[A-F0-9]{6}$'");
  expect(migrationSource).toContain("guardian.id = any(v_generated_guardian_ids)");
  expect(migrationSource).toContain("guardian.guardian_code, '') not like 'CD-G-%'");
  expect(migrationSource).toContain("delete from public.order_fulfillment_work_items");
  expect(migrationSource).toContain("delete from public.billing_checkout_session_invoices");
  expect(migrationSource).toContain("delete from public.billing_checkout_sessions");
  expect(migrationSource).toContain("delete from public.payment_allocations");
  expect(migrationSource).toContain("delete from public.invoices");
  expect(migrationSource).toContain("delete from public.appointments");
  expect(migrationSource).toContain(
    "grant execute on function public.clair_reset_cheongdam_demo_session"
  );
  expect(migrationSource).not.toMatch(/delete from public\.(users|workspaces|user_memberships|service_items|service_categories|permission_policies)/);
  expect(migrationSource).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});
