"use client";

import { useEffect, useId, useRef, useState } from "react";
import { parseInpatientLocationConfiguration, type InpatientLocation, type InpatientLocationConfiguration } from "./inpatient-location-contract";

type Props = { workspaceId: string; value: string; disabled?: boolean; onChange: (id: string) => void };
export function InpatientLocationPicker(props: Props) {
  return <ScopedInpatientLocationPicker key={props.workspaceId} {...props} />;
}
function ScopedInpatientLocationPicker({ workspaceId, value, disabled, onChange }: Props) {
  const id = useId();
  const [configuration, setConfiguration] = useState<InpatientLocationConfiguration | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"ward" | "cage">("cage");
  const generation = useRef(0);
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/inpatient/locations`;
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    void (async () => {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        const data: unknown = await response.json();
        if (current !== generation.current) return;
        const parsed = response.ok ? parseInpatientLocationConfiguration(data, workspaceId) : null;
        if (!parsed) throw Error();
        setConfiguration(parsed); setError("");
      } catch {
        if (!controller.signal.aborted && current === generation.current) { setConfiguration(null); setError("등록된 입원 공간을 불러오지 못했습니다. 연결과 권한을 확인하고 다시 시도해 주세요."); }
      } finally { if (current === generation.current) setLoading(false); }
    })();
    return () => { controller.abort(); generation.current = current + 1; };
  }, [endpoint, workspaceId, refresh]);

  async function save(location?: InpatientLocation) {
    const current = generation.current;
    setSaving(true); setError("");
    const command = location
      ? { id: location.id, label: location.label, kind: location.kind, active: !location.active, expectedRevision: location.rowRevision }
      : { id: crypto.randomUUID(), label: label.trim(), kind, active: true, expectedRevision: 0 };
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
      const data: unknown = await response.json();
      if (current !== generation.current) return;
      const parsed = response.ok ? parseInpatientLocationConfiguration(data, workspaceId) : null;
      if (!parsed) throw Error(response.status === 409 ? "conflict" : "unavailable");
      setConfiguration(parsed); if (!location) setLabel("");
    } catch (failure) {
      if (current === generation.current) setError(failure instanceof Error && failure.message === "conflict"
        ? "다른 변경 또는 같은 이름의 공간이 있어 저장하지 못했습니다. 새로고침 후 확인해 주세요."
        : "입원 공간을 저장하지 못했습니다. 등록 여부를 새로고침으로 확인해 주세요.");
    } finally { if (current === generation.current) setSaving(false); }
  }
  const active = configuration?.locations.filter(location => location.active) ?? [];
  const selected = configuration?.locations.find(location => location.id === value);
  return <div className="space-y-2" data-testid="inpatient-location-picker">
    <label className="block text-xs text-muted-foreground" htmlFor={id}>등록된 병동/케이지</label>
    <select id={id} aria-label="등록된 병동/케이지" className="h-9 w-full rounded-md border bg-background px-2 text-sm"
      value={value} disabled={disabled || loading || saving || !configuration}
      onChange={event => onChange(event.target.value)}>
      <option value="">{loading ? "입원 공간 불러오는 중" : active.length ? "입원 공간 선택" : "등록된 활성 입원 공간 없음"}</option>
      {value && !selected ? <option value={value} disabled>선택한 입원 공간을 확인할 수 없음</option> : null}
      {configuration?.locations.map(location => <option key={location.id} value={location.id} disabled={!location.active}>
        {location.label} · {location.kind === "ward" ? "병동" : "케이지"}{!location.active ? " (사용 중지)" : ""}
      </option>)}
    </select>
    {!loading && (!configuration || active.length === 0 || (value && !selected?.active)) ? <p className="text-xs text-muted-foreground">실제 등록된 활성 입원 공간을 선택해야 확정할 수 있습니다. 임시 병실은 자동으로 생성하지 않습니다.</p> : null}
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    <button type="button" className="text-xs underline" disabled={saving || loading} onClick={() => { setLoading(true); setConfiguration(null); setRefresh(v => v + 1); }}>입원 공간 새로고침</button>
    {configuration?.canManage && !disabled ? <details className="rounded-md border p-2 text-xs">
      <summary>입원 공간 등록·사용 관리</summary>
      <p className="my-2 text-muted-foreground">실제로 사용할 병동·케이지를 등록해 주세요. 빈 병상 확인이나 중복 배정 방지 기능은 아닙니다.</p>
      <div className="flex flex-wrap gap-2">
        <input aria-label="새 입원 공간 이름" className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2" maxLength={80} value={label} onChange={event => setLabel(event.target.value)} disabled={saving} />
        <select aria-label="새 입원 공간 종류" className="h-8 rounded-md border bg-background" value={kind} onChange={event => setKind(event.target.value as "ward" | "cage")} disabled={saving}><option value="cage">케이지</option><option value="ward">병동</option></select>
        <button type="button" className="rounded-md border px-2" disabled={saving || !label.trim()} onClick={() => void save()}>등록</button>
      </div>
      {configuration.locations.map(location => <div key={location.id} className="mt-2 flex items-center justify-between gap-2">
        <span>{location.label}{!location.active ? " (사용 중지)" : ""}</span>
        <button type="button" className="underline" disabled={saving} onClick={() => void save(location)}>{location.active ? "사용 중지" : "다시 사용"}</button>
      </div>)}
    </details> : null}
  </div>;
}
