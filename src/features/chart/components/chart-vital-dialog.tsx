"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CdsActionsPlusIcon, CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsFilesCalendarIcon, CdsFilesClockIcon } from "@/components/cds-icons/files-and-layout";
import { CdsMedicalHeartPulseIcon, CdsMedicalThermometerIcon, CdsMedicalWeightIcon, CdsMedicalWindIcon } from "@/components/cds-icons/medical-and-domain";
import { CdsNavigationChevronUpIcon } from "@/components/cds-icons/navigation";
import { CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { hasPatientVitalValue, toPatientVitalWriteInput, type PatientVitalMeasurement, type PatientVitalWriteInput } from "@/features/patient-vitals/patient-vital-types";
import { fromCanonicalVitalValue, getEnabledWorkspaceVitalSettings, getRequiredWorkspaceVitalFieldErrors, toCanonicalVitalValue, type WorkspaceVitalKey, type WorkspaceVitalSettingsSnapshot } from "@/features/patient-vitals/workspace-vital-settings";
import { cn } from "@/lib/utils";
import styles from "./chart-vital-dialog.module.css";

type VitalDialogDraft = Record<keyof PatientVitalWriteInput, string>;
type VitalMeasurementInput = Pick<PatientVitalMeasurement, keyof PatientVitalWriteInput>;
type VitalFieldErrors = Partial<Record<keyof PatientVitalWriteInput | "vitals", string>>;
type DraftMeasurement = { id: string; measuredAt: string };
type Confirmation = { kind: "discard"; action: () => void } | { kind: "save"; clear: boolean; past: boolean };
type HistoryPage = { ok: boolean; measurements: PatientVitalMeasurement[]; nextCursor: string | null; canWriteVitals: boolean };
type VitalDialogProps = {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  measurement?: VitalMeasurementInput;
  mode: "waiting" | "in_consultation";
  onOpenChange: (open: boolean) => void;
  onSaved: (vital: PatientVitalMeasurement) => void | Promise<void>;
  open: boolean;
  vitalSettings: WorkspaceVitalSettingsSnapshot;
  workspaceId: string;
};

export function ChartVitalDialog(props: VitalDialogProps) {
  if (!props.open) return null;
  return <OpenChartVitalDialog key={`${props.workspaceId}:${props.encounterId}`} {...props} />;
}

function OpenChartVitalDialog({ actorHeaders, encounterId, mode, onOpenChange, onSaved, open, vitalSettings, workspaceId }: VitalDialogProps) {
  const [records, setRecords] = useState<PatientVitalMeasurement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newRecord, setNewRecord] = useState<DraftMeasurement | null>(null);
  const [draft, setDraft] = useState(() => createVitalDialogDraft(undefined, vitalSettings));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [canWrite, setCanWrite] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<VitalFieldErrors>({});
  const [settingsRefreshRequired, setSettingsRefreshRequired] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const moreRequestRef = useRef(false);
  const selected = records.find((record) => record.id === selectedId);
  const active = newRecord ?? selected;
  const initialDraft = createVitalDialogDraft(selected, vitalSettings);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const parsed = parseVitalDialogDraft(draft, vitalSettings, selected);
  const valid = parsed.ok && (!newRecord || hasPatientVitalValue(parsed.values));
  const endpoint = `/api/workspaces/${encodeURIComponent(workspaceId)}/patient-vitals/history`;

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    void fetch(`${endpoint}?encounterId=${encodeURIComponent(encounterId)}`, {
      headers: actorHeaders, cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json() as HistoryPage;
      if (!response.ok || !body.ok) throw new Error("history_unavailable");
      if (controller.signal.aborted) return;
      setRecords(body.measurements);
      setNextCursor(body.nextCursor);
      setCanWrite(body.canWriteVitals);
      const first = body.measurements.find((item) => item.encounterId === encounterId) ?? body.measurements[0];
      setSelectedId(first?.id ?? null);
      setNewRecord(null);
      setDraft(createVitalDialogDraft(first, vitalSettings));
      setExpanded(new Set(first ? [seoulDay(first.measuredAt)] : []));
      setStatus("ready");
      setErrors({});
      setFeedback("");
    }).catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => { mountedRef.current = false; controller.abort(); };
  }, [actorHeaders, encounterId, endpoint, loadVersion, vitalSettings]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || moreRequestRef.current) return;
    moreRequestRef.current = true;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const response = await fetch(`${endpoint}?encounterId=${encodeURIComponent(encounterId)}&beforeId=${encodeURIComponent(nextCursor)}`, { headers: actorHeaders, cache: "no-store" });
      const body = await response.json() as HistoryPage;
      if (!response.ok || !body.ok) throw new Error("history_unavailable");
      if (!mountedRef.current) return;
      setRecords((current) => [...current, ...body.measurements.filter((item) => !current.some((record) => record.id === item.id))]);
      setNextCursor(body.nextCursor);
      setFeedback("");
    } catch {
      if (mountedRef.current) { setMoreFailed(true); setFeedback("이전 이력을 불러오지 못했어요. 다시 시도해 주세요."); }
    } finally {
      moreRequestRef.current = false;
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [actorHeaders, encounterId, endpoint, nextCursor]);

  const discardThen = (action: () => void) => {
    if (saving) return;
    if (dirty || newRecord) setConfirmation({ kind: "discard", action });
    else action();
  };
  const selectRecord = (record: PatientVitalMeasurement) => {
    if (!newRecord && record.id === selectedId) return;
    discardThen(() => {
      setNewRecord(null);
      setSelectedId(record.id);
      setDraft(createVitalDialogDraft(record, vitalSettings));
      setErrors({});
      setFeedback("");
    });
  };
  const startMeasurement = () => discardThen(() => {
    const record = { id: crypto.randomUUID(), measuredAt: new Date().toISOString() };
    setNewRecord(record);
    setSelectedId(null);
    setDraft(createVitalDialogDraft(undefined, vitalSettings));
    setExpanded((current) => new Set([...current, seoulDay(record.measuredAt)]));
    setErrors({});
    setFeedback("");
    requestAnimationFrame(() => firstInputRef.current?.focus());
  });

  const saveVital = async () => {
    if (!active || saving || !canWrite || !parsed.ok) return;
    if (newRecord && !hasPatientVitalValue(parsed.values)) {
      setErrors({ vitals: "새 바이탈은 한 가지 이상 입력해 주세요." });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const response = await fetch(endpoint, {
        method: newRecord ? "POST" : "PATCH",
        headers: { "content-type": "application/json", ...actorHeaders },
        body: JSON.stringify({ encounterId, measurementId: active.id, vitals: parsed.values,
          measuredAt: newRecord?.measuredAt, expectedUpdatedAt: selected?.updatedAt }),
      });
      const body = await response.json() as { ok: boolean; vital?: PatientVitalMeasurement; fieldErrors?: VitalFieldErrors; reloadSettings?: boolean; error?: string; denialReason?: string };
      if (!mountedRef.current) return;
      if (!response.ok || !body.ok || !body.vital) {
        setSettingsRefreshRequired(Boolean(body.reloadSettings));
        setErrors(body.fieldErrors ?? { vitals: getVitalSaveErrorMessage(body.denialReason ?? body.error) });
        return;
      }
      setSettingsRefreshRequired(false);
      const vital = body.vital;
      setRecords((current) => [vital, ...current.filter((item) => item.id !== vital.id)].sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt) || Date.parse(b.createdAt ?? b.measuredAt) - Date.parse(a.createdAt ?? a.measuredAt) || b.id.localeCompare(a.id)));
      setNewRecord(null);
      setSelectedId(vital.id);
      setDraft(createVitalDialogDraft(vital, vitalSettings));
      setFeedback("바이탈을 저장했어요.");
      try { await onSaved(vital); } catch { setFeedback("바이탈은 저장됐지만 화면을 갱신하지 못했어요."); }
    } catch {
      if (mountedRef.current) setErrors({ vitals: getVitalSaveErrorMessage() });
    } finally { if (mountedRef.current) setSaving(false); }
  };
  const requestSave = () => {
    if (!parsed.ok) { setErrors(parsed.fieldErrors); return; }
    const clear = Boolean(selected && !hasPatientVitalValue(parsed.values));
    const past = Boolean(selected && seoulDay(selected.measuredAt) !== seoulDay(new Date().toISOString()));
    if (clear || past) setConfirmation({ kind: "save", clear, past });
    else void saveVital();
  };
  const grouped = new Map<string, (PatientVitalMeasurement | DraftMeasurement)[]>();
  for (const record of [ ...(newRecord ? [newRecord] : []), ...records ]) {
    const day = seoulDay(record.measuredAt);
    grouped.set(day, [...(grouped.get(day) ?? []), record]);
  }
  const groups = [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) discardThen(() => onOpenChange(false)); }}>
      <EmrDialogShell variant="form" title="바이탈 이력" showCloseButton={false} initialFocus={false}
        className={styles.dialog} headerClassName={styles.header} bodyClassName={styles.body} footerClassName={styles.footer}
        footer={<><Button variant="outline" disabled={status !== "ready" || !canWrite || saving} onClick={startMeasurement}><CdsActionsPlusIcon className="size-4" />바이탈</Button><div className={styles.footerActions}><Button variant="ghost" disabled={saving} onClick={() => discardThen(() => onOpenChange(false))}>취소</Button><Button disabled={status !== "ready" || !canWrite || saving || !active || !dirty || !valid} onClick={requestSave}>{saving ? "저장 중" : "저장"}</Button></div></>}
        data-testid="chart-vital-dialog" data-mode={mode}>
        <DialogClose render={<Button variant="ghost" size="icon-sm" className={styles.close} disabled={saving} aria-label="바이탈 이력 닫기" />}><CdsActionsXIcon className="size-4" /></DialogClose>
        <VitalHistoryList groups={groups} expanded={expanded} activeId={active?.id} newId={newRecord?.id} saving={saving} status={status}
          nextCursor={nextCursor} loadingMore={loadingMore} moreFailed={moreFailed} onLoadMore={loadMore}
          onRetry={() => { setStatus("loading"); setLoadVersion((value) => value + 1); }}
          onToggle={(day) => setExpanded((current) => { const next = new Set(current); if (next.has(day)) next.delete(day); else next.add(day); return next; })}
          onSelect={(record) => { if ("encounterId" in record) selectRecord(record); }} />
        <form className={styles.editor} onSubmit={(event) => { event.preventDefault(); if (dirty && valid && !saving && canWrite) requestSave(); }}>
          <div className={styles.editorHeader}><span className={styles.editorTitle}>바이탈 정보</span>{active ? <Badge size="md" variant="secondary" className={cn(styles.timestamp, newRecord && styles.draftTimestamp)}><CdsFilesClockIcon className="size-3" />{newRecord ? `${seoulTime(active.measuredAt)} 미저장` : `${shortDay(active.measuredAt)} ${seoulTime(active.measuredAt)} 측정`}</Badge> : null}</div>
          <VitalEntryFields draft={draft} errors={errors} disabled={!active || !canWrite || saving} firstInputRef={firstInputRef}
            onChange={(key, value) => { setDraft((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined, vitals: undefined })); setFeedback(""); }}
            onBlur={() => { if (!parsed.ok) setErrors(parsed.fieldErrors); }} vitalSettings={vitalSettings} />
          {errors.vitals || settingsRefreshRequired ? <FieldError className={styles.formFeedback}>{errors.vitals ?? "필수 입력 설정을 다시 확인해 주세요."}<Button type="button" variant="ghost" size="sm" onClick={() => discardThen(() => { if (settingsRefreshRequired) { window.location.reload(); return; } setStatus("loading"); setLoadVersion((value) => value + 1); })}>{settingsRefreshRequired ? "설정 새로고침" : "다시 불러오기"}</Button></FieldError> : null}
          {feedback ? <p className={styles.formFeedback} role="status">{feedback}</p> : null}
        </form>
      </EmrDialogShell>
      <Dialog open={Boolean(confirmation)} onOpenChange={(nextOpen) => { if (!nextOpen) setConfirmation(null); }}>
        <EmrConfirmDialogContent title={confirmation?.kind === "discard" ? "작성 중인 내용을 취소할까요?" : confirmation?.kind === "save" && confirmation.past ? "과거 바이탈 이력을 수정할까요?" : "바이탈 값을 모두 비울까요?"}
          description={confirmation?.kind === "discard" ? "저장하지 않은 변경사항은 사라집니다." : <>{selected ? `${shortDay(selected.measuredAt)} ${seoulTime(selected.measuredAt)} 측정 기록에 수정값을 반영합니다.` : null}{confirmation?.kind === "save" && confirmation.clear ? " 측정 기록은 유지되고 입력값만 비워집니다." : null}</>}
          cancelLabel="돌아가기" confirmLabel={confirmation?.kind === "discard" ? "취소하기" : "저장"}
          onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation; setConfirmation(null); if (action?.kind === "discard") action.action(); else if (action?.kind === "save") void saveVital(); }} />
      </Dialog>
    </Dialog>
  );
}

