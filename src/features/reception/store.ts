"use client";

import { create } from "zustand";
import type {
  Appointment,
  EmrId,
  Encounter,
  WaitingQueueEntry,
} from "@/types/emr-domain";

type ReceptionDraftCheckIn = {
  appointmentId?: EmrId;
  department?: string;
  durationMinutes?: number;
  encounter: Encounter;
  memo?: string;
  queueEntry: WaitingQueueEntry;
  receptionType?: "appointment" | "walk_in";
};

type ReceptionStore = {
  searchQuery: string;
  selectedAppointmentId?: EmrId;
  selectedEncounterId?: EmrId;
  selectedPatientId: EmrId;
  draftCheckIns: ReceptionDraftCheckIn[];
  setSearchQuery: (query: string) => void;
  selectAppointment: (appointmentId: EmrId) => void;
  selectEncounter: (encounterId: EmrId) => void;
  selectPatient: (patientId: EmrId) => void;
  checkInAppointment: (appointment: Appointment) => void;
  createWalkInCheckIn: (input: {
    department?: string;
    durationMinutes?: number;
    guardianId?: EmrId;
    memo?: string;
    patientId: EmrId;
    primaryVeterinarianId?: EmrId;
    visitPurpose?: string;
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

export const useReceptionStore = create<ReceptionStore>()((set) => ({
  searchQuery: "",
  selectedPatientId: DEFAULT_PATIENT_ID,
  draftCheckIns: [],
  setSearchQuery: (searchQuery) => set({ searchQuery }),
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
          },
        ],
        selectedAppointmentId: appointment.id,
        selectedEncounterId: encounter.id,
        selectedPatientId: appointment.patientId,
      };
    }),
  createWalkInCheckIn: ({
    department,
    durationMinutes,
    guardianId,
    memo,
    patientId,
    primaryVeterinarianId,
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
          },
        ],
        selectedEncounterId: encounter.id,
        selectedPatientId: patientId,
      };
    }),
}));
