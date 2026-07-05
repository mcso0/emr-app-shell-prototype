"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarIcon,
  ClockIcon,
  CommandIcon,
  CreditCardIcon,
  SearchIcon,
  StethoscopeIcon,
  UserIcon,
} from "@/components/icons";
import { CdsActionsSearchIcon } from "@/components/cds-icons/actions-and-controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SegmentedControl, type SegmentedControlItem } from "@/components/ui/segmented-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NewUnifiedRegistrationButton } from "@/features/reception/profile-drawer";
import { useMockAuthStore } from "@/features/auth/session-store";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import {
  shouldRunCommandSearch,
} from "@/features/command/command-search";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { AppIcon } from "@/components/icons";
import type {
  CommandSearchFilter,
  CommandSearchResponse,
  CommandSearchResult,
  CommandSearchSourceState,
} from "@/features/command/command-search";
import type { EmrId } from "@/types/emr-domain";

type CommandItemKind = "action" | "patient" | "guardian" | "appointment" | "encounter" | "staff";
type CommandFilter = CommandSearchFilter;
type CommandAction = "open-new-reception" | "open-patient-guardian-registration";

type CommandItem = {
  action?: CommandAction;
  searchResult?: CommandSearchResult;
  id: string;
  kind: CommandItemKind;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  icon: AppIcon;
  keywords: string[];
  filterKeywords?: Partial<Record<CommandFilter, string[]>>;
};

type CommandSection = {
  id: string;
  title: string;
  items: CommandItem[];
};

type CommandSearchClientState =
  | { status: "idle"; results: CommandSearchResult[]; sourceState?: CommandSearchSourceState }
  | { status: "loading"; results: CommandSearchResult[]; sourceState?: CommandSearchSourceState }
  | { status: "ready"; results: CommandSearchResult[]; sourceState: CommandSearchSourceState }
  | { status: "error"; results: CommandSearchResult[]; sourceState?: CommandSearchSourceState };

const MAX_ITEMS_PER_SECTION = 6;
const COMMAND_SEARCH_DEBOUNCE_MS = 180;
const COMMAND_DIALOG_CLASS_NAME =
  "h-[min(680px,calc(100vh-120px))] w-[min(720px,calc(100vw-32px))] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[12px] border border-[var(--emr-line-subtle)] bg-card p-0 shadow-[var(--clair-shadow-xl)] sm:max-w-[720px]";
const COMMAND_RESULT_ROW_CLASS_NAME =
  "grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50";
const COMMAND_RESULT_ICON_CLASS_NAME =
  "flex size-8 items-center justify-center rounded-[8px] bg-[var(--emr-state-hover)] text-muted-foreground";
const COMMAND_RESULT_BADGE_CLASS_NAME =
  "inline-flex max-w-[120px] items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] leading-4 text-muted-foreground";

const commandFilterItems: Array<SegmentedControlItem<CommandFilter>> = [
  { value: "all", label: "전체" },
  { value: "patient", label: "동물" },
  { value: "guardian", label: "보호자" },
  { value: "phone", label: "전화번호" },
  { value: "chart", label: "차트 번호" },
  { value: "vet", label: "수의사" },
  { value: "technician", label: "테크니션" },
  { value: "desk", label: "데스크" },
];

const quickActionSpecs = [
  {
    id: "new-reception",
    action: "open-new-reception",
    title: "신규 진료 접수",
    subtitle: "접수/예약 화면에서 새 내원 접수를 시작합니다.",
    badge: "Action",
    icon: CalendarIcon,
    moduleId: "reception",
    keywords: ["진료 접수", "신규 접수", "예약", "데스크"],
  },
  {
    id: "register-patient",
    action: "open-patient-guardian-registration",
    title: "환자/보호자 등록",
    subtitle: "신규 보호자 또는 환자 master data를 등록합니다.",
    badge: "Action",
    icon: UserIcon,
    moduleId: "reception",
    keywords: ["환자 등록", "보호자 등록", "신규 동물", "고객"],
  },
  {
    id: "today-appointments",
    title: "오늘 예약 보기",
    subtitle: "접수/예약 캘린더와 대기 목록을 엽니다.",
    badge: "View",
    icon: ClockIcon,
    moduleId: "reception",
    keywords: ["오늘", "예약", "대기", "스케줄"],
  },
  {
    id: "billing-queue",
    title: "수납 대기 확인",
    subtitle: "미수/수납 대기 업무를 확인합니다.",
    badge: "View",
    icon: CreditCardIcon,
    moduleId: "billing",
    keywords: ["수납", "미수", "결제", "청구"],
  },
  {
    id: "chart-queue",
    title: "진료 대기열 열기",
    subtitle: "수의사 진료/차트 업무 화면으로 이동합니다.",
    badge: "View",
    icon: StethoscopeIcon,
    moduleId: "treatment",
    keywords: ["진료", "차트", "SOAP", "대기열"],
  },
] as const;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function createHref(workspaceId: string, moduleId: string, params?: Record<string, string>) {
  const searchParams = new URLSearchParams({ modulePanel: "open", ...(params ?? {}) });
  return `/w/${workspaceId}/${moduleId}?${searchParams.toString()}`;
}

