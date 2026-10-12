"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReceptionPatientSummary } from "./data";
import type { ReceptionPatientGuardianLookupItem, ReceptionPatientGuardianLookupResponse } from "./patient-guardian-lookup";
import { getReceptionPatientOptionLabel, mapLookupItemToReceptionPatientSummary } from "./reception-patient-lookup-model";

export type ReceptionPatientLookupState = "idle" | "loading" | "error";

export const receptionPatientLookupDebounceMs = 275;

export function useReceptionPatientLookup({
  authSessionId,
  patientSummaries,
  workspaceId,
}: {
  authSessionId?: string;
  patientSummaries: ReceptionPatientSummary[];
  workspaceId: string;
}) {
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<
    ReceptionPatientGuardianLookupItem[]
  >([]);
  const [lookupState, setLookupState] =
    useState<ReceptionPatientLookupState>("idle");
  const [patientId, setPatientId] = useState("");
  const [selectedLookupSummary, setSelectedLookupSummary] =
    useState<ReceptionPatientSummary>();
  const lookupRequestSeqRef = useRef(0);
  const lastSuccessfulLookupKeyRef = useRef("");
  const lookupActive = lookupQuery.trim().length > 0;
  const lookupPatientSummaries = useMemo(
    () => lookupResults.map(mapLookupItemToReceptionPatientSummary),
    [lookupResults],
  );
  const selectablePatientSummaries = lookupActive
    ? lookupPatientSummaries
    : patientSummaries;
  const patientSummaryOptions = useMemo(() => {
    const summaries = [
      ...(selectedLookupSummary ? [selectedLookupSummary] : []),
      ...lookupPatientSummaries,
      ...patientSummaries,
    ];
    const uniqueSummaries = new Map<string, ReceptionPatientSummary>();

    summaries.forEach((summary) =>
      uniqueSummaries.set(summary.patient.id, summary),
    );

    return Array.from(uniqueSummaries.values());
  }, [lookupPatientSummaries, patientSummaries, selectedLookupSummary]);
  const selectedSummary = patientSummaryOptions.find(
    (summary) => summary.patient.id === patientId,
  );
  const selectedPatientLabel = selectedSummary
    ? getReceptionPatientOptionLabel(selectedSummary)
    : "";

  useEffect(() => {
    const query = lookupQuery.trim();
    if (!query) {
      lastSuccessfulLookupKeyRef.current = "";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLookupResults([]);
      setLookupState("idle");
      return;
    }

    if (selectedSummary && query === selectedPatientLabel.trim()) {
      return;
    }

    const lookupKey = `${workspaceId}\u0000${authSessionId ?? ""}\u0000${query}`;
    if (lookupKey === lastSuccessfulLookupKeyRef.current) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const requestSeq = lookupRequestSeqRef.current + 1;
    lookupRequestSeqRef.current = requestSeq;

    async function loadLookup() {
      if (cancelled || requestSeq !== lookupRequestSeqRef.current) return;
      setLookupState("loading");

      try {
        const headers = authSessionId
          ? { "x-clair-demo-session-user-id": authSessionId }
          : undefined;
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/patient-guardian-lookup?query=${encodeURIComponent(query)}`,
          {
            cache: "no-store",
            headers,
            signal: controller.signal,
          },
        );
        const result =
          (await response.json()) as ReceptionPatientGuardianLookupResponse;

        if (cancelled || requestSeq !== lookupRequestSeqRef.current) return;

        if (!response.ok || !result.ok) {
          setLookupResults([]);
          setLookupState("error");
          return;
        }

        setLookupResults(result.patients);
        setLookupState("idle");
        lastSuccessfulLookupKeyRef.current = lookupKey;
      } catch (error) {
        if (
          !cancelled &&
          requestSeq === lookupRequestSeqRef.current &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setLookupResults([]);
          setLookupState("error");
        }
      }
    }

    const debounceTimer = window.setTimeout(() => {
      void loadLookup();
    }, receptionPatientLookupDebounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [
    authSessionId,
    lookupQuery,
    selectedPatientLabel,
    selectedSummary,
    workspaceId,
  ]);

  const updateLookupQuery = useCallback(
    (value: string) => {
      setLookupQuery(value);
      if (selectedSummary && value !== selectedPatientLabel) {
        setPatientId("");
      }
    },
    [selectedPatientLabel, selectedSummary],
  );

  const selectPatientSummary = useCallback((summary: ReceptionPatientSummary) => {
    setPatientId(summary.patient.id);
    setSelectedLookupSummary(summary);
    setLookupQuery(getReceptionPatientOptionLabel(summary));
  }, []);

  const clearPatientSelection = useCallback(() => {
    setPatientId("");
    setLookupQuery("");
    setLookupResults([]);
    setLookupState("idle");
    setSelectedLookupSummary(undefined);
  }, []);

  return {
    clearPatientSelection,
    lookupActive,
    lookupQuery,
    lookupState,
    patientId,
    selectPatientSummary,
    selectablePatientSummaries,
    selectedSummary,
    updateLookupQuery,
  };
}
