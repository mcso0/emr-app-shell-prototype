import {
  LEGACY_FIXTURE_OPERATING_DATE,
  getOperatingDateFromIso,
  getWorkspaceOperatingDate,
} from "@/lib/emr-domain/demo-date";
import {
  LEGACY_SALES_DEMO_WORKSPACE_ID,
  isLegacySalesDemoWorkspace,
} from "@/lib/emr-domain/demo-workspaces";
import {
  getMockPatientBundle,
  mockAppointments,
  mockEncounters,
  mockGuardians,
  mockPatientGuardians,
  mockPatients,
  mockStaffUsers,
  mockWaitingQueueEntries,
} from "@/mocks/emr-domain";
import type {
  Appointment,
  EmrId,
  Encounter,
  Guardian,
  IsoDateTime,
  Patient,
  PatientGuardian,
  WaitingQueueEntry,
} from "@/types/emr-domain";

export type ReceptionDraftCheckIn = {
  appointmentId?: EmrId;
  department?: string;
  durationMinutes?: number;
  encounter: Encounter;
  memo?: string;
  patient?: Patient;
  plannedStartAt?: IsoDateTime;
  primaryGuardian?: Guardian;
  queueEntry: WaitingQueueEntry;
  receptionType?: "appointment" | "walk_in";
  source?: "persisted_calendar" | "persisted_queue" | "session";
};

export type ReceptionPatientSummary = {
  activeEncounter?: Encounter;
  activeDraftCheckIn?: ReceptionDraftCheckIn;
  latestAppointment?: Appointment;
  patient: Patient;
  primaryGuardian?: Guardian;
  searchText: string;
  veterinarianName?: string;
};

export type ReceptionQueueRow = {
  encounter: Encounter;
  patient: Patient;
  primaryGuardian?: Guardian;
  queueEntry: WaitingQueueEntry;
  veterinarianName?: string;
};

export type ReceptionProfileDataset = {
  guardians: Guardian[];
  patientGuardians: PatientGuardian[];
  patients: Patient[];
};

export type ReceptionDataScope = {
  operatingDate?: string;
  profileDataset?: ReceptionProfileDataset;
  staffMembers?: Array<{ displayName: string; id: string }>;
  workspaceId?: string;
};

const defaultReceptionDataScope = {
  operatingDate: LEGACY_FIXTURE_OPERATING_DATE,
  workspaceId: LEGACY_SALES_DEMO_WORKSPACE_ID,
};

const defaultProfileDataset: ReceptionProfileDataset = {
  guardians: mockGuardians,
  patientGuardians: mockPatientGuardians,
  patients: mockPatients,
};

const getPrimaryGuardian = (
  patientId: EmrId,
  dataset: ReceptionProfileDataset = defaultProfileDataset
) => {
  const primaryGuardianId = dataset.patientGuardians.find(
    (link) => link.patientId === patientId && link.isPrimary
  )?.guardianId;

  return primaryGuardianId
    ? dataset.guardians.find((guardian) => guardian.id === primaryGuardianId)
    : getMockPatientBundle(patientId)?.primaryGuardian;
};

const getStaffName = (userId?: EmrId, staffMembers?: ReceptionDataScope["staffMembers"]) =>
  userId
    ? (staffMembers?.find((user) => user.id === userId)?.displayName ??
      mockStaffUsers.find((user) => user.id === userId)?.name)
    : undefined;

const resolveReceptionDataScope = (scope?: ReceptionDataScope) => {
  const workspaceId = scope?.workspaceId ?? defaultReceptionDataScope.workspaceId;

  return {
    includeLegacyFixtures: isLegacySalesDemoWorkspace(workspaceId),
    operatingDate:
      scope?.operatingDate ??
      (isLegacySalesDemoWorkspace(workspaceId)
        ? defaultReceptionDataScope.operatingDate
        : getWorkspaceOperatingDate(workspaceId)),
    workspaceId,
  };
};

export const getPatientDisplayAge = (patient: Patient) => {
  if (patient.estimatedAgeText) return patient.estimatedAgeText;
  if (!patient.birthDate) return "나이 미상";

  const birthYear = Number(patient.birthDate.slice(0, 4));
  if (Number.isNaN(birthYear)) return "나이 미상";

  return `${2026 - birthYear}세`;
};

