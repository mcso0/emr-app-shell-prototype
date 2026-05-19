import type {
  AppointmentStatus,
  ConsentStatus,
  CsHistoryStatus,
  EmrOrderStatus,
  EmrOrderWorkStatus,
  EncounterStatus,
  EquipmentReceiptStatus,
  ImagingStudyStatus,
  InvoiceStatus,
  LabResultJudgment,
  LabResultStatus,
  MessageStatus,
  OrderGroupStatus,
  OrderPriority,
  PaymentStatus,
  PrescriptionStatus,
  SoapNoteStatus,
  WaitingQueueStatus,
} from "@/types/emr-domain";

export type StatusLabelDomainMap = {
  appointment: AppointmentStatus;
  consent: ConsentStatus;
  csHistory: CsHistoryStatus;
  encounter: EncounterStatus;
  equipmentReceipt: EquipmentReceiptStatus;
  imagingStudy: ImagingStudyStatus;
  invoice: InvoiceStatus;
  labJudgment: LabResultJudgment;
  labResult: LabResultStatus;
  message: MessageStatus;
  order: EmrOrderStatus;
  orderGroup: OrderGroupStatus;
  orderWork: EmrOrderWorkStatus;
  payment: PaymentStatus;
  prescription: PrescriptionStatus;
  priority: OrderPriority;
  queue: WaitingQueueStatus;
  soap: SoapNoteStatus;
};

export const statusLabels = {
  appointment: {
    requested: "예약요청",
    confirmed: "예약확정",
    changed: "예약변경",
    cancelled: "예약취소",
    checked_in: "접수완료",
    no_show: "노쇼",
  },
  consent: {
    granted: "동의",
    revoked: "철회",
  },
  csHistory: {
    queued: "대기",
    in_progress: "처리중",
    completed: "완료",
    needs_follow_up: "추적필요",
  },
  encounter: {
    waiting: "대기",
    in_consultation: "진료중",
    ordered: "오더진행",
    ready_for_billing: "수납대기",
    completed: "완료",
    cancelled: "취소",
  },
  equipmentReceipt: {
    received: "수신",
    matched: "매칭",
    unmatched: "미매칭",
    ignored: "무시",
  },
  imagingStudy: {
    requested: "요청",
    captured: "촬영",
    reading: "판독중",
    read: "판독완료",
    reviewed: "확인",
  },
  invoice: {
    draft: "미수납",
    issued: "청구확정",
    paid: "수납완료",
    refund_requested: "환불요청",
    refunded: "환불완료",
    voided: "무효",
  },
  labJudgment: {
    low: "낮음",
    normal: "정상",
    high: "높음",
    critical: "위험",
    not_judged: "미판정",
  },
  labResult: {
    pending: "대기",
    received: "수신",
    entered: "입력",
    completed: "완료",
    reviewed: "확인",
  },
  message: {
    queued: "대기",
    sent: "발송",
    delivered: "전달완료",
    failed: "실패",
    cancelled: "취소",
  },
  order: {
    requested: "요청",
    re_requested: "재요청",
    in_progress: "진행중",
    confirmed: "확정",
    completed: "완료",
    cancelled: "취소",
  },
  orderGroup: {
    requested: "요청",
    in_progress: "진행중",
    completed: "완료",
    cancelled: "취소",
  },
  orderWork: {
    pending: "대기",
    completed: "완료",
  },
  payment: {
    approved: "승인",
    cancelled: "취소",
    refunded: "환불",
    failed: "실패",
  },
  prescription: {
    draft: "임시저장",
    ordered: "오더생성",
    sent: "전송",
    cancelled: "취소",
    completed: "완료",
  },
  priority: {
    urgent: "긴급",
    high: "높음",
    normal: "보통",
    low: "낮음",
  },
  queue: {
    waiting: "대기",
    called: "호출",
    in_progress: "진행중",
    done: "완료",
    cancelled: "취소",
  },
  soap: {
    draft: "임시저장",
    autosaved: "자동저장",
    signed: "서명완료",
    amended: "수정됨",
    voided: "무효",
  },
} satisfies {
  [Domain in keyof StatusLabelDomainMap]: Record<StatusLabelDomainMap[Domain], string>;
};

export function getStatusLabel<Domain extends keyof StatusLabelDomainMap>(
  domain: Domain,
  status: StatusLabelDomainMap[Domain]
) {
  const labels = statusLabels[domain] as Record<StatusLabelDomainMap[Domain], string>;

  return labels[status];
}
