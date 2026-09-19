"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { CdsActionsPlusIcon, CdsActionsXIcon } from "@/components/cds-icons/actions-and-controls";
import {
  CdsCommunicationMailIcon,
  CdsCommunicationMessageSquareIcon,
  CdsCommunicationPhoneIcon,
} from "@/components/cds-icons/communication-and-media";
import {
  CdsFilesCalendarIcon,
  CdsFilesClockIcon,
  CdsFilesFileTextIcon,
} from "@/components/cds-icons/files-and-layout";
import {
  CdsMedicalFileUserIcon,
  CdsMedicalNotebookTextIcon,
  CdsMedicalPawPrintIcon,
  CdsMedicalScanLineIcon,
} from "@/components/cds-icons/medical-and-domain";
import {
  CdsNavigationChevronLeftIcon,
  CdsNavigationChevronRightIcon,
  CdsNavigationSidebarIcon,
} from "@/components/cds-icons/navigation";
import { CdsPeopleMapPinIcon, CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
import { CdsGnbPetGnbIcon } from "@/components/cds-icons/gnb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import styles from "./profile-side-panel.module.css";

const PROFILE_SCROLL_VIEWPORT_STYLE = { overflowX: "hidden" } as const;
const MESSAGE_ACTION_DISABLED_REASON = "문자/카톡 발송 기능은 아직 구현되지 않았습니다.";

export type ProfileSidePanelTab = "info" | "history" | "reservations" | "billing";

export type ProfileDefinitionIcon =
  | "calendar"
  | "clock"
  | "file-user"
  | "mail"
  | "map-pin"
  | "notebook-text"
  | "paw-print"
  | "pet"
  | "phone"
  | "scan-line"
  | "user";

export type ProfileDefinitionRow = {
  label: string;
  value: ReactNode;
  icon: ProfileDefinitionIcon;
};

const profileDefinitionIconMap = {
  calendar: CdsFilesCalendarIcon,
  clock: CdsFilesClockIcon,
  "file-user": CdsMedicalFileUserIcon,
  mail: CdsCommunicationMailIcon,
  "map-pin": CdsPeopleMapPinIcon,
  "notebook-text": CdsMedicalNotebookTextIcon,
  "paw-print": CdsMedicalPawPrintIcon,
  pet: CdsGnbPetGnbIcon,
  phone: CdsCommunicationPhoneIcon,
  "scan-line": CdsMedicalScanLineIcon,
  user: CdsPeopleUserIcon,
} satisfies Record<ProfileDefinitionIcon, typeof CdsGnbPetGnbIcon>;

export type ProfileRelatedItem = {
  badge?: string;
  badgeTone?: "default" | "primary";
  id: string;
  imageSrc?: string;
  meta: string;
  name: string;
};

export type ProfileRelatedGroup = {
  accentPrefix?: string;
  badgeCount?: number;
  id: string;
  items: ProfileRelatedItem[];
  title: string;
};

export type ProfileReservationItem = {
  description: string;
  id: string;
  patientId?: string;
  patientName?: string;
  scheduledAt?: string;
  title: string;
};

export type ProfileHistoryItem = {
  clinicianLabel?: string;
  dateAt?: string;
  id: string;
  kindLabel: string;
  patientId?: string;
  patientName?: string;
  requestedAtLabel?: string;
  statusLabel: string;
  subjectLabel: string;
  title: string;
};

export type ProfileBillingItem = ProfileHistoryItem & {
  amountLabel: string;
  paymentLabel: string;
};

export type ProfileTabAccess = {
  allowed: boolean;
  disabledReason?: string;
  requiredPermission: string;
};

export type ProfileTabState = {
  errorStatus?: number;
  nextCursor?: string | null;
  status: "idle" | "loading" | "ready" | "error" | "denied" | "not_found";
};

export type ProfileTabFilter = {
  month?: string;
  months?: 6 | 12;
  patientId?: string;
};

export type ProfileSidePanelModel = {
  avatarAlt: string;
  avatarSrc?: string;
  billing: ProfileBillingItem[];
  history: ProfileHistoryItem[];
  infoHeading: string;
  infoRows: ProfileDefinitionRow[];
  kind: "guardian" | "patient";
  meta: string[];
  name: string;
  relatedGroups: ProfileRelatedGroup[];
  reservations: ProfileReservationItem[];
  reservationMonth?: string;
  today?: ProfileReservationItem;
  upcoming?: ProfileReservationItem;
};

type ProfileSidePanelProps = {
  defaultTab?: ProfileSidePanelTab;
  editContent?: ReactNode;
  embedded?: boolean;
  editing?: boolean;
  model: ProfileSidePanelModel;
  onLoadSection?: (section: ProfileSidePanelTab, filter?: ProfileTabFilter, append?: boolean) => void;
  onBeginEdit?: () => void;
  onCancelEdit?: () => void;
  onClose: () => void;
  onHeaderAction: (action: "message" | "reservation" | "walk-in") => void;
  onOpenRelated?: (item: ProfileRelatedItem) => void;
  onRetryOverview?: () => void;
  onSaveEdit?: () => void;
  onTabChange?: (tab: ProfileSidePanelTab) => void;
  sectionStates?: Partial<Record<ProfileSidePanelTab, ProfileTabState>>;
  tabAccess?: Partial<Record<ProfileSidePanelTab, ProfileTabAccess>>;
  saving?: boolean;
};

const tabOrder: ProfileSidePanelTab[] = ["info", "history", "reservations", "billing"];

const isValidDate = (value?: string) => {
  if (!value) return false;

  return !Number.isNaN(new Date(value).getTime());
};

const getDateParts = (value?: string) => {
  if (!isValidDate(value)) return null;

  const parts = new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(new Date(value!));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");

  if (!year || !month || !day) return null;

  return { day, key: `${year}-${month}-${day}`, month, year };
};

const getMonthKey = (value?: string) => {
  const parts = getDateParts(value);

  return parts ? `${parts.year}-${parts.month}` : null;
};

const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-");

  return `${year.slice(2)}년 ${Number(month)}월`;
};

