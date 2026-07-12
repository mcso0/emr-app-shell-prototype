import { ClockIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderQueueItem, OrderQueueStatusDefinition } from "@/types/emr";

type OrderQueueSelectionSummaryProps = {
  item: OrderQueueItem | null;
  statuses: OrderQueueStatusDefinition[];
  className?: string;
};

export function OrderQueueSelectionSummary({
  className,
  item,
  statuses,
}: OrderQueueSelectionSummaryProps) {
  if (!item) return null;

  const status = statuses.find((statusItem) => statusItem.id === item.statusId);
  const statusLabel = status?.label ?? item.statusId;

  return (
    <section
      className={cn(
        "rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-border-default)] bg-card px-4 py-3",
        className
      )}
      data-testid="order-queue-selection-summary"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-[18px] w-[3px] shrink-0 rounded-[var(--clair-border-width-atomic-1)]"
              style={{ backgroundColor: `var(${status?.colorToken ?? "--emr-status-neutral-text"})` }}
              aria-hidden="true"
            />
            <h2 className="emr-text-compact-title truncate font-semibold text-foreground">
              {item.patientName} · {item.guardianName}
            </h2>
            <Badge
              variant="secondary"
              className="emr-text-status h-5 rounded-[var(--clair-radius-atomic-6)] bg-[var(--emr-status-neutral-bg)] px-1.5 font-medium text-[var(--emr-status-neutral-text)]"
            >
              {item.receptionType}
            </Badge>
          </div>
          <div className="emr-text-dense mt-1 flex min-w-0 items-center gap-1 font-medium text-[var(--emr-text-tertiary)]">
            <span className="shrink-0">{item.orderType}</span>
            <span className="text-[var(--emr-text-tertiary)]">·</span>
            <span className="truncate">{item.orderName}</span>
          </div>
        </div>
        <div className="emr-text-status flex shrink-0 items-center gap-1 font-medium text-[var(--emr-text-tertiary)]">
          <ClockIcon className="size-3.5 text-[var(--emr-text-tertiary)]" aria-hidden="true" />
          <span>{item.time}</span>
          <span>{statusLabel}</span>
        </div>
      </div>
      <div className="emr-text-status mt-2 flex min-w-0 items-center gap-1.5 font-medium">
        <span className="rounded-[var(--clair-radius-atomic-4)] border border-[var(--emr-border-subtle)] px-1.5 py-0.5 text-[var(--emr-text-secondary)]">
          요청 {item.requesterName}
        </span>
        {item.assigneeName ? (
          <span className="rounded-[var(--clair-radius-atomic-4)] border border-[var(--emr-border-subtle)] px-1.5 py-0.5 text-[var(--emr-text-secondary)]">
            담당 {item.assigneeName}
          </span>
        ) : null}
      </div>
    </section>
  );
}
