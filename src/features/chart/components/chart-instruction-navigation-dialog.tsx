"use client";

import { useEffect, useRef, useState } from "react";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { Dialog } from "@/components/ui/dialog";
import type { FulfillmentWorkItem } from "@/features/fulfillment/server-fulfillment-work-item";
import { getOperatingDateFromIso } from "@/lib/emr-domain/demo-date";

export type ChartInstructionTarget = {
  orderId: string;
  orderName: string;
  queueType: "dispensing" | "treatment";
  taskId: string;
  workItemId: string;
};

export function ChartInstructionNavigationDialog({
  actorHeaders,
  encounterId,
  onClose,
  onNavigate,
  onReturnFocus,
  open,
  target,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  onClose: () => void;
  onNavigate: (workItemId: string, date: string) => void;
  onReturnFocus: () => HTMLElement | null;
  open: boolean;
  target: ChartInstructionTarget;
  workspaceId: string;
}) {
  const requestRef = useRef<AbortController>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const label = target.queueType === "dispensing" ? "조제" : "처치";
  useEffect(() => () => requestRef.current?.abort(), []);

  function close() {
    requestRef.current?.abort();
    setPending(false);
    setError("");
    onClose();
  }

  async function confirm() {
    if (requestRef.current) return;
    const request = new AbortController();
    requestRef.current = request;
    setPending(true);
    setError("");
    try {
      const query = new URLSearchParams({
        encounterId,
        queueType: target.queueType,
        workItemId: target.workItemId,
      });
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/fulfillment/work-items?${query}`, {
        cache: "no-store",
        headers: actorHeaders,
        signal: request.signal,
      });
      if (request.signal.aborted) return;
      if (response.status === 401 || response.status === 403) {
        setError("이 지시서를 볼 권한이 없어요.");
        return;
      }
      if (!response.ok) throw new Error("instruction_target_read_failed");
      const result: { ok: boolean; workItems?: FulfillmentWorkItem[] } = await response.json();
      if (request.signal.aborted) return;
      const item = result.ok ? result.workItems?.find(item =>
        item.id === target.workItemId &&
        item.taskId === target.taskId &&
        item.orderId === target.orderId &&
        item.encounterId === encounterId &&
        item.workspaceId === workspaceId &&
        item.queueType === target.queueType,
      ) : undefined;
      // Use the same date precedence as the worklist's server-side filter.
      const date = getOperatingDateFromIso(item?.dueAt ?? undefined) ?? getOperatingDateFromIso(item?.createdAt);
      if (!item || !date) {
        setError("연결된 지시서를 찾을 수 없어요. 차트를 새로고침한 뒤 다시 시도해 주세요.");
        return;
      }
      onClose();
      onNavigate(item.id, date);
    } catch {
      if (!request.signal.aborted) setError("지시서를 확인하지 못했어요. 다시 시도해 주세요.");
    } finally {
      requestRef.current = null;
      if (!request.signal.aborted) setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) close(); }}>
      <EmrConfirmDialogContent
        title={`${label} 지시서로 이동할까요?`}
        description={
          <>
            <span className="block break-words">{target.orderName}</span>
            {error && <span className="mt-2 block text-destructive" role="alert">{error}</span>}
          </>
        }
        cancelLabel="취소"
        confirmLabel={pending ? "확인 중" : "지시서로 이동"}
        confirmDisabled={pending}
        onCancel={close}
        onConfirm={() => void confirm()}
        finalFocus={onReturnFocus}
      />
    </Dialog>
  );
}
