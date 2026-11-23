"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { getOperatingDateFromIso } from "@/lib/emr-domain/demo-date";
import type { SearchChart } from "./contract";
import { ResultReader } from "./result-reader";
import styles from "./workspace.module.css";

export function ResultFooter({ chart }: { chart: SearchChart }) {
  const tags = chart.extraTags;
  const available = useRef<HTMLDivElement>(null);
  const measures = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const max = Math.min(3, tags?.length ?? 0);
  useLayoutEffect(() => {
    const space = available.current,
      probes = measures.current;
    if (!space || !probes) return;
    const fit = () => {
      let visible = 0;
      Array.from(probes.children).forEach((candidate, i) => {
        if (candidate.getBoundingClientRect().width <= space.clientWidth)
          visible = i;
      });
      setCount(visible);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(space);
    Array.from(probes.children).forEach((el) => observer.observe(el));
    fit();
    return () => observer.disconnect();
  }, [tags]);
  const edited = getOperatingDateFromIso(chart.lastContentEditedAt)?.replaceAll(
    "-",
    ".",
  );
  return (
    <footer className={styles.cardFoot}>
      <div ref={available} className={styles.tagRow}>
        {tags?.length ? (
          <>
            {tags.slice(0, count).map((tag) => (
              <Tooltip
                key={tag.label}
                open={activeTag === tag.label}
                onOpenChange={(open) =>
                  setActiveTag((current) =>
                    open ? tag.label : current === tag.label ? null : current,
                  )
                }
              >
                <TooltipTrigger
                  className={styles.tagButton}
                  onClick={() =>
                    setActiveTag(activeTag === tag.label ? null : tag.label)
                  }
                >
                  <Badge variant="secondary" size="sm">
                    {tag.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>{tag.detail}</TooltipContent>
              </Tooltip>
            ))}
            {tags.length > count && (
              <ResultReader
                label="부가 정보"
                action={"+" + (tags.length - count)}
              >
                <ul>
                  {tags.map((tag) => (
                    <li key={tag.label}>{tag.detail}</li>
                  ))}
                </ul>
              </ResultReader>
            )}
            <div
              className={styles.tagMeasures}
              aria-hidden="true"
              inert
              ref={measures}
            >
              {Array.from({ length: max + 1 }, (_, n) => (
                <div key={n}>
                  {tags.slice(0, n).map((tag) => (
                    <Badge key={tag.label} variant="secondary" size="sm">
                      {tag.label}
                    </Badge>
                  ))}
                  {tags.length > n && (
                    <Button
                      size="xs"
                      variant="ghost"
                      className={styles.more}
                      tabIndex={-1}
                    >
                      +{tags.length - n}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <span className={styles.missing}>표시할 부가 정보가 없습니다</span>
        )}
      </div>
      {edited && (
        <span>
          최근 수정 <time dateTime={chart.lastContentEditedAt}>{edited}</time>
        </span>
      )}
    </footer>
  );
}
