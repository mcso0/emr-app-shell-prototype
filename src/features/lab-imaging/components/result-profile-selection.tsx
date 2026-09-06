"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseLabProfileConfiguration, type LabProfileConfiguration } from "../server-result-profile-core";
import { ProfileIntervalEditor } from "./profile-interval-editor";

type Props = { workspaceId: string; catalogItemId?: string; orderId?: string; disabled?: boolean;
  onBeforeSelect?: () => Promise<boolean>; onSelected?: () => void };
const messages: Record<string, string> = {
  unauthenticated: "로그인 세션이 필요합니다.", permission_missing: "검사 프로필 설정 권한이 없습니다.",
  lab_result_profile_parameter_unsupported: "이 프로필은 오더의 모든 검사 항목을 지원하지 않습니다.",
  lab_result_device_profile_mismatch: "선택한 장비와 프로필의 모델이 일치하지 않습니다.",
  lab_profile_binding_revision_conflict: "병원 프로필 설정이 변경됐습니다. 새로고침 후 다시 선택해 주세요.",
  order_revision_conflict: "오더가 변경됐습니다. 새로고침 후 다시 선택해 주세요.",
  lab_result_profile_binding_required: "병원에 저장된 장비·프로필 조합을 선택해 주세요.",
  confirmed_lab_profile_immutable: "확정된 오더의 프로필은 바꿀 수 없습니다. 새 요청으로 구분해야 합니다.",
  lab_composition_catalog_pin_stale: "세트에 필요한 개별 검사가 비활성 상태이거나 원본 버전이 다릅니다. 병원 검사 목록을 먼저 확인해 주세요.",
  lab_composition_parent_price_unavailable: "기존 묶음 가격이 없습니다. 가격을 먼저 저장하거나 다른 청구 방식을 직접 선택해 주세요.",
  lab_composition_revision_conflict: "검사 세트가 변경됐습니다. 다시 불러온 뒤 적용해 주세요.",
};
export function LabResultProfileSelection(props: Props) {
  return <LabResultProfileSelectionContent key={`${props.workspaceId}:${props.catalogItemId ?? ""}:${props.orderId ?? ""}`} {...props} />;
}
function LabResultProfileSelectionContent({ workspaceId, catalogItemId, orderId, disabled, onBeforeSelect, onSelected }: Props) {
  const [config, setConfig] = useState<LabProfileConfiguration | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0); const [profileId, setProfileId] = useState(""); const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState(""); const generation = useRef(0); const registrationId = useRef<string | null>(null);
  const [compositionId, setCompositionId] = useState(""); const [billingPolicy, setBillingPolicy] = useState("");
  const compositionRequest = useRef<{ fingerprint: string; id: string } | null>(null);
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/lab-imaging/result-profiles`;
  const query = orderId ? `?orderId=${encodeURIComponent(orderId)}` : catalogItemId ? `?catalogItemId=${encodeURIComponent(catalogItemId)}` : "";
  useEffect(() => {
    const scope = ++generation.current; const abort = new AbortController();
    void (async () => {
      try {
        const response = await fetch(endpoint + query, { cache: "no-store", signal: abort.signal }); const body = await response.json();
        if (scope !== generation.current) return;
        const parsed = response.ok && body.ok ? parseLabProfileConfiguration(body.configuration, workspaceId, orderId, catalogItemId) : null;
        if (!parsed) { setConfig(null); setError(messages[body.error] ?? "저장된 검사 프로필을 불러오지 못했습니다. 다른 프로필로 대체하지 않았습니다."); return; }
        setConfig(parsed);
      } catch { if (scope === generation.current && !abort.signal.aborted) setError("검사 프로필을 불러오지 못했습니다."); }
      finally { if (scope === generation.current) setLoading(false); }
    })();
    return () => { generation.current = scope + 1; abort.abort(); };
  }, [endpoint, query, workspaceId, orderId, catalogItemId, reload]);
  const profile = config?.profiles.find(p => p.id === profileId);
  const selectedProfile = config?.profiles.find(p => p.id === config.order?.selectedProfileVersionId);
  const bindings = config?.bindings ?? [];
  const selectedBinding = bindings.find(b => b.profile_version_id === profileId && (!deviceId || b.device_id === deviceId));
  const profileOptions = orderId ? config?.profiles.filter(p => bindings.some(b => b.profile_version_id === p.id)) : config?.profiles;
  const deviceOptions = config?.devices.filter(d => d.active && profile && d.model === profile.device.model && d.manufacturer === profile.device.manufacturer
    && (!orderId || bindings.some(b => b.profile_version_id === profile.id && b.device_id === d.id)));
  const locked = disabled || saving || loading;
  const composition = config?.compositions?.find(c => c.id === compositionId);
  const refresh = () => { setConfig(null); setError(null); setLoading(true); setReload(n => n + 1); };
  const mutate = async (action: "register_device" | "bind_profile" | "select_profile") => {
    if (!config || !profile || locked) return;
    const scope = generation.current; setSaving(true); setError(null); setNotice(null);
    try {
      let current = config;
      if (action === "select_profile" && onBeforeSelect) {
        if (!await onBeforeSelect()) throw Error("오더 초안을 먼저 저장해야 합니다. 저장 상태를 확인해 주세요.");
        const read = await fetch(endpoint + query, { cache: "no-store" }); const body = await read.json();
        const latest = read.ok && body.ok ? parseLabProfileConfiguration(body.configuration, workspaceId, orderId, catalogItemId) : null;
        if (!latest) throw Error("최신 오더 상태를 확인하지 못했습니다."); current = latest;
      }
      if (scope !== generation.current) return;
      if (action === "register_device" && registrationId.current === null) registrationId.current = crypto.randomUUID();
      const input = action === "register_device" ? { action, profileVersionId: profile.id, id: registrationId.current, name: deviceName.trim() }
        : action === "bind_profile" ? { action, profileVersionId: profile.id, deviceId, catalogItemId,
          expectedRevision: current.bindings.find(b => b.order_catalog_item_id === catalogItemId && b.species === profile.species)?.row_revision ?? 0 }
          : { action, profileVersionId: profile.id, deviceId, orderId, expectedUpdatedAt: current.order?.updatedAt };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const body = await response.json(); if (scope !== generation.current) return;
      if (!response.ok || !body.ok) { setError(messages[body.error] ?? "프로필 설정을 저장하지 못했습니다. 입력은 유지했습니다."); return; }
      if (action === "register_device") { registrationId.current = null; setDeviceName(""); }
      setNotice(action === "select_profile" ? "이 오더에 사용할 프로필을 명시적으로 선택했습니다." : "병원 검사 설정을 저장했습니다.");
      refresh(); if (action === "select_profile") onSelected?.();
    } catch (e) { if (scope === generation.current) setError(e instanceof Error ? e.message : "프로필 설정을 저장하지 못했습니다."); }
    finally { if (scope === generation.current) setSaving(false); }
  };
  const applyComposition = async () => {
    if (!composition || !billingPolicy || locked) return;
    const scope = generation.current; setSaving(true); setError(null); setNotice(null);
    const input = { action: "apply_composition", versionId: composition.id, expectedSetRevisionId: composition.currentSetRevisionId, billingPolicy };
    const fingerprint = JSON.stringify(input);
    if (compositionRequest.current?.fingerprint !== fingerprint) compositionRequest.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, requestId: compositionRequest.current.id }) });
      const body = await response.json(); if (scope !== generation.current) return;
      if (!response.ok || !body.ok) { setError(messages[body.error] ?? "검사 세트를 적용하지 못했습니다. 기존 세트는 유지됩니다."); return; }
      compositionRequest.current = null; setNotice("선택한 구성 버전과 청구 방식으로 검사 세트를 저장했습니다. 개별 결과와 과거 기록은 유지됩니다.");
      refresh(); onSelected?.();
    } catch { if (scope === generation.current) setError("검사 세트 적용 결과를 확인하지 못했습니다. 같은 요청으로 재시도할 수 있습니다."); }
    finally { if (scope === generation.current) setSaving(false); }
  };
  return <section className="grid gap-3 rounded-lg border border-[var(--emr-border-default)] p-3" data-testid="lab-result-profile-selection">
    <h4 className="text-sm font-semibold">검사 수행·결과 프로필</h4>
    <p className="text-xs text-muted-foreground">수동 입력 · 연동 안 됨 · 합성 기능 검증 전용. 장비 이름만으로 단위나 정상범위를 선택하지 않습니다.</p>
    {loading ? <p role="status" className="text-sm">저장된 프로필 확인 중</p> : null}
    {error ? <p role="alert" className="text-sm">{error}</p> : null}{notice ? <p role="status" className="text-sm">{notice}</p> : null}
    {!loading && !config ? <Button variant="outline" onClick={refresh}>다시 불러오기</Button> : null}
    {config ? <>
      {!orderId && config.compositions?.length ? <div className="grid gap-2 border-b border-[var(--emr-border-default)] pb-3">
        <h5 className="text-sm font-medium">개별 검사로 구성된 검사 세트</h5>
        <Select disabled={locked || !config.canConfigure} value={compositionId || null} onValueChange={value => { setCompositionId(value ?? ""); compositionRequest.current = null; }}>
          <SelectTrigger aria-label="검사 구성 버전 선택"><SelectValue placeholder="구성 버전 직접 선택" /></SelectTrigger><SelectContent>
            {config.compositions.map(c => <SelectItem key={c.id} value={c.id}>{c.name} · v{c.revision} · {c.leafCount}개 항목</SelectItem>)}
          </SelectContent>
        </Select>
        {composition ? <>
          <p className="text-xs text-muted-foreground">{composition.currentCompositionVersionId === composition.id ? "현재 적용된 구성" : "미적용 구성 버전"} · {composition.leaves.filter(l => l.defaultIncluded).length}개 기본 선택. 수행 프로필은 각 개별 검사에 저장된 설정을 사용합니다.</p>
          <details className="text-xs"><summary>원본 구성과 개별 항목 보기</summary><ul className="mt-2 grid gap-1">
            {composition.leaves.map(l => <li key={l.masterKey}>{l.path.map(p => p.name).join(" → ")} → {l.masterKey} ({l.defaultIncluded ? "기본 선택" : "선택 가능"})</li>)}
          </ul></details>
          <Select disabled={locked || !config.canConfigure} value={billingPolicy || null} onValueChange={value => { setBillingPolicy(value ?? ""); compositionRequest.current = null; }}>
            <SelectTrigger aria-label="검사 세트 청구 방식 선택"><SelectValue placeholder="청구 방식 직접 선택" /></SelectTrigger><SelectContent>
              <SelectItem value="preserve_parent_price">기존 묶음 가격만 청구</SelectItem><SelectItem value="sum_leaf_prices">선택한 개별 검사 가격 합산</SelectItem><SelectItem value="no_charge">이 세트 청구 안 함</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={locked || !config.canConfigure || !billingPolicy} onClick={() => void applyComposition()}>선택한 구성과 청구 방식 적용</Button>
        </> : null}
      </div> : null}
      {orderId ? <p className="text-sm">오더 선택: {selectedProfile ? `${selectedProfile.name} · v${selectedProfile.revision}` : config.order?.requiresProfile ? "선택 필요 · 확정 전 필수" : "미선택 · 기존 V1 계약"}</p>
        : <div className="text-sm">{bindings.length ? bindings.map(b => <p key={b.species}>{b.species === "dog" ? "개" : "고양이"}: {config.profiles.find(p => p.id === b.profile_version_id)?.name ?? "알 수 없는 프로필"} · 설정 v{b.row_revision}</p>) : "병원 기본 프로필이 아직 선택되지 않았습니다."}</div>}
      {(orderId ? config.canSelect : config.canConfigure) ? <>
        {!profileOptions?.length ? <p className="text-sm">선택 가능한 프로필이 없습니다. 병원관리에서 해당 검사와 동물종의 프로필을 먼저 저장해 주세요.</p> : <>
          <Select disabled={locked} value={profileId || null} onValueChange={value => { setProfileId(value ?? ""); setDeviceId(""); registrationId.current = null; }}>
            <SelectTrigger aria-label="검사 결과 프로필 선택"><SelectValue placeholder="프로필 직접 선택" /></SelectTrigger><SelectContent>
              {profileOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · v{p.revision}</SelectItem>)}
            </SelectContent>
          </Select>
          {profile ? <>
            <p className="text-xs text-muted-foreground">{profile.method} · {profile.rules.filter(r => r.supported).length}개 결과 지원 · 임상 검증 안 됨</p>
            <Select disabled={locked} value={deviceId || null} onValueChange={value => setDeviceId(value ?? "")}>
              <SelectTrigger aria-label="등록 장비 또는 수기 프로필 선택"><SelectValue placeholder="등록 장비·수기 프로필 직접 선택" /></SelectTrigger><SelectContent>
                {deviceOptions?.map(d => <SelectItem key={d.id} value={d.id}>{d.name} · 수동 입력</SelectItem>)}
              </SelectContent>
            </Select>
            {!orderId ? <div className="grid gap-2">
              <Input aria-label="등록 장비 또는 수기 프로필 이름" placeholder="직접 등록할 이름" value={deviceName} maxLength={200} disabled={locked} onChange={event => { setDeviceName(event.target.value); registrationId.current = null; }} />
              <Button variant="outline" disabled={locked || !deviceName.trim()} onClick={() => void mutate("register_device")}>선택한 모델을 수동 입력 장비로 등록</Button>
              <Button disabled={locked || !deviceId} onClick={() => void mutate("bind_profile")}>이 검사의 병원 프로필로 저장</Button>
              {catalogItemId && selectedBinding ? <ProfileIntervalEditor key={`${workspaceId}:${catalogItemId}:${profile.id}:${selectedBinding.row_revision}`}
                workspaceId={workspaceId} catalogItemId={catalogItemId} profileVersionId={profile.id} expectedBindingRevision={selectedBinding.row_revision}
                rules={config.overrides?.find(o => o.id === selectedBinding.override_version_id)?.rules ?? profile.rules}
                disabled={Boolean(locked)} onSaved={() => { setNotice("병원 정상범위를 새 버전으로 저장했습니다. 기존 결과는 유지됩니다."); refresh(); }} /> : null}
            </div> : <Button disabled={locked || !deviceId || !selectedBinding} onClick={() => void mutate("select_profile")}>이 오더에 프로필 선택</Button>}
          </> : null}
        </>}
      </> : <p className="text-xs text-muted-foreground">조회 전용입니다. 확정된 프로필과 기존 결과는 유지됩니다.</p>}
    </> : null}
  </section>;
}
