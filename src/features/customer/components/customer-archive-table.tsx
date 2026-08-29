"use client";

import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnPinningState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmrDataTable } from "@/components/emr/emr-data-table";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import {
  EmrPinnedTableWorkspace,
  EmrTableCellText,
  EmrTableFeedbackSurface,
  EmrTableIdentityCellContent,
} from "@/components/emr/table-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerDataTableFooter } from "@/features/customer/components/customer-data-table-footer";
import { CustomerListHeader } from "@/features/customer/components/customer-list-header";
import { useMockAuthStore } from "@/features/auth/session-store";
import type { CustomerArchiveRecord } from "@/features/customer/server-customer-archive";
import { useCustomerStore } from "@/features/customer/store";

type CustomerArchiveReadStatus =
  "idle" | "loading" | "ready" | "denied" | "error";

type CustomerArchiveMutationFeedback = {
  message: string;
  severity: "error" | "warning";
};

type CustomerArchiveListResponse = {
  ok?: boolean;
  records?: CustomerArchiveRecord[];
};

const archiveDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatArchiveDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : archiveDateFormatter.format(date);
}

function getArchiveTargetLabel(target: CustomerArchiveRecord["target"]) {
  return target === "patient" ? "동물" : "보호자";
}

function getArchiveMutationPath(
  workspaceId: string,
  record: CustomerArchiveRecord,
) {
  const targetCollection =
    record.target === "patient" ? "patients" : "guardians";

  return `/api/workspaces/${encodeURIComponent(workspaceId)}/customer/${targetCollection}/${encodeURIComponent(record.id)}/archive`;
}

