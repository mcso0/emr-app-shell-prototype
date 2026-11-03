"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmrDialogShell } from "./dialog-shell";

export type EmrWorkEntryActionProps = {
  mode: "claim" | "start" | "takeover" | "blocked";
  scopeKey: string;
  authorityKey: string;
  assigneeName?: string | null;
  context?: ReactNode;
  busy?: boolean;
  error?: string | null;
  description?: string;
  onConfirm?: (reason: string) => Promise<boolean | "review_required">;
  onEntered?: () => void;
};

/** Confirmation UI only; callers retain their existing assignment and execution commands. */
export function EmrWorkEntryAction(props: EmrWorkEntryActionProps) {
  return <WorkEntryAction key={props.scopeKey} {...props} />;
}

function WorkEntryAction({ mode, authorityKey, assigneeName, context, busy, error, description, onConfirm, onEntered }: EmrWorkEntryActionProps) {
  const [openedAuthority, setOpenedAuthority] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const inputId = useId();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const stale = openedAuthority !== null && openedAuthority !== authorityKey;
  const saving = busy || submitting;
  const label = mode === "start" ? "업무 시작하기" : "담당하기";
  const close = () => { if (!pending.current && !busy) setOpenedAuthority(null); };
  const submit = async () => {
    if (pending.current || busy || stale) return;
    if (mode === "blocked") { close(); return; }
    if (!onConfirm || (mode === "takeover" && !reason.trim())) return;
    pending.current = true; setSubmitting(true); setFailure(null);
    try {
      const result = await onConfirm(reason.trim());
      if (!mounted.current) return;
      if (result === "review_required") setOpenedAuthority(null);
      else if (result) { setOpenedAuthority(null); setReason(""); onEntered?.(); }
      else setFailure("처리하지 못했어요. 담당 상태를 확인한 뒤 다시 시도해 주세요.");
    } catch {
      if (mounted.current) setFailure("연결을 확인한 뒤 다시 시도해 주세요. 입력한 사유는 유지돼요.");
    } finally {
      pending.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };
  return <>
    <Button size="sm" disabled={saving} onClick={() => { setOpenedAuthority(authorityKey); setFailure(null); }}>{label}</Button>
    <Dialog open={openedAuthority !== null} onOpenChange={(open) => { if (!open) close(); }}>
      <EmrDialogShell variant="confirm"
        title={mode === "start" ? "업무를 시작할까요?" : mode === "takeover" ? "담당자를 변경할까요?" : mode === "blocked" ? "담당 상태를 확인해 주세요" : "이 업무를 담당할까요?"}
        description={description ?? (mode === "start" ? "현재 담당자로 업무를 진행해요." : mode === "takeover" ? `${assigneeName ?? "다른 담당자"}님이 담당하는 업무예요. 변경 사유는 요청 수의사에게 전달돼요.` : mode === "blocked" ? (assigneeName ? `${assigneeName}의 담당 변경 또는 인계가 필요해요.` : "이 업무의 담당 권한을 확인해 주세요.") : "나를 담당자로 지정하고 업무 화면을 열어요. 실제 업무는 아직 시작하지 않아요.")}
        secondaryAction={<Button variant="outline" disabled={saving} onClick={close}>{mode === "blocked" ? "닫기" : "취소"}</Button>}
        primaryAction={mode === "blocked" ? undefined : <Button disabled={saving || stale || (mode === "takeover" && !reason.trim())} onClick={() => void submit()}>{saving ? "처리 중" : label}</Button>}>
        {context && <div className="mb-4 rounded-lg border border-border px-4 py-3 text-sm">{context}</div>}
        {mode === "takeover" && <><label htmlFor={inputId} className="mb-2 block text-sm font-medium">담당 변경 사유</label><Textarea id={inputId} maxLength={1000} value={reason} disabled={saving} onChange={event => setReason(event.target.value)} /></>}
        {(stale || error || failure) && <p role="alert" className="mt-3 text-sm text-destructive">{stale ? "업무 내용이나 담당자가 변경됐어요. 창을 닫고 최신 상태를 확인해 주세요." : error || failure}</p>}
      </EmrDialogShell>
    </Dialog>
  </>;
}