function VitalHistoryList({ groups, expanded, activeId, newId, saving, status, nextCursor, loadingMore, moreFailed, onLoadMore, onRetry, onToggle, onSelect }: {
  groups: [string, (PatientVitalMeasurement | DraftMeasurement)[]][];
  expanded: Set<string>; activeId?: string; newId?: string; saving: boolean;
  status: "loading" | "ready" | "error"; nextCursor: string | null; loadingMore: boolean; moreFailed: boolean;
  onLoadMore: () => void; onRetry: () => void; onToggle: (day: string) => void; onSelect: (record: PatientVitalMeasurement | DraftMeasurement) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });
  const updateFade = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
    setFade((current) => current.top === (viewport.scrollTop > 1) && current.bottom === (bottom > 1) ? current : { top: viewport.scrollTop > 1, bottom: bottom > 1 });
  }, []);
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = viewport?.firstElementChild;
    if (!viewport) return;
    const observer = new ResizeObserver(updateFade);
    observer.observe(viewport);
    if (content) observer.observe(content);
    viewport.addEventListener("scroll", updateFade, { passive: true });
    updateFade();
    return () => { observer.disconnect(); viewport.removeEventListener("scroll", updateFade); };
  }, [updateFade]);
  useEffect(() => {
    if (status !== "ready" || !nextCursor || loadingMore || moreFailed) return;
    const viewport = viewportRef.current;
    const sentinel = viewport?.querySelector("[data-vital-history-sentinel]");
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) onLoadMore(); }, { root: viewport, rootMargin: "80px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadingMore, moreFailed, nextCursor, onLoadMore, status]);
  return <ScrollArea className={styles.history} viewportRef={viewportRef} viewportClassName={styles.historyViewport}
    viewportStyle={{ overflowX: "hidden", maskImage: `linear-gradient(to bottom, ${fade.top ? "transparent" : "#000"} 0, #000 44px, #000 calc(100% - 44px), ${fade.bottom ? "transparent" : "#000"} 100%)` }}>
    <nav className={styles.historyContent} aria-label="날짜별 바이탈 측정 기록">
      {status === "loading" ? <p className={styles.historyMessage} role="status">이력을 불러오고 있어요.</p> : status === "error" ? <div className={styles.historyMessage} role="alert">이력을 불러오지 못했어요.<Button variant="ghost" size="sm" onClick={onRetry}>다시 시도</Button></div> : groups.length === 0 ? <p className={styles.historyMessage}>측정 이력이 없어요.</p> : null}
      {groups.map(([day, records]) => <section key={day} className={styles.day}>
        <Button variant="ghost" className={styles.dayToggle} aria-expanded={expanded.has(day)} aria-controls={`vital-day-${day}`} disabled={saving} onClick={() => onToggle(day)}>
          <CdsFilesCalendarIcon className="size-3.5" /><span className={styles.dayDetails}><span className={styles.dayLabel}>{day.slice(2).replaceAll("-", ".")}</span><span className={styles.dayCount}>{records.filter((record) => record.id !== newId).length}</span></span><span className={styles.chevron}><CdsNavigationChevronUpIcon className="size-3.5" /></span>
        </Button>
        {expanded.has(day) ? <div id={`vital-day-${day}`} className={styles.dayRecords}>{records.map((record) => <Button key={record.id} variant="ghost" className={cn(styles.record, record.id === activeId && styles.selected)} aria-pressed={record.id === activeId} disabled={saving} onClick={() => onSelect(record)}>
          <span className={styles.recordTime}><CdsFilesClockIcon className="size-3" />{seoulTime(record.measuredAt)} {record.id === newId ? "미저장" : "측정"}</span>
          <Badge size="sm" variant="outline" className={styles.author}><CdsPeopleUserIcon className="size-3" />{"recordedByName" in record ? record.recordedByName ?? "작성자 미상" : "미저장"}</Badge>
        </Button>)}</div> : null}
      </section>)}
      {nextCursor ? <div data-vital-history-sentinel className={styles.historyMessage}><Button variant="ghost" size="sm" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? "불러오는 중" : "이전 이력 불러오기"}</Button></div> : null}
    </nav>
  </ScrollArea>;
}

