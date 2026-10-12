"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LabResult, LabResultRow } from "@/types/emr-domain";
import { parseLabProfileConfiguration, type LabProfileConfiguration } from "../server-result-profile-core";
import { isExecutionUuid } from "@/features/fulfillment/execution-result-contract";

const errors: Record<string, string> = {
  lab_result_revision_conflict: "원본 결과가 변경됐습니다. 결과를 다시 불러온 뒤 요청해 주세요.",
  lab_retest_atomic_order_required: "독립된 하위 검사 오더에서만 재검을 요청할 수 있습니다.",
  lab_retest_catalog_billing_unavailable: "현재 카탈로그에서 청구 가능한 가격 설정을 확인할 수 없습니다.",
  lab_result_profile_binding_required: "병원 프로필 설정이 변경됐습니다. 새로 열어서 다시 선택해 주세요.",
  current_assignee_required: "현재 담당자만 재검을 요청할 수 있습니다.",
  permission_missing: "재검 오더를 요청할 권한이 없습니다.", encounter_unavailable: "이 진료에서 새 오더를 만들 수 없습니다.",
};
export function AtomicLabRetestAction({ result, row, disabled = false }: { result: LabResult; row: LabResultRow; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  if (result.resultDefinitionOrigin !== "canonical" || !result.orderId || !result.entryWriteRevision) return null;
  return <>
    <Button variant="outline" size="xs" disabled={disabled} onClick={() => setOpen(true)} aria-label={`${row.analyteName}만 재검 요청`}>이 항목 재검</Button>
    {open ? <AtomicRetestDialog key={`${result.workspaceId}:${result.id}:${row.id}`} result={result} row={row} disabled={disabled} onClose={() => setOpen(false)} /> : null}
  </>;
}
function AtomicRetestDialog({ result, row, disabled, onClose }: { result: LabResult; row: LabResultRow; disabled: boolean; onClose: () => void }) {
  const [config, setConfig] = useState<LabProfileConfiguration | null>(null);
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState(""); const [specimen, setSpecimen] = useState(""); const [reference, setReference] = useState("");
  const [billing, setBilling] = useState("no_charge"); const [binding, setBinding] = useState(""); const [created, setCreated] = useState<string | null>(null);
  const command = useRef<{ fingerprint: string; id: string } | null>(null); const alive = useRef(true);
  useEffect(() => {
    const abort = new AbortController(); alive.current = true;
    void (async () => {
      try {
        const response = await fetch(`/api/workspaces/${encodeURIComponent(result.workspaceId)}/lab-imaging/result-profiles?orderId=${encodeURIComponent(result.orderId!)}`, { cache: "no-store", signal: abort.signal });
        const body = await response.json(); if (abort.signal.aborted) return;
        const parsed = response.ok && body.ok ? parseLabProfileConfiguration(body.configuration, result.workspaceId, result.orderId) : null;
        if (!parsed) setError("현재 병원 프로필을 불러오지 못했습니다."); else setConfig(parsed);
      } catch { if (!abort.signal.aborted) setError("현재 병원 프로필을 불러오지 못했습니다."); }
    })();
    return () => { alive.current = false; abort.abort(); };
  }, [result.workspaceId, result.orderId]);
  const selected = config?.bindings.find(b => `${b.profile_version_id}:${b.device_id}` === binding);
  const valid = !disabled && config?.canRetest === true && reason.trim() && specimen && reference.trim() && billing && selected && !saving && !created;
  const submit = async () => {
    if (!valid || !selected) return;
    const input = { resultId: result.id, rowId: row.id, expectedEntryWriteRevision: result.entryWriteRevision, reason: reason.trim(),
      specimenDecision: specimen, specimenReference: reference.trim(), billingPolicy: billing, profileVersionId: selected.profile_version_id, deviceId: selected.device_id };
    const fingerprint = JSON.stringify(input);
    if (command.current?.fingerprint !== fingerprint) command.current = { fingerprint, id: crypto.randomUUID() };
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(result.workspaceId)}/lab-imaging/retests`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, requestId: command.current.id }),
      });
      const body = await response.json(); if (!alive.current) return;
      if (!response.ok || !body.ok || body.workspaceId !== result.workspaceId || body.priorOrderId !== result.orderId
        || body.encounterId !== result.encounterId || !isExecutionUuid(body.orderId) || body.confirmationStatus !== "draft") {
        setError(errors[body.error] ?? "재검 요청을 완료하지 못했습니다. 입력은 유지했습니다."); return;
      }
      setCreated(body.orderId);
    } catch { if (alive.current) setError("응답을 확인하지 못했습니다. 같은 요청으로 다시 시도할 수 있습니다."); }
    finally { if (alive.current) setSaving(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <EmrDialogShell variant="form" title={`${row.analyteName} 재검 요청`} description="기존 결과를 보존하고 같은 진료에 새 오더 초안을 만듭니다. 차트에서 별도로 확정해야 합니다."
      primaryAction={<Button disabled={!valid} onClick={() => void submit()}>{saving ? "요청 중" : "재검 오더 초안 만들기"}</Button>}>
      <div className="grid gap-3" data-testid="lab-atomic-retest-dialog">
        <p className="text-sm">원본 결과 v{result.entryWriteRevision} · {row.analyteName}: {row.value ?? "측정 불가"} {row.unit}</p>
        {error ? <p role="alert">{error}</p> : null}
        {!config && !error ? <p role="status">병원 프로필 확인 중</p> : null}
        {config && !config.canRetest ? <p role="status">조회 전용 · 재검 요청 권한 없음</p> : null}
        {created ? <p role="status">새 재검 초안을 만들었습니다. 기존 결과는 유지됩니다. <Link className="underline" href={`/w/${encodeURIComponent(result.workspaceId)}/chart?encounterId=${encodeURIComponent(result.encounterId)}`}>차트에서 확인·확정</Link></p> : null}
        <Textarea aria-label="재검 사유" placeholder="재검 사유" value={reason} maxLength={2000} disabled={disabled || saving || !!created} onChange={event => setReason(event.target.value)} />
        <select aria-label="재검 검체 결정" className="h-9 rounded-md border bg-background px-2" value={specimen} disabled={disabled || saving || !!created} onChange={event => setSpecimen(event.target.value)}>
          <option value="">검체 결정 선택</option><option value="new_specimen">새 검체 필요</option><option value="reuse_specimen">기존 검체 재사용</option>
        </select>
        <Input aria-label="재검 검체 참조" placeholder="새 검체 계획 또는 재사용 검체 식별자" value={reference} maxLength={200} disabled={disabled || saving || !!created} onChange={event => setReference(event.target.value)} />
        <select aria-label="재검 청구 정책" className="h-9 rounded-md border bg-background px-2" value={billing} disabled={disabled || saving || !!created} onChange={event => setBilling(event.target.value)}>
          <option value="">청구 방식 선택</option><option value="no_charge">이번 재검 청구하지 않음</option><option value="catalog_price">현재 병원 카탈로그 가격으로 청구</option>
        </select>
        <select aria-label="재검 프로필" className="h-9 rounded-md border bg-background px-2" value={binding} disabled={disabled || saving || !!created} onChange={event => setBinding(event.target.value)}>
          <option value="">병원에 연결된 프로필 직접 선택</option>
          {config?.bindings.filter(b => config.devices.some(d => d.id === b.device_id && d.active)).map(b => <option key={`${b.profile_version_id}:${b.device_id}`} value={`${b.profile_version_id}:${b.device_id}`}>
            {config.profiles.find(p => p.id === b.profile_version_id)?.name} · {config.devices.find(d => d.id === b.device_id)?.name}
          </option>)}
        </select>
        <p className="text-xs text-muted-foreground">수동 입력 · 장비 연동 안 됨 · 검체 선택은 재검 계획이며 실제 채취·수행 기록이 아닙니다.</p>
      </div>
    </EmrDialogShell>
  </Dialog>;
}
