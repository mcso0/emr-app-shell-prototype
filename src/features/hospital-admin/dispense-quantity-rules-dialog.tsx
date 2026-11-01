"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPlanOrderTableUnit } from "@/features/chart/chart-order-table-presentation";
import { isDispenseQuantityRule, resolveDispenseRule, type DispenseQuantityRule } from "@/features/chart/dispense-request-quantity";
import type { DispenseRuleMutation, DispenseRuleRead } from "./dispense-quantity-rule-contract";

const modeLabels = { exact: "이론값 유지", nearest: "반올림", up: "올림", down: "버림" } as const;
export function DispenseQuantityRulesDialog({ workspaceId, actorHeaders, initialSelection, open, onOpenChange }: {
  workspaceId: string; actorHeaders?: Record<string, string>; initialSelection: string[];
  open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [settings, setSettings] = useState<DispenseRuleRead | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<"hospital" | "products">("hospital");
  const [unit, setUnit] = useState("");
  const [mode, setMode] = useState<DispenseQuantityRule["mode"]>("exact");
  const [increment, setIncrement] = useState("1");
  const [precision, setPrecision] = useState("0");
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error" | "conflict">("loading");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);
  const initialSelectionRef = useRef(initialSelection);
  useEffect(() => { initialSelectionRef.current = initialSelection; }, [initialSelection]);
  const headersRef = useRef(actorHeaders);
  useEffect(() => { headersRef.current = actorHeaders; }, [actorHeaders]);
  const generation = useRef(0);
  const url = `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/dispense-quantity-rules`;
  useEffect(() => {
    if (!open) return;
    const current = ++generation.current;
    let cancelled = false;
    void (async () => {
      setStatus("loading"); setSettings(null); setMessage("");
      try {
        const response = await fetch(url, { headers: headersRef.current });
        const body = await response.json();
        if (cancelled || current !== generation.current) return;
        if (!response.ok || !body.ok) throw new Error(response.status === 403 ? "규칙을 조회할 권한이 없습니다." : "규칙을 불러오지 못했습니다.");
        const next = body.settings as DispenseRuleRead;
        setSettings(next); setSelected(initialSelectionRef.current.filter(id => next.products.some(product => product.catalogItemId === id)));
        const selectedUnit = next.products.find(product => initialSelectionRef.current.includes(product.catalogItemId))?.unit;
        const nextUnit = selectedUnit ?? next.products.find(product => product.unit)?.unit ?? "";
        setUnit(nextUnit);
        const rule = next.defaultRules[nextUnit];
        setMode(rule?.mode ?? "exact"); setIncrement(String(rule?.increment ?? 1)); setPrecision(String(rule?.displayPrecision ?? 0));
        setTarget("hospital"); setStatus("ready");
      } catch (error) { if (!cancelled) { setStatus("error"); setMessage(error instanceof Error ? error.message : "조회에 실패했습니다."); } }
    })();
    return () => { cancelled = true; generation.current = current + 1; };
  }, [open, url, retry]);
  const rule: DispenseQuantityRule = { mode, unit, increment: Number(increment), displayPrecision: Number(precision) };
  const valid = increment.trim() !== "" && precision.trim() !== "" && isDispenseQuantityRule(rule);
  const units = [...new Set(settings?.products.map(product => product.unit).filter((value): value is string => Boolean(value)) ?? [])];
  const blocked = status === "loading" || status === "saving" || status === "conflict" || !settings?.canManage;
  function loadEditor(nextUnit: string, nextTarget = target, selection = selected) {
    setUnit(nextUnit);
    const product = settings?.products.find(item => selection.includes(item.catalogItemId) && item.unit === nextUnit);
    const existing = nextTarget === "products" && product
      ? settings?.productRules[product.productKey] ?? settings?.defaultRules[nextUnit]
      : settings?.defaultRules[nextUnit];
    setMode(existing?.mode ?? "exact");
    setIncrement(String(existing?.increment ?? 1));
    setPrecision(String(existing?.displayPrecision ?? 0));
  }
  async function save(clear = false) {
    if (busy.current || blocked || (!clear && !valid) || (target === "products" && !selected.length) || !settings) return;
    busy.current = true; setStatus("saving"); setMessage("");
    const current = generation.current;
    const input: DispenseRuleMutation = { expectedRevision: settings.revision, target, unit, rule: clear ? null : rule, catalogItemIds: target === "products" ? selected : [] };
    try {
      const response = await fetch(url, { method: "PATCH", headers: { "content-type": "application/json", ...headersRef.current }, body: JSON.stringify(input) });
      const body = await response.json();
      if (current !== generation.current) return;
      if (!response.ok || !body.ok) {
        setStatus(response.status === 409 || response.status >= 500 ? "conflict" : "error");
        setMessage(response.status === 409 ? "다른 사용자가 규칙을 변경했습니다. 다시 불러온 뒤 수정해 주세요." : "저장하지 못했습니다. 선택 약품의 단위와 권한을 확인해 주세요."); return;
      }
      setSettings(body.settings); setStatus("saved");
    } catch { if (current === generation.current) { setStatus("conflict"); setMessage("저장 결과를 확인하지 못했습니다. 다시 불러와 확인해 주세요."); } }
    finally { busy.current = false; }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy.current) onOpenChange(value); }}>
    <DialogContent className="sm:max-w-[720px]">
      <DialogHeader><DialogTitle>실 조제량 규칙</DialogTitle><DialogDescription>새로 추가하는 오더의 전체 조제량에 적용됩니다. 기존 오더는 유지됩니다.</DialogDescription></DialogHeader>
      {message && <p role="alert" className="text-[var(--emr-status-danger-text)] emr-text-metadata">{message}</p>}
      {(status === "error" || status === "conflict") && <Button variant="outline" onClick={() => setRetry(value => value + 1)}>다시 불러오기</Button>}
      {!settings ? <p role="status">{status === "loading" ? "불러오는 중" : "규칙을 확인할 수 없습니다."}</p> : <>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 emr-text-metadata">적용 대상<Select value={target} onValueChange={value => { if (value) { setTarget(value as typeof target); loadEditor(unit, value as typeof target); } }} disabled={blocked}>
            <SelectTrigger className="w-full" aria-label="규칙 적용 대상"><SelectValue>{target === "hospital" ? "병원 공통" : "선택 약품 예외"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="hospital">병원 공통</SelectItem><SelectItem value="products">선택 약품 예외</SelectItem></SelectContent></Select></label>
          <label className="grid gap-1 emr-text-metadata">약품 단위<Select value={unit} onValueChange={value => { if (value) loadEditor(value); }} disabled={blocked}>
            <SelectTrigger className="w-full" aria-label="규칙 약품 단위"><SelectValue>{unit ? formatPlanOrderTableUnit(unit) : "단위 선택"}</SelectValue></SelectTrigger><SelectContent>{units.map(value => <SelectItem key={value} value={value}>{formatPlanOrderTableUnit(value)}</SelectItem>)}</SelectContent></Select></label>
          <label className="grid gap-1 emr-text-metadata">처리 방식<Select value={mode} onValueChange={value => { if (value) setMode(value as typeof mode); }} disabled={blocked}>
            <SelectTrigger className="w-full" aria-label="조제량 처리 방식"><SelectValue>{modeLabels[mode]}</SelectValue></SelectTrigger><SelectContent>{Object.entries(modeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label>
          <label className="grid gap-1 emr-text-metadata">조정 간격<Input aria-label="조정 간격" type="number" step="any" disabled={blocked || mode === "exact"} value={increment} onChange={event => setIncrement(event.target.value)} /></label>
          <label className="grid gap-1 emr-text-metadata">표시 자릿수<Input aria-label="표시 자릿수" type="number" min={0} max={9} step={1} disabled={blocked} value={precision} onChange={event => setPrecision(event.target.value)} /></label>
        </div>
        {!valid && <p role="alert" className="emr-text-metadata">양수 간격과 0~9의 자릿수를 입력해 주세요. 조정 간격을 정확하게 표시할 수 있어야 합니다.</p>}
        <div className="max-h-64 overflow-auto rounded-md border p-2" aria-label="약품별 적용 규칙">
          {!settings.products.length && <p className="emr-text-metadata">등록된 조제 약품이 없습니다.</p>}
          {settings.products.map(product => {
            const applied = resolveDispenseRule(settings, product.productKey, product.unit ?? "");
            return <label key={product.catalogItemId} className="flex items-center gap-3 px-2 py-2 emr-text-metadata">
              <Checkbox aria-label={`${product.name} 규칙 선택`} checked={selected.includes(product.catalogItemId)} disabled={blocked}
                onCheckedChange={checked => {
                  if (checked && selected.length === 0 && target === "products" && product.unit) loadEditor(product.unit, "products", [product.catalogItemId]);
                  setSelected(current => checked ? [...new Set([...current, product.catalogItemId])] : current.filter(id => id !== product.catalogItemId));
                }} />
              <span className="min-w-0 flex-1">{product.name}</span><span>{formatPlanOrderTableUnit(product.unit)}</span>
              <span>{applied.source === "product" ? "약품 예외" : applied.source === "hospital" ? "병원 기본값" : "규칙 미설정"} · {applied.rule ? modeLabels[applied.rule.mode] : "이론값 유지"}</span>
            </label>;
          })}
        </div>
        <div className="flex items-center justify-end gap-2">
          <span role="status" className="mr-auto emr-text-metadata">{status === "saving" ? "저장 중" : status === "saved" ? "저장 완료" : ""}</span>
          <Button variant="outline" disabled={blocked || !unit || (target === "products" && !selected.length)} onClick={() => void save(true)}>{target === "hospital" ? "공통 규칙 해제" : "선택 약품 예외 해제"}</Button>
          <Button disabled={blocked || !valid || (target === "products" && !selected.length)} onClick={() => void save()}>{target === "hospital" ? "공통 규칙 저장" : `${selected.length}개 약품에 적용`}</Button>
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
