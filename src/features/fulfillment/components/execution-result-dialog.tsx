"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  executionErrorMessage, getExecutionResultFields, isExecutionRecord, parseExecutionContext, parseExecutionPayload,
  type ExecutionContext, type ExecutionResultPayload, type ExecutionMeasurement,
} from "../execution-result-contract";
import { useTaskInstructionReview } from "../use-task-instruction-review";
import { TaskInstructionReview } from "./task-instruction-review";
import { FulfillmentWorkLifecycleAction } from "./work-lifecycle-action";

const localTimeInput = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const displayValue = (value: unknown) => value === null || value === undefined ? "미설정"
  : value === "acquired_new" ? "새 영상 촬영" : value === "reviewed_existing" ? "기존 영상자료 검토·판독"
    : Array.isArray(value) ? value.map(item => isExecutionRecord(item) ? `${item.name}: ${item.value} ${item.unit}` : String(item)).join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value);

type ExecutionResultDialogProps = {
  workspaceId: string; workItemId: string; taskId?: string; open: boolean;
  ownershipAllowed?: boolean; ownershipKey?: string; authorityStatus?: string;
  /** Instruction completion may save directly from requested/paused; the server checks roles. */
  instructionCompletion?: boolean;
  onOpenChange: (open: boolean) => void; onSaved: () => Promise<void>;
};
export function ExecutionResultDialog(props: ExecutionResultDialogProps) {
  return props.open ? <ExecutionResultDialogContent key={`${props.workspaceId}:${props.workItemId}:${props.taskId ?? "current"}`} {...props} /> : null;
}
function ExecutionResultDialogContent({ workspaceId, workItemId, taskId, open, ownershipAllowed, ownershipKey, authorityStatus, instructionCompletion = false, onOpenChange, onSaved }: ExecutionResultDialogProps) {
  const [context, setContext] = useState<ExecutionContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [deviceParameters, setDeviceParameters] = useState<Array<{ name: string; value: string; unit: string }>>([]);
  const [performedAt, setPerformedAt] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [amendmentReason, setAmendmentReason] = useState("");
  const [amending, setAmending] = useState(false);
  const scope = useRef(0);
  const mounted = useRef(false);
  const pendingSave = useRef(false);
  const command = useRef<{ fingerprint: string; id: string } | null>(null);
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/fulfillment/work-items/${encodeURIComponent(workItemId)}/execution`;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const generation = ++scope.current;
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${endpoint}${taskId ? `?taskId=${encodeURIComponent(taskId)}` : ""}`, { cache: "no-store", signal: abort.signal });
        const body: unknown = await response.json();
        if (scope.current !== generation) return;
        if (!response.ok || !isExecutionRecord(body) || body.ok !== true) {
          setError(executionErrorMessage(isExecutionRecord(body) && typeof body.error === "string" ? body.error : "request_failed")); return;
        }
        const loaded = parseExecutionContext(body.context, workspaceId, workItemId, taskId);
        if (!loaded) { setError(executionErrorMessage("invalid_execution_response")); return; }
        setContext(loaded);
      } catch { if (scope.current === generation && !abort.signal.aborted) setError(executionErrorMessage("request_failed")); }
      finally { if (scope.current === generation) setLoading(false); }
    })();
    return () => { scope.current = generation + 1; abort.abort(); };
  }, [endpoint, refreshKey, taskId, workItemId, workspaceId, ownershipKey]);

  const instructionReview = useTaskInstructionReview(workspaceId, context ? [context.taskId] : [], ownershipKey);
  const fields = context ? getExecutionResultFields(context) : [];
  const payload: ExecutionResultPayload = {};
  for (const field of fields) {
    if (field.type === "measurements") {
      if (draft.deviceSettingsPolicy !== "not_adjustable" && deviceParameters.length) payload[field.key] = deviceParameters.map(item => ({ ...item, value: item.value.trim() ? Number(item.value) : Number.NaN }));
      continue;
    }
    const value = draft[field.key]?.trim();
    if (!value) continue;
    payload[field.key] = ["number", "signed_number"].includes(field.type) ? Number(value) : field.type === "lines" ? value.split("\n").map(x => x.trim()).filter(Boolean) : value;
  }
  const canWrite = ownershipAllowed !== false && (!authorityStatus || authorityStatus === context?.status) && context?.canRecord && context.isCurrentAttempt &&
    ((context.status === "in_progress" || instructionCompletion && ["dispensing", "treatment"].includes(context.clinicalOrderType) && ["requested", "paused"].includes(context.status)) && context.results.length === 0 || context.status === "completed" && amending);
  const valid = context && parseExecutionPayload(context.clinicalOrderType, payload, context.planSnapshot) && performedAt &&
    Number.isFinite(new Date(performedAt).getTime()) && (!amending || amendmentReason.trim());
  const save = async () => {
    if (!context || !canWrite || !valid || pendingSave.current) return;
    const generation = scope.current;
    const body = { expectedRevision: context.workItemRevision, expectedPlanSha256: context.planSha256,
      expectedResultVersion: context.results.length, performedAt: new Date(performedAt).toISOString(), payload,
      varianceReason: varianceReason.trim() || null, amendmentReason: amending ? amendmentReason.trim() : null };
    const fingerprint = JSON.stringify(body);
    if (!amending && command.current?.fingerprint !== fingerprint && !await instructionReview.check()) return;
    if (!mounted.current || scope.current !== generation) return;
    if (command.current?.fingerprint !== fingerprint) command.current = { fingerprint, id: crypto.randomUUID() };
    pendingSave.current = true;
    setSaving(true); setError(null); setNotice(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, commandId: command.current.id }) });
      const result: unknown = await response.json();
      if (!mounted.current) return;
      if (!response.ok || !isExecutionRecord(result) || result.ok !== true) {
        if (isExecutionRecord(result) && result.error === "instruction_ack_required") { instructionReview.requireReview(); command.current = null; return; }
        setError(executionErrorMessage(isExecutionRecord(result) && typeof result.error === "string" ? result.error : "request_failed")); return;
      }
      const saved = parseExecutionContext(result.context, workspaceId, workItemId);
      if (!saved) { setError(executionErrorMessage("invalid_execution_response")); return; }
      // A same-item ownership refresh may overtake this POST. Reconcile the
      // successful save, but never replace newer read authority with its reply.
      if (scope.current === generation) setContext(saved);
      setRefreshKey(key => key + 1);
      setAmending(false); setDraft({}); setDeviceParameters([]); setPerformedAt(""); command.current = null;
      setNotice("수행기록을 저장했습니다. 확정 계획과 이전 기록은 그대로 남아 있습니다.");
      try { await onSaved(); } catch { if (mounted.current) setNotice("기록은 저장됐지만 업무 목록을 새로고침하지 못했습니다. 목록을 다시 불러와 주세요."); }
    } catch { if (mounted.current) setError(executionErrorMessage("request_failed")); }
    finally { pendingSave.current = false; if (mounted.current) setSaving(false); }
  };
  const details = context && isExecutionRecord(context.planSnapshot.detailInputs) ? context.planSnapshot.detailInputs : {};
  const calculations = context && isExecutionRecord(context.planSnapshot.calculationOutputs) ? context.planSnapshot.calculationOutputs : {};
  const planFields = [
    ["용량", details.dose], ["용량 단위", details.doseUnit], ["투여 경로", details.route], ["투여 빈도", details.frequency],
    ["기간(일)", details.durationDays], ["처방 총량", details.totalQuantity],
    ["준비 예정 총량", calculations.plannedPracticalTotalQuantity], ["준비 단위", calculations.dispenseUnit],
    ["시행 방법", details.method], ["부위", details.site], ["촬영·검토 부위", details.bodyRegion], ["촬영·검토 뷰", details.views],
    ["예정 횟수", details.plannedProcedureCount], ["횟수 단위", details.procedureCountUnit], ["시행 일정", details.schedule],
    ["예정 사용량", details.plannedAmount], ["예정 사용 단위", details.plannedAmountUnit],
    ["장비 프로토콜", details.deviceProtocol], ["관찰 항목", details.observationDomains],
  ].filter(([, value]) => value !== undefined);
  return <Dialog open={open} onOpenChange={(next) => { if (!pendingSave.current) onOpenChange(next); }}>
    <EmrDialogShell variant="wide-form" title="실제 수행기록" description="확정된 계획과 실제 수행값을 구분해서 기록해 주세요. 정정은 이전 기록을 남기고 새 버전으로 저장됩니다."
      secondaryAction={<Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>닫기</Button>}
      primaryAction={canWrite ? <Button disabled={!valid || saving} onClick={() => void save()}>{saving ? "저장 중" : amending ? "정정 저장" : "수행기록 저장 및 완료"}</Button> : null}>
      <div className="space-y-4" data-testid="execution-result-dialog">
        <TaskInstructionReview controller={instructionReview} />
        {loading ? <p role="status">확정 계획과 수행기록을 불러오는 중입니다.</p> : null}
        {error ? <div role="alert" className="space-y-2"><p>{error}</p><Button variant="outline" onClick={() => {
          setContext(null); setError(null); setNotice(null); setDraft({}); setDeviceParameters([]); setPerformedAt(""); setVarianceReason("");
          setAmendmentReason(""); setAmending(false); setLoading(true); command.current = null; setRefreshKey(x => x + 1);
        }}>입력 초기화 및 최신 기록 불러오기</Button></div> : null}
        {notice ? <p role="status">{notice}</p> : null}
        {context ? <>
          <section className="space-y-2 rounded-lg border p-3">
            <h3 className="font-semibold">확정 계획 · {context.attemptNo}회차</h3>
            {planFields.length ? <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">{planFields.map(([label, value]) =>
              <div key={String(label)}><dt className="text-muted-foreground">{String(label)}</dt><dd>{displayValue(value)}</dd></div>)}</dl>
              : <p className="text-sm text-muted-foreground">표시할 예정값이 없습니다. 실제 수행한 내용을 직접 기록해 주세요.</p>}
            <p className="text-xs text-muted-foreground">실제 수량을 기록해도 확정 계획과 청구수량은 자동으로 바뀌지 않습니다.</p>
          </section>
          {context.results.length ? <section className="space-y-2"><h3 className="font-semibold">수행·정정 이력</h3>
            {context.results.map(record => <details key={record.id} className="rounded-lg border p-3" open={record.version === context.results.length}>
              <summary className="cursor-pointer text-sm">버전 {record.version} · {new Date(record.recordedAt).toLocaleString("ko-KR")}{record.version > 1 ? " · 정정" : " · 최초 기록"}</summary>
              <dl className="mt-2 space-y-1 text-sm">{fields.filter(field => record.payload[field.key] !== undefined).map(field =>
                <div key={field.key}><dt className="text-muted-foreground">{field.label}</dt><dd className="whitespace-pre-wrap">{displayValue(record.payload[field.key])}</dd></div>)}
                <div><dt>실제 수행 시각</dt><dd>{new Date(record.performedAt).toLocaleString("ko-KR")}</dd></div>
                <div><dt>수행자 ID</dt><dd className="break-all">{record.performedByUserId}</dd></div>
                <div><dt>기록자 ID</dt><dd className="break-all">{record.recordedByUserId}</dd></div>
                {record.varianceReason ? <div><dt>계획과의 차이 사유</dt><dd>{record.varianceReason}</dd></div> : null}
                {record.amendmentReason ? <div><dt>정정 사유</dt><dd>{record.amendmentReason}</dd></div> : null}
              </dl>
            </details>)}
            {ownershipAllowed !== false && context.canRecord && context.isCurrentAttempt && context.status === "completed" && !amending ? <Button variant="outline" onClick={() => {
              const latest = context.results.at(-1)!;
              setDraft(Object.fromEntries(Object.entries(latest.payload).map(([key, value]) => [key, Array.isArray(value) ? value.join("\n") : String(value)])));
              setDeviceParameters(((latest.payload.deviceParameters ?? []) as ExecutionMeasurement[]).map(item => ({ ...item, value: String(item.value) })));
              setPerformedAt(localTimeInput(latest.performedAt)); setVarianceReason(latest.varianceReason ?? ""); setAmendmentReason(""); setAmending(true); setNotice(null);
            }}>기록 정정</Button> : null}
          </section> : null}
          {ownershipAllowed === false || !context.canRecord ? <p className="text-sm text-muted-foreground">조회 전용입니다. 수행기록을 변경할 수 없습니다.</p> : null}
          {context.status === "requested" && !instructionCompletion ? <p className="text-sm">먼저 업무를 시작한 뒤 실제 수행값을 기록해 주세요.</p> : null}
          {canWrite ? <fieldset disabled={saving} className="space-y-3">
            <legend className="mb-3 font-semibold">{amending ? "기록 정정 · 기존 실제값에서 수정" : "실제 수행값 · 직접 입력"}</legend>
            <div className="space-y-1"><label htmlFor="execution-performed-at" className="text-sm">실제 수행 시각 *</label><div className="flex gap-2">
              <Input id="execution-performed-at" type="datetime-local" value={performedAt} onChange={event => setPerformedAt(event.target.value)} />
              <Button variant="outline" onClick={() => setPerformedAt(localTimeInput(new Date().toISOString()))}>현재 시각</Button>
            </div></div>
            {fields.map(field => <div key={field.key} className="space-y-1"><label htmlFor={`execution-${field.key}`} className="text-sm">{field.label}{field.required ? " *" : ""}</label>
              {field.type === "measurements" ? <div className="space-y-2">
                {deviceParameters.map((item, index) => <div key={index} className="flex gap-2">
                  {(["name", "value", "unit"] as const).map(key => <Input key={key} aria-label={`장비 설정 ${index + 1} ${key === "name" ? "이름" : key === "value" ? "값" : "단위"}`}
                    placeholder={key === "name" ? "설정 이름" : key === "value" ? "실제 숫자" : "단위"} type={key === "value" ? "number" : "text"} step={key === "value" ? "any" : undefined}
                    value={item[key]} onChange={event => setDeviceParameters(items => items.map((row, i) => i === index ? { ...row, [key]: event.target.value } : row))} />)}
                  <Button variant="outline" onClick={() => setDeviceParameters(items => items.filter((_, i) => i !== index))}>삭제</Button>
                </div>)}
                <Button variant="outline" disabled={draft.deviceSettingsPolicy === "not_adjustable" || deviceParameters.length >= 100} onClick={() => setDeviceParameters(items => [...items, { name: "", value: "", unit: "" }])}>설정값 추가</Button>
              </div> : field.type === "imaging_disposition" ? <Select value={draft[field.key] ?? ""} onValueChange={value => setDraft(d => ({ ...d, [field.key]: value ?? "" }))}>
                <SelectTrigger id={`execution-${field.key}`}><SelectValue placeholder="직접 선택" /></SelectTrigger><SelectContent>
                  <SelectItem value="acquired_new">새 영상 촬영</SelectItem><SelectItem value="reviewed_existing">기존 영상자료 검토·판독</SelectItem>
                </SelectContent>
              </Select> : field.type === "device_policy" ? <Select value={draft[field.key] ?? ""} onValueChange={value => { setDraft(d => ({ ...d, [field.key]: value ?? "" })); if (value === "not_adjustable") setDeviceParameters([]); }}>
                <SelectTrigger id={`execution-${field.key}`}><SelectValue placeholder="직접 선택" /></SelectTrigger><SelectContent>
                  <SelectItem value="recorded_parameters">실제 설정값 기록</SelectItem><SelectItem value="not_adjustable">조절 설정 없음 · 해당 없음</SelectItem>
                </SelectContent></Select> : field.type === "quality" ? <Select value={draft[field.key] ?? ""} onValueChange={value => setDraft(d => ({ ...d, [field.key]: value ?? "" }))}>
                <SelectTrigger id={`execution-${field.key}`}><SelectValue placeholder="직접 선택" /></SelectTrigger><SelectContent>
                  <SelectItem value="diagnostic">판독 가능</SelectItem><SelectItem value="limited">제한적 판독</SelectItem><SelectItem value="non_diagnostic">판독 불가</SelectItem>
                </SelectContent></Select> : ["number", "signed_number"].includes(field.type) ?
                <Input id={`execution-${field.key}`} type="number" min={field.type === "number" ? 0 : -1000000} max={1000000} step="any" value={draft[field.key] ?? ""} onChange={event => setDraft(d => ({ ...d, [field.key]: event.target.value }))} /> :
                <Textarea id={`execution-${field.key}`} value={draft[field.key] ?? ""} maxLength={4000} onChange={event => setDraft(d => ({ ...d, [field.key]: event.target.value }))} />}
            </div>)}
            <div className="space-y-1"><label htmlFor="execution-variance" className="text-sm">계획과의 차이 사유</label><Textarea id="execution-variance" value={varianceReason} maxLength={500} onChange={event => setVarianceReason(event.target.value)} /></div>
            {amending ? <div className="space-y-1"><label htmlFor="execution-amendment" className="text-sm">정정 사유 *</label><Textarea id="execution-amendment" value={amendmentReason} maxLength={500} onChange={event => setAmendmentReason(event.target.value)} /></div> : null}
          </fieldset> : null}
        </> : null}
      </div>
    </EmrDialogShell>
  </Dialog>;
}

export function FulfillmentExecutionActions({ workspaceId, workItemId, onSaved, children, ...lifecycle }: {
  workspaceId: string; workItemId: string; onSaved: () => Promise<void>;
  children?: ReactNode;
} & Parameters<typeof FulfillmentWorkLifecycleAction>[0]) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="outline" size={lifecycle.size ?? "sm"} onClick={() => setOpen(true)}>수행기록·이력</Button>
    {children}
    <FulfillmentWorkLifecycleAction {...lifecycle} completeRequiresRecord onTransition={async (action, options) => {
      if (action === "complete") { setOpen(true); return true; }
      return lifecycle.onTransition(action, options);
    }} />
    <ExecutionResultDialog key={`${workspaceId}:${workItemId}`} workspaceId={workspaceId} workItemId={workItemId} open={open} ownershipAllowed={lifecycle.canManage} ownershipKey={`${lifecycle.assignedToUserId}:${lifecycle.canManage}:${lifecycle.status}`} authorityStatus={lifecycle.status} onOpenChange={setOpen} onSaved={onSaved} />
  </>;
}
