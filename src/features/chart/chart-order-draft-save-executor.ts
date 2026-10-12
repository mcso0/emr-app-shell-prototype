import type { Dispatch, SetStateAction } from "react";
import type { Encounter } from "@/types/emr-domain";
import type { ChartOrderBillingSummary } from "./chart-order-billing-summary-contract";
import type { ChartOrderRuntimeRow } from "./server-order-draft-persistence-core";
import type { ChartOrderDraftRow, ChartOrderDraftRouteResponse } from "./chart-order-draft-types";
import { chartOrderContinuousSaveDelayMs, type useChartOrderDraftSession } from "./use-chart-order-draft-session";
import { getChartOrderDraftInFlightSave, registerChartOrderDraftSaveOperation } from "./chart-order-draft-save-operation";
import { isChartOrderDraftRowInRootIds, prepareChartOrderDraftRowsForPersistence, remapChartOrderIdSet } from "./chart-order-draft-identity";
import { mergeChartOrderDraftRowsAfterSave } from "./chart-order-draft-response-merge";
import { classifyChartOrderSaveFailure } from "./chart-order-save-failure-decision";

type DraftSavePorts = {
  session: ReturnType<typeof useChartOrderDraftSession>;
  writeDisabled: boolean;
  draftWriteDisabled: boolean;
  orderDraftReadError: boolean;
  mutationChartId?: string;
  actorHeaders?: Record<string, string>;
  bundle: { encounter: Pick<Encounter, "id" | "workspaceId" | "primaryVeterinarianId"> };
  saveChartOrderDraftRoute: (input: {
    chartId?: string; actorHeaders?: Record<string, string>; encounterId: string;
    expectedEtag: string; primaryVeterinarianId?: string; removedOrderIds: string[];
    rows: ChartOrderDraftRow[]; workspaceId: string;
  }) => Promise<ChartOrderDraftRouteResponse>;
  createChartOrderDraftId: () => string;
  setSelectedOrderIds: Dispatch<SetStateAction<Set<string>>>;
  applyPersistedOrderDrafts: (rows: ChartOrderDraftRow[], snapshots: ChartOrderRuntimeRow[], workspaceId: string, options: { preserveMissingRows?: boolean }) => ChartOrderDraftRow[];
  acceptAuthoritativeBillingSummary: (summary: ChartOrderBillingSummary) => boolean;
  refreshBillingSummary: () => Promise<boolean>;
  getChartOrderPersistenceErrorMessage: (error?: string) => string;
  toast: { error: (message: string) => unknown; success: (message: string) => unknown };
};

