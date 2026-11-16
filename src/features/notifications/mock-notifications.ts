import { LEGACY_SALES_DEMO_WORKSPACE_ID } from "@/lib/emr-domain/demo-workspaces";

export type GlobalNotification = {
  id: string;
  event_key:
    | "order_urgent_handoff"
    | "order_recheck_requested"
    | "assigned_order_completed"
    | "order_assigned"
    | "order_assignment_cancelled"
    | "order_cancelled"
    | "overall_instruction_changed"
    | "clinical_result_completed"
    | "device_result_received"
    | "imaging_result_completed"
    | "waiting_over_30m"
    | "dispensing_treatment_completed"
    | "billing_waiting_ready"
    | "inpatient_care_delayed"
    | "clinical_master_update_available";
  dedupe_key: string;
  domain:
    | "reception"
    | "chart"
    | "lab"
    | "imaging"
    | "dispensing_treatment"
    | "billing"
    | "inpatient"
    | "hospital_admin";
  priority: "urgent" | "high" | "normal" | "reference";
  toast_policy: "immediate" | "role_active" | "source_context_only" | "drawer_only" | "inline_first";
  sourceActionLabel: string;
  workTypeLabel: string;
  title: string;
  preview: string;
  detail: string;
  sourceLabel: string;
  recipientLabel: string;
  recipient: {
    kind: "user" | "active_role" | "role_queue";
    id: string;
    label: string;
  };
  source: {
    kind:
      | "order"
      | "lab_result"
      | "imaging_result"
      | "reception_queue"
      | "dispensing_treatment"
      | "billing_candidate"
      | "inpatient_care"
      | "fallback_detail";
    route?: string;
    entity_id?: string;
    fallback_reason?: "missing_source" | "closed_encounter" | "permission_unavailable";
  };
  patient_context?: {
    patient_name: string;
    guardian_name?: string;
    encounter_label?: string;
  };
  order_context?: {
    order_name: string;
    order_id?: string;
  };
  requester?: {
    label: string;
    role?: string;
  };
  badge_reason?: string;
  fallback_reason?: "missing_source" | "closed_encounter" | "permission_unavailable";
  bump_count?: number;
  issuedAtLabel: string;
  created_at: string;
  updated_at: string;
  read_state_key: "clair.notifications.v0.read";
  archive_state_key: "clair.notifications.v0.archive";
  unread: boolean;
  archived: boolean;
  requires_action: boolean;
  badge_count: boolean;
};

export type NotificationLocalState = {
  readIds: string[];
  archivedIds: string[];
};

export type NotificationRecipientContext = {
  userId?: string;
  activeRoleIds: string[];
  includeRoleQueue?: boolean;
};

export type NotificationRecipientRuleResult = {
  recipientMatched: boolean;
  actionOwned: boolean;
  badgeEligible: boolean;
  ownership: "direct_user" | "active_role" | "role_queue" | "not_recipient";
  reason: string;
};

export type NotificationDedupeKeyInput = {
  patientId: string;
  eventKey: GlobalNotification["event_key"];
  orderId?: string;
};

export type NotificationDedupeResult = {
  notifications: GlobalNotification[];
  action: "appended" | "bumped";
  notification: GlobalNotification;
};

export const NOTIFICATION_READ_STATE_KEY = "clair.notifications.v0.read";
export const NOTIFICATION_ARCHIVE_STATE_KEY = "clair.notifications.v0.archive";
const legacyNotificationRoutePrefix = `/w/${LEGACY_SALES_DEMO_WORKSPACE_ID}`;

export const demoNotificationRecipientContext: NotificationRecipientContext = {
  userId: "user-vet",
  activeRoleIds: ["lab", "vet", "desk", "inpatient", "billing", "imaging", "dispensing_treatment"],
  includeRoleQueue: true,
};

