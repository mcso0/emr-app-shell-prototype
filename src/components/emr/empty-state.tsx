"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import folderFileCloseMotionIcon from "../../../icons/motionIcon/Folder File close.json";
import folderFileRemoveMotionIcon from "../../../icons/motionIcon/folder-file-remove.json";
import folderFileSearchMotionIcon from "../../../icons/motionIcon/folder-file-search.json";
import folderFileMotionIcon from "../../../icons/motionIcon/folder-file.json";
import searchDocumentTextMotionIcon from "../../../icons/motionIcon/search-document-text.json";
import searchNotFoundMotionIcon from "../../../icons/motionIcon/search-not-found.json";
import { CdsAlertsAlertTriangleIcon } from "@/components/cds-icons/alerts-and-status";
import { cn } from "@/lib/utils";

import { EmrMotionIcon } from "./motion-icon";

export type EmrEmptyStateKind =
  | "no-data"
  | "no-search-results"
  | "no-filter-results"
  | "no-scope-result"
  | "no-permission"
  | "upstream-pending"
  | "read-error";

export type EmrEmptyStateSurface =
  | "queue"
  | "content"
  | "drawer"
  | "table"
  | "widget"
  | "global-shell";

export type EmrEmptyStatePriority =
  | "supporting"
  | "local-recovery"
  | "primary-decision";

export type EmrEmptyStateDensity = "compact" | "standard" | "table-row";
export type EmrEmptyStateSize = "xl" | "lg" | "md" | "sm";
export type EmrEmptyStateAlign = "start" | "center";

export type EmrEmptyStateProps = Omit<
  ComponentPropsWithoutRef<"section">,
  "title"
> & {
  /**
   * Why the expected content is missing. This should drive copy and icon
   * semantics, not feature behavior.
   */
  kind: EmrEmptyStateKind;
  /**
   * Where the empty state appears. Surface controls density and CTA ownership
   * guidance, but does not own routing, permission checks, or persistence.
   */
  surface: EmrEmptyStateSurface;
  /**
   * Action hierarchy for this surface. Use `primary-decision` only for the one
   * surface that owns the screen-level next step.
   */
  priority?: EmrEmptyStatePriority;
  title: ReactNode;
  description?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  icon?: ReactNode | false;
  eyebrow?: ReactNode;
  density?: EmrEmptyStateDensity;
  /**
   * Visual size contract aligned to CDS.V2 EmptyPlaceholder. `xl` is reserved
   * for full workspace states, and `md` is the implementation tier for the
   * product's `mg` usage label.
   */
  size?: EmrEmptyStateSize;
  align?: EmrEmptyStateAlign;
  /**
   * Keeps the no-action variant optically aligned with action variants in
   * the Figma component set. Set false only when the surrounding surface
   * intentionally removes the reserved action row.
   */
  reserveActionSpace?: boolean;
  testId?: string;
};

const motionIconByKind: Record<Exclude<EmrEmptyStateKind, "read-error">, unknown> = {
  "no-data": folderFileCloseMotionIcon,
  "no-search-results": searchNotFoundMotionIcon,
  "no-filter-results": folderFileSearchMotionIcon,
  "no-scope-result": searchDocumentTextMotionIcon,
  "no-permission": folderFileRemoveMotionIcon,
  "upstream-pending": folderFileMotionIcon,
};

function DefaultEmptyStateIcon({
  className,
  kind,
}: {
  className: string;
  kind: EmrEmptyStateKind;
}) {
  if (kind === "read-error") {
    return (
      <CdsAlertsAlertTriangleIcon
        className={className}
        data-empty-state-icon="read-error"
      />
    );
  }

  return (
    <EmrMotionIcon
      animationData={motionIconByKind[kind]}
      className={cn(className, "text-current [&_path]:!stroke-current")}
      loop={false}
    />
  );
}

const sizeClassName: Record<
  EmrEmptyStateSize,
  {
    root: string;
    iconWrapper: string;
    iconArea: string;
    icon: string;
    body: string;
    title: string;
    description: string;
    copy: string;
    spacer: string;
  }
> = {
  xl: {
    root: "max-w-[220px] gap-6",
    iconWrapper: "",
    iconArea: "size-20 rounded-[28px] p-0.5",
    icon: "size-9",
    body: "gap-6",
    title: "text-[18px] leading-[26px] tracking-[-0.002em]",
    description: "text-[16px] leading-6 tracking-[0.006em]",
    copy: "gap-2",
    spacer: "h-7",
  },
  lg: {
    root: "max-w-[260px] gap-4",
    iconWrapper: "",
    iconArea: "size-12 rounded-[14px]",
    icon: "size-6",
    body: "gap-4",
    title: "text-[16px] leading-6 tracking-[0.006em]",
    description: "text-[14px] leading-5 tracking-[0.014em]",
    copy: "gap-1.5",
    spacer: "h-7",
  },
  md: {
    root: "max-w-[220px] gap-2",
    iconWrapper: "pb-1",
    iconArea: "size-10 rounded-[10px]",
    icon: "size-6",
    body: "gap-2",
    title: "text-[14px] leading-5 tracking-[0.014em]",
    description: "text-[14px] leading-5 tracking-[0.014em]",
    copy: "gap-1.5",
    spacer: "h-6",
  },
  sm: {
    root: "max-w-[220px] gap-2",
    iconWrapper: "",
    iconArea: "size-8 rounded-[10px]",
    icon: "size-4",
    body: "gap-2",
    title: "text-[14px] leading-5 tracking-[0.014em]",
    description: "text-[14px] leading-5 tracking-[0.014em]",
    copy: "gap-1.5",
    spacer: "h-6",
  },
};