const shiftMonth = (monthKey: string, amount: number) => {
  const [year, month] = monthKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1 + amount, 1));

  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
};

const getInitialMonth = (items: ProfileReservationItem[]) => {
  const valid = items
    .map((item) => item.scheduledAt)
    .filter(isValidDate)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime());

  return getMonthKey(valid[0]) ?? getMonthKey(new Date().toISOString())!;
};

const getPeriodItems = <T extends { dateAt?: string }>(items: T[], months: number) => {
  const timestamps = items
    .map((item) => (isValidDate(item.dateAt) ? new Date(item.dateAt!).getTime() : null))
    .filter((value): value is number => value !== null);

  if (!timestamps.length) return items;

  const latest = new Date(Math.max(...timestamps));
  const cutoff = new Date(latest);
  cutoff.setMonth(cutoff.getMonth() - months);

  return items.filter(
    (item) => !isValidDate(item.dateAt) || new Date(item.dateAt!).getTime() >= cutoff.getTime(),
  );
};

const getDateGroups = <T extends { dateAt?: string; id: string }>(items: T[]) => {
  const grouped = new Map<string, { label: string; items: T[]; sortValue: number }>();

  items.forEach((item) => {
    const parts = getDateParts(item.dateAt);
    const key = parts?.key ?? "unknown";
    const current = grouped.get(key) ?? {
      items: [],
      label: parts ? `${parts.year}년 ${Number(parts.month)}월 ${Number(parts.day)}일` : "날짜 미상",
      sortValue: parts ? new Date(item.dateAt!).getTime() : Number.NEGATIVE_INFINITY,
    };
    current.items.push(item);
    current.sortValue = Math.max(
      current.sortValue,
      parts ? new Date(item.dateAt!).getTime() : Number.NEGATIVE_INFINITY,
    );
    grouped.set(key, current);
  });

  return [...grouped.values()]
    .sort((a, b) => b.sortValue - a.sortValue)
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
        const aTime = isValidDate(a.dateAt) ? new Date(a.dateAt!).getTime() : 0;
        const bTime = isValidDate(b.dateAt) ? new Date(b.dateAt!).getTime() : 0;

        return bTime - aTime;
      }),
    }));
};

function TypeBadge({ kind }: { kind: ProfileSidePanelModel["kind"] }) {
  return (
    <span className={styles.typeBadge}>
      {kind === "patient" ? (
        <CdsGnbPetGnbIcon aria-hidden="true" />
      ) : (
        <CdsPeopleUserIcon aria-hidden="true" />
      )}
      {kind === "patient" ? "환자" : "보호자"}
    </span>
  );
}