export function CustomerArchiveTable({ workspaceId }: { workspaceId: string }) {
  const authSession = useMockAuthStore((state) => state.session);
  const query = useCustomerStore((state) => state.query);
  const setArchiveCount = useCustomerStore((state) => state.setArchiveCount);
  const setArchiveCountLoading = useCustomerStore(
    (state) => state.setArchiveCountLoading,
  );
  const setQuery = useCustomerStore((state) => state.setQuery);
  const [readStatus, setReadStatus] =
    useState<CustomerArchiveReadStatus>("idle");
  const [records, setRecords] = useState<CustomerArchiveRecord[]>([]);
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
  const [mutationFeedback, setMutationFeedback] =
    useState<CustomerArchiveMutationFeedback | null>(null);

  const actorUserId = authSession?.id;

  const loadArchiveRecords = useCallback(
    async (signal?: AbortSignal) => {
      setReadStatus("loading");
      setArchiveCountLoading(true);
      setMutationFeedback(null);

      try {
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/customer/archive?status=soft_deleted`,
          {
            cache: "no-store",
            headers: actorUserId
              ? { "x-clair-demo-session-user-id": actorUserId }
              : undefined,
            signal,
          },
        );
        const result = (await response.json()) as CustomerArchiveListResponse;
        if (signal?.aborted) return;

        if (!response.ok || !result.ok) {
          setRecords([]);
          setArchiveCount(0);
          setReadStatus(
            response.status === 401 || response.status === 403
              ? "denied"
              : "error",
          );
          return;
        }

        const nextRecords = result.records ?? [];
        setRecords(nextRecords);
        setArchiveCount(nextRecords.length);
        setReadStatus("ready");
      } catch (error: unknown) {
        if ((error as { name?: string }).name === "AbortError") return;
        setRecords([]);
        setArchiveCount(0);
        setReadStatus("error");
      } finally {
        if (!signal?.aborted) setArchiveCountLoading(false);
      }
    },
    [actorUserId, setArchiveCount, setArchiveCountLoading, workspaceId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadArchiveRecords(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadArchiveRecords]);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    if (!normalizedQuery) return records;

    return records.filter((record) =>
      [
        record.displayName,
        getArchiveTargetLabel(record.target),
        record.deletedByUserId ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(normalizedQuery),
    );
  }, [query, records]);

  const restoreRecord = useCallback(
    async (record: CustomerArchiveRecord) => {
      setPendingRestoreId(record.id);
      setMutationFeedback(null);

      try {
        const response = await fetch(
          getArchiveMutationPath(workspaceId, record),
          {
            body: JSON.stringify({ action: "restore" }),
            headers: {
              "content-type": "application/json",
              ...(actorUserId
                ? { "x-clair-demo-session-user-id": actorUserId }
                : {}),
            },
            method: "PATCH",
          },
        );
        const result = (await response.json()) as { ok?: boolean };

        if (!response.ok || !result.ok) {
          setMutationFeedback({
            message:
              response.status === 401 || response.status === 403
                ? "삭제 항목을 복원할 권한이 없습니다."
                : "삭제 항목을 복원하지 못했습니다. 잠시 후 다시 시도해 주세요.",
            severity:
              response.status === 401 || response.status === 403
                ? "warning"
                : "error",
          });
          return;
        }

        const nextRecords = records.filter(
          (item) => item.id !== record.id || item.target !== record.target,
        );
        setRecords(nextRecords);
        setArchiveCount(nextRecords.length);
      } catch {
        setMutationFeedback({
          message:
            "삭제 항목을 복원하지 못했습니다. 잠시 후 다시 시도해 주세요.",
          severity: "error",
        });
      } finally {
        setPendingRestoreId(null);
      }
    },
    [actorUserId, records, setArchiveCount, workspaceId],
  );

  const hasFilteredRecords =
    Boolean(query.trim()) && filteredRecords.length === 0;
  const emptyTitle = hasFilteredRecords
    ? "조건에 맞는 삭제 항목이 없습니다"
    : "삭제된 보호자/동물이 없습니다";
  const emptyDescription = hasFilteredRecords
    ? "검색어를 바꾸면 삭제 이력이 다시 보입니다."
    : "삭제 이력이 없습니다.";
  const columns = useMemo<ColumnDef<CustomerArchiveRecord, unknown>[]>(
    () => [
      {
        accessorKey: "displayName",
        id: "displayName",
        meta: {
          identity: true,
          label: "이름",
          role: "data",
          textMode: "one-line",
        },
        size: 220,
        cell: ({ row }) => (
          <EmrTableIdentityCellContent>
            <EmrTableCellText
              className="font-semibold"
              fullText={row.original.displayName}
              mode="one-line"
            >
              {row.original.displayName}
            </EmrTableCellText>
          </EmrTableIdentityCellContent>
        ),
      },
      {
        accessorFn: (row) => getArchiveTargetLabel(row.target),
        id: "target",
        meta: { label: "구분", role: "data", textMode: "one-line" },
        size: 120,
        cell: ({ row }) => (
          <Badge variant="outline">
            {getArchiveTargetLabel(row.original.target)}
          </Badge>
        ),
      },
      {
        accessorFn: (row) => row.deletedAt ?? "",
        id: "deletedAt",
        meta: { label: "삭제일시", role: "data", textMode: "one-line" },
        size: 220,
        cell: ({ row }) => (
          <EmrTableCellText mode="one-line">
            {formatArchiveDate(row.original.deletedAt)}
          </EmrTableCellText>
        ),
      },
      {
        accessorFn: (row) => row.deletedByUserId ?? "-",
        id: "deletedBy",
        meta: { label: "삭제한 사용자", role: "data", textMode: "one-line" },
        size: 220,
        cell: ({ row }) => (
          <EmrTableCellText
            fullText={row.original.deletedByUserId ?? "-"}
            mode="one-line"
          >
            {row.original.deletedByUserId ?? "-"}
          </EmrTableCellText>
        ),
      },
      {
        id: "actions",
        meta: { align: "right", label: "작업", role: "actions" },
        size: 100,
        cell: ({ row }) => (
          <Button
            aria-label={`${row.original.displayName} 복원`}
            disabled={pendingRestoreId === row.original.id}
            size="sm"
            variant="outline"
            onClick={() => void restoreRecord(row.original)}
          >
            {pendingRestoreId === row.original.id ? "복원 중" : "복원"}
          </Button>
        ),
      },
    ],
    [pendingRestoreId, restoreRecord],
  );
  const columnPinning = useMemo<ColumnPinningState>(
    () => ({ left: ["displayName"], right: [] }),
    [],
  );
  // TanStack Table owns the archive table's column order and row model.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: filteredRecords,
    enableColumnPinning: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => `${row.target}-${row.id}`,
    state: { columnPinning },
  });

  return (
    <EmrPinnedTableWorkspace
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--emr-surface-workspace)]"
      data-testid="customer-archive-table"
      identityTextInset={48}
    >
      <CustomerListHeader
        count={records.length}
        countLoading={readStatus === "idle" || readStatus === "loading"}
        onSearchChange={setQuery}
        searchPlaceholder="삭제된 보호자/동물 검색"
        searchValue={query}
        title="삭제된 보호자/동물"
      />

      {mutationFeedback ? (
        <EmrInlineAlert
          className="mx-12 my-3"
          severity={mutationFeedback.severity}
          testId="customer-archive-mutation-alert"
          title={mutationFeedback.message}
        />
      ) : null}

      {readStatus === "ready" && filteredRecords.length === 0 ? (
        <EmrTableFeedbackSurface>
          <EmrEmptyState
            description={emptyDescription}
            kind={hasFilteredRecords ? "no-filter-results" : "no-data"}
            primaryAction={
              hasFilteredRecords ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuery("")}
                >
                  조건 초기화
                </Button>
              ) : undefined
            }
            priority={hasFilteredRecords ? "local-recovery" : "supporting"}
            size="md"
            surface="table"
            testId="customer-deleted-empty-state"
            title={emptyTitle}
          />
        </EmrTableFeedbackSurface>
      ) : readStatus === "denied" ? (
        <EmrTableFeedbackSurface>
          <EmrEmptyState
            description="고객 조회 권한이 있는 사용자에게 문의해 주세요."
            kind="no-permission"
            priority="local-recovery"
            size="md"
            surface="table"
            testId="customer-archive-read-denied"
            title="삭제 이력을 볼 권한이 없습니다"
          />
        </EmrTableFeedbackSurface>
      ) : readStatus === "error" ? (
        <EmrTableFeedbackSurface>
          <EmrEmptyState
            description="연결 상태를 확인한 뒤 다시 시도해 주세요."
            kind="read-error"
            primaryAction={
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadArchiveRecords()}
              >
                다시 시도
              </Button>
            }
            priority="local-recovery"
            size="md"
            surface="table"
            testId="customer-archive-read-error"
            title="삭제 이력을 불러오지 못했습니다"
          />
        </EmrTableFeedbackSurface>
      ) : (
        <>
          <EmrDataTable
            aria-label="삭제된 보호자/동물 고객관리 테이블"
            className="table-fixed"
            containerClassName="bg-[var(--emr-surface-panel)]"
            density="standard"
            initialLoading={readStatus === "idle" || readStatus === "loading"}
            overscrollAxes="both"
            skeletonRowCount={6}
            table={table}
            viewportMode="fill"
            getRowProps={(row) => ({
              className: "bg-[var(--emr-surface-panel)]",
              "data-testid": `customer-archive-row-${row.original.target}-${row.original.id}`,
            })}
          />

          <CustomerDataTableFooter
            loading={readStatus === "idle" || readStatus === "loading"}
            totalCount={filteredRecords.length}
          />
        </>
      )}
    </EmrPinnedTableWorkspace>
  );
}
