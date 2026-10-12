import type { Appointment, Encounter, Guardian, Invoice, Patient, Species } from "@/types/emr-domain";
import type { CustomerProfileOverviewState } from "../customer/use-customer-profile-overview";
import type { CustomerProfileBillingProjection, CustomerProfileHistoryProjection, CustomerProfileOverview, CustomerProfileReservationProjection } from "../customer/server-profile-overview-core";
import type { ProfileBillingItem, ProfileHistoryItem, ProfileReservationItem, ProfileSidePanelModel, ProfileTabAccess } from "./profile-side-panel";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { getPatientDisplayAge } from "./data";
import { formatProfileDate, formatProfileSchedule, formatProfileTime, getProfileMemo, getProfileSexLabel, getProfileSpeciesLabel } from "./profile-side-panel-format";

// Project the existing scoped DTO and section access into presentation values.
// Fetch ownership, permissions and edit commands stay with their current owners.
const liveValue = (value: unknown) => (typeof value === "string" && value.length ? value : undefined);
const liveNumber = (value: unknown) => (typeof value === "number" ? value : undefined);
const liveBoolean = (value: unknown) => (typeof value === "boolean" ? value : undefined);
const getLiveMonthKey = (value?: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return undefined;
  return new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date(value));
};

export function mapLivePatient(profile: Record<string, unknown>, workspaceId: string): Patient {
  const status = liveValue(profile.status);
  const sex = liveValue(profile.sex);

  return {
    id: liveValue(profile.id) ?? "",
    patientNo: liveValue(profile.patientNo) ?? "",
    workspaceId,
    name: liveValue(profile.name) ?? "환자 미상",
    species: (liveValue(profile.species) as Species | undefined) ?? "other",
    breed: liveValue(profile.breed),
    birthDate: liveValue(profile.birthDate),
    estimatedAgeText: liveValue(profile.estimatedAgeText),
    sex: sex === "male" || sex === "female" ? sex : "unknown",
    neutered: liveBoolean(profile.neutered),
    microchipNo: liveValue(profile.microchipNo),
    patientRegistrationNo: liveValue(profile.patientRegistrationNo),
    weightKg: liveNumber(profile.weightKg),
    allergyNote: liveValue(profile.allergyNote),
    specialNote: liveValue(profile.specialNote) ?? liveValue(profile.profileMemo),
    handlingCautionNote: liveValue(profile.handlingCautionNote),
    handlingCautionLocked: liveBoolean(profile.handlingCautionLocked) ?? false,
    status: status === "inactive" || status === "deceased" ? status : "active",
    createdAt: liveValue(profile.createdAt) ?? "",
    updatedAt: liveValue(profile.updatedAt) ?? "",
  };
}

export function mapLiveGuardian(profile: Record<string, unknown>, workspaceId: string): Guardian {
  return {
    id: liveValue(profile.id) ?? "",
    workspaceId,
    name: liveValue(profile.name) ?? "보호자 미상",
    mobilePhone: liveValue(profile.mobilePhone),
    phone: liveValue(profile.phone),
    email: liveValue(profile.email),
    birthDate: liveValue(profile.birthDate),
    address: liveValue(profile.address),
    memo: liveValue(profile.memo),
    createdAt: liveValue(profile.createdAt) ?? "",
    updatedAt: liveValue(profile.updatedAt) ?? "",
  };
}

function mapLiveHistoryItems(
  items: CustomerProfileHistoryProjection[],
  guardianName?: string,
): ProfileHistoryItem[] {
  return items.map((item) => {
    const time = formatProfileTime(item.occurredAt);
    return {
      clinicianLabel: item.clinicianName ?? "담당의 미지정",
      dateAt: item.occurredAt,
      id: item.id,
      kindLabel: "외래",
      patientId: item.patientId,
      patientName: item.patientName,
      requestedAtLabel: time ? `${time} 접수` : undefined,
      statusLabel: getStatusLabel("encounter", item.status as Encounter["status"]),
      subjectLabel: item.visitPurpose ?? "방문 목적 미입력",
      title: `${item.patientName ?? "환자 미상"}${guardianName ? ` · ${guardianName}` : ""}`,
    };
  });
}

function mapLiveReservationItems(
  items: CustomerProfileReservationProjection[],
  showPatientName: boolean,
): ProfileReservationItem[] {
  return items.map((item) => ({
    description: item.symptomNote ?? item.visitPurpose ?? "예약 메모가 없습니다.",
    id: item.id,
    patientId: item.patientId,
    patientName: item.patientName,
    scheduledAt: item.scheduledStartAt,
    title: [
      showPatientName ? item.patientName ?? "환자 미상" : undefined,
      formatProfileSchedule(item.scheduledStartAt),
      getStatusLabel("appointment", item.status as Appointment["status"]),
    ].filter(Boolean).join(" · "),
  }));
}

