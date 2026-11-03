"use client";

import styles from "./work-entry-page.module.css";
import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

/** Other-order entry frame. Mirrors the unchanged chart preconsultation layout. */
export function EmrWorkEntryPage({ header, children, testId = "order-work-entry" }: {
  header: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return <ScrollArea className="h-full min-h-0 flex-1 bg-[var(--emr-surface-panel)]" viewportClassName="scroll-fade-y scroll-fade-8 px-4" viewportStyle={{ overflowX: "hidden" }} data-testid={testId}>
    <div className={`${styles.frame} mx-auto w-full max-w-[1024px] bg-[var(--emr-surface-panel)]`}>
      {header}
      <Separator className="mx-6 !w-auto" />
      <div className={`${styles.body} flex min-w-0 flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8`}>{children}</div>
    </div>
  </ScrollArea>;
}

export function EmrWorkEntrySection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex min-w-0 flex-col gap-4"><h2 className="text-base font-semibold text-[var(--emr-text-secondary)]">{title}</h2>{children}</section>;
}

export function EmrWorkEntrySummary({ items }: { items: readonly (readonly [string, ReactNode])[] }) {
  return <dl className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))] overflow-hidden rounded-xl border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)]">
    {items.map(([label, value], index) => <div key={label} className="relative min-w-0 px-3 py-3.5 sm:px-6 sm:py-4">
      <dt className="text-sm font-medium text-[var(--emr-text-tertiary)]">{label}</dt>
      <dd className="mt-2 min-h-[22px] break-words text-sm font-medium">{value}</dd>
      {index < items.length - 1 && <span aria-hidden className="absolute top-1/2 right-0 h-10 w-px -translate-y-1/2 bg-[var(--emr-border-default)]" />}
    </div>)}
  </dl>;
}
