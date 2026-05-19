import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HomeNextAction, HomeTask } from "@/features/home/home.types";

function isUrgentTask(task: HomeTask) {
  return task.status === "overdue" || task.priority === "urgent";
}

export function HomeTaskDecisionBadge({
  label,
  task,
}: {
  label: string;
  task: HomeTask;
}) {
  return (
    <Badge variant={isUrgentTask(task) ? "destructive" : "secondary"}>
      {label}
    </Badge>
  );
}

export function HomeTaskStatusBadge({
  label,
  task,
}: {
  label: string;
  task: HomeTask;
}) {
  return (
    <Badge
      variant={
        isUrgentTask(task)
          ? "destructive"
          : task.status === "inProgress"
            ? "default"
            : "secondary"
      }
    >
      {label}
    </Badge>
  );
}

export function HomeNextActionPriorityBadge({ action }: { action: HomeNextAction }) {
  return (
    <Badge
      variant={action.tone === "danger" ? "destructive" : "secondary"}
      className="shrink-0"
    >
      {action.priorityLabel}
    </Badge>
  );
}

export function HomeTaskDecisionPill({
  label,
  task,
}: {
  label: string;
  task: HomeTask;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4",
        isUrgentTask(task)
          ? "bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]"
          : task.assignment === "roleQueue"
            ? "bg-[var(--emr-status-warning-bg)] text-foreground"
            : "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}

export function HomeMutedPill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold leading-4 text-muted-foreground">
      {label}
    </span>
  );
}
