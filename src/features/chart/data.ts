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
  chart: SoapNote | null;
  diagnoses: Array<Pick<Diagnosis, "diagnosisText">>;
  encounter: Encounter;
  primaryGuardian?: Guardian;
  queueEntry?: WaitingQueueEntry;
  veterinarianName?: string;
};

export type ChartOrderGroup = {
  group: OrderGroup | null;
  orders: EmrOrder[];
};

export type ChartEncounterBundle = NonNullable<ReturnType<typeof getMockEncounterBundle>> & {
  veterinarianName?: string;
};

const chartQueueStatuses: OrderQueueStatusDefinition[] = [
  {
    id: "in_progress",
    label: "진료중",
    colorToken: "--emr-status-info-text",
    sortOrder: 10,
  },
  {
    id: "waiting",
    label: "호출 대기",
    colorToken: "--emr-status-neutral-text",
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

export const createChartEncounterBundleFromLiveHandoff = ({
  encounter,
  patient,
  primaryGuardian,
  veterinarianName,
}: {
  encounter: Encounter;
  patient: Patient;
  primaryGuardian?: Guardian;
  veterinarianName?: string;
}): ChartEncounterBundle => ({
  encounter,
  patient,
  veterinarianName,
  guardians: primaryGuardian ? [primaryGuardian] : [],
  primaryGuardian,
  appointment: undefined,
  waitingQueueEntries: [],
  soapNotes: [],
  diagnoses: [],
  prescriptions: [],
  prescriptionItems: [],
  orderGroups: [],
  orders: [],
  orderAssignments: [],
  orderEvents: [],
  invoices: [],
  invoiceLines: [],
  payments: [],
  csHistories: [],
  labResults: [],
  equipmentReceipts: [],
  imagingStudies: [],
  attachments: [],
  messageDeliveries: [],
  auditLogs: [],
});

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
    statusId: queueEntry.status === "called" ? "in_progress" : queueEntry.status,
    waitMinutes: queueEntry.status === "waiting" ? getWaitMinutes(queueEntry.enteredAt) : undefined,
  }));

export const getChartHistoryRows = (patientId: EmrId): ChartHistoryRow[] => {
  const bundle = getMockPatientBundle(patientId);

  if (!bundle) return [];

  return bundle.encounters
    .flatMap((encounter) =>
      bundle.soapNotes
        .filter(
          (chart) =>
            chart.encounterId === encounter.id && chart.status !== "voided",
        )
        .map((chart) => ({
          chart,
          diagnoses: bundle.diagnoses.filter(
            (diagnosis) => diagnosis.encounterId === encounter.id,
          ),
          encounter,
        })),
    )
    .sort(
      (a, b) =>
        b.chart.createdAt.localeCompare(a.chart.createdAt) ||
        b.chart.id.localeCompare(a.chart.id),
    );
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
