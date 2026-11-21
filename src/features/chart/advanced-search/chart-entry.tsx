"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "@/components/icons";
import { chartSearchApi, errorMessage } from "./client";
import { copiedEvent, openChartSearch } from "./events";
import type { PendingCopy } from "./contract";
export function ChartSearchEntry({
  workspaceId,
  chartId,
  patientId,
  encounterId,
  editable,
}: {
  workspaceId: string;
  chartId?: string | null;
  patientId: string;
  encounterId: string;
  editable: boolean;
}) {
  const api = useMemo(() => chartSearchApi(workspaceId), [workspaceId]);
  const [task, setTask] = useState<{
      chartId: string;
      pending: PendingCopy;
    } | null>(null),
    [err, setErr] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    window.addEventListener(copiedEvent, refresh);
    return () => window.removeEventListener(copiedEvent, refresh);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    if (chartId && editable)
      api
        .pending({ targetId: chartId, patientId, encounterId }, abort.signal)
        .then((p) => {
          if (!abort.signal.aborted)
            setTask(p ? { chartId, pending: p } : null);
        })
        .catch(() => {
          if (!abort.signal.aborted) setTask(null);
        });
    return () => abort.abort();
  }, [api, chartId, editable, patientId, encounterId, revision]);
  const entry = {
    workspaceId,
    chartId: chartId ?? undefined,
    patientId,
    encounterId,
  };
  const pending =
    editable &&
    chartId &&
    task?.chartId === chartId &&
    task.pending.encounterId === encounterId &&
    task.pending.patientId === patientId
      ? task.pending
      : null;
  async function resume() {
    if (!pending || !chartId) return;
    try {
      if (pending.orderPermissionRequired)
        throw new Error("catalog_permission_missing");
      const [s, t] = await Promise.all([
        api.search({ chartId: pending.sourceId }),
        api.search({ chartId, targets: true }),
      ]);
      if (
        !s.items[0] ||
        !t.items[0] ||
        s.items[0].version !== pending.sourceVersion
      )
        throw new Error("revision_conflict");
      openChartSearch({
        ...entry,
        resume: { pending, target: t.items[0], source: s.items[0] },
      });
    } catch (e) {
      setErr(errorMessage(e));
    }
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Button
        aria-label="차트 상세 검색"
        title="차트 상세 검색"
        variant="outline"
        size="icon-sm"
        onClick={() => openChartSearch(entry)}
      >
        <SearchIcon />
      </Button>
      {pending && (
        <>
          <Button variant="outline" size="sm" onClick={() => void resume()}>
            복사 이어가기
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await api.discard(pending.id);
                setTask(null);
                setErr("");
              } catch (e) {
                setErr(errorMessage(e));
              }
            }}
          >
            복사 대기 취소
          </Button>
        </>
      )}
      {err && <span role="alert">{err}</span>}
    </span>
  );
}
