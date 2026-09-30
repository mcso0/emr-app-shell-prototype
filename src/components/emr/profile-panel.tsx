"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tab, TabGroup, TabPanel, TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EmrEmptyState } from "./empty-state";
import { EmrInlineAlert } from "./inline-alert";
import { EmrRightPanel } from "./right-panel";

type ProfileTab = { value: string; label: string; disabledReason?: string };

type EmrProfilePanelProps = ComponentPropsWithoutRef<"section"> & {
  closeLabel: string;
  headerActions?: ReactNode;
  identity: ReactNode;
  loading?: boolean;
  onClose: () => void;
  onTabChange: (value: string) => void;
  tabs: ProfileTab[];
  tabsLabel: string;
  value: string;
};

/** Shared presentation only. Features own reads, permissions, edits and navigation. */
export function EmrProfilePanel({
  children,
  className,
  closeLabel,
  headerActions,
  identity,
  loading = false,
  onClose,
  onTabChange,
  tabs,
  tabsLabel,
  value,
  ...props
}: EmrProfilePanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!openerRef.current && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
    closeRef.current?.focus();
  }, []);

  const close = useCallback(() => {
    onClose();
    window.requestAnimationFrame(() => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
    });
  }, [onClose]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Inner editors, menus and dialogs get first refusal on Escape.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  return (
    <section
      data-slot="emr-profile-panel"
      data-header-actions={headerActions ? "true" : undefined}
      className={cn(
        "group/profile-panel h-full min-h-0 overflow-hidden overscroll-x-none touch-pan-y bg-[var(--emr-surface-rightpanel)] text-[var(--emr-text-primary)]",
        className,
      )}
      {...props}
    >
      <TabGroup
        value={value}
        onValueChange={(next) => {
          if (
            typeof next === "string" &&
            tabs.some((tab) => tab.value === next && !tab.disabledReason)
          )
            onTabChange(next);
        }}
        className="h-full min-h-0 gap-0"
      >
        <EmrRightPanel
          header={
            <header
              data-slot="emr-profile-header"
              className="relative h-[var(--emr-profile-header-height)] shrink-0 border-b border-[var(--emr-border-default)] px-4 pt-4"
            >
              {loading ? <EmrProfileIdentitySkeleton /> : identity}
              <div className="absolute right-3.5 top-3.5 flex items-center gap-1">
                {!loading ? headerActions : null}
                <Button
                  ref={closeRef}
                  aria-label={closeLabel}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-[var(--clair-radius-atomic-8)] text-[var(--clair-color-atomic-neutral-700)]"
                  onClick={close}
                >
                  <CdsActionsXIcon aria-hidden="true" className="size-4" size={16} />
                </Button>
              </div>
              <TabsList
                activateOnFocus
                aria-label={tabsLabel}
                variant="line"
                className="absolute bottom-0 left-4 right-4 group-data-horizontal/tabs:h-[34px] max-w-[calc(100%-32px)] gap-2 overflow-x-auto p-0"
                onKeyDown={(event) => {
                  if (
                    !tabs.some((tab) => tab.disabledReason) ||
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  const enabledTabs = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>(
                      '[role="tab"]:not([aria-disabled="true"])',
                    ),
                  );
                  if (!enabledTabs.length) return;
                  const current = enabledTabs.indexOf(
                    document.activeElement as HTMLButtonElement,
                  );
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? enabledTabs.length - 1
                        : (current +
                            (event.key === "ArrowRight" ? 1 : -1) +
                            enabledTabs.length) %
                          enabledTabs.length;
                  event.preventDefault();
                  event.preventBaseUIHandler();
                  enabledTabs[next]?.focus();
                }}
              >
                {tabs.map((tab) => (
                  <Tab
                    key={tab.value}
                    value={tab.value}
                    disabled={Boolean(tab.disabledReason)}
                    aria-label={
                      tab.disabledReason
                        ? `${tab.label}, ${tab.disabledReason}`
                        : undefined
                    }
                    title={tab.disabledReason}
                    className="h-7 flex-none self-start px-2 group-data-horizontal/tabs:after:bottom-[-6px] group-data-horizontal/tabs:after:h-px"
                  >
                    {tab.label}
                  </Tab>
                ))}
              </TabsList>
            </header>
          }
        >
          {children}
        </EmrRightPanel>
      </TabGroup>
    </section>
  );
}