function VitalEntryFields({ draft, errors, disabled, firstInputRef, onChange, onBlur, vitalSettings }: {
  draft: VitalDialogDraft; errors: VitalFieldErrors; disabled: boolean; firstInputRef: React.Ref<HTMLInputElement>;
  onChange: (key: keyof PatientVitalWriteInput, value: string) => void; onBlur: () => void; vitalSettings: WorkspaceVitalSettingsSnapshot;
}) {
  const rows = getEnabledWorkspaceVitalSettings(vitalSettings).flatMap<{ key: keyof PatientVitalWriteInput; label: string; unit: string; required: boolean; icon: ReactNode }>((setting) => {
    const preset = vitalSettings.presets.find((item) => item.key === setting.key);
    if (!preset) return [];
    if (setting.key === "blood_pressure") return [
      { key: "bloodPressureSystolicMmhg" as const, label: "수축기", unit: setting.displayUnit, required: setting.inputRequired, icon: <BloodIcon /> },
      { key: "bloodPressureDiastolicMmhg" as const, label: "이완기", unit: setting.displayUnit, required: setting.inputRequired, icon: <BloodIcon /> },
    ];
    const key = inputKeyByVitalKey[setting.key];
    if (!key) return [];
    return [{ key, label: preset.label, unit: setting.displayUnit, required: setting.inputRequired, icon: vitalIcons[setting.key] }];
  });
  return <div className={styles.fields}>{rows.map((field, index) => <div key={field.key} className={styles.fieldRow}>
    <Label htmlFor={`chart-vital-${field.key}`} className={styles.fieldLabel}>{field.icon}{field.label}{field.required ? <span className={styles.basicMark} aria-label="필수 입력">*</span> : null}</Label>
    <div className={styles.fieldControl}><Input id={`chart-vital-${field.key}`} ref={index === 0 ? firstInputRef : undefined} className={styles.input}
      aria-describedby={errors[field.key] ? `chart-vital-${field.key}-error` : undefined} aria-required={field.required || undefined} aria-invalid={Boolean(errors[field.key])}
      disabled={disabled} inputMode={field.key === "weightKg" || field.key === "temperatureC" ? "decimal" : "numeric"}
      placeholder="수치입력" value={draft[field.key]} onChange={(event) => onChange(field.key, event.target.value)} onBlur={onBlur} />
      <span className={styles.unit}>{field.unit}</span></div>
    {errors[field.key] ? <FieldError id={`chart-vital-${field.key}-error`} className={styles.fieldError}>{errors[field.key]}</FieldError> : null}
  </div>)}</div>;
}

