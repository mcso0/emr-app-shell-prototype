"use client";

import { useCallback } from "react";

import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import { useLayoutStore } from "@/stores/layout-store";
import type { Guardian, Patient } from "@/types/emr-domain";

export function useChartPatientGuardianProfileActions({
  patient,
  primaryGuardian,
}: {
  patient?: Patient;
  primaryGuardian?: Guardian;
}) {
  const applyPatientGuardianLookupItem = usePatientProfileStore(
    (state) => state.applyPatientGuardianLookupItem,
  );
  const setActiveProfileDrawer = useLayoutStore((state) => state.setActiveProfileDrawer);

  const openPatientProfile = useCallback(() => {
    if (!patient) return;

    applyPatientGuardianLookupItem({ patient, primaryGuardian });
    setActiveProfileDrawer({ type: "patient", id: patient.id });
  }, [applyPatientGuardianLookupItem, patient, primaryGuardian, setActiveProfileDrawer]);

  const openGuardianProfile = useCallback(() => {
    if (!patient || !primaryGuardian) return;

    applyPatientGuardianLookupItem({ patient, primaryGuardian });
    setActiveProfileDrawer({ type: "guardian", id: primaryGuardian.id });
  }, [applyPatientGuardianLookupItem, patient, primaryGuardian, setActiveProfileDrawer]);

  return {
    guardianProfileAvailable: Boolean(patient && primaryGuardian),
    openGuardianProfile,
    openPatientProfile,
  };
}