export function EmrProfileIdentity({
  avatar,
  name,
  badge,
  description,
  detail,
}: {
  avatar: ReactNode;
  name: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div
      data-slot="emr-profile-identity"
      className="flex h-[var(--emr-profile-avatar-size)] min-w-0 items-start gap-2.5"
    >
      <div className="size-[var(--emr-profile-avatar-size)] shrink-0">
        {avatar}
      </div>
      <div className="flex h-full min-w-0 flex-1 flex-col gap-1">
        <div className="flex h-7 min-w-0 items-center gap-2 pl-1.5 pr-8 group-data-[header-actions=true]/profile-panel:pr-[60px]">
          <h2 className="min-w-0 truncate text-xl font-semibold leading-7 tracking-[-0.015em]">
            {name}
          </h2>
          {badge}
        </div>
        <div className="flex h-7 min-w-0 items-center pl-1.5 text-sm font-medium text-[var(--emr-text-secondary)]">
          {description}
        </div>
        <div className="flex h-5 min-w-0 items-center pl-1.5 text-sm font-medium text-[var(--emr-text-tertiary)]">
          {detail}
        </div>
      </div>
    </div>
  );
}

function EmrProfileIdentitySkeleton() {
  return (
    <EmrProfileIdentity
      avatar={<Skeleton className="size-full rounded-md" />}
      name={<Skeleton className="h-7 w-28" />}
      description={<Skeleton className="h-6 w-full" />}
      detail={<Skeleton className="h-5 w-24" />}
    />
  );
}

export function EmrProfileTabPanel(
  props: ComponentPropsWithoutRef<typeof TabPanel>,
) {
  return (
    <TabPanel
      {...props}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden overscroll-x-none touch-pan-y",
        props.className,
      )}
    />
  );
}

export function EmrProfilePanelBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <ScrollArea
      className={cn("min-h-0 flex-1 overflow-hidden", className)}
      viewportClassName="scroll-fade-y scroll-fade-8"
      viewportStyle={{
        overflowX: "hidden",
        overscrollBehaviorX: "none",
        touchAction: "pan-y",
      }}
    >
      {children}
    </ScrollArea>
  );
}

export function EmrProfilePanelLoading({
  label = "프로필 정보를 불러오는 중입니다.",
  testId,
}: {
  label?: string;
  testId?: string;
}) {
  return (
    <div
      data-slot="emr-profile-loading"
      data-testid={testId}
      aria-live="polite"
      className="space-y-4 p-2"
    >
      <span className="sr-only">{label}</span>
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-[70px] w-full rounded-xl" />
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-[70px] w-full rounded-xl" />
    </div>
  );
}

export function EmrProfilePanelState({
  state,
  label,
  description,
  onRetry,
}: {
  state: "idle" | "loading" | "error" | "denied" | "not_found" | "empty";
  label: string;
  description?: ReactNode;
  onRetry?: () => void;
}) {
  if (state === "idle" || state === "loading")
    return <EmrProfilePanelLoading label={label} />;
  if (state === "error")
    return (
      <div className="p-2">
        <EmrInlineAlert
          severity="error"
          title={label}
          action={
            onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry}>
                다시 시도
              </Button>
            ) : undefined
          }
        >
          {description}
        </EmrInlineAlert>
      </div>
    );
  return (
    <EmrEmptyState
      kind={state === "denied" ? "no-permission" : "no-data"}
      surface="drawer"
      title={label}
      description={description}
      size="sm"
      reserveActionSpace={false}
      className="mx-auto py-8"
    />
  );
}
