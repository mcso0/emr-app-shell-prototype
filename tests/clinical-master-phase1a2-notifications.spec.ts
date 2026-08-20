import { expect, test } from "@playwright/test";

import {
  createDemoLiveNotificationEventStore,
  createDemoNotificationPermissionAdapter,
  emitLiveNotificationEvent,
  readLiveNotifications,
  type LiveNotificationEventInput,
} from "../src/features/notifications/server-notifications-core";

function masterUpdateEvent(overrides: Partial<LiveNotificationEventInput> = {}): LiveNotificationEventInput {
  return {
    workspaceId: "clair-demo",
    eventKey: "clinical_master_update_available",
    dedupeKey: "clinical-master-update:update-1",
    domain: "hospital_admin",
    priority: "normal",
    toastPolicy: "role_active",
    title: "임상 마스터 업데이트 검토",
    preview: "새 마스터 주문을 검토해 주세요.",
    detail: "안전한 검토 화면으로 이동합니다.",
    workTypeLabel: "임상 마스터 업데이트",
    sourceLabel: "임상 마스터",
    sourceActionLabel: "검토 필요",
    recipient: { kind: "active_role", id: "hospital_admin", label: "병원 관리자" },
    source: {
      kind: "fallback_detail",
      entity_id: "update-1",
      route: "/w/clair-demo/hospital-admin/order-catalog?update=update-1",
    },
    requiresAction: true,
    badgeCount: true,
    eventScopeId: "update-1",
    actorUserId: "user-admin",
    ...overrides,
  };
}

test("clinical master notifications are hospital-admin-only and route-safe", async () => {
  const eventStore = createDemoLiveNotificationEventStore();
  const permissionAdapter = createDemoNotificationPermissionAdapter();
  const event = masterUpdateEvent();
  const first = emitLiveNotificationEvent({ event, eventStore });
  const second = emitLiveNotificationEvent({ event, eventStore });

  expect(first.ok).toBe(true);
  expect(second.ok).toBe(true);
  expect(eventStore.getWorkspaceNotifications("clair-demo", "update-1")).toHaveLength(1);

  const admin = await readLiveNotifications({
    actorUserId: "user-admin",
    eventStore,
    eventScopeId: "update-1",
    permissionAdapter,
    workspaceId: "clair-demo",
  });
  expect(admin.ok).toBe(true);
  if (admin.ok) {
    expect(admin.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventKey: "clinical_master_update_available",
          domain: "hospital_admin",
          sourceKind: "fallback_detail",
          sourceEntityId: "update-1",
          sourceRoute: "/w/clair-demo/hospital-admin/order-catalog?update=update-1",
        }),
      ]),
    );
  }

  const vet = await readLiveNotifications({
    actorUserId: "user-vet",
    eventStore,
    eventScopeId: "update-1",
    permissionAdapter,
    workspaceId: "clair-demo",
  });
  expect(vet.ok).toBe(true);
  if (vet.ok) expect(vet.notifications).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ eventKey: "clinical_master_update_available" })]),
  );
});

test("clinical master event payload does not carry review snapshots", () => {
  const event = masterUpdateEvent();
  expect(event.source).not.toHaveProperty("source_snapshot");
  expect(event.source).not.toHaveProperty("workspace_snapshot");
  expect(event.source).not.toHaveProperty("price_krw");
  expect(event.source).not.toHaveProperty("internal_instruction");
});
