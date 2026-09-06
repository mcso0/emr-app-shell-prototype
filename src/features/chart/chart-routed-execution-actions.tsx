"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExecutionResultDialog } from "@/features/fulfillment/components/execution-result-dialog";
import { isExecutionRecord } from "@/features/fulfillment/execution-result-contract";
import type { ChartOrderQueueProjection } from "./server-order-execution-read-model-core";

// Chart entry point for categories without a dedicated persisted queue screen.
// The existing fulfillment lifecycle/result endpoints retain all authority.
export function ChartRoutedExecutionActions({ workspaceId, queue, taskId, onSaved }: {
  workspaceId: string; queue: ChartOrderQueueProjection; taskId: string; onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const command = useRef<{ revision: number; id: string } | null>(null);
  const start = async () => {
    if (!queue.rowRevision || busy) return;
    if (command.current?.revision !== queue.rowRevision) command.current = { revision: queue.rowRevision, id: crypto.randomUUID() };
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/fulfillment/work-items/${encodeURIComponent(queue.workItemId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", expectedRevision: queue.rowRevision, commandId: command.current.id }),
      });
      const body: unknown = await response.json();
      if (!mounted.current) return;
      if (!response.ok || !isExecutionRecord(body) || body.ok !== true) { setError("업무 시작을 확인하지 못했습니다. 권한과 최신 상태를 확인해 주세요."); return; }
      await onSaved(); if (mounted.current) setOpen(true);
    } catch { if (mounted.current) setError("업무 시작 결과를 확인하지 못했습니다. 같은 요청으로 재시도할 수 있습니다."); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <div className="mt-2 grid gap-2">
    <div className="flex flex-wrap gap-2">
      {queue.queueStatus === "requested" ? <Button size="sm" disabled={busy || !queue.rowRevision} onClick={() => void start()}>수행 시작</Button> : null}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setOpen(true)}>수행기록·이력</Button>
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <ExecutionResultDialog workspaceId={workspaceId} workItemId={queue.workItemId} taskId={taskId} open={open} onOpenChange={setOpen} onSaved={onSaved} />
  </div>;
}