export const mockGlobalNotifications: GlobalNotification[] = [
  {
    id: "notif-order-urgent-handoff-kong-cbc",
    event_key: "order_urgent_handoff",
    dedupe_key: "patient-kong-order-cbc-order_urgent_handoff",
    domain: "lab",
    priority: "urgent",
    toast_policy: "immediate",
    sourceActionLabel: "오더 열기",
    workTypeLabel: "검사",
    title: "콩이 CBC 재확인이 필요합니다",
    preview: "진료실에서 검사팀에 긴급 전달했습니다.",
    detail: "진료실에서 검사팀에 긴급 전달했습니다. 원본 오더에서 요청 사유를 확인하세요.",
    sourceLabel: "검사 오더 · CBC 검사 세트",
    recipientLabel: "임상병리검사",
    recipient: { kind: "active_role", id: "lab", label: "임상병리검사" },
    source: {
      kind: "order",
      route: "/w/clair-demo/lab?modulePanel=open&labResultId=lab-result-kong-cbc",
      entity_id: "order-demo-cbc-kong",
    },
    patient_context: {
      patient_name: "콩이",
      guardian_name: "김하늘 보호자",
      encounter_label: "외래 진료",
    },
    order_context: {
      order_name: "CBC 검사 세트",
      order_id: "order-demo-cbc-kong",
    },
    requester: {
      label: "진료실",
      role: "담당 수의사",
    },
    badge_reason: "긴급 전달된 담당 오더가 당일 검사 흐름을 지연시킬 수 있음",
    issuedAtLabel: "방금",
    created_at: "2026-06-02T09:40:00+09:00",
    updated_at: "2026-06-02T09:40:00+09:00",
    read_state_key: "clair.notifications.v0.read",
    archive_state_key: "clair.notifications.v0.archive",
    unread: true,
    archived: false,
    requires_action: true,
    badge_count: true,
  },
  {
    id: "notif-order-recheck-bori-cbc-sample",
    event_key: "order_recheck_requested",
    dedupe_key: "patient-bori-order-cbc-order_recheck_requested",
    domain: "lab",
    priority: "high",
    toast_policy: "role_active",
    sourceActionLabel: "오더 열기",
    workTypeLabel: "검사",
    title: "보리 CBC 검체 재확인을 진행해 주세요",
    preview: "이수지 수의사가 검체 상태와 장비 flag 확인을 요청했습니다.",
    detail: "이수지 수의사가 검체 상태와 장비 flag 확인을 요청했습니다. 원본 오더에서 재확인 사유를 확인하세요.",
    sourceLabel: "검사 오더 · CBC 검체",
    recipientLabel: "임상병리검사",
    recipient: { kind: "role_queue", id: "lab", label: "임상병리검사" },
    source: {
      kind: "order",
      route: "/w/clair-demo/lab?modulePanel=open&labResultId=lab-result-bori-cbc",
      entity_id: "order-demo-cbc-bori",
    },
    patient_context: {
      patient_name: "보리",
      guardian_name: "정하린 보호자",
      encounter_label: "외래 진료",
    },
    order_context: {
      order_name: "CBC 검체",
      order_id: "order-demo-cbc-bori",
    },
    requester: {
      label: "이수지 수의사",
      role: "담당 수의사",
    },
    badge_reason: "재확인 요청을 놓치면 검사 결과 확정과 후속 진료가 지연될 수 있음",
    issuedAtLabel: "3분 전",
    created_at: "2026-06-02T09:38:00+09:00",
    updated_at: "2026-06-02T09:39:00+09:00",
    read_state_key: "clair.notifications.v0.read",
    archive_state_key: "clair.notifications.v0.archive",
    unread: true,
    archived: false,
    requires_action: true,
    badge_count: true,
    bump_count: 2,
  },
  {
    id: "notif-lab-result-kong",
    event_key: "clinical_result_completed",
    dedupe_key: "patient-kong-order-cbc-clinical_result_completed",
    domain: "lab",
    priority: "normal",
    toast_policy: "role_active",
    sourceActionLabel: "검사 결과 열기",
    workTypeLabel: "검사",
    title: "콩이 CBC 결과가 완료되었습니다",
    preview: "담당 수의사 확인 대기 · 결과 화면에서 세부 수치를 확인할 수 있습니다.",
    detail: "WBC 결과가 참고 범위를 벗어났습니다. 담당 수의사는 결과 화면에서 확인하세요.",
    sourceLabel: "임상병리검사 · CBC",
    recipientLabel: "담당 수의사",
    recipient: { kind: "active_role", id: "vet", label: "담당 수의사" },
    source: {
      kind: "lab_result",
      route: "/w/clair-demo/lab?modulePanel=open&labResultId=lab-result-kong-cbc",
      entity_id: "lab-result-kong-cbc",
    },
    patient_context: {
      patient_name: "콩이",
      guardian_name: "김하늘 보호자",
      encounter_label: "외래 진료",
    },
    order_context: {
      order_name: "CBC",
      order_id: "order-demo-cbc-kong",
    },
    badge_reason: "담당 수의사가 결과를 확인하지 않으면 후속 진료 판단이 지연될 수 있음",
    issuedAtLabel: "7분 전",
    created_at: "2026-06-02T09:35:00+09:00",
    updated_at: "2026-06-02T09:35:00+09:00",
    read_state_key: "clair.notifications.v0.read",
    archive_state_key: "clair.notifications.v0.archive",
    unread: true,
    archived: false,
    requires_action: true,
    badge_count: true,
  },
  {
    id: "notif-assigned-order-completed-lulu-fluid",
    event_key: "assigned_order_completed",
    dedupe_key: "patient-lulu-order-fluid-assigned_order_completed",
    domain: "chart",
    priority: "normal",
    toast_policy: "role_active",
    sourceActionLabel: "오더 화면 열기",
    workTypeLabel: "진료",
    title: "루루 수액 처치가 완료되었습니다",
    preview: "담당자 확인 대기 · 완료 결과를 확인하고 다음 업무에 반영하세요.",
    detail: "담당자 확인 대기 상태입니다. 원본 오더에서 수행 기록과 후속 안내를 확인하세요.",
    sourceLabel: "진료 오더 · 수액 처치",
    recipientLabel: "담당 수의사",
    recipient: { kind: "user", id: "user-vet", label: "담당 수의사" },
    source: {
      kind: "order",
      route: "/w/clair-demo/chart?modulePanel=open&encounterId=encounter-lulu-fluid",
      entity_id: "order-demo-fluid-lulu",
    },
    patient_context: {
      patient_name: "루루",
      guardian_name: "박서연 보호자",
      encounter_label: "외래 진료",
    },
    order_context: {
      order_name: "수액 처치",
      order_id: "order-demo-fluid-lulu",
    },
    badge_reason: "담당 오더 완료 확인이 늦어지면 후속 진료 안내가 지연될 수 있음",
    issuedAtLabel: "12분 전",
    created_at: "2026-06-02T09:30:00+09:00",
    updated_at: "2026-06-02T09:30:00+09:00",
    read_state_key: "clair.notifications.v0.read",
    archive_state_key: "clair.notifications.v0.archive",
    unread: true,
    archived: false,
    requires_action: true,
    badge_count: true,
  },
  {
    id: "notif-device-result-tori-fuji",
    event_key: "device_result_received",
    dedupe_key: "patient-tori-order-chem-device_result_received",
    domain: "lab",
    priority: "normal",
    toast_policy: "inline_first",
    sourceActionLabel: "장비 결과 열기",
    workTypeLabel: "검사",
    title: "토리 FUJI DRI-CHEM 결과가 도착했습니다",
    preview: "연동 장비에서 결과를 보냈지만 원본 오더 연결을 확인해야 합니다.",
    detail: "연동 장비에서 결과를 보냈지만 원본 오더 연결을 확인해야 합니다. 검사 담당자는 결과 검토 화면에서 매칭 대상을 확인하세요.",
    sourceLabel: "장비 결과 · FUJI DRI-CHEM",
    recipientLabel: "임상병리검사",
    recipient: { kind: "active_role", id: "lab", label: "임상병리검사" },
    source: {
      kind: "fallback_detail",
      entity_id: "device-result-tori-fuji-unmatched",
      fallback_reason: "missing_source",
    },
    patient_context: {
      patient_name: "토리",
      guardian_name: "최하린 보호자",
      encounter_label: "검사 대기",
    },
    order_context: {
      order_name: "혈청화학 검사",
      order_id: "order-demo-chem-tori",
    },
    badge_reason: "장비 결과 연결 확인이 늦어지면 검사 결과 확정이 지연될 수 있음",
    fallback_reason: "missing_source",
    issuedAtLabel: "14분 전",
    created_at: "2026-06-02T09:28:00+09:00",
    updated_at: "2026-06-02T09:28:00+09:00",
    read_state_key: "clair.notifications.v0.read",
    archive_state_key: "clair.notifications.v0.archive",
    unread: true,
    archived: false,
    requires_action: true,
    badge_count: true,
  },
  {
    id: "notif-waiting-bori",
    event_key: "waiting_over_30m",
    dedupe_key: "patient-bori-reception-waiting_over_30m",
    domain: "reception",
    priority: "normal",
    toast_policy: "role_active",
    sourceActionLabel: "대기열 열기",
    workTypeLabel: "접수",
    title: "보리 대기 시간이 30분을 초과했습니다",
    preview: "접수 후 30분이 지났습니다.",
    detail: "데스크는 원본 접수 대기열에서 상태를 확인하고 안내하세요.",
    sourceLabel: "접수/예약 · 외래 대기",
    recipientLabel: "데스크",
    recipient: { kind: "role_queue", id: "desk", label: "데스크" },
    source: {
      kind: "reception_queue",
      route: "/w/clair-demo/reception?modulePanel=open",
      entity_id: "encounter-bori-260501",
    },
    patient_context: {
      patient_name: "보리",
      guardian_name: "정하린 보호자",
      encounter_label: "외래 대기",
    },
    badge_reason: "대기 안내가 늦어지면 데스크 응대와 진료 흐름이 지연될 수 있음",
    issuedAtLabel: "18분 전",
    created_at: "2026-06-02T09:24:00+09:00",
    updated_at: "2026-06-02T09:24:00+09:00",
    read_state_key: "clair.notifications.v0.read",
    archive_state_key: "clair.notifications.v0.archive",
    unread: true,
    archived: false,
    requires_action: true,
    badge_count: true,
  },
  {
    id: "notif-inpatient-delay-nabi",
    event_key: "inpatient_care_delayed",
    dedupe_key: "patient-nabi-inpatient-medication-inpatient_care_delayed",
    domain: "inpatient",
    priority: "high",
    toast_policy: "role_active",
    sourceActionLabel: "입원 처치표 열기",
    workTypeLabel: "입원",
    title: "나비 입원 투약 예정 시간이 지났습니다",
    preview: "입원 오더의 예정 시간이 지났습니다.",
    detail: "입원 담당자는 원본 처치표에서 투약 상태를 확인하세요.",
    sourceLabel: "입원 · 투약 스케줄",
    recipientLabel: "입원 담당자",
    recipient: { kind: "role_queue", id: "inpatient", label: "입원 담당자" },
    source: {
      kind: "inpatient_care",
      route: "/w/clair-demo/inpatient?modulePanel=open",
      entity_id: "inpatient-care-nabi-medication",
    },
    patient_context: {
      patient_name: "나비",
      guardian_name: "김도윤 보호자",
      encounter_label: "입원",
    },
    order_context: {
      order_name: "입원 투약",
      order_id: "inpatient-care-nabi-medication",
    },
    badge_reason: "입원 처치 지연을 놓치면 병동 업무와 담당자 확인이 지연될 수 있음",
    issuedAtLabel: "24분 전",
    created_at: "2026-06-02T09:18:00+09:00",
    updated_at: "2026-06-02T09:18:00+09:00",
    read_state_key: "clair.notifications.v0.read",
    archive_state_key: "clair.notifications.v0.archive",
    unread: true,
    archived: false,
    requires_action: true,
    badge_count: true,
  },
  {
    id: "notif-dispensing-completed-dubu",
    event_key: "dispensing_treatment_completed",
    dedupe_key: "patient-dubu-prescription-dispensing_treatment_completed",
    domain: "dispensing_treatment",
    priority: "reference",
    toast_policy: "drawer_only",
    sourceActionLabel: "조제 내역 열기",
    workTypeLabel: "조제",
    title: "두부 처방 조제가 완료되었습니다",
    preview: "조제/처치 상태가 완료로 변경되어 다음 업무에 반영되었습니다.",
    detail: "상태 공유 알림입니다. 후속 안내는 원본 조제/처치 화면에서 확인하세요.",
    sourceLabel: "조제/처치 · 처방 조제",
    recipientLabel: "데스크",
    recipient: { kind: "role_queue", id: "desk", label: "데스크" },
    source: {
      kind: "dispensing_treatment",
      route: "/w/clair-demo/dispensing?modulePanel=open",
      entity_id: "order-dubu-prescription",
    },
    patient_context: {
      patient_name: "두부",
      guardian_name: "오지훈 보호자",
      encounter_label: "외래 진료",
    },
    order_context: {
      order_name: "처방 조제",
      order_id: "order-dubu-prescription",
    },
    issuedAtLabel: "31분 전",
    created_at: "2026-06-02T09:11:00+09:00",
    updated_at: "2026-06-02T09:11:00+09:00",
    read_state_key: "clair.notifications.v0.read",
    archive_state_key: "clair.notifications.v0.archive",
    unread: true,
    archived: false,
    requires_action: false,
    badge_count: false,
  },
  {
    id: "notif-billing-ready-gamja",
    event_key: "billing_waiting_ready",
    dedupe_key: "patient-gamja-encounter-260502-billing_waiting_ready",
    domain: "billing",
    priority: "reference",
    toast_policy: "drawer_only",
    sourceActionLabel: "수납 후보 열기",
    workTypeLabel: "수납",
    title: "감자 수납 준비가 완료되었습니다",
    preview: "완료된 오더가 수납 후보에 반영되었습니다.",
    detail: "완료된 오더가 수납 후보에 반영되었습니다. 보호자 안내 준비는 원본 수납 후보 화면에서 확인하세요.",
    sourceLabel: "수납 · 후보 목록",
    recipientLabel: "수납",
    recipient: { kind: "role_queue", id: "billing", label: "수납" },
    source: {
      kind: "billing_candidate",
      route: "/w/clair-demo/billing?modulePanel=open&invoiceId=invoice-candidate-gamja",
      entity_id: "invoice-candidate-gamja",
    },
    patient_context: {
      patient_name: "감자",
      guardian_name: "한민준 보호자",
      encounter_label: "외래 수납",
    },
    badge_reason: "상태 공유 성격의 수납 후보 반영 알림이므로 shell badge에서 제외",
    issuedAtLabel: "37분 전",
    created_at: "2026-06-02T09:05:00+09:00",
    updated_at: "2026-06-02T09:05:00+09:00",
    read_state_key: "clair.notifications.v0.read",
    archive_state_key: "clair.notifications.v0.archive",
    unread: true,
    archived: false,
    requires_action: false,
    badge_count: false,
  },
  {
    id: "notif-imaging-completed-choco",
    event_key: "imaging_result_completed",
    dedupe_key: "patient-choco-imaging-abdomen-imaging_result_completed",
    domain: "imaging",
    priority: "normal",
    toast_policy: "role_active",
    sourceActionLabel: "영상 결과 열기",
    workTypeLabel: "영상",
    title: "초코 복부 영상 판독이 완료되었습니다",
    preview: "담당 수의사 확인 대기 · 영상과 판독 소견을 확인하세요.",
    detail: "담당 수의사 확인 대기 상태입니다. 원본 영상 결과 화면에서 영상과 판독 소견을 확인하세요.",
    sourceLabel: "영상 · 복부 촬영",
    recipientLabel: "담당 수의사",
    recipient: { kind: "active_role", id: "vet", label: "담당 수의사" },
    source: {
      kind: "imaging_result",
      route: "/w/clair-demo/imaging?modulePanel=open&imagingStudyId=imaging-choco-abdomen",
      entity_id: "imaging-choco-abdomen",
    },
    patient_context: {
      patient_name: "초코",
      guardian_name: "강서윤 보호자",
      encounter_label: "영상 검사",
    },
    order_context: {
      order_name: "복부 영상",
      order_id: "imaging-choco-abdomen",
    },
    issuedAtLabel: "어제",
    created_at: "2026-06-01T17:12:00+09:00",
    updated_at: "2026-06-01T17:12:00+09:00",
    read_state_key: "clair.notifications.v0.read",
    archive_state_key: "clair.notifications.v0.archive",
    unread: false,
    archived: true,
    requires_action: true,
    badge_count: true,
  },
];

