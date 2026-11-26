"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Highlight } from "./presentation";
import { searchWords } from "./ranking";
import styles from "./workspace.module.css";

export function ResultReader({
  label,
  action = "더보기",
  children,
}: {
  label: string;
  action?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [small, setSmall] = useState(false);
  useLayoutEffect(() => {
    const media = window.matchMedia("(max-width: 650px)");
    const update = () => setSmall(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const trigger = (
    <Button
      size="xs"
      variant="ghost"
      className={styles.more}
      aria-label={label + " " + action}
    />
  );
  const Title = small ? SheetTitle : PopoverTitle;
  const body = (
    <>
      <header className="flex items-center justify-between gap-2">
        <Title>{label}</Title>
        <Button
          aria-label="닫기"
          size="icon-xs"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          <CloseIcon />
        </Button>
      </header>
      <div className={styles.readerBody} tabIndex={0}>
        {children}
      </div>
    </>
  );
  if (small)
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={trigger}>{action}</SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[75dvh] gap-2 p-3"
          showCloseButton={false}
        >
          {body}
        </SheetContent>
      </Sheet>
    );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger}>{action}</PopoverTrigger>
      <PopoverContent align="end" className={styles.reader}>
        {body}
      </PopoverContent>
    </Popover>
  );
}

export function ResultExcerpt({
  value,
  label,
  query,
  openOriginal,
  originalLabel,
  empty = "기록 없음",
  overflowAction,
}: {
  value: string;
  label: string;
  query: string;
  openOriginal?: () => void;
  originalLabel?: string;
  empty?: string;
  overflowAction?: { action: string; content: ReactNode };
}) {
  const outer = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);
  const offsets = searchWords(query)
    .map((word) => value.toLocaleLowerCase().indexOf(word))
    .filter((i) => i >= 0);
  const start =
    openOriginal || !offsets.length
      ? 0
      : Math.max(0, Math.min(...offsets) - 20);
  const preview = start ? "…" + value.slice(start) : value;
  useLayoutEffect(() => {
    const box = outer.current,
      span = line.current;
    if (!box || !span) return;
    // Compare against the whole row so removing the trigger after a resize is stable.
    const measure = () => setClipped(span.scrollWidth > box.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(span);
    document.fonts.addEventListener("loadingdone", measure);
    measure();
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [preview]);
  if (!value) return <span className={styles.missing}>{empty}</span>;
  const lineText = (
    <span className={styles.ellipsis} ref={line}>
      <Highlight value={preview} query={query} />
    </span>
  );
  return (
    <div className={styles.excerpt} ref={outer}>
      {openOriginal ? (
        <Button
          variant="ghost"
          className={styles.chartTitle}
          aria-label={originalLabel}
          onClick={openOriginal}
        >
          {lineText}
        </Button>
      ) : (
        lineText
      )}
      {(clipped || start > 0 || overflowAction) && (
        <ResultReader label={label} action={overflowAction?.action}>
          {overflowAction?.content ?? <Highlight value={value} query={query} />}
        </ResultReader>
      )}
    </div>
  );
}