function mapLiveBillingItems(
  items: CustomerProfileBillingProjection[],
  guardianName?: string,
): ProfileBillingItem[] {
  return items.map((item) => {
    const time = formatProfileTime(item.activityAt);
    const approvedAmount = item.approvedAmount ?? 0;
    return {
      amountLabel: `${item.totalAmount.toLocaleString("ko-KR")}원`,
      clinicianLabel: undefined,
      dateAt: item.activityAt,
      id: item.id,
      kindLabel: "외래",
      patientId: item.patientId,
      patientName: item.patientName,
      paymentLabel: approvedAmount
        ? `승인 ${approvedAmount.toLocaleString("ko-KR")}원`
        : item.paymentState === "refunded" || item.status === "refunded"
          ? "환불 처리"
          : "결제 전",
      requestedAtLabel: time ? `${time} ${item.paymentState === "paid" ? "수납" : "청구"}` : undefined,
      statusLabel: getStatusLabel("invoice", item.status as Invoice["status"]),
      subjectLabel: [item.invoiceNo, item.lineSummary].filter(Boolean).join(" · "),
      title: `${item.patientName ?? "환자 미상"}${guardianName ? ` · ${guardianName}` : ""}`,
    };
  });
}

export function getLivePatientProfileSidePanelModel(
  overview: CustomerProfileOverview,
  state: CustomerProfileOverviewState,
  workspaceId: string,
): ProfileSidePanelModel {
  const patient = mapLivePatient(overview.profile, workspaceId);
  const guardianRows = Array.isArray(overview.relationships.guardians)
    ? overview.relationships.guardians as Array<Record<string, unknown>>
    : [];
  const guardians = guardianRows.map((row) => mapLiveGuardian(row, workspaceId));
  const links = guardianRows.map((row) => ({
    id: `${patient.id}:${liveValue(row.id) ?? "guardian"}`,
    patientId: patient.id,
    guardianId: liveValue(row.id) ?? "",
    relationship: liveValue(row.relationship),
    isPrimary: row.isPrimary === true,
    canReceiveMessages: true,
    createdAt: "",
  }));
  const primaryGuardian = guardians.find((guardian) => links.some((link) => link.guardianId === guardian.id && link.isPrimary));
  const reservations = mapLiveReservationItems(
    state.sectionStates.reservations.items,
    false,
  );

  return {
    avatarAlt: `${patient.name} 환자 프로필`,
    avatarSrc: "/avatars/figma-patient-profile.jpg",
    billing: mapLiveBillingItems(state.sectionStates.billing.items, primaryGuardian?.name),
    history: mapLiveHistoryItems(state.sectionStates.history.items, primaryGuardian?.name),
    infoHeading: "환자 정보",
    infoRows: [
      { icon: "pet", label: "환자명", value: patient.name },
      { icon: "paw-print", label: "종류/품종", value: [getProfileSpeciesLabel(patient), patient.breed].filter(Boolean).join("/") },
      { icon: "user", label: "성별", value: getProfileSexLabel(patient) },
      { icon: "clock", label: "나이", value: getPatientDisplayAge(patient) },
      { icon: "calendar", label: "생년월일", value: formatProfileDate(patient.birthDate) },
      { icon: "scan-line", label: "마이크로칩", value: patient.microchipNo ?? "미등록" },
      { icon: "file-user", label: "동물등록번호", value: patient.patientRegistrationNo ?? "미등록" },
      { icon: "notebook-text", label: "환자 메모", value: getProfileMemo(patient) },
    ],
    kind: "patient",
    meta: [getProfileSpeciesLabel(patient), patient.breed ?? "품종 미입력", getPatientDisplayAge(patient), getProfileSexLabel(patient)],
    name: patient.name,
    relatedGroups: [{
      id: "guardians",
      items: guardians.map((guardian) => {
        const link = links.find((item) => item.guardianId === guardian.id);
        return {
          badge: link?.isPrimary ? "주" : "추가",
          badgeTone: link?.isPrimary ? "primary" : "default",
          id: guardian.id,
          imageSrc: "/avatars/figma-guardian-glyph.svg",
          meta: guardian.mobilePhone ?? "연락처 미입력",
          name: guardian.name,
        };
      }),
      title: "등록된 보호자",
    }],
    reservations,
    reservationMonth: getLiveMonthKey(reservations[0]?.scheduledAt) ?? getLiveMonthKey(new Date().toISOString())!,
  };
}

