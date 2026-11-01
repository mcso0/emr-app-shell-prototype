"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { ClockIcon, ClipboardListIcon } from "@/components/icons";
import { CdsActionsPlusIcon, CdsActionsTrash2Icon, CdsActionsRotateCcwIcon, CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import { createOverallInstructionsClient, InstructionRequestError, type OverallInstructionsClient } from "./overall-instructions-client";
import { instructionScopeLabels, type InstructionScope, type OverallInstructions, type OverallInstructionsCommand } from "./overall-instructions-contract";
import { createInstructionDraft, getInstructionChanges, hasUnresolvedEmptyInstruction, instructionConflicts, type InstructionDraft } from "./overall-instructions-draft";
import { useChartStore } from "./store";
import styles from "./overall-instructions.module.css";

const reasons: Record<string, string> = {
  encounter_read_only: "현재 진료 상태에서는 지시사항을 조회만 할 수 있습니다.",
  permission_missing: "지시사항을 수정할 권한이 없습니다.", signed_chart_read_only: "서명된 차트는 조회만 할 수 있습니다.",
  no_confirmed_orders: "오더를 확정한 뒤 지시사항을 작성할 수 있습니다.", terminal_orders: "모든 오더의 수행이 끝나 조회만 할 수 있습니다.",
};
function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const p = (type: string) => parts.find(item => item.type === type)?.value;
  return `${p("year")}. ${p("month")}. ${p("day")} ${p("hour")}:${p("minute")}`;
}

function registerNavigationGuard(guard: () => Promise<boolean>) {
  useChartStore.setState({ flushOverallInstructions: guard });
  return () => { if (useChartStore.getState().flushOverallInstructions === guard) useChartStore.setState({ flushOverallInstructions: undefined }); };
}

export function OverallInstructionsEditor({ workspaceId, chartId, disabled }: { workspaceId: string; chartId: string; disabled: boolean }) {
  const client = useMemo(() => createOverallInstructionsClient(workspaceId, chartId), [workspaceId, chartId]);
  return <OverallInstructionsDialog key={`${workspaceId}:${chartId}`} client={client} disabled={disabled} registerGuard={registerNavigationGuard} />;
}

