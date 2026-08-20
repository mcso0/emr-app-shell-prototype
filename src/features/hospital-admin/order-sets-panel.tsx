"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import type { AuthSession } from "@/features/auth/auth-client";
import type { OrderSetSummary } from "@/features/hospital-admin/server-order-catalog";

export function OrderSetsPanel({
  session,
  workspaceId,
}: {
  session: AuthSession | null;
  workspaceId: string;
}) {
  const [summaries, setSummaries] = useState<OrderSetSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-sets`,
      { headers: getDemoActorHeaders(session), signal: controller.signal },
    )
      .then(async (response) => {
        const body = (await response.json()) as { summaries?: OrderSetSummary[] };
        if (!response.ok || !Array.isArray(body.summaries)) throw new Error("order_set_read_failed");
        setSummaries(body.summaries ?? []);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [session, workspaceId]);

  if (status === "loading") {
    return <EmrEmptyState kind="upstream-pending" surface="content" title="Order 세트를 불러오는 중입니다." description="Workspace 카탈로그를 확인하고 있습니다." />;
  }
  if (status === "error") {
    return <EmrEmptyState kind="read-error" surface="content" title="Order 세트를 불러오지 못했습니다." description="권한과 Workspace 연결을 확인한 뒤 다시 시도해 주세요." />;
  }
  if (summaries.length === 0) {
    return <EmrEmptyState kind="no-data" surface="content" title="등록된 Order 세트가 없습니다." description="새 immutable revision은 B2 API 계약을 통해 추가할 수 있습니다." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fcfcfc]">
      <EmrMainContentHeader aria-hidden="true" heightMode="adaptive" />
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <section className="overflow-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-card">
          <div className="flex items-center justify-between border-b border-[var(--emr-line-hairline)] px-4 py-3">
            <div>
              <h1 className="emr-text-panel-title font-semibold">Order 세트</h1>
              <p className="emr-text-dense text-muted-foreground">현재 revision 기준으로만 관리됩니다.</p>
            </div>
            <Badge variant="outline">{summaries.length}개</Badge>
          </div>
          <Table aria-label="Order 세트 목록" density="compact">
            <TableHeader className="bg-[var(--emr-surface-muted)]">
              <TableRow>
                <TableHead>세트명</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>가격 방식</TableHead>
                <TableHead>현재 revision</TableHead>
                <TableHead>검토</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((summary) => (
                <TableRow key={summary.orderSetId}>
                  <TableCell className="font-medium">{summary.setName}</TableCell>
                  <TableCell>{summary.availabilityStatus}</TableCell>
                  <TableCell>{summary.amountBasis}</TableCell>
                  <TableCell>{summary.currentRevisionNo ?? "없음"}</TableCell>
                  <TableCell>{summary.needsCompositionReview ? "구성 검토 필요" : summary.pendingReviewCount ? `${summary.pendingReviewCount}건` : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>
    </div>
  );
}
