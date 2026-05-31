"use client";

import {
  createContext,
  useContext,
  type ComponentProps,
  type ReactNode,
} from "react";

import { CheckIcon, CloseIcon } from "@/components/icons";
import { EmrIconButton } from "@/components/emr/icon-button";
import { PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type EmrPopoverWidth = "anchor" | "sm" | "md" | "lg";
type EmrPopoverDensity = "compact" | "default";
type EmrPopoverSelectionMode = "none" | "single" | "multiple";

type EmrPopoverShellProps = ComponentProps<typeof PopoverContent> & {
  bodyClassName?: string;
  bodyScroll?: boolean;
  children: ReactNode;
  closeLabel?: string;
  density?: EmrPopoverDensity;
  description?: ReactNode;
  footer?: ReactNode;
  headerClassName?: string;
  meta?: ReactNode;
  onClose?: () => void;
  showClose?: boolean;
  title?: ReactNode;
  width?: EmrPopoverWidth;
};

const widthClassName: Record<EmrPopoverWidth, string> = {
  anchor: "w-[var(--anchor-width)]",
  sm: "w-[236px]",
  md: "w-[280px]",
  lg: "w-[360px]",
};

const densityClassName: Record<EmrPopoverDensity, string> = {
  compact: "text-xs",
  default: "text-sm",
};

function EmrPopoverShell({
  bodyClassName,
  bodyScroll = false,
  children,
  className,
  closeLabel,
  density = "default",
  description,
  footer,
  headerClassName,
  meta,
  onClose,
  showClose,
  title,
  width = "md",
  ...props
}: EmrPopoverShellProps) {
  const hasHeader = Boolean(title || description || meta || showClose || onClose);

  return (
    <PopoverContent
      className={cn(
        "gap-0 overflow-hidden rounded-lg border-[var(--emr-line-default)] bg-popover p-0 shadow-[var(--clair-shadow-md)] ring-1 ring-foreground/10",
        widthClassName[width],
        densityClassName[density],
        className
      )}
      {...props}
    >
      {hasHeader ? (
        <EmrPopoverHeader
          title={title}
          description={description}
          meta={meta}
          closeLabel={closeLabel}
          showClose={showClose}
          onClose={onClose}
          className={headerClassName}
        />
      ) : null}
      <EmrPopoverBody scroll={bodyScroll} className={bodyClassName}>
        {children}
      </EmrPopoverBody>
      {footer ? <EmrPopoverFooter>{footer}</EmrPopoverFooter> : null}
    </PopoverContent>
  );
}

function EmrPopoverHeader({
  className,
  closeLabel = "닫기",
  description,
  meta,
  onClose,
  showClose,
  title,
}: {
  className?: string;
  closeLabel?: string;
  description?: ReactNode;
  meta?: ReactNode;
  onClose?: () => void;
  showClose?: boolean;
  title?: ReactNode;
}) {
  return (
    <div
      data-slot="emr-popover-header"
      className={cn("flex flex-col gap-1 px-3 py-3", className)}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? (
            <div className="truncate emr-text-dense font-bold text-foreground">
              {title}
            </div>
          ) : null}
          {meta ? (
            <div className="mt-0.5 truncate emr-text-metadata text-muted-foreground">
              {meta}
            </div>
          ) : null}
        </div>
        {showClose || onClose ? (
          <EmrIconButton
            type="button"
            aria-label={closeLabel}
            className="-mr-1 -mt-1"
            onClick={onClose}
          >
            <CloseIcon />
          </EmrIconButton>
        ) : null}
      </div>
      {description ? (
        <div className="emr-text-metadata text-muted-foreground">
          {description}
        </div>
      ) : null}
    </div>
  );
}

function EmrPopoverBody({
  className,
  scroll = false,
  ...props
}: ComponentProps<"div"> & { scroll?: boolean }) {
  return (
    <div
      data-slot="emr-popover-body"
      className={cn(
        "grid gap-2 px-3 pb-3",
        scroll && "max-h-72 overflow-y-auto",
        className
      )}
      {...props}
    />
  );
}

function EmrPopoverFooter({
  className,
  left,
  right,
  children,
  ...props
}: ComponentProps<"div"> & {
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      data-slot="emr-popover-footer"
      className={cn(
        "flex items-center justify-between gap-2 border-t border-[var(--emr-line-default)] px-3 py-2.5",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <div className="flex min-w-0 items-center gap-2">{left}</div>
          <div className="flex shrink-0 items-center gap-2">{right}</div>
        </>
      )}
    </div>
  );
}

