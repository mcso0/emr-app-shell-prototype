"use client";

import type { Encounter, Guardian, Patient } from "@/types/emr-domain";

const storageKey = "clair-emr:chart-live-encounter-handoffs:v1";
const maxHandoffs = 20;

export type ChartLiveEncounterHandoff = {
  encounter: Encounter;
  patient: Patient;
  primaryGuardian?: Guardian;
  updatedAt: string;
};

type StoredHandoffs = Record<string, ChartLiveEncounterHandoff>;

export function saveChartLiveEncounterHandoff({
  encounter,
  patient,
  primaryGuardian,
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