function BloodIcon() {
  // The original Figma SVG has intrinsic 14×14 dimensions.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/patient-vitals/blood.svg" width={14} height={14} alt="" />;
}
const vitalIcons: Partial<Record<WorkspaceVitalKey, ReactNode>> = {
  weight: <CdsMedicalWeightIcon className="size-3.5" />,
  temperature: <CdsMedicalThermometerIcon className="size-3.5" />,
  heart_rate: <CdsMedicalHeartPulseIcon className="size-3.5" />,
  respiratory_rate: <CdsMedicalWindIcon className="size-3.5" />,
};
function seoulDay(time: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));
}
function shortDay(time: string) { return seoulDay(time).slice(2).replaceAll("-", "."); }
function seoulTime(time: string) { return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(time)); }
const inputKeyByVitalKey: Partial<
  Record<WorkspaceVitalKey, keyof PatientVitalWriteInput>
> = {
  weight: "weightKg",
  temperature: "temperatureC",
  heart_rate: "heartRateBpm",
  respiratory_rate: "respiratoryRateRpm",
};

function createVitalDialogDraft(
  measurement: VitalMeasurementInput | undefined,
  settings: WorkspaceVitalSettingsSnapshot,
): VitalDialogDraft {
  const values = toPatientVitalWriteInput(measurement);
  return Object.fromEntries(
    Object.entries(values).map(([rawKey, value]) => {
      const key = rawKey as keyof PatientVitalWriteInput;
      if (value === null) return [key, ""];
      const setting = getVitalSettingForInputKey(settings, key);
      return [
        key,
        setting
          ? String(
              fromCanonicalVitalValue(setting.key, value, setting.displayUnit),
            )
          : String(value),
      ];
    }),
  ) as VitalDialogDraft;
}

