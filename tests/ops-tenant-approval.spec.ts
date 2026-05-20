import { expect, test } from "@playwright/test";
import {
  getTenantApplicationWorkspaceGate,
  markTenantWorkspaceCreated,
  transitionTenantApplicationStatus,
  type TenantApplication,
} from "../src/features/ops/tenant-application-model";

const pendingApplication: TenantApplication = {
  id: "tenant-app-hanbit",
  hospitalName: "한빛동물병원",
  representativeName: "김하늘",
  contactEmail: "owner@hanbit.example",
  status: "pending_review",
  workspaceId: null,
  firstAdminInvitationId: null,
  submittedAt: "2026-05-20T00:00:00.000Z",
  reviewedAt: null,
  reviewNote: null,
};

test("tenant application state machine gates workspace creation until approval", () => {
  expect(getTenantApplicationWorkspaceGate(pendingApplication)).toEqual({
    canCreateWorkspace: false,
    reason: "tenant_not_approved",
    label: "승인 후 생성 가능",
  });

  const approved = transitionTenantApplicationStatus(pendingApplication, "approved", {
    operatorUserId: "operator-1",
    reason: "pilot-approved",
    at: "2026-05-20T01:00:00.000Z",
  });

  expect(approved.auditEvent.type).toBe("ops.tenant_application_approved");
  expect(getTenantApplicationWorkspaceGate(approved.application)).toEqual({
    canCreateWorkspace: true,
    reason: null,
    label: "워크스페이스 생성 가능",
  });

  const connected = markTenantWorkspaceCreated(approved.application, {
    workspaceId: "workspace-hanbit",
    firstAdminInvitationId: "invite-hanbit-admin",
  });

  expect(getTenantApplicationWorkspaceGate(connected)).toEqual({
    canCreateWorkspace: false,
    reason: "tenant_workspace_exists",
    label: "워크스페이스 연결됨",
  });
});

test("ops tenant approval surface shows pending tenants and blocks unapproved workspace flow", async ({
  page,
}) => {
  await page.goto("/ops/tenant-approvals");

  await expect(page.getByRole("heading", { name: "CLAiR tenant approvals" })).toBeVisible();
  await expect(page.getByText("미승인 병원은 workspace/member flow에 들어가지 않습니다.")).toBeVisible();
  await expect(page.getByRole("row", { name: /한빛동물병원/ })).toContainText("승인 대기");
  await expect(page.getByRole("row", { name: /한빛동물병원/ })).toContainText("승인 후 생성 가능");
  await expect(page.getByRole("row", { name: /가온동물메디컬센터/ })).toContainText(
    "워크스페이스 생성 가능"
  );
  await expect(page.getByRole("row", { name: /푸른숲동물병원/ })).toContainText(
    "워크스페이스 연결됨"
  );
  await expect(page.getByText("ops.tenant_application_approved")).toBeVisible();
});
