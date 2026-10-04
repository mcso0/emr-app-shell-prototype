"use client";

import {
  useEffect,
  useId,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CdsActionsRefreshCwIcon, CdsActionsPlusIcon } from "@/components/cds-icons/actions-and-controls";
import {
  CdsCommunicationMailIcon,
  CdsCommunicationMessageSquareIcon,
  CdsCommunicationPhoneIcon,
} from "@/components/cds-icons/communication-and-media";
import {
  CdsFilesCalendarIcon,
  CdsFilesClockIcon,
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
} from "@/components/cds-icons/navigation";
import { CdsPeopleMapPinIcon, CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
import { CdsGnbPetGnbIcon } from "@/components/cds-icons/gnb";
import { EmrSidePanelStateIcon } from "@/components/emr/side-panel-state-icon";
import type { ProfileTodayItem, ProfileTodayStatus } from "./profile-today";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmrProfileIdentity, EmrProfilePanel, EmrProfilePanelBody, EmrProfilePanelState, EmrProfileTabPanel } from "@/components/emr/profile-panel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import styles from "./profile-side-panel.module.css";

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
  todayItems?: ProfileTodayItem[];
  todayState?: ProfileTabState;
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
  onRetryToday?: () => void;
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

function ProfileIdentity({
  model,
  onHeaderAction,
  disabled,
}: {
  model: ProfileSidePanelModel;
  onHeaderAction: ProfileSidePanelProps["onHeaderAction"];
  disabled: boolean;
}) {
  const messageActionTooltipId = useId();
  return (
    <EmrProfileIdentity
      avatar={
        <Avatar className="size-full" roundness="roundrect">
          {model.avatarSrc ? (
            <AvatarImage src={model.avatarSrc} alt={model.avatarAlt} />
          ) : null}
          <AvatarFallback aria-label={`${model.avatarAlt} · 이미지 미등록`}>
            {model.kind === "patient" ? (
              <CdsMedicalPawPrintIcon aria-hidden="true" />
            ) : (
              <CdsPeopleUserIcon aria-hidden="true" />
            )}
          </AvatarFallback>
        </Avatar>
      }
      name={model.name}
      badge={<TypeBadge kind={model.kind} />}
      description={
        <span className="min-w-0 truncate">{model.meta.join(" · ")}</span>
      }
      detail={
        <div className={styles.headerActions}>
          {model.kind === "patient" ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={styles.smallAction}
                    disabled={disabled}
                  />
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
      }
    />
  );
}

function WorkCard({ item, todayStatus, showPatientName = false }: { item: ProfileReservationItem; todayStatus?: ProfileTodayStatus; showPatientName?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const descriptionId = useId();
  const description = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const element = description.current;
    if (!todayStatus || !element || expanded) return;
    const measure = () => setOverflowing(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    void document.fonts.ready.then(() => { if (element.isConnected) measure(); });
    return () => observer.disconnect();
  }, [todayStatus, expanded, item.description]);
  return (
    <div className={cn(styles.workCard, todayStatus && styles.todayWorkCard)} data-today-status={todayStatus}>
      <span className={styles.stateIcon} aria-hidden="true" data-testid={todayStatus ? "profile-today-icon" : undefined}>
        {todayStatus && todayStatus !== "reservation" ? <EmrSidePanelStateIcon className={styles.todayStateGlyph} state={todayStatus === "consulting" ? "in-progress" : "to-do"} /> : <span className={styles.stateGlyph} />}
      </span>
      <div className={styles.workCopy}>
        <p className={cn(styles.workTitle, todayStatus && styles.todayWorkTitle)}>
          {showPatientName && item.patientName ? `${item.patientName} · ` : null}
          <span className={todayStatus === "consulting" ? styles.consultingTitle : undefined}>{item.title}</span>
        </p>
        <div className={cn(todayStatus && styles.todayDescriptionRow)}>
          <p id={descriptionId} ref={description} className={cn(styles.workDescription, expanded && styles.expandedDescription)}>{item.description}</p>
          {todayStatus && overflowing ? <button type="button" className={styles.memoToggle} aria-expanded={expanded} aria-controls={descriptionId} onClick={() => setExpanded(!expanded)}>{expanded ? "접기" : "더보기"}</button> : null}
        </div>
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
  onRetryToday,
}: Pick<
  ProfileSidePanelProps,
  "editContent" | "editing" | "model" | "onBeginEdit" | "onOpenRelated" | "onRetryOverview" | "onRetryToday"
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
      <EmrProfilePanelBody
        className={cn(styles.scrollContent, styles.infoContent)}
      >
        <PanelState state={overviewState.status} label={label} onAction={onRetryOverview} />
      </EmrProfilePanelBody>
    );
  }

  return (
    <EmrProfilePanelBody
      className={cn(styles.scrollContent, styles.infoContent)}
    >
      <section className={styles.infoSection} aria-label="오늘 접수/예약" data-testid="profile-today-section">
        <h3 className={styles.sectionHeading}>오늘 접수/예약</h3>
        <div className={styles.sectionBody}>
          {model.todayState && model.todayState.status !== "ready" ? (
            <div className={styles.todayFeedback} role="status">
              <span>{model.todayState.status === "denied" ? "오늘 접수/예약을 볼 권한이 없습니다" : model.todayState.status === "error" || model.todayState.status === "not_found" ? "오늘 접수/예약을 불러오지 못했습니다" : "오늘 접수/예약을 불러오는 중입니다"}</span>
              {(model.todayState.status === "error" || model.todayState.status === "not_found") && onRetryToday ? <Button size="xs" variant="outline" onClick={onRetryToday}><CdsActionsRefreshCwIcon aria-hidden="true" data-icon="inline-start" />다시 시도</Button> : null}
            </div>
          ) : model.todayItems?.length ? model.todayItems.map((item) => <WorkCard key={`${item.id}:${item.description}`} item={item} todayStatus={item.status} showPatientName={model.kind === "guardian"} />) : model.todayItems === undefined && model.today ? <WorkCard key={`${model.today.id}:${model.today.description}`} item={model.today} todayStatus="reservation" /> : <div className={styles.todayFeedback} role="status">접수/예약 일정이 없습니다</div>}
        </div>
      </section>
      <div className={styles.divider} aria-hidden="true" />

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
    </EmrProfilePanelBody>
  );
}

