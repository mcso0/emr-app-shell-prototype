"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { diagnosisLabels } from "./advanced-search/contract";
import { SoapGroups } from "./advanced-search/history-detail";
import { toDemoChart } from "./demo-history-projection";
export { filterDemoHistory } from "./demo-history-projection";
import { cheongdamWorkspaceId, type DemoHistoryItem } from "./demo-history-contract";

const date = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", hourCycle: "h23", timeZone: "Asia/Seoul" });
const noItems: DemoHistoryItem[] = [];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useDemoHistory(
  workspaceId: string | undefined, viewerKey: string | undefined, patientId?: string, active = true,
) {
  const [state, setState] = useState<{ key: string; items: DemoHistoryItem[]; unavailable: boolean } | null>(null);
  const patient = patientId === undefined || uuid.test(patientId) ? patientId ?? "all" : null;
  const key = workspaceId === cheongdamWorkspaceId && viewerKey && active && patient
    ? JSON.stringify([viewerKey, patient])
    : null;
  const [previousKey, setPreviousKey] = useState(key);
  if (previousKey !== key) {
    setPreviousKey(key);
    setState(null);
  }
  useEffect(() => {
    if (!key || !patient) return;
    const currentKey = key, currentPatient = patient;
    let controller: AbortController | null = null;
    async function load() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const suffix = currentPatient === "all" ? "" : "?patientId=" + encodeURIComponent(currentPatient);
      try {
        const response = await fetch("/api/workspaces/" + cheongdamWorkspaceId + "/chart/demo-history" + suffix, {
          cache: "no-store", signal: request.signal,
        });
        if (!response.ok) {
          if ([401, 403].includes(response.status)) {
            if (!request.signal.aborted) setState(null);
            return;
          }
          throw new Error("demo_history_unavailable");
        }
        const body = await response.json() as { items: DemoHistoryItem[] };
        if (!Array.isArray(body.items) || body.items.length > 18 ||
          (currentPatient !== "all" && body.items.some(item => item.patientId !== currentPatient))) throw new Error("demo_history_unavailable");
        if (!request.signal.aborted) setState({ key: currentKey, items: body.items, unavailable: false });
      } catch {
        if (!request.signal.aborted) setState({ key: currentKey, items: [], unavailable: true });
      }
    }
    const refresh = () => {
      setState(null);
      void load();
    };
    window.addEventListener("focus", refresh);
    void load();
    return () => {
      controller?.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [key, patient]);
  return {
    items: key && state?.key === key ? state.items : noItems,
    unavailable: !!key && state?.key === key && state.unavailable,
  };
}

export function DemoHistorySection({
  items, unavailable, query = "", patientScoped = false,
}: { items: DemoHistoryItem[]; unavailable?: boolean; query?: string; patientScoped?: boolean }) {
  if (!items.length && !unavailable) return null;
  return (
    <section className="grid min-w-0 gap-2 py-2" aria-label="청담 시연 이력" data-testid="cheongdam-demo-history">
      <div className="flex items-center gap-2">
        <h3 className="emr-text-body font-medium">시연 이력</h3>
        {!!items.length && <Badge variant="outline">{items.length}</Badge>}
      </div>
      <p className="emr-text-metadata text-muted-foreground">청담 워크스페이스의 읽기 전용 보관 이력입니다.</p>
      {unavailable && <p role="status" className="emr-text-metadata text-muted-foreground">시연 이력을 불러오지 못했습니다.</p>}
      {items.map(item => (
        <details key={item.id} className="min-w-0 rounded-lg border bg-card p-3" data-testid="cheongdam-demo-history-item">
          <summary className="cursor-pointer wrap-anywhere emr-text-body font-medium">
            <span>{item.title}</span>
            <span className="ml-2 emr-text-metadata text-muted-foreground">
              {date.format(new Date(item.visitAt))}{!patientScoped && " · " + item.patient}
            </span>
          </summary>
          <div className="mt-3 grid min-w-0 gap-3 border-t pt-3">
            {item.diagnosis && <Badge variant="secondary" className="w-fit">
              {item.diagnosis.name} · {diagnosisLabels[item.diagnosis.kind] ?? "기록"}
            </Badge>}
            <SoapGroups chart={toDemoChart(item)} query={query} />
            {!!item.orders.length && <section aria-label="보관 오더 및 검사 결과" className="grid gap-2">
              <h4 className="emr-text-body font-medium">오더 및 검사 결과</h4>
              {item.orders.map(order => <div key={order.catalogId} className="rounded-md border px-3 py-2">
                <p className="emr-text-body">{order.name}</p>
                {order.interpretation && <>
                  <p className="emr-text-metadata text-muted-foreground">결과 입력 · 검사 완료</p>
                  <p className="emr-text-body">{order.interpretation}</p>
                </>}
              </div>)}
            </section>}
          </div>
        </details>
      ))}
    </section>
  );
}
