import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmrProfileSidePanelShellProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  ariaLabel: string;
  children: ReactNode;
  dataTestId?: string;
};

export function EmrProfileSidePanelShell({
  ariaLabel,
  children,
  className,
  dataTestId,
  ...props
}: EmrProfileSidePanelShellProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--emr-surface-rightpanel)]",
        className,
      )}
      data-emr-profile-side-panel="true"
      data-testid={dataTestId}
      {...props}
    >
      {children}
    </section>
  );
}

export function EmrProfileSidePanelHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "shrink-0 border-b border-[var(--emr-border-default)] bg-[var(--emr-surface-rightpanel)]",
        className,
      )}
    >
      {children}
    </header>
  );
}

export function EmrProfileSidePanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto", className)}>{children}</div>;
}

export function EmrProfileSidePanelFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <footer
      className={cn(
        "shrink-0 border-t border-[var(--emr-border-default)] bg-[var(--emr-surface-rightpanel)] p-4",
        className,
      )}
    >
      {children}
    </footer>
  );
}