function EmptyTab({ kind }: { kind: ProfileSidePanelTab }) {
  const label = { billing: "수납 이력이 없습니다", history: "진료 이력이 없습니다", reservations: "등록된 예약 일정이 없습니다", info: "표시할 정보가 없습니다" }[kind];
  return <EmrProfilePanelState state="empty" label={label} />;
}

function PanelState({ state, label, onAction }: {
  state: Exclude<ProfileTabState["status"], "ready">;
  label: string;
  onAction?: () => void;
}) {
  return <EmrProfilePanelState state={state} label={label} onRetry={onAction} />;
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
      <EmrProfilePanelBody
        className={styles.scrollContent}
      >
        <PanelState state={state.status} label={label} onAction={onRetry} />
      </EmrProfilePanelBody>
    );
  }

  return (
    <EmrProfilePanelBody
      className={styles.scrollContent}
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
        <Select defaultValue="1" disabled={!items.length}>
          <SelectTrigger
            aria-label="예약 조회 기간"
            size="sm"
            className={styles.selectTrigger}
          >
            <span className="min-w-0 flex-1 truncate text-left">1개월</span>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="1">1개월</SelectItem>
          </SelectContent>
        </Select>
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
    </EmrProfilePanelBody>
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
      <EmrProfilePanelBody
        className={styles.scrollContent}
      >
        <PanelState state={state.status} label={label} onAction={onRetry} />
      </EmrProfilePanelBody>
    );
  }

  return (
    <EmrProfilePanelBody
      className={styles.scrollContent}
    >
      <div className={styles.toolbar}>
        <div className={styles.toolbarStart}>
          전체 진료 이력 <span className={styles.countBadge}>{visibleItems.length}</span>
        </div>
        <div className={styles.toolbarEnd}>
          {kind === "guardian" && patientOptions.length ? (
            <Select
              value={patientId}
              onValueChange={(next) => {
                if (!next) return;
                setPatientId(next);
                onFilterChange?.({ months: months as 6 | 12, patientId: next === "all" ? undefined : next });
              }}
            >
              <SelectTrigger
                aria-label="진료 이력 환자 필터"
                size="sm"
                className={styles.selectTrigger}
              >
                <span className="min-w-0 flex-1 truncate text-left">
                  {patientId === "all"
                    ? "전체"
                    : patientOptions.find(([id]) => id === patientId)?.[1] ?? "이름 미상"}
                </span>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">전체</SelectItem>
                {patientOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name ?? "이름 미상"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select
            value={String(months)}
            onValueChange={(next) => {
              if (!next) return;
              const nextMonths = Number(next) as 6 | 12;
              setMonths(nextMonths);
              onFilterChange?.({ months: nextMonths, patientId: patientId === "all" ? undefined : patientId });
            }}
          >
            <SelectTrigger
              aria-label="진료 이력 조회 기간"
              size="sm"
              className={styles.selectTrigger}
            >
              <span className="min-w-0 flex-1 truncate text-left">{months}개월</span>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="6">6개월</SelectItem>
              <SelectItem value="12">12개월</SelectItem>
            </SelectContent>
          </Select>
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
    </EmrProfilePanelBody>
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
      <EmrProfilePanelBody
        className={styles.scrollContent}
      >
        <PanelState state={state.status} label={label} onAction={onRetry} />
      </EmrProfilePanelBody>
    );
  }

  return (
    <EmrProfilePanelBody
      className={styles.scrollContent}
    >
      <div className={styles.toolbar}>
        <div className={styles.toolbarStart}>
          전체 수납 이력 <span className={styles.countBadge}>{visibleItems.length}</span>
        </div>
        <div className={styles.toolbarEnd}>
          {kind === "guardian" && patientOptions.length ? (
            <Select
              value={patientId}
              onValueChange={(next) => {
                if (!next) return;
                setPatientId(next);
                onFilterChange?.({ months: months as 6 | 12, patientId: next === "all" ? undefined : next });
              }}
            >
              <SelectTrigger
                aria-label="수납 이력 환자 필터"
                size="sm"
                className={styles.selectTrigger}
              >
                <span className="min-w-0 flex-1 truncate text-left">
                  {patientId === "all"
                    ? "전체"
                    : patientOptions.find(([id]) => id === patientId)?.[1] ?? "이름 미상"}
                </span>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">전체</SelectItem>
                {patientOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name ?? "이름 미상"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select
            value={String(months)}
            onValueChange={(next) => {
              if (!next) return;
              const nextMonths = Number(next) as 6 | 12;
              setMonths(nextMonths);
              onFilterChange?.({ months: nextMonths, patientId: patientId === "all" ? undefined : patientId });
            }}
          >
            <SelectTrigger
              aria-label="수납 이력 조회 기간"
              size="sm"
              className={styles.selectTrigger}
            >
              <span className="min-w-0 flex-1 truncate text-left">{months}개월</span>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="6">6개월</SelectItem>
              <SelectItem value="12">12개월</SelectItem>
            </SelectContent>
          </Select>
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
    </EmrProfilePanelBody>
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
  onRetryToday,
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

  const loading = sectionStates?.info?.status === "loading" || sectionStates?.info?.status === "idle";
  const firstLabel = model.kind === "patient" ? "환자 정보" : "보호자 정보";

  return (
    <EmrProfilePanel
      className={cn(styles.panel, embedded && styles.embeddedPanel)}
      aria-label={`${model.kind === "patient" ? "환자" : "보호자"} 프로필 사이드 패널`}
      data-profile-kind={model.kind}
      data-testid="profile-side-panel"
      closeLabel="상세 닫기"
      onClose={onClose}
      loading={loading}
      identity={<ProfileIdentity model={model} onHeaderAction={onHeaderAction} disabled={sectionStates?.info ? sectionStates.info.status !== "ready" : false} />}
      value={activeTab}
      tabsLabel={`${firstLabel} 탭`}
      tabs={tabOrder.map((value) => ({
        value,
        label: { info: firstLabel, history: "진료 이력", reservations: "예약", billing: "수납" }[value],
        disabledReason: tabAccess?.[value]?.allowed === false ? tabAccess[value]?.disabledReason ?? `${tabAccess[value]?.requiredPermission} 권한이 필요합니다` : undefined,
      }))}
      onTabChange={(value) => { if (tabOrder.includes(value as ProfileSidePanelTab)) changeTab(value as ProfileSidePanelTab); }}
    >
      <EmrProfileTabPanel value={activeTab}>

        {activeTab === "info" ? (
          <InformationTab
            editContent={editContent}
            editing={editing}
            model={model}
            overviewState={sectionStates?.info}
            onBeginEdit={onBeginEdit}
            onOpenRelated={onOpenRelated}
            onRetryOverview={onRetryOverview}
            onRetryToday={onRetryToday}
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
      </EmrProfileTabPanel>
      {activeTab === "info" && editing ? (
        <div className={styles.editFooter}>
          <Button type="button" variant="outline" onClick={onCancelEdit} disabled={saving}>취소</Button>
          <Button type="button" onClick={onSaveEdit} disabled={saving}>{saving ? "저장 중" : "저장"}</Button>
        </div>
      ) : null}
    </EmrProfilePanel>
  );
}
