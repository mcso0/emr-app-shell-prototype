"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import {
  EmrPinnedTableWorkspace,
  EmrTableCellText,
  EmrTableHeaderCell,
  EmrTableIdentityCellContent,
} from "@/components/emr/table-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerDataTableFooter } from "@/features/customer/components/customer-data-table-footer";
import { CustomerListHeader } from "@/features/customer/components/customer-list-header";
import { useMockAuthStore } from "@/features/auth/session-store";
import type { CustomerArchiveRecord } from "@/features/customer/server-customer-archive";
import { useCustomerStore } from "@/features/customer/store";

type CustomerArchiveReadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "denied"
  | "error";

type CustomerArchiveMutationFeedback = {
  message: string;
  severity: "error" | "warning";
};

type CustomerArchiveListResponse = {
  ok?: boolean;
  records?: CustomerArchiveRecord[];
};

const customerArchiveTableMinWidth = 880;
const archiveDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatArchiveDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : archiveDateFormatter.format(date);
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

function CustomerArchiveSkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }, (_, index) => (
        <TableRow
          key={`customer-archive-skeleton-${index}`}
          className="h-10 bg-[var(--emr-surface-panel)] hover:bg-[var(--emr-surface-panel)]"
          data-testid="customer-archive-skeleton-row"
        >
          <TableCell
            className="!p-0"
            pinned="left"
            pinnedEdge
            pinnedOffset={0}
          >
            <EmrTableIdentityCellContent className="min-h-10">
              <Skeleton className="h-4 w-24 rounded-[var(--emr-radius-control)] bg-[var(--emr-surface-muted)]" />
            </EmrTableIdentityCellContent>
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-14 rounded-[var(--emr-radius-control)] bg-[var(--emr-surface-muted)]" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32 rounded-[var(--emr-radius-control)] bg-[var(--emr-surface-muted)]" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24 rounded-[var(--emr-radius-control)] bg-[var(--emr-surface-muted)]" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-7 w-14 rounded-[var(--emr-radius-control)] bg-[var(--emr-surface-muted)]" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function CustomerArchiveTable({
  workspaceId,
}: {
  workspaceId: string;
}) {
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
          message: "삭제 항목을 복원하지 못했습니다. 잠시 후 다시 시도해 주세요.",
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

  return (
    <EmrPinnedTableWorkspace
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#fcfcfc]"
      data-testid="customer-archive-table"
      identityTextInset={48}
    >
      <div
        aria-hidden="true"
        className="h-14 shrink-0"
        data-emr-content-top-slot="true"
      />
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

      <Table
        aria-label="삭제된 보호자/동물 고객관리 테이블"
        containerClassName="isolate min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--emr-surface-panel)]"
        density="standard"
        layout="scroll"
        minWidth={customerArchiveTableMinWidth}
        pinning="columns"
        className="table-fixed"
      >
        <colgroup>
          <col className="w-[220px]" />
          <col className="w-[120px]" />
          <col className="w-[220px]" />
          <col className="w-[220px]" />
          <col className="w-[100px]" />
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-[var(--emr-surface-muted)]">
          <TableRow className="h-9 border-0 hover:bg-[var(--emr-surface-muted)]">
            <EmrTableHeaderCell
              className="!p-0"
              data-customer-archive-column="displayName"
              identity
              interaction="sortable"
              pinned="left"
              pinnedEdge
              pinnedOffset={0}
              resize="none"
            >
              이름
            </EmrTableHeaderCell>
            <EmrTableHeaderCell interaction="static" resize="none">
              구분
            </EmrTableHeaderCell>
            <EmrTableHeaderCell interaction="static" resize="none">
              삭제일시
            </EmrTableHeaderCell>
            <EmrTableHeaderCell interaction="static" resize="none">
              삭제한 사용자
            </EmrTableHeaderCell>
            <EmrTableHeaderCell
              align="right"
              interaction="static"
              resize="none"
            >
              작업
            </EmrTableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {readStatus === "idle" || readStatus === "loading" ? (
            <CustomerArchiveSkeletonRows />
          ) : null}

          {readStatus === "ready"
            ? filteredRecords.map((record) => (
                <TableRow
                  key={`${record.target}-${record.id}`}
                  className="h-10 bg-[var(--emr-surface-panel)]"
                  data-testid={`customer-archive-row-${record.target}-${record.id}`}
                >
                  <TableCell
                    className="!p-0 font-semibold"
                    data-customer-archive-column="displayName"
                    pinned="left"
                    pinnedEdge
                    pinnedOffset={0}
                  >
                    <EmrTableIdentityCellContent className="min-h-10">
                      <EmrTableCellText
                        className="font-semibold"
                        fullText={record.displayName}
                        mode="one-line"
                      >
                        {record.displayName}
                      </EmrTableCellText>
                    </EmrTableIdentityCellContent>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getArchiveTargetLabel(record.target)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <EmrTableCellText mode="one-line">
                      {formatArchiveDate(record.deletedAt)}
                    </EmrTableCellText>
                  </TableCell>
                  <TableCell>
                    <EmrTableCellText
                      fullText={record.deletedByUserId ?? "-"}
                      mode="one-line"
                    >
                      {record.deletedByUserId ?? "-"}
                    </EmrTableCellText>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      aria-label={`${record.displayName} 복원`}
                      disabled={pendingRestoreId === record.id}
                      size="sm"
                      variant="outline"
                      onClick={() => void restoreRecord(record)}
                    >
                      {pendingRestoreId === record.id ? "복원 중" : "복원"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            : null}

          {readStatus === "ready" && filteredRecords.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="h-36">
                <div className="flex justify-center px-4 py-6">
                  <EmrEmptyState
                    description={emptyDescription}
                    kind={hasFilteredRecords ? "no-filter-results" : "no-data"}
                    priority={
                      hasFilteredRecords ? "local-recovery" : "supporting"
                    }
                    size="md"
                    surface="table"
                    testId="customer-deleted-empty-state"
                    title={emptyTitle}
                  />
                </div>
              </TableCell>
            </TableRow>
          ) : null}

          {readStatus === "denied" ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="h-36">
                <div className="flex justify-center px-4 py-6">
                  <EmrEmptyState
                    description="고객 조회 권한이 있는 사용자에게 문의해 주세요."
                    kind="no-permission"
                    priority="local-recovery"
                    size="md"
                    surface="table"
                    testId="customer-archive-read-denied"
                    title="삭제 이력을 볼 권한이 없습니다"
                  />
                </div>
              </TableCell>
            </TableRow>
          ) : null}

          {readStatus === "error" ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="h-36">
                <div className="flex justify-center px-4 py-6">
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
                </div>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <CustomerDataTableFooter
        loading={readStatus === "idle" || readStatus === "loading"}
        totalCount={filteredRecords.length}
      />
    </EmrPinnedTableWorkspace>
  );
}
