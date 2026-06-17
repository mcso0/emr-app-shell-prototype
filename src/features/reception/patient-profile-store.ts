"use client";

import { create } from "zustand";
import {
  MOCK_WORKSPACE_ID,
  mockConsents,
  mockGuardians,
  mockPatientGuardians,
  mockPatients,
} from "@/mocks/emr-domain";
import type { Consent, ConsentType, EmrId, Guardian, Patient, PatientGuardian, PatientSex } from "@/types/emr-domain";
import type { ReceptionPatientGuardianRegistrationRecord } from "@/features/reception/patient-guardian-registration";
import type { ReceptionPatientGuardianLookupItem } from "@/features/reception/patient-guardian-lookup";

type NewPatientInput = {
  birthDate?: string;
  breed?: string;
  estimatedAgeText?: string;
  existingGuardianId?: EmrId;
  guardianMobilePhone?: string;
  guardianName: string;
  microchipNo?: string;
  name: string;
  neutered?: boolean;
  patientRegistrationNo?: string;
  sex?: PatientSex;
  species: Patient["species"];
  specialNote?: string;
};

type NewGuardianInput = {
  address?: string;
  birthDate?: string;
  email?: string;
  marketingConsent?: boolean;
  memo?: string;
  mobilePhone?: string;
  name: string;
  phone?: string;
  privacyConsent?: boolean;
};

type PatientProfileStore = {
  consents: Consent[];
  guardians: Guardian[];
  patientGuardians: PatientGuardian[];
  patients: Patient[];
  addGuardian: (input: NewGuardianInput) => { duplicateGuardianId?: EmrId; error?: string; guardianId?: EmrId };
  addPatient: (input: NewPatientInput) => { duplicateGuardianId?: EmrId; error?: string; patientId?: EmrId };
  applyPatientGuardianLookupItem: (item: ReceptionPatientGuardianLookupItem) => EmrId;
  applyPatientGuardianLookupItems: (items: ReceptionPatientGuardianLookupItem[]) => void;
  applyPatientGuardianRegistration: (registration: ReceptionPatientGuardianRegistrationRecord) => EmrId;
  hasDuplicatePatientNameForGuardian: (guardianId: EmrId, patientName: string) => boolean;
  setPrimaryGuardian: (patientId: EmrId, guardianId: EmrId) => void;
  toggleGuardianMessageConsent: (patientId: EmrId, guardianId: EmrId) => void;
  updateGuardian: (guardianId: EmrId, patch: Partial<Guardian>) => void;
  updatePatient: (patientId: EmrId, patch: Partial<Patient>) => void;
};

const NOW = "2026-05-02T09:00:00+09:00";

const clonePatients = () => mockPatients.map((patient) => ({ ...patient }));
const cloneGuardians = () => mockGuardians.map((guardian) => ({ ...guardian }));
const clonePatientGuardians = () => mockPatientGuardians.map((link) => ({ ...link }));
const cloneConsents = () => mockConsents.map((consent) => ({ ...consent }));

const createPatientNo = (index: number) => `P-260502-${String(index + 1).padStart(4, "0")}`;

export const normalizeGuardianPhone = (phone?: string) => phone?.replace(/\D/g, "") ?? "";

const findDuplicateGuardianByMobilePhone = (guardians: Guardian[], mobilePhone?: string) => {
  const normalizedMobilePhone = normalizeGuardianPhone(mobilePhone);

  if (!normalizedMobilePhone) return undefined;

  return guardians.find(
    (guardian) => normalizeGuardianPhone(guardian.mobilePhone) === normalizedMobilePhone
  );
};

const createSessionConsent = ({
  consentType,
  guardianId,
  index,
  patientId,
}: {
  consentType: ConsentType;
  guardianId: EmrId;
  index: number;
  patientId?: EmrId;
}): Consent => ({
  id: `session-consent-${consentType}-${Date.now()}-${index}`,
  workspaceId: MOCK_WORKSPACE_ID,
  guardianId,
  patientId,
  consentType,
  status: "granted",
  signedAt: NOW,
  documentUrl: `/mock-documents/session-consents/${guardianId}-${consentType}.pdf`,
});

