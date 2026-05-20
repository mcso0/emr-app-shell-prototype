import { expect, test } from "@playwright/test";
import {
  getTenantOperationalAccessPolicy,
  transitionTenantOperationalStatus,
  type TenantOperationalStatus,
} from "../src/features/ops/tenant-status-policy";

test("tenant operational status policy defines access impact for invite handoff", () => {
  expect(getTenantOperationalAccessPolicy("trial")).toEqual({
    workspaceEntry: "allowed",
    firstAdminInvite: "allowed",
    staffInvites: "allowed",
    billingEnforcement: "not_enforced",
  });
  expect(getTenantOperationalAccessPolicy("active")).toEqual({
    workspaceEntry: "allowed",
    firstAdminInvite: "allowed",
    staffInvites: "allowed",
    billingEnforcement: "not_enforced",
  });
  expect(getTenantOperationalAccessPolicy("suspended")).toEqual({
    workspaceEntry: "blocked",
    firstAdminInvite: "blocked",
    staffInvites: "blocked",
    billingEnforcement: "not_enforced",
  });
});

test("tenant operational status transition emits safe audit event", () => {
  const transition = transitionTenantOperationalStatus({
    tenantId: "tenant-gaon",
    previousStatus: "trial",
    nextStatus: "active",
    operatorUserId: "clair-operator",
    reason: "pilot-live-ready",
    at: "2026-05-20T02:00:00.000Z",
  });

  expect(transition).toEqual({
    ok: true,
    tenantStatus: "active",
    auditEvent: {
      type: "ops.tenant_status_changed",
      tenantId: "tenant-gaon",
      operatorUserId: "clair-operator",
      previousStatus: "trial",
      nextStatus: "active",
      reason: "pilot-live-ready",
      at: "2026-05-20T02:00:00.000Z",
    },
  });
});

test("tenant operational status transition blocks invalid archived reactivation", () => {
  const transition = transitionTenantOperationalStatus({
    tenantId: "tenant-closed",
    previousStatus: "archived" as TenantOperationalStatus,
    nextStatus: "active",
    operatorUserId: "clair-operator",
    reason: "reactivate",
    at: "2026-05-20T02:00:00.000Z",
  });

  expect(transition).toEqual({
    ok: false,
    denialReason: "invalid_tenant_status_transition",
    previousStatus: "archived",
    nextStatus: "active",
  });
});

test("project 02 handoff documents invite prerequisites and audit coverage", async ({ page }) => {
  await page.goto("/ops/tenant-approvals");

  await expect(page.getByText("Tenant status policy")).toBeVisible();
  await expect(page.getByRole("cell", { name: "suspended" })).toBeVisible();
  await expect(page.getByText("ops.tenant_status_changed")).toBeVisible();
  await expect(page.getByText("Project 03 invite handoff")).toBeVisible();
});