function scopeNotificationRoute(route: string | undefined, workspaceId: string) {
  if (!route) return route;
  return route.split(legacyNotificationRoutePrefix).join(`/w/${workspaceId}`);
}

export function getWorkspaceScopedNotifications(workspaceId: string): GlobalNotification[] {
  return mockGlobalNotifications.map((notification) => {
    const scopedRoute = scopeNotificationRoute(notification.source.route, workspaceId);

    if (scopedRoute === notification.source.route) return notification;

    return {
      ...notification,
      source: {
        ...notification.source,
        route: scopedRoute,
      },
    };
  });
}

export function getInitialNotificationLocalState(
  notifications: GlobalNotification[]
): NotificationLocalState {
  return {
    readIds: notifications.filter((notification) => !notification.unread).map((notification) => notification.id),
    archivedIds: notifications.filter((notification) => notification.archived).map((notification) => notification.id),
  };
}

function readStoredNotificationIds(
  storage: Storage,
  key: string,
  validNotificationIds: Set<string>,
  fallbackIds: string[]
) {
  let storedValue: string | null;

  try {
    storedValue = storage.getItem(key);
  } catch {
    return fallbackIds;
  }

  if (storedValue === null) {
    return fallbackIds;
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(storedValue);
  } catch {
    return fallbackIds;
  }

  if (!Array.isArray(parsedValue)) {
    return fallbackIds;
  }

  return parsedValue.filter(
    (notificationId): notificationId is string =>
      typeof notificationId === "string" && validNotificationIds.has(notificationId)
  );
}

