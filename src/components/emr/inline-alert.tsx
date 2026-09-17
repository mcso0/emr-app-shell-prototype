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
export type EmrInlineAlertSeverity =
  | "neutral"
  | "error"
  | "warning"
  | "info"
  | "success";

export type EmrInlineAlertLayout = "default" | "actions" | "icon-box";

type EmrInlineAlertRule = {
  defaultRole: Extract<AriaRole, "alert" | "status">;
  icon: AppIcon;
  iconBoxClassName: string;
  toneClassName: string;
};

export const emrInlineAlertSeverityRules = {
  neutral: {
    defaultRole: "status",
    icon: CdsAlertsInfoIcon,
    iconBoxClassName: "bg-[var(--emr-border-default)]",
    toneClassName:
      "border-[var(--emr-border-default)] bg-[var(--emr-surface-muted)] text-[var(--emr-text-primary)]",
  },
  error: {
    defaultRole: "alert",
    icon: CdsAlertsAlertCircleIcon,
    iconBoxClassName: "bg-[var(--emr-status-danger-border)]",
    toneClassName:
      "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
  },
  warning: {
    defaultRole: "alert",
    icon: CdsAlertsAlertTriangleIcon,
    iconBoxClassName: "bg-[var(--emr-status-warning-border)]",
    toneClassName:
      "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
  },
  info: {
    defaultRole: "status",
    icon: CdsAlertsInfoIcon,
    iconBoxClassName: "bg-[var(--emr-status-info-border)]",
    toneClassName:
      "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  },
  success: {
    defaultRole: "status",
    icon: CdsActionsCheckCircleIcon,
    iconBoxClassName: "bg-[var(--emr-status-success-border)]",
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
   * default to `alert`; `neutral`, `info`, and `success` default to `status`.
   */
  severity?: EmrInlineAlertSeverity;
  /**
   * Visual arrangement for the content and end slot. When omitted, recovery
   * actions select `actions`; alerts without recovery actions use `default`.
   */
  layout?: EmrInlineAlertLayout;
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
   * Dismiss control for a non-blocking alert. It is positioned in the end slot
   * and remains distinct from recovery actions.
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
  layout,
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
  const resolvedLayout = layout ?? (hasActions ? "actions" : "default");
  const hasEndSlot = hasActions || dismissAction;
  const usesIconBox = resolvedLayout === "icon-box";

  return (
    <Alert
      {...props}
      data-severity={severity}
      data-layout={resolvedLayout}
      data-testid={testId}
      role={resolvedRole}
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2.5 rounded-lg border p-2.5 text-sm leading-5 has-data-[slot=alert-action]:pr-2.5",
        rule.toneClassName,
        className
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-[1_1_16rem] items-start gap-2.5",
          usesIconBox ? "items-center" : undefined
        )}
        data-slot="inline-alert-content"
      >
        {icon !== false ? (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center",
              usesIconBox
                ? "size-10 rounded-sm [&_svg:not([class*='size-'])]:size-5"
                : "size-5 [&_svg:not([class*='size-'])]:size-4",
              usesIconBox ? rule.iconBoxClassName : undefined
            )}
            aria-hidden="true"
          >
            {icon ?? <Icon className={usesIconBox ? "size-5" : "size-4"} />}
          </span>
        ) : null}
        <div className="min-w-0 flex-1 self-center">
          <AlertTitle className="break-words font-semibold text-current">
            {title}
          </AlertTitle>
          {children ? (
            <AlertDescription className="mt-1 break-words text-current">
              {children}
            </AlertDescription>
          ) : null}
        </div>
      </div>
      {hasEndSlot ? (
        <div
          className={cn(
            "ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2.5",
            hasActions ? "pr-2.5" : "pr-2"
          )}
          data-slot="inline-alert-end"
        >
          {hasActions ? (
            <>
              {action}
              {secondaryAction}
            </>
          ) : null}
          {dismissAction ? (
            <AlertAction className="static top-auto right-auto">
              {dismissAction}
            </AlertAction>
          ) : null}
        </div>
      ) : null}
    </Alert>
  );
}