const priorityClassName: Record<EmrEmptyStatePriority, string> = {
  supporting: "data-[priority=supporting]:text-[var(--emr-text-placeholder)]",
  "local-recovery": "data-[priority=local-recovery]:text-[var(--emr-text-secondary)]",
  "primary-decision": "data-[priority=primary-decision]:text-[var(--emr-text-primary)]",
};

function getDefaultDensity(surface: EmrEmptyStateSurface): EmrEmptyStateDensity {
  if (surface === "content" || surface === "global-shell") return "standard";
  if (surface === "table") return "table-row";

  return "compact";
}

function resolveSize(
  surface: EmrEmptyStateSurface,
  density?: EmrEmptyStateDensity,
  size?: EmrEmptyStateSize,
): EmrEmptyStateSize {
  if (size) return size;
  if (density === "table-row") return "md";
  if (density === "compact") return "sm";
  if (surface === "content" || surface === "global-shell") return "lg";

  return "sm";
}

/**
 * Shared empty-state surface for CLAiR EMR.
 *
 * Use EmrEmptyState when at least two EMR screen families share the same empty
 * layout contract. Keep feature actions, route changes, permission checks, and
 * persistence in the caller.
 *
 * @summary EMR empty-state component with state, surface, and CTA ownership props
 */
export function EmrEmptyState({
  align,
  className,
  density,
  description,
  eyebrow,
  icon,
  kind,
  primaryAction,
  priority = "supporting",
  reserveActionSpace = true,
  secondaryAction,
  size,
  surface,
  testId,
  title,
  ...props
}: EmrEmptyStateProps) {
  const resolvedDensity = density ?? getDefaultDensity(surface);
  const resolvedSize = resolveSize(surface, resolvedDensity, size);
  const sizeClasses = sizeClassName[resolvedSize];
  const resolvedAlign = align ?? "center";
  const hasActions = primaryAction || secondaryAction;
  const actionCount = Number(Boolean(primaryAction)) + Number(Boolean(secondaryAction));
  const showIcon = resolvedSize !== "sm" && icon !== false;
  const resolvedIcon = icon ?? (
    <DefaultEmptyStateIcon className={sizeClasses.icon} kind={kind} />
  );

  return (
    <section
      {...props}
      data-align={resolvedAlign}
      data-density={resolvedDensity}
      data-kind={kind}
      data-priority={priority}
      data-size={resolvedSize}
      data-surface={surface}
      data-action-count={actionCount}
      data-testid={testId}
      className={cn(
        "flex min-w-0 flex-col text-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150",
        sizeClasses.root,
        priorityClassName[priority],
        resolvedAlign === "center" && "items-center text-center",
        resolvedAlign === "start" && "items-start text-left",
        className,
      )}
    >
      {showIcon ? (
        <div
          className={cn("flex items-center", sizeClasses.iconWrapper)}
          aria-hidden="true"
          data-slot="icon-wrapper"
        >
          <div
            className={cn(
              "flex shrink-0 items-center justify-center overflow-hidden",
              resolvedSize === "xl"
                ? "bg-[var(--clair-color-atomic-neutral-200)] text-[var(--clair-color-atomic-black-alpha-64)]"
                : "bg-[var(--clair-color-atomic-black-alpha-4)] text-[var(--clair-color-atomic-black-alpha-48)]",
              sizeClasses.iconArea,
            )}
            data-slot="icon-area"
          >
            {resolvedSize === "xl" ? (
              <div
                className="flex size-full items-center justify-center rounded-[26px] border-2 border-[var(--clair-color-atomic-common-100)] bg-[linear-gradient(0deg,#FCFCFC_0%,#FAFAFA_81.7308%,#F8F8F8_100%)]"
                data-slot="icon-surface"
              >
                <div
                  className={cn("flex items-center justify-center", sizeClasses.icon)}
                  data-slot="icon"
                >
                  {resolvedIcon}
                </div>
              </div>
            ) : (
              <div
                className={cn("flex items-center justify-center", sizeClasses.icon)}
                data-slot="icon"
              >
                {resolvedIcon}
              </div>
            )}
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "flex min-w-0 flex-col",
          sizeClasses.body,
          resolvedAlign === "center" && "items-center text-center",
          resolvedAlign === "start" && "items-start text-left",
        )}
        data-slot="body"
      >
        <div
          className={cn(
            "flex min-w-0 flex-col",
            sizeClasses.copy,
            resolvedAlign === "center" && "items-center text-center",
            resolvedAlign === "start" && "items-start text-left",
          )}
          data-slot="copy"
        >
          {eyebrow ? (
            <div className="emr-text-metadata font-medium text-[var(--clair-color-atomic-black-alpha-36)]">
              {eyebrow}
            </div>
          ) : null}
          <h3
            className={cn(
              resolvedSize === "xl"
                ? "font-semibold text-[var(--clair-color-atomic-black-alpha-64)]"
                : "font-medium text-[var(--clair-color-atomic-black-alpha-48)]",
              sizeClasses.title,
            )}
          >
            {title}
          </h3>
          {description ? (
            <p
              className={cn(
                "[overflow-wrap:break-word] [text-wrap:pretty] [word-break:keep-all] text-[var(--clair-color-atomic-black-alpha-36)]",
                sizeClasses.description,
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {hasActions ? (
          <div
            className={cn(
              "flex items-center gap-2",
              resolvedSize === "xl" ? "flex-nowrap" : "flex-wrap",
              resolvedAlign === "center" && "justify-center",
              resolvedAlign === "start" && "justify-start",
            )}
            data-slot="actions"
          >
            {secondaryAction}
            {primaryAction}
          </div>
        ) : reserveActionSpace ? (
          <div
            aria-hidden="true"
            className={sizeClasses.spacer}
            data-slot="actions-spacer"
          />
        ) : null}
      </div>
    </section>
  );
}
