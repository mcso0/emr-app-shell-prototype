"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { getProfileTodayItems } from "./profile-today";
import { useProfileToday } from "./use-profile-today";
import { useParams } from "next/navigation";
import {
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsNavigationChevronDownIcon,
} from "@/components/cds-icons/navigation";
import { BoneIcon, UserIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  EmrRegistrationAddressControls,
  EmrRegistrationAgeControls,
  EmrRegistrationDialogShell,
  EmrRegistrationFieldRow,
  EmrRegistrationFooter,
  EmrRegistrationInlineControl,
  EmrRegistrationSection,
  EmrRegistrationSignatureConsentCard,
  EmrRegistrationSummaryItem,
  EmrRegistrationCheckboxLabel,
  emrRegistrationControlClassName,
  emrRegistrationDialogOverlayClassName,
  emrRegistrationTextareaClassName,
} from "@/components/emr/registration-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrRequiredIndicator } from "@/components/emr/required-indicator";
import {
  Field as FormField,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useMockAuthStore } from "@/features/auth/session-store";
import {
  getGuardianDisplay,
  getPatientDisplayAge,
  getPatientSexLabel,
  getSpeciesLabel,
} from "@/features/reception/data";
import {
  normalizeGuardianPhone,
  usePatientProfileStore,
} from "@/features/reception/patient-profile-store";
import type {
  ReceptionPatientGuardianRegistrationInput,
  ReceptionPatientGuardianRegistrationResponse,
} from "@/features/reception/patient-guardian-registration";
import type {
  ReceptionPatientGuardianLookupItem,
  ReceptionPatientGuardianLookupResponse,
} from "@/features/reception/patient-guardian-lookup";
import { useKakaoAddressSearch } from "@/features/reception/use-kakao-address-search";
import type {
  CustomerGuardianProfileUpdateInput,
  CustomerGuardianProfileUpdateResult,
} from "@/features/customer/server-guardian-profile";
import type {
  CustomerPatientProfileUpdateInput,
  CustomerPatientProfileUpdateResult,
} from "@/features/customer/server-patient-profile";
import type { KakaoPostcodeSelectedAddress } from "@/lib/kakao-postcode";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import {
  addMonthsToIsoDate,
  getWorkspaceOperatingDate,
  isIsoOperatingDate,
  parseIsoDateParts,
} from "@/lib/emr-domain/demo-date";
import { cn } from "@/lib/utils";
import {
  getMockGuardianBundle,
  getMockPatientBundle,
  mockStaffUsers,
} from "@/mocks/emr-domain";
import { resolveWorkspaceRouteParam } from "@/lib/emr-domain/demo-workspaces";
import { isPreparedEmptyClinicWorkspace } from "@/lib/emr-domain/demo-workspaces";
import {
  useCustomerProfileOverview,
  type CustomerProfileOverviewState,
} from "@/features/customer/use-customer-profile-overview";
import type {
  CustomerProfileBillingProjection,
  CustomerProfileHistoryProjection,
  CustomerProfileOverview,
  CustomerProfileReservationProjection,
} from "@/features/customer/server-profile-overview-core";
import { useLayoutStore } from "@/stores/layout-store";
import type {
  Consent,
  EmrId,
  Encounter,
  Guardian,
  Appointment,
  Invoice,
  InvoiceLine,
  Payment,
  Patient,
  PatientGuardian,
  PatientSex,
  Species,
} from "@/types/emr-domain";
import {
  ProfileSidePanel,
  type ProfileBillingItem,
  type ProfileHistoryItem,
  type ProfileReservationItem,
  type ProfileSidePanelModel,
  type ProfileSidePanelTab,
  type ProfileTabAccess,
} from "@/features/reception/profile-side-panel";

type PatientProfileBundle = {
  activeEncounter?: Encounter;
  appointments: Appointment[];
  encounters: Encounter[];
  invoiceLines: InvoiceLine[];
  invoices: Invoice[];
  payments: Payment[];
  patient: Patient;
  guardians: Guardian[];
  patientGuardians: PatientGuardian[];
  primaryGuardian?: Guardian;
};

type GuardianProfileBundle = {
  appointments: Appointment[];
  consents: Consent[];
  encounters: Encounter[];
  guardian: Guardian;
  invoiceLines: InvoiceLine[];
  invoices: Invoice[];
  payments: Payment[];
  patients: Patient[];
  patientGuardians: PatientGuardian[];
};

const getStaffDisplayName = (userId?: EmrId) =>
  userId ? mockStaffUsers.find((user) => user.id === userId)?.name : undefined;

const newPatientSpeciesOptions: Array<{ label: string; value: Species }> = [
  { label: "강아지", value: "dog" },
  { label: "고양이", value: "cat" },
  { label: "토끼", value: "rabbit" },
  { label: "페럿", value: "ferret" },
  { label: "햄스터", value: "hamster" },
  { label: "기니피그", value: "guinea_pig" },
  { label: "고슴도치", value: "hedgehog" },
  { label: "조류", value: "bird" },
  { label: "파충류", value: "reptile" },
  { label: "거북이", value: "turtle" },
  { label: "기타", value: "other" },
];

type NewPatientSexValue = PatientSex | "neutered_male" | "neutered_female";

const newPatientSexOptions: Array<{ label: string; value: NewPatientSexValue }> = [
  { label: "미상", value: "unknown" },
  { label: "수컷", value: "male" },
  { label: "암컷", value: "female" },
  { label: "중성화 수컷", value: "neutered_male" },
  { label: "중성화 암컷", value: "neutered_female" },
];

const breedOptionsBySpecies: Record<Species, string[]> = {
  dog: [
    "골든 리트리버",
    "닥스훈트",
    "말티즈",
    "비숑 프리제",
    "시바견",
    "시츄",
    "요크셔테리어",
    "웰시코기",
    "치와와",
    "포메라니안",
    "푸들",
  ],
  cat: [
    "노르웨이숲",
    "러시안블루",
    "먼치킨",
    "메인쿤",
    "브리티시숏헤어",
    "스코티시폴드",
    "아메리칸숏헤어",
    "코리안숏헤어",
    "페르시안",
  ],
  rabbit: ["드워프", "라이언헤드", "롭이어", "렉스", "앙고라", "토끼"],
  ferret: ["세이블", "알비노", "시나몬", "페럿"],
  hamster: ["골든햄스터", "드워프햄스터", "로보로브스키", "정글리안"],
  guinea_pig: ["기니피그", "아비시니안", "아메리칸", "페루비안"],
  hedgehog: ["고슴도치", "피그미 고슴도치"],
  bird: ["문조", "사랑앵무", "앵무새", "카나리아", "코뉴어"],
  reptile: ["게코", "도마뱀", "뱀", "이구아나", "카멜레온"],
  turtle: ["거북이", "반수생 거북", "육지거북"],
  other: [
    "기타",
    "토끼",
    "햄스터",
  ],
};

const getBreedOptions = (species: Species) =>
  [...breedOptionsBySpecies[species]].sort((a, b) => a.localeCompare(b, ["ko", "en"]));

const splitBreedList = (value: string) =>
  value
    .split(" · ")
    .map((item) => item.trim())
    .filter(Boolean);

const joinBreedList = (breeds: string[]) => breeds.join(" · ");

const getNewPatientSpeciesLabel = (species: Species) =>
  newPatientSpeciesOptions.find((option) => option.value === species)?.label ?? "종류 선택";

const getNewPatientSexLabel = (sex: NewPatientSexValue) =>
  newPatientSexOptions.find((option) => option.value === sex)?.label ?? "성별 선택";

const getNewPatientSexPayload = (sex: NewPatientSexValue): { neutered: boolean; sex: PatientSex } => {
  if (sex === "neutered_male") return { neutered: true, sex: "male" };
  if (sex === "neutered_female") return { neutered: true, sex: "female" };

  return { neutered: false, sex };
};

const getGuardianPatientCount = (guardianId: EmrId, links: PatientGuardian[]) =>
  links.filter((link) => link.guardianId === guardianId).length;

const getGuardianPatientNames = (
  guardianId: EmrId,
  patients: Patient[],
  links: PatientGuardian[]
) => {
  const patientIds = new Set(
    links.filter((link) => link.guardianId === guardianId).map((link) => link.patientId)
  );

  return patients.filter((patient) => patientIds.has(patient.id)).map((patient) => patient.name);
};

const getGuardianPatientSummary = (
  guardianId: EmrId,
  patients: Patient[],
  links: PatientGuardian[]
) => {
  const names = getGuardianPatientNames(guardianId, patients, links);

  if (!names.length) return "연결 환자 없음";
  if (names.length <= 2) return names.join(", ");

  return `${names.slice(0, 2).join(", ")} 외 ${names.length - 2}`;
};

const getGuardianSearchDisplay = (
  guardian: Guardian,
  patients: Patient[],
  links: PatientGuardian[]
) =>
  [
    guardian.name,
    `${guardian.mobilePhone ?? "연락처 미입력"} · ${getGuardianPatientSummary(guardian.id, patients, links)}`,
  ].join(" ");

const getMixBreedSuggestion = (species: Species) => {
  if (species === "dog") return "믹스견";
  if (species === "cat") return "믹스묘";

  return "";
};

const formatKoreanPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;

    return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  const middleEnd = digits.length === 10 ? 6 : 7;

  return `${digits.slice(0, 3)}-${digits.slice(3, middleEnd)}-${digits.slice(middleEnd)}`;
};

const formatKoreanAddress = ({
  detail,
  postalCode,
  road,
}: {
  detail: string;
  postalCode: string;
  road: string;
}) =>
  [
    postalCode ? `(${postalCode})` : "",
    road.trim(),
    detail.trim(),
  ]
    .filter(Boolean)
    .join(" ");

const getBirthDateFromAge = ({
  months,
  referenceDate,
  years,
}: {
  months: string;
  referenceDate: string;
  years: string;
}) => {
  const yearCount = Number(years || 0);
  const monthCount = Number(months || 0);

  if (!yearCount && !monthCount) return "";
  if (Number.isNaN(yearCount) || Number.isNaN(monthCount)) return "";

  return addMonthsToIsoDate(referenceDate, -(yearCount * 12 + monthCount));
};

const formatBirthDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
};

const formatAgeNumberInput = (value: string) => value.replace(/\D/g, "").slice(0, 3);

function AgePartInput({
  ariaDescribedBy,
  ariaInvalid,
  ariaLabel,
  className,
  id,
  inputClassName,
  onValueChange,
  unit,
  value,
}: {
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  ariaLabel: string;
  className?: string;
  id?: string;
  inputClassName?: string;
  onValueChange: (value: string) => void;
  unit: "년" | "개월";
  value: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Input
        id={id}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        aria-label={ariaLabel}
        className={cn("h-10 bg-card pr-10 text-right", inputClassName)}
        inputMode="numeric"
        placeholder="0"
        value={value}
        onValueChange={(nextValue) => onValueChange(formatAgeNumberInput(nextValue))}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 emr-text-dense font-medium text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}

const getAgeTextFromBirthDate = (birthDateValue: string, referenceDate: string) => {
  if (!isIsoOperatingDate(birthDateValue) || birthDateValue > referenceDate) return "";

  const birthDate = parseIsoDateParts(birthDateValue);
  const currentDate = parseIsoDateParts(referenceDate);
  let totalMonths =
    (currentDate.year - birthDate.year) * 12 + currentDate.month - birthDate.month;

  if (currentDate.day < birthDate.day) totalMonths -= 1;
  if (totalMonths < 0) return "";

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  return [years ? `${years}년` : "", months ? `${months}개월` : ""]
    .filter(Boolean)
    .join(" ") || "0개월";
};

const isValidRegistrationBirthDate = (value: string, referenceDate: string) =>
  isIsoOperatingDate(value) && value <= referenceDate;

type NewPatientDraft = {
  additionalBreed: string;
  ageDays: string;
  ageMonths: string;
  ageYears: string;
  birthDate: string;
  breed: string;
  color: string;
  estimatedAge: boolean;
  existingGuardianId: string;
  guardianMobilePhone: string;
  guardianName: string;
  isMixed: boolean;
  microchipNo: string;
  microchipStatus: string;
  name: string;
  patientRegistrationNo: string;
  primaryVeterinarianId: string;
  sex: NewPatientSexValue;
  species: Species;
  specialNote: string;
  weight: string;
};

const createNewPatientDraft = ({
  guardianId = "",
  guardianMobilePhone = "",
  guardianName = "",
}: {
  guardianId?: string;
  guardianMobilePhone?: string;
  guardianName?: string;
} = {}): NewPatientDraft => ({
  additionalBreed: "",
  ageDays: "",
  ageMonths: "",
  ageYears: "",
  birthDate: "",
  breed: "",
  color: "",
  estimatedAge: false,
  existingGuardianId: guardianId,
  guardianMobilePhone,
  guardianName,
  isMixed: false,
  microchipNo: "",
  microchipStatus: "미선택",
  name: "",
  patientRegistrationNo: "",
  primaryVeterinarianId: "",
  sex: "unknown",
  species: "dog",
  specialNote: "",
  weight: "",
});

const getProfileBundle = (
  patientId: EmrId,
  patients: Patient[],
  guardians: Guardian[],
  patientGuardians: PatientGuardian[],
  allowLegacyMockBundle = true,
): PatientProfileBundle | null => {
  const patient = patients.find((item) => item.id === patientId);

  if (!patient) return null;

  const baseBundle = allowLegacyMockBundle ? getMockPatientBundle(patientId) : undefined;
  const links = patientGuardians.filter((link) => link.patientId === patientId);
  const guardianIds = new Set(links.map((link) => link.guardianId));
  const linkedGuardians = guardians.filter((guardian) => guardianIds.has(guardian.id));
  const primaryGuardian = linkedGuardians.find((guardian) =>
    links.some((link) => link.guardianId === guardian.id && link.isPrimary)
  );
  const activeEncounter =
    baseBundle?.encounters.find((encounter) =>
      ["waiting", "in_consultation", "ordered", "ready_for_billing"].includes(encounter.status)
    ) ?? baseBundle?.encounters[0];
  return {
    activeEncounter,
    appointments: baseBundle?.appointments ?? [],
    encounters: baseBundle?.encounters ?? [],
    invoiceLines: baseBundle?.invoiceLines ?? [],
    invoices: baseBundle?.invoices ?? [],
    payments: baseBundle?.payments ?? [],
    patient,
    guardians: linkedGuardians,
    patientGuardians: links,
    primaryGuardian,
  };
};

const getGuardianProfileBundle = (
  guardianId: EmrId,
  patients: Patient[],
  guardians: Guardian[],
  patientGuardians: PatientGuardian[],
  consents: Consent[],
  allowLegacyMockBundle = true,
): GuardianProfileBundle | null => {
  const guardian = guardians.find((item) => item.id === guardianId);

  if (!guardian) return null;

  const baseBundle = allowLegacyMockBundle ? getMockGuardianBundle(guardianId) : undefined;
  const links = patientGuardians.filter((link) => link.guardianId === guardianId);
  const patientIds = new Set(links.map((link) => link.patientId));
  const linkedPatients = patients.filter((patient) => patientIds.has(patient.id));

  return {
    appointments: baseBundle?.appointments ?? [],
    consents: consents.filter((consent) => consent.guardianId === guardianId),
    encounters: baseBundle?.encounters ?? [],
    guardian,
    invoiceLines: baseBundle?.invoiceLines ?? [],
    invoices: baseBundle?.invoices ?? [],
    payments: baseBundle?.payments ?? [],
    patients: linkedPatients,
    patientGuardians: links,
  };
};

const formatProfileDate = (value?: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "미입력";

  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  })
    .format(new Date(value))
    .replace(/\. /g, ".")
    .replace(/\.$/, "");
};

const formatProfileSchedule = (value?: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "일정 미정";

  const parts = new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    month: "long",
    timeZone: "Asia/Seoul",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const dayPeriod = part("dayPeriod");
  const rawHour = Number(part("hour"));
  const hour = dayPeriod === "오후" && rawHour !== 12 ? rawHour + 12 : rawHour === 12 && dayPeriod === "오전" ? 0 : rawHour;

  return `${part("month")} ${part("day")}일 ${hour}시 ${part("minute")}분`;
};

const formatProfileTime = (value?: string) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return undefined;

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
};

const getProfileSpeciesLabel = (patient: Patient) =>
  patient.species === "dog" ? "개" : patient.species === "cat" ? "고양이" : getSpeciesLabel(patient);

const getProfileSexLabel = (patient: Patient) =>
  getPatientSexLabel(patient).replace("중성화·", "중성화 ");

