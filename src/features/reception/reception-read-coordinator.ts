import type { EffectiveOperatingHours } from "../hospital-admin/settings/hospital-basic-settings-model";
import type { Patient } from "../../types/emr-domain";
import type { ReceptionPatientGuardianLookupItem, ReceptionPatientGuardianLookupResponse } from "./patient-guardian-lookup";
import type { ReceptionCalendarReadRecord, ReceptionCalendarReadResponse } from "./reception-calendar-read";
import type { ReceptionQueueReadRecord, ReceptionQueueReadResponse } from "./reception-queue-read";
import type { useReceptionStore } from "./store";

type ReceptionStoreState = ReturnType<typeof useReceptionStore.getState>;
type ReadInput = { actorId?: string; date: string; workspaceId: string };
type ReadResults = { calendarResult: ReceptionCalendarReadResponse; queueResult: ReceptionQueueReadResponse };
export type ReceptionRefreshResult = {
  ok: boolean;
  stale?: boolean;
};

export type ReceptionReadCoordinatorContext = {
  workspaceId: string;
  operatingDate: string;
  actorId?: string;
  liveStaffSourceEnabled: boolean;
  receptionReadInFlightRef: { current: { key: string; promise: Promise<ReceptionRefreshResult> } | null };
  receptionReadRequestSeqRef: { current: number };
  shouldUseSupabaseAuth: () => boolean;
  loadReceptionSnapshot: (input: ReadInput) => Promise<ReadResults>;
  loadReceptionCalendar: (input: ReadInput) => Promise<ReceptionCalendarReadResponse>;
  loadReceptionQueue: (input: ReadInput) => Promise<ReceptionQueueReadResponse>;
  loadReceptionPatientGuardianProfiles: (input: Omit<ReadInput, "date">) => Promise<ReceptionPatientGuardianLookupResponse>;
  getPatients: () => Array<Pick<Patient, "id">>;
  applyPatientGuardianLookupItem: (item: ReceptionPatientGuardianLookupItem) => void;
  applyPersistedReceptionCalendar: ReceptionStoreState["applyPersistedReceptionCalendar"];
  applyPersistedReceptionQueue: ReceptionStoreState["applyPersistedReceptionQueue"];
  setReceptionCalendarReadStatus: ReceptionStoreState["setReceptionCalendarReadStatus"];
  setReceptionQueueReadStatus: ReceptionStoreState["setReceptionQueueReadStatus"];
  setOperatingSchedule: (schedule: EffectiveOperatingHours) => void;
  getReceptionReadFailureMessage: (result: Extract<ReceptionCalendarReadResponse | ReceptionQueueReadResponse, { ok: false }>, workspaceId?: string) => string;
};

type ReceptionReadbackProfileRecord =
  | ReceptionCalendarReadRecord
  | ReceptionQueueReadRecord;

const getReceptionReadbackRecords = ({
  calendarResult,
  queueResult,
}: {
  calendarResult: ReceptionCalendarReadResponse;
  queueResult: ReceptionQueueReadResponse;
}): ReceptionReadbackProfileRecord[] => [
  ...(calendarResult.ok ? calendarResult.records : []),
  ...(queueResult.ok ? queueResult.queue : []),
];

const getReadbackPatientIds = (records: ReceptionReadbackProfileRecord[]) =>
  Array.from(
    new Set(
      records
        .map((record) => {
          if (record.patient?.id) return record.patient.id;
          if ("encounter" in record && record.encounter) {
            return record.encounter.patientId;
          }
          if ("appointment" in record && record.appointment) {
            return record.appointment.patientId;
          }

          return undefined;
        })
        .filter((value): value is string => Boolean(value)),
    ),
  );

const getEmbeddedReadbackLookupItems = (
  records: ReceptionReadbackProfileRecord[],
): ReceptionPatientGuardianLookupItem[] =>
  records
    .map((record) =>
      record.patient
        ? {
            patient: record.patient,
            ...(record.primaryGuardian
              ? { primaryGuardian: record.primaryGuardian }
              : {}),
          }
        : null,
    )
    .filter(
      (item): item is ReceptionPatientGuardianLookupItem => Boolean(item),
    );