function ProfileHeader({
  activeTab,
  model,
  onClose,
  onHeaderAction,
  tabAccess,
  onTabChange,
}: {
  activeTab: ProfileSidePanelTab;
  model: ProfileSidePanelModel;
  onClose: () => void;
  onHeaderAction: ProfileSidePanelProps["onHeaderAction"];
  tabAccess?: ProfileSidePanelProps["tabAccess"];
  onTabChange: (tab: ProfileSidePanelTab) => void;
}) {
  const tabRefs = useRef<Partial<Record<ProfileSidePanelTab, HTMLButtonElement | null>>>({});
  const messageActionTooltipId = useId();
  const firstLabel = model.kind === "patient" ? "환자 정보" : "보호자 정보";
  const tabs = [
    { label: firstLabel, value: "info" as const },
    { label: "진료 이력", value: "history" as const },
    { label: "예약", value: "reservations" as const },
    { label: "수납", value: "billing" as const },
  ];
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: ProfileSidePanelTab) => {
    const index = tabOrder.indexOf(tab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabOrder.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabOrder.length) % tabOrder.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabOrder.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = tabOrder[nextIndex];
    onTabChange(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        {model.avatarSrc ? (
          // The Figma reference includes an image avatar. Product callers keep
          // this prop optional until Patient/Guardian gain an approved media source.
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.avatar} src={model.avatarSrc} alt={model.avatarAlt} />
        ) : (
          <div className={styles.avatar} role="img" aria-label={`${model.avatarAlt} · 이미지 미등록`} />
        )}
        <div className={styles.identityBody}>
          <div className={styles.identityCopy}>
            <div className={styles.nameRow}>
              <h2 className={styles.name}>{model.name}</h2>
              <TypeBadge kind={model.kind} />
            </div>
            <div className={styles.metaRow}>
              {model.meta.map((item, index) => (
                <span key={`${item}-${index}`} className={styles.metaItem}>
                  {index ? <span className={styles.metaSeparator}> · </span> : null}
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className={styles.headerActions}>
            {model.kind === "patient" ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button type="button" className={styles.smallAction} />
                  }
                >
                  <CdsActionsPlusIcon aria-hidden="true" />
                  접수/예약
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-32">
                  <DropdownMenuItem onClick={() => onHeaderAction("walk-in")}>
                    접수하기
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onHeaderAction("reservation")}>
                    예약하기
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className={styles.disabledActionTrigger}
                    data-testid="profile-message-action-trigger"
                    tabIndex={0}
                  />
                }
              >
                <button
                  type="button"
                  aria-describedby={messageActionTooltipId}
                  aria-label="카카오톡 발송"
                  className={styles.smallAction}
                  disabled
                >
                  <CdsCommunicationMessageSquareIcon aria-hidden="true" />
                  문자/카톡
                </button>
              </TooltipTrigger>
              <TooltipContent
                id={messageActionTooltipId}
                role="tooltip"
                side="bottom"
                sideOffset={6}
              >
                {MESSAGE_ACTION_DISABLED_REASON}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <button type="button" aria-label="상세 닫기" className={styles.closeButton} onClick={onClose}>
          <CdsNavigationSidebarIcon aria-hidden="true" />
        </button>
      </div>
      <div className={styles.tabs} role="tablist" aria-label={`${firstLabel} 탭`}>
        {tabs.map((tab) => {
          const access = tabAccess?.[tab.value];
          const disabledReason = access?.allowed === false
            ? access.disabledReason ?? `${access.requiredPermission} 권한이 필요합니다`
            : undefined;

          return (
            <button
              key={tab.value}
              ref={(node) => {
                tabRefs.current[tab.value] = node;
              }}
              type="button"
              id={`profile-tab-${tab.value}`}
              role="tab"
              aria-controls={`profile-tabpanel-${tab.value}`}
              aria-selected={activeTab === tab.value}
              aria-disabled={access?.allowed === false ? true : undefined}
              aria-label={disabledReason ? `${tab.label}, ${disabledReason}` : undefined}
              title={disabledReason}
              className={styles.tab}
              tabIndex={activeTab === tab.value ? 0 : -1}
              onClick={() => onTabChange(tab.value)}
              onKeyDown={(event) => onTabKeyDown(event, tab.value)}
            >
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}

function WorkCard({ item }: { item: ProfileReservationItem }) {
  return (
    <div className={styles.workCard}>
      <span className={styles.stateIcon} aria-hidden="true">
        <span className={styles.stateGlyph} />
      </span>
      <div className={styles.workCopy}>
        <p className={styles.workTitle}>{item.title}</p>
        <p className={styles.workDescription}>{item.description}</p>
      </div>
    </div>
  );
}

function RelatedCard({
  item,
  kind,
  onOpen,
}: {
  item: ProfileRelatedItem;
  kind: ProfileSidePanelModel["kind"];
  onOpen?: (item: ProfileRelatedItem) => void;
}) {
  const content = (
    <>
      <span
        className={cn(
          styles.relatedAvatar,
          kind === "patient" ? styles.relatedAvatarGuardian : styles.relatedAvatarPatient,
        )}
        aria-hidden="true"
      >
        {item.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageSrc} alt="" />
        ) : kind === "patient" ? "👩🏻" : "🐶"}
      </span>
      <span className={styles.relatedCopy}>
        <span className={styles.relatedName}>{item.name}</span>
        {item.badge ? (
          <span
            className={cn(
              styles.relatedBadge,
              item.badgeTone === "primary" && styles.relatedBadgePrimary,
            )}
          >
            {item.badge}
          </span>
        ) : null}
        <span className={styles.relatedMeta}>
          {kind === "patient" ? "· " : ""}
          {item.meta}
        </span>
      </span>
    </>
  );

  if (!onOpen) return <div className={styles.relatedCard}>{content}</div>;

  return (
    <button
      type="button"
      className={styles.relatedCard}
      aria-label={`${kind === "patient" ? "보호자" : "환자"} ${item.name} 보기`}
      onClick={() => onOpen(item)}
    >
      {content}
      <span className={styles.relatedCardAffordanceClip} aria-hidden="true">
        <span className={styles.relatedCardAffordance}>
          <span className={styles.relatedCardAffordanceGradient} />
          <span className={styles.relatedCardAffordanceFrame}>
            <CdsNavigationChevronRightIcon aria-hidden="true" />
          </span>
        </span>
      </span>
    </button>
  );
}

function InformationTab({
  editContent,
  editing,
  model,
  overviewState,
  onBeginEdit,
  onOpenRelated,
  onRetryOverview,
}: Pick<
  ProfileSidePanelProps,
  "editContent" | "editing" | "model" | "onBeginEdit" | "onOpenRelated" | "onRetryOverview"
> & { overviewState?: ProfileTabState }) {
  if (overviewState && overviewState.status !== "ready") {
    const label = overviewState.status === "loading"
      ? "프로필 정보를 불러오는 중입니다."
      : overviewState.status === "denied"
        ? "프로필 정보를 볼 권한이 없습니다."
        : overviewState.status === "not_found"
          ? "프로필 정보를 찾을 수 없습니다."
          : "프로필 정보를 불러오지 못했습니다. 다시 시도해 주세요.";

    return (
      <ScrollArea
        className={cn(styles.scrollContent, styles.infoContent)}
        viewportClassName="scroll-fade-y scroll-fade-8"
        viewportStyle={PROFILE_SCROLL_VIEWPORT_STYLE}
      >
        <PanelState label={label} actionLabel={overviewState.status === "error" ? "다시 시도" : undefined} onAction={onRetryOverview} />
      </ScrollArea>
    );
  }

  return (
    <ScrollArea
      className={cn(styles.scrollContent, styles.infoContent)}
      viewportClassName="scroll-fade-y scroll-fade-8"
      viewportStyle={PROFILE_SCROLL_VIEWPORT_STYLE}
    >
      {model.today ? (
        <>
          <section className={styles.infoSection}>
            <h3 className={styles.sectionHeading}>오늘 접수/예약</h3>
            <div className={styles.sectionBody}>
              <WorkCard item={model.today} />
            </div>
          </section>
          <div className={styles.divider} aria-hidden="true" />
        </>
      ) : null}

      {editing && editContent ? (
        <div className={styles.editSurface}>{editContent}</div>
      ) : (
        <>
          <section className={styles.infoSection}>
            <h3 className={styles.sectionHeading}>{model.infoHeading}</h3>
            {onBeginEdit ? (
              <button type="button" className={styles.editButton} onClick={onBeginEdit}>
                수정
              </button>
            ) : null}
            <dl className={cn(styles.sectionBody, styles.definitionList)}>
              {model.infoRows.map((row) => {
                const Icon = profileDefinitionIconMap[row.icon];

                return (
                  <div key={row.label} className={styles.definitionRow}>
                    <dt className={styles.definitionTerm}>
                      <Icon
                        aria-hidden="true"
                        className={styles.definitionIcon}
                        data-profile-definition-icon={row.icon}
                        size={14}
                      />
                      {row.label}
                    </dt>
                    <dd className={styles.definitionValue}>{row.value}</dd>
                  </div>
                );
              })}
            </dl>
          </section>

          {model.relatedGroups.map((group, index) => (
            <div
              key={group.id}
              className={cn(index > 0 && styles.followingRelatedGroup)}
            >
              {index === 0 ? <div className={styles.divider} aria-hidden="true" /> : null}
              <section className={styles.infoSection}>
                <h3 className={styles.sectionHeading}>
                  <span>
                    {group.accentPrefix ? (
                      <span className={styles.sectionHeadingAccent}>{group.accentPrefix}</span>
                    ) : null}
                    {group.title}
                  </span>
                  <span className={styles.countBadge}>
                    {group.badgeCount ?? group.items.length}
                  </span>
                </h3>
                <div className={styles.sectionBody}>
                  {group.items.map((item) => (
                    <RelatedCard
                      key={item.id}
                      item={item}
                      kind={model.kind}
                      onOpen={onOpenRelated}
                    />
                  ))}
                </div>
              </section>
            </div>
          ))}

          {model.upcoming ? (
            <>
              <div className={styles.divider} aria-hidden="true" />
              <section className={styles.infoSection}>
                <h3 className={styles.sectionHeading}>
                  다가오는 일정 <span className={styles.countBadge}>1</span>
                </h3>
                <div className={styles.sectionBody}>
                  <WorkCard item={model.upcoming} />
                </div>
              </section>
            </>
          ) : null}
        </>
      )}
    </ScrollArea>
  );
}

function EmptyTab({ kind }: { kind: ProfileSidePanelTab }) {
  const config = {
    billing: { icon: CdsFilesFileTextIcon, label: "수납 이력이 없습니다" },
    history: { icon: CdsFilesFileTextIcon, label: "진료 이력이 없습니다" },
    reservations: { icon: CdsFilesCalendarIcon, label: "등록된 예약 일정이 없습니다" },
    info: { icon: CdsFilesFileTextIcon, label: "표시할 정보가 없습니다" },
  }[kind];
  const Icon = config.icon;

  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <Icon />
        {kind === "reservations" ? (
          <span className={styles.emptyIconMark}><CdsActionsXIcon /></span>
        ) : null}
      </span>
      <p>{config.label}</p>
    </div>
  );
}

function PanelState({
  actionLabel,
  label,
  onAction,
}: {
  actionLabel?: string;
  label: string;
  onAction?: () => void;
}) {
  return (
    <div className={styles.emptyState} role="status">
      <span className={styles.emptyIcon} aria-hidden="true"><CdsFilesFileTextIcon /></span>
      <p>{label}</p>
      {onAction && actionLabel ? (
        <button type="button" className={styles.retryButton} onClick={onAction}>{actionLabel}</button>
      ) : null}
    </div>
  );
}

function LoadMoreButton({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className={styles.loadMoreButton} onClick={onClick}>
      더 보기
    </button>
  );
}

function ReservationsTab({
  initialMonth,
  items,
  onFilterChange,
  onLoadMore,
  onRetry,
  state,
}: {
  initialMonth?: string;
  items: ProfileReservationItem[];
  onFilterChange?: (filter: ProfileTabFilter) => void;
  onLoadMore?: (filter?: ProfileTabFilter) => void;
  onRetry?: () => void;
  state?: ProfileTabState;
}) {
  const [monthKey, setMonthKey] = useState(() => initialMonth ?? getInitialMonth(items));
  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => !isValidDate(item.scheduledAt) || getMonthKey(item.scheduledAt) === monthKey)
        .sort((a, b) => {
          const aTime = isValidDate(a.scheduledAt) ? new Date(a.scheduledAt!).getTime() : 0;
          const bTime = isValidDate(b.scheduledAt) ? new Date(b.scheduledAt!).getTime() : 0;

          return aTime - bTime;
        }),
    [items, monthKey],
  );

  if (state && state.status !== "ready") {
    const label = state.status === "loading" || state.status === "idle"
      ? "예약 일정을 불러오는 중입니다."
      : state.status === "denied"
        ? "예약 정보를 볼 권한이 없습니다."
        : state.status === "not_found"
          ? "프로필 정보를 찾을 수 없습니다."
          : "예약 일정을 불러오지 못했습니다.";
    return (
      <ScrollArea
        className={styles.scrollContent}
        viewportClassName="scroll-fade-y scroll-fade-8"
        viewportStyle={PROFILE_SCROLL_VIEWPORT_STYLE}
      >
        <PanelState label={label} actionLabel={state.status === "error" ? "다시 시도" : undefined} onAction={onRetry} />
      </ScrollArea>
    );
  }

  return (
    <ScrollArea
      className={styles.scrollContent}
      viewportClassName="scroll-fade-y scroll-fade-8"
      viewportStyle={PROFILE_SCROLL_VIEWPORT_STYLE}
    >
      <div className={styles.toolbar}>
        <div className={styles.monthNavigator}>
          <button
            type="button"
            aria-label="이전 달"
            className={styles.monthButton}
            onClick={() => setMonthKey((current) => {
              const next = shiftMonth(current, -1);
              onFilterChange?.({ month: next });
              return next;
            })}
          >
            <CdsNavigationChevronLeftIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="다음 달"
            className={styles.monthButton}
            onClick={() => setMonthKey((current) => {
              const next = shiftMonth(current, 1);
              onFilterChange?.({ month: next });
              return next;
            })}
          >
            <CdsNavigationChevronRightIcon aria-hidden="true" />
          </button>
          <span className={styles.monthLabel}>{getMonthLabel(monthKey)}</span>
        </div>
        <select
          className={styles.select}
          aria-label="예약 조회 기간"
          defaultValue="1"
          disabled={!items.length}
        >
          <option value="1">1개월</option>
        </select>
      </div>
      {visibleItems.length ? (
        <div className={styles.activityList}>
          {visibleItems.map((item) => (
            <div key={item.id} className={styles.reservationCard}>
              <span className={styles.stateIcon} aria-hidden="true">
                <span className={styles.stateGlyph} />
              </span>
              <div className={styles.workCopy}>
                <p className={styles.workTitle}>{item.title}</p>
                <p className={styles.workDescription}>{item.description}</p>
              </div>
            </div>
          ))}
          {state?.nextCursor ? <LoadMoreButton onClick={() => onLoadMore?.({ month: monthKey })} /> : null}
        </div>
      ) : (
        <EmptyTab kind="reservations" />
      )}
    </ScrollArea>
  );
}

