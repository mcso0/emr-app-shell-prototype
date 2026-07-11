import { expect, test } from "@playwright/test";
import {
  createDemoHospitalScheduleOperationsGateway,
  executeHospitalScheduleOperation,
} from "@/features/hospital-admin/schedule/server-schedule-operations-core";
import { createMockWorkspacePermissionAdapter } from "@/features/auth/permission-resolver";

const workspaceId = "workspace-clair-cheongdam";

function createPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "user-admin", status: "active" },
      { id: "user-staff", status: "active" },
    ],
    memberships: [
      {
        id: "membership-admin",
        workspaceId,
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-staff",
        workspaceId,
        userId: "user-staff",
        roles: ["vet"],
        status: "active",
      },
    ],
  });
}

test("staff can submit their own request but cannot review it", async () => {
  const gateway = createDemoHospitalScheduleOperationsGateway();
  const permissionAdapter = createPermissionAdapter();

  const request = await executeHospitalScheduleOperation({
    actorUserId: "user-staff",
    action: {
      type: "request",
      date: "2026-07-08",
      reason: "개인 일정",
      requestType: "leave",
      shiftId: "shift-suji-mon",
    },
    gateway,
    permissionAdapter,
    workspaceId,
  });

  expect(request).toMatchObject({ ok: true, status: 201, action: "request" });

  const review = await executeHospitalScheduleOperation({
    actorUserId: "user-staff",
    action: { type: "review_request", decision: "approved", requestId: "request-1" },
    gateway,
    permissionAdapter,
    workspaceId,
  });

  expect(review).toMatchObject({
    ok: false,
    status: 403,
    error: "permission_missing",
  });
});

test("admin can request assisted assignment and create a payroll preview", async () => {
  const gateway = createDemoHospitalScheduleOperationsGateway();
  const permissionAdapter = createPermissionAdapter();

  const suggestions = await executeHospitalScheduleOperation({
    actorUserId: "user-admin",
    action: {
      type: "assignment_suggestions",
      shift: {
        date: "2026-07-06",
        endMinutes: 14 * 60,
        id: "shift-unassigned",
        kind: "support",
        locationLabel: null,
        note: null,
        staffId: null,
        startMinutes: 10 * 60,
        workLabel: "검사 지원",
      },
    },
    gateway,
    permissionAdapter,
    workspaceId,
  });

  expect(suggestions).toMatchObject({ ok: true, status: 200, action: "assignment_suggestions" });
  expect(
    suggestions.ok && suggestions.action === "assignment_suggestions" && suggestions.suggestions[0],
  ).toMatchObject({ staffId: "staff-jiho" });

  const payroll = await executeHospitalScheduleOperation({
    actorUserId: "user-admin",
    action: { type: "payroll_preview", periodEnd: "2026-07-12", periodStart: "2026-07-06" },
    gateway,
    permissionAdapter,
    workspaceId,
  });

  expect(payroll).toMatchObject({
    ok: true,
    status: 201,
    action: "payroll_preview",
    preview: { status: "preview", totalMinutes: 480, totalPayCents: 20000 },
  });

  const saveShift = await executeHospitalScheduleOperation({
    actorUserId: "user-admin",
    action: {
      type: "save_shift",
      shift: {
        date: "2026-07-09",
        endMinutes: 15 * 60,
        id: "draft-shift",
        kind: "support",
        locationLabel: "검사실",
        note: null,
        staffId: "staff-jiho",
        startMinutes: 12 * 60,
        workLabel: "검사 지원",
      },
    },
    gateway,
    permissionAdapter,
    workspaceId,
  });

  expect(saveShift).toMatchObject({ ok: true, status: 200, action: "save_shift" });
});
