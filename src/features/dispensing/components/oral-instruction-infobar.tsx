"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { OralInstruction } from "@/features/chart/chart-oral-instruction-contract";

export function OralInstructionInfobar({ instruction }: { instruction: OralInstruction }) {
  const [hiddenRevision, setHiddenRevision] = useState<number | null>(null);
  if (!instruction.instruction && !instruction.history.length && !instruction.snapshots?.length) return null;
  if (hiddenRevision === instruction.revision) return <Button size="sm" variant="ghost" onClick={() => setHiddenRevision(null)}>경구제 전체 지시사항 보기</Button>;
  return <aside className="oral-instruction-infobar" aria-label="경구제 전체 지시사항">
    <div className="oral-instruction-symbol">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/instruction/info.svg" width={20} height={20} alt="" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-neutral-900">경구제 전체 지시사항</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-neutral-600">{instruction.instruction || "등록된 지시사항이 없어요."}</p>
      {(instruction.history.length > 0 || !!instruction.snapshots?.length) && <details className="mt-1"><summary className="cursor-pointer">지시 이력</summary>
        {instruction.history.map(item => <div key={item.revision} className="mt-2 whitespace-pre-wrap"><time>{item.createdAt}</time>{item.actorName && <span> · {item.actorName}</span>}<p>{item.instruction || "지시사항 삭제"}</p></div>)}
        {instruction.snapshots?.map(item => <div key={`${item.taskId}:${item.phase}:${item.capturedAt}`} className="mt-2 whitespace-pre-wrap"><p>{item.orderName && `${item.orderName} · ${item.attemptNo}차 · `}{item.phase === "requested" ? "요청 당시" : "완료 당시"} · {item.capturedAt}</p><p>{item.instruction || "등록된 지시사항 없음"}</p></div>)}
      </details>}
    </div>
    <Button className="size-8 shrink-0 self-center p-0" variant="ghost" aria-label="경구제 전체 지시사항 숨기기" onClick={() => setHiddenRevision(instruction.revision)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/instruction/close.svg" width={16} height={16} alt="" />
    </Button>
  </aside>;
}
