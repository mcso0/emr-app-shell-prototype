"use client";

import { useMemo, useState } from "react";
import {
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsNavigationExternalLinkIcon } from "@/components/cds-icons/navigation";
import { BoneIcon, UserIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field as FormField,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LineTabs } from "@/components/ui/line-tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getGuardianDisplay,
  getPatientDisplayAge,
  getPatientSexLabel,
  getSpeciesLabel,
} from "@/features/reception/data";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { cn } from "@/lib/utils";
import {
  getMockGuardianBundle,
  getMockLatestWorkShortcutsForPatient,
  getMockPatientBundle,
  mockCsHistories,
  mockStaffUsers,
} from "@/mocks/emr-domain";
import { useLayoutStore } from "@/stores/layout-store";
import type {
  CsHistoryChannel,
  CsHistoryEntry,
  EmrId,
  Encounter,
  Guardian,
  Appointment,
  LatestWorkShortcut,
  Patient,
  PatientGuardian,
  PatientSex,
  Species,
} from "@/types/emr-domain";

type PatientProfileBundle = {
  activeEncounter?: Encounter;
  latestAppointment?: Appointment;
  patient: Patient;
  guardians: Guardian[];
  patientGuardians: PatientGuardian[];
  primaryGuardian?: Guardian;
  csHistories: CsHistoryEntry[];
  latestWorkShortcuts: LatestWorkShortcut[];
};

type GuardianProfileBundle = {
  guardian: Guardian;
  patients: Patient[];
  patientGuardians: PatientGuardian[];
  csHistories: typeof mockCsHistories;
  latestWorkShortcuts: LatestWorkShortcut[];
};

const profileTabs = [
  { value: "summary" as const, label: "기본" },
  { value: "cs" as const, label: "CS 이력" },
  { value: "latest" as const, label: "최신내역" },
];

const csTabs = [
  { value: "call" as const, label: "전화/응대" },
  { value: "kakao" as const, label: "KakaoTalk" },
];

type ProfileTab = (typeof profileTabs)[number]["value"];
type CsTab = (typeof csTabs)[number]["value"];

const getShortDateTime = (dateTime?: string) =>
  dateTime ? dateTime.slice(2, 16).replace("T", " ") : "-";

const getChannelLabel = (channel: CsHistoryChannel) => {
  if (channel === "phone") return "전화";
  if (channel === "kakao_alimtalk") return "카카오";
  if (channel === "sms") return "문자";
  return "방문";
};

const getStaffDisplayName = (userId?: EmrId) =>
  userId ? mockStaffUsers.find((user) => user.id === userId)?.name : undefined;

const newPatientSpeciesOptions: Array<{ label: string; value: Species }> = [
  { label: "강아지", value: "dog" },
  { label: "고양이", value: "cat" },
  { label: "기타", value: "other" },
];

const newPatientSexOptions: Array<{ label: string; value: PatientSex }> = [
  { label: "미상", value: "unknown" },
  { label: "수컷", value: "male" },
  { label: "암컷", value: "female" },
];

const getNewPatientSpeciesLabel = (species: Species) =>
  newPatientSpeciesOptions.find((option) => option.value === species)?.label ?? "종류 선택";

const getNewPatientSexLabel = (sex: PatientSex) =>
  newPatientSexOptions.find((option) => option.value === sex)?.label ?? "성별 선택";

const getPatientVisitReason = (bundle: PatientProfileBundle) =>
  bundle.activeEncounter?.chiefComplaint ??
  bundle.latestAppointment?.symptomNote ??
  bundle.latestAppointment?.visitPurpose ??
  bundle.patient.specialNote ??
  "내원 목적 확인";

const getPatientVisitSummary = (bundle: PatientProfileBundle) => {
  const time = bundle.activeEncounter?.checkedInAt
    ? `${getShortDateTime(bundle.activeEncounter.checkedInAt)} 접수`
    : bundle.latestAppointment?.scheduledStartAt
      ? `${getShortDateTime(bundle.latestAppointment.scheduledStartAt)} 예약`
      : "오늘 내원";
  const veterinarianName =
    getStaffDisplayName(bundle.activeEncounter?.primaryVeterinarianId) ??
    getStaffDisplayName(bundle.latestAppointment?.assignedVeterinarianId) ??
    "담당의 미지정";
  const encounterNo = bundle.activeEncounter?.encounterNo ?? "encounter 생성 전";

  return `${time} · ${veterinarianName} · ${encounterNo}`;
};