export const usePatientProfileStore = create<PatientProfileStore>()((set, get) => ({
  consents: cloneConsents(),
  guardians: cloneGuardians(),
  patientGuardians: clonePatientGuardians(),
  patients: clonePatients(),
  addGuardian: (input) => {
    const name = input.name.trim();

    if (!name) return { error: "보호자명은 필수입니다." };
    if (!input.privacyConsent) return { error: "개인정보 수집 동의가 필요합니다." };

    const duplicateGuardian = findDuplicateGuardianByMobilePhone(get().guardians, input.mobilePhone);
    if (duplicateGuardian) {
      return {
        duplicateGuardianId: duplicateGuardian.id,
        error: "이미 등록된 보호자입니다.",
      };
    }

    const guardianId = `session-guardian-${Date.now()}`;
    const nextGuardian: Guardian = {
      id: guardianId,
      workspaceId: MOCK_WORKSPACE_ID,
      name,
      mobilePhone: input.mobilePhone?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      birthDate: input.birthDate?.trim() || undefined,
      address: input.address?.trim() || undefined,
      memo: input.memo?.trim() || undefined,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const nextConsents = [
      createSessionConsent({ consentType: "privacy", guardianId, index: 0 }),
      ...(input.marketingConsent
        ? [createSessionConsent({ consentType: "marketing", guardianId, index: 1 })]
        : []),
    ];

    set((state) => ({
      consents: [...state.consents, ...nextConsents],
      guardians: [...state.guardians, nextGuardian],
    }));

    return { guardianId };
  },
  addPatient: (input) => {
    const name = input.name.trim();
    const guardianName = input.guardianName.trim();
    const microchipNo = input.microchipNo?.trim();
    const existingGuardian = input.existingGuardianId
      ? get().guardians.find((guardian) => guardian.id === input.existingGuardianId)
      : undefined;

    if (!name) return { error: "환자명은 필수입니다." };
    if (!existingGuardian && !guardianName) return { error: "보호자명은 필수입니다." };
    if (!existingGuardian) {
      const duplicateGuardian = findDuplicateGuardianByMobilePhone(
        get().guardians,
        input.guardianMobilePhone
      );
      if (duplicateGuardian) {
        return {
          duplicateGuardianId: duplicateGuardian.id,
          error: "이미 등록된 보호자입니다. 기존 보호자를 선택해 연결해 주세요.",
        };
      }
    }
    if (
      microchipNo &&
      get().patients.some((patient) => patient.microchipNo === microchipNo)
    ) {
      return { error: "이미 등록된 마이크로칩 번호입니다." };
    }

    const patientId = `session-patient-${Date.now()}`;
    const guardianId = existingGuardian?.id ?? `session-guardian-${Date.now()}`;
    const nextPatient: Patient = {
      id: patientId,
      patientNo: createPatientNo(get().patients.length - mockPatients.length),
      workspaceId: MOCK_WORKSPACE_ID,
      name,
      species: input.species,
      breed: input.breed?.trim() || undefined,
      birthDate: input.birthDate?.trim() || undefined,
      estimatedAgeText: input.estimatedAgeText?.trim() || undefined,
      sex: input.sex ?? "unknown",
      neutered: input.neutered ?? false,
      microchipNo,
      patientRegistrationNo: input.patientRegistrationNo?.trim() || undefined,
      weightKg: undefined,
      specialNote: input.specialNote?.trim() || undefined,
      handlingCautionLocked: true,
      status: "active",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const nextGuardian: Guardian | undefined = existingGuardian
      ? undefined
      : {
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
      guardians: nextGuardian ? [...state.guardians, nextGuardian] : state.guardians,
      patientGuardians: [...state.patientGuardians, nextLink],
      patients: [...state.patients, nextPatient],
    }));

    return { patientId };
  },
  applyPatientGuardianLookupItem: (item) => {
    set((state) => {
      const primaryLink: PatientGuardian | undefined = item.primaryGuardian
        ? {
            id: `live-pg-${item.patient.id}-${item.primaryGuardian.id}`,
            patientId: item.patient.id,
            guardianId: item.primaryGuardian.id,
            relationship: "주보호자",
            isPrimary: true,
            canReceiveMessages: true,
            createdAt: item.patient.createdAt,
          }
        : undefined;

      return {
        guardians: item.primaryGuardian
          ? mergeById(state.guardians, [item.primaryGuardian])
          : state.guardians,
        patientGuardians: primaryLink
          ? mergeById(state.patientGuardians, [primaryLink])
          : state.patientGuardians,
        patients: mergeById(state.patients, [item.patient]),
      };
    });

    return item.patient.id;
  },
  applyPatientGuardianLookupItems: (items) => {
    set((state) => {
      const primaryLinks: PatientGuardian[] = items.flatMap((item) =>
        item.primaryGuardian
          ? [
              {
                id: `live-pg-${item.patient.id}-${item.primaryGuardian.id}`,
                patientId: item.patient.id,
                guardianId: item.primaryGuardian.id,
                relationship: "주보호자",
                isPrimary: true,
                canReceiveMessages: true,
                createdAt: item.patient.createdAt,
              },
            ]
          : [],
      );
      const guardians = items.flatMap((item) =>
        item.primaryGuardian ? [item.primaryGuardian] : [],
      );

      return {
        guardians: mergeById(state.guardians, guardians),
        patientGuardians: mergeById(state.patientGuardians, primaryLinks),
        patients: mergeById(
          state.patients,
          items.map((item) => item.patient),
        ),
      };
    });
  },
  applyPatientGuardianRegistration: (registration) => {
    set((state) => ({
      consents: mergeById(state.consents, registration.consents),
      guardians: mergeById(state.guardians, [registration.guardian]),
      patientGuardians: mergeById(state.patientGuardians, [registration.patientGuardian]),
      patients: mergeById(state.patients, [registration.patient]),
    }));

    return registration.patient.id;
  },
  hasDuplicatePatientNameForGuardian: (guardianId, patientName) => {
    const normalizedPatientName = patientName.trim();

    if (!normalizedPatientName) return false;

    const patientIds = new Set(
      get()
        .patientGuardians.filter((link) => link.guardianId === guardianId)
        .map((link) => link.patientId)
    );

    return get().patients.some(
      (patient) => patientIds.has(patient.id) && patient.name === normalizedPatientName
    );
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

function mergeById<T extends { id: EmrId }>(current: T[], incoming: T[]) {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...current.filter((item) => !incomingIds.has(item.id)), ...incoming];
}
