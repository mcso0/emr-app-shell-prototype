"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "@/components/icons";
import { Pick } from "./presentation";
import { chartSearchApi, errorMessage } from "./client";
import { copiedEvent, openChartSearch } from "./events";
import type { PendingCopy } from "./contract";
export function ChartSearchEntry({
  workspaceId,
  chartId,
  patientId,
  patientName,
  encounterId,
  editable,
}: {
  workspaceId: string;
  chartId?: string | null;
  patientId: string;
  patientName: string;
  encounterId: string;
  editable: boolean;
}) {
  const api = useMemo(() => chartSearchApi(workspaceId), [workspaceId]);
  const [choice, setChoice] = useState<{ chartId: string; id: string } | null>(null);
  const [task, setTask] = useState<{
      chartId: string;
      pending: PendingCopy;
    } | null>(null),
    [err, setErr] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    window.addEventListener(copiedEvent, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(copiedEvent, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    if (chartId && editable)
      api
        .pending({ targetId: chartId, patientId, encounterId, pendingId: choice?.chartId === chartId ? choice.id : undefined }, abort.signal)
        .then((p) => {
          if (!abort.signal.aborted) {
            setTask(p ? { chartId, pending: p } : null);
            if (!p && choice?.chartId === chartId) setChoice(null);
          }
        })
        .catch(() => {
          if (!abort.signal.aborted) setTask(null);
        });
    return () => abort.abort();
  }, [api, chartId, editable, patientId, encounterId, revision, choice]);
  const entry = {
    workspaceId,
    chartId: chartId ?? undefined,
    patientId,
    patientName,
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
      if (!s.items[0] || !t.items[0]) throw new Error("target_unavailable");
      if (s.items[0].version !== pending.sourceVersion) {
        setErr("복사를 기다리는 동안 원본이나 단가가 변경됐습니다. 최신 원본에서 항목을 다시 선택해 주세요.");
        return;
      }
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
        size="sm"
        onClick={() => openChartSearch(entry)}
      >
        <SearchIcon />
        차트 상세 검색
      </Button>
      {pending && (
        <>
          {pending.choices && pending.choices.length > 1 && (
            <Pick
              label="복사 대기 선택"
              value={pending.id}
              options={pending.choices.map((item) => [item.id, item.selector + " 선택"])}
              onChange={(id) => { setTask(null); setChoice({ chartId: chartId!, id }); }}
            />
          )}
          <Button variant="outline" size="sm" onClick={() => void resume()}>
            복사 이어가기
          </Button>
          {pending.canDiscard && <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await api.discard(pending.id);
                setTask(null);
                setRevision((n) => n + 1);
                setErr("");
              } catch (e) {
                setErr(errorMessage(e));
              }
            }}
          >
            복사 대기 취소
          </Button>}
        </>
      )}
      {err && <span role="alert">{err}</span>}
    </span>
  );
}