function parseVitalDialogDraft(
  draft: VitalDialogDraft,
  settings: WorkspaceVitalSettingsSnapshot,
  measurement?: VitalMeasurementInput,
): { ok: true; values: PatientVitalWriteInput } | { ok: false; fieldErrors: VitalFieldErrors } {
  const values: PatientVitalWriteInput = toPatientVitalWriteInput(measurement);
  const fieldErrors: VitalFieldErrors = {};

  for (const key of Object.keys(values) as (keyof PatientVitalWriteInput)[]) {
    const setting = getVitalSettingForInputKey(settings, key);
    if (!setting?.enabled) continue;
    const rawValue = draft[key].trim();
    values[key] = null;
    if (!rawValue) continue;
    const parsed = Number(rawValue);
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(rawValue) || !Number.isFinite(parsed) || parsed <= 0) {
      fieldErrors[key] = "0보다 큰 숫자를 입력해 주세요.";
      continue;
    }
    if (key === "weightKg" && !hasAtMostVitalDecimalPlaces(parsed, 2)) {
      fieldErrors[key] = "소수점 둘째 자리까지 입력해 주세요.";
      continue;
    }
    if (key === "temperatureC" && !hasAtMostVitalDecimalPlaces(parsed, 1)) {
      fieldErrors[key] = "소수점 첫째 자리까지 입력해 주세요.";
      continue;
    }
    if (
      (key === "respiratoryRateRpm" ||
        key === "heartRateBpm" ||
        key === "bloodPressureSystolicMmhg" ||
        key === "bloodPressureDiastolicMmhg") &&
      !Number.isInteger(parsed)
    ) {
      fieldErrors[key] = "정수로 입력해 주세요.";
      continue;
    }
    values[key] = setting
      ? toCanonicalVitalValue(setting.key, parsed, setting.displayUnit)
      : parsed;
    if (values[key] <= 0) fieldErrors[key] = "저장할 수 있는 0보다 큰 수치를 입력해 주세요.";
  }

  if (
    values.bloodPressureSystolicMmhg === null &&
    values.bloodPressureDiastolicMmhg !== null
  ) {
    fieldErrors.bloodPressureDiastolicMmhg =
      "이완기 혈압을 입력하려면 수축기 혈압이 필요합니다.";
  }

  const requiredErrors = getRequiredWorkspaceVitalFieldErrors(settings, draft);
  for (const [key, message] of Object.entries(requiredErrors)) {
    fieldErrors[key as keyof PatientVitalWriteInput] ??= message;
  }

  return Object.keys(fieldErrors).length
    ? { ok: false, fieldErrors }
    : { ok: true, values };
}

