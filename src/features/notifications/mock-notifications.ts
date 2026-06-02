"use client";

export type GlobalNotification = {
  id: string;
  eventName: string;
  workTypeLabel: string;
  title: string;
  detail: string;
  sourceLabel: string;
  recipientLabel: string;
  issuedAtLabel: string;
  unread: boolean;
  archived: boolean;
  requires_action: boolean;
  badge_count: boolean;
};

export const mockGlobalNotifications: GlobalNotification[] = [
  {
    id: "notif-order-urgent-handoff-kong-cbc",
    eventName: "order_urgent_handoff",
    workTypeLabel: "오더 긴급 전달",
    title: "콩이 CBC 재확인이 필요합니다",
    detail: "진료실에서 검사팀에 긴급 전달했습니다. 원본 오더에서 요청 사유를 확인하세요.",
    sourceLabel: "검사 오더 · CBC 검사 세트",
    recipientLabel: "임상병리검사",
    issuedAtLabel: "방금",
    unread: true,
    archived: false,
    requires_action: true,
    badge_count: true,
  },
  {
    id: "notif-lab-result-kong",
    eventName: "clinical_result_completed",
    workTypeLabel: "검사 결과",
    title: "콩이 CBC 결과가 완료되었습니다",
    detail: "WBC 결과가 참고 범위를 벗어났습니다. 담당 수의사는 결과 화면에서 확인하세요.",
    sourceLabel: "임상병리검사 · CBC",
    recipientLabel: "담당 수의사",
    issuedAtLabel: "7분 전",
    unread: true,
    archived: false,
    requires_action: true,
    badge_count: true,
  },
  {
    id: "notif-waiting-bori",
    eventName: "waiting_over_30m",
    workTypeLabel: "접수 대기열",
    title: "보리 대기 시간이 30분을 초과했습니다",
    detail: "데스크는 원본 접수 대기열에서 상태를 확인하고 안내하세요.",
    sourceLabel: "접수/예약 · 외래 대기",
    recipientLabel: "데스크",
    issuedAtLabel: "18분 전",
    unread: true,
    archived: false,
    requires_action: true,
    badge_count: true,
  },
  {
    id: "notif-inpatient-delay-nabi",
    eventName: "inpatient_care_delayed",
    workTypeLabel: "입원 투약",
    title: "나비 입원 투약 예정 시간이 지났습니다",
    detail: "입원 담당자는 원본 처치표에서 투약 상태를 확인하세요.",
    sourceLabel: "입원 · 투약 스케줄",
    recipientLabel: "입원 담당자",
    issuedAtLabel: "24분 전",
    unread: true,
    archived: false,
    requires_action: true,
    badge_count: true,
  },
  {
    id: "notif-dispensing-completed-dubu",
    eventName: "dispensing_treatment_completed",
    workTypeLabel: "조제 완료",
    title: "두부 처방 조제가 완료되었습니다",
    detail: "상태 공유 알림입니다. 후속 안내는 원본 조제/처치 화면에서 확인하세요.",
    sourceLabel: "조제/처치 · 처방 조제",
    recipientLabel: "데스크",
    issuedAtLabel: "31분 전",
    unread: true,
    archived: false,
    requires_action: false,
    badge_count: false,
  },
  {
    id: "notif-imaging-completed-choco",
    eventName: "imaging_result_completed",
    workTypeLabel: "영상 결과",
    title: "초코 복부 영상 판독이 완료되었습니다",
    detail: "읽은 참고 알림입니다. 필요하면 원본 영상 결과 화면에서 확인하세요.",
    sourceLabel: "영상 · 복부 촬영",
    recipientLabel: "담당 수의사",
    issuedAtLabel: "어제",
    unread: false,
    archived: true,
    requires_action: false,
    badge_count: false,
  },
];

export function resolveNotificationBadgeCount(notifications: GlobalNotification[]) {
  return notifications.filter((notification) => notification.unread && notification.badge_count).length;
}

export function resolveNotificationUnreadCount(notifications: GlobalNotification[]) {
  return notifications.filter((notification) => notification.unread && !notification.archived).length;
}
