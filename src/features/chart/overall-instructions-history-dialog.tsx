"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { instructionScopeLabels, type InstructionScope, type OverallInstructions } from "./overall-instructions-contract";

function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const p = (type: string) => parts.find(item => item.type === type)?.value;
  return `${p("year")}. ${p("month")}. ${p("day")} ${p("hour")}:${p("minute")}`;
}

/** Read-only history surface shared by Plan/Order and performing modules. */
export function OverallInstructionsHistoryDialog({ open, onOpenChange, history, loading = false, error, onRetry, onViewSnapshots }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: OverallInstructions["history"];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onViewSnapshots?: () => void;
}) {
  const scopeId = useId();
  const [historyScope, setHistoryScope] = useState<InstructionScope | "all">("all");
  return (
      <Dialog open={open} onOpenChange={onOpenChange}><EmrDialogShell title="변경 이력" variant="wide-form" className="sm:max-w-[840px]" secondaryAction={<>{onViewSnapshots && <Button variant="ghost" onClick={onViewSnapshots}>요청·완료 당시 기록</Button>}<Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button></>}>
        <label className="sr-only" htmlFor={scopeId}>지시 범위</label><select id={scopeId} className="mb-4 rounded-md border bg-background p-2" value={historyScope} onChange={event => setHistoryScope(event.target.value as InstructionScope | "all")}><option value="all">전체 범위</option>{[...new Set(history.map(item => item.scope))].map(scope => <option key={scope} value={scope}>{instructionScopeLabels[scope]}</option>)}</select>
        {loading && <p role="status">변경 이력을 불러오는 중입니다.</p>}
        {error && <div role="alert"><p>{error}</p>{onRetry && <Button variant="outline" size="sm" onClick={onRetry}>다시 조회</Button>}</div>}
        {!loading && !error && history.length === 0 && <p className="text-sm text-muted-foreground">변경 이력이 없습니다.</p>}
        {history.filter(item => historyScope === "all" || item.scope === historyScope).map(item => {
          const before = history.filter(previous => previous.scope === item.scope && !!previous.legacy === !!item.legacy && previous.revision < item.revision).sort((a, b) => b.revision - a.revision)[0];
          const kind = item.deleted ? "지시 삭제" : !before ? "최초 지시" : before.deleted ? "다시 작성된 지시" : "변경된 지시";
          return <section key={`${item.scope}:${!!item.legacy}:${item.revision}`} className="mb-5"><h3 className="text-sm font-medium"><time>{formatTime(item.createdAt)}</time> · {item.actorName ?? "작성자"}</h3><p className="mb-2 text-xs text-muted-foreground">{item.legacy ? "경구제 지시 (이전 기록)" : instructionScopeLabels[item.scope]} · {kind}</p><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border p-3"><h4 className="mb-2 text-xs text-muted-foreground">변경 전</h4><p className="whitespace-pre-wrap break-words">{before?.deleted ? "지시 삭제됨" : before?.instruction || "작성된 지시 없음"}</p></div><div className="rounded-lg border p-3"><h4 className="mb-2 text-xs text-muted-foreground">변경 후</h4><p className="whitespace-pre-wrap break-words">{item.deleted ? "지시 삭제됨" : item.instruction || "작성된 지시 없음"}</p></div></div></section>;
        })}
      </EmrDialogShell></Dialog>
  );
}