// Keep one Promise per mounted editing session. A successful acknowledgement
// reconciles only the submitted version; later edits stay pending and drain next.
export function createChartOrderDraftSaveExecutor({
  session,
  writeDisabled,
  draftWriteDisabled,
  orderDraftReadError,
  mutationChartId,
  actorHeaders,
  bundle,
  saveChartOrderDraftRoute,
  createChartOrderDraftId,
  setSelectedOrderIds,
  applyPersistedOrderDrafts,
  acceptAuthoritativeBillingSummary,
  refreshBillingSummary,
  getChartOrderPersistenceErrorMessage,
  toast,
}: DraftSavePorts) {
  const {
    orderDraftSavePromiseRef,
    orderDraftSaveInFlightRef,
    orderDraftSaveState,
    draftTouchedRef,
    draftEditVersionRef,
    pendingRemovedRootOrderIdsRef,
    pendingAddedOrderIdsRef,
    draftRowsRef,
    setDraftRows,
    orderDraftEtagRef,
    setOrderDraftSaveState,
    inFlightDraftOrderIdsRef,
    setPendingRemovedRootOrderIds,
    orderDraftConflictRef,
    orderDraftFailedAutoSaveVersionRef,
    setCommittedRows,
    setOrderDraftEtag,
    draftSaveDelayMsRef,
  } = session;
  return ({ silent = false } = {}): Promise<boolean> => {
    const inFlightSave = getChartOrderDraftInFlightSave(
      orderDraftSavePromiseRef,
      orderDraftSaveInFlightRef,
    );
    if (inFlightSave) return inFlightSave;
    if (
      writeDisabled || draftWriteDisabled || orderDraftReadError ||
      orderDraftSaveState === "loading" ||
      orderDraftSaveState === "saving" ||
      orderDraftSaveState === "conflict"
    )
      return Promise.resolve(false);

    const operation = (async () => {
      orderDraftSaveInFlightRef.current = true;
      while (draftTouchedRef.current) {
        const attemptedDraftEditVersion = draftEditVersionRef.current;
        const attemptedRemovedRootOrderIds = new Set(
          pendingRemovedRootOrderIdsRef.current,
        );
        const attemptedAddedOrderIds = new Set(pendingAddedOrderIdsRef.current);
        const isAttemptedRemovalRow = (row: ChartOrderDraftRow) =>
          isChartOrderDraftRowInRootIds(row, attemptedRemovedRootOrderIds);
        const persistenceSourceRows = draftRowsRef.current.filter(
          (row) => !isAttemptedRemovalRow(row),
        );
        const preparedDraft = prepareChartOrderDraftRowsForPersistence(
          persistenceSourceRows,
          createChartOrderDraftId,
        );
        if (preparedDraft.orderIdMap.size > 0) {
          const preparedById = new Map(
            preparedDraft.rows.map((row) => [row.order.id, row]),
          );
          setDraftRows((currentRows) =>
            currentRows.map((row) => {
              if (isAttemptedRemovalRow(row)) return row;
              const preparedId =
                preparedDraft.orderIdMap.get(row.order.id) ?? row.order.id;
              return preparedById.get(preparedId) ?? row;
            }),
          );
          setSelectedOrderIds((current) =>
            remapChartOrderIdSet(current, preparedDraft.orderIdMap),
          );
        }

        const expectedEtag = orderDraftEtagRef.current;
        if (!expectedEtag) {
          setOrderDraftSaveState("error");
          if (!silent) toast.error("오더 버전을 먼저 불러와 주세요.");
          return false;
        }

        draftTouchedRef.current = false;
        setOrderDraftSaveState("saving");
        inFlightDraftOrderIdsRef.current = new Set(
          preparedDraft.rows.map((row) => row.order.id),
        );
        const result = await saveChartOrderDraftRoute({
          chartId: mutationChartId,
          actorHeaders,
          encounterId: bundle.encounter.id,
          expectedEtag,
          primaryVeterinarianId: bundle.encounter.primaryVeterinarianId,
          removedOrderIds: Array.from(attemptedRemovedRootOrderIds),
          rows: preparedDraft.rows,
          workspaceId: bundle.encounter.workspaceId,
        });
        inFlightDraftOrderIdsRef.current.clear();

        if (!result.ok) {
          const failedInFlightAddRemovals = new Set(
            Array.from(attemptedAddedOrderIds).filter((orderId) =>
              pendingRemovedRootOrderIdsRef.current.has(orderId),
            ),
          );
          failedInFlightAddRemovals.forEach((orderId) =>
            pendingRemovedRootOrderIdsRef.current.delete(orderId),
          );
          if (failedInFlightAddRemovals.size > 0) {
            setPendingRemovedRootOrderIds(
              new Set(pendingRemovedRootOrderIdsRef.current),
            );
            setDraftRows((currentRows) =>
              currentRows.filter(
                (row) => !isChartOrderDraftRowInRootIds(row, failedInFlightAddRemovals),
              ),
            );
          }
          const { conflict } = classifyChartOrderSaveFailure(result);
          if (conflict) void refreshBillingSummary();
          orderDraftConflictRef.current = conflict;
          setOrderDraftSaveState(conflict ? "conflict" : "error");
          draftTouchedRef.current = true;
          orderDraftFailedAutoSaveVersionRef.current =
            attemptedDraftEditVersion;
          if (
            !silent ||
            conflict ||
            attemptedRemovedRootOrderIds.size > 0 ||
            attemptedAddedOrderIds.size > 0
          ) {
            toast.error(
              conflict
                ? "다른 기기에서 오더가 변경됐어요. 현재 편집값을 유지한 채 충돌을 해결해 주세요."
                : result.denialReason === "permission_missing"
                  ? "오더 수정 권한이 없어 저장하지 못했어요."
                  : getChartOrderPersistenceErrorMessage(
                      result.denialReason ?? result.error,
                    ),
            );
          }
          return false;
        }

        if (
          !result.billingSummary ||
          !acceptAuthoritativeBillingSummary(result.billingSummary)
        ) {
          draftTouchedRef.current = true;
          setOrderDraftSaveState("error");
          orderDraftFailedAutoSaveVersionRef.current =
            attemptedDraftEditVersion;
          toast.error("저장 응답의 금액 범위를 확인하지 못했어요.");
          return false;
        }

        const nextCommittedRows = applyPersistedOrderDrafts(
          preparedDraft.rows,
          result.rows ?? [],
          bundle.encounter.workspaceId,
          { preserveMissingRows: true },
        );
        setCommittedRows(nextCommittedRows);
        attemptedRemovedRootOrderIds.forEach((orderId) =>
          pendingRemovedRootOrderIdsRef.current.delete(orderId),
        );
        setPendingRemovedRootOrderIds(
          new Set(pendingRemovedRootOrderIdsRef.current),
        );
        attemptedAddedOrderIds.forEach((orderId) =>
          pendingAddedOrderIdsRef.current.delete(orderId),
        );
        if (!draftTouchedRef.current) {
          setDraftRows(nextCommittedRows);
        } else {
          const committedById = new Map(
            nextCommittedRows.map((row) => [row.order.id, row]),
          );
          setDraftRows((currentRows) =>
            mergeChartOrderDraftRowsAfterSave(
              currentRows,
              committedById,
              isAttemptedRemovalRow,
            ),
          );
        }
        if (result.etag) {
          orderDraftEtagRef.current = result.etag;
          setOrderDraftEtag(result.etag);
        }
        orderDraftFailedAutoSaveVersionRef.current = null;
        orderDraftConflictRef.current = false;
        draftSaveDelayMsRef.current = chartOrderContinuousSaveDelayMs;
        if (attemptedRemovedRootOrderIds.size > 0) {
          toast.success(
            attemptedRemovedRootOrderIds.size === 1
              ? "오더를 삭제했어요."
              : `${attemptedRemovedRootOrderIds.size}개 오더를 삭제했어요.`,
          );
        }
        const acknowledgedAdditionCount = Array.from(
          attemptedAddedOrderIds,
        ).filter(
          (orderId) => !pendingRemovedRootOrderIdsRef.current.has(orderId),
        ).length;
        if (acknowledgedAdditionCount > 0) {
          toast.success(
            `${acknowledgedAdditionCount}개 Order 후보를 추가하고 저장했어요.`,
          );
        }
      }

      setOrderDraftSaveState("saved");
      if (!silent) toast.success("Order 업데이트를 저장했어요.");
      return true;
    })();

    return registerChartOrderDraftSaveOperation(
      operation,
      orderDraftSavePromiseRef,
      orderDraftSaveInFlightRef,
    );
  };
}
