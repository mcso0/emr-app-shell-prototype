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
  Patient,
  PatientGuardian,
  WaitingQueueEntry,
} from "@/types/emr-domain";

export type ReceptionDraftCheckIn = {
  appointmentId?: EmrId;
  encounter: Encounter;
  queueEntry: WaitingQueueEntry;
};

export type ReceptionPatientSummary = {
  activeEncounter?: Encounter;
  latestAppointment?: Appointment;
  patient: Patient;
  primaryGuardian?: Guardian;
  searchText: string;
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

const TODAY_PREFIX = "2026-05-01";

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

const getStaffName = (userId?: EmrId) =>
  userId ? mockStaffUsers.find((user) => user.id === userId)?.name : undefined;

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
  return "기타";
};

export const getReceptionPatientSummaries = (
  draftCheckIns: ReceptionDraftCheckIn[],
  dataset: ReceptionProfileDataset = defaultProfileDataset
): ReceptionPatientSummary[] => {
  const draftEncounters = draftCheckIns.map((draft) => draft.encounter);
  const encounters = [...draftEncounters, ...mockEncounters];
  const appointments = getEffectiveAppointments(draftCheckIns);

  return dataset.patients.map((patient) => {
    const primaryGuardian = getPrimaryGuardian(patient.id, dataset);
    const patientAppointments = appointments.filter((appointment) => appointment.patientId === patient.id);
    const patientEncounters = encounters.filter((encounter) => encounter.patientId === patient.id);
    const activeEncounter = patientEncounters.find((encounter) =>
      ["waiting", "in_consultation", "ordered", "ready_for_billing"].includes(encounter.status)
    );
    const latestAppointment = patientAppointments.at(-1);
    const searchText = [
      patient.name,
      patient.patientNo,
      patient.breed,
      getSpeciesLabel(patient),
      primaryGuardian?.name,
      primaryGuardian?.mobilePhone,
      primaryGuardian?.phone,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      activeEncounter,
      latestAppointment,
      patient,
      primaryGuardian,
      searchText,
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
  draftCheckIns: ReceptionDraftCheckIn[]
): Appointment[] => {
  const checkedInAppointmentIds = new Set(
    draftCheckIns.flatMap((draft) => (draft.appointmentId ? [draft.appointmentId] : []))
  );

  return mockAppointments.map((appointment) =>
    checkedInAppointmentIds.has(appointment.id)
      ? {
          ...appointment,
          status: "checked_in",
          updatedAt: draftCheckIns.find((draft) => draft.appointmentId === appointment.id)
            ?.encounter.updatedAt ?? appointment.updatedAt,
        }
      : appointment
  );
};

export const getTodayAppointments = (draftCheckIns: ReceptionDraftCheckIn[]) =>
  getEffectiveAppointments(draftCheckIns).filter((appointment) =>
    appointment.scheduledStartAt.startsWith(TODAY_PREFIX)
  );

export const getEffectiveEncounters = (draftCheckIns: ReceptionDraftCheckIn[]) => [
  ...mockEncounters,
  ...draftCheckIns.map((draft) => draft.encounter),
];

export const getReceptionQueueRows = (
  draftCheckIns: ReceptionDraftCheckIn[]
): ReceptionQueueRow[] => {
  const encounters = getEffectiveEncounters(draftCheckIns);
  const queueEntries = [
    ...mockWaitingQueueEntries,
    ...draftCheckIns.map((draft) => draft.queueEntry),
  ].filter((entry) => entry.queueType === "consultation" || entry.queueType === "billing");

  const rows = queueEntries.reduce<ReceptionQueueRow[]>((accumulator, queueEntry) => {
      const encounter = encounters.find((item) => item.id === queueEntry.encounterId);
      const patient = encounter
        ? mockPatients.find((item) => item.id === encounter.patientId)
        : undefined;

      if (!encounter || !patient) return accumulator;

      accumulator.push({
        encounter,
        patient,
        primaryGuardian: getPrimaryGuardian(patient.id),
        queueEntry,
        veterinarianName: getStaffName(encounter.primaryVeterinarianId),
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
