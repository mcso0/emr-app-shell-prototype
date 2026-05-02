import {
  getMockEncounterBundle,
  getMockPatientBundle,
  mockEncounters,
  mockPatients,
  mockStaffUsers,
  mockWaitingQueueEntries,
} from "@/mocks/emr-domain";
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

const activeEncounterStatuses = ["waiting", "in_consultation", "ordered"] as const;

const getStaffName = (userId?: EmrId) =>
  userId ? mockStaffUsers.find((user) => user.id === userId)?.name : undefined;

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
        veterinarianName: getStaffName(encounter.primaryVeterinarianId),
      });

      return rows;
    }, [])
    .sort((a, b) => (a.queueEntry.sortOrder ?? 0) - (b.queueEntry.sortOrder ?? 0));
};

export const getChartEncounter = (encounterId: EmrId) => getMockEncounterBundle(encounterId);

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