export const getPatientSexLabel = (patient: Patient) => {
  const sexLabel =
    patient.sex === "male" ? "수컷" : patient.sex === "female" ? "암컷" : "성별 미상";

  return patient.neutered ? `중성화·${sexLabel}` : sexLabel;
};

export const getSpeciesLabel = (patient: Patient) => {
  if (patient.species === "dog") return "강아지";
  if (patient.species === "cat") return "고양이";
  if (patient.species === "rabbit") return "토끼";
  if (patient.species === "ferret") return "페럿";
  if (patient.species === "hamster") return "햄스터";
  if (patient.species === "guinea_pig") return "기니피그";
  if (patient.species === "hedgehog") return "고슴도치";
  if (patient.species === "bird") return "조류";
  if (patient.species === "reptile") return "파충류";
  if (patient.species === "turtle") return "거북이";
  return "기타";
};

export const getReceptionPatientSummaries = (
  draftCheckIns: ReceptionDraftCheckIn[],
  dataset: ReceptionProfileDataset = defaultProfileDataset,
  scope?: ReceptionDataScope
): ReceptionPatientSummary[] => {
  const resolvedScope = resolveReceptionDataScope(scope);
  const scopedPatients = dataset.patients.filter(
    (patient) => patient.workspaceId === resolvedScope.workspaceId
  );
  const draftEncounters = draftCheckIns
    .map((draft) => draft.encounter)
    .filter((encounter) => encounter.workspaceId === resolvedScope.workspaceId);
  const fixtureEncounters = resolvedScope.includeLegacyFixtures ? mockEncounters : [];
  const encounters = [...draftEncounters, ...fixtureEncounters];
  const appointments = getEffectiveAppointments(draftCheckIns, [], resolvedScope);

  return scopedPatients.map((patient) => {
    const primaryGuardian = getPrimaryGuardian(patient.id, dataset);
    const patientAppointments = appointments.filter(
      (appointment) =>
        appointment.patientId === patient.id &&
        getOperatingDateFromIso(appointment.scheduledStartAt) ===
          resolvedScope.operatingDate,
    );
    const patientEncounters = encounters.filter(
      (encounter) =>
        encounter.patientId === patient.id &&
        getOperatingDateFromIso(encounter.checkedInAt ?? encounter.createdAt) ===
          resolvedScope.operatingDate,
    );
    const activeEncounter = patientEncounters.find((encounter) =>
      ["waiting", "in_consultation", "ordered", "ready_for_billing"].includes(encounter.status)
    );
    const activeDraftCheckIn = activeEncounter
      ? draftCheckIns.find((draft) => draft.encounter.id === activeEncounter.id)
      : undefined;
    const latestAppointment = patientAppointments.at(-1);
    const veterinarianName =
      getStaffName(
        activeEncounter?.primaryVeterinarianId,
        scope?.staffMembers,
      ) ??
      getStaffName(
        latestAppointment?.assignedVeterinarianId,
        scope?.staffMembers,
      );
    const searchText = [
      patient.name,
      patient.patientNo,
      patient.breed,
      getSpeciesLabel(patient),
      primaryGuardian?.name,
      primaryGuardian?.mobilePhone,
      primaryGuardian?.phone,
      activeEncounter?.visitPurpose,
      activeEncounter?.chiefComplaint,
      activeEncounter?.receptionMemo,
      latestAppointment?.visitPurpose,
      latestAppointment?.symptomNote,
      veterinarianName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      activeEncounter,
      activeDraftCheckIn,
      latestAppointment,
      patient,
      primaryGuardian,
      searchText,
      veterinarianName,
    };
  });
};

export const getFilteredReceptionPatients = (
  summaries: ReceptionPatientSummary[],
  query: string
) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return summaries;

  return summaries.filter((summary) => summary.searchText.includes(normalizedQuery));
};

