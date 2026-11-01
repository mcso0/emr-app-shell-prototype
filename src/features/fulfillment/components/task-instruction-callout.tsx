"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CdsAlertsInfoIcon } from "@/components/cds-icons/alerts-and-status";
import { CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsUtilitiesHistoryIcon } from "@/components/cds-icons/utilities-and-misc";
import { OverallInstructionsHistoryDialog } from "@/features/chart/overall-instructions-history-dialog";
import { createOverallInstructionsClient, InstructionRequestError } from "@/features/chart/overall-instructions-client";
import { instructionScopeLabels, type OverallInstructions } from "@/features/chart/overall-instructions-contract";
import type { EffectiveInstructions } from "../task-instruction-review-contract";
import styles from "./task-instruction-callout.module.css";

function TaskInstructionHistory({ workspaceId, chartId, onClose, onReview }: { workspaceId: string; chartId: string; onClose: () => void; onReview: () => void }) {
  const client = useMemo(() => createOverallInstructionsClient(workspaceId, chartId), [workspaceId, chartId]);
  const [document, setDocument] = useState<OverallInstructions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void client.load(abort.signal).then(value => {
      if (!abort.signal.aborted) setDocument(value);
    }).catch(failure => {
      if (abort.signal.aborted) return;
      setError(failure instanceof InstructionRequestError && ["permission_missing", "workspace_membership_missing", "permission_denied", "forbidden"].includes(failure.code)
        ? "변경 이력을 조회할 권한이 없습니다."
        : "변경 이력을 불러오지 못했습니다. 조회 권한을 확인하거나 다시 시도해 주세요.");
    });
    return () => abort.abort();
  }, [client, retry]);
  return <OverallInstructionsHistoryDialog open onOpenChange={open => { if (!open) onClose(); }} history={document?.history ?? []}
    loading={!document && !error} error={error} onViewSnapshots={() => { onClose(); onReview(); }} onRetry={() => { setError(null); setRetry(value => value + 1); }} />;
}

function InstructionEntry({ item, showScope }: { item: EffectiveInstructions["entries"][number]; showScope: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const rowRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const contentId = useId();
  const text = item.deleted ? "지시 삭제됨" : item.instruction;
  const label = item.legacy ? "경구제 지시" : instructionScopeLabels[item.scope];
  useEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    let active = true;
    const update = () => {
      if (!active) return;
      // Measure against the available row before reserving the toggle's width.
      const badgeWidth = badgeRef.current ? badgeRef.current.getBoundingClientRect().width + 6 : 0;
      setOverflows(text.includes("\n") || measure.getBoundingClientRect().width > row.clientWidth - badgeWidth);
    };
    const observer = new ResizeObserver(update);
    observer.observe(row);
    update();
    void window.document.fonts.ready.then(update);
    return () => { active = false; observer.disconnect(); };
  }, [text, showScope]);
  return <section ref={rowRef} className={styles.entry}>
    {showScope && <span ref={badgeRef} className={styles.badge}>{item.legacy ? "경구제" : item.scope === "overall" ? "전체" : label.replace(/ 지시$/, "")}</span>}
    <div className={styles.text}>
      <p id={contentId} className={expanded ? styles.expandedText : styles.summaryText}>{text}</p>
      <span ref={measureRef} aria-hidden="true" className={styles.measure} data-measure-text={text} />
    </div>
    {overflows && <Button variant="ghost" className={styles.expand} aria-label={`${label} ${expanded ? "접기" : "펼치기"}`} aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)}>{expanded ? "접기" : "펼치기"}</Button>}
  </section>;
}

/** One chart/version per card. UI-only actions never acknowledge instructions. */
export function TaskInstructionCallout({ document, workspaceId, onReview }: {
  document: EffectiveInstructions; workspaceId?: string; onReview: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const titleId = useId();
  const restoreRef = useRef<HTMLButtonElement>(null);
  const historyRef = useRef<HTMLButtonElement>(null);
  const movedFocus = useRef(false);
  useEffect(() => {
    if (!movedFocus.current) return;
    (hidden ? restoreRef : historyRef).current?.focus();
    movedFocus.current = false;
  }, [hidden]);
  const changed = document.entries.some(item => item.revision > 1);
  const single = document.entries.length === 1 ? document.entries[0] : null;
  const title = single ? single.legacy ? "경구제 지시사항" : `${instructionScopeLabels[single.scope]}사항` : "총괄 지시사항";
  return <div className={styles.container}>
    {hidden ? <Button ref={restoreRef} size="sm" variant="ghost" onClick={() => { movedFocus.current = true; setHidden(false); }}><CdsAlertsInfoIcon />지시사항 다시 보기</Button> :
      <aside aria-labelledby={titleId} className={`${styles.card} ${changed ? "" : styles.withoutHistory}`}>
        <div className={styles.symbol}><CdsAlertsInfoIcon aria-hidden="true" /></div>
        <div className={styles.content}>
          <div className={styles.heading}><h3 id={titleId} className={styles.title}>{title}</h3>{changed && <Badge variant="secondary" size="sm" className={styles.changedBadge}>변경됨</Badge>}</div>
          <div className={styles.entries}>
            {document.entries.map(item => <InstructionEntry key={`${item.scope}:${!!item.legacy}`} item={item} showScope={!single} />)}
          </div>
        </div>
        <div className={styles.actions}>
          {changed && <Button ref={historyRef} variant="ghost" className={`${styles.ghost} ${styles.history}`} aria-haspopup="dialog" disabled={!workspaceId} onClick={() => setHistoryOpen(true)}><CdsUtilitiesHistoryIcon /><span>변경이력 보기</span></Button>}
          <Button ref={changed ? undefined : historyRef} variant="ghost" className={`${styles.ghost} ${styles.icon}`} aria-label="지시사항 숨기기" onClick={() => { movedFocus.current = true; setHidden(true); }}><CdsActionsXIcon /></Button>
        </div>
      </aside>}
    {historyOpen && workspaceId && <TaskInstructionHistory onReview={onReview} workspaceId={workspaceId} chartId={document.chartId} onClose={() => { setHistoryOpen(false); historyRef.current?.focus(); }} />}
  </div>;
}
