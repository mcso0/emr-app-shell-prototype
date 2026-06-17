import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { EmrInlineAlert } from "./inline-alert";

type EmptyInfoFeedbackPattern = "empty" | "info" | "alert-boundary";

export type StorybookEmptyInfoFeedbackPatternsProps = {
  actionLabel?: string;
  body: string;
  pattern: EmptyInfoFeedbackPattern;
  title: string;
};

const patternCopy: Record<
  EmptyInfoFeedbackPattern,
  {
    label: string;
    shellClassName: string;
  }
> = {
  empty: {
    label: "Empty state",
    shellClassName: "border-dashed bg-card",
  },
  info: {
    label: "Info box",
    shellClassName: "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)]",
  },
  "alert-boundary": {
    label: "Inline alert boundary",
    shellClassName: "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)]",
  },
};

export function StorybookEmptyInfoFeedbackPatterns({
  actionLabel = "샘플 작업",
  body,
  pattern,
  title,
}: StorybookEmptyInfoFeedbackPatternsProps) {
  if (pattern === "alert-boundary") {
    return (
      <div className="max-w-2xl">
        <EmrInlineAlert severity="warning" title={title}>
          {body}
          <div className="mt-3">
            <Button type="button" variant="outline" size="sm">
              {actionLabel}
            </Button>
          </div>
        </EmrInlineAlert>
      </div>
    );
  }

  const copy = patternCopy[pattern];

  return (
    <div
      className={cn(
        "max-w-2xl rounded-lg border p-4 text-sm",
        copy.shellClassName
      )}
    >
      <div className="emr-text-metadata font-semibold text-muted-foreground">
        {copy.label}
      </div>
      <div className="mt-2 text-[15px] font-semibold leading-5 text-foreground">
        {title}
      </div>
      <p className="mt-1 max-w-xl leading-5 text-muted-foreground">{body}</p>
      {actionLabel ? (
        <div className="mt-3">
          <Button type="button" variant={pattern === "empty" ? "outline" : "ghost"} size="sm">
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
