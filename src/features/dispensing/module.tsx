"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState, type SVGProps } from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  MenuIcon,
  PrinterIcon,
} from "@/components/icons";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsFilesDocumentAltFillIcon,
  CdsFilesMoreHorizontalIcon,
} from "@/components/cds-icons/files-and-layout";
import { CdsNavigationChevronsLeftIcon } from "@/components/cds-icons/navigation";
import {
  CdsUtilitiesHistoryIcon,
  CdsUtilitiesSortIcon,
} from "@/components/cds-icons/utilities-and-misc";
import {
  EmrDateNavigator,
  EmrListGroup,
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrListItem,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmrDataTable } from "@/components/emr/emr-data-table";
import { useLayoutStore } from "@/stores/layout-store";
import { historyGroups, orderRows, patient } from "@/features/dispensing/data";
import type { ShellComponentProps } from "@/types/emr";

const sideItems = Array.from({ length: 8 }, (_, index) => ({
  id: index,
  groupLabel: index < 4 ? "text" : "yy.mm.dd",
  items: [{ id: `${index}-item` }],
}));

const orderGroups = [
  { label: "추가된 오더", count: 1, tone: "bg-[var(--clair-color-atomic-green-500)]" },
  { label: "수정된 오더", count: 2, tone: "bg-[var(--clair-color-atomic-orange-400)]" },
  { label: "요청된 오더", count: 2, tone: "bg-[var(--clair-color-atomic-blue-500)]" },
  { label: "취소된 오더", count: 1, tone: "bg-[var(--clair-color-atomic-red-500)]" },
];
const HISTORY_GROUP_EASE = [0.16, 1, 0.3, 1] as const;
const HISTORY_GROUP_EXIT_EASE = [0.32, 0, 0.67, 0] as const;

function splitHistoryItem(item: string) {
  const [category, ...rest] = item.split(" ");

  if (!rest.length || item.startsWith("[")) {
    return { title: item, category: null, description: null };
  }

  return {
    title: rest.join(" "),
    category,
    description: rest.join(" "),
  };
}

