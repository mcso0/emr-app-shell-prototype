"use client";

import { create } from "zustand";
import {
  LEGACY_FIXTURE_OPERATING_NOW,
  getWorkspaceOperatingNow,
} from "@/lib/emr-domain/demo-date";
import { LEGACY_SALES_DEMO_WORKSPACE_ID } from "@/lib/emr-domain/demo-workspaces";
import type {
  Appointment,
  EmrId,
  Encounter,
  Guardian,
  MessageDelivery,
  Patient,
  WaitingQueueEntry,
} from "@/types/emr-domain";
import type { ReceptionAppointmentCheckInRecord } from "@/features/reception/appointment-check-in";
import type { ReceptionEncounterUpdateRecord } from "@/features/reception/encounter-update";
import type { ReceptionCalendarReadRecord } from "@/features/reception/reception-calendar-read";
import type {
  ReceptionQueueReadRecord,
  ReceptionQueueReadSummary,
} from "@/features/reception/reception-queue-read";
import type { ReceptionWalkInEncounterRecord } from "@/features/reception/walk-in-encounter";

type ReceptionDraftCheckIn = {
  appointmentId?: EmrId;
  department?: string;
  durationMinutes?: number;
  encounter: Encounter;
  memo?: string;
  patient?: Patient;
  plannedStartAt?: string;
  primaryGuardian?: Guardian;
  queueEntry: WaitingQueueEntry;
  receptionType?: "appointment" | "walk_in";
  source?: "persisted_calendar" | "persisted_queue" | "session";
};

type ReceptionQueueReadStatus = "idle" | "loading" | "ready" | "error";

export type ReceptionCalendarDraftSelection = {
  durationMinutes: number;
  id: EmrId;
  plannedStartAt: string;
  primaryVeterinarianId?: EmrId;
};

type ReceptionStore = {
  calendarDraftSelection?: ReceptionCalendarDraftSelection;
  messageDeliveries: MessageDelivery[];
  operatingDateByWorkspace: Record<EmrId, string>;
  searchQuery: string;
  selectedAppointmentId?: EmrId;
  selectedEncounterId?: EmrId;
  selectedPatientId: EmrId;
  draftCheckIns: ReceptionDraftCheckIn[];
  persistedCalendarAppointments: Appointment[];
  calendarReadError?: string;
  calendarReadStatus: ReceptionQueueReadStatus;
  queueReadError?: string;
  queueReadStatus: ReceptionQueueReadStatus;
  queueSummary?: ReceptionQueueReadSummary;
  readRetryNonce: number;
  applyAppointmentCreate: (appointment: Appointment) => void;
  applyPersistedReceptionCalendar: (records: ReceptionCalendarReadRecord[]) => void;
  applyPersistedReceptionQueue: (
    queue: ReceptionQueueReadRecord[],
    summary?: ReceptionQueueReadSummary,
  ) => void;
  clearWorkspaceSessionDrafts: (workspaceId: EmrId) => void;
  cancelReceptionEncounter: (input: {
    encounterId: EmrId;
    workspaceId: EmrId;
  }) => void;
  applyEncounterUpdate: (update: ReceptionEncounterUpdateRecord) => void;
  requestReceptionReadRetry: () => void;
  setCalendarDraftSelection: (selection?: ReceptionCalendarDraftSelection) => void;
  setWorkspaceOperatingDate: (workspaceId: EmrId, operatingDate: string) => void;
  setSearchQuery: (query: string) => void;
  setReceptionCalendarReadStatus: (status: ReceptionQueueReadStatus, error?: string) => void;
  setReceptionQueueReadStatus: (status: ReceptionQueueReadStatus, error?: string) => void;
  selectAppointment: (appointmentId: EmrId) => void;
  selectEncounter: (encounterId: EmrId) => void;
  selectPatient: (patientId: EmrId) => void;
  checkInAppointment: (appointment: Appointment) => void;
  applyAppointmentCheckIn: (input: {
    appointment: Appointment;
    checkIn: ReceptionAppointmentCheckInRecord;
  }) => void;
  createWalkInCheckIn: (input: {
    department?: string;
    durationMinutes?: number;
    guardianId?: EmrId;
    memo?: string;
    patientId: EmrId;
    plannedStartAt?: string;
    primaryVeterinarianId?: EmrId;
    sendKakaoMessage?: boolean;
    guardianMobilePhone?: string;
    patientName?: string;
    visitPurpose?: string;
    workspaceId?: EmrId;
  }) => void;
  applyWalkInCheckIn: (input: {
    department?: string;
    durationMinutes?: number;
    guardianId?: EmrId;
    guardianMobilePhone?: string;
    memo?: string;
    patientId: EmrId;
    patientName?: string;
    plannedStartAt?: string;
    sendKakaoMessage?: boolean;
    visitPurpose?: string;
    walkIn: ReceptionWalkInEncounterRecord;
  }) => void;
};

