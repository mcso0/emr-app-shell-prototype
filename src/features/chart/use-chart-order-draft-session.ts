"use client";

import { useCallback, useRef, useState, type SetStateAction } from "react";
import type { ChartOrderDraftRow, ChartOrderDraftSaveState } from "./chart-order-draft-types";

export const chartOrderDiscreteSaveDelayMs = 150;
export const chartOrderContinuousSaveDelayMs = 700;

// A mounted OrderArea owns these rows, edit versions and save acknowledgements.
// The executor uses this same session; display code only reads its state.
export function useChartOrderDraftSession(initialDraftRows: ChartOrderDraftRow[]) {
  const [committedRows, setCommittedRows] =
    useState<ChartOrderDraftRow[]>(initialDraftRows);
  const [draftRows, setDraftRowsState] =
    useState<ChartOrderDraftRow[]>(initialDraftRows);
  const draftRowsRef = useRef(draftRows);
  const setDraftRows = useCallback(
    (nextRows: SetStateAction<ChartOrderDraftRow[]>) => {
      setDraftRowsState((currentRows) => {
        const resolvedRows =
          typeof nextRows === "function" ? nextRows(currentRows) : nextRows;
        draftRowsRef.current = resolvedRows;
        return resolvedRows;
      });
    },
    [],
  );
  const [orderDraftSaveState, setOrderDraftSaveStateValue] = useState<ChartOrderDraftSaveState>("idle");
  const [orderNoticeVersion, setOrderNoticeVersion] = useState(0);
  const setOrderDraftSaveState = useCallback((state: typeof orderDraftSaveState) => {
    setOrderDraftSaveStateValue(state);
    if (state === "error" || state === "conflict") setOrderNoticeVersion((version) => version + 1);
  }, []);
  const [orderDraftEtag, setOrderDraftEtag] = useState<string | undefined>();
  const orderDraftEtagRef = useRef(orderDraftEtag);
  const [orderDraftReloadKey, setOrderDraftReloadKey] = useState(0);
  const draftTouchedRef = useRef(false);
  const draftEditVersionRef = useRef(0);
  const draftSaveDelayMsRef = useRef(chartOrderContinuousSaveDelayMs);
  const orderDraftFailedAutoSaveVersionRef = useRef<number | null>(null);
  const orderDraftConflictRef = useRef(false);
  const orderDraftSaveInFlightRef = useRef(false);
  const orderDraftSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const autoSaveDraftRef = useRef<() => Promise<boolean>>(async () => false);
  const inFlightDraftOrderIdsRef = useRef<Set<string>>(new Set());
  const pendingAddedOrderIdsRef = useRef<Set<string>>(new Set());
  const pendingRemovedRootOrderIdsRef = useRef<Set<string>>(new Set());
  const [pendingRemovedRootOrderIds, setPendingRemovedRootOrderIds] = useState<
    Set<string>
  >(() => new Set());
  const markDraftTouched = (
    saveTiming: "continuous" | "discrete" = "continuous",
  ) => {
    draftTouchedRef.current = true;
    draftEditVersionRef.current += 1;
    draftSaveDelayMsRef.current =
      saveTiming === "discrete"
        ? chartOrderDiscreteSaveDelayMs
        : chartOrderContinuousSaveDelayMs;
    orderDraftFailedAutoSaveVersionRef.current = null;
  };
  return {
    committedRows,
    setCommittedRows,
    draftRows,
    draftRowsRef,
    setDraftRows,
    orderDraftSaveState,
    orderNoticeVersion,
    setOrderDraftSaveState,
    orderDraftEtag,
    orderDraftEtagRef,
    setOrderDraftEtag,
    orderDraftReloadKey,
    setOrderDraftReloadKey,
    draftTouchedRef,
    draftEditVersionRef,
    draftSaveDelayMsRef,
    orderDraftFailedAutoSaveVersionRef,
    orderDraftConflictRef,
    orderDraftSaveInFlightRef,
    orderDraftSavePromiseRef,
    autoSaveDraftRef,
    inFlightDraftOrderIdsRef,
    pendingAddedOrderIdsRef,
    pendingRemovedRootOrderIdsRef,
    pendingRemovedRootOrderIds,
    setPendingRemovedRootOrderIds,
    markDraftTouched,
  };
}
