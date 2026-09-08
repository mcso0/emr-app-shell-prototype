"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CdsFilesCalendarIcon } from "@/components/cds-icons/files-and-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./chart-diagnosis-history-item.module.css";

function HighlightedDiagnosis({ name, query }: { name: string; query: string }) {
  if (!query) return name;
  const normalized = name.toLocaleLowerCase("ko-KR");
  const parts = [];
  let start = 0;
  let match = normalized.indexOf(query);
  while (match !== -1) {
    parts.push(name.slice(start, match));
    parts.push(<strong key={match}>{name.slice(match, match + query.length)}</strong>);
    start = match + query.length;
    match = normalized.indexOf(query, start);
  }
  parts.push(name.slice(start));
  return parts;
}

export function ChartDiagnosisHistoryItem({
  dateLabel,
  diagnosisNames,
  encounterId,
  onSelect,
  query,
}: {
  dateLabel: string;
  diagnosisNames: string[];
  encounterId: string;
  onSelect: () => void;
  query: string;
}) {
  const tooltipId = useId();
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const names = useMemo(() => {
    const cleaned = diagnosisNames.map((name) => name.trim()).filter(Boolean);
    if (!normalizedQuery) return cleaned;
    const matches = (name: string) => name.toLocaleLowerCase("ko-KR").includes(normalizedQuery);
    // Display matches first without changing the authoritative diagnosis order.
    return [...cleaned.filter(matches), ...cleaned.filter((name) => !matches(name))];
  }, [diagnosisNames, normalizedQuery]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [layout, setLayout] = useState({ count: 1, firstMaxWidth: null as number | null });
  const diagnosesRef = useRef<HTMLDivElement>(null);
  const measurementRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = diagnosesRef.current;
    const measurement = measurementRef.current;
    if (!container || !measurement || !names.length) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const available = container.getBoundingClientRect().width;
      const gap = Number.parseFloat(getComputedStyle(container).columnGap) || 0;
      const widths = Array.from(measurement.querySelectorAll<HTMLElement>("[data-measure-name]"), (el) => el.getBoundingClientRect().width);
      const counters = measurement.querySelectorAll<HTMLElement>("[data-measure-count]");
      const total = widths.reduce((sum, width) => sum + width, 0) + gap * (names.length - 1);
      let count = names.length;
      let firstMaxWidth: number | null = null;
      if (total > available) {
        count = 1;
        let used = 0;
        for (let candidate = 1; candidate < names.length; candidate++) {
          used += widths[candidate - 1];
          const counterWidth = counters[names.length - candidate - 1].getBoundingClientRect().width;
          if (used + gap * candidate + counterWidth <= available) count = candidate;
        }
        const counterWidth = names.length > 1 ? counters[names.length - 2].getBoundingClientRect().width + gap : 0;
        if (count === 1 && widths[0] + counterWidth > available) {
          firstMaxWidth = Math.max(0, available - counterWidth);
        }
      }
      if (count === names.length) setMoreOpen(false);
      if (firstMaxWidth === null) setNameOpen(false);
      setLayout((previous) => previous.count === count && previous.firstMaxWidth === firstMaxWidth
        ? previous : { count, firstMaxWidth });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(measurement);
    measure();
    void document.fonts.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); };
  }, [names, hovered, focused, moreOpen, nameOpen]);

  const count = Math.min(layout.count, names.length);
  const hiddenNames = names.slice(count);

  return (
    <article
      className={styles.row}
      data-testid={`chart-diagnosis-history-item-${encounterId}`}
      data-actions-visible={hovered || focused || undefined}
      data-tooltip-open={moreOpen || nameOpen || undefined}
      onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <span className={styles.date}>
        <CdsFilesCalendarIcon aria-hidden="true" className={styles.calendar} />
        <span>{dateLabel}</span>
      </span>
      <div ref={diagnosesRef} className={styles.diagnoses}>
        {names.slice(0, count).map((name, index) => (
          <Tooltip key={`${index}-${name}`} open={index === 0 && nameOpen} onOpenChange={setNameOpen}>
            <TooltipTrigger
              data-history-diagnosis=""
              aria-describedby={nameOpen && index === 0 ? `${tooltipId}-name` : undefined}
              disabled={index !== 0 || layout.firstMaxWidth === null}
              closeOnClick={false}
              closeDelay={150}
              onClick={() => { if (index === 0 && layout.firstMaxWidth !== null) setNameOpen(true); }}
              render={
                <Badge
                  variant="secondary"
                  className={styles.badge}
                  tabIndex={index === 0 && layout.firstMaxWidth !== null ? 0 : -1}
                  style={index === 0 && layout.firstMaxWidth !== null ? { maxWidth: layout.firstMaxWidth } : undefined}
                />
              }
            >
              <span className={styles.badgeText}><HighlightedDiagnosis name={name} query={normalizedQuery} /></span>
            </TooltipTrigger>
            <TooltipContent role="tooltip" id={`${tooltipId}-name`}>
              <span className={styles.tooltipText}><HighlightedDiagnosis name={name} query={normalizedQuery} /></span>
            </TooltipContent>
          </Tooltip>
        ))}
        {!names.length && <span className={styles.empty}>진단 기록 없음</span>}
        {hiddenNames.length > 0 && (
          <Tooltip open={moreOpen} onOpenChange={setMoreOpen}>
            <TooltipTrigger
              closeDelay={200}
              closeOnClick={false}
              onClick={() => setMoreOpen(true)}
              render={<Button variant="ghost" size="xs" className={styles.more} />}
              aria-describedby={moreOpen ? `${tooltipId}-more` : undefined}
              aria-label={`숨겨진 진단 ${hiddenNames.length}개 보기`}
            >
              +{hiddenNames.length}
            </TooltipTrigger>
            <TooltipContent role="tooltip" id={`${tooltipId}-more`}>
              <div className={styles.tooltipList} tabIndex={0} aria-label="숨겨진 진단 목록">
                {hiddenNames.map((name, index) => (
                  <div key={`${index}-${name}`}><HighlightedDiagnosis name={name} query={normalizedQuery} /></div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className={styles.action}>
        <Button variant="outline" size="xs" className={styles.view} onClick={onSelect}>
          차트 보기
        </Button>
      </div>
      {/* Intrinsic widths include real glyphs, bold search matches and count digits.
          This hidden copy never enters the accessibility tree or the tab order. */}
      <div ref={measurementRef} className={styles.measurement} aria-hidden="true">
        {names.map((name, index) => (
          <span key={`${index}-${name}`} data-measure-name className={styles.badge}>
            <span className={styles.badgeText}><HighlightedDiagnosis name={name} query={normalizedQuery} /></span>
          </span>
        ))}
        {names.map((_, index) => <span key={index} data-measure-count className={styles.more}>+{index + 1}</span>)}
      </div>
    </article>
  );
}