function getVitalSettingForInputKey(
  settings: WorkspaceVitalSettingsSnapshot,
  inputKey: keyof PatientVitalWriteInput,
) {
  const key =
    inputKey === "weightKg"
      ? "weight"
      : inputKey === "temperatureC"
        ? "temperature"
        : inputKey === "heartRateBpm"
          ? "heart_rate"
          : inputKey === "respiratoryRateRpm"
            ? "respiratory_rate"
            : "blood_pressure";
  return settings.items.find((item) => item.key === key);
}

function getVitalSaveErrorMessage(error?: string) {
  if (error === "measurement_conflict") return "다른 사용자가 이 기록을 수정했어요. 기록을 다시 불러온 뒤 수정해 주세요.";
  if (error === "measurement_unavailable") return "이 측정 기록을 찾을 수 없어요. 이력을 다시 불러와 주세요.";
  if (error === "stale_status") {
    return "대기 중이거나 진료 중인 접수에서만 바이탈을 저장할 수 있어요.";
  }
  if (error === "vital_value_required") {
    return "새 바이탈은 한 가지 이상 입력해 주세요.";
  }
  if (error === "permission_missing" || error === "vital_writer_role_required") {
    return "바이탈을 입력할 권한이 없어요.";
  }
  return "바이탈을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

function hasAtMostVitalDecimalPlaces(value: number, decimalPlaces: number) {
  const factor = 10 ** decimalPlaces;
  return (
    Math.abs(value * factor - Math.round(value * factor)) <
    Number.EPSILON * factor * 8
  );
}