function getSearchResultIcon(kind: CommandSearchResult["kind"]) {
  if (kind === "appointment") return CalendarIcon;
  if (kind === "encounter") return ClockIcon;
  return UserIcon;
}

function buildSearchResultItem(result: CommandSearchResult): CommandItem {
  return {
    id: result.id,
    kind: result.kind,
    title: result.title,
    subtitle: result.subtitle,
    href: result.href,
    badge: result.badge,
    icon: getSearchResultIcon(result.kind),
    keywords: [result.title, result.subtitle, result.badge].filter(Boolean) as string[],
    searchResult: result,
  };
}

function buildCommandSections(
  workspaceId: string,
  query: string,
  filter: CommandFilter,
  searchResults: CommandSearchResult[],
): CommandSection[] {
  const normalizedQuery = normalizeText(query);
  const matchesFilter = (item: CommandItem) => {
    if (filter === "all") return true;
    const filterKeywords = item.filterKeywords?.[filter] ?? [];
    return filterKeywords.length > 0;
  };
  const matchesQuery = (item: CommandItem) => {
    if (!normalizedQuery) return true;
    const scopedKeywords = filter === "all" ? item.keywords : item.filterKeywords?.[filter] ?? [];
    return normalizeText([item.title, item.subtitle, item.badge, ...scopedKeywords].join(" ")).includes(normalizedQuery);
  };
  const limitItems = (items: CommandItem[], defaultLimit = 4) =>
    items.filter((item) => matchesFilter(item) && matchesQuery(item)).slice(0, normalizedQuery ? MAX_ITEMS_PER_SECTION : defaultLimit);
  const quickActions: CommandItem[] = quickActionSpecs.map((action) => ({
    id: `action-${action.id}`,
    action: "action" in action ? action.action : undefined,
    kind: "action",
    title: action.title,
    subtitle: action.subtitle,
    href: createHref(
      workspaceId,
      action.moduleId,
      action.id === "today-appointments"
        ? { date: getWorkspaceOperatingDate(workspaceId) }
        : undefined,
    ),
    badge: action.badge,
    icon: action.icon,
    keywords: [...action.keywords, action.title, action.subtitle],
    filterKeywords: {
      desk: action.moduleId === "reception" ? [...action.keywords, action.title, action.subtitle] : [],
      vet: action.moduleId === "treatment" ? [...action.keywords, action.title, action.subtitle] : [],
    },
  }));
  const resultItems = searchResults.map(buildSearchResultItem);
  const patientGuardianItems = resultItems.filter(
    (item) => item.kind === "patient" || item.kind === "guardian",
  );
  const receptionItems = resultItems.filter(
    (item) => item.kind === "appointment" || item.kind === "encounter",
  );
  const staffItems = resultItems.filter((item) => item.kind === "staff");
  const sections: CommandSection[] = [
    { id: "actions", title: "빠른 실행", items: limitItems(quickActions, 5) },
    {
      id: "people",
      title: "환자/보호자",
      items: limitItems(patientGuardianItems, normalizedQuery ? 6 : 4),
    },
    {
      id: "staff",
      title: "병원 구성원",
      items: limitItems(staffItems, 6),
    },
    {
      id: "today",
      title: normalizedQuery ? "예약/접수" : "오늘 업무",
      items: limitItems(receptionItems, 6),
    },
  ];

  return sections.filter((section) => section.items.length > 0);
}

