"use client";

import { CdsActionsSearchIcon, CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import type { ReceptionPatientSummary } from "./data";
import { getReceptionPatientOptionLabel } from "./reception-patient-lookup-model";
import type { ReceptionPatientLookupState } from "./use-reception-patient-lookup";

type Props = {
  inputClassName?: string;
  lookupState: ReceptionPatientLookupState;
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onSelect: (summary: ReceptionPatientSummary) => void;
  open: boolean;
  query: string;
  selectedSummary?: ReceptionPatientSummary;
  summaries: ReceptionPatientSummary[];
};

/** Features retain async/workspace lookup, selected patient and vital/dirty state. */
export function ReceptionPatientCombobox({ inputClassName, lookupState, onClear, onOpenChange, onQueryChange, onSelect, open, query, selectedSummary, summaries }: Props) {
  const message = lookupState === "loading" ? "DB 환자 검색 중입니다."
    : lookupState === "error" ? "환자 검색을 불러오지 못했습니다."
    : summaries.length === 0 ? "검색 결과가 없습니다." : undefined;
  const decoration = "absolute right-[var(--clair-spacing-8)] top-1/2 flex size-[var(--clair-spacing-24)] -translate-y-1/2 items-center justify-center p-0.5";

  return (
    <Combobox<string>
      value={selectedSummary?.patient.id ?? null}
      query={query}
      open={open && Boolean(query.trim())}
      onOpenChange={onOpenChange}
      filter={false}
      status={lookupState}
      itemToLabel={(id) => {
        const summary = id === selectedSummary?.patient.id ? selectedSummary : summaries.find((item) => item.patient.id === id);
        return summary ? getReceptionPatientOptionLabel(summary) : id;
      }}
      onQueryChange={(value, details) => {
        // Preserve unfinished search text on dismiss; only typing changes domain selection.
        if (details.reason === "input-change") onQueryChange(value);
      }}
      onValueChange={(id, details) => {
        if (details.reason !== "item-press") return;
        const summary = summaries.find((item) => item.patient.id === id);
        if (summary) onSelect(summary);
      }}
      announcement={(change) => change.type === "results" && !change.loading ? `검색 결과 ${change.count}건` : null}
    >
      <div className="relative">
        <ComboboxInput
          aria-label="환자 검색"
          aria-required="true"
          autoComplete="off"
          className={cn("pr-[var(--clair-spacing-32)]", inputClassName)}
          placeholder="환자를 선택해주세요"
          onFocus={() => onOpenChange(true)}
        />
        {query ? <button type="button" className={`${decoration} rounded-full text-muted-foreground outline-none transition-colors hover:text-[var(--emr-text-secondary)] focus-visible:ring-3 focus-visible:ring-ring/50`} aria-label="환자 선택 초기화" data-state="clear" data-testid="reception-patient-lookup-decoration" onClick={onClear}><CdsActionsXIcon className="size-4" aria-hidden="true" /></button>
          : <span className={`${decoration} pointer-events-none text-[var(--clair-color-atomic-neutral-500)]`} aria-hidden="true" data-state="search" data-testid="reception-patient-lookup-decoration"><CdsActionsSearchIcon className="size-4" aria-hidden="true" /></span>}
      </div>
      <ComboboxContent>
        <ComboboxList render={<div aria-label="검색 결과" aria-labelledby="" />} className="grid gap-1">
          {message ? <div role="status" aria-label="조회 상태" className="px-2.5 py-2 emr-text-dense text-muted-foreground">{message}</div> : null}
          {summaries.map((summary) => <ComboboxItem key={summary.patient.id} value={summary.patient.id} label={getReceptionPatientOptionLabel(summary)}>
            <span className="truncate emr-text-dense font-semibold text-foreground">{getReceptionPatientOptionLabel(summary)}</span>
            <span className="truncate emr-text-metadata text-muted-foreground">{summary.primaryGuardian?.mobilePhone ?? "보호자 연락처 미등록"}</span>
          </ComboboxItem>)}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
