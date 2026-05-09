import {
  mockAppointments,
  mockCsHistories,
  mockEncounters,
  mockInvoices,
  mockMessageDeliveries,
} from "@/mocks/emr-domain";
import type {
  CsHistoryEntry,
  Guardian,
  MessageDelivery,
  Patient,
  PatientGuardian,
} from "@/types/emr-domain";
import {
  getPatientDisplayAge,
  getPatientSexLabel,
  getSpeciesLabel,
} from "@/features/reception/data";

export type CustomerWorkBadge = {
  label: string;
  tone: "blue" | "green" | "orange" | "purple" | "gray";
};

export type CustomerPatientRow = {
  id: string;
  patient: Patient;
  patientNo: string;
  name: string;
  breed: string;
  sex: string;
  age: string;
  guardianNames: string;
  primaryGuardian?: Guardian;
  phone: string;
  messageConsent: string;
  registeredAt: string;
  searchText: string;
  workBadges: CustomerWorkBadge[];
};

export type CustomerGuardianRow = {
  id: string;
  guardian: Guardian;
  name: string;
  mobilePhone: string;
  patientSummary: string;
  consentSummary: string;
  recentCs: string;
  recentWork: string;
  registeredAt: string;
  searchText: string;
};

const formatShortDateTime = (dateTime?: string) =>
  dateTime ? dateTime.slice(2, 16).replace("T", " ").replaceAll("-", ".") : "-";

const getLatestByTime = <TItem>(items: TItem[], getTime: (item: TItem) => string | undefined) =>
  [...items].sort((a, b) => (getTime(b) ?? "").localeCompare(getTime(a) ?? ""))[0];

const getPatientGuardianLinks = (patientId: string, patientGuardians: PatientGuardian[]) =>
  patientGuardians.filter((link) => link.patientId === patientId);

const getPatientGuardians = (
  patientId: string,
  guardians: Guardian[],
  patientGuardians: PatientGuardian[]
) => {
  const links = getPatientGuardianLinks(patientId, patientGuardians);
  const guardianIds = new Set(links.map((link) => link.guardianId));

  return guardians.filter((guardian) => guardianIds.has(guardian.id));
};

const getPrimaryGuardian = (
  patientId: string,
  guardians: Guardian[],
  patientGuardians: PatientGuardian[]
) => {
  const primaryLink = patientGuardians.find((link) => link.patientId === patientId && link.isPrimary);

  return primaryLink ? guardians.find((guardian) => guardian.id === primaryLink.guardianId) : undefined;
};

const getPatientWorkBadges = (patientId: string): CustomerWorkBadge[] => {
  const patientEncounters = mockEncounters.filter((encounter) => encounter.patientId === patientId);
  const encounterIds = new Set(patientEncounters.map((encounter) => encounter.id));
  const activeEncounter = patientEncounters.find((encounter) =>
    ["waiting", "in_consultation", "ordered", "ready_for_billing"].includes(encounter.status)
  );
  const latestAppointment = getLatestByTime(
    mockAppointments.filter((appointment) => appointment.patientId === patientId),
    (appointment) => appointment.scheduledStartAt
  );
  const latestInvoice = getLatestByTime(
    mockInvoices.filter((invoice) => encounterIds.has(invoice.encounterId)),
    (invoice) => invoice.issuedAt ?? invoice.createdAt
  );
  const badges: CustomerWorkBadge[] = [];

  if (latestAppointment) {
    badges.push({ label: "예약", tone: "green" });
  }
  if (activeEncounter?.status === "waiting") {
    badges.push({ label: "진료대기", tone: "blue" });
  }
  if (activeEncounter?.status === "in_consultation") {
    badges.push({ label: "진료중", tone: "blue" });
  }
  if (activeEncounter?.status === "ordered") {
    badges.push({ label: "오더진행", tone: "orange" });
  }
  if (activeEncounter?.status === "ready_for_billing" || latestInvoice?.status === "draft") {
    badges.push({ label: "수납대기", tone: "purple" });
  }

  return badges.length ? badges : [{ label: "등록", tone: "gray" }];
};