const DEFAULT_PATIENT_ID = "patient-coco";
const DEFAULT_NOW = LEGACY_FIXTURE_OPERATING_NOW;
const activeReceptionEncounterStatuses = new Set<Encounter["status"]>([
  "waiting",
  "in_consultation",
  "ordered",
  "ready_for_billing",
]);
const activeReceptionQueueStatuses = new Set<WaitingQueueEntry["status"]>([
  "waiting",
  "called",
  "in_progress",
]);

const isActiveReceptionQueueWork = ({
  encounter,
  queueEntry,
}: {
  encounter: Encounter;
  queueEntry: WaitingQueueEntry;
}) =>
  activeReceptionEncounterStatuses.has(encounter.status) &&
  activeReceptionQueueStatuses.has(queueEntry.status);

const visibleReceptionEncounterStatuses = new Set<Encounter["status"]>([
  ...activeReceptionEncounterStatuses,
  "cancelled",
]);
const visibleReceptionQueueStatuses = new Set<WaitingQueueEntry["status"]>([
  ...activeReceptionQueueStatuses,
  "cancelled",
]);

const isVisibleReceptionQueueWork = ({
  encounter,
  queueEntry,
}: {
  encounter: Encounter;
  queueEntry: WaitingQueueEntry;
}) =>
  visibleReceptionEncounterStatuses.has(encounter.status) &&
  visibleReceptionQueueStatuses.has(queueEntry.status);

const createDraftEncounter = ({
  appointmentId,
  eventTime,
  guardianId,
  index,
  patientId,
  primaryVeterinarianId,
  visitPurpose,
  plannedStartAt,
  workspaceId,
}: {
  appointmentId?: EmrId;
  eventTime?: string;
  guardianId?: EmrId;
  index: number;
  patientId: EmrId;
  primaryVeterinarianId?: EmrId;
  visitPurpose?: string;
  plannedStartAt?: string;
  workspaceId?: EmrId;
}): Encounter => {
  const suffix = String(index + 10).padStart(4, "0");
  const id = appointmentId ? `draft-encounter-${appointmentId}` : `draft-encounter-walkin-${patientId}`;
  const resolvedWorkspaceId = workspaceId ?? LEGACY_SALES_DEMO_WORKSPACE_ID;
  const resolvedEventTime =
    eventTime ?? plannedStartAt ?? getWorkspaceOperatingNow(resolvedWorkspaceId);

  return {
    id,
    workspaceId: resolvedWorkspaceId,
    patientId,
    guardianId,
    appointmentId,
    primaryVeterinarianId,
    encounterNo: `E-260501-${suffix}`,
    chiefComplaint: visitPurpose,
    visitPurpose: visitPurpose ?? "현장 접수",
    status: "waiting",
    checkedInAt: resolvedEventTime,
    createdAt: resolvedEventTime,
    updatedAt: resolvedEventTime,
  };
};

const createDraftQueueEntry = ({
  enteredAt,
  encounterId,
  index,
  workspaceId,
}: {
  enteredAt?: string;
  encounterId: EmrId;
  index: number;
  workspaceId?: EmrId;
}): WaitingQueueEntry => ({
  id: `draft-queue-${encounterId}`,
  workspaceId: workspaceId ?? LEGACY_SALES_DEMO_WORKSPACE_ID,
  encounterId,
  queueType: "consultation",
  status: "waiting",
  priority: "normal",
  sortOrder: index + 10,
  enteredAt: enteredAt ?? DEFAULT_NOW,
});

const createSessionCheckInMessage = ({
  createdAt,
  encounterId,
  guardianId,
  guardianMobilePhone,
  index,
  patientId,
  patientName,
  workspaceId,
}: {
  createdAt?: string;
  encounterId: EmrId;
  guardianId?: EmrId;
  guardianMobilePhone?: string;
  index: number;
  patientId: EmrId;
  patientName?: string;
  workspaceId?: EmrId;
}): MessageDelivery => ({
  id: `session-message-checkin-${encounterId}-${index}`,
  workspaceId: workspaceId ?? LEGACY_SALES_DEMO_WORKSPACE_ID,
  templateId: "template-checkin",
  guardianId,
  patientId,
  encounterId,
  channel: "kakao_alimtalk",
  recipient: guardianMobilePhone ?? "연락처 미입력",
  bodySnapshot: `${patientName ?? "환자"} 접수가 완료되었습니다. 대기 순서를 확인해 주세요.`,
  status: "sent",
  providerMessageId: `session-alimtalk-${index}`,
  retryCount: 0,
  sentAt: createdAt ?? DEFAULT_NOW,
  createdAt: createdAt ?? DEFAULT_NOW,
});

