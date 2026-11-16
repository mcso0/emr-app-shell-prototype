"use client";

import type { Encounter, Guardian, Patient } from "@/types/emr-domain";
import type { ChartPreconsultationContext } from "./preconsultation-context";

const storageKey = "clair-emr:chart-live-encounter-handoffs:v1";
const maxHandoffs = 20;

export type ChartLiveEncounterHandoff = {
  encounter: Encounter;
  patient: Patient;
  primaryGuardian?: Guardian;
  updatedAt: string;
  veterinarianName?: string;
};

type StoredHandoffs = Record<string, ChartLiveEncounterHandoff>;

export function saveChartPreconsultationHandoff(workspaceId: string, context: ChartPreconsultationContext) {
  const { encounter, patient, guardian, veterinarian } = context;
  const referenceTime = encounter.checkedInAt;

  saveChartLiveEncounterHandoff({
    encounter: {
      ...encounter,
      workspaceId,
      patientId: patient.id,
      guardianId: guardian?.id,
      primaryVeterinarianId: veterinarian?.id,
      status: encounter.status as Encounter["status"],
      createdAt: referenceTime,
      updatedAt: referenceTime,
    },
    patient: {
      ...patient,
      workspaceId,
      species: patient.species as Patient["species"],
      sex: patient.sex as Patient["sex"],
      handlingCautionLocked: true,
      status: "active",
      createdAt: referenceTime,
      updatedAt: referenceTime,
    },
    primaryGuardian: guardian ? {
      ...guardian,
      workspaceId,
      createdAt: referenceTime,
      updatedAt: referenceTime,
    } : undefined,
    veterinarianName: veterinarian?.displayName,
  });
}

export function saveChartLiveEncounterHandoff({
  encounter,
  patient,
  primaryGuardian,
  veterinarianName,
}: Omit<ChartLiveEncounterHandoff, "updatedAt">) {
  if (typeof window === "undefined") return;

  const current = readStoredHandoffs();
  const next: StoredHandoffs = {
    ...current,
    [encounter.id]: {
      encounter,
      patient,
      primaryGuardian,
      updatedAt: new Date().toISOString(),
      veterinarianName,
    },
  };
  const trimmed = Object.fromEntries(
    Object.entries(next)
      .sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, maxHandoffs)
  );

  window.sessionStorage.setItem(storageKey, JSON.stringify(trimmed));
}

export function readChartLiveEncounterHandoff(
  encounterId: string
): ChartLiveEncounterHandoff | null {
  if (typeof window === "undefined") return null;

  return readStoredHandoffs()[encounterId] ?? null;
}

function readStoredHandoffs(): StoredHandoffs {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;

    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, ChartLiveEncounterHandoff] =>
        isChartLiveEncounterHandoff(entry[1])
      )
    );
  } catch {
    return {};
  }
}

function isChartLiveEncounterHandoff(value: unknown): value is ChartLiveEncounterHandoff {
  if (!value || typeof value !== "object") return false;

  const row = value as Partial<ChartLiveEncounterHandoff>;
  return (
    Boolean(row.encounter) &&
    typeof row.encounter?.id === "string" &&
    Boolean(row.patient) &&
    typeof row.patient?.id === "string" &&
    typeof row.updatedAt === "string"
  );
}
