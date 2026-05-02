import {
  buildBillingActionAuditEvent,
  buildOrderStatusChangeAuditEvent,
  buildProfileEditAuditEvent,
  buildSoapSaveAuditEvent,
  buildStatusTransitionAuditEvent,
} from "@/lib/emr-domain/audit-log";
import { MOCK_WORKSPACE_ID } from "@/mocks/emr-domain";
import type { AuditLogEvent } from "@/types/audit-log";

export const mockAuditLogEvents: AuditLogEvent[] = [
  buildStatusTransitionAuditEvent({
    workspaceId: MOCK_WORKSPACE_ID,
    actorUserId: "user-vet-suji",
    entityType: "encounter",
    entityId: "encounter-coco-260501",
    patientId: "patient-coco",
    guardianId: "guardian-lee-jieun",
    encounterId: "encounter-coco-260501",
    beforeStatus: "waiting",
    afterStatus: "in_consultation",
    occurredAt: "2026-05-01T10:05:00+09:00",
    summary: "코코 encounter 상태를 대기에서 진료중으로 변경",
  }),
  buildProfileEditAuditEvent({
    workspaceId: MOCK_WORKSPACE_ID,
    actorUserId: "user-desk-yuna",
    entityType: "patient",
    entityId: "patient-coco",
    patientId: "patient-coco",
    guardianId: "guardian-lee-jieun",
    occurredAt: "2026-05-01T10:12:00+09:00",
    beforeValue: {
      allergyNote: "세팔로스포린 계열 투약 후 구토 이력",
      handlingCautionNote: "낯선 사람에게 예민함.",
    },
    afterValue: {
      allergyNote: "세팔로스포린 계열 투약 후 구토 이력",
      handlingCautionNote: "낯선 사람에게 예민함. 채혈 시 넥카라 권장.",
    },
    fieldLabels: {
      allergyNote: "알러지 메모",
      handlingCautionNote: "핸들링 주의사항",
    },
    reason: "접수 시 보호자 확인",
    summary: "코코 환자 프로필 주의사항 수정",
  }),
  buildSoapSaveAuditEvent({
    workspaceId: MOCK_WORKSPACE_ID,
    actorUserId: "user-vet-suji",
    soapNoteId: "soap-coco-260501",
    patientId: "patient-coco",
    guardianId: "guardian-lee-jieun",
    encounterId: "encounter-coco-260501",
    saveMode: "manual_save",
    status: "autosaved",
    occurredAt: "2026-05-01T10:32:00+09:00",
    beforeValue: {
      plan: "CBC 검사 후 처방 결정",
      status: "draft",
    },
    afterValue: {
      plan: "CBC, 전해질 검사 및 수액 처치. 항구토제 처방.",
      status: "autosaved",
    },
    fieldLabels: {
      plan: "Plan",
      status: "SOAP 상태",
    },
    summary: "코코 SOAP 차트 저장",
  }),
  buildOrderStatusChangeAuditEvent({
    workspaceId: MOCK_WORKSPACE_ID,
    actorUserId: "user-tech-hayun",
    orderId: "order-coco-cbc",
    patientId: "patient-coco",
    guardianId: "guardian-lee-jieun",
    encounterId: "encounter-coco-260501",
    beforeStatus: "requested",
    afterStatus: "in_progress",
    orderType: "lab",
    occurredAt: "2026-05-01T10:40:00+09:00",
    summary: "CBC 검사 오더를 진행중으로 변경",
  }),
  buildBillingActionAuditEvent({
    workspaceId: MOCK_WORKSPACE_ID,
    actorUserId: "user-billing-harin",
    entityType: "invoice",
    entityId: "invoice-dubu-260501",
    patientId: "patient-dubu",
    guardianId: "guardian-jung-harin",
    encounterId: "encounter-dubu-260501",
    billingAction: "discount_applied",
    invoiceStatus: "issued",
    amount: 3000,
    occurredAt: "2026-05-01T10:27:00+09:00",
    beforeValue: {
      discountAmount: 0,
      totalAmount: 31000,
    },
    afterValue: {
      discountAmount: 3000,
      totalAmount: 28000,
    },
    fieldLabels: {
      discountAmount: "할인금액",
      totalAmount: "청구금액",
    },
    reason: "재활 상담 패키지 할인",
    summary: "두부 청구서 할인 적용",
  }),
];

export const getMockAuditLogEventsByPatient = (patientId: string) =>
  mockAuditLogEvents.filter((event) => event.patientId === patientId);

export const getMockAuditLogEventsByEncounter = (encounterId: string) =>
  mockAuditLogEvents.filter((event) => event.encounterId === encounterId);