const getProfileMemo = (patient: Patient) =>
  patient.specialNote ?? patient.allergyNote ?? patient.handlingCautionNote ?? "환자 메모 미입력";

const getAppointmentReservationItem = ({
  appointment,
  patient,
  showPatientName,
}: {
  appointment: Appointment;
  patient?: Patient;
  showPatientName: boolean;
}): ProfileReservationItem => ({
  description: appointment.symptomNote ?? appointment.visitPurpose ?? "예약 메모가 없습니다.",
  id: appointment.id,
  patientId: appointment.patientId,
  patientName: patient?.name,
  scheduledAt: appointment.scheduledStartAt,
  title: [
    showPatientName ? patient?.name ?? "환자 미상" : undefined,
    formatProfileSchedule(appointment.scheduledStartAt),
    getStatusLabel("appointment", appointment.status),
  ]
    .filter(Boolean)
    .join(" · "),
});

const getHistoryItems = ({
  encounters,
  guardian,
  patientById,
}: {
  encounters: Encounter[];
  guardian?: Guardian;
  patientById: Map<EmrId, Patient>;
}): ProfileHistoryItem[] =>
  encounters.map((encounter) => {
    const patient = patientById.get(encounter.patientId);
    const time = formatProfileTime(encounter.checkedInAt ?? encounter.createdAt);

    return {
      clinicianLabel: getStaffDisplayName(encounter.primaryVeterinarianId) ?? "담당의 미지정",
      dateAt: encounter.checkedInAt ?? encounter.createdAt,
      id: encounter.id,
      kindLabel: "외래",
      patientId: encounter.patientId,
      patientName: patient?.name,
      requestedAtLabel: time ? `${time} 접수` : undefined,
      statusLabel: getStatusLabel("encounter", encounter.status),
      subjectLabel: encounter.visitPurpose ?? encounter.chiefComplaint ?? "방문 목적 미입력",
      title: `${patient?.name ?? "환자 미상"} · ${guardian?.name ?? "보호자 미상"}`,
    };
  });

const getPaymentMethodLabel = (method?: Payment["paymentMethod"]) => {
  if (method === "card") return "카드";
  if (method === "cash") return "현금";
  if (method === "transfer") return "계좌이체";
  if (method === "other") return "기타";
  return "결제 전";
};

const getBillingItems = ({
  encounters,
  guardian,
  invoiceLines,
  invoices,
  patientById,
  payments,
}: {
  encounters: Encounter[];
  guardian?: Guardian;
  invoiceLines: InvoiceLine[];
  invoices: Invoice[];
  patientById: Map<EmrId, Patient>;
  payments: Payment[];
}): ProfileBillingItem[] => {
  const encounterById = new Map(encounters.map((encounter) => [encounter.id, encounter]));

  return invoices.map((invoice) => {
    const encounter = encounterById.get(invoice.encounterId);
    const patient = encounter ? patientById.get(encounter.patientId) : undefined;
    const lines = invoiceLines.filter((line) => line.invoiceId === invoice.id);
    const invoicePayments = payments.filter((payment) => payment.invoiceId === invoice.id);
    const approvedAmount = invoicePayments
      .filter((payment) => payment.status === "approved")
      .reduce((total, payment) => total + payment.amount, 0);
    const payment = invoicePayments.at(-1);
    const dateAt = invoice.paidAt ?? invoice.issuedAt ?? invoice.createdAt;
    const time = formatProfileTime(dateAt);

    return {
      amountLabel: `${invoice.totalAmount.toLocaleString("ko-KR")}원`,
      clinicianLabel: encounter
        ? getStaffDisplayName(encounter.primaryVeterinarianId) ?? "담당의 미지정"
        : "담당의 미지정",
      dateAt,
      id: invoice.id,
      kindLabel: "외래",
      patientId: encounter?.patientId,
      patientName: patient?.name,
      paymentLabel: approvedAmount
        ? `${getPaymentMethodLabel(payment?.paymentMethod)} ${approvedAmount.toLocaleString("ko-KR")}원 승인`
        : invoice.status === "refunded"
          ? "환불 처리"
          : "결제 전",
      requestedAtLabel: time ? `${time} ${invoice.paidAt ? "수납" : "청구"}` : undefined,
      statusLabel: getStatusLabel("invoice", invoice.status),
      subjectLabel: [invoice.invoiceNo, lines[0]?.description ?? encounter?.visitPurpose]
        .filter(Boolean)
        .join(" · "),
      title: `${patient?.name ?? "환자 미상"} · ${guardian?.name ?? "보호자 미상"}`,
    };
  });
};