export function readNotificationLocalState(
  storage: Storage,
  notifications: GlobalNotification[]
): NotificationLocalState {
  const initialState = getInitialNotificationLocalState(notifications);
  const validNotificationIds = new Set(notifications.map((notification) => notification.id));

  return {
    readIds: readStoredNotificationIds(
      storage,
      NOTIFICATION_READ_STATE_KEY,
      validNotificationIds,
      initialState.readIds
    ),
    archivedIds: readStoredNotificationIds(
      storage,
      NOTIFICATION_ARCHIVE_STATE_KEY,
      validNotificationIds,
      initialState.archivedIds
    ),
  };
}

export function writeNotificationLocalState(storage: Storage, state: NotificationLocalState) {
  try {
    storage.setItem(NOTIFICATION_READ_STATE_KEY, JSON.stringify(state.readIds));
    storage.setItem(NOTIFICATION_ARCHIVE_STATE_KEY, JSON.stringify(state.archivedIds));
  } catch {
    // localStorage is a v0 UX cache only. If unavailable, keep the in-memory session state.
  }
}

export function applyNotificationLocalState(
  notifications: GlobalNotification[],
  state: NotificationLocalState
): GlobalNotification[] {
  const readIds = new Set(state.readIds);
  const archivedIds = new Set(state.archivedIds);

  return notifications.map((notification) => ({
    ...notification,
    unread: !readIds.has(notification.id),
    archived: archivedIds.has(notification.id),
  }));
}