const getProfileBundle = (
  patientId: EmrId,
  patients: Patient[],
  guardians: Guardian[],
  patientGuardians: PatientGuardian[]
): PatientProfileBundle | null => {
  const patient = patients.find((item) => item.id === patientId);

  if (!patient) return null;

  const baseBundle = getMockPatientBundle(patientId);
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
  const latestAppointment = baseBundle?.appointments.at(-1);

  return {
    activeEncounter,
    latestAppointment,
    patient,
    guardians: linkedGuardians,
    patientGuardians: links,
    primaryGuardian,
    csHistories:
      baseBundle?.csHistories ??
      mockCsHistories.filter(
        (entry) => entry.patientId === patientId || Boolean(entry.guardianId && guardianIds.has(entry.guardianId))
      ),
    latestWorkShortcuts:
      baseBundle?.latestWorkShortcuts ?? getMockLatestWorkShortcutsForPatient(patientId),
  };
};

const getGuardianProfileBundle = (
  guardianId: EmrId,
  patients: Patient[],
  guardians: Guardian[],
  patientGuardians: PatientGuardian[]
): GuardianProfileBundle | null => {
  const guardian = guardians.find((item) => item.id === guardianId);

  if (!guardian) return null;

  const baseBundle = getMockGuardianBundle(guardianId);
  const links = patientGuardians.filter((link) => link.guardianId === guardianId);
  const patientIds = new Set(links.map((link) => link.patientId));
  const linkedPatients = patients.filter((patient) => patientIds.has(patient.id));

  return {
    guardian,
    patients: linkedPatients,
    patientGuardians: links,
    csHistories:
      baseBundle?.csHistories ??
      mockCsHistories.filter(
        (entry) => entry.guardianId === guardianId || Boolean(entry.patientId && patientIds.has(entry.patientId))
      ),
    latestWorkShortcuts:
      baseBundle?.latestWorkShortcuts ??
      linkedPatients.flatMap((patient) => getMockLatestWorkShortcutsForPatient(patient.id)),
  };
};

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function RegistrationFormField({
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
        <FieldLabel className="text-[14px] font-bold leading-5 text-[var(--clair-color-label-strong)]">
          {label}
          {required ? (
            <span className="ml-1 text-[var(--clair-color-primary-normal)]">*</span>
          ) : null}
        </FieldLabel>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
      {children}
      {error ? <FieldError className="text-[12px] leading-4">{error}</FieldError> : null}
      {helper ? (
        <FieldDescription className="text-[12px] font-medium leading-4">
          {helper}
        </FieldDescription>
      ) : null}
    </FormField>
  );
}

function RegistrationFormSection({
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
      {separated ? <FieldSeparator className="my-0" /> : null}
      <FieldSet className={cn("gap-0", className)}>
        <FieldLegend className="mb-3 text-[13px] font-bold leading-5 text-[var(--clair-color-atomic-gray-400)]">
          {title}
        </FieldLegend>
        <FieldGroup className="gap-5">{children}</FieldGroup>
      </FieldSet>
    </>
  );
}

function ProfileHeader({
  meta,
  title,
  onEdit,
  editing,
}: {
  editing: boolean;
  meta: string;
  title: string;
  onEdit: () => void;
}) {
  return (
    <section className="rounded-lg border bg-[var(--clair-color-background-surface)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[18px] font-semibold">{title}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">{meta}</div>
        </div>
        <Button size="sm" variant="outline" onClick={onEdit}>
          {editing ? "취소" : "수정"}
        </Button>
      </div>
    </section>
  );
}