const getPatientProfileSidePanelModel = (bundle: PatientProfileBundle): ProfileSidePanelModel => {
  const patientById = new Map([[bundle.patient.id, bundle.patient]]);
  const reservations = bundle.appointments.map((appointment) =>
    getAppointmentReservationItem({ appointment, patient: bundle.patient, showPatientName: false })
  );
  const todayItems = getProfileTodayItems({ appointments: bundle.appointments, encounters: bundle.encounters, patientNames: new Map([[bundle.patient.id, bundle.patient.name]]), workspaceId: bundle.patient.workspaceId, date: getWorkspaceOperatingDate(bundle.patient.workspaceId) });

  return {
    avatarAlt: `${bundle.patient.name} 환자 프로필`,
    avatarSrc: "/avatars/figma-patient-profile.jpg",
    billing: getBillingItems({
      encounters: bundle.encounters,
      guardian: bundle.primaryGuardian,
      invoiceLines: bundle.invoiceLines,
      invoices: bundle.invoices,
      patientById,
      payments: bundle.payments,
    }),
    history: getHistoryItems({
      encounters: bundle.encounters,
      guardian: bundle.primaryGuardian,
      patientById,
    }),
    infoHeading: "환자 정보",
    infoRows: [
      { icon: "pet", label: "환자명", value: bundle.patient.name },
      {
        icon: "paw-print",
        label: "종류/품종",
        value: [getProfileSpeciesLabel(bundle.patient), bundle.patient.breed].filter(Boolean).join("/"),
      },
      { icon: "user", label: "성별", value: getProfileSexLabel(bundle.patient) },
      { icon: "clock", label: "나이", value: getPatientDisplayAge(bundle.patient) },
      { icon: "calendar", label: "생년월일", value: formatProfileDate(bundle.patient.birthDate) },
      { icon: "scan-line", label: "마이크로칩", value: bundle.patient.microchipNo ?? "미등록" },
      {
        icon: "file-user",
        label: "동물등록번호",
        value: bundle.patient.patientRegistrationNo ?? "미등록",
      },
      { icon: "notebook-text", label: "환자 메모", value: getProfileMemo(bundle.patient) },
    ],
    kind: "patient",
    meta: [
      getProfileSpeciesLabel(bundle.patient),
      bundle.patient.breed ?? "품종 미입력",
      getPatientDisplayAge(bundle.patient),
      getProfileSexLabel(bundle.patient),
    ],
    name: bundle.patient.name,
    relatedGroups: [
      {
        id: "guardians",
        items: bundle.guardians.map((guardian) => {
          const link = bundle.patientGuardians.find((item) => item.guardianId === guardian.id);

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
      },
    ],
    reservations,
    todayItems,
    upcoming: reservations[0],
  };
};

const getGuardianProfileSidePanelModel = (bundle: GuardianProfileBundle): ProfileSidePanelModel => {
  const patientById = new Map(bundle.patients.map((patient) => [patient.id, patient]));
  const reservations = bundle.appointments.map((appointment) =>
    getAppointmentReservationItem({
      appointment,
      patient: patientById.get(appointment.patientId),
      showPatientName: true,
    })
  );
  const todayItems = getProfileTodayItems({ appointments: bundle.appointments, encounters: bundle.encounters, patientNames: new Map(bundle.patients.map((patient) => [patient.id, patient.name])), workspaceId: bundle.guardian.workspaceId, date: getWorkspaceOperatingDate(bundle.guardian.workspaceId) });
  const primaryItems = bundle.patients.filter((patient) =>
    bundle.patientGuardians.some((link) => link.patientId === patient.id && link.isPrimary)
  );
  const additionalItems = bundle.patients.filter((patient) =>
    bundle.patientGuardians.some((link) => link.patientId === patient.id && !link.isPrimary)
  );
  const toRelatedItem = (patient: Patient) => ({
    id: patient.id,
    imageSrc: "/avatars/figma-patient-glyph.svg",
    meta: [
      getProfileSpeciesLabel(patient),
      patient.breed ?? "품종 미입력",
      getPatientDisplayAge(patient),
      getProfileSexLabel(patient),
    ].join(" · "),
    name: patient.name,
  });

  return {
    avatarAlt: `${bundle.guardian.name} 보호자 프로필`,
    avatarSrc: "/avatars/figma-guardian-profile.png",
    billing: getBillingItems({
      encounters: bundle.encounters,
      guardian: bundle.guardian,
      invoiceLines: bundle.invoiceLines,
      invoices: bundle.invoices,
      patientById,
      payments: bundle.payments,
    }),
    history: getHistoryItems({
      encounters: bundle.encounters,
      guardian: bundle.guardian,
      patientById,
    }),
    infoHeading: "보호자 정보",
    infoRows: [
      { icon: "user", label: "보호자명", value: bundle.guardian.name },
      { icon: "calendar", label: "생년월일", value: formatProfileDate(bundle.guardian.birthDate) },
      {
        icon: "phone",
        label: "전화번호",
        value: bundle.guardian.mobilePhone ?? bundle.guardian.phone ?? "미입력",
      },
      { icon: "mail", label: "이메일", value: bundle.guardian.email ?? "미입력" },
      { icon: "map-pin", label: "주소", value: bundle.guardian.address ?? "미입력" },
      {
        icon: "notebook-text",
        label: "보호자메모",
        value: bundle.guardian.memo ?? "보호자 메모 미입력",
      },
    ],
    kind: "guardian",
    meta: [formatProfileDate(bundle.guardian.birthDate), bundle.guardian.mobilePhone ?? "연락처 미입력"],
    name: bundle.guardian.name,
    relatedGroups: [
      {
        accentPrefix: "주 보호자",
        id: "primary-patients",
        items: primaryItems.map(toRelatedItem),
        title: "로 등록된 환자",
      },
      {
        id: "additional-patients",
        items: additionalItems.map(toRelatedItem),
        title: "추가 보호자로 등록된 환자",
      },
    ],
    reservations,
    todayItems,
    upcoming: reservations[0],
  };
};

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

function mapLivePatient(profile: Record<string, unknown>, workspaceId: string): Patient {
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

function mapLiveGuardian(profile: Record<string, unknown>, workspaceId: string): Guardian {
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

function getLivePatientProfileSidePanelModel(
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

function getLiveGuardianProfileSidePanelModel(
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

function getLiveUnavailableProfileSidePanelModel(
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

function getLiveTabAccess(state: CustomerProfileOverviewState): Record<"info" | "history" | "reservations" | "billing", ProfileTabAccess> {
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

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1 emr-text-metadata font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

export function RegistrationFormField({
  actions,
  children,
  className,
  error,
  helper,
  label,
  required,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  error?: string;
  helper?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <FormField className={className} data-invalid={Boolean(error) || undefined}>
      <div className="flex min-h-5 items-center justify-between gap-3">
        <FieldLabel className="emr-text-body font-bold leading-5 text-foreground">
          <span className="inline-flex items-baseline gap-0.5">
            <span>{label}</span>
            {required ? (
              <EmrRequiredIndicator />
            ) : null}
          </span>
        </FieldLabel>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
      {children}
      {error ? <FieldError className="emr-text-metadata leading-4">{error}</FieldError> : null}
      {helper ? (
        <FieldDescription className="emr-text-metadata font-medium leading-4">
          {helper}
        </FieldDescription>
      ) : null}
    </FormField>
  );
}

export function RegistrationDialogCloseButton({
  ariaLabel,
  onClick,
}: {
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="size-8 shrink-0 rounded-md text-[var(--emr-text-secondary)] hover:bg-[var(--emr-state-hover)]"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <CdsActionsXIcon className="size-4" />
    </Button>
  );
}

export function RegistrationFormSection({
  children,
  className,
  separated = true,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  separated?: boolean;
  title: string;
}) {
  return (
    <>
      {separated ? <div className="h-px w-full shrink-0 bg-border" /> : null}
      <FieldSet className={cn("gap-0", className)}>
        <FieldLegend className="mb-3 emr-text-dense font-bold leading-5 text-[var(--emr-text-tertiary)]">
          {title}
        </FieldLegend>
        <FieldGroup className="gap-6">{children}</FieldGroup>
      </FieldSet>
    </>
  );
}

function KoreanAddressFields({
  detail,
  onSearchAddress,
  postalCode,
  road,
  searchError,
  searchLoading,
  onDetailChange,
  onPostalCodeChange,
  onRoadChange,
}: {
  detail: string;
  onSearchAddress?: () => void;
  postalCode: string;
  road: string;
  searchError?: string;
  searchLoading?: boolean;
  onDetailChange: (value: string) => void;
  onPostalCodeChange: (value: string) => void;
  onRoadChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Input
          aria-label="우편번호"
          className="h-10 w-[148px] bg-card"
          inputMode="numeric"
          placeholder="우편번호"
          value={postalCode}
          onValueChange={(value) => onPostalCodeChange(value.replace(/\D/g, "").slice(0, 5))}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 px-2.5 emr-text-metadata font-semibold"
          disabled={searchLoading}
          onClick={onSearchAddress}
        >
          {searchLoading ? "검색 중" : "주소 검색"}
        </Button>
      </div>
      <Input
        aria-label="기본 주소"
        className="h-10 bg-card"
        placeholder="도로명 또는 지번 주소를 입력해주세요"
        value={road}
        onValueChange={onRoadChange}
      />
      <Input
        aria-label="상세 주소"
        className="h-10 bg-card"
        placeholder="상세주소를 입력해주세요"
        value={detail}
        onValueChange={onDetailChange}
      />
      {searchError ? (
        <div className="emr-text-metadata leading-4 text-[var(--emr-status-danger-text)]">
          {searchError}
        </div>
      ) : null}
    </div>
  );
}


function BreedAutocomplete({
  ariaDescribedBy,
  ariaInvalid,
  ariaLabel = "품종",
  className,
  id,
  placeholder,
  readOnly,
  species,
  value,
  onValueChange,
}: {
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  ariaLabel?: string;
  className?: string;
  id?: string;
  placeholder: string;
  readOnly?: boolean;
  species: Species;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => {
    const query = value.trim().toLowerCase();
    const breeds = getBreedOptions(species);

    if (!query) return breeds;

    return breeds.filter((breed) => breed.toLowerCase().includes(query));
  }, [species, value]);

  if (readOnly) {
    return (
      <Input
        id={id}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        aria-label={ariaLabel}
        value={value}
        readOnly
        className={className}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={<div className="relative" />}
      >
        <CdsActionsSearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--emr-text-tertiary)]"
        />
        <Input
          id={id}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid || undefined}
          aria-label={ariaLabel}
          autoComplete="off"
          className={cn(className, "pl-9")}
          placeholder={placeholder}
          value={value}
          onFocus={() => setOpen(true)}
          onValueChange={(breed) => {
            onValueChange(breed);
            setOpen(true);
          }}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-56 w-[var(--anchor-width)] gap-1 overflow-y-auto p-1.5"
        initialFocus={false}
      >
        <div role="listbox" aria-label={`${ariaLabel} 추천`} className="grid gap-1">
          {options.length ? (
            options.map((breed) => (
              <button
                key={breed}
                type="button"
                role="option"
                aria-selected={value === breed}
                className={cn(
                  "rounded-md px-2.5 py-2 text-left emr-text-dense font-medium text-[var(--emr-text-secondary)] transition-colors hover:bg-[var(--emr-state-hover)]",
                  value === breed && "bg-[var(--emr-state-selected)] text-[var(--emr-status-info-text)]"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onValueChange(breed);
                  setOpen(false);
                }}
              >
                {breed}
              </button>
            ))
          ) : (
            <div className="px-2.5 py-2 emr-text-metadata text-muted-foreground">
              직접 입력한 품종으로 저장합니다.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GuardianSearchPopover({
  error,
  guardians,
  patientGuardians,
  phoneValue,
  selectedGuardianId,
  value,
  onSearchChange,
  onSelect,
}: {
  error?: string;
  guardians: Guardian[];
  patientGuardians: PatientGuardian[];
  phoneValue: string;
  selectedGuardianId?: EmrId;
  value: string;
  onSearchChange: (value: string) => void;
  onSelect: (guardian: Guardian) => void;
}) {
  const [open, setOpen] = useState(false);
  const guardianMatches = useMemo(() => {
    const query = value.trim();
    const normalizedPhone = normalizeGuardianPhone(phoneValue);

    if (!query && !normalizedPhone) return guardians;

    return guardians.filter((guardian) => {
      const guardianPhone = normalizeGuardianPhone(guardian.mobilePhone);

      return (
        (query && guardian.name.includes(query)) ||
        (normalizedPhone && guardianPhone.includes(normalizedPhone))
      );
    });
  }, [guardians, phoneValue, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={<div className="relative" />}
      >
        <CdsActionsSearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--emr-text-tertiary)]"
        />
        <Input
          aria-label="보호자명"
          aria-invalid={Boolean(error) || undefined}
          autoComplete="off"
          className="h-10 bg-card pl-9"
          placeholder="보호자를 검색해주세요"
          value={value}
          onFocus={() => setOpen(true)}
          onValueChange={(guardianName) => {
            onSearchChange(guardianName);
            setOpen(true);
          }}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-72 w-[var(--anchor-width)] gap-1 overflow-y-auto p-1.5"
        initialFocus={false}
      >
        <div role="listbox" aria-label="등록된 보호자 목록" className="grid gap-1">
          {guardianMatches.length ? (
            guardianMatches.map((guardian) => (
              <button
                key={guardian.id}
                type="button"
                role="option"
                aria-selected={selectedGuardianId === guardian.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[var(--emr-state-hover)]",
                  selectedGuardianId === guardian.id &&
                    "bg-[var(--emr-state-selected)] text-[var(--emr-status-info-text)]"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(guardian);
                  setOpen(false);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate emr-text-dense font-semibold">{guardian.name}</span>
                  <span className="mt-0.5 block truncate emr-text-metadata text-muted-foreground">
                    {guardian.mobilePhone ?? "연락처 미입력"} · 연결 환자{" "}
                    {getGuardianPatientCount(guardian.id, patientGuardians)}마리
                  </span>
                </span>
                <Badge variant={selectedGuardianId === guardian.id ? "default" : "outline"}>
                  {selectedGuardianId === guardian.id ? "선택됨" : "기존 보호자"}
                </Badge>
              </button>
            ))
          ) : (
            <div className="px-2.5 py-2 emr-text-metadata text-muted-foreground">
              일치하는 보호자가 없습니다. 새 보호자로 등록합니다.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BreedMultiSelect({
  ariaLabel = "추가 품종",
  className,
  placeholder,
  species,
  value,
  onValueChange,
}: {
  ariaLabel?: string;
  className?: string;
  placeholder: string;
  species: Species;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedBreeds = splitBreedList(value);
  const options = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return getBreedOptions(species).filter(
      (breed) =>
        !selectedBreeds.includes(breed) &&
        (!normalizedQuery || breed.toLowerCase().includes(normalizedQuery))
    );
  }, [query, selectedBreeds, species]);
  const addBreed = (breed: string) => {
    const nextBreed = breed.trim();

    if (!nextBreed) return;
    if (!selectedBreeds.includes(nextBreed)) {
      onValueChange(joinBreedList([...selectedBreeds, nextBreed]));
    }
    setQuery("");
    setOpen(false);
  };
  const removeBreed = (breed: string) => {
    onValueChange(joinBreedList(selectedBreeds.filter((item) => item !== breed)));
  };

  return (
    <div className={cn("rounded-md border bg-card p-1.5", className)}>
      <div className="flex min-h-7 flex-wrap items-center gap-1.5">
        {selectedBreeds.map((breed) => (
          <span
            key={breed}
            className="inline-flex h-7 items-center gap-1 rounded-full border bg-[var(--emr-surface-muted)] px-2 emr-text-metadata font-semibold text-[var(--emr-text-secondary)]"
          >
            {breed}
            <button
              type="button"
              className="emr-text-dense leading-none text-[var(--emr-text-tertiary)] hover:text-foreground"
              aria-label={`${breed} 제거`}
              onClick={() => removeBreed(breed)}
            >
              ×
            </button>
          </span>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            nativeButton={false}
            render={<div className="relative min-w-[160px] flex-1" />}
          >
            <CdsActionsSearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[var(--emr-text-tertiary)]"
            />
            <Input
              aria-label={ariaLabel}
              autoComplete="off"
              className="h-7 border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0"
              placeholder={selectedBreeds.length ? "품종 추가" : placeholder}
              value={query}
              onFocus={() => setOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addBreed(query);
                }
              }}
              onValueChange={(nextQuery) => {
                setQuery(nextQuery);
                setOpen(true);
              }}
            />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="max-h-56 w-[var(--anchor-width)] gap-1 overflow-y-auto p-1.5"
            initialFocus={false}
          >
            <div role="listbox" aria-label="품종 추천 목록" className="grid gap-1">
              {options.length ? (
                options.map((breed) => (
                  <button
                    key={breed}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="rounded-md px-2.5 py-2 text-left emr-text-dense font-medium text-[var(--emr-text-secondary)] transition-colors hover:bg-[var(--emr-state-hover)]"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addBreed(breed)}
                  >
                    {breed}
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  className="rounded-md px-2.5 py-2 text-left emr-text-metadata text-muted-foreground hover:bg-[var(--emr-state-hover)]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addBreed(query)}
                >
                  직접 입력한 품종 추가
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function PatientSummaryFields({
  draft,
  editing,
  patient,
  primaryGuardian,
  onDraftChange,
}: {
  draft: Pick<Patient, "allergyNote" | "breed" | "handlingCautionNote" | "microchipNo" | "name" | "specialNote">;
  editing: boolean;
  patient: Patient;
  primaryGuardian?: Guardian;
  onDraftChange: (patch: Partial<typeof draft>) => void;
}) {
  return (
    <section className="grid grid-cols-2 gap-3">
      <Field label="환자명">
        <Input
          value={draft.name ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
          onValueChange={(name) => onDraftChange({ name })}
        />
      </Field>
      <Field label="환자번호">
        <Input value={patient.patientNo} readOnly className="h-9 bg-card" />
      </Field>
      <Field label="종">
        <Input value={getSpeciesLabel(patient)} readOnly className="h-9 bg-card" />
      </Field>
      <Field label="품종">
        <BreedAutocomplete
          value={draft.breed ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
          placeholder="품종을 입력하거나 선택"
          species={patient.species}
          onValueChange={(breed) => onDraftChange({ breed })}
        />
      </Field>
      <Field label="나이">
        <Input value={getPatientDisplayAge(patient)} readOnly className="h-9 bg-card" />
      </Field>
      <Field label="성별">
        <Input value={getPatientSexLabel(patient)} readOnly className="h-9 bg-card" />
      </Field>
      <Field label="마이크로칩">
        <Input
          value={draft.microchipNo ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
          onValueChange={(microchipNo) => onDraftChange({ microchipNo })}
        />
      </Field>
      <Field label="주보호자">
        <Input
          value={getGuardianDisplay(primaryGuardian)}
          readOnly
          className="h-9 bg-card"
        />
      </Field>
      <Field label="특이사항">
        <Input
          value={draft.specialNote ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
          onValueChange={(specialNote) => onDraftChange({ specialNote })}
        />
      </Field>
      <Field label="알러지">
        <Input
          value={draft.allergyNote ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
          onValueChange={(allergyNote) => onDraftChange({ allergyNote })}
        />
      </Field>
      <Field label="핸들링 주의">
        <Input
          value={draft.handlingCautionNote ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
          onValueChange={(handlingCautionNote) => onDraftChange({ handlingCautionNote })}
        />
      </Field>
    </section>
  );
}

export function PatientProfileDrawer({
  defaultTab = "info",
  patientId,
}: {
  defaultTab?: ProfileSidePanelTab;
  patientId: EmrId;
}) {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const workspaceId = getRegistrationWorkspaceId(params.workspaceId);
  const preparedWorkspace = isPreparedEmptyClinicWorkspace(workspaceId);
  const authSession = useMockAuthStore((state) => state.session);
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const updatePatient = usePatientProfileStore((state) => state.updatePatient);
  const applyPatientGuardianLookupItem = usePatientProfileStore(
    (state) => state.applyPatientGuardianLookupItem,
  );
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const bundle = getProfileBundle(patientId, patients, guardians, patientGuardians, !preparedWorkspace);
  const liveRead = useCustomerProfileOverview({
    enabled: preparedWorkspace,
    subjectId: patientId,
    subjectType: "patient",
    workspaceId,
  });
  const todayRead = useProfileToday({ enabled: preparedWorkspace, overview: liveRead.overview, subjectId: patientId, subjectType: "patient", workspaceId });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileSidePanelTab>(defaultTab);
  const [draft, setDraft] = useState<
    Pick<Patient, "allergyNote" | "breed" | "handlingCautionNote" | "microchipNo" | "name" | "specialNote">
  >({
    allergyNote: "",
    breed: "",
    handlingCautionNote: "",
    microchipNo: "",
    name: "",
    specialNote: "",
  });

  if (!bundle && !preparedWorkspace) {
    return (
      <div className="p-4 emr-text-dense text-muted-foreground">
        환자 정보를 찾을 수 없습니다.
      </div>
    );
  }

  const editablePatient = liveRead.overview
    ? mapLivePatient(liveRead.overview.profile, workspaceId)
    : bundle?.patient;
  const liveGuardianRows = Array.isArray(liveRead.overview?.relationships.guardians)
    ? liveRead.overview.relationships.guardians as Array<Record<string, unknown>>
    : [];
  const editablePrimaryGuardian = liveRead.overview
    ? (() => {
        const row = liveGuardianRows.find((item) => item.isPrimary === true);
        return row ? mapLiveGuardian(row, workspaceId) : undefined;
      })()
    : bundle?.primaryGuardian;

  const beginEdit = () => {
    if (!editablePatient) return;
    setDraft({
      allergyNote: editablePatient.allergyNote ?? "",
      breed: editablePatient.breed ?? "",
      handlingCautionNote: editablePatient.handlingCautionNote ?? "",
      microchipNo: editablePatient.microchipNo ?? "",
      name: editablePatient.name,
      specialNote: editablePatient.specialNote ?? "",
    });
    setEditing(true);
  };
  const cancelEdit = () => {
    if (saving) return;
    setEditing(false);
  };
  const saveEdit = async () => {
    if (saving || !editablePatient) return;
    const patch: CustomerPatientProfileUpdateInput = {
      allergyNote: draft.allergyNote || undefined,
      breed: draft.breed || undefined,
      handlingCautionNote: draft.handlingCautionNote || undefined,
      microchipNo: draft.microchipNo || undefined,
      name: draft.name,
      specialNote: draft.specialNote || undefined,
    };

    setSaving(true);
    const result = await submitPatientProfileUpdate({
      actorRole: authSession?.role,
      input: patch,
      patientId: editablePatient.id,
      workspaceId,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(getPatientProfileUpdateErrorMessage(result));
      return;
    }

    updatePatient(editablePatient.id, {
      allergyNote: result.profile.allergyNote,
      breed: result.profile.breed,
      handlingCautionNote: result.profile.handlingCautionNote,
      microchipNo: result.profile.microchipNo,
      name: result.profile.name,
      specialNote: result.profile.specialNote,
    });
    if (preparedWorkspace) liveRead.reloadOverview();
    setEditing(false);
    toast.success("환자 정보가 저장되었습니다.");
  };
  const model = liveRead.overview
    ? getLivePatientProfileSidePanelModel(liveRead.overview, liveRead, workspaceId)
    : preparedWorkspace
      ? getLiveUnavailableProfileSidePanelModel("patient")
      : getPatientProfileSidePanelModel(bundle!);
  const showMockAction = (label: string) => {
    toast.info(`${model.name} ${label}은 mock 동작입니다.`);
  };
  const openReceptionFlow = (type: "reception-form" | "reception-reservation-form") => {
    if (!editablePatient) {
      toast.error("환자 정보를 불러온 뒤 다시 시도해 주세요.");
      return;
    }

    applyPatientGuardianLookupItem({
      patient: editablePatient,
      primaryGuardian: editablePrimaryGuardian,
    });
    setActiveDrawer({
      type,
      id: `patient-profile:${editablePatient.id}`,
      initialOperatingDate: getWorkspaceOperatingDate(workspaceId),
      initialPatientId: editablePatient.id,
      returnTo: {
        type:
          activeDrawer?.type === "reception-patient"
            ? "reception-patient"
            : "patient",
        id: editablePatient.id,
        profileTab: activeTab,
      },
      rightPanelPresentation: {
        gap: 10,
        mobileFullWidth: true,
        persistToUrl: false,
        surface: "workspace-right-panel",
        width: 380,
      },
    });
  };
  const tabAccess = preparedWorkspace ? getLiveTabAccess(liveRead) : undefined;
  const sectionStates = preparedWorkspace
    ? {
        info: { status: liveRead.overviewStatus },
        history: liveRead.sectionStates.history,
        reservations: liveRead.sectionStates.reservations,
        billing: liveRead.sectionStates.billing,
      }
    : undefined;

  return (
    <ProfileSidePanel
      defaultTab={defaultTab}
      embedded
      model={preparedWorkspace ? { ...model, todayItems: todayRead.items, todayState: { status: todayRead.status } } : model}
      onLoadSection={(section, filter, append = false) => {
        if (section === "info") return;
        liveRead.loadSection(section, filter, { append, force: !append });
      }}
      sectionStates={sectionStates}
      tabAccess={tabAccess}
      onRetryOverview={liveRead.reloadOverview}
      onRetryToday={todayRead.reload}
      editing={editing}
      saving={saving}
      onBeginEdit={editablePatient ? beginEdit : undefined}
      onCancelEdit={cancelEdit}
      onSaveEdit={editablePatient ? saveEdit : undefined}
      onClose={() => setActiveDrawer(null)}
      onHeaderAction={(action) => {
        if (action === "message") {
          showMockAction("카카오톡 발송");
          return;
        }
        openReceptionFlow(
          action === "walk-in"
            ? "reception-form"
            : "reception-reservation-form",
        );
      }}
      onTabChange={setActiveTab}
      onOpenRelated={(item) => setActiveDrawer({ type: "guardian", id: item.id })}
      editContent={editablePatient ? (
        <PatientSummaryFields
          patient={editablePatient}
          primaryGuardian={editablePrimaryGuardian}
          draft={editing ? draft : {
            allergyNote: editablePatient.allergyNote ?? "",
            breed: editablePatient.breed ?? "",
            handlingCautionNote: editablePatient.handlingCautionNote ?? "",
            microchipNo: editablePatient.microchipNo ?? "",
            name: editablePatient.name,
            specialNote: editablePatient.specialNote ?? "",
          }}
          editing={editing}
          onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        />
      ) : undefined}
    />
  );
}

function GuardianSummaryFields({
  draft,
  editing,
  onDraftChange,
}: {
  draft: Pick<Guardian, "address" | "email" | "memo" | "mobilePhone" | "name" | "phone">;
  editing: boolean;
  onDraftChange: (patch: Partial<typeof draft>) => void;
}) {
  return (
    <section className="grid grid-cols-2 gap-3">
      <Field label="보호자명">
        <Input
          value={draft.name ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
          onValueChange={(name) => onDraftChange({ name })}
        />
      </Field>
      <Field label="휴대전화">
        <Input
          value={draft.mobilePhone ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
          onValueChange={(mobilePhone) => onDraftChange({ mobilePhone })}
        />
      </Field>
      <Field label="전화">
        <Input
          value={draft.phone ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
          onValueChange={(phone) => onDraftChange({ phone })}
        />
      </Field>
      <Field label="이메일">
        <Input
          value={draft.email ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
          onValueChange={(email) => onDraftChange({ email })}
        />
      </Field>
      <Field label="주소">
        <Input
          value={draft.address ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
          onValueChange={(address) => onDraftChange({ address })}
        />
      </Field>
      <Field label="메모">
        <Input
          value={draft.memo ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
          onValueChange={(memo) => onDraftChange({ memo })}
        />
      </Field>
    </section>
  );
}

export function GuardianProfileDrawer({ guardianId }: { guardianId: EmrId }) {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const workspaceId = getRegistrationWorkspaceId(params.workspaceId);
  const preparedWorkspace = isPreparedEmptyClinicWorkspace(workspaceId);
  const authSession = useMockAuthStore((state) => state.session);
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const consents = usePatientProfileStore((state) => state.consents);
  const updateGuardian = usePatientProfileStore((state) => state.updateGuardian);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const bundle = getGuardianProfileBundle(guardianId, patients, guardians, patientGuardians, consents, !preparedWorkspace);
  const liveRead = useCustomerProfileOverview({
    enabled: preparedWorkspace,
    subjectId: guardianId,
    subjectType: "guardian",
    workspaceId,
  });
  const todayRead = useProfileToday({ enabled: preparedWorkspace, overview: liveRead.overview, subjectId: guardianId, subjectType: "guardian", workspaceId });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<
    Pick<Guardian, "address" | "email" | "memo" | "mobilePhone" | "name" | "phone">
  >({
    address: "",
    email: "",
    memo: "",
    mobilePhone: "",
    name: "",
    phone: "",
  });

  if (!bundle && !preparedWorkspace) {
    return (
      <div className="p-4 emr-text-dense text-muted-foreground">
        보호자 정보를 찾을 수 없습니다.
      </div>
    );
  }

  const editableGuardian = liveRead.overview
    ? mapLiveGuardian(liveRead.overview.profile, workspaceId)
    : bundle?.guardian;

  const beginEdit = () => {
    if (!editableGuardian) return;
    setDraft({
      address: editableGuardian.address ?? "",
      email: editableGuardian.email ?? "",
      memo: editableGuardian.memo ?? "",
      mobilePhone: editableGuardian.mobilePhone ?? "",
      name: editableGuardian.name,
      phone: editableGuardian.phone ?? "",
    });
    setEditing(true);
  };
  const cancelEdit = () => {
    if (saving) return;
    setEditing(false);
  };
  const saveEdit = async () => {
    if (saving || !editableGuardian) return;
    const patch: CustomerGuardianProfileUpdateInput = {
      address: draft.address || undefined,
      email: draft.email || undefined,
      memo: draft.memo || undefined,
      mobilePhone: draft.mobilePhone || undefined,
      name: draft.name,
      phone: draft.phone || undefined,
    };

    setSaving(true);
    const result = await submitGuardianProfileUpdate({
      actorRole: authSession?.role,
      guardianId: editableGuardian.id,
      input: patch,
      workspaceId,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(getGuardianProfileUpdateErrorMessage(result));
      return;
    }

    updateGuardian(editableGuardian.id, {
      address: result.profile.address,
      email: result.profile.email,
      memo: result.profile.memo,
      mobilePhone: result.profile.mobilePhone,
      name: result.profile.name,
      phone: result.profile.phone,
    });
    if (preparedWorkspace) liveRead.reloadOverview();
    setEditing(false);
    toast.success("보호자 정보가 저장되었습니다.");
  };
  const model = liveRead.overview
    ? getLiveGuardianProfileSidePanelModel(liveRead.overview, liveRead, workspaceId)
    : preparedWorkspace
      ? getLiveUnavailableProfileSidePanelModel("guardian")
      : getGuardianProfileSidePanelModel(bundle!);
  const showMockAction = (label: string) => {
    toast.info(`${model.name} 보호자 ${label}은 mock 동작입니다.`);
  };
  const tabAccess = preparedWorkspace ? getLiveTabAccess(liveRead) : undefined;
  const sectionStates = preparedWorkspace
    ? {
        info: { status: liveRead.overviewStatus },
        history: liveRead.sectionStates.history,
        reservations: liveRead.sectionStates.reservations,
        billing: liveRead.sectionStates.billing,
      }
    : undefined;

  return (
    <ProfileSidePanel
      embedded
      model={preparedWorkspace ? { ...model, todayItems: todayRead.items, todayState: { status: todayRead.status } } : model}
      onLoadSection={(section, filter, append = false) => {
        if (section === "info") return;
        liveRead.loadSection(section, filter, { append, force: !append });
      }}
      sectionStates={sectionStates}
      tabAccess={tabAccess}
      onRetryOverview={liveRead.reloadOverview}
      onRetryToday={todayRead.reload}
      editing={editing}
      saving={saving}
      onBeginEdit={editableGuardian ? beginEdit : undefined}
      onCancelEdit={cancelEdit}
      onSaveEdit={editableGuardian ? saveEdit : undefined}
      onClose={() => setActiveDrawer(null)}
      onHeaderAction={() => showMockAction("카카오톡 발송")}
      onOpenRelated={(item) => setActiveDrawer({ type: "patient", id: item.id })}
      editContent={editableGuardian ? (
        <GuardianSummaryFields
          draft={editing ? draft : {
            address: editableGuardian.address ?? "",
            email: editableGuardian.email ?? "",
            memo: editableGuardian.memo ?? "",
            mobilePhone: editableGuardian.mobilePhone ?? "",
            name: editableGuardian.name,
            phone: editableGuardian.phone ?? "",
          }}
          editing={editing}
          onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        />
      ) : undefined}
    />
  );
}

export function NewPatientDialog({
  initialGuardianId = "",
  initialGuardianMobilePhone = "",
  initialGuardianName = "",
  onCreated,
  onOpenChange,
  openPatientDrawerOnCreated = true,
  open,
}: {
  initialGuardianId?: string;
  initialGuardianMobilePhone?: string;
  initialGuardianName?: string;
  onCreated?: (patientId: EmrId) => void;
  onOpenChange: (open: boolean) => void;
  openPatientDrawerOnCreated?: boolean;
  open: boolean;
}) {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const workspaceId = getRegistrationWorkspaceId(params.workspaceId);
  const registrationReferenceDate = getWorkspaceOperatingDate(workspaceId);
  const addPatient = usePatientProfileStore((state) => state.addPatient);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const hasDuplicatePatientNameForGuardian = usePatientProfileStore(
    (state) => state.hasDuplicatePatientNameForGuardian
  );
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<NewPatientDraft>(() =>
    createNewPatientDraft({
      guardianId: initialGuardianId,
      guardianMobilePhone: initialGuardianMobilePhone,
      guardianName: initialGuardianName,
    })
  );

  const reset = () => {
    setDraft(
      createNewPatientDraft({
        guardianId: initialGuardianId,
        guardianMobilePhone: initialGuardianMobilePhone,
        guardianName: initialGuardianName,
      })
    );
    setError("");
  };
  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) reset();
  };
  const selectedGuardian = draft.existingGuardianId
    ? guardians.find((guardian) => guardian.id === draft.existingGuardianId)
    : undefined;
  const duplicateGuardian =
    !selectedGuardian && draft.guardianMobilePhone
      ? guardians.find(
          (guardian) =>
            normalizeGuardianPhone(guardian.mobilePhone) ===
            normalizeGuardianPhone(draft.guardianMobilePhone)
	        )
	      : undefined;
	  const canSubmit = !duplicateGuardian;
  const duplicatePatientName =
    selectedGuardian && draft.name
      ? hasDuplicatePatientNameForGuardian(selectedGuardian.id, draft.name)
      : false;
  const save = () => {
    const sexPayload = getNewPatientSexPayload(draft.sex);
    const ageParts = [
      draft.ageYears ? `${draft.ageYears}년` : "",
      draft.ageMonths ? `${draft.ageMonths}개월` : "",
      draft.ageDays ? `${draft.ageDays}일` : "",
    ].filter(Boolean);
    const estimatedAgeText = ageParts.length
      ? `${ageParts.join(" ")}${draft.estimatedAge ? " 추정" : ""}`
      : draft.birthDate
        ? getAgeTextFromBirthDate(draft.birthDate, registrationReferenceDate)
        : undefined;
    const breed = draft.isMixed
      ? [draft.breed.trim() || getMixBreedSuggestion(draft.species), ...splitBreedList(draft.additionalBreed)]
          .filter(Boolean)
          .join(" · ")
      : draft.breed;
    const result = addPatient({
      birthDate: draft.birthDate,
      breed,
      estimatedAgeText,
	      existingGuardianId: selectedGuardian?.id,
	      guardianMobilePhone: draft.guardianMobilePhone,
	      guardianName: draft.guardianName,
	      microchipNo: draft.microchipNo,
	      name: draft.name,
	      neutered: sexPayload.neutered,
      patientRegistrationNo: draft.patientRegistrationNo,
	      sex: sexPayload.sex,
      species: draft.species,
      specialNote: draft.specialNote,
    });

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.patientId) {
      if (openPatientDrawerOnCreated) {
        setActiveDrawer({ type: "patient", id: result.patientId });
      }
      onCreated?.(result.patientId);
    }
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="grid max-h-[calc(100vh-5rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[640px]"
        showCloseButton={false}
      >
        <DialogHeader className="px-8 pb-4 pt-7">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <DialogTitle className="text-[22px] font-bold leading-7 text-foreground">
              신규 동물 등록
            </DialogTitle>
            <RegistrationDialogCloseButton
              ariaLabel="신규 동물 창 닫기"
              onClick={() => close(false)}
            />
          </div>
          <DialogDescription className="sr-only">
            새 동물 등록 양식입니다.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(100vh-15rem)] min-h-0 overflow-hidden px-7">
          <div className="flex flex-col gap-5 px-1 pb-6 pt-3">
            <RegistrationFormSection separated={false} title="보호자 연결">
              <div className="grid grid-cols-2 gap-x-7 gap-y-5">
                <RegistrationFormField
                  error={error.includes("보호자명") ? error : undefined}
	                  label="보호자 검색"
	                  required
	                >
	                  <GuardianSearchPopover
	                    error={error.includes("보호자명") ? error : undefined}
	                    guardians={guardians}
	                    patientGuardians={patientGuardians}
	                    phoneValue={draft.guardianMobilePhone}
	                    selectedGuardianId={draft.existingGuardianId}
	                    value={draft.guardianName}
	                    onSearchChange={(guardianName) =>
	                      setDraft((current) => ({
	                        ...current,
	                        existingGuardianId: "",
	                        guardianName,
	                      }))
	                    }
	                    onSelect={(guardian) =>
	                      setDraft((current) => ({
	                        ...current,
	                        existingGuardianId: guardian.id,
	                        guardianMobilePhone: guardian.mobilePhone ?? "",
	                        guardianName: guardian.name,
	                      }))
	                    }
	                  />
	                </RegistrationFormField>
                <RegistrationFormField label="보호자 휴대전화">
                  <Input
                    aria-label="보호자 휴대전화"
                    className="h-10 bg-card"
		                    placeholder="010-0000-0000"
		                    value={draft.guardianMobilePhone}
		                    onValueChange={(guardianMobilePhone) =>
		                      setDraft((current) => ({
		                        ...current,
		                        existingGuardianId: "",
		                        guardianMobilePhone: formatKoreanPhoneNumber(guardianMobilePhone),
		                      }))
		                    }
		                  />
	                </RegistrationFormField>
	                {duplicateGuardian ? (
	                  <div className="col-span-2 rounded-lg border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] p-3">
	                    <div className="emr-text-dense font-semibold text-[var(--emr-status-danger-text)]">
	                      이미 등록된 보호자입니다
	                    </div>
	                    <div className="mt-1 emr-text-metadata text-[var(--emr-status-danger-text)]">
	                      {duplicateGuardian.name} · {duplicateGuardian.mobilePhone} 보호자를 선택해 연결해 주세요.
	                    </div>
	                  </div>
	                ) : null}
                {error && !error.includes("환자명") && !error.includes("보호자명") ? (
	                  <div className="col-span-2 emr-text-metadata font-medium text-[var(--emr-status-danger-text)]">
	                    {error}
	                  </div>
	                ) : null}
                {duplicatePatientName ? (
                  <div className="col-span-2 rounded-lg border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] p-3 emr-text-metadata font-medium text-[var(--emr-status-warning-text)]">
                    동일 보호자 아래 같은 이름의 동물이 이미 등록되어 있습니다. 실제 중복 여부를 확인해 주세요.
                  </div>
                ) : null}
	              </div>
            </RegistrationFormSection>

            <RegistrationFormSection title="동물 정보">
              <div className="grid grid-cols-2 gap-x-7 gap-y-5">
                <RegistrationFormField
                  error={error.includes("환자명") ? error : undefined}
                  label="동물 이름"
                  required
                >
                  <Input
                    aria-label="환자명"
                    aria-invalid={error.includes("환자명") || undefined}
                    className="h-10 bg-card"
                    placeholder="동물의 이름을 입력해주세요"
                    value={draft.name}
                    onValueChange={(name) => setDraft((current) => ({ ...current, name }))}
                  />
                </RegistrationFormField>
                <RegistrationFormField label="동물 종류" required>
                  <Select
                    value={draft.species}
                    onValueChange={(species) =>
                      setDraft((current) => {
                        const nextSpecies = species as Species;
                        const mixBreed = getMixBreedSuggestion(nextSpecies);

                        return {
                          ...current,
                          breed: current.isMixed && mixBreed ? mixBreed : current.breed,
                          species: nextSpecies,
                        };
                      })
                    }
                  >
                    <SelectTrigger aria-label="종" size="xl" className="w-full bg-card">
                      <span className="flex flex-1 text-left">
                        {getNewPatientSpeciesLabel(draft.species)}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {newPatientSpeciesOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </RegistrationFormField>
                <RegistrationFormField
                  label="주 품종"
                  required
                  actions={
                    <label className="flex items-center gap-2 emr-text-dense font-medium text-[var(--emr-text-secondary)]">
                      <Switch
                        checked={draft.isMixed}
                        onCheckedChange={(isMixed) =>
                          setDraft((current) => ({
                            ...current,
                            breed: isMixed
                              ? getMixBreedSuggestion(current.species) || current.breed
                              : current.breed,
                            isMixed,
                          }))
                        }
                      />
                      믹스
                    </label>
                  }
	                >
	                  <BreedAutocomplete
	                    ariaLabel="품종"
	                    className="h-10 bg-card"
	                    placeholder="주 품종을 선택해주세요"
	                    species={draft.species}
	                    value={draft.breed}
	                    onValueChange={(breed) => setDraft((current) => ({ ...current, breed }))}
	                  />
	                </RegistrationFormField>
                <RegistrationFormField label="성별">
	                  <Select
	                    value={draft.sex}
	                    onValueChange={(sex) =>
	                      setDraft((current) => ({ ...current, sex: sex as NewPatientSexValue }))
	                    }
	                  >
	                    <SelectTrigger aria-label="성별" size="xl" className="w-full bg-card">
                      <span className="flex flex-1 text-left">
                        {getNewPatientSexLabel(draft.sex)}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {newPatientSexOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </RegistrationFormField>
	                {draft.isMixed ? (
                  <RegistrationFormField className="col-span-2" label="추가 품종">
                    <BreedMultiSelect
                      ariaLabel="추가 품종"
                      className="min-h-10 bg-card"
                      placeholder="믹스의 경우 추가 품종을 선택해주세요"
	                      species={draft.species}
	                      value={draft.additionalBreed}
	                      onValueChange={(additionalBreed) =>
	                        setDraft((current) => ({ ...current, additionalBreed }))
	                      }
	                    />
	                  </RegistrationFormField>
	                ) : null}
              </div>
            </RegistrationFormSection>

            <RegistrationFormSection title="추가 정보">
              <div className="grid grid-cols-2 gap-x-7 gap-y-5">
                <RegistrationFormField
                  label="동물 나이"
                  actions={
                    <label className="flex items-center gap-2 emr-text-dense font-medium text-[var(--emr-text-secondary)]">
                      <Switch
                        size="xs"
                        checked={draft.estimatedAge}
                        onCheckedChange={(estimatedAge) =>
                          setDraft((current) => ({ ...current, estimatedAge }))
                        }
                      />
                      추정
                    </label>
                  }
                >
                  <div className="grid grid-cols-2 gap-2">
                    <AgePartInput
                      ariaLabel="나이 년"
                      unit="년"
                      value={draft.ageYears}
                      onValueChange={(ageYears) =>
                        setDraft((current) => ({
                          ...current,
                          ageYears,
                          birthDate: getBirthDateFromAge({
                            months: current.ageMonths,
                            referenceDate: registrationReferenceDate,
                            years: ageYears,
                          }),
                        }))
                      }
                    />
                    <AgePartInput
                      ariaLabel="나이 개월"
                      unit="개월"
                      value={draft.ageMonths}
                      onValueChange={(ageMonths) =>
                        setDraft((current) => ({
                          ...current,
                          ageMonths,
                          birthDate: getBirthDateFromAge({
                            months: ageMonths,
                            referenceDate: registrationReferenceDate,
                            years: current.ageYears,
                          }),
                        }))
                      }
                    />
                  </div>
                  {draft.birthDate ? (
                    <div className="mt-1 emr-text-metadata font-medium text-muted-foreground">
                      생년월일 {draft.birthDate}
                    </div>
                  ) : null}
                </RegistrationFormField>
                <RegistrationFormField label="생년월일">
                  <Input
                    aria-label="생년월일"
                    className="h-10 bg-card"
                    placeholder="YYYY-MM-DD"
                    value={draft.birthDate}
                    onValueChange={(birthDate) =>
                      setDraft((current) => ({
                        ...current,
                        ageMonths: "",
                        ageYears: "",
                        birthDate: formatBirthDateInput(birthDate),
                      }))
                    }
                  />
                  {draft.birthDate ? (
                    <div className="mt-1 emr-text-metadata font-medium text-muted-foreground">
                      현재 나이 {getAgeTextFromBirthDate(draft.birthDate, registrationReferenceDate) || "계산 불가"}
                    </div>
                  ) : null}
                </RegistrationFormField>
                <RegistrationFormField
                  error={error.includes("마이크로칩") ? error : undefined}
                  label="마이크로칩"
                >
                  <Input
                    aria-label="마이크로칩"
	                    className="h-10 bg-card"
	                    inputMode="numeric"
	                    placeholder="15자리 마이크로칩 번호"
                    value={draft.microchipNo}
                    onValueChange={(microchipNo) =>
                      setDraft((current) => ({ ...current, microchipNo }))
                    }
                  />
                </RegistrationFormField>
                <RegistrationFormField
                  className="col-span-2"
                  label="메모"
                  actions={
                    <span className="emr-text-metadata font-medium text-[var(--emr-text-tertiary)]">
                      {draft.specialNote.length}/500자
                    </span>
                  }
                >
                  <Textarea
                    className="min-h-[88px] resize-none bg-card"
                    maxLength={500}
                    placeholder="내용을 입력해주세요"
                    value={draft.specialNote}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, specialNote: event.target.value }))
                    }
                  />
                </RegistrationFormField>
              </div>
            </RegistrationFormSection>
          </div>
        </ScrollArea>
	        <DialogFooter className="relative -mx-0 -mb-0 items-center justify-between rounded-none border-t bg-card px-8 py-4 sm:justify-between">
	          <div className="min-w-0 text-left emr-text-metadata font-medium text-muted-foreground">
	            품종/보호자 중복은 현재 세션 데이터 기준으로만 확인합니다.
	          </div>
	          <div className="flex shrink-0 items-center gap-2">
	            <Button variant="ghost" className="px-4 font-semibold" onClick={() => close(false)}>
	              취소
	            </Button>
	            <Button className="px-5 font-semibold" disabled={!canSubmit} onClick={save}>
	              등록
	            </Button>
	          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewGuardianDialog({
  initialMobilePhone = "",
  initialName = "",
  onCreated,
  onOpenChange,
  openGuardianDrawerOnCreated = true,
  open,
}: {
  initialMobilePhone?: string;
  initialName?: string;
  onCreated?: (guardian: Guardian) => void;
  onOpenChange: (open: boolean) => void;
  openGuardianDrawerOnCreated?: boolean;
  open: boolean;
}) {
  const addGuardian = usePatientProfileStore((state) => state.addGuardian);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    addressDetail: "",
    addressPostalCode: "",
    addressRoad: "",
    birthDate: "",
    email: "",
    memo: "",
    mobilePhone: initialMobilePhone,
    name: initialName,
    phone: "",
    privacyConsent: false,
    marketingConsent: false,
    signatureStatus: "idle" as "idle" | "pending" | "completed",
  });
  const handleAddressSelect = useCallback((address: KakaoPostcodeSelectedAddress) => {
    setDraft((current) => ({
      ...current,
      addressPostalCode: address.postalCode,
      addressRoad: address.baseAddress,
    }));
  }, []);
  const guardianAddressSearch = useKakaoAddressSearch({
    enabled: open,
    onSelectAddress: handleAddressSelect,
  });

  const reset = () => {
    setDraft({
      addressDetail: "",
      addressPostalCode: "",
      addressRoad: "",
      birthDate: "",
      email: "",
      memo: "",
      mobilePhone: initialMobilePhone,
      name: initialName,
      phone: "",
      privacyConsent: false,
      marketingConsent: false,
      signatureStatus: "idle",
    });
    setError("");
  };
  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) reset();
  };
  const save = () => {
    const result = addGuardian({
      ...draft,
      address: formatKoreanAddress({
        detail: draft.addressDetail,
        postalCode: draft.addressPostalCode,
        road: draft.addressRoad,
      }),
      privacyConsent: draft.privacyConsent && draft.signatureStatus === "completed",
    });

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.guardianId) {
      const createdGuardian = usePatientProfileStore
        .getState()
        .guardians.find((guardian) => guardian.id === result.guardianId);

      if (createdGuardian) {
        onCreated?.(createdGuardian);
      }
    }
    if (result.guardianId && openGuardianDrawerOnCreated) {
      setActiveDrawer({ type: "guardian", id: result.guardianId });
    }
    close(false);
  };
  const duplicateGuardian = draft.mobilePhone
    ? guardians.find(
        (guardian) => normalizeGuardianPhone(guardian.mobilePhone) === normalizeGuardianPhone(draft.mobilePhone)
      )
    : undefined;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="grid max-h-[calc(100vh-5rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[640px]"
        showCloseButton={false}
      >
        <DialogHeader className="px-8 pb-4 pt-7">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <DialogTitle className="text-[22px] font-bold leading-7 text-foreground">
              보호자 등록
            </DialogTitle>
            <RegistrationDialogCloseButton
              ariaLabel="보호자 창 닫기"
              onClick={() => close(false)}
            />
          </div>
          <DialogDescription className="sr-only">
            새 보호자 등록 양식입니다.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(100vh-15rem)] min-h-0 overflow-hidden px-7">
          <div className="flex flex-col gap-5 px-1 pb-6 pt-3">
            <RegistrationFormSection separated={false} title="기본 정보">
              <div className="grid grid-cols-2 gap-x-7 gap-y-5">
                <RegistrationFormField
                  error={error.includes("보호자명") ? error : undefined}
                  label="이름"
                  required
                >
                  <Input
                    aria-label="보호자명"
                    aria-invalid={error.includes("보호자명") || undefined}
                    className="h-10 bg-card"
                    placeholder="이름을 입력해주세요"
                    value={draft.name}
                    onValueChange={(name) => setDraft((current) => ({ ...current, name }))}
                  />
                </RegistrationFormField>
                <RegistrationFormField label="생년월일">
                  <Input
                    aria-label="보호자 생년월일"
                    className="h-10 bg-card"
                    placeholder="날짜 선택 또는 직접 입력"
                    value={draft.birthDate}
                    onValueChange={(birthDate) =>
                      setDraft((current) => ({
                        ...current,
                        birthDate: formatBirthDateInput(birthDate),
                      }))
                    }
                  />
                </RegistrationFormField>
	                <RegistrationFormField className="col-span-2" label="휴대폰 번호">
                  <Input
                    aria-label="보호자 휴대전화"
                    className="h-10 bg-card"
                    inputMode="numeric"
                    placeholder="휴대폰 번호를 입력해주세요"
                    value={draft.mobilePhone}
                    onValueChange={(mobilePhone) =>
		                      setDraft((current) => ({
                            ...current,
                            mobilePhone: formatKoreanPhoneNumber(mobilePhone),
                          }))
		                    }
                  />
	                </RegistrationFormField>
	                {duplicateGuardian ? (
	                  <div className="col-span-2 rounded-lg border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] p-3">
	                    <div className="flex items-start justify-between gap-3">
	                      <div>
	                        <div className="emr-text-dense font-semibold text-[var(--emr-status-danger-text)]">
	                          이미 등록된 보호자입니다
	                        </div>
	                        <div className="mt-1 emr-text-metadata text-[var(--emr-status-danger-text)]">
	                          {duplicateGuardian.name} · {duplicateGuardian.mobilePhone ?? "연락처 미입력"} · 연결 환자{" "}
	                          {getGuardianPatientCount(duplicateGuardian.id, patientGuardians)}마리
	                        </div>
	                      </div>
	                      <Button
	                        type="button"
	                        variant="outline"
	                        size="sm"
	                        className="bg-card"
	                        onClick={() => {
	                          close(false);
	                          setActiveDrawer({ type: "guardian", id: duplicateGuardian.id });
	                        }}
	                      >
	                        보호자 상세 보기
	                      </Button>
	                    </div>
	                  </div>
	                ) : null}
	              </div>
	            </RegistrationFormSection>

            <RegistrationFormSection title="연락처 및 주소">
              <div className="grid grid-cols-2 gap-x-7 gap-y-5">
                <RegistrationFormField label="추가 연락처">
                  <Input
                    className="h-10 bg-card"
                    inputMode="numeric"
                    placeholder="010-0000-0000"
                    value={draft.phone}
                    onValueChange={(phone) =>
                      setDraft((current) => ({
                        ...current,
                        phone: formatKoreanPhoneNumber(phone),
                      }))
                    }
                  />
                </RegistrationFormField>
                <RegistrationFormField label="이메일">
                  <Input
                    className="h-10 bg-card"
                    placeholder="example@email.com"
                    value={draft.email}
                    onValueChange={(email) => setDraft((current) => ({ ...current, email }))}
                  />
                </RegistrationFormField>
                <RegistrationFormField className="col-span-2" label="주소">
                  <KoreanAddressFields
                    detail={draft.addressDetail}
                    onSearchAddress={guardianAddressSearch.openAddressSearch}
                    postalCode={draft.addressPostalCode}
                    road={draft.addressRoad}
                    searchError={guardianAddressSearch.errorMessage}
                    searchLoading={guardianAddressSearch.isLoading}
                    onDetailChange={(addressDetail) =>
                      setDraft((current) => ({ ...current, addressDetail }))
                    }
                    onPostalCodeChange={(addressPostalCode) =>
                      setDraft((current) => ({ ...current, addressPostalCode }))
                    }
                    onRoadChange={(addressRoad) =>
                      setDraft((current) => ({ ...current, addressRoad }))
                    }
                  />
                </RegistrationFormField>
              </div>
            </RegistrationFormSection>

            <RegistrationFormSection title="메모 및 동의">
              <div className="grid gap-6">
                <RegistrationFormField label="메모">
                  <Textarea
                    className="min-h-[88px] resize-none bg-card"
                    placeholder="내용을 입력해주세요"
                    value={draft.memo}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, memo: event.target.value }))
                    }
                  />
                </RegistrationFormField>
	                <div className="rounded-lg border bg-card p-3">
	                  <div className="flex items-start justify-between gap-3">
	                    <div>
	                      <div className="emr-text-dense font-semibold text-foreground">
	                        전자서명
	                      </div>
	                      <div className="mt-1 emr-text-metadata text-muted-foreground">
	                        개인정보 수집 동의는 태블릿 서명 완료 후 등록할 수 있습니다.
	                      </div>
	                    </div>
	                    <Badge variant={draft.signatureStatus === "completed" ? "default" : "outline"}>
	                      {draft.signatureStatus === "completed"
	                        ? "서명 완료"
	                        : draft.signatureStatus === "pending"
	                          ? "서명 대기"
	                          : "미요청"}
	                    </Badge>
	                  </div>
	                  <div className="mt-3 flex flex-wrap items-center gap-2">
	                    <Button
	                      type="button"
	                      variant="outline"
	                      size="sm"
	                      onClick={() =>
	                        setDraft((current) => ({ ...current, signatureStatus: "pending" }))
	                      }
	                    >
	                      태블릿 서명 요청
	                    </Button>
	                    <Button
	                      type="button"
	                      variant="secondary"
	                      size="sm"
	                      disabled={draft.signatureStatus !== "pending"}
	                      onClick={() =>
	                        setDraft((current) => ({
	                          ...current,
	                          privacyConsent: true,
	                          signatureStatus: "completed",
	                        }))
	                      }
	                    >
	                      서명 완료 처리
	                    </Button>
	                    <label className="flex items-center gap-2 emr-text-metadata font-medium text-[var(--emr-text-secondary)]">
	                      <Checkbox checked={draft.privacyConsent} disabled />
	                      개인정보 수집 동의
	                    </label>
	                    <label className="flex items-center gap-2 emr-text-metadata font-medium text-[var(--emr-text-secondary)]">
	                      <Checkbox
	                        checked={draft.marketingConsent}
	                        onCheckedChange={(marketingConsent) =>
	                          setDraft((current) => ({
	                            ...current,
	                            marketingConsent: Boolean(marketingConsent),
	                          }))
	                        }
	                      />
	                      마케팅 수신 동의
	                    </label>
	                  </div>
	                  {error && !error.includes("보호자명") ? (
	                    <div className="mt-3 emr-text-metadata font-medium text-[var(--emr-status-danger-text)]">
	                      {error}
	                    </div>
	                  ) : null}
	                </div>
	              </div>
	            </RegistrationFormSection>
          </div>
        </ScrollArea>
        <DialogFooter className="relative -mx-0 -mb-0 items-center justify-between rounded-none border-t bg-card px-8 py-4 sm:justify-between">
          <div className="min-w-0 text-left emr-text-metadata font-medium text-muted-foreground">
            환자 연결은 보호자 상세에서 후속으로 관리합니다.
          </div>
          <div className="flex shrink-0 items-center gap-2">
	            <Button variant="ghost" className="px-4 font-semibold" onClick={() => close(false)}>
	              취소
	            </Button>
	            <Button className="px-5 font-semibold" disabled={Boolean(duplicateGuardian)} onClick={save}>
	              등록
	            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RegistrationMode = "existing_guardian_patient" | "new_guardian_patient";
type RegistrationStep = "confirm" | "guardian" | "mode" | "patient";
type RegistrationEntryPoint = "global-command" | "toolbar-direct";

type GuardianRegistrationDraft = {
  addressDetail: string;
  addressPostalCode: string;
  addressRoad: string;
  birthDate: string;
  email: string;
  marketingConsent: boolean;
  memo: string;
  mobilePhone: string;
  name: string;
  phone: string;
  privacyConsent: boolean;
  signatureStatus: "completed" | "idle" | "pending";
};

type RegistrationErrors = Partial<Record<string, string>>;

const createGuardianRegistrationDraft = (): GuardianRegistrationDraft => ({
  addressDetail: "",
  addressPostalCode: "",
  addressRoad: "",
  birthDate: "",
  email: "",
  marketingConsent: false,
  memo: "",
  mobilePhone: "",
  name: "",
  phone: "",
  privacyConsent: false,
  signatureStatus: "idle",
});

const getRegistrationStepBadge = ({
  mode,
  step,
}: {
  mode: RegistrationMode;
  step: RegistrationStep;
}) => {
  if (step === "guardian") return "1/2 보호자";
  if (step === "patient") {
    return mode === "new_guardian_patient" ? "2/2 환자" : "1/2 보호자/환자";
  }
  if (step === "confirm") {
    return mode === "new_guardian_patient" ? "확인" : "2/2 확인";
  }

  return "";
};

const isGuardianDraftDirty = (draft: GuardianRegistrationDraft) =>
  Boolean(
    draft.addressDetail ||
      draft.addressPostalCode ||
      draft.addressRoad ||
      draft.birthDate ||
      draft.email ||
      draft.marketingConsent ||
      draft.memo ||
      draft.mobilePhone ||
      draft.name ||
      draft.phone ||
      draft.privacyConsent ||
      draft.signatureStatus !== "idle"
  );

const isPatientDraftDirty = (draft: NewPatientDraft) =>
  Boolean(
    draft.additionalBreed ||
      draft.ageDays ||
      draft.ageMonths ||
      draft.ageYears ||
      draft.birthDate ||
      draft.breed ||
      draft.color ||
      draft.estimatedAge ||
      draft.guardianMobilePhone ||
      draft.guardianName ||
      draft.isMixed ||
      draft.microchipNo ||
      draft.name ||
      draft.patientRegistrationNo ||
      draft.primaryVeterinarianId ||
      draft.sex !== "unknown" ||
      draft.species !== "dog" ||
      draft.specialNote ||
      draft.weight
  );

function RegistrationModeCard({
  checked,
  description,
  title,
  value,
}: {
  checked: boolean;
  description: string;
  title: string;
  value: RegistrationMode;
}) {
  return (
    <label
      className={cn(
        "flex w-full cursor-pointer items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-[var(--emr-state-hover)] focus-within:ring-3 focus-within:ring-ring/50",
        checked && "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)]"
      )}
    >
      <Radio
        value={value}
        aria-label={title}
        className={cn(
          checked &&
            "border-[var(--emr-state-selected-border)] text-[var(--emr-state-selected-border)]"
        )}
      />
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-foreground">
          {title}
        </span>
        <span className="mt-1 block emr-text-dense leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

function getRegistrationWorkspaceId(value: string | string[] | undefined) {
  return resolveWorkspaceRouteParam(value);
}

function getReceptionRegistrationDemoActorId(role?: string) {
  if (role === "hospital_admin" || role === "billing_admin") return "user-admin";
  if (role === "vet") return "user-vet";
  return "user-front-desk";
}

async function submitGuardianProfileUpdate({
  actorRole,
  guardianId,
  input,
  workspaceId,
}: {
  actorRole?: string;
  guardianId: string;
  input: CustomerGuardianProfileUpdateInput;
  workspaceId: string;
}): Promise<CustomerGuardianProfileUpdateResult> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/customer/guardians/${encodeURIComponent(guardianId)}/profile`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-clair-demo-session-user-id": getReceptionRegistrationDemoActorId(actorRole),
        },
        body: JSON.stringify(input),
      }
    );
    const body = (await response.json()) as CustomerGuardianProfileUpdateResult;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status } as CustomerGuardianProfileUpdateResult;
      return { ok: false, status: 500, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

function getGuardianProfileUpdateErrorMessage(
  result: Extract<CustomerGuardianProfileUpdateResult, { ok: false }>
) {
  const error = "error" in result ? result.error : undefined;
  const denialReason = "denialReason" in result ? result.denialReason : undefined;

  if (String(error) === "rate_limited") {
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (result.status === 400 && error === "invalid_input") {
    return Object.values(result.fieldErrors ?? {})[0] ?? "보호자 정보를 확인해 주세요.";
  }
  if (denialReason === "guardian_not_found") {
    return "보호자 정보를 찾을 수 없습니다.";
  }
  if (
    denialReason === "permission_missing" ||
    denialReason === "inactive_user" ||
    denialReason === "workspace_membership_missing" ||
    denialReason === "workspace_membership_inactive"
  ) {
    return "이 workspace에서 보호자 정보를 수정할 권한이 없습니다.";
  }

  return "보호자 정보 저장에 실패했습니다.";
}

async function submitPatientProfileUpdate({
  actorRole,
  input,
  patientId,
  workspaceId,
}: {
  actorRole?: string;
  input: CustomerPatientProfileUpdateInput;
  patientId: string;
  workspaceId: string;
}): Promise<CustomerPatientProfileUpdateResult> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/customer/patients/${encodeURIComponent(patientId)}/profile`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-clair-demo-session-user-id": getReceptionRegistrationDemoActorId(actorRole),
        },
        body: JSON.stringify(input),
      }
    );
    const body = (await response.json()) as CustomerPatientProfileUpdateResult;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status } as CustomerPatientProfileUpdateResult;
      return { ok: false, status: 500, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

function getPatientProfileUpdateErrorMessage(
  result: Extract<CustomerPatientProfileUpdateResult, { ok: false }>
) {
  const error = "error" in result ? result.error : undefined;
  const denialReason = "denialReason" in result ? result.denialReason : undefined;

  if (String(error) === "rate_limited") return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (result.status === 400 && error === "invalid_input") {
    return Object.values(result.fieldErrors ?? {})[0] ?? "환자 정보를 확인해 주세요.";
  }
  if (denialReason === "patient_not_found") return "환자 정보를 찾을 수 없습니다.";
  if (
    denialReason === "permission_missing" ||
    denialReason === "inactive_user" ||
    denialReason === "workspace_membership_missing" ||
    denialReason === "workspace_membership_inactive"
  ) {
    return "이 workspace에서 환자 정보를 수정할 권한이 없습니다.";
  }

  return "환자 정보 저장에 실패했습니다.";
}

async function submitRegistration({
  actorRole,
  input,
  workspaceId,
}: {
  actorRole?: string;
  input: ReceptionPatientGuardianRegistrationInput;
  workspaceId: string;
}): Promise<ReceptionPatientGuardianRegistrationResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/patient-guardian-registration`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-clair-demo-session-user-id": getReceptionRegistrationDemoActorId(actorRole),
        },
        body: JSON.stringify(input),
      }
    );
    const body = (await response.json()) as ReceptionPatientGuardianRegistrationResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function loadRegistrationProfiles({
  actorRole,
  query,
  signal,
  workspaceId,
}: {
  actorRole?: string;
  query: string;
  signal: AbortSignal;
  workspaceId: string;
}): Promise<ReceptionPatientGuardianLookupResponse> {
  const searchParams = new URLSearchParams({
    query,
    syntheticAliases: "false",
  });

  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/patient-guardian-lookup?${searchParams.toString()}`,
      {
        headers: {
          "x-clair-demo-session-user-id": getReceptionRegistrationDemoActorId(actorRole),
        },
        signal,
      }
    );
    const body = (await response.json()) as ReceptionPatientGuardianLookupResponse;

    if (!response.ok || !body.ok) {
      return body.ok ? { ok: false, error: "db_read_failed" } : body;
    }

    return body;
  } catch {
    return { ok: false, error: "db_read_failed" };
  }
}

function getRegistrationRouteErrorMessage(
  result: Extract<ReceptionPatientGuardianRegistrationResponse, { ok: false }>
) {
  if (result.error === "rate_limited") {
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (result.error === "invalid_input") {
    return Object.values(result.fieldErrors ?? {})[0] ?? "등록 정보를 확인해 주세요.";
  }
  if (result.denialReason === "duplicate_guardian_mobile_phone") {
    return "이미 등록된 보호자입니다.";
  }
  if (result.denialReason === "duplicate_patient_microchip") {
    return "이미 등록된 마이크로칩 번호입니다.";
  }
  if (result.denialReason === "duplicate_patient_registration_no") {
    return "이미 등록된 동물등록번호입니다.";
  }
  if (result.denialReason === "guardian_unavailable") {
    return "연결할 보호자를 찾을 수 없습니다.";
  }
  if (
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return "이 workspace에서 환자/보호자를 등록할 권한이 없습니다.";
  }

  return "환자/보호자 등록에 실패했습니다.";
}

function PatientGuardianRegistrationButton({
  label = "환자/보호자 등록",
  openRequestKey,
  onPatientReady,
  renderTrigger = true,
  size = "sm",
}: {
  label?: string;
  openRequestKey?: number;
  onPatientReady: (patientId: EmrId) => void;
  renderTrigger?: boolean;
  size?: ComponentProps<typeof Button>["size"];
}) {
  const applyPatientGuardianRegistration = usePatientProfileStore(
    (state) => state.applyPatientGuardianRegistration
  );
  const authSession = useMockAuthStore((state) => state.session);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const params = useParams<{ workspaceId?: string | string[] }>();
  const workspaceId = getRegistrationWorkspaceId(params.workspaceId);
  const registrationReferenceDate = getWorkspaceOperatingDate(workspaceId);
  const registrationId = useId();
  const guardianNameId = `${registrationId}-guardian-name`;
  const guardianBirthDateId = `${registrationId}-guardian-birth-date`;
  const guardianMobilePhoneId = `${registrationId}-guardian-mobile-phone`;
  const privacyConsentId = `${registrationId}-privacy-consent`;
  const selectedGuardianControlId = `${registrationId}-selected-guardian`;
  const patientNameId = `${registrationId}-patient-name`;
  const patientBreedId = `${registrationId}-patient-breed`;
  const patientAgeYearsId = `${registrationId}-patient-age-years`;
  const patientBirthDateId = `${registrationId}-patient-birth-date`;
  const [open, setOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [guardianDraft, setGuardianDraft] = useState(createGuardianRegistrationDraft);
  const [guardianPopoverOpen, setGuardianPopoverOpen] = useState(false);
  const [guardianQuery, setGuardianQuery] = useState("");
  const [lookupItems, setLookupItems] = useState<ReceptionPatientGuardianLookupItem[]>([]);
  const [lookupRetryKey, setLookupRetryKey] = useState(0);
  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [mode, setMode] = useState<RegistrationMode>("new_guardian_patient");
  const [patientDraft, setPatientDraft] = useState(() => createNewPatientDraft());
  const [selectedGuardianRecordId, setSelectedGuardianRecordId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<RegistrationStep>("mode");
  const [entryPoint, setEntryPoint] = useState<RegistrationEntryPoint>("global-command");
  const previousOpenRequestKeyRef = useRef(openRequestKey);
  const handleGuardianAddressSelect = useCallback(
    (address: KakaoPostcodeSelectedAddress) => {
      setGuardianDraft((current) => ({
        ...current,
        addressPostalCode: address.postalCode,
        addressRoad: address.baseAddress,
      }));
    },
    [setGuardianDraft]
  );
  const guardianAddressSearch = useKakaoAddressSearch({
    enabled: open && mode === "new_guardian_patient" && step === "guardian",
    onSelectAddress: handleGuardianAddressSelect,
  });

  const lookupPatients = useMemo(() => lookupItems.map((item) => item.patient), [lookupItems]);
  const lookupGuardians = useMemo(
    () =>
      Array.from(
        new Map(
          lookupItems.flatMap((item) =>
            item.primaryGuardian ? [[item.primaryGuardian.id, item.primaryGuardian] as const] : []
          )
        ).values()
      ),
    [lookupItems]
  );
  const lookupPatientGuardians = useMemo<PatientGuardian[]>(
    () =>
      lookupItems.flatMap((item) =>
        item.primaryGuardian
          ? [
              {
                id: `registration-lookup-${item.patient.id}-${item.primaryGuardian.id}`,
                patientId: item.patient.id,
                guardianId: item.primaryGuardian.id,
                relationship: "주보호자",
                isPrimary: true,
                canReceiveMessages: true,
                createdAt: item.patient.createdAt,
              },
            ]
          : []
      ),
    [lookupItems]
  );
  const selectedGuardian = lookupGuardians.find(
    (guardian) => guardian.id === selectedGuardianRecordId
  );
  const guardianMatches = useMemo(() => {
    const query = guardianQuery.trim();
    const normalizedQuery = normalizeGuardianPhone(query);

    if (!query && !normalizedQuery) return lookupGuardians;

    return lookupGuardians.filter((guardian) => {
      const guardianPhone = normalizeGuardianPhone(guardian.mobilePhone);
      const guardianDisplay = getGuardianSearchDisplay(
        guardian,
        lookupPatients,
        lookupPatientGuardians
      );

      return (
        (query && guardian.name.includes(query)) ||
        (query && guardianDisplay.includes(query)) ||
        (normalizedQuery && guardianPhone.includes(normalizedQuery))
      );
    });
  }, [guardianQuery, lookupGuardians, lookupPatientGuardians, lookupPatients]);
  const selectedGuardianPatients = useMemo(() => {
    if (!selectedGuardian) return [];

    const selectedPatientIds = new Set(
      lookupPatientGuardians
        .filter((link) => link.guardianId === selectedGuardian.id)
        .map((link) => link.patientId)
    );

    return lookupPatients.filter((patient) => selectedPatientIds.has(patient.id));
  }, [lookupPatientGuardians, lookupPatients, selectedGuardian]);
  const duplicatePatientName = Boolean(
    patientDraft.name.trim() &&
      selectedGuardianPatients.some(
        (patient) => patient.name.trim().toLowerCase() === patientDraft.name.trim().toLowerCase()
      )
  );
  const selectedGuardianSearchDisplay = selectedGuardian
    ? getGuardianSearchDisplay(selectedGuardian, lookupPatients, lookupPatientGuardians)
    : "";
  const dirty =
    isGuardianDraftDirty(guardianDraft) ||
    isPatientDraftDirty(patientDraft) ||
    Boolean(guardianQuery || selectedGuardianRecordId);

  useEffect(() => {
    if (openRequestKey === undefined) return;
    if (previousOpenRequestKeyRef.current === openRequestKey) return;

    previousOpenRequestKeyRef.current = openRequestKey;
    setOpen(true);
  }, [openRequestKey]);

  useEffect(() => {
    if (
      !open ||
      mode !== "existing_guardian_patient" ||
      step !== "patient" ||
      selectedGuardianRecordId
    ) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLookupItems([]);
      setLookupStatus("loading");
      const result = await loadRegistrationProfiles({
        actorRole: authSession?.role,
        query: guardianQuery,
        signal: controller.signal,
        workspaceId,
      });

      if (controller.signal.aborted) return;
      if (!result.ok) {
        setLookupItems([]);
        setLookupStatus("error");
        return;
      }

      setLookupItems(result.patients);
      setLookupStatus("success");
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    authSession?.role,
    guardianQuery,
    lookupRetryKey,
    mode,
    open,
    selectedGuardianRecordId,
    step,
    workspaceId,
  ]);

  const reset = () => {
    setErrors({});
    setGuardianDraft(createGuardianRegistrationDraft());
    setGuardianPopoverOpen(false);
    setGuardianQuery("");
    setLookupItems([]);
    setLookupStatus("idle");
    setMode("new_guardian_patient");
    setPatientDraft(createNewPatientDraft());
    setSelectedGuardianRecordId("");
    setSubmitting(false);
    setStep("mode");
    setEntryPoint("global-command");
  };
  const requestClose = () => {
    if (dirty) {
      setConfirmCloseOpen(true);
      return;
    }

    setOpen(false);
    reset();
  };
  const closeWithoutSaving = () => {
    setConfirmCloseOpen(false);
    setOpen(false);
    reset();
  };
  const setOpenSafely = (nextOpen: boolean) => {
    if (nextOpen) {
      setOpen(true);
      return;
    }

    requestClose();
  };
  const startRegistration = (nextMode: RegistrationMode) => {
    reset();
    setEntryPoint("toolbar-direct");
    setMode(nextMode);
    setStep(nextMode === "new_guardian_patient" ? "guardian" : "patient");
    setOpen(true);
  };
  const focusRegistrationControl = (controlId: string) => {
    window.requestAnimationFrame(() => document.getElementById(controlId)?.focus());
  };
  const validateGuardianStep = () => {
    const nextErrors: RegistrationErrors = {};
    const normalizedPhone = normalizeGuardianPhone(guardianDraft.mobilePhone);

    if (!guardianDraft.name.trim()) nextErrors.guardianName = "보호자명은 필수입니다.";
    if (!guardianDraft.mobilePhone.trim()) {
      nextErrors.guardianMobilePhone = "보호자 휴대전화는 필수입니다.";
    } else if (normalizedPhone.length < 10) {
      nextErrors.guardianMobilePhone = "휴대전화 번호를 10자리 이상 입력해 주세요.";
    }
    if (!guardianDraft.birthDate.trim()) {
      nextErrors.guardianBirthDate = "생년월일은 필수입니다.";
    } else if (!isValidRegistrationBirthDate(guardianDraft.birthDate, registrationReferenceDate)) {
      nextErrors.guardianBirthDate = "생년월일은 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요.";
    }
    if (guardianDraft.signatureStatus !== "completed") {
      nextErrors.privacyConsent = "개인정보 수집 동의가 필요합니다.";
    }

    setErrors(nextErrors);
    const firstInvalidControlId = nextErrors.guardianName
      ? guardianNameId
      : nextErrors.guardianBirthDate
        ? guardianBirthDateId
        : nextErrors.guardianMobilePhone
          ? guardianMobilePhoneId
          : nextErrors.privacyConsent
            ? privacyConsentId
            : undefined;
    if (firstInvalidControlId) focusRegistrationControl(firstInvalidControlId);
    return Object.keys(nextErrors).length === 0;
  };
  const validatePatientStep = () => {
    const nextErrors: RegistrationErrors = {};

    if (mode === "existing_guardian_patient" && !selectedGuardian) {
      nextErrors.selectedGuardianId = "기존 보호자를 선택해 주세요.";
    }
    if (!patientDraft.name.trim()) nextErrors.patientName = "환자명은 필수입니다.";
    if (!patientDraft.breed.trim()) nextErrors.breed = "품종은 필수입니다.";
    if (!patientDraft.birthDate && !patientDraft.ageYears && !patientDraft.ageMonths) {
      nextErrors.age = "나이 또는 생년월일은 필수입니다.";
      nextErrors.birthDate = "나이 또는 생년월일은 필수입니다.";
    } else if (
      patientDraft.birthDate &&
      !isValidRegistrationBirthDate(patientDraft.birthDate, registrationReferenceDate)
    ) {
      nextErrors.birthDate = "생년월일은 YYYY-MM-DD 형식의 실제 날짜로 입력해 주세요.";
    }
    setErrors(nextErrors);
    const firstInvalidControlId = nextErrors.selectedGuardianId
      ? selectedGuardianControlId
      : nextErrors.patientName
        ? patientNameId
        : nextErrors.breed
          ? patientBreedId
          : nextErrors.age
            ? patientAgeYearsId
            : nextErrors.birthDate
              ? patientBirthDateId
              : undefined;
    if (firstInvalidControlId) focusRegistrationControl(firstInvalidControlId);
    return Object.keys(nextErrors).length === 0;
  };
  const getPatientPayload = (guardianId: EmrId) => {
    const sexPayload = getNewPatientSexPayload(patientDraft.sex);
    const ageParts = [
      patientDraft.ageYears ? `${patientDraft.ageYears}년` : "",
      patientDraft.ageMonths ? `${patientDraft.ageMonths}개월` : "",
      patientDraft.ageDays ? `${patientDraft.ageDays}일` : "",
    ].filter(Boolean);
    const breed = patientDraft.isMixed
      ? [
          patientDraft.breed.trim() || getMixBreedSuggestion(patientDraft.species),
          ...splitBreedList(patientDraft.additionalBreed),
        ]
          .filter(Boolean)
          .join(" · ")
      : patientDraft.breed;

    return {
      birthDate: patientDraft.birthDate,
      breed,
      estimatedAgeText: ageParts.length
        ? `${ageParts.join(" ")}${patientDraft.estimatedAge ? " 추정" : ""}`
        : patientDraft.birthDate
          ? getAgeTextFromBirthDate(patientDraft.birthDate, registrationReferenceDate)
          : undefined,
      existingGuardianId: guardianId,
      guardianMobilePhone:
        mode === "new_guardian_patient"
          ? guardianDraft.mobilePhone
          : selectedGuardian?.mobilePhone,
      guardianName:
        mode === "new_guardian_patient"
          ? guardianDraft.name
          : selectedGuardian?.name ?? "",
      microchipNo: patientDraft.microchipNo,
      name: patientDraft.name,
      neutered: sexPayload.neutered,
      patientRegistrationNo: patientDraft.patientRegistrationNo,
      sex: sexPayload.sex,
      species: patientDraft.species,
      specialNote: patientDraft.specialNote,
    };
  };
  const getRegistrationPayload = (guardianId: EmrId): ReceptionPatientGuardianRegistrationInput => ({
    mode,
    ...(mode === "existing_guardian_patient" ? { existingGuardianId: guardianId } : {}),
    ...(mode === "new_guardian_patient"
      ? {
          guardian: {
            address: formatKoreanAddress({
              detail: guardianDraft.addressDetail,
              postalCode: guardianDraft.addressPostalCode,
              road: guardianDraft.addressRoad,
            }),
            birthDate: guardianDraft.birthDate,
            email: guardianDraft.email,
            marketingConsent: guardianDraft.marketingConsent,
            memo: guardianDraft.memo,
            mobilePhone: guardianDraft.mobilePhone,
            name: guardianDraft.name,
            phone: guardianDraft.phone,
            privacyConsent: guardianDraft.signatureStatus === "completed",
          },
        }
      : {}),
    patient: getPatientPayload(guardianId),
  });
  const showSuccessToast = (patientId: EmrId, message: string) => {
    toast.success(message, {
      action: {
        label: "진료 접수",
        onClick: () => onPatientReady(patientId),
      },
      cancel: {
        label: "환자 상세 보기",
        onClick: () => setActiveDrawer({ type: "patient", id: patientId }),
      },
    });
  };
  const commitRegistration = async () => {
    if (submitting) return;
    if (!validatePatientStep()) {
      setStep("patient");
      return;
    }

    const guardianId = mode === "new_guardian_patient" ? "draft-guardian" : selectedGuardian?.id;

    if (mode === "new_guardian_patient") {
      if (!validateGuardianStep()) {
        setStep("guardian");
        return;
      }
    }

    if (!guardianId) {
      toast.error("연결할 보호자를 찾을 수 없습니다.");
      return;
    }

    setSubmitting(true);
    const result = await submitRegistration({
      actorRole: authSession?.role,
      input: getRegistrationPayload(guardianId),
      workspaceId,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(getRegistrationRouteErrorMessage(result));
      return;
    }

    const patientId = applyPatientGuardianRegistration(result.registration);
    setOpen(false);
    reset();
    showSuccessToast(
      patientId,
      mode === "new_guardian_patient"
        ? "환자/보호자 등록이 완료되었습니다."
        : "환자 등록이 완료되었습니다."
    );
  };
  const goNextFromMode = () => {
    setErrors({});
    setStep(mode === "new_guardian_patient" ? "guardian" : "patient");
  };
  const goNextFromGuardian = () => {
    if (validateGuardianStep()) {
      setPatientDraft(
        createNewPatientDraft({
          guardianMobilePhone: guardianDraft.mobilePhone,
          guardianName: guardianDraft.name,
        })
      );
      setStep("patient");
    }
  };
  const goNextFromPatient = () => {
    if (validatePatientStep()) setStep("confirm");
  };
  const selectedGuardianPatientCount = selectedGuardian
    ? getGuardianPatientCount(selectedGuardian.id, lookupPatientGuardians)
    : 0;
  const stepBadge = getRegistrationStepBadge({ mode, step });
  const showPrevious =
    step === "confirm" ||
    (step === "patient" && mode === "new_guardian_patient") ||
    (entryPoint === "global-command" &&
      (step === "guardian" ||
        (step === "patient" && mode === "existing_guardian_patient")));
  const dialogTitle =
    step === "mode"
      ? "신규 등록"
      : step === "guardian"
        ? "신규 보호자 등록"
        : step === "patient"
          ? mode === "existing_guardian_patient"
            ? "기존 보호자에 신규 환자 등록"
            : "신규 환자 등록"
          : "등록 정보 확인";
  const dialogKind = step === "guardian" || step === "patient" ? "form" : "confirm";
  const goPreviousStep = () => {
    if (!showPrevious) return;
    setErrors({});
    if (step === "guardian") setStep("mode");
    if (step === "patient") {
      setStep(mode === "new_guardian_patient" ? "guardian" : "mode");
    }
    if (step === "confirm") setStep("patient");
  };
  const continueRegistration = () => {
    if (step === "mode") goNextFromMode();
    if (step === "guardian") goNextFromGuardian();
    if (step === "patient") goNextFromPatient();
    if (step === "confirm") commitRegistration();
  };
  const patientAgeSummary = patientDraft.birthDate
    ? getAgeTextFromBirthDate(patientDraft.birthDate, registrationReferenceDate)
    : [
        patientDraft.ageYears && `${patientDraft.ageYears}년`,
        patientDraft.ageMonths && `${patientDraft.ageMonths}개월`,
      ]
        .filter(Boolean)
        .join(" ");

  return (
    <>
      {renderTrigger ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={label}
                type="button"
                variant="outline"
                size={size}
                className="px-3 font-semibold"
              />
            }
          >
            <CdsActionsPlusIcon data-icon="inline-start" />
            {label}
            <CdsNavigationChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              className="h-8 cursor-pointer"
              onClick={() => startRegistration("new_guardian_patient")}
            >
              신규 환자/보호자 등록
            </DropdownMenuItem>
            <DropdownMenuItem
              className="h-8 cursor-pointer"
              onClick={() => startRegistration("existing_guardian_patient")}
            >
              기존 보호자에 환자 추가
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <Dialog open={open} onOpenChange={setOpenSafely}>
        <EmrRegistrationDialogShell
          closeAriaLabel="환자/보호자 창 닫기"
          footer={
            <EmrRegistrationFooter
              nextDisabled={submitting}
              nextLabel={step === "confirm" ? (submitting ? "등록 중" : "등록") : "다음"}
              showPrevious={showPrevious}
              onCancel={requestClose}
              onNext={continueRegistration}
              onPrevious={goPreviousStep}
            />
          }
          kind={dialogKind}
          stepLabel={stepBadge}
          title={dialogTitle}
        >
              {step === "mode" ? (
                <RadioGroup
                  aria-label="등록 유형 선택"
                  value={mode}
                  onValueChange={(nextMode) =>
                    setMode(nextMode as RegistrationMode)
                  }
                >
                  <RegistrationModeCard
                    checked={mode === "new_guardian_patient"}
                    value="new_guardian_patient"
                    title="환자/보호자 모두 신규 등록"
                    description="처음 내원한 보호자와 동물을 함께 등록합니다."
                  />
                  <RegistrationModeCard
                    checked={mode === "existing_guardian_patient"}
                    value="existing_guardian_patient"
                    title="기존 보호자에 신규 환자 등록"
                    description="이미 등록된 보호자에게 새 동물을 연결합니다."
                  />
                </RadioGroup>
              ) : null}

              {step === "guardian" ? (
                <>
                  <EmrRegistrationSection separated={false} title="보호자 정보">
                    <EmrRegistrationFieldRow
                      controlId={guardianNameId}
                      error={errors.guardianName}
                      errorId={`${guardianNameId}-error`}
                      label="보호자명"
                      required
                    >
                      <Input
                        id={guardianNameId}
                        aria-describedby={errors.guardianName ? `${guardianNameId}-error` : undefined}
                        aria-invalid={Boolean(errors.guardianName) || undefined}
                        aria-label="보호자명"
                        className={emrRegistrationControlClassName}
                        placeholder="이름을 입력해주세요"
                        value={guardianDraft.name}
                        onValueChange={(name) =>
                          setGuardianDraft((current) => ({ ...current, name }))
                        }
                      />
                    </EmrRegistrationFieldRow>
                    <EmrRegistrationFieldRow
                      controlId={guardianBirthDateId}
                      error={errors.guardianBirthDate}
                      errorId={`${guardianBirthDateId}-error`}
                      label="생년월일"
                      required
                    >
                      <Input
                        id={guardianBirthDateId}
                        aria-describedby={errors.guardianBirthDate ? `${guardianBirthDateId}-error` : undefined}
                        aria-invalid={Boolean(errors.guardianBirthDate) || undefined}
                        aria-label="보호자 생년월일"
                        className={emrRegistrationControlClassName}
                        placeholder="yyyy-MM-dd"
                        value={guardianDraft.birthDate}
                        onValueChange={(birthDate) =>
                          setGuardianDraft((current) => ({
                            ...current,
                            birthDate: formatBirthDateInput(birthDate),
                          }))
                        }
                      />
                    </EmrRegistrationFieldRow>
                  </EmrRegistrationSection>
                  <EmrRegistrationSection title="연락처 및 주소">
                    <EmrRegistrationFieldRow
                      controlId={guardianMobilePhoneId}
                      error={errors.guardianMobilePhone}
                      errorId={`${guardianMobilePhoneId}-error`}
                      label="전화번호"
                      required
                    >
                      <Input
                        id={guardianMobilePhoneId}
                        aria-describedby={errors.guardianMobilePhone ? `${guardianMobilePhoneId}-error` : undefined}
                        aria-invalid={Boolean(errors.guardianMobilePhone) || undefined}
                        aria-label="보호자 휴대전화"
                        className={emrRegistrationControlClassName}
                        inputMode="numeric"
                        placeholder="휴대폰 번호를 입력해주세요"
                        value={guardianDraft.mobilePhone}
                        onValueChange={(mobilePhone) =>
                          setGuardianDraft((current) => ({
                            ...current,
                            mobilePhone: formatKoreanPhoneNumber(mobilePhone),
                          }))
                        }
                      />
                    </EmrRegistrationFieldRow>
                    <EmrRegistrationFieldRow label="이메일">
                      <Input
                        aria-label="이메일"
                        className={emrRegistrationControlClassName}
                        placeholder="example@email.com"
                        value={guardianDraft.email}
                        onValueChange={(email) =>
                          setGuardianDraft((current) => ({ ...current, email }))
                        }
                      />
                    </EmrRegistrationFieldRow>
                    <EmrRegistrationFieldRow label="주소">
                      <EmrRegistrationAddressControls
                        onSearchAddress={guardianAddressSearch.openAddressSearch}
                        postalCode={
                          <Input
                            aria-label="우편번호"
                            className={emrRegistrationControlClassName}
                            inputMode="numeric"
                            placeholder="우편번호"
                            value={guardianDraft.addressPostalCode}
                            onValueChange={(value) =>
                              setGuardianDraft((current) => ({
                                ...current,
                                addressPostalCode: value.replace(/\D/g, "").slice(0, 5),
                              }))
                            }
                          />
                        }
                        road={
                          <Input
                            aria-label="기본 주소"
                            className={emrRegistrationControlClassName}
                            placeholder="도로명 또는 지번 주소 입력"
                            value={guardianDraft.addressRoad}
                            onValueChange={(addressRoad) =>
                              setGuardianDraft((current) => ({ ...current, addressRoad }))
                            }
                          />
                        }
                        detail={
                          <Input
                            aria-label="상세 주소"
                            className={emrRegistrationControlClassName}
                            placeholder="상세 주소 입력"
                            value={guardianDraft.addressDetail}
                            onValueChange={(addressDetail) =>
                              setGuardianDraft((current) => ({ ...current, addressDetail }))
                            }
                          />
                        }
                        searchError={guardianAddressSearch.errorMessage}
                        searchLoading={guardianAddressSearch.isLoading}
                      />
                    </EmrRegistrationFieldRow>
                  </EmrRegistrationSection>
                  <EmrRegistrationSection title="메모 및 개인정보 동의">
                    <EmrRegistrationFieldRow label="보호자 메모">
                      <Textarea
                        aria-label="보호자 메모"
                        className={emrRegistrationTextareaClassName}
                        placeholder="특이사항 및 요청사항 입력"
                        value={guardianDraft.memo}
                        onChange={(event) =>
                          setGuardianDraft((current) => ({
                            ...current,
                            memo: event.target.value,
                          }))
                        }
                      />
                    </EmrRegistrationFieldRow>
                    <EmrRegistrationSignatureConsentCard
                      controlId={privacyConsentId}
                      error={errors.privacyConsent}
                      errorId={`${privacyConsentId}-error`}
                      signatureStatus={guardianDraft.signatureStatus}
                      onCompleteSignature={() =>
                        setGuardianDraft((current) => ({
                          ...current,
                          privacyConsent: true,
                          signatureStatus: "completed",
                        }))
                      }
                      onRequestSignature={() =>
                        setGuardianDraft((current) => ({
                          ...current,
                          signatureStatus: "pending",
                        }))
                      }
                    />
                  </EmrRegistrationSection>
                </>
              ) : null}

              {step === "patient" ? (
                <>
                  {mode === "existing_guardian_patient" ? (
                    <EmrRegistrationSection separated={false} title="보호자 선택">
                      <EmrRegistrationFieldRow
                        controlId={selectedGuardianControlId}
                        error={errors.selectedGuardianId}
                        errorId={`${selectedGuardianControlId}-error`}
                        label="보호자 검색"
                        required
                      >
                        <Popover open={guardianPopoverOpen} onOpenChange={setGuardianPopoverOpen}>
                          <PopoverTrigger
                            nativeButton={false}
                            render={<div className="relative" />}
                          >
                            <CdsActionsSearchIcon
                              aria-hidden="true"
                              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--emr-text-tertiary)]"
                            />
                            <Input
                              id={selectedGuardianControlId}
                              aria-describedby={errors.selectedGuardianId ? `${selectedGuardianControlId}-error` : undefined}
                              aria-invalid={Boolean(errors.selectedGuardianId) || undefined}
                              aria-label="기존 보호자 검색"
                              className={cn(emrRegistrationControlClassName, "pl-9")}
                              placeholder="보호자명 또는 휴대전화 검색"
                              value={guardianQuery}
                              onFocus={() => setGuardianPopoverOpen(true)}
                              onValueChange={(query) => {
                                setGuardianQuery(query);
                                setGuardianPopoverOpen(true);
                                if (selectedGuardian && query !== selectedGuardianSearchDisplay) {
                                  setSelectedGuardianRecordId("");
                                  setPatientDraft((current) => ({
                                    ...current,
                                    existingGuardianId: "",
                                    guardianMobilePhone: "",
                                    guardianName: "",
                                  }));
                                }
                              }}
                            />
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            className="max-h-72 w-[var(--anchor-width)] gap-1 overflow-y-auto p-1.5"
                            initialFocus={false}
                          >
                            <div role="listbox" aria-label="기존 보호자 목록" className="grid gap-1">
                              {lookupStatus === "idle" || lookupStatus === "loading" ? (
                                <div className="px-2.5 py-2 emr-text-metadata text-muted-foreground">
                                  보호자 정보를 불러오는 중입니다.
                                </div>
                              ) : lookupStatus === "error" ? (
                                <div className="flex items-center justify-between gap-3 px-2.5 py-2 emr-text-metadata text-muted-foreground">
                                  <span>보호자 정보를 불러오지 못했습니다.</span>
                                  <Button
                                    size="xs"
                                    type="button"
                                    variant="outline"
                                    onClick={() => setLookupRetryKey((current) => current + 1)}
                                  >
                                    다시 시도
                                  </Button>
                                </div>
                              ) : guardianMatches.length ? (
                                guardianMatches.map((guardian) => {
                                  const guardianDisplay = getGuardianSearchDisplay(
                                    guardian,
                                    lookupPatients,
                                    lookupPatientGuardians
                                  );

                                  return (
                                    <button
                                      key={guardian.id}
                                      type="button"
                                      role="option"
                                      aria-selected={selectedGuardianRecordId === guardian.id}
                                      className={cn(
                                        "flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[var(--emr-state-hover)]",
                                        selectedGuardianRecordId === guardian.id &&
                                          "bg-[var(--emr-state-selected)] text-[var(--emr-status-info-text)]"
                                      )}
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => {
                                        setGuardianQuery(guardianDisplay);
                                        setSelectedGuardianRecordId(guardian.id);
                                        setPatientDraft((current) => ({
                                          ...current,
                                          existingGuardianId: guardian.id,
                                          guardianMobilePhone: guardian.mobilePhone ?? "",
                                          guardianName: guardian.name,
                                        }));
                                        setErrors((current) => ({
                                          ...current,
                                          selectedGuardianId: undefined,
                                        }));
                                        setGuardianPopoverOpen(false);
                                      }}
                                    >
                                      <span className="min-w-0 truncate">
                                        <span className="emr-text-dense font-semibold">
                                          {guardian.name}
                                        </span>
                                        <span className="ml-1 emr-text-metadata text-muted-foreground">
                                          {guardian.mobilePhone ?? "연락처 미입력"} ·{" "}
                                          {getGuardianPatientSummary(
                                            guardian.id,
                                            lookupPatients,
                                            lookupPatientGuardians
                                          )}
                                        </span>
                                      </span>
                                      <Badge variant={selectedGuardianRecordId === guardian.id ? "default" : "outline"}>
                                        {selectedGuardianRecordId === guardian.id ? "선택됨" : "기존 보호자"}
                                      </Badge>
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="px-2.5 py-2 emr-text-metadata text-muted-foreground">
                                  일치하는 보호자가 없습니다.
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </EmrRegistrationFieldRow>
                      {selectedGuardian ? (
                        <details className="group rounded-lg border bg-[var(--emr-surface-muted)] p-3" open>
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 emr-text-dense font-semibold text-foreground">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate">
                                {selectedGuardian.name} 보호자의 동물
                              </span>
                              <Badge variant="outline" className="shrink-0">
                                {selectedGuardianPatients.length}마리
                              </Badge>
                            </span>
                            <CdsNavigationChevronDownIcon
                              className="size-4 shrink-0 text-[var(--emr-text-tertiary)] transition-transform group-open:rotate-180"
                              aria-hidden="true"
                            />
                          </summary>
                          <div className="mt-3 grid gap-2">
                            {selectedGuardianPatients.length ? (
                              selectedGuardianPatients.map((patient) => (
                                <div
                                  key={patient.id}
                                  className="flex min-w-0 items-center gap-2 rounded-md border bg-card px-3 py-2"
                                >
                                  <span className="shrink-0 emr-text-dense font-semibold text-foreground">
                                    {patient.name}
                                  </span>
                                  <span className="truncate emr-text-metadata text-muted-foreground">
                                    {[patient.breed, getPatientSexLabel(patient), getPatientDisplayAge(patient)]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-md border bg-card px-3 py-2 emr-text-metadata text-muted-foreground">
                                연결된 동물이 없습니다.
                              </div>
                            )}
                          </div>
                        </details>
                      ) : null}
                    </EmrRegistrationSection>
                  ) : null}
                  <EmrRegistrationSection
                    separated={mode === "existing_guardian_patient"}
                    title="환자 정보"
                  >
                    <EmrRegistrationFieldRow
                      controlId={patientNameId}
                      error={errors.patientName}
                      errorId={`${patientNameId}-error`}
                      label="환자명"
                      required
                    >
                      <Input
                        id={patientNameId}
                        aria-describedby={errors.patientName ? `${patientNameId}-error` : undefined}
                        aria-invalid={Boolean(errors.patientName) || undefined}
                        aria-label="환자명"
                        className={emrRegistrationControlClassName}
                        placeholder="환자명을 입력해주세요"
                        value={patientDraft.name}
                        onValueChange={(name) =>
                          setPatientDraft((current) => ({ ...current, name }))
                        }
                      />
                    </EmrRegistrationFieldRow>
                    <EmrRegistrationFieldRow label="종류" required>
                      <Select
                        value={patientDraft.species}
                        onValueChange={(species) =>
                          setPatientDraft((current) => {
                            const nextSpecies = species as Species;
                            const mixBreed = getMixBreedSuggestion(nextSpecies);

                            return {
                              ...current,
                              breed:
                                current.isMixed && mixBreed ? mixBreed : current.breed,
                              species: nextSpecies,
                            };
                          })
                        }
                      >
                        <SelectTrigger aria-label="종" className="w-full bg-card">
                          <span className="flex flex-1 text-left">
                            {getNewPatientSpeciesLabel(patientDraft.species)}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {newPatientSpeciesOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EmrRegistrationFieldRow>
                    <EmrRegistrationFieldRow
                      controlId={patientBreedId}
                      error={errors.breed}
                      errorId={`${patientBreedId}-error`}
                      label="품종"
                      required
                    >
                      <EmrRegistrationInlineControl
                        className="grid grid-cols-[minmax(0,206px)_50px]"
                        control={
                          <EmrRegistrationCheckboxLabel
                            control={
                              <Checkbox
                                checked={patientDraft.isMixed}
                                onCheckedChange={(isMixed) =>
                                  setPatientDraft((current) => ({
                                    ...current,
                                    breed: Boolean(isMixed)
                                      ? getMixBreedSuggestion(current.species) || current.breed
                                      : current.breed,
                                    isMixed: Boolean(isMixed),
                                  }))
                                }
                              />
                            }
                          >
                            믹스
                          </EmrRegistrationCheckboxLabel>
                        }
                      >
                        <BreedAutocomplete
                          id={patientBreedId}
                          ariaDescribedBy={errors.breed ? `${patientBreedId}-error` : undefined}
                          ariaInvalid={Boolean(errors.breed)}
                          ariaLabel="품종"
                          className={emrRegistrationControlClassName}
                          placeholder="주 품종을 선택해주세요"
                          species={patientDraft.species}
                          value={patientDraft.breed}
                          onValueChange={(breed) =>
                            setPatientDraft((current) => ({ ...current, breed }))
                          }
                        />
                      </EmrRegistrationInlineControl>
                    </EmrRegistrationFieldRow>
                    <EmrRegistrationFieldRow label="성별" required>
                      <Select
                        value={patientDraft.sex}
                        onValueChange={(sex) =>
                          setPatientDraft((current) => ({
                            ...current,
                            sex: sex as NewPatientSexValue,
                          }))
                        }
                      >
                        <SelectTrigger aria-label="성별" className="w-full bg-card">
                          <span className="flex flex-1 text-left">
                            {getNewPatientSexLabel(patientDraft.sex)}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {newPatientSexOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EmrRegistrationFieldRow>
                    {patientDraft.isMixed ? (
                      <EmrRegistrationFieldRow label="추가 품종">
                        <BreedMultiSelect
                          ariaLabel="추가 품종"
                          className="min-h-[var(--clair-control-height-md)] bg-card"
                          placeholder="믹스의 경우 추가 품종을 선택해주세요"
                          species={patientDraft.species}
                          value={patientDraft.additionalBreed}
                          onValueChange={(additionalBreed) =>
                            setPatientDraft((current) => ({ ...current, additionalBreed }))
                          }
                        />
                      </EmrRegistrationFieldRow>
                    ) : null}
                  </EmrRegistrationSection>
                  <EmrRegistrationSection
                    title={
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span>추가 정보</span>
                        <span className="truncate font-normal text-[var(--emr-text-tertiary)]">
                          · 나이 또는 생년월일 중 하나 필수
                        </span>
                      </span>
                    }
                  >
                    <EmrRegistrationFieldRow
                      controlId={patientAgeYearsId}
                      error={errors.age}
                      errorId={`${patientAgeYearsId}-error`}
                      label="나이"
                    >
                      <EmrRegistrationAgeControls
                        years={
                          <AgePartInput
                            id={patientAgeYearsId}
                            ariaDescribedBy={errors.age ? `${patientAgeYearsId}-error` : undefined}
                            ariaInvalid={Boolean(errors.age)}
                            ariaLabel="나이 년"
                            inputClassName="h-[var(--clair-control-height-md)]"
                            unit="년"
                            value={patientDraft.ageYears}
                            onValueChange={(ageYears) =>
                              setPatientDraft((current) => ({
                                ...current,
                                ageYears,
                                birthDate: getBirthDateFromAge({
                                  months: current.ageMonths,
                                  referenceDate: registrationReferenceDate,
                                  years: ageYears,
                                }),
                              }))
                            }
                          />
                        }
                        months={
                          <AgePartInput
                            ariaDescribedBy={errors.age ? `${patientAgeYearsId}-error` : undefined}
                            ariaInvalid={Boolean(errors.age)}
                            ariaLabel="나이 개월"
                            inputClassName="h-[var(--clair-control-height-md)]"
                            unit="개월"
                            value={patientDraft.ageMonths}
                            onValueChange={(ageMonths) =>
                              setPatientDraft((current) => ({
                                ...current,
                                ageMonths,
                                birthDate: getBirthDateFromAge({
                                  months: ageMonths,
                                  referenceDate: registrationReferenceDate,
                                  years: current.ageYears,
                                }),
                              }))
                            }
                          />
                        }
                        estimate={
                          <EmrRegistrationCheckboxLabel
                            control={
                              <Checkbox
                                checked={patientDraft.estimatedAge}
                                onCheckedChange={(estimatedAge) =>
                                  setPatientDraft((current) => ({
                                    ...current,
                                    estimatedAge: Boolean(estimatedAge),
                                  }))
                                }
                              />
                            }
                          >
                            추정
                          </EmrRegistrationCheckboxLabel>
                        }
                      />
                    </EmrRegistrationFieldRow>
                    <EmrRegistrationFieldRow
                      controlId={patientBirthDateId}
                      error={errors.birthDate}
                      errorId={`${patientBirthDateId}-error`}
                      label="생년월일"
                    >
                      <Input
                        id={patientBirthDateId}
                        aria-describedby={errors.birthDate ? `${patientBirthDateId}-error` : undefined}
                        aria-invalid={Boolean(errors.birthDate) || undefined}
                        aria-label="생년월일"
                        className={emrRegistrationControlClassName}
                        placeholder="YYYY-MM-DD"
                        value={patientDraft.birthDate}
                        onValueChange={(birthDate) =>
                          setPatientDraft((current) => ({
                            ...current,
                            ageMonths: "",
                            ageYears: "",
                            birthDate: formatBirthDateInput(birthDate),
                          }))
                        }
                      />
                    </EmrRegistrationFieldRow>
                    <EmrRegistrationFieldRow error={errors.microchipNo} label="마이크로칩">
                      <Input
                        aria-label="마이크로칩"
                        className={emrRegistrationControlClassName}
                        inputMode="numeric"
                        placeholder="15자리 마이크로칩 번호"
                        value={patientDraft.microchipNo}
                        onValueChange={(microchipNo) =>
                          setPatientDraft((current) => ({ ...current, microchipNo }))
                        }
                      />
                    </EmrRegistrationFieldRow>
                    <EmrRegistrationFieldRow label="동물등록번호">
                      <Input
                        aria-label="동물등록번호"
                        className={emrRegistrationControlClassName}
                        placeholder="동물등록번호"
                        value={patientDraft.patientRegistrationNo}
                        onValueChange={(patientRegistrationNo) =>
                          setPatientDraft((current) => ({
                            ...current,
                            patientRegistrationNo,
                          }))
                        }
                      />
                    </EmrRegistrationFieldRow>
                  </EmrRegistrationSection>
                  <EmrRegistrationSection title="메모">
                    <EmrRegistrationFieldRow label="환자 메모">
                      <Textarea
                        aria-label="환자 메모"
                        className={emrRegistrationTextareaClassName}
                        placeholder="특이사항 및 요청사항 입력"
                        value={patientDraft.specialNote}
                        onChange={(event) =>
                          setPatientDraft((current) => ({
                            ...current,
                            specialNote: event.target.value,
                          }))
                        }
                      />
                    </EmrRegistrationFieldRow>
                    {duplicatePatientName ? (
                      <div className="rounded-lg border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] p-3 emr-text-metadata font-medium text-[var(--emr-status-warning-text)]">
                        동일 보호자 아래 같은 이름의 동물이 이미 등록되어 있습니다. 실제 중복 여부를 확인해 주세요.
                      </div>
                    ) : null}
                  </EmrRegistrationSection>
                </>
              ) : null}

              {step === "confirm" ? (
                <EmrRegistrationSection
                  separated={false}
                  title={
                    mode === "new_guardian_patient"
                      ? "신규 보호자/환자"
                      : "기존 보호자/신규 환자"
                  }
                >
                  <EmrRegistrationSummaryItem
                    badgeLabel={mode === "new_guardian_patient" ? "신규" : "기존"}
                    badgeTone={mode === "new_guardian_patient" ? "primary" : "neutral"}
                    details={[
                      mode === "new_guardian_patient"
                        ? guardianDraft.birthDate || "생년월일 미입력"
                        : selectedGuardianPatientCount
                          ? `연결 환자 ${selectedGuardianPatientCount}마리`
                          : "연결 환자 없음",
                      mode === "new_guardian_patient"
                        ? guardianDraft.mobilePhone
                        : selectedGuardian?.mobilePhone ?? "연락처 미입력",
                    ]}
                    icon={<UserIcon className="size-[22px]" />}
                    title={
                      mode === "new_guardian_patient"
                        ? guardianDraft.name
                        : selectedGuardian?.name ?? "보호자 미지정"
                    }
                  />
                  <EmrRegistrationSummaryItem
                    details={[
                      getNewPatientSpeciesLabel(patientDraft.species),
                      patientDraft.breed || "품종 미입력",
                      patientAgeSummary || "나이 미입력",
                      ...(patientDraft.sex === "unknown" ? [] : [getNewPatientSexLabel(patientDraft.sex)]),
                    ]}
                    icon={<BoneIcon className="size-[22px]" />}
                    title={patientDraft.name}
                  />
                </EmrRegistrationSection>
              ) : null}
        </EmrRegistrationDialogShell>
      </Dialog>

      <Dialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <EmrConfirmDialogContent
          title="입력을 취소할까요?"
          description="작성 중인 내용은 저장되지 않습니다."
          cancelLabel="계속 작성"
          confirmLabel="취소하고 나가기"
          closeAriaLabel="입력 취소 확인 닫기"
          motion="none"
          onCancel={() => setConfirmCloseOpen(false)}
          onConfirm={closeWithoutSaving}
          overlayClassName={emrRegistrationDialogOverlayClassName}
        />
      </Dialog>
    </>
  );
}

export const NewUnifiedRegistrationButton = PatientGuardianRegistrationButton;

export function NewGuardianButton({
  label = "보호자 등록",
}: {
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-label={label}
        variant="outline"
        size="sm"
        className="bg-card px-3 font-semibold"
        onClick={() => setOpen(true)}
      >
        <UserIcon
          data-icon="inline-start"
          className="size-3 text-[var(--emr-text-tertiary)]"
        />
        {label}
      </Button>
      <NewGuardianDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function NewPatientButton({
  label = "신규 환자",
  variant = "icon",
}: {
  label?: string;
  variant?: "icon" | "text";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-label={label}
        variant={variant === "icon" ? "ghost" : "outline"}
        size={variant === "icon" ? "icon-sm" : "sm"}
        className={cn(variant === "text" && "bg-card px-3 font-semibold")}
        onClick={() => setOpen(true)}
      >
        {variant === "text" ? (
          <BoneIcon
            data-icon="inline-start"
            className="size-3 text-[var(--emr-text-tertiary)]"
          />
        ) : (
          <CdsActionsPlusIcon />
        )}
        {variant === "text" ? label : null}
      </Button>
      <NewPatientDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