export const useReceptionStore = create<ReceptionStore>()((set) => ({
  calendarDraftSelection: undefined,
  messageDeliveries: [],
  operatingDateByWorkspace: {},
  searchQuery: "",
  selectedPatientId: DEFAULT_PATIENT_ID,
  draftCheckIns: [],
  persistedCalendarAppointments: [],
  calendarReadStatus: "idle",
  queueReadStatus: "idle",
  queueSummary: undefined,
  readRetryNonce: 0,
  applyAppointmentCreate: (appointment) =>
    set((state) => ({
      persistedCalendarAppointments: [
        appointment,
        ...state.persistedCalendarAppointments.filter(
          (item) => item.id !== appointment.id,
        ),
      ],
      selectedAppointmentId: appointment.id,
      selectedPatientId: appointment.patientId,
    })),
  applyPersistedReceptionCalendar: (records) =>
    set((state) => {
      const persistedCalendarAppointments = records.flatMap((record) =>
        record.appointment ? [record.appointment] : []
      );
      const nonCalendarDrafts = state.draftCheckIns.filter(
        (draft) => draft.source !== "persisted_calendar"
      );
      const existingEncounterIds = new Set(nonCalendarDrafts.map((draft) => draft.encounter.id));
      const persistedCalendarDrafts: ReceptionDraftCheckIn[] = records
        .filter(
          (record) =>
            record.encounter &&
            record.queueEntry &&
            isActiveReceptionQueueWork({
              encounter: record.encounter,
              queueEntry: record.queueEntry,
            }) &&
            !existingEncounterIds.has(record.encounter.id)
        )
        .map((record) => {
          const encounter = record.encounter!;
          const queueEntry = record.queueEntry!;
          return {
            appointmentId: encounter.appointmentId,
            department: encounter.department,
            durationMinutes: encounter.durationMinutes,
            encounter,
            memo: encounter.receptionMemo,
            patient: record.patient,
            primaryGuardian: record.primaryGuardian,
            queueEntry,
            receptionType: encounter.receptionType ?? (encounter.appointmentId ? "appointment" : "walk_in"),
            source: "persisted_calendar",
          };
        });

      return {
        calendarReadError: undefined,
        calendarReadStatus: "ready",
        draftCheckIns: [...nonCalendarDrafts, ...persistedCalendarDrafts],
        persistedCalendarAppointments,
      };
    }),
  applyPersistedReceptionQueue: (queue, summary) =>
    set((state) => {
      const nonPersistedDrafts = state.draftCheckIns.filter(
        (draft) => draft.source !== "persisted_queue"
      );
      const existingEncounterIds = new Set(nonPersistedDrafts.map((draft) => draft.encounter.id));
      const persistedQueueAppointments = queue.flatMap((record) => {
        if (record.kind === "appointment") return [record.appointment];
        return record.appointment ? [record.appointment] : [];
      });
      const persistedDrafts: ReceptionDraftCheckIn[] = queue
        .filter(
          (record) =>
            record.kind === "encounter_queue" &&
            isVisibleReceptionQueueWork(record) &&
            !existingEncounterIds.has(record.encounter.id)
        )
        .filter((record) => record.kind === "encounter_queue")
        .map((record) => ({
          appointmentId: record.encounter.appointmentId,
          department: record.encounter.department,
          durationMinutes: record.encounter.durationMinutes,
          encounter: record.encounter,
          memo: record.encounter.receptionMemo,
          patient: record.patient,
          primaryGuardian: record.primaryGuardian,
          queueEntry: record.queueEntry,
          receptionType: record.encounter.receptionType ?? (record.encounter.appointmentId ? "appointment" : "walk_in"),
          source: "persisted_queue",
        }));

      return {
        draftCheckIns: [...nonPersistedDrafts, ...persistedDrafts],
        persistedCalendarAppointments: [
          ...persistedQueueAppointments,
          ...state.persistedCalendarAppointments.filter(
            (appointment) =>
              !persistedQueueAppointments.some((item) => item.id === appointment.id),
          ),
        ],
        queueReadError: undefined,
        queueReadStatus: "ready",
        queueSummary: summary,
      };
    }),
  clearWorkspaceSessionDrafts: (workspaceId) =>
    set((state) => ({
      calendarDraftSelection: undefined,
      draftCheckIns: state.draftCheckIns.filter(
        (draft) =>
          draft.source !== "session" || draft.encounter.workspaceId !== workspaceId
      ),
    })),
  cancelReceptionEncounter: ({ encounterId, workspaceId }) =>
    set((state) => {
      const now = getWorkspaceOperatingNow(workspaceId);

      return {
        calendarDraftSelection:
          state.calendarDraftSelection?.id === encounterId
            ? undefined
            : state.calendarDraftSelection,
        draftCheckIns: state.draftCheckIns.map((draft) =>
          draft.encounter.workspaceId === workspaceId &&
          draft.encounter.id === encounterId
            ? {
                ...draft,
                encounter: {
                  ...draft.encounter,
                  status: "cancelled",
                  updatedAt: now,
                },
                queueEntry: {
                  ...draft.queueEntry,
                  status: "cancelled",
                  finishedAt: now,
                },
              }
            : draft,
        ),
        selectedEncounterId:
          state.selectedEncounterId === encounterId
            ? undefined
            : state.selectedEncounterId,
      };
    }),
  applyEncounterUpdate: (update) =>
    set((state) => ({
      draftCheckIns: state.draftCheckIns.map((draft) =>
        draft.encounter.id === update.encounter.id
          ? {
              ...draft,
              department: update.encounter.department,
              durationMinutes: update.encounter.durationMinutes,
              encounter: update.encounter,
              memo: update.encounter.receptionMemo,
              queueEntry: update.queueEntry ?? draft.queueEntry,
            }
          : draft,
      ),
      selectedEncounterId: update.encounter.id,
      selectedPatientId: update.encounter.patientId,
    })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  requestReceptionReadRetry: () =>
    set((state) => ({
      readRetryNonce: state.readRetryNonce + 1,
    })),
  setCalendarDraftSelection: (calendarDraftSelection) => set({ calendarDraftSelection }),
  setWorkspaceOperatingDate: (workspaceId, operatingDate) =>
    set((state) => ({
      operatingDateByWorkspace: {
        ...state.operatingDateByWorkspace,
        [workspaceId]: operatingDate,
      },
    })),
  setReceptionCalendarReadStatus: (calendarReadStatus, calendarReadError) =>
    set({ calendarReadError, calendarReadStatus }),
  setReceptionQueueReadStatus: (queueReadStatus, queueReadError) =>
    set({
      queueReadError,
      queueReadStatus,
      ...(queueReadStatus === "loading" ? { queueSummary: undefined } : {}),
    }),
  selectAppointment: (selectedAppointmentId) => set({ selectedAppointmentId }),
  selectEncounter: (selectedEncounterId) => set({ selectedEncounterId }),
  selectPatient: (selectedPatientId) =>
    set({
      selectedAppointmentId: undefined,
      selectedEncounterId: undefined,
      selectedPatientId,
    }),
  checkInAppointment: (appointment) =>
    set((state) => {
      const existingDraft = state.draftCheckIns.find(
        (draft) => draft.appointmentId === appointment.id
      );

      if (existingDraft) {
        return {
          selectedAppointmentId: appointment.id,
          selectedEncounterId: existingDraft.encounter.id,
          selectedPatientId: appointment.patientId,
        };
      }

      const index = state.draftCheckIns.length;
      const encounter = createDraftEncounter({
        appointmentId: appointment.id,
        eventTime: appointment.scheduledStartAt,
        guardianId: appointment.guardianId,
        index,
        patientId: appointment.patientId,
        plannedStartAt: appointment.scheduledStartAt,
        primaryVeterinarianId: appointment.assignedVeterinarianId,
        visitPurpose: appointment.visitPurpose,
        workspaceId: appointment.workspaceId,
      });
      const queueEntry = createDraftQueueEntry({
        encounterId: encounter.id,
        enteredAt: encounter.checkedInAt,
        index,
        workspaceId: appointment.workspaceId,
      });

      return {
        draftCheckIns: [
          ...state.draftCheckIns,
          {
            appointmentId: appointment.id,
            durationMinutes: appointment.scheduledEndAt
              ? Math.max(
                  10,
                  Math.round(
                    (new Date(appointment.scheduledEndAt).getTime() -
                      new Date(appointment.scheduledStartAt).getTime()) /
                      60000
                  )
                )
              : undefined,
            encounter,
            queueEntry,
            receptionType: "appointment",
            source: "session",
          },
        ],
        selectedAppointmentId: appointment.id,
        selectedEncounterId: encounter.id,
        selectedPatientId: appointment.patientId,
      };
    }),
  applyAppointmentCheckIn: ({ appointment, checkIn }) =>
    set((state) => {
      const existingDraft = state.draftCheckIns.find(
        (draft) => draft.appointmentId === appointment.id
      );

      if (existingDraft) {
        return {
          selectedAppointmentId: appointment.id,
          selectedEncounterId: existingDraft.encounter.id,
          selectedPatientId: appointment.patientId,
        };
      }

      return {
        draftCheckIns: [
          ...state.draftCheckIns,
          {
            appointmentId: appointment.id,
            durationMinutes: checkIn.encounter.durationMinutes,
            encounter: checkIn.encounter,
            queueEntry: checkIn.queueEntry,
            receptionType: "appointment",
            source: "session",
          },
        ],
        selectedAppointmentId: appointment.id,
        selectedEncounterId: checkIn.encounter.id,
        selectedPatientId: appointment.patientId,
      };
    }),
  createWalkInCheckIn: ({
    department,
    durationMinutes,
    guardianId,
    guardianMobilePhone,
    memo,
    patientId,
    patientName,
    plannedStartAt,
    primaryVeterinarianId,
    sendKakaoMessage,
    visitPurpose,
    workspaceId,
  }) =>
    set((state) => {
      const existingDraft = state.draftCheckIns.find(
        (draft) => !draft.appointmentId && draft.encounter.patientId === patientId
      );

      if (existingDraft) {
        return {
          selectedEncounterId: existingDraft.encounter.id,
          selectedPatientId: patientId,
        };
      }

      const index = state.draftCheckIns.length;
      const resolvedWorkspaceId = workspaceId ?? LEGACY_SALES_DEMO_WORKSPACE_ID;
      const eventTime =
        plannedStartAt ?? getWorkspaceOperatingNow(resolvedWorkspaceId);
      const encounter = createDraftEncounter({
        eventTime,
        guardianId,
        index,
        patientId,
        plannedStartAt,
        primaryVeterinarianId,
        visitPurpose,
        workspaceId: resolvedWorkspaceId,
      });
      const queueEntry = createDraftQueueEntry({
        encounterId: encounter.id,
        enteredAt: eventTime,
        index,
        workspaceId: resolvedWorkspaceId,
      });
      const messageDelivery = sendKakaoMessage
        ? createSessionCheckInMessage({
            createdAt: eventTime,
            encounterId: encounter.id,
            guardianId,
            guardianMobilePhone,
            index: state.messageDeliveries.length,
            patientId,
            patientName,
            workspaceId: resolvedWorkspaceId,
          })
        : undefined;

      return {
        draftCheckIns: [
          ...state.draftCheckIns,
          {
            department,
            durationMinutes,
            encounter,
            memo,
            plannedStartAt,
            queueEntry,
            receptionType: "walk_in",
            source: "session",
          },
        ],
        messageDeliveries: messageDelivery
          ? [...state.messageDeliveries, messageDelivery]
          : state.messageDeliveries,
        selectedEncounterId: encounter.id,
        selectedPatientId: patientId,
      };
    }),
  applyWalkInCheckIn: ({
    department,
    durationMinutes,
    guardianId,
    guardianMobilePhone,
    memo,
    patientId,
    patientName,
    plannedStartAt,
    sendKakaoMessage,
    walkIn,
  }) =>
    set((state) => {
      const existingDraft = state.draftCheckIns.find(
        (draft) => draft.encounter.id === walkIn.encounter.id
      );

      if (existingDraft) {
        return {
          selectedEncounterId: existingDraft.encounter.id,
          selectedPatientId: patientId,
        };
      }

      const messageDelivery = sendKakaoMessage
        ? createSessionCheckInMessage({
            createdAt: walkIn.encounter.checkedInAt ?? walkIn.encounter.createdAt,
            encounterId: walkIn.encounter.id,
            guardianId,
            guardianMobilePhone,
            index: state.messageDeliveries.length,
            patientId,
            patientName,
            workspaceId: walkIn.encounter.workspaceId,
          })
        : undefined;

      return {
        draftCheckIns: [
          ...state.draftCheckIns,
          {
            department,
            durationMinutes,
            encounter: walkIn.encounter,
            memo,
            plannedStartAt,
            queueEntry: walkIn.queueEntry,
            receptionType: "walk_in",
            source: "session",
          },
        ],
        messageDeliveries: messageDelivery
          ? [...state.messageDeliveries, messageDelivery]
          : state.messageDeliveries,
        selectedEncounterId: walkIn.encounter.id,
        selectedPatientId: patientId,
      };
    }),
}));
