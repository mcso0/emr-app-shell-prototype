"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { parseChartActualRecords, type ChartActualRecords, type ChartActualType } from "./chart-actual-contract";

export type ChartActualConfirmationRow = { orderId: string; name: string; type: ChartActualType; findingSummary?: string };
export type ChartActualDraft = { performedAt?: string; selfPerformed?: boolean; performedActivity?: string; outcome?: string };
export function buildChartActualRecords(rows: ChartActualConfirmationRow[], drafts: Record<string, ChartActualDraft>): ChartActualRecords | null {
  const records: Record<string, unknown> = {};
  for (const row of rows) {
    const draft = drafts[row.orderId];
    if (!draft?.performedAt || !Number.isFinite(Date.parse(draft.performedAt))) return null;
    records[row.orderId] = { performedAt: new Date(draft.performedAt).toISOString(), selfPerformed: draft.selfPerformed,
      payload: row.type === "system_exam" ? { findingSummary: row.findingSummary }
        : { performedActivity: draft.performedActivity?.trim(), outcome: draft.outcome?.trim() } };
  }
  return parseChartActualRecords(records);
}
export function ChartActualConfirmation({ rows, drafts, disabled, onChange }: {
  rows: ChartActualConfirmationRow[]; drafts: Record<string, ChartActualDraft>; disabled: boolean;
  onChange: (orderId: string, value: ChartActualDraft) => void;
}) {
  if (!rows.length) return null;
  return <span className="grid max-h-80 gap-4 overflow-y-auto text-left">
    <span>아래 차트 내 완료 항목은 실제 수행 기록을 함께 확정합니다. 수행하지 않았다면 확정하지 말고 후보로 남겨 주세요.</span>
    {rows.map(row => { const draft = drafts[row.orderId] ?? {};
      return <span key={row.orderId} className="grid gap-2 rounded-lg border border-[var(--emr-border-default)] p-3">
        <strong>{row.name}</strong>
        {row.type === "system_exam" ? <span className="whitespace-pre-wrap">입력한 실제 소견: {row.findingSummary || "소견을 먼저 입력해 주세요."}</span> : <>
          <label className="grid gap-1">실제 수행한 진료·업무<Input aria-label={`${row.name} 실제 수행`} value={draft.performedActivity ?? ""} maxLength={4000}
            disabled={disabled} onChange={e => onChange(row.orderId, { ...draft, performedActivity: e.target.value })} /></label>
          <label className="grid gap-1">실제 결과<Textarea aria-label={`${row.name} 실제 결과`} value={draft.outcome ?? ""} maxLength={4000}
            disabled={disabled} onChange={e => onChange(row.orderId, { ...draft, outcome: e.target.value })} /></label>
        </>}
        <label className="grid gap-1">실제 수행 시각 (이 기기의 시간대)<Input type="datetime-local" aria-label={`${row.name} 실제 수행 시각`}
          value={draft.performedAt ?? ""} disabled={disabled} onChange={e => onChange(row.orderId, { ...draft, performedAt: e.target.value })} /></label>
        <label className="flex items-center gap-2"><Switch checked={draft.selfPerformed === true} disabled={disabled}
          onCheckedChange={checked => onChange(row.orderId, { ...draft, selfPerformed: checked })} />현재 로그인한 내가 실제 수행했고 위 결과가 맞음을 확인</label>
      </span>;
    })}
  </span>;
}