function includesRole(context: NotificationRecipientContext, roleId: string) {
  return context.activeRoleIds.includes(roleId);
}

export function resolveNotificationRecipientRule(
  notification: GlobalNotification,
  context: NotificationRecipientContext = demoNotificationRecipientContext
): NotificationRecipientRuleResult {
  if (notification.recipient.kind === "user") {
    const recipientMatched = Boolean(context.userId && notification.recipient.id === context.userId);

    return {
      recipientMatched,
      actionOwned: recipientMatched && notification.requires_action,
      badgeEligible: recipientMatched && notification.unread && !notification.archived && notification.badge_count,
      ownership: recipientMatched ? "direct_user" : "not_recipient",
      reason: recipientMatched ? "direct user recipient" : "different direct user recipient",
    };
  }

  if (notification.recipient.kind === "active_role") {
    const recipientMatched = includesRole(context, notification.recipient.id);

    return {
      recipientMatched,
      actionOwned: recipientMatched && notification.requires_action,
      badgeEligible: recipientMatched && notification.unread && !notification.archived && notification.badge_count,
      ownership: recipientMatched ? "active_role" : "not_recipient",
      reason: recipientMatched ? "active role recipient" : "inactive role recipient",
    };
  }

  const roleQueueMatched =
    context.includeRoleQueue !== false &&
    includesRole(context, notification.recipient.id) &&
    notification.requires_action &&
    notification.badge_count;

  return {
    recipientMatched: roleQueueMatched,
    actionOwned: roleQueueMatched,
    badgeEligible: roleQueueMatched && notification.unread && !notification.archived,
    ownership: roleQueueMatched ? "role_queue" : "not_recipient",
    reason: roleQueueMatched
      ? "local role queue action owner; read/archive state is current-browser only"
      : "role queue is unmatched, reference-only, or not badge eligible",
  };
}

