"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LabProfileRule } from "../result-profile-contract";

export function ProfileIntervalEditor({ workspaceId, catalogItemId, profileVersionId, expectedBindingRevision, rules, disabled, onSaved }: {
  workspaceId: string; catalogItemId: string; profileVersionId: string; expectedBindingRevision: number;
  rules: LabProfileRule[]; disabled: boolean; onSaved: () => void;
}) {
  const [values, setValues] = useState(() => rules.filter(r => r.resultValueKind === "numeric").map(r => ({ key: r.testMasterKey, code: r.code, unit: r.unit,
    low: r.referenceInterval ? String(r.referenceInterval.low) : "", high: r.referenceInterval ? String(r.referenceInterval.high) : "" })));
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const request = useRef<{ fingerprint: string; id: string } | null>(null); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const valid = values.every(v => !v.low.trim() && !v.high.trim() || v.low.trim() && v.high.trim()
    && Number.isFinite(Number(v.low)) && Number.isFinite(Number(v.high)) && Number(v.low) <= Number(v.high));
  const save = async () => {
    if (!valid || saving || disabled) return;
    const input = { action: "save_intervals", catalogItemId, profileVersionId, expectedBindingRevision,
      intervals: values.map(v => ({ testMasterKey: v.key, referenceInterval: !v.low.trim() && !v.high.trim() ? null
        : { low: Number(v.low), high: Number(v.high), lowInclusive: true, highInclusive: true } })) };
    const fingerprint = JSON.stringify(input);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/lab-imaging/result-profiles`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, requestId: request.current.id }) });
      const body = await response.json(); if (!alive.current) return;
      if (!response.ok || !body.ok) { setError(body.error === "lab_profile_binding_revision_conflict" ? "병원 프로필 설정이 바뀌었습니다. 최신 설정을 다시 불러와 주세요." : "정상범위를 저장하지 못했습니다. 입력값은 유지했습니다."); return; }
      request.current = null; onSaved();
    } catch { if (alive.current) setError("저장 결과를 확인하지 못했습니다. 같은 요청으로 재시도할 수 있습니다."); }
    finally { if (alive.current) setSaving(false); }
  };
  if (!values.length) return null;
  return <details className="grid gap-2 text-sm" data-testid="lab-profile-interval-editor"><summary>병원 정상범위 수정</summary>
    <p className="my-2 text-xs text-muted-foreground">새 요청에 적용할 별도 버전으로 저장합니다. 확정된 결과와 마스터 원본은 바뀌지 않습니다. 두 값을 모두 비우면 범위를 해제합니다. 합성 테스트 전용이며 임상 검증된 정상범위가 아닙니다.</p>
    <div className="grid max-h-64 gap-2 overflow-auto">
      {values.map((v, index) => <div key={v.key} className="grid grid-cols-[minmax(80px,1fr)_1fr_1fr] items-center gap-2">
        <span>{v.code} {v.unit ? `(${v.unit})` : ""}</span>
        {(["low", "high"] as const).map(bound => <Input key={bound} aria-label={`${v.code} ${bound === "low" ? "하한" : "상한"}`} type="number" step="any" value={v[bound]} disabled={disabled || saving}
          onChange={event => setValues(rows => rows.map((r, i) => i === index ? { ...r, [bound]: event.target.value } : r))} />)}
      </div>)}
    </div>
    {error ? <p role="alert" className="mt-2">{error}</p> : null}
    <Button className="mt-2" variant="outline" disabled={disabled || saving || !valid} onClick={() => void save()}>새 병원 정상범위 버전 저장</Button>
  </details>;
}
