"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
import { EmrPageHeader } from "@/components/emr/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SearchIcon, CloseIcon } from "@/components/icons";
import { EmrTableFeedbackSurface } from "@/components/emr/table-primitives";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { downloadChartCsv } from "./export";
import { printChartRecords } from "./print-record";
import { useChartFavorites } from "./favorites";
import { ChartRow, type OpenChartProfile } from "./result-card";
import { PatientHistory } from "./patient-history";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmrFilterToggle } from "@/components/emr/filter-toggle";
import { EmrTableFilterBuilder } from "@/components/emr/table-filter-builder";
import {
  createInitialEmrTableFilterBuilderModel,
  getEmrTableFilterBuilderActiveCount,
} from "@/components/emr/table-filter-builder-model";
import { EmrTableFilterTrigger } from "@/components/emr/table-filter-trigger";

import {
  ChevronLeftIcon,
  ChevronDownIcon,
  GridIcon,
  MenuIcon,
  DownloadIcon,
  DocumentIcon,
} from "@/components/icons";
import {
  CdsNavigationMaximize2Icon,
  CdsNavigationMinimize2Icon,
} from "@/components/cds-icons/navigation";
import { useLayoutStore } from "@/stores/layout-store";
import { errorMessage, type ChartSearchApi } from "./client";
import { copiedEvent, type SearchEntry } from "./events";
import { fields } from "./ranking";
import type {
  ChartExportFormat,
  CopyResult,
  SearchChart,
  SearchPage,
  SearchParams,
} from "./contract";
import { Pick, type CopyMode } from "./presentation";
import { Transfer } from "./transfer";
import styles from "./workspace.module.css";

export type ChartLocation = Omit<CopyResult, "requestId">;

