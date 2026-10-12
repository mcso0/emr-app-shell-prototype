import { useId, useState } from "react";
import { EmrHistoryFilterPopover } from "@/components/emr/history-controls";
import { EmrRegistrationFieldRow, EmrRegistrationSection, emrRegistrationControlClassName } from "@/components/emr/registration-dialog";
import { ChartActualConfirmation, type ChartActualDraft } from "@/features/chart/chart-actual-confirmation";
import { CustomerListHeader } from "@/features/customer/components/customer-list-header";
import { Input } from "./input";
import { emptyHistoryDateRange } from "@/lib/history-controls";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import {
  ScheduleShiftEditorSheet,
  type ScheduleEditorValue,
  type ScheduleEntryEditorTarget,
} from "@/features/hospital-admin/schedule/components/schedule-shift-editor-sheet";
import type { HospitalScheduleRevisionStaff } from "@/features/hospital-admin/schedule/revision-types";

// Shared by Sheet, Select and Field stories. Render the exported caller, not a copy.
const staff: HospitalScheduleRevisionStaff[] = [
  { id: "synthetic-vet", membershipId: "synthetic-member-vet", name: "합성 수의사", initials: "수", role: "veterinarian", availability: {}, jobPositionId: null },
  { id: "synthetic-desk", membershipId: "synthetic-member-desk", name: "합성 접수 직원", initials: "접", role: "reception", availability: {}, jobPositionId: null },
];

// The same exported registration row used by profile-drawer.tsx:3951.
// Editing changes only the draft, as at that call site; it does not clear an existing error.
export function RegistrationNameCallerExample({ error }: { error?: string }) {
  const id = useId();
  const [name, setName] = useState("합성 보호자");
  return <div className="w-full max-w-xl">
    <EmrRegistrationSection separated={false} title="보호자 정보">
      <EmrRegistrationFieldRow controlId={id} error={error} errorId={`${id}-error`} label="보호자명" required>
        <Input id={id} aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error) || undefined}
          aria-label="보호자명" className={emrRegistrationControlClassName} placeholder="이름을 입력해주세요"
          value={name} onValueChange={setName} />
      </EmrRegistrationFieldRow>
    </EmrRegistrationSection>
    <output aria-label="합성 보호자명 초안">{name || "비어 있음"}</output>
  </div>;
}

// Shared by Textarea and Switch; this ancestor also owns its Input fields.
export function ChartActualCallerExample() {
  const [draft, setDraft] = useState<ChartActualDraft>({ performedAt: "2026-10-11T09:00", performedActivity: "합성 진료", outcome: "", selfPerformed: false });
  return <div className="grid max-w-xl gap-3">
    <ChartActualConfirmation rows={[{ orderId: "synthetic-order", name: "합성 처치", type: "other" }]}
      drafts={{ "synthetic-order": draft }} disabled={false} onChange={(_id, next) => setDraft(next)} />
    <output aria-label="합성 수행 초안">{draft.performedActivity} · {draft.outcome || "결과 없음"} · {draft.selfPerformed ? "수행 확인" : "미확인"}</output>
  </div>;
}

// Shared count Badge / Skeleton caller; CustomerListHeader owns the exact header/search markup.
export function CustomerHeaderCallerExample({ loading = false }: { loading?: boolean }) {
  const [query, setQuery] = useState("");
  return <div className="w-full max-w-3xl">
    <CustomerListHeader title="환자" count={3} countLoading={loading} searchValue={query}
      searchPlaceholder="환자 검색" onSearchChange={setQuery} />
    <output aria-label="합성 고객 검색어">{query || "검색어 없음"}</output>
  </div>;
}

export function ScheduleEditorCallerExample() {
  const [target, setTarget] = useState<ScheduleEntryEditorTarget>(null);
  const [dirty, setDirty] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [receipt, setReceipt] = useState<ScheduleEditorValue | null>(null);
  return (
    <div className="grid justify-items-start gap-3">
      <Button variant="outline" onClick={() => { setDirty(false); setTarget({ mode: "create", date: "2026-10-11" }); }}>근무 추가</Button>
      {target ? (
        <ScheduleShiftEditorSheet
          key={`${target.mode}:${target.mode === "create" ? target.date : "existing"}`}
          staff={staff}
          target={target}
          onDirtyChange={setDirty}
          onOpenChange={(open) => {
            // Keep the main caller's render-captured dirty check, including its save/close defect.
            if (!open && dirty) { setPendingClose(true); return; }
            if (!open) setTarget(null);
          }}
          onSave={async (value) => { setReceipt({ ...value }); }}
        />
      ) : null}
      <Dialog open={pendingClose} onOpenChange={(open) => { if (!open) setPendingClose(false); }}>
        <EmrConfirmDialogContent title="저장하지 않은 변경이 있습니다" description="이동하거나 닫으면 현재 입력 중인 내용은 저장되지 않습니다."
          cancelLabel="계속 편집" confirmLabel="저장하지 않고 이동" onCancel={() => setPendingClose(false)}
          onConfirm={() => { setPendingClose(false); setDirty(false); setTarget(null); }} />
      </Dialog>
      <output aria-label="합성 근무 저장 결과">{receipt ? `${receipt.kind} · ${receipt.staffProfileId ?? "미배정"} · ${receipt.date} · ${receipt.workLabel || "업무 없음"}` : "저장 없음"}</output>
      <output aria-label="합성 근무 편집 상태">{dirty ? "변경 있음" : "변경 없음"}</output>
    </div>
  );
}

// Billing uses this exported popover with draft/apply/cancel and requireDates.
export function BillingHistoryPeriodCallerExample() {
  const [open, setOpen] = useState(false);
  const [dates, setDates] = useState({ start: "2026-07-11", end: "2026-10-11" });
  const [draft, setDraft] = useState(dates);
  const [applied, setApplied] = useState(0);
  const [custom, setCustom] = useState(true);
  return <div className="grid justify-items-start gap-3">
    <EmrHistoryFilterPopover
      open={open} trigger={<Button type="button" size="sm" variant={custom ? "secondary" : "outline"} className="h-7 bg-card px-2 emr-text-metadata" aria-pressed={custom}>직접</Button>}
      title="수납 이력 기간" dateLabel="수납 이력일" dates={draft} onDatesChange={setDraft} requireDates
      onOpen={() => { setDraft(custom ? dates : { start: "2026-07-11", end: "2026-10-11" }); setOpen(true); }} onReset={() => setDraft(emptyHistoryDateRange)}
      onCancel={() => setOpen(false)} onApply={() => { setDates({ ...draft }); setCustom(true); setApplied((count) => count + 1); setOpen(false); }}
    />
    {custom ? <Button size="sm" variant="outline" onClick={() => setCustom(false)} aria-label="직접 기간 조건 해제" className="max-w-full"><span className="truncate">{dates.start} ~ {dates.end} ×</span></Button> : null}
    <output aria-label="합성 수납 기간 결과">{dates.start} ~ {dates.end} · 적용 {applied}회</output>
  </div>;
}
