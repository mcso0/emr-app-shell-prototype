"use client";

import { useId, useState } from "react";
import { ClockIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLLAPSED_DIAGNOSIS_COUNT = 3;
// Align the metadata with the label inside a chip, including its border.
const labelInset = "pl-[calc(var(--clair-spacing-6)+1px)]";

export function ChartDiagnosisHistoryItem({
  dateLabel,
  diagnosisNames,
  encounterId,
  onSelect,
  query,
  selected,
  timeLabel,
  veterinarianName,
}: {
  dateLabel: string;
  diagnosisNames: string[];
  encounterId: string;
  onSelect: () => void;
  query: string;
  selected: boolean;
  timeLabel: string;
  veterinarianName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const diagnosesId = useId();
  const isSearching = Boolean(query.trim());
  const names = diagnosisNames.map((name) => name.trim()).filter(Boolean);
  const visibleNames = expanded || isSearching
    ? names
    : names.slice(0, COLLAPSED_DIAGNOSIS_COUNT);
  const hiddenCount = names.length - COLLAPSED_DIAGNOSIS_COUNT;

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-[var(--clair-spacing-6)] border-b border-[var(--emr-border-default)] px-[var(--emr-content-history-card-padding)] py-[var(--clair-spacing-8)] last:border-b-0 hover:bg-[var(--emr-content-history-card-hover-bg)]",
        selected && "bg-[var(--emr-content-history-card-selected-bg)]",
      )}
      data-testid={`chart-diagnosis-history-item-${encounterId}`}
      data-selected={selected ? "true" : undefined}
    >
      <div className={cn("emr-text-metadata flex min-h-[var(--clair-control-height-xs)] items-center justify-between gap-[var(--clair-spacing-8)] text-[var(--emr-content-history-card-meta)]", labelInset)}>
        <span className="inline-flex min-w-0 items-center gap-[var(--clair-spacing-4)] whitespace-nowrap tabular-nums">
          <ClockIcon aria-hidden="true" className="size-3 shrink-0" />
          <span>{dateLabel} · {timeLabel}</span>
        </span>
        <Button
          size="xs"
          variant="ghost"
          aria-pressed={selected}
          onClick={onSelect}
          className="text-[var(--emr-content-history-card-meta)]"
        >
          차트 보기
        </Button>
      </div>
      <div id={diagnosesId} className="emr-text-body flex min-w-0 flex-wrap items-center gap-[var(--clair-spacing-4)]">
        {visibleNames.map((name, index) => (
          <Badge
            key={`${index}-${name}`}
            variant="secondary"
            size="sm"
            className="emr-text-body h-auto min-h-[var(--clair-control-height-xs)] max-w-full justify-start rounded-[var(--emr-content-history-card-radius)] border-transparent bg-[var(--clair-color-atomic-neutral-100)] px-[var(--clair-spacing-6)] py-[var(--clair-spacing-2)] text-left whitespace-normal text-[var(--emr-content-history-card-title)] [overflow-wrap:anywhere] [word-break:keep-all]"
          >
            {name}
          </Badge>
        ))}
        {!names.length && (
          <span className={cn("text-[var(--emr-content-history-card-meta)]", labelInset)}>
            진단 기록 없음
          </span>
        )}
        {hiddenCount > 0 && !isSearching && (
          <Button
            size="xs"
            variant="ghost"
            aria-expanded={expanded}
            aria-controls={diagnosesId}
            className="aria-expanded:bg-transparent hover:aria-expanded:bg-[var(--emr-state-hover)]"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "접기" : `+${hiddenCount}개 진단`}
          </Button>
        )}
      </div>
      <div className={cn("emr-text-metadata flex min-h-[var(--clair-control-height-xs)] min-w-0 items-center text-[var(--emr-content-history-card-meta)]", labelInset)}>
        <span className="truncate" title={`담당 ${veterinarianName}`}>
          담당 {veterinarianName}
        </span>
      </div>
    </article>
  );
}
