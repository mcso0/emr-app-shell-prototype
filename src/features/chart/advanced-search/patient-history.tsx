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
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { CdsMedicalPawPrintIcon } from "@/components/cds-icons/medical-and-domain";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { CdsActionsCopyIcon } from "@/components/cds-icons/actions-and-controls";
import {
  CalendarIcon,
  ChevronDownIcon,
  CloseIcon,
  DocumentIcon,
  SearchIcon,
} from "@/components/icons";
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
  dateText,
  diagnosesText,
  InfoLine,
} from "./result-card";
import {
  CopyHistory,
  Pick,
  SourceMedia,
  stateText,
  type CopyMode,
} from "./presentation";
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
    ? "현장 접수"
    : c.visitType === "appointment"
      ? "예약 진료"
      : "진료";
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
}: {
  source: SearchChart;
  api: ChartSearchApi;
  favorites: string[];
  onFavorite: (id: string) => void;
  onClose: () => void;
  onCopy: (chart: SearchChart, mode: CopyMode) => void;
  onViewChart: (chart: SearchChart) => void;
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
        Date.parse(a.createdAt ?? a.clinicalAt) -
          Date.parse(b.createdAt ?? b.clinicalAt) ||
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
    trigger.current?.focus();
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
        <EmrRightPanelHeader className="gap-2 border-b">
          <CdsMedicalPawPrintIcon className="size-5 shrink-0 text-muted-foreground" />
          <div className="emr-text-body flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
            <strong>
              {source.patient}
              {source.age != null && " (" + source.age + "세)"}
            </strong>
            <span>{source.guardian}</span>
            <span>
              {[speciesLabel(source.species), source.breed]
                .filter(Boolean)
                .join(" · ")}
            </span>
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
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setExpanded(visible.map((c) => c.id));
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
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Pick
          size="default"
          label="환자 차트 정렬"
          value={direction}
          onChange={setDirection}
          options={[
            ["newest", "정렬: 최신순"],
            ["oldest", "정렬: 오래된순"],
          ]}
        />
        <EmrHistoryFilterPopover
          open={filterOpen}
          trigger={
            <EmrTableFilterTrigger
              aria-label="환자 차트 필터"
              size="default"
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
        <span className="emr-text-metadata text-muted-foreground">
          {history !== null && visible.length + "건"}
        </span>
        <Button
          ref={trigger}
          className="ml-auto"
          variant="outline"
          size="icon"
          aria-label="환자 차트 이력 검색 열기"
          aria-expanded={search.open}
          onClick={() => (search.open ? closeSearch() : search.setOpen(true))}
        >
          <SearchIcon />
        </Button>
        {search.open && (
          <EmrHistorySearch
            label="환자 차트 이력 검색어"
            search={search}
            onClose={closeSearch}
            onQueryChange={() => setCollapsed([])}
          />
        )}
      </div>
      {notice && <EmrInlineAlert severity="info" title={notice} />}
      <EmrRightPanelBody>
        <ScrollArea className="min-h-0 flex-1 bg-[var(--emr-surface-workspace)]">
          <div className="grid min-w-0 gap-4 p-4">
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
                count={charts.length}
                collapsed={collapsed.includes(date)}
                onToggle={() => setCollapsed((ids) => toggled(ids, date))}
              >
                {charts.map((c) => {
                  const open = expanded.includes(c.id),
                    title = chartTitle(c),
                    time = clock.format(new Date(c.createdAt ?? c.clinicalAt)),
                    sections = documentSections(c);
                  return (
                    <Card
                      key={c.id}
                      data-history-chart-id={c.id}
                      className="gap-0 overflow-hidden border py-0 ring-0"
                    >
                      <div className={styles.recordHead}>
                        <Button
                          variant="ghost"
                          className={styles.recordToggle}
                          aria-expanded={open}
                          aria-controls={"history-" + c.id}
                          aria-label={[
                            date,
                            time,
                            title,
                            open ? "접기" : "펼치기",
                          ].join(" ")}
                          onClick={() =>
                            setExpanded((ids) => toggled(ids, c.id))
                          }
                        />
                        <div className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-2">
                          <ChevronDownIcon
                            className={open ? "size-4 rotate-180" : "size-4"}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="emr-text-metadata text-muted-foreground">
                              {time} · {visitLabel(c)}
                            </span>
                            <h3 className="emr-text-body truncate font-semibold">
                              {title}
                            </h3>
                          </div>
                          <EmrStatusBadge label={stateText(c.status)} />
                        </div>
                        <ChartActions
                          label={title}
                          favorite={favorites.includes(c.id)}
                          onFavorite={() => onFavorite(c.id)}
                          onCopy={(mode) => onCopy(c, mode)}
                          onCopyText={() =>
                            void clip(
                              [
                                c.patient,
                                title,
                                date,
                                time,
                                c.complaint,
                                c.doctor,
                                c.author,
                                ...sections.flatMap((s) => [
                                  s.title,
                                  ...s.lines,
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
                              <DropdownMenuItem onClick={() => onViewChart(c)}>
                                진료 차트 열기
                              </DropdownMenuItem>
                            </>
                          }
                        />
                      </div>
                      {open && (
                        <CardContent
                          id={"history-" + c.id}
                          className="emr-text-body grid min-w-0 gap-4 border-t p-4"
                        >
                          <strong>{diagnosesText(c) || "진단 미기록"}</strong>
                          <div>
                            <ChartStaff chart={c} />
                            <dl>
                              <InfoLine label="작성자" icon={<DocumentIcon />}>
                                {c.author}
                              </InfoLine>
                              <InfoLine
                                label="차트 작성일"
                                icon={<CalendarIcon />}
                              >
                                {dateText(c.createdAt)}
                              </InfoLine>
                            </dl>
                          </div>
                          {c.complaint && <p>주호소　{c.complaint}</p>}
                          {sections.map((section) => (
                            <section
                              key={section.title}
                              className="grid min-w-0 gap-2 border-t pt-4"
                            >
                              <div className="flex items-center justify-between">
                                <h4 className="emr-text-section font-semibold">
                                  {section.title}
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
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
                              <Card size="sm" className="border ring-0">
                                <CardContent className="grid gap-2 whitespace-pre-wrap wrap-anywhere">
                                  {section.lines.length
                                    ? section.lines.map((line, i) => (
                                        <p key={i}>{line}</p>
                                      ))
                                    : "기록 없음"}
                                  {section.title === "Subjective/Objective" &&
                                    c.media.length > 0 && (
                                      <SourceMedia
                                        chart={c}
                                        query={search.query}
                                      />
                                    )}
                                </CardContent>
                              </Card>
                            </section>
                          ))}
                          <CopyHistory chartId={c.id} api={api} />
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
