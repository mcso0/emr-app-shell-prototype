"use client";

import { create } from "zustand";
import {
  MOCK_WORKSPACE_ID,
  mockGuardians,
  mockPatientGuardians,
  mockPatients,
} from "@/mocks/emr-domain";
import type { EmrId, Guardian, Patient, PatientGuardian } from "@/types/emr-domain";

type NewPatientInput = {
  breed?: string;
  guardianMobilePhone?: string;
  guardianName: string;
  microchipNo?: string;
  name: string;
  species: Patient["species"];
};

type PatientProfileStore = {
  guardians: Guardian[];
  patientGuardians: PatientGuardian[];
  patients: Patient[];
  addPatient: (input: NewPatientInput) => { error?: string; patientId?: EmrId };
  setPrimaryGuardian: (patientId: EmrId, guardianId: EmrId) => void;
  toggleGuardianMessageConsent: (patientId: EmrId, guardianId: EmrId) => void;
  updateGuardian: (guardianId: EmrId, patch: Partial<Guardian>) => void;
  updatePatient: (patientId: EmrId, patch: Partial<Patient>) => void;
};

const NOW = "2026-05-02T09:00:00+09:00";

const clonePatients = () => mockPatients.map((patient) => ({ ...patient }));
const cloneGuardians = () => mockGuardians.map((guardian) => ({ ...guardian }));
const clonePatientGuardians = () => mockPatientGuardians.map((link) => ({ ...link }));

const createPatientNo = (index: number) => `P-260502-${String(index + 1).padStart(4, "0")}`;

export const usePatientProfileStore = create<PatientProfileStore>()((set, get) => ({
  guardians: cloneGuardians(),
  patientGuardians: clonePatientGuardians(),
  patients: clonePatients(),
  addPatient: (input) => {
    const name = input.name.trim();
    const guardianName = input.guardianName.trim();
    const microchipNo = input.microchipNo?.trim();

    if (!name) return { error: "환자명은 필수입니다." };
    if (!guardianName) return { error: "보호자명은 필수입니다." };
    if (
      microchipNo &&
      get().patients.some((patient) => patient.microchipNo === microchipNo)
    ) {
      return { error: "이미 등록된 마이크로칩 번호입니다." };
    }

    const patientId = `session-patient-${Date.now()}`;
    const guardianId = `session-guardian-${Date.now()}`;
    const nextPatient: Patient = {
      id: patientId,
      patientNo: createPatientNo(get().patients.length - mockPatients.length),
      workspaceId: MOCK_WORKSPACE_ID,
      name,
      species: input.species,
      breed: input.breed?.trim() || undefined,
      sex: "unknown",
      neutered: false,
      microchipNo,
      handlingCautionLocked: true,
      status: "active",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const nextGuardian: Guardian = {
      id: guardianId,
      workspaceId: MOCK_WORKSPACE_ID,
      name: guardianName,
      mobilePhone: input.guardianMobilePhone?.trim() || undefined,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const nextLink: PatientGuardian = {
      id: `session-pg-${Date.now()}`,
      patientId,
      guardianId,
      relationship: "주보호자",
      isPrimary: true,
      canReceiveMessages: true,
      createdAt: NOW,
    };

    set((state) => ({
      guardians: [...state.guardians, nextGuardian],
      patientGuardians: [...state.patientGuardians, nextLink],
      patients: [...state.patients, nextPatient],
    }));

    return { patientId };
  },
  setPrimaryGuardian: (patientId, guardianId) =>
    set((state) => ({
      patientGuardians: state.patientGuardians.map((link) =>
        link.patientId === patientId
          ? { ...link, isPrimary: link.guardianId === guardianId }
          : link
      ),
    })),
  toggleGuardianMessageConsent: (patientId, guardianId) =>
    set((state) => ({
      patientGuardians: state.patientGuardians.map((link) =>
        link.patientId === patientId && link.guardianId === guardianId
          ? { ...link, canReceiveMessages: !link.canReceiveMessages }
          : link
      ),
    })),
  updateGuardian: (guardianId, patch) =>
    set((state) => ({
      guardians: state.guardians.map((guardian) =>
        guardian.id === guardianId
          ? { ...guardian, ...patch, updatedAt: NOW }
          : guardian
      ),
    })),
  updatePatient: (patientId, patch) =>
    set((state) => ({
      patients: state.patients.map((patient) =>
        patient.id === patientId
          ? { ...patient, ...patch, updatedAt: NOW }
          : patient
      ),
    })),
}));
