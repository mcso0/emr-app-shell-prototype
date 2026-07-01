"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import folderFileCloseMotionIcon from "../../../icons/motionIcon/Folder File close.json";
import folderFileRemoveMotionIcon from "../../../icons/motionIcon/folder-file-remove.json";
import folderFileSearchMotionIcon from "../../../icons/motionIcon/folder-file-search.json";
import folderFileMotionIcon from "../../../icons/motionIcon/folder-file.json";
import searchDocumentTextMotionIcon from "../../../icons/motionIcon/search-document-text.json";
import searchNotFoundMotionIcon from "../../../icons/motionIcon/search-not-found.json";
import { cn } from "@/lib/utils";

import { EmrMotionIcon } from "./motion-icon";

export type EmrEmptyStateKind =
  | "no-data"
  | "no-search-results"
  | "no-filter-results"
  | "no-scope-result"
  | "no-permission"
  | "upstream-pending";

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
  align?: EmrEmptyStateAlign;
  /**
   * Keeps the no-action variant optically aligned with action variants in
   * component-set previews. Keep false in cramped production surfaces unless
   * the surrounding layout needs equal-height placeholders.
   */
  reserveActionSpace?: boolean;
  testId?: string;
};

const motionIconByKind: Record<EmrEmptyStateKind, unknown> = {
  "no-data": folderFileCloseMotionIcon,
  "no-search-results": searchNotFoundMotionIcon,
  "no-filter-results": folderFileSearchMotionIcon,
  "no-scope-result": searchDocumentTextMotionIcon,
  "no-permission": folderFileRemoveMotionIcon,
  "upstream-pending": folderFileMotionIcon,
};

const densityClassName: Record<EmrEmptyStateDensity, string> = {
  compact: "max-w-[220px]",
  standard: "max-w-[260px]",
  "table-row": "max-w-[260px]",
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
  reserveActionSpace = false,
  secondaryAction,
  surface,
  testId,
  title,
  ...props
}: EmrEmptyStateProps) {
  const resolvedDensity = density ?? getDefaultDensity(surface);
  const resolvedAlign = align ?? "center";
  const hasActions = primaryAction || secondaryAction;

  return (
    <section
      {...props}
      data-align={resolvedAlign}
      data-density={resolvedDensity}
      data-kind={kind}
      data-priority={priority}
      data-surface={surface}
      data-testid={testId}
      className={cn(
        "flex min-w-0 flex-col gap-5 text-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150",
        densityClassName[resolvedDensity],
        priorityClassName[priority],
        resolvedAlign === "center" && "items-center text-center",
        resolvedAlign === "start" && "items-start text-left",
        className,
      )}
    >
      {icon !== false ? (
        <div
          className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-[rgba(0,0,0,0.04)] text-[rgba(0,0,0,0.48)]"
          aria-hidden="true"
          data-slot="icon-area"
        >
          <div className="flex size-8 items-center justify-center" data-slot="icon">
            {icon ?? (
              <EmrMotionIcon
                animationData={motionIconByKind[kind]}
                className="size-8 text-current [&_path]:!stroke-current"
                loop={false}
              />
            )}
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-4",
          resolvedAlign === "center" && "items-center text-center",
          resolvedAlign === "start" && "items-start text-left",
        )}
        data-slot="body"
      >
        <div
          className={cn(
            "flex min-w-0 flex-col gap-1.5",
            resolvedAlign === "center" && "items-center text-center",
            resolvedAlign === "start" && "items-start text-left",
          )}
          data-slot="copy"
        >
          {eyebrow ? (
            <div className="emr-text-metadata font-medium text-[rgba(0,0,0,0.36)]">
              {eyebrow}
            </div>
          ) : null}
          <h3 className="text-[16px] font-medium leading-6 tracking-[0.006em] text-[rgba(0,0,0,0.64)]">
            {title}
        </h3>
        {description ? (
          <p className="max-w-[220px] text-[14px] font-medium leading-5 tracking-[0.014em] text-[rgba(0,0,0,0.36)] [overflow-wrap:break-word] [text-wrap:pretty] [word-break:keep-all]">
            {description}
          </p>
        ) : null}
        </div>
        {hasActions ? (
          <div
            className={cn(
              "flex flex-wrap items-center gap-2",
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
            className="h-[var(--clair-control-height-xs)]"
            data-slot="actions-spacer"
          />
        ) : null}
      </div>
    </section>
  );
}
