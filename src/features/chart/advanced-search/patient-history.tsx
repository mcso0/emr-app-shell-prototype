"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmrRightPanel, EmrRightPanelBody } from "@/components/emr/right-panel";
import { EmrRightPanelHeader } from "@/components/emr/right-panel-header";
import { EmrContentHistoryGroup } from "@/components/emr/content-history-list";
import {
  EmrHistoryFilterPopover,
  EmrHistorySearch,
  useHistorySearch,
} from "@/components/emr/history-controls";
import { EmrTableFilterTrigger } from "@/components/emr/table-filter-trigger";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrSidePanelTypeBadge } from "@/components/emr/side-panel-card";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { AnimalPatientAvatar } from "@/components/emr/animal-patient-avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CdsNavigationArrowDropDownIcon } from "@/components/cds-icons/navigation";
import { ChartSummary, SoapGroups } from "./history-detail";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import type { OpenChartProfile } from "./result-card";
import { CdsFilesCalendarIcon } from "@/components/cds-icons/files-and-layout";
import { CdsActionsCopyIcon } from "@/components/cds-icons/actions-and-controls";
import { CloseIcon, SearchIcon } from "@/components/icons";
import {
  emptyHistoryDateRange,
  matchesHistoryQuery,
} from "@/lib/history-controls";
import { getOperatingDateFromIso } from "@/lib/emr-domain/demo-date";
import { errorMessage, type ChartSearchApi } from "./client";
import {
  sectionNames,
  orderDescription,
  type SearchChart,
  type SearchParagraph,
} from "./contract";
import {
  ChartActions,
  chartTitle,
  ChartStaff,
  diagnosesText,
} from "./result-card";
import { Pick, stateText, type CopyMode } from "./presentation";
import { speciesLabel } from "./ranking";
import styles from "./workspace.module.css";
const emptyFilters = () => ({
  dates: { ...emptyHistoryDateRange },
  statuses: [] as string[],
});
const clock = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const visitLabel = (c: SearchChart) =>
  c.visitType === "walk_in"
    ? "외래"
    : c.visitType === "appointment"
      ? "예약"
      : null;