export function getLiveGuardianProfileSidePanelModel(
  overview: CustomerProfileOverview,
  state: CustomerProfileOverviewState,
  workspaceId: string,
): ProfileSidePanelModel {
  const guardian = mapLiveGuardian(overview.profile, workspaceId);
  const patientRows = Array.isArray(overview.relationships.patients)
    ? overview.relationships.patients as Array<Record<string, unknown>>
    : [];
  const patients = patientRows.map((row) => mapLivePatient(row, workspaceId));
  const links = patientRows.map((row) => ({
    id: `${liveValue(row.id) ?? "patient"}:${guardian.id}`,
    patientId: liveValue(row.id) ?? "",
    guardianId: guardian.id,
    relationship: liveValue(row.relationship),
    isPrimary: row.isPrimary === true,
    canReceiveMessages: true,
    createdAt: "",
  }));
  const reservations = mapLiveReservationItems(state.sectionStates.reservations.items, true);
  const toRelatedItem = (patient: Patient) => ({
    id: patient.id,
    imageSrc: "/avatars/figma-patient-glyph.svg",
    meta: [getProfileSpeciesLabel(patient), patient.breed ?? "품종 미입력", getPatientDisplayAge(patient), getProfileSexLabel(patient)].join(" · "),
    name: patient.name,
  });

  return {
    avatarAlt: `${guardian.name} 보호자 프로필`,
    avatarSrc: "/avatars/figma-guardian-profile.png",
    billing: mapLiveBillingItems(state.sectionStates.billing.items, guardian.name),
    history: mapLiveHistoryItems(state.sectionStates.history.items, guardian.name),
    infoHeading: "보호자 정보",
    infoRows: [
      { icon: "user", label: "보호자명", value: guardian.name },
      { icon: "calendar", label: "생년월일", value: formatProfileDate(guardian.birthDate) },
      { icon: "phone", label: "전화번호", value: guardian.mobilePhone ?? guardian.phone ?? "미입력" },
      { icon: "mail", label: "이메일", value: guardian.email ?? "미입력" },
      { icon: "map-pin", label: "주소", value: guardian.address ?? "미입력" },
      { icon: "notebook-text", label: "보호자메모", value: guardian.memo ?? "보호자 메모 미입력" },
    ],
    kind: "guardian",
    meta: [formatProfileDate(guardian.birthDate), guardian.mobilePhone ?? "연락처 미입력"],
    name: guardian.name,
    relatedGroups: [
      { accentPrefix: "주 보호자", id: "primary-patients", items: patients.filter((patient) => links.some((link) => link.patientId === patient.id && link.isPrimary)).map(toRelatedItem), title: "로 등록된 환자" },
      { id: "additional-patients", items: patients.filter((patient) => links.some((link) => link.patientId === patient.id && !link.isPrimary)).map(toRelatedItem), title: "추가 보호자로 등록된 환자" },
    ],
    reservations,
    reservationMonth: getLiveMonthKey(reservations[0]?.scheduledAt) ?? getLiveMonthKey(new Date().toISOString())!,
  };
}

export function getLiveUnavailableProfileSidePanelModel(
  kind: ProfileSidePanelModel["kind"],
): ProfileSidePanelModel {
  const subjectLabel = kind === "patient" ? "환자" : "보호자";

  return {
    avatarAlt: `${subjectLabel} 프로필을 불러오는 중입니다`,
    billing: [],
    history: [],
    infoHeading: `${subjectLabel} 정보`,
    infoRows: [],
    kind,
    meta: [],
    name: `${subjectLabel} 프로필`,
    relatedGroups: [],
    reservations: [],
  };
}

export function getLiveTabAccess(state: CustomerProfileOverviewState): Record<"info" | "history" | "reservations" | "billing", ProfileTabAccess> {
  if (state.access) {
    return {
      info: state.access.information,
      history: state.access.history,
      reservations: state.access.reservations,
      billing: state.access.billing,
    };
  }

  const reason = state.overviewStatus === "loading" || state.overviewStatus === "idle"
    ? "프로필 정보를 불러오는 중입니다."
    : state.overviewStatus === "denied"
      ? "프로필 정보를 볼 권한이 없습니다."
      : state.overviewStatus === "not_found"
        ? "프로필 정보를 찾을 수 없습니다."
        : "프로필 정보를 불러오지 못했습니다.";
  return {
    info: { allowed: true, requiredPermission: "patient:view" },
    history: { allowed: false, disabledReason: reason, requiredPermission: "chart:view" },
    reservations: { allowed: false, disabledReason: reason, requiredPermission: "reception:view" },
    billing: { allowed: false, disabledReason: reason, requiredPermission: "billing:view" },
  };
}

