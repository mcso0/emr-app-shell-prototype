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
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);

  const openPatientProfile = useCallback(() => {
    if (!patient) return;

    applyPatientGuardianLookupItem({ patient, primaryGuardian });
    setActiveDrawer({ type: "patient", id: patient.id });
  }, [applyPatientGuardianLookupItem, patient, primaryGuardian, setActiveDrawer]);

  const openGuardianProfile = useCallback(() => {
    if (!patient || !primaryGuardian) return;

    applyPatientGuardianLookupItem({ patient, primaryGuardian });
    setActiveDrawer({ type: "guardian", id: primaryGuardian.id });
  }, [applyPatientGuardianLookupItem, patient, primaryGuardian, setActiveDrawer]);

  return {
    guardianProfileAvailable: Boolean(patient && primaryGuardian),
    openGuardianProfile,
    openPatientProfile,
  };
}