export const getCustomerPatientRows = ({
  guardians,
  patientGuardians,
  patients,
}: {
  guardians: Guardian[];
  patientGuardians: PatientGuardian[];
  patients: Patient[];
}): CustomerPatientRow[] =>
  patients.map((patient) => {
    const linkedGuardians = getPatientGuardians(patient.id, guardians, patientGuardians);
    const primaryGuardian = getPrimaryGuardian(patient.id, guardians, patientGuardians);
    const primaryLink = patientGuardians.find(
      (link) => link.patientId === patient.id && link.guardianId === primaryGuardian?.id
    );
    const guardianNames = linkedGuardians.map((guardian) => guardian.name).join(", ") || "보호자 미지정";
    const phone = primaryGuardian?.mobilePhone ?? "연락처 미입력";

    return {
      id: patient.id,
      patient,
      patientNo: patient.patientNo,
      name: patient.name,
      breed: patient.breed ?? getSpeciesLabel(patient),
      sex: getPatientSexLabel(patient),
      age: patient.birthDate ? `${getPatientDisplayAge(patient)} (${patient.birthDate.slice(2)})` : getPatientDisplayAge(patient),
      guardianNames,
      primaryGuardian,
      phone,
      messageConsent: primaryLink?.canReceiveMessages === false ? "거부" : "동의",
      registeredAt: formatShortDateTime(patient.createdAt),
      searchText: [patient.patientNo, patient.name, patient.breed, guardianNames, phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      workBadges: getPatientWorkBadges(patient.id),
    };
  });

const getGuardianPatients = (
  guardianId: string,
  patients: Patient[],
  patientGuardians: PatientGuardian[]
) => {
  const patientIds = new Set(
    patientGuardians.filter((link) => link.guardianId === guardianId).map((link) => link.patientId)
  );

  return patients.filter((patient) => patientIds.has(patient.id));
};

const getRecentGuardianCs = (guardianId: string, patientIds: Set<string>) =>
  getLatestByTime(
    mockCsHistories.filter(
      (entry) => entry.guardianId === guardianId || Boolean(entry.patientId && patientIds.has(entry.patientId))
    ),
    (entry: CsHistoryEntry) => entry.occurredAt
  );

const getRecentGuardianMessage = (guardianId: string, patientIds: Set<string>) =>
  getLatestByTime(
    mockMessageDeliveries.filter(
      (delivery) =>
        delivery.guardianId === guardianId || Boolean(delivery.patientId && patientIds.has(delivery.patientId))
    ),
    (delivery: MessageDelivery) => delivery.sentAt ?? delivery.createdAt
  );

export const getCustomerGuardianRows = ({
  guardians,
  patientGuardians,
  patients,
}: {
  guardians: Guardian[];
  patientGuardians: PatientGuardian[];
  patients: Patient[];
}): CustomerGuardianRow[] =>
  guardians.map((guardian) => {
    const linkedPatients = getGuardianPatients(guardian.id, patients, patientGuardians);
    const patientIds = new Set(linkedPatients.map((patient) => patient.id));
    const recentCs = getRecentGuardianCs(guardian.id, patientIds);
    const recentMessage = getRecentGuardianMessage(guardian.id, patientIds);
    const patientSummary =
      linkedPatients.map((patient) => patient.name).join(", ") || "연결 동물 없음";

    return {
      id: guardian.id,
      guardian,
      name: guardian.name,
      mobilePhone: guardian.mobilePhone ?? "연락처 미입력",
      patientSummary,
      consentSummary: recentMessage?.status === "cancelled" ? "수신 거부" : "동의",
      recentCs: recentCs ? `${recentCs.category} · ${formatShortDateTime(recentCs.occurredAt)}` : "CS 이력 없음",
      recentWork: recentMessage
        ? `${recentMessage.channel === "kakao_alimtalk" ? "카카오" : recentMessage.channel} · ${formatShortDateTime(recentMessage.sentAt ?? recentMessage.createdAt)}`
        : "발송 이력 없음",
      registeredAt: formatShortDateTime(guardian.createdAt),
      searchText: [guardian.name, guardian.mobilePhone, patientSummary]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

export const filterCustomerRows = <TRow extends { searchText: string }>(rows: TRow[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return rows;

  return rows.filter((row) => row.searchText.includes(normalizedQuery));
};