function CsHistoryTable({
  entries,
}: {
  entries: PatientProfileBundle["csHistories"];
}) {
  const [csTab, setCsTab] = useState<CsTab>("call");
  const visibleEntries = entries.filter((entry) =>
    csTab === "kakao" ? entry.channel === "kakao_alimtalk" : entry.channel !== "kakao_alimtalk"
  );

  return (
    <section className="flex flex-col gap-3">
      <LineTabs
        aria-label="CS 이력 유형"
        value={csTab}
        items={csTabs}
        itemClassName="text-[13px]"
        onValueChange={setCsTab}
      />
      <div className="overflow-hidden rounded-lg border">
        {visibleEntries.length ? (
          visibleEntries.map((entry) => (
            <div key={entry.id} className="border-b p-3 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{entry.category}</div>
                <Badge variant="outline">{getStatusLabel("csHistory", entry.status)}</Badge>
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                {getChannelLabel(entry.channel)} · {entry.direction === "inbound" ? "수신" : "발신"} ·{" "}
                {getShortDateTime(entry.occurredAt)}
              </div>
              <p className="mt-2 text-[13px] leading-5">{entry.summary}</p>
            </div>
          ))
        ) : (
          <div className="p-4 text-[13px] text-muted-foreground">표시할 CS 이력이 없습니다.</div>
        )}
      </div>
    </section>
  );
}

function LatestWorkGrid({
  shortcuts,
}: {
  shortcuts: LatestWorkShortcut[];
}) {
  return (
    <section className="grid grid-cols-2 gap-2">
      {shortcuts.map((shortcut) => {
        const content = (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{shortcut.title}</div>
              {shortcut.enabled ? <CdsNavigationExternalLinkIcon className="size-3" /> : null}
            </div>
            <div className="mt-1 line-clamp-2 min-h-8 text-[12px] text-muted-foreground">
              {shortcut.description}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {getShortDateTime(shortcut.occurredAt)}
            </div>
          </>
        );

        if (shortcut.enabled && shortcut.href) {
          return (
            <a
              key={shortcut.id}
              href={shortcut.href}
              className="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-[var(--clair-color-background-surface)]"
            >
              {content}
            </a>
          );
        }

        return (
          <button
            key={shortcut.id}
            type="button"
            disabled
            className="rounded-lg border bg-card p-3 text-left opacity-70"
          >
            {content}
          </button>
        );
      })}
    </section>
  );
}

function PatientVisitContextCard({ bundle }: { bundle: PatientProfileBundle }) {
  const reason = getPatientVisitReason(bundle);
  const summary = getPatientVisitSummary(bundle);
  const guardianName = bundle.primaryGuardian?.name ?? "보호자 미지정";

  return (
    <section className="rounded-lg border border-[var(--clair-color-atomic-sky-100)] bg-[var(--clair-color-atomic-sky-50)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-[var(--clair-color-primary-normal)]">
            오늘 내원 맥락
          </div>
          <div className="mt-1 text-[14px] font-semibold text-[var(--clair-color-label-strong)]">
            {guardianName} 보호자가 {bundle.patient.name}를 {reason}로 접수
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">{summary}</div>
        </div>
        <Badge variant="outline" className="bg-card">
          session-only
        </Badge>
      </div>
    </section>
  );
}

