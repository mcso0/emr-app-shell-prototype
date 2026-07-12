import type { AriaRole, ComponentPropsWithoutRef, ReactNode } from "react";
import { CdsActionsCheckCircleIcon } from "@/components/cds-icons/actions-and-controls";
import {
  CdsAlertsAlertCircleIcon,
  CdsAlertsAlertTriangleIcon,
  CdsAlertsInfoIcon,
} from "@/components/cds-icons/alerts-and-status";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import type { AppIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Severity controls default role, icon, and semantic token tone.
 */
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
  /**
   * Concise impact-oriented title. The title should make the alert meaning clear
   * without relying on color alone.
   */
  title: ReactNode;
  /**
   * Severity determines default ARIA role, icon, and tone. `error` and `warning`
   * default to `alert`; `info` and `success` default to `status`.
   */
  severity?: EmrInlineAlertSeverity;
  /**
   * Primary recovery or next-step action. The feature owns callbacks, permission
   * checks, logging, and persistence.
   */
  action?: ReactNode;
  /**
   * Secondary recovery action, such as viewing local demo state or details.
   */
  secondaryAction?: ReactNode;
  /**
   * Dismiss control for a non-blocking alert. It is positioned at the top end
   * so it stays distinct from recovery actions below the alert copy.
   */
  dismissAction?: ReactNode;
  /**
   * Custom icon node, or `false` to hide the icon when surrounding context
   * already communicates the alert role.
   */
  icon?: ReactNode | false;
  /**
   * Optional test hook for feature-level regression coverage.
   */
  testId?: string;
};

/**
 * Persistent in-context feedback for EMR workflow state.
 *
 * Use EmrInlineAlert for read failures, degraded live/demo boundaries,
 * permission blockers, financial preflight warnings, and in-context success.
 * Use toasts for transient feedback and FieldError for field-level validation.
 *
 * @summary persistent EMR workflow feedback
 */
export function EmrInlineAlert({
  action,
  children,
  className,
  dismissAction,
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
    <Alert
      {...props}
      data-severity={severity}
      data-testid={testId}
      role={resolvedRole}
      className={cn(
        "flex min-w-0 gap-3 rounded-lg border px-3 py-2.5 text-sm leading-5",
        dismissAction ? "pr-10" : undefined,
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
        <AlertTitle className="font-semibold text-current">{title}</AlertTitle>
        {children ? (
          <AlertDescription className="mt-1 text-current">
            {children}
          </AlertDescription>
        ) : null}
        {hasActions ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {action}
            {secondaryAction}
          </div>
        ) : null}
      </div>
      {dismissAction ? <AlertAction>{dismissAction}</AlertAction> : null}
    </Alert>
  );
}
