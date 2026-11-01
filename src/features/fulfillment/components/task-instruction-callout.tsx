"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CdsAlertsInfoIcon } from "@/components/cds-icons/alerts-and-status";
import { CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsNavigationChevronDownIcon } from "@/components/cds-icons/navigation";
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

/** One chart/version per card. UI-only actions never acknowledge instructions. */
export function TaskInstructionCallout({ document, workspaceId, onReview }: {
  document: EffectiveInstructions; workspaceId?: string; onReview: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const entriesId = useId();
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
      <aside aria-labelledby={titleId} className={`${styles.card} ${collapsed ? styles.collapsed : ""}`}>
        <div className={styles.symbol}><CdsAlertsInfoIcon aria-hidden="true" /></div>
        <div className={styles.content}>
          <div className={styles.heading}><h3 id={titleId} className={styles.title}>{title}</h3>{changed && <Badge variant="secondary" size="sm">변경됨</Badge>}</div>
          <div id={entriesId} className={styles.entries} hidden={collapsed}>
            {document.entries.map(item => <section className={styles.entry} key={`${item.scope}:${!!item.legacy}`}>
              {!single && <span className={styles.badge}>{item.legacy ? "경구제" : item.scope === "overall" ? "전체" : instructionScopeLabels[item.scope].replace(/ 지시$/, "")}</span>}
              <p>{item.deleted ? "지시 삭제됨" : item.instruction}</p>
            </section>)}
          </div>
        </div>
        <div className={styles.actions}>
          <Button ref={historyRef} variant="ghost" className={`${styles.ghost} ${styles.history}`} aria-haspopup="dialog" disabled={!workspaceId} onClick={() => setHistoryOpen(true)}><CdsUtilitiesHistoryIcon /><span>변경이력 보기</span></Button>
          <Button variant="ghost" className={`${styles.ghost} ${styles.icon}`} aria-label={collapsed ? "지시사항 펼치기" : "지시사항 접기"} aria-expanded={!collapsed} aria-controls={entriesId} onClick={() => setCollapsed(value => !value)}><CdsNavigationChevronDownIcon className={styles.chevron} /></Button>
          <Button variant="ghost" className={`${styles.ghost} ${styles.icon}`} aria-label="지시사항 숨기기" onClick={() => { movedFocus.current = true; setHidden(true); }}><CdsActionsXIcon /></Button>
        </div>
      </aside>}
    {historyOpen && workspaceId && <TaskInstructionHistory onReview={onReview} workspaceId={workspaceId} chartId={document.chartId} onClose={() => { setHistoryOpen(false); historyRef.current?.focus(); }} />}
  </div>;
}
