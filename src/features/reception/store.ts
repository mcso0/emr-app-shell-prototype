"use client";

import { create } from "zustand";
import type {
  Appointment,
  EmrId,
  Encounter,
  MessageDelivery,
  WaitingQueueEntry,
} from "@/types/emr-domain";
import type { ReceptionAppointmentCheckInRecord } from "@/features/reception/appointment-check-in";
import type { ReceptionCalendarReadRecord } from "@/features/reception/reception-calendar-read";
import type { ReceptionQueueReadRecord } from "@/features/reception/reception-queue-read";
import type { ReceptionWalkInEncounterRecord } from "@/features/reception/walk-in-encounter";

type ReceptionDraftCheckIn = {
  appointmentId?: EmrId;
  department?: string;
  durationMinutes?: number;
  encounter: Encounter;
  memo?: string;
  queueEntry: WaitingQueueEntry;
  receptionType?: "appointment" | "walk_in";
  source?: "persisted_calendar" | "persisted_queue" | "session";
};

type ReceptionQueueReadStatus = "idle" | "loading" | "ready" | "error";

type ReceptionStore = {
  messageDeliveries: MessageDelivery[];
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
  readRetryNonce: number;
  applyPersistedReceptionCalendar: (records: ReceptionCalendarReadRecord[]) => void;
  applyPersistedReceptionQueue: (queue: ReceptionQueueReadRecord[]) => void;
  requestReceptionReadRetry: () => void;
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
    primaryVeterinarianId?: EmrId;
    sendKakaoMessage?: boolean;
    guardianMobilePhone?: string;
    patientName?: string;
    visitPurpose?: string;
  }) => void;
  applyWalkInCheckIn: (input: {
    department?: string;
    durationMinutes?: number;
    guardianId?: EmrId;
    guardianMobilePhone?: string;
    memo?: string;
    patientId: EmrId;
    patientName?: string;
    sendKakaoMessage?: boolean;
    visitPurpose?: string;
    walkIn: ReceptionWalkInEncounterRecord;
  }) => void;
};

const WORKSPACE_ID = "clair-demo";
const DEFAULT_PATIENT_ID = "patient-coco";
const DEFAULT_NOW = "2026-05-01T10:45:00+09:00";

const createDraftEncounter = ({
  appointmentId,
  guardianId,
  index,
  patientId,
  primaryVeterinarianId,
  visitPurpose,
}: {
  appointmentId?: EmrId;
  guardianId?: EmrId;
  index: number;
  patientId: EmrId;
  primaryVeterinarianId?: EmrId;
  visitPurpose?: string;
}): Encounter => {
  const suffix = String(index + 10).padStart(4, "0");
  const id = appointmentId ? `draft-encounter-${appointmentId}` : `draft-encounter-walkin-${patientId}`;

  return {
    id,
    workspaceId: WORKSPACE_ID,
    patientId,
    guardianId,
    appointmentId,
    primaryVeterinarianId,
    encounterNo: `E-260501-${suffix}`,
    chiefComplaint: visitPurpose,
    visitPurpose: visitPurpose ?? "현장 접수",
    status: "waiting",
    checkedInAt: DEFAULT_NOW,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
  };
};

const createDraftQueueEntry = ({
  encounterId,
  index,
}: {
  encounterId: EmrId;
  index: number;
}): WaitingQueueEntry => ({
  id: `draft-queue-${encounterId}`,
  workspaceId: WORKSPACE_ID,
  encounterId,
  queueType: "consultation",
  status: "waiting",
  priority: "normal",
  sortOrder: index + 10,
  enteredAt: DEFAULT_NOW,
});

const createSessionCheckInMessage = ({
  encounterId,
  guardianId,
  guardianMobilePhone,
  index,
  patientId,
  patientName,
}: {
  encounterId: EmrId;
  guardianId?: EmrId;
  guardianMobilePhone?: string;
  index: number;
  patientId: EmrId;
  patientName?: string;
}): MessageDelivery => ({
  id: `session-message-checkin-${encounterId}-${index}`,
  workspaceId: WORKSPACE_ID,
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
  sentAt: DEFAULT_NOW,
  createdAt: DEFAULT_NOW,
});

export const useReceptionStore = create<ReceptionStore>()((set) => ({
  messageDeliveries: [],
  searchQuery: "",
  selectedPatientId: DEFAULT_PATIENT_ID,
  draftCheckIns: [],
  persistedCalendarAppointments: [],
  calendarReadStatus: "idle",
  queueReadStatus: "idle",
  readRetryNonce: 0,
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
  applyPersistedReceptionQueue: (queue) =>
    set((state) => {
      const nonPersistedDrafts = state.draftCheckIns.filter(
        (draft) => draft.source !== "persisted_queue"
      );
      const existingEncounterIds = new Set(nonPersistedDrafts.map((draft) => draft.encounter.id));
      const persistedDrafts: ReceptionDraftCheckIn[] = queue
        .filter((record) => !existingEncounterIds.has(record.encounter.id))
        .map((record) => ({
          appointmentId: record.encounter.appointmentId,
          department: record.encounter.department,
          durationMinutes: record.encounter.durationMinutes,
          encounter: record.encounter,
          memo: record.encounter.receptionMemo,
          queueEntry: record.queueEntry,
          receptionType: record.encounter.receptionType ?? (record.encounter.appointmentId ? "appointment" : "walk_in"),
          source: "persisted_queue",
        }));

      return {
        draftCheckIns: [...nonPersistedDrafts, ...persistedDrafts],
        queueReadError: undefined,
        queueReadStatus: "ready",
      };
    }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  requestReceptionReadRetry: () =>
    set((state) => ({
      readRetryNonce: state.readRetryNonce + 1,
    })),
  setReceptionCalendarReadStatus: (calendarReadStatus, calendarReadError) =>
    set({ calendarReadError, calendarReadStatus }),
  setReceptionQueueReadStatus: (queueReadStatus, queueReadError) =>
    set({ queueReadError, queueReadStatus }),
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
        guardianId: appointment.guardianId,
        index,
        patientId: appointment.patientId,
        primaryVeterinarianId: appointment.assignedVeterinarianId,
        visitPurpose: appointment.visitPurpose,
      });
      const queueEntry = createDraftQueueEntry({ encounterId: encounter.id, index });

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
    primaryVeterinarianId,
    sendKakaoMessage,
    visitPurpose,
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
      const encounter = createDraftEncounter({
        guardianId,
        index,
        patientId,
        primaryVeterinarianId,
        visitPurpose,
      });
      const queueEntry = createDraftQueueEntry({ encounterId: encounter.id, index });
      const messageDelivery = sendKakaoMessage
        ? createSessionCheckInMessage({
            encounterId: encounter.id,
            guardianId,
            guardianMobilePhone,
            index: state.messageDeliveries.length,
            patientId,
            patientName,
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
    sendKakaoMessage,
    visitPurpose,
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
            encounterId: walkIn.encounter.id,
            guardianId,
            guardianMobilePhone,
            index: state.messageDeliveries.length,
            patientId,
            patientName,
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