/** Authoring surface shared by the chart and synthetic interaction stories. */
export function OverallInstructionsDialog({ client, disabled = false, registerGuard }: { client: OverallInstructionsClient; disabled?: boolean; registerGuard?: (guard: () => Promise<boolean>) => () => void }) {
  const [open, setOpen] = useState(false);
  const [document, setDocument] = useState<OverallInstructions | null>(null);
  const [fields, setFields] = useState<InstructionDraft[]>([]);
  const [deleted, setDeleted] = useState<InstructionScope[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState(false);
  const [historyScope, setHistoryScope] = useState<InstructionScope | "all">("all");
  const [confirm, setConfirm] = useState<InstructionScope | "close" | null>(null);
  const [conflicts, setConflicts] = useState<InstructionScope[]>([]);
  const [conflictBefore, setConflictBefore] = useState<OverallInstructions | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pending = useRef<OverallInstructionsCommand | null>(null);
  const savingRef = useRef(false);
  const inputs = useRef(new Map<InstructionScope, HTMLTextAreaElement>());
  const focusScope = useRef<InstructionScope | null>(null);
  const title = useRef<HTMLSpanElement>(null);
  const navigationResolve = useRef<((allow: boolean) => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    const abort = new AbortController(); abortRef.current = abort;
    void client.load(abort.signal).then(value => {
      if (abort.signal.aborted) return;
      setDocument(value); setFields(createInstructionDraft(value));
    }).catch(() => { if (!abort.signal.aborted) setError("지시사항을 불러오지 못했습니다."); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => { abort.abort(); savingRef.current = false; };
  }, [client, open, retry]);
  useEffect(() => {
    if (!focusScope.current) return;
    const input = inputs.current.get(focusScope.current);
    if (input) { input.focus(); input.closest("section")?.scrollIntoView({ block: "nearest" }); focusScope.current = null; }
  }, [fields]);

  const changes = document ? getInstructionChanges(document, fields, deleted) : [];
  const emptyError = document ? hasUnresolvedEmptyInstruction(document, fields) : false;
  const dirty = (document ? getInstructionChanges(document, fields, deleted, false).length > 0 : false) || emptyError || conflicts.length > 0;
  const editable = !!document?.canEdit && !disabled;
  const locked = saving || uncertain || !editable;
  const choosing = !!document && editable && fields.length === 0 && deleted.length === 0;
  const choices = document?.eligibleScopes.filter(scope => !fields.some(field => field.scope === scope) && !deleted.includes(scope)) ?? [];
  useEffect(() => {
    if (!open || !dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [open, dirty]);
  useEffect(() => {
    if (!open || !registerGuard) return;
    const unregister = registerGuard(async () => {
      if (savingRef.current || uncertain || navigationResolve.current) return false;
      if (!dirty) return true;
      setConfirm("close");
      return new Promise<boolean>(resolve => { navigationResolve.current = resolve; });
    });
    return () => { unregister(); navigationResolve.current?.(false); navigationResolve.current = null; };
  }, [open, dirty, uncertain, registerGuard]);
  function resolveNavigation(allow: boolean) {
    navigationResolve.current?.(allow); navigationResolve.current = null;
  }
  function beginOpen() {
    setLoading(true); setSaving(false); setError(null); setDocument(null); setFields([]); setDeleted([]); setConflicts([]); setUncertain(false); setHistory(false); setConfirm(null); pending.current = null; setOpen(true);
  }
  function close() {
    if (savingRef.current || uncertain) return;
    if (dirty) setConfirm("close"); else setOpen(false);
  }
  function add(scope: InstructionScope) {
    if (locked || !choices.includes(scope)) return;
    focusScope.current = scope;
    setFields(current => [...current, { scope, text: "" }]);
  }
  function remove(scope: InstructionScope) {
    const saved = document?.current.find(item => item.scope === scope && !item.deleted && item.instruction);
    setFields(current => current.filter(field => field.scope !== scope));
    if (saved) setDeleted(current => [...current, scope]);
    setConfirm(null);
  }
  function undo(scope: InstructionScope) {
    const saved = document?.current.find(item => item.scope === scope);
    if (!saved) return;
    setDeleted(current => current.filter(item => item !== scope));
    setFields(current => [...current, { scope, text: saved.instruction }]); focusScope.current = scope;
  }
  async function save() {
    const abort = abortRef.current;
    if (!document || !abort || abort.signal.aborted || savingRef.current || !editable || conflicts.length || emptyError || (!changes.length && !pending.current)) return;
    const command = pending.current ?? { commandId: crypto.randomUUID(), changes };
    pending.current = command; savingRef.current = true; setSaving(true); setError(null);
    try {
      const value = await client.apply(command, abort.signal);
      if (abort.signal.aborted) return;
      pending.current = null; setUncertain(false); setDocument(value); setOpen(false);
      window.dispatchEvent(new Event("clair-instructions-changed"));
      toast.success("지시사항을 적용했습니다.");
    } catch (failure) {
      if (abort.signal.aborted) return;
      if (failure instanceof InstructionRequestError && failure.code === "revision_conflict") {
        try {
          const latest = await client.load(abort.signal);
          if (abort.signal.aborted) return;
          const scopeConflicts = instructionConflicts(document, latest, command.changes);
          const changed = new Set(command.changes.map(change => change.scope));
          setFields([...createInstructionDraft(latest).filter(field => !changed.has(field.scope)), ...fields.filter(field => changed.has(field.scope))]);
          setConflictBefore(document); setConflicts(scopeConflicts); setDocument(latest); pending.current = null; setUncertain(false);
          setError(scopeConflicts.length ? "변경된 내용을 비교하고 적용할 내용을 선택해 주세요." : "최신 지시를 불러왔습니다. 입력 내용을 확인하고 다시 적용해 주세요.");
        } catch { setUncertain(true); setError("최신 지시를 불러오지 못했습니다. 입력 내용은 유지됩니다."); }
      } else if (failure instanceof InstructionRequestError && !failure.uncertain) {
        pending.current = null; setUncertain(false); setError(reasons[failure.code] ?? "적용하지 못했습니다. 입력 내용은 유지됩니다.");
      } else { setUncertain(true); setError("적용 결과를 확인하지 못했습니다. 같은 요청의 결과를 확인해 주세요."); }
    } finally { if (!abort.signal.aborted) { savingRef.current = false; setSaving(false); } }
  }
  function resolve(scope: InstructionScope, useLatest: boolean) {
    if (useLatest) {
      const latest = document?.current.find(item => item.scope === scope && !item.deleted);
      setDeleted(current => current.filter(item => item !== scope));
      setFields(current => [...current.filter(field => field.scope !== scope), ...(latest?.instruction ? [{ scope, text: latest.instruction }] : [])]);
    }
    setConflicts(current => current.filter(item => item !== scope));
  }
  return <Dialog open={open} onOpenChange={value => value ? beginOpen() : close()}>
    <DialogTrigger render={<Button variant="outline" size="sm" />}>총괄 지시사항</DialogTrigger>
    {open && <EmrDialogShell variant="wide-form" title={<span ref={title} tabIndex={-1}>총괄 지시사항</span>}
      initialFocus={() => title.current} className={styles.dialog} headerClassName={styles.header} bodyClassName={styles.body} footerClassName={styles.footer}
      closeAriaLabel="총괄 지시사항 닫기" showCloseButton={!saving && !uncertain}
      footer={<><Button variant="ghost" size="sm" disabled={!document?.history.length || loading || saving} onClick={() => setHistory(true)}><ClockIcon />변경 이력</Button>
        {!choosing && <div className="ml-auto flex gap-2"><Button variant="outline" size="sm" disabled={saving || uncertain} onClick={close}>{editable ? "취소" : "닫기"}</Button>
          {editable && <Button size="sm" disabled={loading || saving || emptyError || !!conflicts.length || (!changes.length && !uncertain)} onClick={() => void save()}>{saving ? "적용 중…" : uncertain ? "결과 확인" : "적용"}</Button>}</div>}</>}>
      {loading ? <p role="status">지시사항을 불러오는 중입니다.</p> : null}
      {error && <div className="mb-3 text-sm" role="alert"><p>{error}</p>{!document && <Button variant="outline" size="sm" onClick={() => { setLoading(true); setError(null); setRetry(n => n + 1); }}>다시 조회</Button>}</div>}
      {document && !editable && <p className="mb-4 text-sm text-[var(--emr-text-secondary)]">{reasons[document.readOnlyReason ?? "permission_missing"]}</p>}
      {choosing ? <div className={styles.chooser}><div className={styles.symbol}><ClipboardListIcon className="size-6" /></div><h3>어디에 지시를 작성할까요?</h3>
        {choices.includes("overall") && <Button variant="outline" className="w-full" onClick={() => add("overall")}>전체 오더</Button>}
        <div className={styles.scopeGrid}>{choices.filter(scope => scope !== "overall").map(scope => <Button key={scope} variant="outline" onClick={() => add(scope)}>{instructionScopeLabels[scope].replace(/ 지시$/, "")}</Button>)}</div></div> : null}
      {!choosing && <div className={styles.fields}>{fields.map(field => {
        const saved = document?.current.find(item => item.scope === field.scope);
        return <section key={field.scope} className={styles.field} aria-label={instructionScopeLabels[field.scope]}>
          <div className={styles.fieldHeader}><label htmlFor={`instruction-${field.scope}`}>{instructionScopeLabels[field.scope]}</label>{editable && <Button variant="ghost" size="icon-sm" className="size-6" disabled={locked || !!conflicts.length} aria-label={`${instructionScopeLabels[field.scope]} 입력란 삭제`} onClick={() => field.text || saved?.instruction ? setConfirm(field.scope) : remove(field.scope)}><CdsActionsXIcon className="size-3.5" /></Button>}</div>
          <Textarea id={`instruction-${field.scope}`} ref={node => { if (node) inputs.current.set(field.scope, node); else inputs.current.delete(field.scope); }} maxLength={5000}
            value={field.text} readOnly={!editable} disabled={saving || uncertain || !!conflicts.length} placeholder="지시사항을 입력해 주세요."
            className={styles.input} onChange={event => setFields(current => current.map(item => item.scope === field.scope ? { ...item, text: event.target.value } : item))} />
          {saved?.legacy && editable && <p className="text-xs text-muted-foreground">적용하면 이 경구제 지시가 모든 조제 오더에 전달됩니다.</p>}
          <div className={styles.metadata}><span>{saved?.createdAt ? `${saved.actorName ?? ""} · ${formatTime(saved.createdAt)}` : ""}</span>{field.text.length >= 4500 && <span>{field.text.length.toLocaleString()} / 5,000</span>}</div>
        </section>;
      })}
      {deleted.map(scope => <div key={scope} className={styles.deleted}><CdsActionsTrash2Icon className="size-4" /><span>{instructionScopeLabels[scope]} 삭제 예정</span><Button variant="ghost" size="sm" disabled={locked || !!conflicts.length} onClick={() => undo(scope)}><CdsActionsRotateCcwIcon />되돌리기</Button></div>)}
      {emptyError && <p role="alert" className="text-sm">빈 지시는 적용할 수 없습니다. 저장된 지시를 지우려면 입력란 삭제를 눌러 주세요.</p>}
      {editable && choices.length > 0 && <DropdownMenu><DropdownMenuTrigger disabled={locked || !!conflicts.length} render={<Button variant="outline" className={styles.add} />}><CdsActionsPlusIcon className="size-4" />지시 추가</DropdownMenuTrigger><DropdownMenuContent>{choices.map(scope => <DropdownMenuItem key={scope} onClick={() => add(scope)}>{instructionScopeLabels[scope]}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}
      </div>}
      {!!conflicts.length && <div className="mt-4 space-y-4" role="alert">{conflicts.map(scope => <section key={scope}><h3 className="font-semibold">{instructionScopeLabels[scope]}</h3><p className="text-xs text-muted-foreground">편집 시작 시: {conflictBefore?.current.find(item => item.scope === scope)?.instruction || "작성된 지시 없음"}</p><div className="my-2 grid gap-3 sm:grid-cols-2"><div><h4>내 변경</h4><p className="whitespace-pre-wrap break-words">{deleted.includes(scope) ? "지시 삭제" : fields.find(field => field.scope === scope)?.text}</p></div><div><h4>최신 지시</h4><p className="whitespace-pre-wrap break-words">{document?.current.find(item => item.scope === scope)?.instruction || "지시 삭제됨"}</p></div></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => resolve(scope, false)}>내 변경 유지</Button><Button variant="outline" size="sm" onClick={() => resolve(scope, true)}>최신 지시 사용</Button></div></section>)}</div>}
      <Dialog open={confirm !== null} onOpenChange={value => { if (!value) { resolveNavigation(false); setConfirm(null); } }}><EmrConfirmDialogContent finalFocus={() => title.current} title={confirm === "close" ? "작성을 취소할까요?" : "이 지시를 삭제할까요?"} description={confirm === "close" ? "적용하지 않은 변경은 저장되지 않습니다." : "저장된 지시는 적용을 눌러야 삭제됩니다."} cancelLabel="계속 작성" confirmLabel={confirm === "close" ? "변경 버리기" : "삭제"} onCancel={() => { resolveNavigation(false); setConfirm(null); }} onConfirm={() => { if (confirm === "close") { resolveNavigation(true); setConfirm(null); setOpen(false); } else if (confirm) remove(confirm); }} /></Dialog>
      <Dialog open={history} onOpenChange={setHistory}><EmrDialogShell title="변경 이력" variant="wide-form" className="sm:max-w-[840px]" secondaryAction={<Button variant="outline" onClick={() => setHistory(false)}>닫기</Button>}>
        <label className="sr-only" htmlFor="instruction-history-scope">지시 범위</label><select id="instruction-history-scope" className="mb-4 rounded-md border bg-background p-2" value={historyScope} onChange={event => setHistoryScope(event.target.value as InstructionScope | "all")}><option value="all">전체 범위</option>{[...new Set(document?.history.map(item => item.scope))].map(scope => <option key={scope} value={scope}>{instructionScopeLabels[scope]}</option>)}</select>
        {document?.history.filter(item => historyScope === "all" || item.scope === historyScope).map(item => {
          const before = document.history.filter(previous => previous.scope === item.scope && previous.revision < item.revision).sort((a, b) => b.revision - a.revision)[0];
          const kind = item.deleted ? "지시 삭제" : !before ? "최초 지시" : before.deleted ? "다시 작성된 지시" : "변경된 지시";
          return <section key={`${item.scope}:${item.revision}`} className="mb-5"><h3 className="text-sm font-medium"><time>{formatTime(item.createdAt)}</time> · {item.actorName ?? "작성자"}</h3><p className="mb-2 text-xs text-muted-foreground">{item.legacy ? "경구제 지시 (이전 기록)" : instructionScopeLabels[item.scope]} · {kind}</p><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border p-3"><h4 className="mb-2 text-xs text-muted-foreground">변경 전</h4><p className="whitespace-pre-wrap break-words">{before?.deleted ? "지시 삭제됨" : before?.instruction || "작성된 지시 없음"}</p></div><div className="rounded-lg border p-3"><h4 className="mb-2 text-xs text-muted-foreground">변경 후</h4><p className="whitespace-pre-wrap break-words">{item.deleted ? "지시 삭제됨" : item.instruction || "작성된 지시 없음"}</p></div></div></section>;
        })}
      </EmrDialogShell></Dialog>
    </EmrDialogShell>}
  </Dialog>;
}