const fresh = () => createInitialEmrTableFilterBuilderModel("chart-search");
export function ChartSearchWorkspace({
  entry,
  api,
  onClose,
  onViewChart = onClose,
  onOpenProfile,
  onReturnToChart,
  userId,
  independent = false,
  active = true,
}: {
  entry: SearchEntry;
  userId?: string;
  api: ChartSearchApi;
  onClose: () => void;
  onReturnToChart?: () => void;
  independent?: boolean;
  active?: boolean;
  onViewChart?: (chart: ChartLocation) => void;
  onOpenProfile?: OpenChartProfile;
}) {
  const [q, setQ] = useState(""),
    [sort, setSort] = useState<SearchParams["sort"]>("relevance"),
    [mine, setMine] = useState(false),
    [drafts, setDrafts] = useState(false);
  const [composingText, setComposingText] = useState<string | null>(null);
  const composing = useRef(false);
  const [doctor, setDoctor] = useState(""),
    [groups, setGroups] = useState(fresh),
    [popup, setPopup] = useState("");
  const [narrow, setNarrow] = useState(false),
    [loaded, setLoaded] = useState<{
      api: ChartSearchApi;
      params: SearchParams;
      page: SearchPage;
    } | null>(null),
    [error, setError] = useState(""),
    [loadingFirst, setLoadingFirst] = useState(true),
    [loadingMore, setLoadingMore] = useState(false),
    [selecting, setSelecting] = useState(false),
    [moreError, setMoreError] = useState<{
      message: string;
      restart: boolean;
    } | null>(null),
    [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<SearchChart | null>(null),
    [copy, setCopy] = useState<{
      source: SearchChart;
      mode: CopyMode;
      resume?: SearchEntry["resume"];
    } | null>(
      entry.resume
        ? {
            source: entry.resume.source,
            mode: "existing",
            resume: entry.resume,
          }
        : null,
    );
  const [lastResume, setLastResume] = useState(entry.resume);
  if (lastResume !== entry.resume) {
    setLastResume(entry.resume);
    if (entry.resume)
      setCopy({
        source: entry.resume.source,
        mode: "existing",
        resume: entry.resume,
      });
  }
  const [result, setResult] = useState<
      (CopyResult & { patientName?: string }) | null
    >(null),
    [notice, setNotice] = useState("");
  const [view, setView] = useState("list");
  const [checked, setChecked] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);
  const favorites = useChartFavorites(entry.workspaceId, userId);
  function toggleFavorite(id: string) {
    try {
      favorites.toggle(id);
    } catch {
      setNotice(
        "즐겨찾기를 저장할 수 없습니다. 브라우저 저장소를 확인해 주세요.",
      );
    }
  }
  function viewDocument(chart: SearchChart) {
    onViewChart({
      chartId: chart.id,
      encounterId: chart.encounterId,
      patientId: chart.patientId,
      visitAt: chart.visitAt ?? chart.clinicalAt,
    });
  }
  async function exportChecked(format: ChartExportFormat) {
    if (exportingRef.current || !checked.length) return;
    if (checked.length > 500) {
      setNotice("한 번에 최대 500건까지 내보낼 수 있습니다.");
      return;
    }
    exportingRef.current = true;
    setExporting(true);
    try {
      const rows = await api.exportRecords(checked, format);
      if (rows.length !== checked.length || rows.some((row, i) => row.chartId !== checked[i] ||
        !Array.isArray(row.paragraphs) || !Array.isArray(row.orders) || !Array.isArray(row.diagnoses) ||
        !Array.isArray(row.results) || !Array.isArray(row.attachments) || !row.resultAccess)) throw new Error("source_unavailable");
      if (format === "pdf") await printChartRecords(rows);
      else downloadChartCsv(rows);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setNotice(code === "permission_missing" || code === "unauthenticated"
        ? "차트를 내보낼 권한이 없어요."
        : errorMessage(e));
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }
  const registering = useLayoutStore(
    (s) => s.activeDrawer?.type === "reception-form",
  );
  const request = useRef<AbortController | null>(null),
    scroll = useRef<HTMLDivElement>(null),
    opener = useRef<HTMLElement | null>(null);
  // The ref closes the gap before React commits a loading-state update.
  const operation = useRef<"first" | "more" | "select" | null>(null);
  const cursors = useRef(new Set<string>());
  const sentinel = useRef<HTMLDivElement>(null);
  const detailRequest = useRef<AbortController | null>(null);
  useEffect(() => () => detailRequest.current?.abort(), []);
  const params = useMemo(
    () => ({
      query: q,
      sort,
      mine,
      includeDrafts: drafts,
      doctor,
      groups,
    }),
    [q, sort, mine, drafts, doctor, groups],
  );
  const sameSource = loaded?.api === api;
  const page = sameSource && loaded.params === params ? loaded.page : null;
  // Retain the previous geometry while the same search source refreshes.
  const visiblePage = page ?? (sameSource && !error ? loaded.page : null);
  const listRef = useRef<HTMLElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const [editingSearch, setEditingSearch] = useState(false);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || view !== "list") return;
    const bodies = Array.from(list.getElementsByClassName(styles.chartMain));
    const measure = () => {
      const height = Math.ceil(
        Math.max(0, ...bodies.map((el) => el.getBoundingClientRect().height)),
      );
      if (height > 0) list.style.setProperty("--thumbnail-side", height + "px");
    };
    const observer = new ResizeObserver(measure);
    bodies.forEach((body) => observer.observe(body));
    measure();
    return () => observer.disconnect();
  }, [view, visiblePage]);
  const closeSearch = () => {
    setEditingSearch(false);
    requestAnimationFrame(() => searchButton.current?.focus());
  };

  const count = getEmrTableFilterBuilderActiveCount(groups, fields);
  const filterLabel = count ? `필터 · 조건 ${count}개 적용 중` : "필터";
  const changed = !!(q.trim() || mine || drafts || doctor || count);
  useEffect(() => {
    const abort = new AbortController();
    detailRequest.current?.abort();
    request.current = abort;
    operation.current = "first";
    cursors.current = new Set();
    const timer = window.setTimeout(
      () => {
        setLoadingFirst(true);
        setLoadingMore(false);
        setSelecting(false);
        setMoreError(null);
        setError("");
        setSelected(null);
        setChecked([]);
        if (scroll.current) scroll.current.scrollTop = 0;
        api
          .search(params, abort.signal)
          .then((data) => {
            if (!abort.signal.aborted) setLoaded({ api, params, page: data });
          })
          .catch((e) => {
            if (!abort.signal.aborted) setError(errorMessage(e));
          })
          .finally(() => {
            if (!abort.signal.aborted) {
              operation.current = null;
              setLoadingFirst(false);
            }
          });
      },
      q ? 180 : 0,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [api, params, attempt, q]);
  const more = useCallback(async () => {
    const abort = request.current;
    const cursor = page?.nextCursor;
    if (
      !active || !page || !cursor || error || loadingFirst || operation.current ||
      !abort || abort.signal.aborted
    ) return;
    operation.current = "more";
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await api.search({ ...params, cursor }, abort.signal);
      if (abort.signal.aborted || request.current !== abort) return;
      const existing = new Set(page.items.map((chart) => chart.id));
      const additions = next.items.filter((chart) => {
        if (existing.has(chart.id)) return false;
        existing.add(chart.id);
        return true;
      });
      if (
        next.nextCursor && (
          next.nextCursor === cursor ||
          cursors.current.has(next.nextCursor) ||
          !additions.length
        )
      )
        throw new Error("invalid_cursor");
      cursors.current.add(cursor);
      setLoaded({
        api,
        params,
        page: {
          ...next,
          doctors: page.doctors,
          items: [...page.items, ...additions],
        },
      });
    } catch (e) {
      if (!abort.signal.aborted && request.current === abort) {
        const restart = e instanceof Error && e.message === "invalid_cursor";
        setMoreError({
          restart,
          message: restart
            ? "검색 결과가 변경되어 이어서 불러올 수 없습니다. 검색을 다시 불러와 주세요."
            : "다음 차트를 불러오지 못했습니다. 다시 시도해 주세요.",
        });
      }
    } finally {
      if (!abort.signal.aborted && request.current === abort) {
        operation.current = null;
        setLoadingMore(false);
      }
    }
  }, [active, api, params, page, error, loadingFirst]);
  useEffect(() => {
    const root = scroll.current;
    const target = sentinel.current;
    if (
      !active || !root || !target || !page?.nextCursor ||
      error || loadingFirst || loadingMore || selecting || moreError
    ) return;
    let observing = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (observing && entry.isIntersecting) void more();
      },
      { root, rootMargin: "0px 0px 300px 0px" },
    );
    observer.observe(target);
    return () => {
      observing = false;
      observer.disconnect();
    };
  }, [active, page, error, loadingFirst, loadingMore, selecting, moreError, more, view, narrow]);
  async function selectResults(checkedAll: boolean) {
    if (!checkedAll || !page) {
      setChecked([]);
      return;
    }
    if (operation.current || loadingFirst) return;
    if (page.total > 500) {
      setNotice(
        "한 번에 최대 500건까지 선택할 수 있습니다. 검색 조건을 좁혀 주세요.",
      );
      return;
    }
    const signal = request.current?.signal;
    const ids = new Set(page.items.map((chart) => chart.id));
    let cursor = page.nextCursor;
    const seen = new Set<string>();
    operation.current = "select";
    setSelecting(true);
    try {
      while (cursor) {
        if (seen.has(cursor)) throw new Error("invalid_cursor");
        seen.add(cursor);
        const next = await api.search({ ...params, cursor }, signal);
        if (signal?.aborted) return;
        next.items.forEach((chart) => ids.add(chart.id));
        if (ids.size > 500) throw new Error("selection_limit");
        cursor = next.nextCursor;
      }
      if (!signal?.aborted) setChecked([...ids]);
    } catch (e) {
      if (!signal?.aborted)
        setNotice(e instanceof Error && e.message === "selection_limit"
          ? "한 번에 최대 500건까지 선택할 수 있습니다. 검색 조건을 좁혀 주세요."
          : errorMessage(e));
    } finally {
      if (!signal?.aborted) {
        operation.current = null;
        setSelecting(false);
      }
    }
  }
  function reset() {
    setQ("");
    setMine(false);
    setDrafts(false);
    setDoctor("");
    setSort("relevance");
    setGroups(fresh());
  }
  function closeSource() {
    detailRequest.current?.abort();
    setSelected(null);
    requestAnimationFrame(() => opener.current?.focus());
  }
  async function showSource(chart: SearchChart, mode?: CopyMode) {
    if (!mode) opener.current = document.activeElement as HTMLElement;
    detailRequest.current?.abort();
    const abort = new AbortController();
    detailRequest.current = abort;
    try {
      const detail = await api.search({ chartId: chart.id }, abort.signal);
      if (abort.signal.aborted) return;
      const current = detail.items[0];
      if (
        !current ||
        current.id !== chart.id ||
        current.patientId !== chart.patientId
      )
        throw new Error("source_unavailable");
      if (mode) setCopy({ source: current, mode });
      else setSelected(current);
    } catch (e) {
      if (!abort.signal.aborted) {
        setSelected(null);
        setNotice(errorMessage(e));
      }
    }
  }
  function copyDone(out: CopyResult | null, patientName?: string) {
    setCopy(null);
    setResult(out ? { ...out, patientName } : null);
    setNotice(
      out
        ? out.unchanged
          ? "선택한 진단이 대상 차트에 이미 있습니다."
          : "선택한 항목을 대상 차트에 적용했습니다."
        : "접수 대기 중입니다. 호출 후 첫 차트에서 복사를 이어갈 수 있습니다.",
    );
    if (out)
      window.dispatchEvent(
        new CustomEvent(copiedEvent, {
          detail: { ...out, workspaceId: entry.workspaceId },
        }),
      );
  }
  const WidthIcon = narrow
    ? CdsNavigationMaximize2Icon
    : CdsNavigationMinimize2Icon;
  const navigationAction = onReturnToChart && entry.patientName ? (
    <Button variant="ghost" className="self-start" onClick={onReturnToChart}>
      <ChevronLeftIcon />
      {entry.patientName} 차트로 돌아가기
    </Button>
  ) : !independent ? (
    <Button variant="ghost" size="icon" aria-label="검색 닫기" onClick={onClose}>
      <ChevronLeftIcon />
    </Button>
  ) : null;
  return (
    <section
      className={styles.workspace}
      style={registering ? { visibility: "hidden" } : undefined}
      aria-label="차트 상세 검색"
      onKeyDown={(e) => {
        if (e.defaultPrevented || !e.currentTarget.contains(e.target as Node))
          return;
        if (e.key === "Escape" && !copy && !popup) {
          if (selected) closeSource();
          else if (!independent) onClose();
        }
      }}
    >
      {navigationAction && (
        <EmrMainContentHeader heightMode="adaptive">
          {navigationAction}
        </EmrMainContentHeader>
      )}
      <header className={styles.resultHeader} data-emr-table-workspace-header>
        <EmrPageHeader
          title="차트 상세 검색"
          badge={
            !page && !error ? (
              <Skeleton aria-label="차트 수 불러오는 중" className="h-4 w-6" />
            ) : (
              <Badge variant="secondary">{page?.total ?? 0}</Badge>
            )
          }
          className={styles.heading}
          actionsClassName={styles.toolbar}
          actions={
            <>
              <div
                className={styles.searchControls}
                onBlur={(e) => {
                  if (
                    !q &&
                    popup !== "filter" &&
                    !e.currentTarget.contains(e.relatedTarget as Node)
                  )
                    setEditingSearch(false);
                }}
              >
                {editingSearch || q ? (
                  <div className={styles.searchField}>
                    <Input
                      autoFocus
                      aria-label="차트 검색어"
                      placeholder="증상·진단·오더 검색"
                      value={composingText ?? q}
                      onCompositionStart={(e) => {
                        composing.current = true;
                        setComposingText(e.currentTarget.value);
                      }}
                      onCompositionEnd={(e) => {
                        composing.current = false;
                        setComposingText(null);
                        setQ(e.currentTarget.value);
                        setSort("relevance");
                      }}
                      onValueChange={(v) => {
                        if (composing.current) setComposingText(v);
                        else {
                          setQ(v);
                          setSort("relevance");
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape" && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          e.stopPropagation();
                          setQ("");
                          closeSearch();
                        }
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="검색어 지우기"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQ("");
                        closeSearch();
                      }}
                    >
                      <CloseIcon />
                    </Button>
                  </div>
                ) : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          ref={searchButton}
                          variant="outline"
                          size="icon"
                          aria-label="검색"
                          onClick={() => setEditingSearch(true)}
                        />
                      }
                    >
                      <SearchIcon aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">검색</TooltipContent>
                  </Tooltip>
                )}
                <Popover
                  open={active && popup === "filter"}
                  onOpenChange={(v) => setPopup(v ? "filter" : "")}
                >
                  <Tooltip disabled={popup === "filter"}>
                    <TooltipTrigger
                      render={
                        <PopoverTrigger
                          render={
                            <EmrTableFilterTrigger
                              iconOnly
                              activeCount={count}
                              aria-label={filterLabel}
                            />
                          }
                        />
                      }
                    />
                    <TooltipContent side="bottom">{filterLabel}</TooltipContent>
                  </Tooltip>
                  <PopoverContent
                    align="end"
                    className="w-auto max-w-[96vw] p-0"
                    initialFocus={false}
                  >
                    <EmrTableFilterBuilder
                      autoOpenFirstField={false}
                      fields={fields}
                      model={groups}
                      onModelChange={setGroups}
                      onClose={() => setPopup("")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className={styles.controls}>
                <Pick
                  size="default"
                  label="진료 담당의"
                  value={doctor || "any"}
                  options={[
                    ["any", "전체 수의사"],
                    ...(page?.doctors ?? []).map(
                      (d) => [d.id, d.name] as [string, string],
                    ),
                    ...(doctor && !page?.doctors?.some((d) => d.id === doctor)
                      ? [[doctor, "선택한 담당의"] as [string, string]]
                      : []),
                  ]}
                  onChange={(v) => setDoctor(v === "any" ? "" : v)}
                />
                <EmrFilterToggle
                  size="default"
                  pressed={mine}
                  onPressedChange={setMine}
                  title="내가 담당하거나 작성한 차트"
                >
                  내 차트
                </EmrFilterToggle>
              </div>
              <span aria-hidden className="h-4 w-px bg-border" />
              <div className={styles.controls}>
                <Pick
                  size="default"
                  label="정렬"
                  value={sort ?? "relevance"}
                  options={[
                    ...(q.trim()
                      ? [
                          ["relevance", "관련도순"] as [string, string],
                          ["recent", "최근순"] as [string, string],
                        ]
                      : [
                          [
                            sort === "recent" ? "recent" : "relevance",
                            "최근순",
                          ] as [string, string],
                        ]),
                    ["oldest", "오래된순"],
                  ]}
                  onChange={(v) => setSort(v as SearchParams["sort"])}
                />
                <ToggleGroup
                  aria-label="차트 보기 방식"
                  value={[view]}
                  variant="outline"
                  size="default"
                  onValueChange={(v) => {
                    if (v.length) setView(v[0]);
                  }}
                >
                  <ToggleGroupItem value="list" aria-label="리스트 보기">
                    <MenuIcon />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="card" aria-label="카드 보기">
                    <GridIcon />
                  </ToggleGroupItem>
                </ToggleGroup>
                <Button
                  variant="outline"
                  aria-pressed={narrow}
                  onClick={() => setNarrow(!narrow)}
                >
                  <WidthIcon />
                  {narrow ? "넓게 보기" : "좁게 보기"}
                </Button>
              </div>
              <span aria-hidden className="h-4 w-px bg-border" />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button disabled={!page || !checked.length || exporting}>
                      <DownloadIcon />
                      내보내기
                      {checked.length ? " (" + checked.length + ")" : ""}
                      <ChevronDownIcon />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void exportChecked("pdf")}>
                    <DocumentIcon />
                    PDF로 내보내기
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void exportChecked("csv")}>
                    <DownloadIcon />
                    CSV로 내보내기
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
      </header>
      <div className={styles.resultsBody}>
        <div className={styles.listhead} data-narrow={narrow}>
          <div role="group" aria-label="차트 선택" className="flex shrink-0 items-center gap-2">
            <Checkbox
              aria-label="현재 결과 모두 선택"
              disabled={!page?.items.length || loadingFirst || loadingMore || selecting}
              checked={!!page?.items.length && checked.length === page.total}
              indeterminate={
                !!checked.length && checked.length !== (page?.total ?? 0)
              }
              onCheckedChange={(v) => void selectResults(v)}
            />
            <span className="emr-control-text-compact whitespace-nowrap">{checked.length ? checked.length + "건 선택" : "전체 선택"}</span>
            {!!checked.length && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => setChecked([])}
                disabled={selecting}
              >
                선택 해제
              </Button>
            )}
          </div>
          <label>
            <Switch size="sm" checked={drafts} onCheckedChange={setDrafts} />
            작성 중 차트 포함
          </label>
        </div>
        <ScrollArea viewportRef={scroll} className={styles.resultsScroll}>
          <div className={styles.list} data-narrow={narrow}>
            {error && (
              <div className={styles.empty} role="alert">
                {error}
                <Button
                  variant="outline"
                  onClick={() => setAttempt((a) => a + 1)}
                >
                  다시 시도
                </Button>
              </div>
            )}
            {!visiblePage && !error && (
              <div
                role="status"
                aria-label="차트를 불러오는 중입니다"
                className="grid gap-3"
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-6 rounded-xl border bg-card p-4"
                  >
                    <Skeleton className="h-48 w-1/4" />
                    <div className="grid flex-1 gap-4">
                      <Skeleton className="h-6 w-1/3" />
                      <Skeleton className="h-5 w-4/5" />
                      <Skeleton className="h-5 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!!visiblePage?.items.length && (
              <section
                aria-label="차트 검색 결과"
                aria-busy={!page}
                inert={!page}
                ref={listRef}
                className={styles.results}
                data-view={view}
              >
                {visiblePage.items.map((chart) => (
                  <ChartRow
                    key={chart.id}
                    chart={chart}
                    query={loaded?.params.query ?? q}
                    active={selected?.id === chart.id}
                    checked={checked.includes(chart.id)}
                    favorite={favorites.ids.includes(chart.id)}
                    onOpen={() => void showSource(chart)}
                    onOpenProfile={onOpenProfile}
                    onCheck={() => {
                      if (selecting) return;
                      if (!checked.includes(chart.id) && checked.length >= 500) {
                        setNotice("한 번에 최대 500건까지 선택할 수 있습니다. 검색 조건을 좁혀 주세요.");
                        return;
                      }
                      setChecked((ids) =>
                        ids.includes(chart.id)
                          ? ids.filter((id) => id !== chart.id)
                          : [...ids, chart.id],
                      );
                    }}
                    onFavorite={() => toggleFavorite(chart.id)}
                    onCopy={(mode) => void showSource(chart, mode)}
                    onViewChart={() => viewDocument(chart)}
                  />
                ))}
              </section>
            )}
            {!loadingFirst && !error && page?.total === 0 && (
              <EmrTableFeedbackSurface className="min-h-52 flex-1" role="status">
                <EmrEmptyState
                  surface="content"
                  kind={
                    q
                      ? "no-search-results"
                      : mine
                        ? "no-scope-result"
                        : changed
                          ? "no-filter-results"
                          : "no-data"
                  }
                  title={
                    q
                      ? "검색 결과가 없습니다"
                      : mine && !doctor && !count
                        ? "담당하거나 작성한 차트가 없습니다"
                        : changed
                          ? "조건에 맞는 차트가 없습니다"
                          : "등록된 완료 차트가 없습니다"
                  }
                  primaryAction={
                    changed ? (
                      <Button
                        variant="outline"
                        onClick={q ? () => setQ("") : reset}
                      >
                        {q
                          ? "검색어 초기화"
                          : mine && !doctor && !count
                            ? "전체 차트 보기"
                            : "검색 조건 초기화"}
                      </Button>
                    ) : undefined
                  }
                />
              </EmrTableFeedbackSurface>
            )}
            {page?.nextCursor && (
              <div ref={sentinel} data-chart-search-sentinel className="min-h-px py-2">
                {loadingMore && (
                  <div role="status" className="py-2 text-center text-sm text-muted-foreground">
                    차트 불러오는 중
                  </div>
                )}
                {moreError && (
                  <EmrInlineAlert
                    severity="error"
                    title={moreError.message}
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={moreError.restart
                          ? () => setAttempt((a) => a + 1)
                          : () => void more()}
                      >
                        {moreError.restart ? "검색 다시 불러오기" : "다시 시도"}
                      </Button>
                    }
                  />
                )}
              </div>
            )}
          </div>
        </ScrollArea>
        {selected && (
          <aside aria-label="차트 원본" className={styles.drawer}>
            <PatientHistory
              key={selected.patientId}
              source={selected}
              api={api}
              onClose={closeSource}
              favorites={favorites.ids}
              onFavorite={toggleFavorite}
              onCopy={(chart, mode) => void showSource(chart, mode)}
              onOpenProfile={onOpenProfile}
              onViewChart={viewDocument}
            />
          </aside>
        )}
      </div>
      {notice && (
        <div className={styles.notice} role="status">
          {notice}
          {result && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewChart(result)}
            >
              {result.patientName ?? "대상"} 차트 보기
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setNotice("")}>
            닫기
          </Button>
        </div>
      )}
      {active && copy && (
        <Transfer
          workspace={entry.workspaceId}
          api={api}
          source={copy.source}
          mode={copy.mode}
          contextId={entry.chartId}
          initial={copy.resume}
          onRefreshSource={(source) => {
            setSelected(source);
            setCopy({ ...copy, source });
          }}
          onTargetDeleted={() => {
            setSelected(copy.source);
            if (copy.resume) setCopy({ source: copy.source, mode: copy.mode });
          }}
          onClose={() => {
            setCopy(null);
            if (copy.resume) onClose();
          }}
          onDone={copyDone}
        />
      )}
    </section>
  );
}