function PatientSummaryFields({
  bundle,
  draft,
  editing,
  onDraftChange,
}: {
  bundle: PatientProfileBundle;
  draft: Pick<Patient, "allergyNote" | "breed" | "handlingCautionNote" | "microchipNo" | "name" | "specialNote">;
  editing: boolean;
  onDraftChange: (patch: Partial<typeof draft>) => void;
}) {
  const patient = bundle.patient;

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
        <Input
          value={draft.breed ?? ""}
          readOnly={!editing}
          className="h-9 bg-card"
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
          value={getGuardianDisplay(bundle.primaryGuardian)}
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

function GuardianLinkList({ bundle }: { bundle: PatientProfileBundle }) {
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const setPrimaryGuardian = usePatientProfileStore((state) => state.setPrimaryGuardian);
  const toggleGuardianMessageConsent = usePatientProfileStore(
    (state) => state.toggleGuardianMessageConsent
  );

  return (
    <section className="flex flex-col gap-2">
      <div className="text-[13px] font-semibold">보호자 연결</div>
      {bundle.guardians.map((guardian) => {
        const link = bundle.patientGuardians.find((item) => item.guardianId === guardian.id);

        return (
          <div key={guardian.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{guardian.name}</span>
                  {link?.isPrimary ? <Badge>주보호자</Badge> : <Badge variant="outline">연결</Badge>}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {guardian.mobilePhone ?? "연락처 미입력"} · {link?.relationship ?? "관계 미입력"}
                </div>
              </div>
              <Button
                aria-label={`보호자 ${guardian.name} 보기`}
                size="sm"
                variant="ghost"
                onClick={() => setActiveDrawer({ type: "reception-guardian", id: guardian.id })}
              >
                보기
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={link?.isPrimary}
                onClick={() => setPrimaryGuardian(bundle.patient.id, guardian.id)}
              >
                주보호자 지정
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleGuardianMessageConsent(bundle.patient.id, guardian.id)}
              >
                {link?.canReceiveMessages ? "수신 중지" : "수신 허용"}
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function PatientProfileDrawer({ patientId }: { patientId: EmrId }) {
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const updatePatient = usePatientProfileStore((state) => state.updatePatient);
  const bundle = useMemo(
    () => getProfileBundle(patientId, patients, guardians, patientGuardians),
    [guardians, patientGuardians, patientId, patients]
  );
  const [activeTab, setActiveTab] = useState<ProfileTab>("summary");
  const [editing, setEditing] = useState(false);
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

  if (!bundle) {
    return <div className="p-4 text-[13px] text-muted-foreground">환자 정보를 찾을 수 없습니다.</div>;
  }

  const beginEdit = () => {
    setDraft({
      allergyNote: bundle.patient.allergyNote ?? "",
      breed: bundle.patient.breed ?? "",
      handlingCautionNote: bundle.patient.handlingCautionNote ?? "",
      microchipNo: bundle.patient.microchipNo ?? "",
      name: bundle.patient.name,
      specialNote: bundle.patient.specialNote ?? "",
    });
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => {
    updatePatient(bundle.patient.id, {
      allergyNote: draft.allergyNote || undefined,
      breed: draft.breed || undefined,
      handlingCautionNote: draft.handlingCautionNote || undefined,
      microchipNo: draft.microchipNo || undefined,
      name: draft.name,
      specialNote: draft.specialNote || undefined,
    });
    setEditing(false);
  };

  return (
    <div className="flex h-[calc(100%-48px)] flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          <ProfileHeader
            editing={editing}
            title={bundle.patient.name}
            meta={`${bundle.patient.patientNo} · ${getSpeciesLabel(bundle.patient)} · ${getPatientDisplayAge(bundle.patient)}`}
            onEdit={editing ? cancelEdit : beginEdit}
          />
          <LineTabs
            aria-label="환자 정보 탭"
            value={activeTab}
            items={profileTabs}
            itemClassName="text-[13px]"
            onValueChange={setActiveTab}
          />
          {activeTab === "summary" ? (
            <>
              <PatientVisitContextCard bundle={bundle} />
              <PatientSummaryFields
                bundle={bundle}
                draft={editing ? draft : {
                  allergyNote: bundle.patient.allergyNote ?? "",
                  breed: bundle.patient.breed ?? "",
                  handlingCautionNote: bundle.patient.handlingCautionNote ?? "",
                  microchipNo: bundle.patient.microchipNo ?? "",
                  name: bundle.patient.name,
                  specialNote: bundle.patient.specialNote ?? "",
                }}
                editing={editing}
                onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
              />
              <GuardianLinkList bundle={bundle} />
            </>
          ) : null}
          {activeTab === "cs" ? <CsHistoryTable entries={bundle.csHistories} /> : null}
          {activeTab === "latest" ? (
            <LatestWorkGrid shortcuts={bundle.latestWorkShortcuts} />
          ) : null}
        </div>
      </ScrollArea>
      {editing ? (
        <div className="flex justify-end gap-2 border-t bg-card p-4">
          <Button variant="outline" onClick={cancelEdit}>취소</Button>
          <Button onClick={saveEdit}>저장</Button>
        </div>
      ) : null}
    </div>
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
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const updateGuardian = usePatientProfileStore((state) => state.updateGuardian);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const bundle = useMemo(
    () => getGuardianProfileBundle(guardianId, patients, guardians, patientGuardians),
    [guardianId, guardians, patientGuardians, patients]
  );
  const [activeTab, setActiveTab] = useState<ProfileTab>("summary");
  const [editing, setEditing] = useState(false);
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

  if (!bundle) {
    return <div className="p-4 text-[13px] text-muted-foreground">보호자 정보를 찾을 수 없습니다.</div>;
  }

  const beginEdit = () => {
    setDraft({
      address: bundle.guardian.address ?? "",
      email: bundle.guardian.email ?? "",
      memo: bundle.guardian.memo ?? "",
      mobilePhone: bundle.guardian.mobilePhone ?? "",
      name: bundle.guardian.name,
      phone: bundle.guardian.phone ?? "",
    });
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => {
    updateGuardian(bundle.guardian.id, {
      address: draft.address || undefined,
      email: draft.email || undefined,
      memo: draft.memo || undefined,
      mobilePhone: draft.mobilePhone || undefined,
      name: draft.name,
      phone: draft.phone || undefined,
    });
    setEditing(false);
  };

  return (
    <div className="flex h-[calc(100%-48px)] flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          <ProfileHeader
            editing={editing}
            title={bundle.guardian.name}
            meta={bundle.guardian.mobilePhone ?? "연락처 미입력"}
            onEdit={editing ? cancelEdit : beginEdit}
          />
          <LineTabs
            aria-label="보호자 정보 탭"
            value={activeTab}
            items={profileTabs}
            itemClassName="text-[13px]"
            onValueChange={setActiveTab}
          />
          {activeTab === "summary" ? (
            <>
              <GuardianSummaryFields
                draft={editing ? draft : {
                  address: bundle.guardian.address ?? "",
                  email: bundle.guardian.email ?? "",
                  memo: bundle.guardian.memo ?? "",
                  mobilePhone: bundle.guardian.mobilePhone ?? "",
                  name: bundle.guardian.name,
                  phone: bundle.guardian.phone ?? "",
                }}
                editing={editing}
                onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
              />
              <section className="flex flex-col gap-2">
                <div className="text-[13px] font-semibold">연결 환자</div>
                {bundle.patients.map((patient) => {
                  const link = bundle.patientGuardians.find((item) => item.patientId === patient.id);

                  return (
                    <button
                      key={patient.id}
                      type="button"
                      className="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-[var(--clair-color-background-surface)]"
                      onClick={() => setActiveDrawer({ type: "reception-patient", id: patient.id })}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{patient.name}</span>
                        {link?.isPrimary ? <Badge>주보호자</Badge> : <Badge variant="outline">연결</Badge>}
                      </div>
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {patient.patientNo} · {getSpeciesLabel(patient)} · {getPatientDisplayAge(patient)}
                      </div>
                    </button>
                  );
                })}
              </section>
            </>
          ) : null}
          {activeTab === "cs" ? <CsHistoryTable entries={bundle.csHistories} /> : null}
          {activeTab === "latest" ? (
            <LatestWorkGrid shortcuts={bundle.latestWorkShortcuts} />
          ) : null}
        </div>
      </ScrollArea>
      {editing ? (
        <div className="flex justify-end gap-2 border-t bg-card p-4">
          <Button variant="outline" onClick={cancelEdit}>취소</Button>
          <Button onClick={saveEdit}>저장</Button>
        </div>
      ) : null}
    </div>
  );
}

export function NewPatientDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const addPatient = usePatientProfileStore((state) => state.addPatient);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    additionalBreed: "",
    ageDays: "",
    ageMonths: "",
    ageYears: "",
    breed: "",
    color: "",
    estimatedAge: false,
    guardianMobilePhone: "",
    guardianName: "",
    isMixed: false,
    microchipNo: "",
    microchipStatus: "미선택",
    name: "",
    patientRegistrationNo: "",
    primaryVeterinarianId: "",
    sex: "unknown" as PatientSex,
    species: "dog" as Species,
    specialNote: "",
    weight: "",
  });

  const reset = () => {
    setDraft({
      additionalBreed: "",
      ageDays: "",
      ageMonths: "",
      ageYears: "",
      breed: "",
      color: "",
      estimatedAge: false,
      guardianMobilePhone: "",
      guardianName: "",
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
    setError("");
  };
  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) reset();
  };
  const save = () => {
    const ageParts = [
      draft.ageYears ? `${draft.ageYears}년` : "",
      draft.ageMonths ? `${draft.ageMonths}개월` : "",
      draft.ageDays ? `${draft.ageDays}일` : "",
    ].filter(Boolean);
    const result = addPatient({
      breed: draft.isMixed && draft.additionalBreed
        ? `${draft.breed.trim()} 믹스`
        : draft.breed,
      estimatedAgeText: ageParts.length
        ? `${ageParts.join(" ")}${draft.estimatedAge ? " 추정" : ""}`
        : undefined,
      guardianMobilePhone: draft.guardianMobilePhone,
      guardianName: draft.guardianName,
      microchipNo: draft.microchipNo,
      name: draft.name,
      sex: draft.sex,
      species: draft.species,
      specialNote: draft.specialNote,
    });

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.patientId) {
      setActiveDrawer({ type: "reception-patient", id: result.patientId });
    }
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="grid max-h-[calc(100vh-5rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[640px]">
        <DialogHeader className="px-8 pb-4 pt-7">
          <DialogTitle className="text-[22px] font-bold leading-7 text-[var(--clair-color-label-strong)]">
            신규 동물 등록
          </DialogTitle>
          <DialogDescription className="sr-only">
            새 동물 등록 양식입니다.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(100vh-15rem)] min-h-0 overflow-hidden px-8">
          <div className="flex flex-col gap-5 pb-6">
            <RegistrationFormSection separated={false} title="보호자 연결">
              <div className="grid grid-cols-2 gap-5">
                <RegistrationFormField
                  error={error.includes("보호자명") ? error : undefined}
                  label="보호자 검색"
                  required
                >
                  <div className="relative">
                    <CdsActionsSearchIcon
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--clair-color-atomic-gray-500)]"
                    />
                    <Input
                      aria-label="보호자명"
                      aria-invalid={error.includes("보호자명") || undefined}
                      className="h-10 bg-card pl-9"
                      placeholder="보호자를 검색해주세요"
                      value={draft.guardianName}
                      onValueChange={(guardianName) =>
                        setDraft((current) => ({ ...current, guardianName }))
                      }
                    />
                  </div>
                </RegistrationFormField>
                <RegistrationFormField label="보호자 휴대전화">
                  <Input
                    aria-label="보호자 휴대전화"
                    className="h-10 bg-card"
                    placeholder="010-0000-0000"
                    value={draft.guardianMobilePhone}
                    onValueChange={(guardianMobilePhone) =>
                      setDraft((current) => ({ ...current, guardianMobilePhone }))
                    }
                  />
                </RegistrationFormField>
              </div>
            </RegistrationFormSection>

            <RegistrationFormSection title="동물 정보">
              <div className="grid grid-cols-2 gap-5">
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
                      setDraft((current) => ({ ...current, species: species as Species }))
                    }
                  >
                    <SelectTrigger aria-label="종" className="h-10 w-full bg-card">
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
                    <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--clair-color-label-normal)]">
                      <Switch
                        checked={draft.isMixed}
                        onCheckedChange={(isMixed) =>
                          setDraft((current) => ({ ...current, isMixed }))
                        }
                      />
                      믹스
                    </label>
                  }
                >
                  <div className="relative">
                    <CdsActionsSearchIcon
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--clair-color-atomic-gray-500)]"
                    />
                    <Input
                      aria-label="품종"
                      className="h-10 bg-card pl-9"
                      placeholder="주 품종을 선택해주세요"
                      value={draft.breed}
                      onValueChange={(breed) => setDraft((current) => ({ ...current, breed }))}
                    />
                  </div>
                </RegistrationFormField>
                <RegistrationFormField label="성별">
                  <Select
                    value={draft.sex}
                    onValueChange={(sex) =>
                      setDraft((current) => ({ ...current, sex: sex as PatientSex }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full bg-card">
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
                    <div className="relative">
                      <CdsActionsSearchIcon
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--clair-color-atomic-gray-500)]"
                      />
                      <Input
                        className="h-10 bg-card pl-9"
                        placeholder="믹스의 경우 추가 품종을 선택해주세요"
                        value={draft.additionalBreed}
                        onValueChange={(additionalBreed) =>
                          setDraft((current) => ({ ...current, additionalBreed }))
                        }
                      />
                    </div>
                  </RegistrationFormField>
                ) : null}
              </div>
            </RegistrationFormSection>

            <RegistrationFormSection title="추가 정보">
              <div className="grid grid-cols-2 gap-5">
                <RegistrationFormField label="동물 나이">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                    <Input
                      className="h-10 bg-card"
                      inputMode="numeric"
                      placeholder="년"
                      value={draft.ageYears}
                      onValueChange={(ageYears) =>
                        setDraft((current) => ({ ...current, ageYears }))
                      }
                    />
                    <Input
                      className="h-10 bg-card"
                      inputMode="numeric"
                      placeholder="개월"
                      value={draft.ageMonths}
                      onValueChange={(ageMonths) =>
                        setDraft((current) => ({ ...current, ageMonths }))
                      }
                    />
                    <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--clair-color-label-normal)]">
                      <Switch
                        size="sm"
                        checked={draft.estimatedAge}
                        onCheckedChange={(estimatedAge) =>
                          setDraft((current) => ({ ...current, estimatedAge }))
                        }
                      />
                      추정
                    </label>
                  </div>
                </RegistrationFormField>
                <RegistrationFormField
                  error={error.includes("마이크로칩") ? error : undefined}
                  label="마이크로칩"
                >
                  <Input
                    aria-label="마이크로칩"
                    className="h-10 bg-card"
                    inputMode="numeric"
                    placeholder="숫자만 입력해주세요"
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
                    <span className="text-[12px] font-medium text-[var(--clair-color-atomic-gray-500)]">
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
        <DialogFooter className="relative -mx-0 -mb-0 items-center justify-between rounded-none border-t bg-white px-8 py-4 sm:justify-between">
          <div className="min-w-0 text-left text-[12px] font-medium text-muted-foreground">
            마이크로칩 중복은 현재 세션 데이터 기준으로만 확인합니다.
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" className="px-4 font-semibold" onClick={() => close(false)}>
              취소
            </Button>
            <Button className="px-5 font-semibold" onClick={save}>
              등록
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewGuardianDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const addGuardian = usePatientProfileStore((state) => state.addGuardian);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    address: "",
    birthDate: "",
    email: "",
    memo: "",
    mobilePhone: "",
    name: "",
    phone: "",
    privacyConsent: false,
    thirdPartyConsent: false,
    marketingConsent: false,
  });

  const reset = () => {
    setDraft({
      address: "",
      birthDate: "",
      email: "",
      memo: "",
      mobilePhone: "",
      name: "",
      phone: "",
      privacyConsent: false,
      thirdPartyConsent: false,
      marketingConsent: false,
    });
    setError("");
  };
  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) reset();
  };
  const save = () => {
    const result = addGuardian(draft);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.guardianId) {
      setActiveDrawer({ type: "reception-guardian", id: result.guardianId });
    }
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="grid max-h-[calc(100vh-5rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[640px]">
        <DialogHeader className="px-8 pb-4 pt-7">
          <DialogTitle className="text-[22px] font-bold leading-7 text-[var(--clair-color-label-strong)]">
            보호자 등록
          </DialogTitle>
          <DialogDescription className="sr-only">
            새 보호자 등록 양식입니다.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(100vh-15rem)] min-h-0 overflow-hidden px-8">
          <div className="flex flex-col gap-5 pb-6">
            <RegistrationFormSection separated={false} title="기본 정보">
              <div className="grid grid-cols-2 gap-5">
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
                    className="h-10 bg-card"
                    placeholder="날짜 선택 또는 직접 입력"
                    value={draft.birthDate}
                    onValueChange={(birthDate) =>
                      setDraft((current) => ({ ...current, birthDate }))
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
                      setDraft((current) => ({ ...current, mobilePhone }))
                    }
                  />
                </RegistrationFormField>
              </div>
            </RegistrationFormSection>

            <RegistrationFormSection title="연락처 및 주소">
              <div className="grid grid-cols-2 gap-5">
                <RegistrationFormField label="추가 연락처">
                  <Input
                    className="h-10 bg-card"
                    inputMode="numeric"
                    placeholder="추가 연락처를 입력해주세요"
                    value={draft.phone}
                    onValueChange={(phone) => setDraft((current) => ({ ...current, phone }))}
                  />
                </RegistrationFormField>
                <RegistrationFormField label="이메일">
                  <Input
                    className="h-10 bg-card"
                    placeholder="이메일 주소를 입력해주세요"
                    value={draft.email}
                    onValueChange={(email) => setDraft((current) => ({ ...current, email }))}
                  />
                </RegistrationFormField>
                <RegistrationFormField className="col-span-2" label="주소">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Input
                      className="h-10 bg-card"
                      placeholder="주소를 입력해주세요"
                      value={draft.address}
                      onValueChange={(address) =>
                        setDraft((current) => ({ ...current, address }))
                      }
                    />
                    <Button variant="outline" className="h-10 px-3 font-semibold">
                      주소검색
                    </Button>
                  </div>
                </RegistrationFormField>
              </div>
            </RegistrationFormSection>

            <RegistrationFormSection title="메모 및 동의">
              <div className="grid gap-5">
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
                <FieldGroup className="gap-3">
                  <FormField orientation="horizontal">
                    <Checkbox
                      checked={
                        draft.privacyConsent &&
                        draft.thirdPartyConsent &&
                        draft.marketingConsent
                      }
                      onCheckedChange={(checked) =>
                        setDraft((current) => ({
                          ...current,
                          privacyConsent: Boolean(checked),
                          thirdPartyConsent: Boolean(checked),
                          marketingConsent: Boolean(checked),
                        }))
                      }
                    />
                    <FieldLabel className="font-semibold">전체동의</FieldLabel>
                  </FormField>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField orientation="horizontal">
                      <Checkbox
                        checked={draft.privacyConsent}
                        onCheckedChange={(privacyConsent) =>
                          setDraft((current) => ({
                            ...current,
                            privacyConsent: Boolean(privacyConsent),
                          }))
                        }
                      />
                      <FieldLabel>개인정보 수집 동의</FieldLabel>
                    </FormField>
                    <FormField orientation="horizontal">
                      <Checkbox
                        checked={draft.thirdPartyConsent}
                        onCheckedChange={(thirdPartyConsent) =>
                          setDraft((current) => ({
                            ...current,
                            thirdPartyConsent: Boolean(thirdPartyConsent),
                          }))
                        }
                      />
                      <FieldLabel>3자 제공 동의</FieldLabel>
                    </FormField>
                    <FormField orientation="horizontal">
                      <Checkbox
                        checked={draft.marketingConsent}
                        onCheckedChange={(marketingConsent) =>
                          setDraft((current) => ({
                            ...current,
                            marketingConsent: Boolean(marketingConsent),
                          }))
                        }
                      />
                      <FieldLabel>광고 수신 동의</FieldLabel>
                    </FormField>
                  </div>
                </FieldGroup>
              </div>
            </RegistrationFormSection>
          </div>
        </ScrollArea>
        <DialogFooter className="relative -mx-0 -mb-0 items-center justify-between rounded-none border-t bg-white px-8 py-4 sm:justify-between">
          <div className="min-w-0 text-left text-[12px] font-medium text-muted-foreground">
            환자 연결은 보호자 상세에서 후속으로 관리합니다.
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" className="px-4 font-semibold" onClick={() => close(false)}>
              취소
            </Button>
            <Button className="px-5 font-semibold" onClick={save}>
              등록
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
          className="size-3 text-[var(--clair-color-atomic-gray-500)]"
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
            className="size-3 text-[var(--clair-color-atomic-gray-500)]"
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