const toggled = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
function documentSections(c: SearchChart) {
  const blocks = (records: SearchParagraph[]) =>
    records.map((p) =>
      [p.scope, p.section && sectionNames[p.section], p.text]
        .filter(Boolean)
        .join(" · "),
    );
  return [
    {
      title: "Subjective/Objective",
      lines: blocks(
        c.paragraphs.filter(
          (p) => p.section === "subjective" || p.section === "objective",
        ),
      ),
    },
    ...(!c.paragraphs.some((p) => !p.section)
      ? []
      : [
          {
            title: "자유 기록",
            lines: blocks(c.paragraphs.filter((p) => !p.section)),
          },
        ]),
    {
      title: "Assessment",
      lines: [
        diagnosesText(c),
        ...blocks(c.paragraphs.filter((p) => p.section === "assessment")),
      ].filter(Boolean),
    },
    {
      title: "Plan",
      lines: [
        ...blocks(c.paragraphs.filter((p) => p.section === "plan")),
        ...c.orders.map(orderDescription),
      ],
    },
  ];
}
export function PatientHistory({
  source,
  api,
  favorites,
  onFavorite,
  onClose,
  onCopy,
  onViewChart,
  onOpenProfile,
}: {
  source: SearchChart;
  api: ChartSearchApi;
  favorites: string[];
  onFavorite: (id: string) => void;
  onClose: () => void;
  onCopy: (chart: SearchChart, mode: CopyMode) => void;
  onViewChart: (chart: SearchChart) => void;
  onOpenProfile?: OpenChartProfile;
}) {
  const [history, setHistory] = useState<SearchChart[] | null>(null);
  const [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState([source.id]),
    [collapsed, setCollapsed] = useState<string[]>([]);
  const [direction, setDirection] = useState("newest"),
    [filters, setFilters] = useState(emptyFilters),
    [draft, setDraft] = useState(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false),
    [notice, setNotice] = useState("");
  const search = useHistorySearch(),
    trigger = useRef<HTMLButtonElement>(null);
  const [selectedId, setSelectedId] = useState(source.id);
  if (selectedId !== source.id) {
    setSelectedId(source.id);
    setExpanded((ids) => (ids.includes(source.id) ? ids : [...ids, source.id]));
    setCollapsed([]);
    setFilters(emptyFilters());
    search.clear();
  }
  const patientId = source.patientId;
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      const charts = new Map<string, SearchChart>(),
        seen = new Set<string>();
      let cursor: string | null = null;
      do {
        const result = await api.patientCharts(patientId, cursor, abort.signal);
        abort.signal.throwIfAborted();
        for (const chart of result.items) {
          if (chart.patientId !== patientId)
            throw new Error("source_unavailable");
          charts.set(chart.id, chart);
        }
        cursor = result.nextCursor;
        if (cursor && seen.has(cursor)) throw new Error("invalid_cursor");
        if (cursor) seen.add(cursor);
      } while (cursor);
      setHistory([...charts.values()]);
      setError("");
    }
    void load().catch((e) => {
      if (!abort.signal.aborted) setError(errorMessage(e));
    });
    return () => abort.abort();
  }, [api, patientId, retry]);
  const records =
    history === null
      ? [source]
      : history.map((c) => (c.id === source.id ? source : c));
  const dateOf = (c: SearchChart) =>
    getOperatingDateFromIso(c.visitAt ?? c.clinicalAt) ?? "";
  const visible = records
    .filter((c) => {
      const day = dateOf(c);
      return (
        (!filters.dates.start || day >= filters.dates.start) &&
        (!filters.dates.end || day <= filters.dates.end) &&
        (!filters.statuses.length ||
          filters.statuses.includes(
            stateText(c.status) === "작성 중" ? "draft" : "completed",
          )) &&
        matchesHistoryQuery(search.query, [
          c.purpose,
          c.complaint,
          c.doctor,
          c.author,
          diagnosesText(c),
          ...c.paragraphs.map((p) => p.text),
          ...c.orders.map((o) => o.name),
        ])
      );
    })
    .sort((a, b) => {
      const order =
        dateOf(a).localeCompare(dateOf(b)) ||
        Date.parse(a.visitAt ?? a.createdAt ?? a.clinicalAt) -
          Date.parse(b.visitAt ?? b.createdAt ?? b.clinicalAt) ||
        a.id.localeCompare(b.id);
      return direction === "oldest" ? order : -order;
    });
  const groups = new Map<string, SearchChart[]>();
  for (const chart of visible) {
    const date = dateOf(chart);
    const group = groups.get(date);
    if (group) group.push(chart);
    else groups.set(date, [chart]);
  }
  const closeSearch = () => {
    search.clear();
    search.setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  async function clip(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("클립보드에 복사했습니다.");
    } catch {
      setNotice(
        "복사할 수 없습니다. 브라우저의 클립보드 권한을 확인해 주세요.",
      );
    }
  }
  return (
    <EmrRightPanel
      header={
        <EmrRightPanelHeader className="h-auto min-h-[var(--emr-rightpanel-header-height)] gap-2 border-b py-1.5">
          <AnimalPatientAvatar
            alt={source.patient + " 프로필 사진"}
            size="sm"
            className="border-[var(--clair-color-atomic-neutral-200)] [&_[data-slot=avatar-image]]:object-top"
            src={source.patientPhotoUrl}
          />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <h2 className="emr-text-panel-title wrap-anywhere font-semibold">
              {source.patient}
            </h2>
            <div className="emr-text-metadata flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground">
              <span>
                {[
                  source.age == null ? null : source.age + "세",
                  speciesLabel(source.species),
                  source.breed,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {source.guardian && (
                <span className="border-l pl-3">보호자 {source.guardian}</span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="환자 차트 이력 더보기"
                >
                  <CdsFilesMoreHorizontalIcon />
                </Button>
              }
            />
            <DropdownMenuContent
              align="end"
              className="w-max whitespace-nowrap"
            >
              <DropdownMenuItem
                disabled={!onOpenProfile}
                onClick={() =>
                  onOpenProfile?.({ type: "patient", id: source.patientId })
                }
              >
                환자 프로필 보기
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!onOpenProfile || !source.guardianId}
                onClick={() => {
                  if (source.guardianId)
                    onOpenProfile?.({
                      type: "guardian",
                      id: source.guardianId,
                    });
                }}
              >
                보호자 프로필 보기
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setExpanded(visible.map((chart) => chart.id));
                  setCollapsed([]);
                }}
              >
                모든 차트 펼치기
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExpanded([])}>
                모든 차트 접기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            aria-label="차트 원본 닫기"
            onClick={onClose}
          >
            <CloseIcon />
          </Button>
        </EmrRightPanelHeader>
      }
    >
      <EmrRightPanelBody className={styles.historySurface}>
        <div
          data-history-toolbar
          className="grid shrink-0 items-center gap-2 px-5 py-3"
        >
          <div className="flex shrink-0 items-center gap-2" aria-live="polite">
            <span className="emr-text-body font-medium">차트 이력</span>
            {history !== null && (
              <Badge variant="outline">{visible.length}</Badge>
            )}
          </div>
          <div
            role="group"
            aria-label="환자 차트 이력 도구"
            data-history-tools
            className="flex min-w-0 items-center justify-end gap-2"
          >
            <div data-history-search data-search-open={search.open}>
              {search.open ? (
                <EmrHistorySearch
                  label="환자 차트 이력 검색어"
                  search={search}
                  onClose={closeSearch}
                  onQueryChange={() => setCollapsed([])}
                />
              ) : (
                <Button
                  ref={trigger}
                  variant="outline"
                  size="icon-sm"
                  aria-label="환자 차트 이력 검색 열기"
                  aria-expanded={search.open}
                  onClick={() => search.setOpen(true)}
                >
                  <SearchIcon />
                </Button>
              )}
            </div>
            <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
            <EmrHistoryFilterPopover
              open={filterOpen}
              trigger={
                <EmrTableFilterTrigger
                  aria-label="환자 차트 필터"
                  size="sm"
                  className="h-[var(--clair-control-height-sm)] min-h-[var(--clair-control-height-sm)] px-2 py-0"
                  activeCount={
                    Number(!!(filters.dates.start || filters.dates.end)) +
                    filters.statuses.length
                  }
                />
              }
              title="환자 차트 이력 필터"
              dateLabel="진료일"
              dates={draft.dates}
              onDatesChange={(dates) => setDraft({ ...draft, dates })}
              onOpen={() => {
                setDraft(filters);
                setFilterOpen(true);
              }}
              onCancel={() => setFilterOpen(false)}
              onApply={() => {
                setFilters(draft);
                setCollapsed([]);
                setFilterOpen(false);
              }}
              onReset={() => setDraft(emptyFilters())}
            >
              <fieldset>
                <legend className="emr-text-section mb-2">차트 상태</legend>
                <div className="flex gap-4">
                  {[
                    ["completed", "완료"],
                    ["draft", "작성 중"],
                  ].map(([id, label]) => (
                    <label key={id} className="flex items-center gap-2">
                      <Checkbox
                        checked={draft.statuses.includes(id)}
                        onCheckedChange={() =>
                          setDraft({
                            ...draft,
                            statuses: toggled(draft.statuses, id),
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </EmrHistoryFilterPopover>
            <Pick
              size="sm"
              label="환자 차트 정렬"
              value={direction}
              onChange={setDirection}
              options={[
                ["newest", "정렬: 최신순"],
                ["oldest", "정렬: 오래된순"],
              ]}
            />
          </div>
        </div>
        {notice && <EmrInlineAlert severity="info" title={notice} />}
        <Separator
          data-history-divider
          className="data-horizontal:w-auto"
          aria-hidden="true"
        />
        <ScrollArea className="min-h-0 flex-1">
          <div
            data-history-groups
            className="grid min-w-0 gap-5 px-5 pb-5 pt-2"
          >
            {error ? (
              <div role="alert">
                {error}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setError("");
                    setRetry((r) => r + 1);
                  }}
                >
                  다시 시도
                </Button>
              </div>
            ) : (
              history === null && (
                <span role="status" className="emr-text-metadata">
                  이력 불러오는 중
                </span>
              )
            )}
            {Array.from(groups, ([date, charts]) => (
              <EmrContentHistoryGroup
                key={date}
                label={date.replaceAll("-", ".")}
                icon={
                  <CdsFilesCalendarIcon
                    size={16}
                    className="shrink-0 text-[var(--emr-content-history-group-title-icon)]"
                    aria-hidden="true"
                  />
                }
                count={charts.length}
                collapsed={collapsed.includes(date)}
                onToggle={() => setCollapsed((ids) => toggled(ids, date))}
              >
                {charts.map((c) => {
                  const open = expanded.includes(c.id);
                  const title = chartTitle(c);
                  const visitTimestamp = c.visitAt
                    ? Date.parse(c.visitAt)
                    : NaN;
                  const time = Number.isFinite(visitTimestamp)
                    ? clock.format(visitTimestamp)
                    : null;
                  const visitType = visitLabel(c);
                  const sections = documentSections(c);
                  return (
                    <Card
                      key={c.id}
                      data-history-chart-id={c.id}
                      aria-current={c.id === source.id || undefined}
                      className="gap-0 overflow-hidden border py-0 ring-0"
                    >
                      <div className={styles.recordHead} data-record-header>
                        <Button
                          variant="ghost"
                          className={styles.recordToggle}
                          aria-expanded={open}
                          aria-controls={"history-" + c.id}
                          aria-label={[
                            date,
                            time,
                            visitType,
                            title,
                            open ? "접기" : "펼치기",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() =>
                            setExpanded((ids) => toggled(ids, c.id))
                          }
                        />
                        <div
                          className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-2"
                          data-record-identity
                          data-visit-type={visitType ?? undefined}
                        >
                          <CdsNavigationArrowDropDownIcon
                            data-record-caret
                            aria-hidden="true"
                            className={
                              open
                                ? "size-4 shrink-0 rotate-180"
                                : "size-4 shrink-0"
                            }
                          />
                          {time ? (
                            <time
                              dateTime={c.visitAt}
                              className="emr-text-panel-title shrink-0 font-semibold tabular-nums"
                            >
                              {time}
                            </time>
                          ) : (
                            <span className="emr-text-metadata shrink-0 text-muted-foreground">
                              시각 미기록
                            </span>
                          )}
                          {visitType && (
                            <EmrSidePanelTypeBadge label={visitType} />
                          )}
                          <EmrStatusBadge label={stateText(c.status)} />
                        </div>
                        <ChartActions
                          label={title}
                          copyFirst
                          onViewHistoryChart={() => onViewChart(c)}
                          showFavorite={false}
                          favorite={favorites.includes(c.id)}
                          onFavorite={() => onFavorite(c.id)}
                          onCopy={(mode) => onCopy(c, mode)}
                          onCopyText={() =>
                            void clip(
                              [
                                c.patient,
                                title,
                                date,
                                clock.format(
                                  new Date(c.createdAt ?? c.clinicalAt),
                                ),
                                c.complaint,
                                c.doctor,
                                c.author,
                                ...sections.flatMap((section) => [
                                  section.title,
                                  ...section.lines,
                                ]),
                              ]
                                .filter(Boolean)
                                .join("\n"),
                            )
                          }
                          menu={
                            <>
                              <DropdownMenuItem
                                onClick={() => setExpanded([c.id])}
                              >
                                이 차트만 펼치기
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onFavorite(c.id)}
                              >
                                {favorites.includes(c.id)
                                  ? "즐겨찾기 해제"
                                  : "즐겨찾기 추가"}
                              </DropdownMenuItem>
                            </>
                          }
                        />
                      </div>
                      {open && (
                        <CardContent
                          id={"history-" + c.id}
                          data-record-body
                          className="emr-text-body grid min-w-0 gap-4 border-t py-6"
                        >
                          <ChartSummary chart={c} visitType={visitType} />
                          <div data-chart-people className="min-w-0 pb-2">
                            <ChartStaff chart={c} />
                          </div>
                          {sections.map((section) => (
                            <section
                              key={section.title}
                              className="grid min-w-0 gap-[var(--clair-spacing-10)] border-t pt-4 pb-1.5"
                            >
                              <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
                                <h4 className="emr-text-section font-semibold">
                                  {section.title}
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-foreground"
                                  disabled={!section.lines.length}
                                  aria-label={
                                    title + " " + section.title + " 전체 복사"
                                  }
                                  onClick={() =>
                                    void clip(section.lines.join("\n"))
                                  }
                                >
                                  <CdsActionsCopyIcon />
                                  전체 복사
                                </Button>
                              </div>
                              {section.title === "Subjective/Objective" ? (
                                <SoapGroups chart={c} query={search.query} />
                              ) : (
                                <Card className="border py-3 ring-0">
                                  <CardContent className="grid gap-2 text-xs leading-normal font-medium whitespace-pre-wrap wrap-anywhere">
                                    {section.lines.length
                                      ? section.lines.map((line, i) => (
                                          <p key={i}>{line}</p>
                                        ))
                                      : "기록 없음"}
                                  </CardContent>
                                </Card>
                              )}
                            </section>
                          ))}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </EmrContentHistoryGroup>
            ))}
            {!visible.length && history !== null && (
              <EmrEmptyState
                kind="no-search-results"
                surface="content"
                title="조건에 맞는 차트가 없습니다"
                primaryAction={
                  <Button
                    variant="outline"
                    onClick={() => {
                      search.clear();
                      setFilters(emptyFilters());
                    }}
                  >
                    조건 초기화
                  </Button>
                }
              />
            )}
          </div>
        </ScrollArea>
      </EmrRightPanelBody>
    </EmrRightPanel>
  );
}
