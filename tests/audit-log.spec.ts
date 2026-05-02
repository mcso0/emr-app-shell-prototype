import { expect, test } from "@playwright/test";
import {
  appendAuditLogEvent,
  buildAuditLogChanges,
  buildOrderStatusChangeAuditEvent,
  buildProfileEditAuditEvent,
} from "../src/lib/emr-domain/audit-log";
import {
  getMockAuditLogEventsByEncounter,
  getMockAuditLogEventsByPatient,
  mockAuditLogEvents,
} from "../src/mocks/audit-log";

test("audit fixture seeds representative MVP events", () => {
  expect(mockAuditLogEvents.map((event) => event.eventType)).toEqual([
    "status_transition",
    "profile_edit",
    "soap_save",
    "order_status_change",
    "billing_action",
  ]);

  expect(mockAuditLogEvents[0]).toMatchObject({
    id: "audit-status-transition-encounter-encounter-coco-260501-2026-05-01t10-05-00-09-00",
    action: "status_change",
    entityType: "encounter",
    beforeValue: { status: "waiting" },
    afterValue: { status: "in_consultation" },
    metadata: {
      field: "status",
      fromStatus: "waiting",
      toStatus: "in_consultation",
    },
  });
});

test("audit change builder is deterministic and ignores unchanged fields", () => {
  const changes = buildAuditLogChanges(
    {
      memo: "문자보다 알림톡 선호",
      mobilePhone: "010-3245-1188",
      nested: { b: 2, a: 1 },
    },
    {
      memo: "문자보다 알림톡 선호",
      mobilePhone: "010-3245-1199",
      nested: { a: 1, b: 2 },
    },
    {
      mobilePhone: "휴대전화",
      nested: "중첩 값",
    }
  );

  expect(changes).toEqual([
    {
      field: "mobilePhone",
      label: "휴대전화",
      before: "010-3245-1188",
      after: "010-3245-1199",
    },
  ]);
});

test("profile edit helper produces typed snapshots and field counts", () => {
  const event = buildProfileEditAuditEvent({
    workspaceId: "clair-demo",
    actorUserId: "user-desk-yuna",
    entityType: "guardian",
    entityId: "guardian-lee-jieun",
    guardianId: "guardian-lee-jieun",
    occurredAt: "2026-05-01T09:58:00+09:00",
    beforeValue: {
      address: "서울시 마포구 월드컵북로 12",
      memo: "문자보다 알림톡 선호",
    },
    afterValue: {
      address: "서울시 마포구 월드컵북로 12",
      memo: "알림톡 선호, 부재 시 문자",
    },
    summary: "보호자 메모 수정",
  });

  expect(event).toMatchObject({
    eventType: "profile_edit",
    action: "update",
    beforeValue: { memo: "문자보다 알림톡 선호" },
    afterValue: { memo: "알림톡 선호, 부재 시 문자" },
    metadata: { editedFieldCount: 1 },
  });
});

test("append helper is immutable and orders event streams by timestamp then id", () => {
  const original = mockAuditLogEvents.slice(1, 3);
  const earlierEvent = buildOrderStatusChangeAuditEvent({
    workspaceId: "clair-demo",
    actorUserId: "user-tech-hayun",
    orderId: "order-coco-maropitant",
    patientId: "patient-coco",
    encounterId: "encounter-coco-260501",
    beforeStatus: "requested",
    afterStatus: "in_progress",
    occurredAt: "2026-05-01T10:06:00+09:00",
    summary: "조제 오더 진행 시작",
  });

  const next = appendAuditLogEvent(original, earlierEvent);

  expect(original).toHaveLength(2);
  expect(next.map((event) => event.id)).toEqual([
    earlierEvent.id,
    mockAuditLogEvents[1].id,
    mockAuditLogEvents[2].id,
  ]);
});

test("fixture query helpers keep patient and encounter filters deterministic", () => {
  const cocoPatientEvents = getMockAuditLogEventsByPatient("patient-coco");
  const cocoEncounterEvents = getMockAuditLogEventsByEncounter("encounter-coco-260501");

  expect(cocoPatientEvents.map((event) => event.eventType)).toEqual([
    "status_transition",
    "profile_edit",
    "soap_save",
    "order_status_change",
  ]);
  expect(cocoEncounterEvents.map((event) => event.entityId)).toEqual([
    "encounter-coco-260501",
    "soap-coco-260501",
    "order-coco-cbc",
  ]);
});
