import {
  getMockEncounterBundle,
  getMockPatientBundle,
  mockEncounters,
  mockInvoiceLines,
  mockPatients,
  mockStaffUsers,
  mockWaitingQueueEntries,
} from "@/mocks/emr-domain";
import type { OrderQueueItem, OrderQueueStatusDefinition } from "@/types/emr";
import type {
  Diagnosis,
  EmrId,
  EmrOrder,
  Encounter,
  Guardian,
  OrderGroup,
  Patient,
  SoapNote,
  WaitingQueueEntry,
} from "@/types/emr-domain";

export type ChartQueueRow = {
  encounter: Encounter;
  patient: Patient;
  primaryGuardian?: Guardian;
  queueEntry: WaitingQueueEntry;
  veterinarianName?: string;
};

export type ChartHistoryRow = {
  diagnoses: Diagnosis[];
  encounter: Encounter;
  soapNote?: SoapNote;
};

export type ChartOrderGroup = {
  group: OrderGroup | null;
  orders: EmrOrder[];
};

const chartQueueStatuses: OrderQueueStatusDefinition[] = [
  {
    id: "in_progress",
    label: "진료중",
    colorToken: "--clair-color-primary-normal",
    sortOrder: 10,
  },
  {
    id: "called",
    label: "호출",
    colorToken: "--clair-color-atomic-orange-400",
    sortOrder: 20,
  },
  {
    id: "waiting",
    label: "진료대기",
    colorToken: "--clair-color-atomic-gray-400",
    sortOrder: 30,
  },
];

const activeEncounterStatuses = ["waiting", "in_consultation", "ordered"] as const;
const chartQueueReferenceAt = "2026-05-01T10:32:00+09:00";

export const getChartStaffName = (userId?: EmrId) =>
  userId ? mockStaffUsers.find((user) => user.id === userId)?.name : undefined;

const getShortTime = (dateTime?: string) => (dateTime ? dateTime.slice(11, 16) : "-");

const getWaitMinutes = (enteredAt?: string) => {
  if (!enteredAt || enteredAt.slice(0, 10) !== chartQueueReferenceAt.slice(0, 10)) {
    return undefined;
  }

  return Math.max(
    0,
    Math.round((new Date(chartQueueReferenceAt).getTime() - new Date(enteredAt).getTime()) / 60000)
  );
};

export const getChartQueueRows = (): ChartQueueRow[] => {
  const consultationQueue = mockWaitingQueueEntries.filter(
    (entry) => entry.queueType === "consultation" && entry.status !== "done"
  );

  return consultationQueue
    .reduce<ChartQueueRow[]>((rows, queueEntry) => {
      const encounter = mockEncounters.find((item) => item.id === queueEntry.encounterId);
      const patient = encounter
        ? mockPatients.find((item) => item.id === encounter.patientId)
        : undefined;
      const bundle = encounter ? getMockPatientBundle(encounter.patientId) : null;

      if (!encounter || !patient) return rows;
      if (!activeEncounterStatuses.some((status) => status === encounter.status)) {
        return rows;
      }

      rows.push({
        encounter,
        patient,
        primaryGuardian: bundle?.primaryGuardian,
        queueEntry,
        veterinarianName: getChartStaffName(encounter.primaryVeterinarianId),
      });

      return rows;
    }, [])
    .sort((a, b) => (a.queueEntry.sortOrder ?? 0) - (b.queueEntry.sortOrder ?? 0));
};

export const getChartEncounter = (encounterId: EmrId) => getMockEncounterBundle(encounterId);

export const getChartQueueStatuses = () => chartQueueStatuses;

export const getChartQueueItems = (): OrderQueueItem[] =>
  getChartQueueRows().map(({ encounter, patient, primaryGuardian, queueEntry, veterinarianName }) => ({
    id: encounter.id,
    instructionId: encounter.encounterNo,
    patientName: patient.name,
    guardianName: primaryGuardian?.name ?? "보호자 미지정",
    patientAge: patient.estimatedAgeText,
    patientBreed: patient.breed,
    patientSex: patient.sex === "male" ? "수컷" : patient.sex === "female" ? "암컷" : "미상",
    receptionType: encounter.appointmentId ? "예약" : "외래",
    orderType: encounter.visitPurpose ?? "진료",
    orderTypeCategory: "treatment",
    orderName: encounter.chiefComplaint ?? encounter.visitPurpose ?? "진료 대기",
    requesterName: veterinarianName ?? "담당 미정",
    assigneeName: veterinarianName,
    startedAt: encounter.startedAt ? getShortTime(encounter.startedAt) : undefined,
    time: getShortTime(queueEntry.enteredAt),
    statusId: queueEntry.status,
    waitMinutes: queueEntry.status === "waiting" ? getWaitMinutes(queueEntry.enteredAt) : undefined,
  }));

export const getChartHistoryRows = (patientId: EmrId): ChartHistoryRow[] => {
  const bundle = getMockPatientBundle(patientId);

  if (!bundle) return [];

  return [...bundle.encounters]
    .sort((a, b) => (b.checkedInAt ?? b.createdAt).localeCompare(a.checkedInAt ?? a.createdAt))
    .map((encounter) => ({
      diagnoses: bundle.diagnoses.filter((diagnosis) => diagnosis.encounterId === encounter.id),
      encounter,
      soapNote: bundle.soapNotes.find((soapNote) => soapNote.encounterId === encounter.id),
    }));
};

export const getChartOrderGroups = (encounterId: EmrId): ChartOrderGroup[] => {
  const bundle = getMockEncounterBundle(encounterId);

  if (!bundle) return [];

  const groupedOrderIds = new Set<string>();
  const groups = [...bundle.orderGroups]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => ({
      group,
      orders: bundle.orders
        .filter((order) => order.orderGroupId === group.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  groups.forEach(({ orders }) => {
    orders.forEach((order) => groupedOrderIds.add(order.id));
  });

  const ungroupedOrders = bundle.orders
    .filter((order) => !groupedOrderIds.has(order.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (!ungroupedOrders.length) return groups;

  return [
    ...groups,
    {
      group: null,
      orders: ungroupedOrders,
    },
  ];
};

export const getChartInvoiceLineByOrderId = (orderId: EmrId) =>
  mockInvoiceLines.find((line) => line.orderId === orderId);
