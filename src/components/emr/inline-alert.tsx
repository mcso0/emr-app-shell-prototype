import type { AriaRole, ComponentPropsWithoutRef, ReactNode } from "react";
import { CdsActionsCheckCircleIcon } from "@/components/cds-icons/actions-and-controls";
import {
  CdsAlertsAlertCircleIcon,
  CdsAlertsAlertTriangleIcon,
  CdsAlertsInfoIcon,
} from "@/components/cds-icons/alerts-and-status";
import type { AppIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type EmrInlineAlertSeverity = "error" | "warning" | "info" | "success";

type EmrInlineAlertRule = {
  defaultRole: Extract<AriaRole, "alert" | "status">;
  icon: AppIcon;
  toneClassName: string;
};

export const emrInlineAlertSeverityRules = {
  error: {
    defaultRole: "alert",
    icon: CdsAlertsAlertCircleIcon,
    toneClassName:
      "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
  },
  warning: {
    defaultRole: "alert",
    icon: CdsAlertsAlertTriangleIcon,
    toneClassName:
      "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
  },
  info: {
    defaultRole: "status",
    icon: CdsAlertsInfoIcon,
    toneClassName:
      "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  },
  success: {
    defaultRole: "status",
    icon: CdsActionsCheckCircleIcon,
    toneClassName:
      "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
  },
} as const satisfies Record<EmrInlineAlertSeverity, EmrInlineAlertRule>;

export type EmrInlineAlertProps = Omit<ComponentPropsWithoutRef<"section">, "title"> & {
  title: ReactNode;
  severity?: EmrInlineAlertSeverity;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  icon?: ReactNode | false;
  testId?: string;
};

export function EmrInlineAlert({
  action,
  children,
  className,
  icon,
  role,
  secondaryAction,
  severity = "info",
  testId,
  title,
  ...props
}: EmrInlineAlertProps) {
  const rule = emrInlineAlertSeverityRules[severity];
  const Icon = rule.icon;
  const resolvedRole = role ?? rule.defaultRole;
  const hasActions = action || secondaryAction;

  return (
    <section
      {...props}
      data-severity={severity}
      data-testid={testId}
      role={resolvedRole}
      className={cn(
        "flex min-w-0 gap-3 rounded-lg border px-3 py-2.5 text-sm leading-5",
        rule.toneClassName,
        className
      )}
    >
      {icon !== false ? (
        <span
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {icon ?? <Icon className="size-4" />}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-current">{title}</p>
        {children ? <div className="mt-1 text-current">{children}</div> : null}
        {hasActions ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {action}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </section>
  );
}