type EmrPopoverOptionGroupContextValue = {
  closeOnSelect: boolean;
  onRequestClose?: () => void;
  selectionMode: EmrPopoverSelectionMode;
};

const EmrPopoverOptionGroupContext =
  createContext<EmrPopoverOptionGroupContextValue | null>(null);

function EmrPopoverOptionGroup({
  children,
  className,
  closeOnSelect,
  onRequestClose,
  selectionMode = "single",
  ...props
}: ComponentProps<"div"> & {
  closeOnSelect?: boolean;
  onRequestClose?: () => void;
  selectionMode?: EmrPopoverSelectionMode;
}) {
  const resolvedCloseOnSelect =
    closeOnSelect ?? selectionMode === "single";

  return (
    <EmrPopoverOptionGroupContext.Provider
      value={{
        closeOnSelect: resolvedCloseOnSelect,
        onRequestClose,
        selectionMode,
      }}
    >
      <div
        data-slot="emr-popover-option-group"
        data-selection-mode={selectionMode}
        role={selectionMode === "single" ? "radiogroup" : "group"}
        className={cn("grid gap-1.5", className)}
        {...props}
      >
        {children}
      </div>
    </EmrPopoverOptionGroupContext.Provider>
  );
}

function EmrPopoverOption({
  children,
  className,
  description,
  disabled = false,
  meta,
  onSelect,
  selected = false,
  selection,
  title,
  value,
  ...props
}: Omit<ComponentProps<"button">, "children" | "disabled" | "onSelect" | "title" | "value"> & {
  children?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  meta?: ReactNode;
  onSelect?: (value?: string) => void;
  selected?: boolean;
  selection?: "none" | "radio" | "checkbox";
  title?: ReactNode;
  value?: string;
}) {
  const group = useContext(EmrPopoverOptionGroupContext);
  const resolvedSelection =
    selection ??
    (group?.selectionMode === "multiple"
      ? "checkbox"
      : group?.selectionMode === "single"
        ? "radio"
        : "none");
  const role =
    resolvedSelection === "radio"
      ? "radio"
      : resolvedSelection === "checkbox"
        ? "checkbox"
        : undefined;

  return (
    <button
      type="button"
      data-slot="emr-popover-option"
      data-selected={selected || undefined}
      disabled={disabled}
      role={role}
      aria-checked={role ? selected : undefined}
      className={cn(
        "flex w-full items-start gap-2 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-[var(--emr-state-hover)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        selected && "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)]",
        className
      )}
      onClick={() => {
        onSelect?.(value);

        if (group?.closeOnSelect) {
          group.onRequestClose?.();
        }
      }}
      {...props}
    >
      {resolvedSelection !== "none" ? (
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex size-4 shrink-0 items-center justify-center border border-[var(--emr-line-default)] text-[10px] text-primary-foreground",
            resolvedSelection === "radio" ? "rounded-full" : "rounded-[4px]",
            selected && "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected-border)]"
          )}
        >
          {selected ? (
            resolvedSelection === "radio" ? (
              <span className="size-2 rounded-full bg-current" />
            ) : (
              <CheckIcon className="size-3" />
            )
          ) : null}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        {children ?? (
          <>
            <span className="block emr-text-dense font-semibold text-foreground">
              {title}
            </span>
            {description ? (
              <span className="mt-0.5 block emr-text-metadata text-muted-foreground">
                {description}
              </span>
            ) : null}
          </>
        )}
      </span>
      {meta ? (
        <span className="shrink-0 emr-text-metadata text-muted-foreground">
          {meta}
        </span>
      ) : null}
    </button>
  );
}

function EmrPopoverFieldRow({
  children,
  className,
  label,
  required,
  unit,
}: {
  children: ReactNode;
  className?: string;
  label: ReactNode;
  required?: boolean;
  unit?: ReactNode;
}) {
  return (
    <label
      data-slot="emr-popover-field-row"
      className={cn("grid grid-cols-[68px_minmax(0,1fr)] items-center gap-2", className)}
    >
      <span className="emr-text-metadata font-semibold text-[var(--emr-text-secondary)]">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </span>
      <span className="relative min-w-0">
        {children}
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center emr-text-metadata text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export {
  EmrPopoverBody,
  EmrPopoverFieldRow,
  EmrPopoverFooter,
  EmrPopoverHeader,
  EmrPopoverOption,
  EmrPopoverOptionGroup,
  EmrPopoverShell,
};