export function DispensingSidePanel({ moduleLabel }: ShellComponentProps) {
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const [collapsedSideGroupIds, setCollapsedSideGroupIds] = useState<Set<number>>(() => new Set());
  const [selectedSideItemId, setSelectedSideItemId] = useState(2);
  const totalSideItemCount = sideItems.reduce((total, group) => total + group.items.length, 0);
  const toggleSideGroup = (id: number) => {
    setCollapsedSideGroupIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title={<span data-testid="module-side-panel-title">{moduleLabel}</span>}
        onCollapse={() => setModulePanelOpen(false)}
      />
      <EmrDateNavigator dateLabel="26.04.29 (수)" todayLabel="오늘" />
      <EmrListHeader
        label="전체 오더"
        count={totalSideItemCount}
        headerActions={
          <>
            <EmrListHeaderIconButton ariaLabel="정렬">
              <CdsUtilitiesSortIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="필터">
              <CdsActionsListFilterIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="검색">
              <CdsActionsSearchIcon className="size-4" />
            </EmrListHeaderIconButton>
          </>
        }
      />
      <EmrSubpanelBody>
        {sideItems.map((item) => {
          const collapsed = collapsedSideGroupIds.has(item.id);

          return (
            <EmrListGroup
              key={item.id}
              collapsed={collapsed}
              count={item.items.length}
              label={item.groupLabel}
              onToggle={() => toggleSideGroup(item.id)}
            >
              {item.items.map((sideItem) => (
                <EmrListItem
                  key={sideItem.id}
                  title="titletext · titletext"
                  subtitle="subtext · Description"
                  variant="outline"
                  selected={selectedSideItemId === item.id}
                  onSelect={() => setSelectedSideItemId(item.id)}
                  itemBadge={<SideItemHoverAction />}
                  footer={
                    <>
                      <div className="flex min-w-0 gap-1">
                        <Badge variant="outline" className="h-5 rounded px-1.5 font-medium">
                          title text
                        </Badge>
                        <Badge variant="outline" className="h-5 rounded px-1.5 font-medium">
                          title text
                        </Badge>
                      </div>
                      <span className="flex shrink-0 items-center gap-1">
                        <ClockIcon className="size-3" aria-hidden="true" />
                        hh:mm state
                      </span>
                    </>
                  }
                />
              ))}
            </EmrListGroup>
          );
        })}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

function SideItemHoverAction() {
  return (
    <div className="relative flex size-6 items-center justify-center">
      <Button
        type="button"
        variant="outline"
        size="icon-xs"
        className="size-6 rounded-[var(--clair-radius-sm)] bg-card p-0 text-[var(--clair-color-label-normal)] opacity-0 transition-opacity hover:bg-[var(--clair-color-background-surface)] focus-visible:opacity-100 group-hover/emr-list-item:opacity-100 group-focus-within/emr-list-item:opacity-100 group-data-[selected=true]/emr-list-item:opacity-100 [&_svg]:size-4"
        aria-label="더보기"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <CdsFilesMoreHorizontalIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

export function DispensingHeader() {
  const { contentAsideOpen, setContentAsideOpen } = useLayoutStore();

  return (
    <div className="border-b border-border bg-card">
      <div className="flex h-[50px] items-center gap-3 px-4">
        <Button
          variant="outline"
          size="xs"
          className="h-[26px] aria-expanded:border-ring aria-expanded:bg-background aria-expanded:ring-3 aria-expanded:ring-ring/50"
          aria-expanded={contentAsideOpen}
          aria-controls="dispensing-content-aside"
          onClick={() => setContentAsideOpen(!contentAsideOpen)}
        >
          <CdsUtilitiesHistoryIcon data-icon="inline-start" />
          조제이력
        </Button>
        <div className="h-[18px] w-px bg-border" />
        <PatientInfoStrip />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" aria-label="이전">
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="다음">
            <ChevronRightIcon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="메뉴">
            <MenuIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PatientInfoStrip() {
  const details = [
    ["환자", patient.name],
    ["보호자", patient.guardian],
    ["품종", "코리안숏헤어"],
    ["나이", patient.age],
    ["성별", patient.sex],
  ] as const;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
      <PatientDogIcon className="size-5 shrink-0" aria-hidden="true" />
      {details.map(([label, value]) => (
        <PatientDetailBadge key={`${label}-${value}`} label={label} value={value} />
      ))}
    </div>
  );
}

function PatientDetailBadge({ label, value }: { label: string; value: string }) {
  return (
    <Badge
      variant="secondary"
      className="h-[22px] shrink-0 gap-1 rounded-[var(--clair-radius-atomic-6)] border-transparent bg-[var(--clair-color-atomic-gray-50)] px-2 py-0.5 text-[13px] font-medium leading-[18px] tracking-[0.247px]"
    >
      <span className="text-[var(--clair-color-atomic-gray-500)]">{label}</span>
      <span className="text-[var(--clair-color-atomic-gray-700)]">{value}</span>
    </Badge>
  );
}

function PatientDogIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M9.04492 2.63144C8.777 2.42103 8.44533 2.29181 8.04825 2.29181C3.5532 2.29181 0.625 5.8884 0.625 8.75015C0.625 9.46252 0.798567 10.4598 1.49653 11.2882C2.00219 11.8884 2.7398 12.3492 3.76491 12.5682C3.87307 9.88398 4.56275 7.47573 5.60129 5.68827C6.51625 4.11346 7.71704 2.99866 9.04492 2.63144Z"
        fill="var(--clair-color-atomic-sky-500)"
      />
      <path
        d="M10.9535 2.63145C11.2214 2.42103 11.5531 2.29181 11.9502 2.29181C16.4452 2.29181 19.3734 5.8884 19.3734 8.75015C19.3734 9.46252 19.1999 10.4598 18.5019 11.2882C17.9962 11.8884 17.2586 12.3492 16.2335 12.5682C16.1254 9.88398 15.4356 7.47573 14.3971 5.68827C13.4821 4.11348 12.2814 2.99867 10.9535 2.63145Z"
        fill="var(--clair-color-atomic-sky-500)"
      />
      <path
        d="M10.0012 1.45819C11.9879 1.45819 13.8147 2.87414 15.133 5.0891C16.4553 7.31073 17.2928 10.3744 17.2928 13.7697V13.7765C17.2928 14.3765 17.2929 15.5852 16.3545 16.6366C15.4121 17.6925 13.5696 18.5415 10.0012 18.5415C6.43273 18.5415 4.59023 17.6925 3.64783 16.6366C2.70948 15.5852 2.7095 14.3765 2.70952 13.7766V13.7697C2.70952 10.3744 3.54708 7.31073 4.86935 5.0891C6.18764 2.87414 8.01448 1.45819 10.0012 1.45819Z"
        fill="var(--clair-color-atomic-sky-100)"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.12392 12.2369C8.12392 12.9994 8.66983 13.6196 9.37392 13.8556V14.8048C9.34187 14.8414 9.29896 14.8845 9.24392 14.9285C9.08633 15.0546 8.80546 15.2082 8.33229 15.2082C7.85912 15.2082 7.57821 15.0546 7.42062 14.9285C7.34404 14.8672 7.26958 14.7937 7.21875 14.7089C7.06092 14.4086 6.691 14.2884 6.38612 14.4409C6.07737 14.5952 5.95225 14.9706 6.10658 15.2794L6.10729 15.2807C6.23008 15.5243 6.42887 15.7359 6.63975 15.9046C7.003 16.1952 7.55546 16.4582 8.33229 16.4582C9.09092 16.4582 9.63554 16.2074 9.99896 15.9249C10.3624 16.2074 10.907 16.4582 11.6656 16.4582C12.4425 16.4582 12.9949 16.1952 13.3581 15.9046C13.5725 15.7331 13.767 15.5272 13.891 15.28C14.0435 14.9753 13.9169 14.5934 13.6118 14.4409C13.3069 14.2884 12.937 14.4086 12.7791 14.7089L12.7777 14.7113C12.765 14.7322 12.7011 14.8294 12.5772 14.9285C12.4197 15.0546 12.1388 15.2082 11.6656 15.2082C11.1925 15.2082 10.9115 15.0546 10.754 14.9285C10.6989 14.8844 10.656 14.8413 10.6239 14.8047V13.8556C11.328 13.6196 11.8739 12.9994 11.8739 12.2369V12.2337C11.874 12.1927 11.874 12.1028 11.8309 12.0026C11.7851 11.8963 11.7002 11.7981 11.5638 11.7169C11.3043 11.5625 10.839 11.4582 9.99892 11.4582C9.15887 11.4582 8.6935 11.5625 8.43404 11.7169C8.29771 11.7981 8.21279 11.8963 8.16696 12.0026C8.12379 12.1028 8.12387 12.1927 8.12392 12.2337V12.2369Z"
        fill="var(--clair-color-atomic-sky-500)"
      />
      <path
        d="M7.49882 7.5C7.03857 7.5 6.66548 7.87308 6.66548 8.33333V8.75C6.66548 9.21025 7.03857 9.58333 7.49882 9.58333C7.95907 9.58333 8.33215 9.21025 8.33215 8.75V8.33333C8.33215 7.87308 7.95907 7.5 7.49882 7.5Z"
        fill="var(--clair-color-atomic-sky-500)"
      />
      <path
        d="M12.4988 7.5C12.9591 7.5 13.3321 7.87308 13.3321 8.33333V8.75C13.3321 9.21025 12.9591 9.58333 12.4988 9.58333C12.0386 9.58333 11.6655 9.21025 11.6655 8.75V8.33333C11.6655 7.87308 12.0386 7.5 12.4988 7.5Z"
        fill="var(--clair-color-atomic-sky-500)"
      />
    </svg>
  );
}

export function DispensingContentAside() {
  const setContentAsideOpen = useLayoutStore((state) => state.setContentAsideOpen);
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<Set<string>>(() => new Set());
  const totalHistoryCount = historyGroups.reduce((total, group) => total + group.count, 0);
  const toggleHistoryGroup = (date: string) => {
    setCollapsedHistoryGroups((current) => {
      const next = new Set(current);

      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }

      return next;
    });
  };

  return (
    <div
      id="dispensing-content-aside"
      className="flex h-full w-full flex-col gap-2 bg-[var(--clair-color-atomic-neutral-50)] px-4 pt-4"
    >
      <HistoryListHeader count={totalHistoryCount} onCollapse={() => setContentAsideOpen(false)} />
      <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1">
          {historyGroups.map((group) => (
            <HistoryGroup
              key={group.date}
              collapsed={collapsedHistoryGroups.has(group.date)}
              group={group}
              onToggle={() => toggleHistoryGroup(group.date)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function HistoryListHeader({ count, onCollapse }: { count: number; onCollapse: () => void }) {
  return (
    <EmrListHeader
      className="mx-0 h-6 border-y-0"
      count={count}
      label="조제이력"
      leadingAction={
        <EmrListHeaderIconButton ariaLabel="이력 패널 접기" iconSize="md" onClick={onCollapse}>
          <CdsNavigationChevronsLeftIcon className="size-4" />
        </EmrListHeaderIconButton>
      }
      headerActions={
        <>
          <EmrListHeaderIconButton ariaLabel="정렬">
            <CdsUtilitiesSortIcon className="size-4" />
          </EmrListHeaderIconButton>
          <EmrListHeaderIconButton ariaLabel="필터">
            <CdsActionsListFilterIcon className="size-4" />
          </EmrListHeaderIconButton>
          <EmrListHeaderIconButton ariaLabel="검색">
            <CdsActionsSearchIcon className="size-4" />
          </EmrListHeaderIconButton>
        </>
      }
    />
  );
}

function HistoryGroup({
  collapsed,
  group,
  onToggle,
}: {
  collapsed: boolean;
  group: (typeof historyGroups)[number];
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const contentTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.24, ease: HISTORY_GROUP_EASE },
        opacity: { duration: 0.14, ease: "easeOut" },
        y: { duration: 0.2, ease: HISTORY_GROUP_EASE },
      };
  const contentExitTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.18, ease: HISTORY_GROUP_EXIT_EASE },
        opacity: { duration: 0.12, ease: "easeIn" },
        y: { duration: 0.16, ease: HISTORY_GROUP_EXIT_EASE },
      };

  return (
    <section className="flex flex-col gap-1 rounded-[10px]" data-testid={`history-group-${group.date}`}>
      <button
        type="button"
        className="flex h-8 w-full items-center justify-between rounded-md px-1 py-1 text-left outline-none transition-colors hover:bg-(--clair-color-atomic-black-alpha-8) focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-expanded={!collapsed}
        data-testid={`history-group-toggle-${group.date}`}
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium leading-[18px] tracking-[0.019em]">
          <span className="truncate text-[var(--clair-color-label-alternative)]">{group.date}</span>
          <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">{group.count}</span>
        </div>
        <motion.span
          className="flex size-4 shrink-0 items-center justify-center text-[var(--clair-color-label-alternative)]"
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: HISTORY_GROUP_EASE }}
        >
          <ChevronDownIcon className="size-4 shrink-0 text-[var(--clair-color-label-alternative)]" />
        </motion.span>
      </button>
      <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
      <AnimatePresence initial={false}>
        {collapsed ? null : (
          <motion.div
            key={`${group.date}-items`}
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0, transition: contentTransition }}
            exit={{ height: 0, opacity: 0, y: -4, transition: contentExitTransition }}
          >
            {group.items.map((item) => (
              <HistoryItem key={item} item={item} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function HistoryItem({ item }: { item: string }) {
  const { title, category, description } = splitHistoryItem(item);

  return (
    <>
      <div
        className="flex min-h-[58px] flex-col gap-1.5 rounded-[var(--clair-radius-sm)] px-1 py-1 outline-none transition-colors hover:bg-(--clair-color-atomic-black-alpha-4) focus-visible:bg-(--clair-color-atomic-black-alpha-4) focus-visible:ring-3 focus-visible:ring-ring/50"
        tabIndex={0}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="truncate text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-gray-700)]">
            {title}
          </div>
          <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-500)]">
            {category ? <span className="shrink-0">{category}</span> : null}
            {description ? <span className="truncate text-[var(--clair-color-atomic-gray-500)]">{description}</span> : null}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-500)]">
          <span className="truncate">담당자명</span>
          <span className="truncate">담당자명</span>
          <span className="shrink-0">10:30 요청</span>
        </div>
      </div>
      <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
    </>
  );
}

export function DispensingContent() {
  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      <div className="mb-3 flex h-9 items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <CdsFilesDocumentAltFillIcon
              className="size-5 shrink-0 text-[var(--clair-color-atomic-gray-300)]"
              aria-hidden="true"
            />
            <h1 className="text-[18px] font-semibold leading-[26px] tracking-[-0.002em] text-foreground">
              조제 지시서
            </h1>
          </div>
          <Badge variant="secondary" className="h-5 rounded-md px-2 text-[11px] text-muted-foreground">
            RX-260414-0008
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="bg-card">
            <DownloadIcon data-icon="inline-start" />
            PDF 다운로드
          </Button>
          <Button variant="outline" size="sm" className="bg-card">
            <PrinterIcon data-icon="inline-start" />
            출력하기
          </Button>
          <Button size="sm">
            담당하기
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-5 rounded-lg border border-border bg-card px-4 py-3">
        {[
          ["요청 일시", "2026.04.14 10:30"],
          ["환자 정보", `${patient.name}(${patient.age}) · 코리...`],
          ["요청 수의사", "이수지"],
          ["조제 담당", "미지정"],
          ["조제 시작", "대기중"],
        ].map(([label, value]) => (
          <div key={label} className="border-r border-border px-3 last:border-r-0">
            <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
            <div className="mt-1 text-[13px] font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <Tabs defaultValue="result">
          <TabsList className="h-8 rounded-full bg-transparent p-0">
            <TabsTrigger value="result" className="h-8 rounded-full px-3 text-[12px]">
              전체 10
            </TabsTrigger>
            <TabsTrigger value="condition" className="h-8 rounded-full px-3 text-[12px]">
              정규제 8
            </TabsTrigger>
            <TabsTrigger value="tab" className="h-8 rounded-full px-3 text-[12px]">
              기타 8
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <section className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <ChevronDownIcon className="size-4 text-muted-foreground" />
            <span className="text-[14px] font-semibold text-foreground">항생제 세트 A</span>
            <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[11px]">
              6
            </Badge>
            <span className="text-[12px] text-muted-foreground">subtext</span>
          </div>
          <div className="flex items-center gap-2">
            {["수정이력조회", "리마인"].map((label) => (
              <Button key={label} variant="outline" size="xs" className="bg-card">
                {label}
                <MenuIcon data-icon="inline-end" />
              </Button>
            ))}
            <Button variant="outline" size="xs" className="border-[var(--clair-color-atomic-sky-100)] bg-[var(--clair-color-atomic-sky-50)] text-[var(--clair-color-primary-normal)]">
              조제중
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[calc(100%-56px)]">
          <div className="p-4 pt-3">
            {orderGroups.map((group, section) => (
              <div key={group.label} className="mb-4">
                <div className="mb-2 flex h-6 items-center gap-2 text-[13px] font-medium text-foreground">
                  <span className={`size-3 rounded-[3px] ${group.tone}`} />
                  {group.label}
                  <span className="text-[12px] text-muted-foreground">{group.count}</span>
                </div>
                <EmrDataTable rows={orderRows} sectionId={`section-${section}`} />
              </div>
            ))}
          </div>
        </ScrollArea>
      </section>
    </div>
  );
}

export function DispensingDrawer() {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const order = orderRows.find((row) => row.id === activeDrawer?.id) ?? orderRows[0];

  return (
    <div className="flex h-[calc(100%-48px)] flex-col gap-4 overflow-y-auto p-4">
      <div className="rounded-md border bg-background p-3">
        <div className="text-[12px] text-muted-foreground">오더명</div>
        <div className="mt-1 text-base font-semibold">{order.name}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["구분", order.category],
          ["상태", order.status],
          ["경로", order.route],
          ["빈도", order.frequency],
          ["요청 일시", order.requestedAt],
          ["요청 수의사", order.doctor],
        ].map(([label, value]) => (
          <label key={label} className="flex flex-col gap-1 text-[12px] text-muted-foreground">
            {label}
            <Input value={value} readOnly className="h-8 bg-card text-foreground" />
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        용량
        <DoseInput key={order.id} initialDose={order.dose} />
      </label>
      <div className="mt-auto flex justify-end gap-2 border-t pt-4">
        <Button variant="outline">변경 이력</Button>
        <Button>수정 저장</Button>
      </div>
    </div>
  );
}

function DoseInput({ initialDose }: { initialDose: string }) {
  const [doseValue, setDoseValue] = useState(initialDose);

  return (
    <Input
      value={doseValue}
      onValueChange={setDoseValue}
      className="h-8 bg-card text-foreground"
    />
  );
}