export function refreshReceptionReads(
  context: ReceptionReadCoordinatorContext,
  { showLoading = false }: { showLoading?: boolean } = {},
): Promise<ReceptionRefreshResult> {
  const {
    applyPatientGuardianLookupItem,
    applyPersistedReceptionCalendar,
    applyPersistedReceptionQueue,
    actorId,
    getPatients,
    getReceptionReadFailureMessage,
    liveStaffSourceEnabled,
    loadReceptionCalendar,
    loadReceptionPatientGuardianProfiles,
    loadReceptionQueue,
    loadReceptionSnapshot,
    operatingDate,
    receptionReadInFlightRef,
    receptionReadRequestSeqRef,
    setOperatingSchedule,
    setReceptionCalendarReadStatus,
    setReceptionQueueReadStatus,
    shouldUseSupabaseAuth,
    workspaceId,
  } = context;

const refreshKey = `${workspaceId}\u0000${operatingDate}`;
const inFlight = receptionReadInFlightRef.current;
if (inFlight?.key === refreshKey) return inFlight.promise;

const requestSeq = receptionReadRequestSeqRef.current + 1;
receptionReadRequestSeqRef.current = requestSeq;
const isLatestRequest = () => receptionReadRequestSeqRef.current === requestSeq;

const refreshPromise = (async (): Promise<ReceptionRefreshResult> => {
  if (showLoading) {
    setReceptionCalendarReadStatus("loading");
    setReceptionQueueReadStatus("loading");
  }

  const { calendarResult, queueResult } =
    liveStaffSourceEnabled && shouldUseSupabaseAuth()
      ? await loadReceptionSnapshot({
          actorId: actorId,
          date: operatingDate,
          workspaceId,
        })
      : await Promise.all([
          loadReceptionCalendar({
            actorId: actorId,
            date: operatingDate,
            workspaceId,
          }),
          loadReceptionQueue({
            actorId: actorId,
            date: operatingDate,
            workspaceId,
          }),
        ]).then(([calendarResult, queueResult]) => ({
          calendarResult,
          queueResult,
        }));

  if (!isLatestRequest()) {
    return { ok: false, stale: true };
  }

  const readbackRecords = getReceptionReadbackRecords({
    calendarResult,
    queueResult,
  });
  const embeddedLookupItems = getEmbeddedReadbackLookupItems(readbackRecords);

  embeddedLookupItems.forEach(applyPatientGuardianLookupItem);

  const currentPatients = getPatients();
  const knownPatientIds = new Set([
    ...currentPatients.map((patient) => patient.id),
    ...embeddedLookupItems.map((item) => item.patient.id),
  ]);
  const missingReadbackPatientIds = getReadbackPatientIds(
    readbackRecords,
  ).filter((patientId) => !knownPatientIds.has(patientId));

  if (liveStaffSourceEnabled && missingReadbackPatientIds.length > 0) {
    const profileResult = await loadReceptionPatientGuardianProfiles({
      actorId: actorId,
      workspaceId,
    });

    if (!isLatestRequest()) {
      return { ok: false, stale: true };
    }

    if (profileResult.ok) {
      const missingPatientIds = new Set(missingReadbackPatientIds);
      profileResult.patients
        .filter((item) => missingPatientIds.has(item.patient.id))
        .forEach(applyPatientGuardianLookupItem);
    }
  }

  if (!calendarResult.ok) {
    setReceptionCalendarReadStatus(
      "error",
      getReceptionReadFailureMessage(calendarResult, workspaceId),
    );
  } else {
    applyPersistedReceptionCalendar(calendarResult.records);
    if (calendarResult.operatingSchedule) {
      setOperatingSchedule(calendarResult.operatingSchedule);
    }
  }

  if (!queueResult.ok) {
    setReceptionQueueReadStatus(
      "error",
      getReceptionReadFailureMessage(queueResult, workspaceId),
    );
  } else {
    applyPersistedReceptionQueue(queueResult.queue, queueResult.summary);
  }

  return { ok: calendarResult.ok && queueResult.ok };
})();

receptionReadInFlightRef.current = {
  key: refreshKey,
  promise: refreshPromise,
};
void refreshPromise.then(
  () => {
    if (receptionReadInFlightRef.current?.promise === refreshPromise) {
      receptionReadInFlightRef.current = null;
    }
  },
  () => {
    if (receptionReadInFlightRef.current?.promise === refreshPromise) {
      receptionReadInFlightRef.current = null;
    }
  },
);

return refreshPromise;

}
