"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatOrderFinancialValue, orderFinancialLabels, confirmedOrderContextSchema, confirmedOrderEditSchema, confirmedOrderErrors, type ConfirmedOrderContext, type OrderFinancialValues } from "../confirmed-order-edit-contract";

export function ConfirmedOrderEditDialog({ workspaceId, chartId, orderId, name, clinicalType, fieldLabels, renderClinical, onClose, onSaved }: {
  workspaceId: string; chartId: string; orderId: string; name: string; clinicalType: "dispensing" | "treatment"; fieldLabels?: Record<string, string>;
  renderClinical: (inputs: Record<string, unknown>, change: (inputs: Record<string, unknown>) => void, disabled: boolean) => ReactNode;
  onClose: () => void; onSaved: (context: ConfirmedOrderContext) => void;
}) {
  const [context, setContext] = useState<ConfirmedOrderContext | null>(null);
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [financial, setFinancial] = useState<OrderFinancialValues | null>(null);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [conflict, setConflict] = useState(false);
  const pending = useRef(false), generation = useRef(0);
  const retry = useRef<{ fingerprint: string; commandId: string } | null>(null);
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/confirmed-order-edit`;
  useEffect(() => {
    const current = ++generation.current; const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${endpoint}?chartId=${chartId}&orderId=${orderId}`, { cache: "no-store", signal: abort.signal });
        const body = await response.json();
        if (current !== generation.current) return;
        const parsed = confirmedOrderContextSchema.safeParse(body.context);
        if (!response.ok || !body.ok || !parsed.success) throw new Error(body.error ?? "unavailable");
        setContext(parsed.data); setInputs(parsed.data.detailInputs); setFinancial(parsed.data.pendingFinancial ?? parsed.data.financial);
        setMode(parsed.data.actualDispenseMode); setQuantity(parsed.data.actualDispenseQuantity == null ? "" : String(parsed.data.actualDispenseQuantity));
        setError(null); setConflict(false); retry.current = null;
      } catch (cause) { if (!abort.signal.aborted && current === generation.current) setError(confirmedOrderErrors[cause instanceof Error ? cause.message : "unavailable"] ?? confirmedOrderErrors.unavailable); }
    })();
    return () => { generation.current = current + 1; abort.abort(); };
  }, [endpoint, chartId, orderId, reload]);
  const baseFinancial = context?.pendingFinancial ?? context?.financial;
  const financialPatch = financial && baseFinancial ? Object.fromEntries(Object.entries(financial).filter(([key, value]) => value !== baseFinancial[key as keyof OrderFinancialValues])) : {};
  const clinicalChanged = Boolean(context && (JSON.stringify(inputs) !== JSON.stringify(context.detailInputs) || mode !== context.actualDispenseMode || (mode === "manual" && Number(quantity) !== context.actualDispenseQuantity)));
  const financialChanged = Object.keys(financialPatch).length > 0;
  const changed = clinicalChanged || financialChanged;
  const save = async () => {
    if (!context || !changed || pending.current || conflict) return;
    const content = { orderId, chartId, expectedVersion: context.version, reason,
      ...(clinicalChanged ? { clinical: { detailInputs: inputs, detailSchemaVersion: context.detailSchemaVersion, actualDispenseMode: mode, ...(mode === "manual" ? { actualDispenseQuantity: Number(quantity) } : {}) } } : {}),
      ...(financialChanged ? { financial: financialPatch } : {}),
    };
    const fingerprint = JSON.stringify(content);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, commandId: crypto.randomUUID() };
    const parsed = confirmedOrderEditSchema.safeParse({ ...content, commandId: retry.current.commandId });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? confirmedOrderErrors.invalid_input); return; }
    pending.current = true; setBusy(true); setError(null); const current = generation.current;
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const body = await response.json(); if (current !== generation.current) return;
      const result = confirmedOrderContextSchema.safeParse(body.context);
      if (!response.ok || !body.ok || !result.success) {
        if (body.error === "revision_conflict") setConflict(true);
        throw new Error(body.error ?? "unavailable");
      }
      onSaved(result.data);
    } catch (cause) { if (current === generation.current) setError(confirmedOrderErrors[cause instanceof Error ? cause.message : "unavailable"] ?? confirmedOrderErrors.unavailable); }
    finally { pending.current = false; if (current === generation.current) setBusy(false); }
  };
  const saveLabel = context?.billingStage === "requested" ? "변경 확인 요청" : clinicalChanged ? "수정 후 요청" : "수정 저장";
  return <Dialog open onOpenChange={open => { if (!open && !pending.current) onClose(); }}>
    <EmrDialogShell title={`${name} · 오더 수정`} variant="wide-form" showCloseButton={!busy}
      secondaryAction={<Button variant="outline" disabled={busy} onClick={onClose}>취소</Button>}
      primaryAction={<Button disabled={busy || !context || !changed || conflict || (clinicalChanged && reason.trim().length < 3)} onClick={() => void save()}>{busy ? "저장 중…" : saveLabel}</Button>}>
      {!context && !error && <p role="status">최신 오더를 불러오는 중…</p>}
      {context && <div className="space-y-6">
        <fieldset disabled={busy || !context.canEditClinical} className="space-y-3"><legend className="mb-3 text-sm font-semibold">업무 정보</legend>
          {!context.canEditClinical && <p className="text-sm text-muted-foreground">업무 수정 권한이 없어요.</p>}
          {renderClinical(inputs, setInputs, busy || !context.canEditClinical)}
          {clinicalType === "dispensing" && <div className="grid gap-1.5 text-sm"><span>요청 조제량</span><div className="flex items-center gap-2"><Input aria-label="요청 조제량" type="number" min="0" step="any" disabled={mode === "automatic"} value={mode === "automatic" && clinicalChanged ? "" : quantity} placeholder={mode === "automatic" && clinicalChanged ? "저장 시 자동 계산" : undefined} onChange={e => setQuantity(e.target.value)} /><Button variant="outline" type="button" onClick={() => setMode(mode === "automatic" ? "manual" : "automatic")}>{mode === "automatic" ? "직접 입력" : "자동 계산"}</Button></div></div>}
        </fieldset>
        {financial && <fieldset disabled={busy || !context.canEditFinancial || context.billingStage === "locked"} className="space-y-3"><legend className="mb-3 text-sm font-semibold">청구 정보</legend>
          {(!context.canEditFinancial || context.billingStage === "locked") && <p className="text-sm text-muted-foreground">{context.billingStage === "locked" ? "결제 중·완료된 금액은 수납 정정에서 처리해 주세요." : "청구 수정 권한이 없어요."}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">청구명<Input value={financial.billingName} onChange={e => setFinancial({ ...financial, billingName: e.target.value })} /></label>
            {([['billingQuantity', '청구 수량'], ['unitPriceKrw', '단가 (원)']] as const).map(([key, label]) => <label key={key} className="grid gap-1.5 text-sm">{label}<Input type="number" step="any" value={Number.isNaN(financial[key]) ? "" : financial[key]} onChange={e => setFinancial({ ...financial, [key]: e.target.value === "" ? NaN : Number(e.target.value) })} /></label>)}
            <label className="grid gap-1.5 text-sm">할인·할증 방식<Select disabled={busy || !context.canEditFinancial || context.billingStage === "locked"} value={financial.adjustmentSource ?? "none"} onValueChange={value => setFinancial({ ...financial, adjustmentSource: value === "none" ? null : value as "amount" | "percent", ...(value === "none" ? { adjustmentAmountKrw: 0, adjustmentPercent: 0 } : {}) })}><SelectTrigger className="w-full" aria-label="할인·할증 방식"><SelectValue>{financial.adjustmentSource === "amount" ? "금액" : financial.adjustmentSource === "percent" ? "비율" : "없음"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="none">없음</SelectItem><SelectItem value="amount">금액</SelectItem><SelectItem value="percent">비율</SelectItem></SelectContent></Select></label>
            {financial.adjustmentSource && <label className="grid gap-1.5 text-sm">{financial.adjustmentSource === "amount" ? "할인·할증 (원)" : "할인·할증 (%)"}<Input type="number" step={financial.adjustmentSource === "amount" ? "1" : "any"} value={(financial.adjustmentSource === "amount" ? financial.adjustmentAmountKrw : financial.adjustmentPercent) || 0} onChange={e => setFinancial({ ...financial, [financial.adjustmentSource === "amount" ? "adjustmentAmountKrw" : "adjustmentPercent"]: e.target.value === "" ? NaN : Number(e.target.value) })} /></label>}
            <label className="grid gap-1.5 text-sm">과세<Select disabled={busy || !context.canEditFinancial || context.billingStage === "locked"} value={financial.taxClass} onValueChange={value => { if (value === "taxable" || value === "non_taxable") setFinancial({ ...financial, taxClass: value }); }}><SelectTrigger className="w-full" aria-label="과세"><SelectValue>{financial.taxClass === "taxable" ? "과세" : "면세"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="taxable">과세</SelectItem><SelectItem value="non_taxable">면세</SelectItem></SelectContent></Select></label>
            <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="청구에 반영" disabled={busy || !context.canEditFinancial || context.billingStage === "locked"} checked={financial.billingReflectionEnabled} onCheckedChange={checked => setFinancial({ ...financial, billingReflectionEnabled: Boolean(checked) })} />청구에 반영</label>
          </div><p className="text-xs text-muted-foreground">할인은 음수, 할증은 양수로 입력해 주세요.</p>
        </fieldset>}
        {changed && <section className="rounded-lg border p-3 text-sm" aria-label="변경 내용"><h3 className="mb-2 font-medium">변경 내용</h3>
          {clinicalChanged && <><p>업무 내용 변경을 담당자에게 전달해요. 기존 수행 기록은 보존해요.</p>{Object.keys({ ...context.detailInputs, ...inputs }).filter(key => JSON.stringify(inputs[key]) !== JSON.stringify(context.detailInputs[key])).map(key => <p key={key}>{fieldLabels?.[key] ?? key}: {String(context.detailInputs[key] ?? "—")} → {String(inputs[key] ?? "—")}</p>)}</>}
          {Object.entries(financialPatch).map(([key, value]) => <p key={key}>{orderFinancialLabels[key as keyof OrderFinancialValues]}: {formatOrderFinancialValue(baseFinancial?.[key as keyof OrderFinancialValues])} → {formatOrderFinancialValue(value)}</p>)}
          {clinicalChanged && (mode !== context.actualDispenseMode || (mode === "manual" && Number(quantity) !== context.actualDispenseQuantity)) && <p>요청 조제량: {context.actualDispenseQuantity ?? "자동 계산"} → {mode === "manual" ? quantity : "자동 계산"}</p>}
          {!clinicalChanged && <p>조제·처치 변경 안내는 보내지 않아요.</p>}
          {context.billingStage === "requested" && <p className="mt-2">수납 담당자가 확인하기 전에는 기존 청구금액을 유지해요.</p>}
          {context.taskStatus === "complete" && clinicalChanged && <p className="mt-2">새 작업을 요청해요. 수행기록만 바로잡으려면 지시서의 기록 정정을 이용해 주세요.</p>}
        </section>}
        <label className="grid gap-1.5 text-sm">수정 사유{clinicalChanged ? " *" : " (선택)"}<Textarea maxLength={500} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} placeholder={clinicalChanged ? "3자 이상 입력해 주세요." : undefined} /></label>
      </div>}
      {error && <div role="alert" className="mt-4 space-y-2 text-sm"><p>{error}</p>{(!context || conflict) && <Button variant="outline" disabled={busy} onClick={() => setReload(n => n + 1)}>{conflict ? "입력을 버리고 최신 내용 조회" : "다시 조회"}</Button>}</div>}
    </EmrDialogShell>
  </Dialog>;
}