function flattenSections(sections: CommandSection[]) {
  return sections.flatMap((section) => section.items);
}

export function GlobalCommandPalette({
  triggerVariant = "wide",
  tooltipSideOffset = 16,
  workspaceId,
}: {
  tooltipSideOffset?: number;
  triggerVariant?: "wide" | "icon" | "rail";
  workspaceId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const authSession = useMockAuthStore((state) => state.session);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<CommandFilter>("all");
  const [searchState, setSearchState] = useState<CommandSearchClientState>({
    status: "idle",
    results: [],
  });
  const applyPatientGuardianLookupItem = usePatientProfileStore(
    (state) => state.applyPatientGuardianLookupItem,
  );
  const sections = useMemo(
    () => buildCommandSections(workspaceId, query, activeFilter, searchState.results),
    [activeFilter, query, searchState.results, workspaceId],
  );
  const flattenedItems = useMemo(() => flattenSections(sections), [sections]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [registrationOpenRequestKey, setRegistrationOpenRequestKey] = useState(0);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const queryCanSearch = shouldRunCommandSearch(query);
  const hasDynamicResults = searchState.results.length > 0;
  const sourceState = searchState.sourceState;
  const hasPartialIssue = Boolean(
    sourceState &&
      (sourceState.patientGuardian === "error" ||
        sourceState.patientGuardian === "permission_denied" ||
        sourceState.reception === "error" ||
        sourceState.reception === "permission_denied" ||
        sourceState.staff === "error" ||
        sourceState.staff === "permission_denied"),
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) return;

    const focusTimer = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open || !queryCanSearch) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setSearchState((current) => ({
        status: "loading",
        results: current.results,
        sourceState: current.sourceState,
      }));

      async function loadCommandSearch() {
        try {
          const params = new URLSearchParams({
            query: query.trim(),
            filter: activeFilter,
          });
          const headers = authSession?.id
            ? { "x-clair-demo-session-user-id": authSession.id }
            : undefined;
          const response = await fetch(
            `/api/workspaces/${encodeURIComponent(workspaceId)}/command/search?${params.toString()}`,
            {
              cache: "no-store",
              headers,
              signal: controller.signal,
            },
          );
          const result = (await response.json()) as CommandSearchResponse;

          if (cancelled) return;

          if (!response.ok || !result.ok) {
            setSearchState({ status: "error", results: [] });
            return;
          }

          setSearchState({
            status: "ready",
            results: result.results,
            sourceState: result.sourceState,
          });
        } catch (error) {
          if (
            !cancelled &&
            !(error instanceof DOMException && error.name === "AbortError")
          ) {
            setSearchState({ status: "error", results: [] });
          }
        }
      }

      void loadCommandSearch();
    }, COMMAND_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeFilter, authSession?.id, open, query, queryCanSearch, workspaceId]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setActiveFilter("all");
      setActiveIndex(0);
      setSearchState({ status: "idle", results: [] });
    }
  };

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setActiveIndex(0);
    if (!shouldRunCommandSearch(nextQuery)) {
      setSearchState({ status: "idle", results: [] });
      return;
    }
    setSearchState((current) => ({
      status: "loading",
      results: current.results,
      sourceState: current.sourceState,
    }));
  };

  const handleFilterChange = (nextFilter: CommandFilter) => {
    setActiveFilter(nextFilter);
    setActiveIndex(0);
    if (queryCanSearch) {
      setSearchState((current) => ({
        status: "loading",
        results: current.results,
        sourceState: current.sourceState,
      }));
    }
  };

  const handleRegisteredPatientReady = (patientId: EmrId) => {
    router.push(
      createHref(workspaceId, "reception", {
        drawer: `reception-form:walk-in:${patientId}`,
        patientId,
      }),
      { scroll: false }
    );
  };

  const runCommand = (item: CommandItem) => {
    handleOpenChange(false);
    if (item.searchResult?.lookupItem) {
      applyPatientGuardianLookupItem(item.searchResult.lookupItem);
    }

    if (item.action === "open-new-reception") {
      setActiveDrawer({ type: "reception-form", id: "walk-in" });
      return;
    }

    if (item.action === "open-patient-guardian-registration") {
      setRegistrationOpenRequestKey((current) => current + 1);
      return;
    }

    router.push(item.href, { scroll: false });
  };

  const moveActiveIndex = (direction: 1 | -1) => {
    if (!flattenedItems.length) return;

    setActiveIndex((current) => {
      if (current < 0) return direction === 1 ? 0 : flattenedItems.length - 1;
      return (current + direction + flattenedItems.length) % flattenedItems.length;
    });
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveIndex(1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveIndex(-1);
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const item = flattenedItems[activeIndex];
      if (item) runCommand(item);
    }
  };

  const triggerButton = (
    <Button
        type="button"
        variant="ghost"
        size={triggerVariant === "wide" ? "default" : "icon"}
        className={cn(
          triggerVariant === "icon"
            ? "justify-center rounded-[var(--emr-radius-control)] border-[var(--emr-line-default)] bg-card px-0 text-muted-foreground shadow-[var(--clair-shadow-xs)] hover:border-[var(--emr-line-strong)] hover:bg-[var(--emr-state-hover)] hover:text-foreground hover:shadow-[var(--clair-shadow-sm)] active:shadow-none focus-visible:ring-ring/40"
            : "mx-auto h-8 w-[min(560px,45vw)] min-w-8 rounded-lg border-border bg-card px-3 text-left shadow-sm hover:border-[var(--emr-line-strong)] hover:bg-card focus-visible:ring-ring/40 max-sm:w-8 max-sm:px-2",
          triggerVariant === "rail" &&
            "mx-0 size-[var(--emr-navrail-item-size)] min-w-0 justify-center rounded-[var(--emr-navrail-item-radius)] border-0 bg-transparent p-[var(--emr-navrail-item-padding)] text-[var(--emr-navrail-icon)] shadow-none hover:bg-[var(--emr-navrail-item-hover)] hover:text-[var(--emr-navrail-icon-hover)] hover:shadow-none active:bg-[var(--emr-navrail-item-selected)] active:text-[var(--emr-navrail-icon-selected)] focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
        aria-label="전역 통합 검색 열기"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {triggerVariant === "wide" ? (
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <CdsActionsSearchIcon
            size={triggerVariant === "rail" ? 24 : 16}
            className={cn(
              "size-4 shrink-0",
              triggerVariant === "rail" ? "size-[var(--emr-navrail-icon-frame-size)] text-current" : "text-muted-foreground"
            )}
            aria-hidden="true"
          />
        )}
        {triggerVariant === "wide" ? (
          <>
            <span className="min-w-0 flex-1 truncate px-2 text-[12px] text-muted-foreground max-sm:hidden">
              동물/보호자/구성원 검색
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground max-sm:hidden">
              <CommandIcon className="size-3" aria-hidden="true" />
              K
            </span>
          </>
        ) : null}
      </Button>
  );

  return (
    <>
      {triggerVariant === "rail" ? (
        <Tooltip>
          <TooltipTrigger render={triggerButton} />
          <TooltipContent side="right" sideOffset={tooltipSideOffset}>
            통합 검색
          </TooltipContent>
        </Tooltip>
      ) : (
        triggerButton
      )}
      <NewUnifiedRegistrationButton
        openRequestKey={registrationOpenRequestKey}
        renderTrigger={false}
        onPatientReady={handleRegisteredPatientReady}
      />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={COMMAND_DIALOG_CLASS_NAME}
          overlayClassName="bg-transparent backdrop-blur-none [-webkit-backdrop-filter:none] [backdrop-filter:none] supports-backdrop-filter:backdrop-blur-none"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">통합 검색과 빠른 실행</DialogTitle>
          <DialogDescription className="sr-only">
            환자, 보호자, 병원 구성원, 예약, 접수와 주요 업무 화면을 검색하고 실행합니다.
          </DialogDescription>
          <div className="flex h-13 items-center gap-2 border-b px-4">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={handleInputKeyDown}
              aria-label="통합 검색"
              placeholder="동물명, 보호자명, 구성원명, 전화번호, 차트번호 검색"
              className="h-12 border-0 bg-transparent px-0 text-[15px] shadow-none focus-visible:ring-0 md:text-[15px]"
            />
            <kbd className="rounded border border-border bg-muted px-1.5 py-1 text-[11px] font-medium leading-none text-muted-foreground">
              Esc
            </kbd>
          </div>
          <div className="px-4 py-2">
            <SegmentedControl
              value={activeFilter}
              items={commandFilterItems}
              aria-label="검색 필터"
              className="max-w-full gap-1.5 overflow-x-auto"
              itemClassName="h-6 min-h-6 rounded-full px-2.5 py-0 text-[12px] font-medium leading-4 tracking-normal aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              onValueChange={handleFilterChange}
            />
          </div>
          <div className="min-h-0 overflow-y-auto px-2 py-2" role="listbox" aria-label="통합 검색 결과">
            {searchState.status === "loading" ? (
              <div className="mx-2 mb-1 rounded-[8px] border border-[var(--emr-line-hairline)] bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">
                검색 중
              </div>
            ) : null}
            {searchState.status === "error" ? (
              <div className="mx-2 mb-1 rounded-[8px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive">
                검색 결과를 불러오지 못했어.
              </div>
            ) : null}
            {hasPartialIssue && searchState.status === "ready" ? (
              <div className="mx-2 mb-1 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
                일부 결과를 불러오지 못했어.
              </div>
            ) : null}
            {sections.length ? (
              <>
                {sections.map((section, sectionIndex) => (
                  <div key={section.id}>
                    <CommandSectionView
                      activeIndex={activeIndex}
                      flattenedItems={flattenedItems}
                      section={section}
                      onRunCommand={runCommand}
                      onSetActiveIndex={setActiveIndex}
                    />
                    {sectionIndex < sections.length - 1 ? <Separator className="my-1" /> : null}
                  </div>
                ))}
                {queryCanSearch && searchState.status === "ready" && !hasDynamicResults ? (
                  <div className="flex min-h-28 flex-col items-center justify-center gap-2 px-6 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <SearchIcon className="size-4" aria-hidden="true" />
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      검색 결과가 없습니다.
                    </div>
                    <div className="text-xs text-muted-foreground">
                      동물명, 보호자명, 구성원명, 전화번호 또는 차트번호로 다시 검색해 주세요.
                    </div>
                  </div>
                ) : null}
              </>
            ) : searchState.status === "loading" ? null : (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <SearchIcon className="size-4" aria-hidden="true" />
                </div>
                <div className="text-sm font-medium text-foreground">
                  검색 결과가 없습니다.
                </div>
                <div className="text-xs text-muted-foreground">
                  동물명, 보호자명, 구성원명, 전화번호 또는 차트번호로 다시 검색해 주세요.
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t bg-muted/50 px-4 py-2 text-[11px] text-muted-foreground">
            <span>Enter 실행</span>
            <span>↑↓ 이동</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CommandSectionView({
  activeIndex,
  flattenedItems,
  section,
  onRunCommand,
  onSetActiveIndex,
}: {
  activeIndex: number;
  flattenedItems: CommandItem[];
  section: CommandSection;
  onRunCommand: (item: CommandItem) => void;
  onSetActiveIndex: (index: number) => void;
}) {
  return (
    <section className="py-1">
      <div className="px-2 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">
        {section.title}
      </div>
      <div className="space-y-0.5">
        {section.items.map((item) => {
          const itemIndex = flattenedItems.findIndex((flattenedItem) => flattenedItem.id === item.id);
          const Icon = item.icon;
          const active = itemIndex === activeIndex;

          return (
            <button
              key={item.id}
              id={`command-result-${item.id}`}
              type="button"
              className={cn(
                COMMAND_RESULT_ROW_CLASS_NAME,
                active
                  ? "bg-muted text-foreground"
                  : "text-[var(--emr-text-secondary)] hover:bg-muted/50"
              )}
              data-active={active || undefined}
              onClick={() => onRunCommand(item)}
              onMouseEnter={() => onSetActiveIndex(itemIndex)}
            >
              <span className={COMMAND_RESULT_ICON_CLASS_NAME}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium leading-5">{item.title}</span>
                <span className="block truncate text-[12px] leading-4 text-muted-foreground">
                  {item.subtitle}
                </span>
              </span>
              <span className={COMMAND_RESULT_BADGE_CLASS_NAME}>
                <span className="truncate">{item.badge}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