export function shouldCountNotificationBadge(
  notification: GlobalNotification,
  context: NotificationRecipientContext = demoNotificationRecipientContext
) {
  return resolveNotificationRecipientRule(notification, context).badgeEligible;
}

export function resolveNotificationBadgeCount(
  notifications: GlobalNotification[],
  context: NotificationRecipientContext = demoNotificationRecipientContext
) {
  return notifications.filter((notification) => shouldCountNotificationBadge(notification, context)).length;
}

export function resolveNotificationUnreadCount(notifications: GlobalNotification[]) {
  return notifications.filter((notification) => notification.unread && !notification.archived).length;
}

export function createNotificationDedupeKey({ patientId, orderId, eventKey }: NotificationDedupeKeyInput) {
  return [patientId, orderId, eventKey].filter(Boolean).join("-");
}

export function upsertNotificationByDedupeKey(
  notifications: GlobalNotification[],
  incomingNotification: GlobalNotification
): NotificationDedupeResult {
  const existingIndex = notifications.findIndex(
    (notification) =>
      notification.dedupe_key === incomingNotification.dedupe_key &&
      notification.unread &&
      !notification.archived
  );

  if (existingIndex === -1) {
    return {
      notifications: [incomingNotification, ...notifications],
      action: "appended",
      notification: incomingNotification,
    };
  }

  const existingNotification = notifications[existingIndex];
  const bumpedNotification: GlobalNotification = {
    ...existingNotification,
    ...incomingNotification,
    id: existingNotification.id,
    unread: existingNotification.unread,
    archived: existingNotification.archived,
    bump_count: (existingNotification.bump_count ?? 1) + 1,
  };
  const remainingNotifications = notifications.filter((_, index) => index !== existingIndex);

  return {
    notifications: [bumpedNotification, ...remainingNotifications],
    action: "bumped",
    notification: bumpedNotification,
  };
}
