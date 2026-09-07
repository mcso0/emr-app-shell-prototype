import type { GlobalNotification } from "./mock-notifications";

export const notificationPreferenceCategories = [
  {
    key: "order_recheck_requested",
    label: "오더 재확인 요청",
    description: "담당 오더의 재확인 요청을 알려드립니다.",
  },
  {
    key: "clinical_result_completed",
    label: "검사 결과",
    description: "수신 대상인 검사 결과 등록을 알려드립니다.",
  },
  {
    key: "waiting_over_30m",
    label: "접수 대기 지연",
    description: "접수 후 30분 이상 대기한 환자를 알려드립니다.",
  },
  {
    key: "clinical_master_update_available",
    label: "임상 마스터 업데이트",
    description: "병원 관리자에게 마스터 업데이트를 알려드립니다.",
  },
] as const;
export type NotificationPreferenceCategory =
  (typeof notificationPreferenceCategories)[number]["key"];
export type NotificationPreferences = {
  popup: boolean;
  sound: boolean;
  categories: Record<NotificationPreferenceCategory, boolean>;
};
export const NOTIFICATION_PREFERENCES_EVENT =
  "clair:notification-preferences-changed";
export function defaultNotificationPreferences(): NotificationPreferences {
  return {
    popup: true,
    sound: false,
    categories: {
      order_recheck_requested: true,
      clinical_result_completed: true,
      waiting_over_30m: true,
      clinical_master_update_available: true,
    },
  };
}
export function parseNotificationPreferences(
  value: unknown,
): NotificationPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) => !["popup", "sound", "categories"].includes(key),
    ) ||
    typeof input.popup !== "boolean" ||
    typeof input.sound !== "boolean" ||
    !input.categories ||
    typeof input.categories !== "object" ||
    Array.isArray(input.categories)
  )
    return null;
  const categories = input.categories as Record<string, unknown>;
  if (
    Object.keys(categories).length !==
      notificationPreferenceCategories.length ||
    notificationPreferenceCategories.some(
      ({ key }) => typeof categories[key] !== "boolean",
    )
  )
    return null;
  return {
    popup: input.popup,
    sound: input.sound,
    categories: { ...categories } as NotificationPreferences["categories"],
  };
}
export function resolvePreferredNotificationDelivery(
  notification: GlobalNotification,
  preferences: NotificationPreferences,
  eligible: boolean,
) {
  const category =
    preferences.categories[
      notification.event_key as NotificationPreferenceCategory
    ] ?? true;
  const urgent = notification.priority === "urgent";
  return {
    popup: eligible && (urgent || (preferences.popup && category)),
    sound: eligible && preferences.sound && (urgent || category),
  };
}