export const getEffectiveAppointments = (
  draftCheckIns: ReceptionDraftCheckIn[],
  persistedAppointments: Appointment[] = [],
  scope?: ReceptionDataScope
): Appointment[] => {
  const resolvedScope = resolveReceptionDataScope(scope);
  const checkedInAppointmentIds = new Set(
    draftCheckIns.flatMap((draft) => (draft.appointmentId ? [draft.appointmentId] : []))
  );
  const fixtureAppointments = resolvedScope.includeLegacyFixtures ? mockAppointments : [];
  const appointments = [
    ...fixtureAppointments.map((appointment) =>
      persistedAppointments.find((item) => item.id === appointment.id) ?? appointment
    ),
    ...persistedAppointments.filter(
      (appointment) => !fixtureAppointments.some((item) => item.id === appointment.id)
    ),
  ];

  return appointments.map((appointment) =>
    checkedInAppointmentIds.has(appointment.id)
      ? {
          ...appointment,
          status: "checked_in" as const,
          updatedAt: draftCheckIns.find((draft) => draft.appointmentId === appointment.id)
            ?.encounter.updatedAt ?? appointment.updatedAt,
        }
      : appointment
  ).filter((appointment) => appointment.workspaceId === resolvedScope.workspaceId);
};

export const getTodayAppointments = (
  draftCheckIns: ReceptionDraftCheckIn[],
  persistedAppointments: Appointment[] = [],
  scope?: ReceptionDataScope
) =>
  getEffectiveAppointments(draftCheckIns, persistedAppointments, scope).filter((appointment) =>
    getOperatingDateFromIso(appointment.scheduledStartAt) ===
    resolveReceptionDataScope(scope).operatingDate
  );

export const getEffectiveEncounters = (
  draftCheckIns: ReceptionDraftCheckIn[],
  scope?: ReceptionDataScope
) => {
  const resolvedScope = resolveReceptionDataScope(scope);
  const fixtureEncounters = resolvedScope.includeLegacyFixtures ? mockEncounters : [];

  return [
    ...fixtureEncounters,
    ...draftCheckIns.map((draft) => draft.encounter),
  ].filter((encounter) => encounter.workspaceId === resolvedScope.workspaceId);
};

export const getReceptionQueueRows = (
  draftCheckIns: ReceptionDraftCheckIn[],
  scope?: ReceptionDataScope
): ReceptionQueueRow[] => {
  const resolvedScope = resolveReceptionDataScope(scope);
  const profileDataset = scope?.profileDataset ?? defaultProfileDataset;
  const encounters = getEffectiveEncounters(draftCheckIns, resolvedScope);
  const queueEntries = [
    ...(resolvedScope.includeLegacyFixtures ? mockWaitingQueueEntries : []),
    ...draftCheckIns.map((draft) => draft.queueEntry),
  ].filter(
    (entry) =>
      entry.workspaceId === resolvedScope.workspaceId &&
      (entry.queueType === "consultation" || entry.queueType === "billing")
  );

  const rows = queueEntries.reduce<ReceptionQueueRow[]>((accumulator, queueEntry) => {
      const encounter = encounters.find((item) => item.id === queueEntry.encounterId);
      const draft = draftCheckIns.find(
        (item) => item.encounter.id === queueEntry.encounterId
      );
      const patient = encounter
        ? (draft?.patient ??
          profileDataset.patients.find((item) => item.id === encounter.patientId) ??
          mockPatients.find((item) => item.id === encounter.patientId))
        : undefined;

      if (!encounter || !patient) return accumulator;

      accumulator.push({
        encounter,
        patient,
        primaryGuardian:
          draft?.primaryGuardian ?? getPrimaryGuardian(patient.id, profileDataset),
        queueEntry,
        veterinarianName: getStaffName(
          encounter.primaryVeterinarianId,
          scope?.staffMembers,
        ),
      });

      return accumulator;
    }, []);

  return rows.sort((a, b) => {
    if (a.queueEntry.status !== b.queueEntry.status) {
      return a.queueEntry.status === "waiting" ? -1 : 1;
    }

    return (a.queueEntry.sortOrder ?? 0) - (b.queueEntry.sortOrder ?? 0);
  });
};

export const getGuardianDisplay = (guardian?: Guardian) => {
  if (!guardian) return "보호자 미지정";

  return guardian.mobilePhone ? `${guardian.name} · ${guardian.mobilePhone}` : guardian.name;
};

export const getAppointmentPatient = (appointment: Appointment) =>
  mockPatients.find((patient) => patient.id === appointment.patientId);

export const getAppointmentGuardian = (appointment: Appointment) =>
  appointment.guardianId
    ? mockGuardians.find((guardian) => guardian.id === appointment.guardianId)
    : getPrimaryGuardian(appointment.patientId);

export const getAppointmentVeterinarianName = (appointment: Appointment) =>
  getStaffName(appointment.assignedVeterinarianId) ?? "미배정";