function ActivityCard({ item }: { item: ProfileHistoryItem }) {
  return (
    <article className={styles.activityCard}>
      <div className={styles.activityTitleRow}>
        <span className={styles.activityKind}>{item.kindLabel}</span>
        <span className={styles.activityTitle}>{item.title}</span>
      </div>
      <div className={styles.activitySubtitle}>
        <Badge
          className={styles.activityPurposeBadge}
          size="sm"
          variant="ghost"
        >
          방문 목적
        </Badge>
        <span className={styles.activitySubtitleValue}>{item.subjectLabel}</span>
      </div>
      <div className={styles.activityChips}>
        <span className={styles.activityChip}>{item.statusLabel}</span>
        {item.requestedAtLabel ? (
          <span className={styles.activityChip}>
            <CdsFilesClockIcon aria-hidden="true" />
            {item.requestedAtLabel}
          </span>
        ) : null}
        {item.clinicianLabel ? (
          <span className={styles.activityChip}>
            <CdsPeopleUserIcon aria-hidden="true" />
            {item.clinicianLabel}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function HistoryTab({
  items,
  kind,
  onFilterChange,
  onLoadMore,
  onRetry,
  state,
}: {
  items: ProfileHistoryItem[];
  kind: ProfileSidePanelModel["kind"];
  onFilterChange?: (filter: ProfileTabFilter) => void;
  onLoadMore?: (filter?: ProfileTabFilter) => void;
  onRetry?: () => void;
  state?: ProfileTabState;
}) {
  const [months, setMonths] = useState(6);
  const patientOptions = useMemo(
    () =>
      [...new Map(items.filter((item) => item.patientId).map((item) => [item.patientId, item.patientName])).entries()],
    [items],
  );
  const [patientId, setPatientId] = useState("all");
  const visibleItems = useMemo(
    () =>
      getPeriodItems(
        items.filter((item) => patientId === "all" || item.patientId === patientId),
        months,
      ),
    [items, months, patientId],
  );
  const groups = useMemo(() => getDateGroups(visibleItems), [visibleItems]);

  if (state && state.status !== "ready") {
    const label = state.status === "loading" || state.status === "idle"
      ? "진료 이력을 불러오는 중입니다."
      : state.status === "denied"
        ? "진료 이력을 볼 권한이 없습니다."
        : state.status === "not_found"
          ? "프로필 정보를 찾을 수 없습니다."
          : "진료 이력을 불러오지 못했습니다.";
    return (
      <ScrollArea
        className={styles.scrollContent}
        viewportClassName="scroll-fade-y scroll-fade-8"
        viewportStyle={PROFILE_SCROLL_VIEWPORT_STYLE}
      >
        <PanelState label={label} actionLabel={state.status === "error" ? "다시 시도" : undefined} onAction={onRetry} />
      </ScrollArea>
    );
  }

  return (
    <ScrollArea
      className={styles.scrollContent}
      viewportClassName="scroll-fade-y scroll-fade-8"
      viewportStyle={PROFILE_SCROLL_VIEWPORT_STYLE}
    >
      <div className={styles.toolbar}>
        <div className={styles.toolbarStart}>
          전체 진료 이력 <span className={styles.countBadge}>{visibleItems.length}</span>
        </div>
        <div className={styles.toolbarEnd}>
          {kind === "guardian" && patientOptions.length ? (
            <select
              className={styles.select}
              aria-label="진료 이력 환자 필터"
              value={patientId}
              onChange={(event) => {
                const next = event.target.value;
                setPatientId(next);
                onFilterChange?.({ months: months as 6 | 12, patientId: next === "all" ? undefined : next });
              }}
            >
              <option value="all">전체</option>
              {patientOptions.map(([id, name]) => (
                <option key={id} value={id}>{name ?? "이름 미상"}</option>
              ))}
            </select>
          ) : null}
          <select
            className={styles.select}
            aria-label="진료 이력 조회 기간"
            value={months}
            onChange={(event) => {
              const next = Number(event.target.value) as 6 | 12;
              setMonths(next);
                onFilterChange?.({ months: next as 6 | 12, patientId: patientId === "all" ? undefined : patientId });
            }}
          >
            <option value="6">6개월</option>
            <option value="12">12개월</option>
          </select>
        </div>
      </div>
      {visibleItems.length ? (
        <div className={styles.activityList}>
          {groups.map((group) => (
            <section key={group.label} className={styles.dateGroup}>
              <h3 className={styles.dateHeading}>{group.label}</h3>
              {group.items.map((item) => <ActivityCard key={item.id} item={item} />)}
            </section>
          ))}
          {state?.nextCursor ? <LoadMoreButton onClick={() => onLoadMore?.({ months: months as 6 | 12, patientId: patientId === "all" ? undefined : patientId })} /> : null}
        </div>
      ) : (
        <EmptyTab kind="history" />
      )}
    </ScrollArea>
  );
}

function BillingCard({ item }: { item: ProfileBillingItem }) {
  return (
    <article className={styles.activityCard}>
      <div className={styles.activityTitleRow}>
        <span className={styles.activityKind}>{item.kindLabel}</span>
        <span className={styles.activityTitle}>{item.title}</span>
      </div>
      <div className={styles.activitySubtitle}>
        <span className={styles.activitySubtitleLabel}>청구</span>
        <span className={styles.activitySubtitleValue}>{item.subjectLabel}</span>
      </div>
      <div className={styles.activityChips}>
        <span className={styles.activityChip}>{item.statusLabel}</span>
        {item.requestedAtLabel ? (
          <span className={styles.activityChip}>
            <CdsFilesClockIcon aria-hidden="true" />
            {item.requestedAtLabel}
          </span>
        ) : null}
        {item.clinicianLabel ? (
          <span className={styles.activityChip}>
            <CdsPeopleUserIcon aria-hidden="true" />
            {item.clinicianLabel}
          </span>
        ) : null}
      </div>
      <div className={styles.billingSummary}>
        <span>{item.paymentLabel}</span>
        <strong className={styles.billingAmount}>{item.amountLabel}</strong>
      </div>
    </article>
  );
}

function BillingTab({
  items,
  kind,
  onFilterChange,
  onLoadMore,
  onRetry,
  state,
}: {
  items: ProfileBillingItem[];
  kind: ProfileSidePanelModel["kind"];
  onFilterChange?: (filter: ProfileTabFilter) => void;
  onLoadMore?: (filter?: ProfileTabFilter) => void;
  onRetry?: () => void;
  state?: ProfileTabState;
}) {
  const [months, setMonths] = useState(6);
  const patientOptions = useMemo(
    () =>
      [...new Map(items.filter((item) => item.patientId).map((item) => [item.patientId, item.patientName])).entries()],
    [items],
  );
  const [patientId, setPatientId] = useState("all");
  const visibleItems = useMemo(
    () =>
      getPeriodItems(
        items.filter((item) => patientId === "all" || item.patientId === patientId),
        months,
      ),
    [items, months, patientId],
  );
  const groups = useMemo(() => getDateGroups(visibleItems), [visibleItems]);

  if (state && state.status !== "ready") {
    const label = state.status === "loading" || state.status === "idle"
      ? "수납 이력을 불러오는 중입니다."
      : state.status === "denied"
        ? "수납 정보를 볼 권한이 없습니다."
        : state.status === "not_found"
          ? "프로필 정보를 찾을 수 없습니다."
          : "수납 이력을 불러오지 못했습니다.";
    return (
      <ScrollArea
        className={styles.scrollContent}
        viewportClassName="scroll-fade-y scroll-fade-8"
        viewportStyle={PROFILE_SCROLL_VIEWPORT_STYLE}
      >
        <PanelState label={label} actionLabel={state.status === "error" ? "다시 시도" : undefined} onAction={onRetry} />
      </ScrollArea>
    );
  }

  return (
    <ScrollArea
      className={styles.scrollContent}
      viewportClassName="scroll-fade-y scroll-fade-8"
      viewportStyle={PROFILE_SCROLL_VIEWPORT_STYLE}
    >
      <div className={styles.toolbar}>
        <div className={styles.toolbarStart}>
          전체 수납 이력 <span className={styles.countBadge}>{visibleItems.length}</span>
        </div>
        <div className={styles.toolbarEnd}>
          {kind === "guardian" && patientOptions.length ? (
            <select
              className={styles.select}
              aria-label="수납 이력 환자 필터"
              value={patientId}
              onChange={(event) => {
                const next = event.target.value;
                setPatientId(next);
                onFilterChange?.({ months: months as 6 | 12, patientId: next === "all" ? undefined : next });
              }}
            >
              <option value="all">전체</option>
              {patientOptions.map(([id, name]) => (
                <option key={id} value={id}>{name ?? "이름 미상"}</option>
              ))}
            </select>
          ) : null}
          <select
            className={styles.select}
            aria-label="수납 이력 조회 기간"
            value={months}
            onChange={(event) => {
              const next = Number(event.target.value) as 6 | 12;
              setMonths(next);
                onFilterChange?.({ months: next as 6 | 12, patientId: patientId === "all" ? undefined : patientId });
            }}
          >
            <option value="6">6개월</option>
            <option value="12">12개월</option>
          </select>
        </div>
      </div>
      {visibleItems.length ? (
        <div className={styles.activityList}>
          {groups.map((group) => (
            <section key={group.label} className={styles.dateGroup}>
              <h3 className={styles.dateHeading}>{group.label}</h3>
              {group.items.map((item) => <BillingCard key={item.id} item={item} />)}
            </section>
          ))}
          {state?.nextCursor ? <LoadMoreButton onClick={() => onLoadMore?.({ months: months as 6 | 12, patientId: patientId === "all" ? undefined : patientId })} /> : null}
        </div>
      ) : (
        <EmptyTab kind="billing" />
      )}
    </ScrollArea>
  );
}

export function ProfileSidePanel({
  defaultTab = "info",
  editContent,
  embedded = false,
  editing = false,
  model,
  onBeginEdit,
  onCancelEdit,
  onClose,
  onHeaderAction,
  onLoadSection,
  onOpenRelated,
  onRetryOverview,
  onSaveEdit,
  onTabChange,
  saving = false,
  sectionStates,
  tabAccess,
}: ProfileSidePanelProps) {
  const [activeTab, setActiveTab] = useState<ProfileSidePanelTab>(defaultTab);

  const changeTab = (tab: ProfileSidePanelTab) => {
    if (tabAccess?.[tab]?.allowed === false) return;
    setActiveTab(tab);
    onTabChange?.(tab);
    if (tab === "history") onLoadSection?.("history", { months: 6 });
    if (tab === "billing") onLoadSection?.("billing", { months: 6 });
    if (tab === "reservations") onLoadSection?.("reservations", { month: model.reservationMonth ?? getInitialMonth(model.reservations) });
  };

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;

      onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <section
      className={cn(styles.panel, embedded && styles.embeddedPanel)}
      aria-label={`${model.kind === "patient" ? "환자" : "보호자"} 프로필 사이드 패널`}
      data-profile-kind={model.kind}
      data-testid="profile-side-panel"
    >
      <ProfileHeader
        activeTab={activeTab}
        model={model}
        onClose={onClose}
        onHeaderAction={onHeaderAction}
        onTabChange={changeTab}
        tabAccess={tabAccess}
      />
      <div
        id={`profile-tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`profile-tab-${activeTab}`}
        className={styles.content}
        tabIndex={0}
      >
        {activeTab === "info" ? (
          <InformationTab
            editContent={editContent}
            editing={editing}
            model={model}
            overviewState={sectionStates?.info}
            onBeginEdit={onBeginEdit}
            onOpenRelated={onOpenRelated}
            onRetryOverview={onRetryOverview}
          />
        ) : null}
        {activeTab === "reservations" ? (
          <ReservationsTab
            initialMonth={model.reservationMonth}
            items={model.reservations}
            onFilterChange={(filter) => onLoadSection?.("reservations", filter)}
            onLoadMore={(filter) => onLoadSection?.("reservations", filter ?? { month: model.reservationMonth }, true)}
            onRetry={() => onLoadSection?.("reservations", { month: model.reservationMonth }, false)}
            state={sectionStates?.reservations}
          />
        ) : null}
        {activeTab === "history" ? (
          <HistoryTab
            items={model.history}
            kind={model.kind}
            onFilterChange={(filter) => onLoadSection?.("history", filter)}
            onLoadMore={(filter) => onLoadSection?.("history", filter ?? { months: 6 }, true)}
            onRetry={() => onLoadSection?.("history", { months: 6 }, false)}
            state={sectionStates?.history}
          />
        ) : null}
        {activeTab === "billing" ? (
          <BillingTab
            items={model.billing}
            kind={model.kind}
            onFilterChange={(filter) => onLoadSection?.("billing", filter)}
            onLoadMore={(filter) => onLoadSection?.("billing", filter ?? { months: 6 }, true)}
            onRetry={() => onLoadSection?.("billing", { months: 6 }, false)}
            state={sectionStates?.billing}
          />
        ) : null}
      </div>
      {activeTab === "info" && editing ? (
        <div className={styles.editFooter}>
          <Button type="button" variant="outline" onClick={onCancelEdit} disabled={saving}>취소</Button>
          <Button type="button" onClick={onSaveEdit} disabled={saving}>{saving ? "저장 중" : "저장"}</Button>
        </div>
      ) : null}
    </section>
  );
}
