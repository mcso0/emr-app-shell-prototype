"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmrInstructionTitleBar } from "@/components/emr/instruction-header-stack";
import { EmrFilterToggle } from "@/components/emr/filter-toggle";
import { EmrTableFilterBuilder } from "@/components/emr/table-filter-builder";
import {
  createInitialEmrTableFilterBuilderModel,
  getEmrTableFilterBuilderActiveCount,
} from "@/components/emr/table-filter-builder-model";
import { EmrTableFilterTrigger } from "@/components/emr/table-filter-trigger";
import { ReceptionSearchInput } from "@/features/reception/reception-list-search";
import { ChevronLeftIcon, CalendarIcon, SearchIcon } from "@/components/icons";
import {
  CdsNavigationMaximize2Icon,
  CdsNavigationMinimize2Icon,
} from "@/components/cds-icons/navigation";
import { useLayoutStore } from "@/stores/layout-store";
import { chartSearchApi, errorMessage, type ChartSearchApi } from "./client";
import { copiedEvent, openSearchEvent, type SearchEntry } from "./events";
import { getOperatingDateFromIso } from "@/lib/emr-domain/demo-date";
import { fields } from "./ranking";
import type {
  CopyResult,
  SearchChart,
  SearchPage,
  SearchParams,
} from "./contract";
import { ChartRow, ChartSource, Pick, type CopyMode } from "./presentation";
import { Transfer } from "./transfer";
import styles from "./workspace.module.css";

type ChartLocation = Omit<CopyResult, "requestId">;

export function ChartSearchHost({ workspace }: { workspace: string }) {
  const [entry, setEntry] = useState<SearchEntry | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const path = usePathname();
  const router = useRouter();
  const [viewingChart, setViewingChart] = useState(false);
  const [instance, setInstance] = useState(0);
  const opener = useRef<HTMLElement | null>(null);
  const api = useMemo(() => chartSearchApi(workspace), [workspace]);
  useEffect(() => {
    function open(event: Event) {
      const detail = (event as CustomEvent<SearchEntry>).detail;
      if (detail?.workspaceId !== workspace) return;
      opener.current = document.activeElement as HTMLElement | null;
      setViewingChart(false);
      setActivePath(path);
      setInstance((n) => n + 1);
      setEntry(detail);
    }
    window.addEventListener(openSearchEvent, open);
    return () => window.removeEventListener(openSearchEvent, open);
  }, [workspace, path]);
  const registering = useLayoutStore(
    (s) => s.activeDrawer?.type === "reception-form",
  );
  useEffect(() => {
    if (!entry || registering || viewingChart || path !== activePath) return;
    const frame = document.querySelector<HTMLElement>(
      '[data-testid="workspace-frame"]',
    );
    if (!frame) return;
    frame.inert = true;
    return () => {
      frame.inert = false;
    };
  }, [entry, registering, viewingChart, path, activePath]);
  function viewChart(chart: ChartLocation) {
    const date = getOperatingDateFromIso(chart.visitAt);
    const search = new URLSearchParams({
      patientId: chart.patientId,
      encounterId: chart.encounterId,
      chartId: chart.chartId,
      orderChart: "1",
      ...(date ? { date } : {}),
    });
    setViewingChart(true);
    router.push(
      "/w/" + encodeURIComponent(workspace) + "/treatment?" + search,
    );
  }
  if (!entry || (!viewingChart && path !== activePath)) return null;
  return (
    <>
      <div hidden={viewingChart}>
        <ChartSearchWorkspace
          key={instance}
          entry={entry}
          api={api}
          onViewChart={viewChart}
          onClose={() => {
            setEntry(null);
            requestAnimationFrame(() => opener.current?.focus());
          }}
        />
      </div>
      {viewingChart && path === `/w/${workspace}/treatment` && (
        <Button
          className={styles.returnButton}
          variant="outline"
          onClick={() => {
            setActivePath(path);
            setViewingChart(false);
          }}
        >
          검색 결과로 돌아가기
        </Button>
      )}
    </>
  );
}
const fresh = () => createInitialEmrTableFilterBuilderModel("chart-search");
export function ChartSearchWorkspace({
  entry,
  api,
  onClose,
  onViewChart = onClose,
}: {
  entry: SearchEntry;
  api: ChartSearchApi;
  onClose: () => void;
  onViewChart?: (chart: ChartLocation) => void;
}) {
  const [q, setQ] = useState(""),
    [sort, setSort] = useState<SearchParams["sort"]>("relevance"),
    [mine, setMine] = useState(false),
    [drafts, setDrafts] = useState(false);
  const [doctor, setDoctor] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [groups, setGroups] = useState(fresh),
    [popup, setPopup] = useState("");
  const [narrow, setNarrow] = useState(false),
    [page, setPage] = useState<SearchPage | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<SearchChart | null>(null),
    [copy, setCopy] = useState<{
      source: SearchChart;
      mode: CopyMode;
      resume?: SearchEntry["resume"];
    } | null>(
      entry.resume
        ? { source: entry.resume.source, mode: "existing", resume: entry.resume }
        : null,
    );
  const [result, setResult] = useState<CopyResult | null>(null),
    [notice, setNotice] = useState("");
  const registering = useLayoutStore(
    (s) => s.activeDrawer?.type === "reception-form",
  );
  const request = useRef<AbortController | null>(null),
    scroll = useRef<HTMLDivElement>(null),
    opener = useRef<HTMLElement | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  useEffect(() => () => detailRequest.current?.abort(), []);
  const params = useMemo(
    () => ({
      query: q,
      sort,
      mine,
      includeDrafts: drafts,
      doctor,
      from,
      to,
      groups,
    }),
    [q, sort, mine, drafts, doctor, from, to, groups],
  );
  const count = getEmrTableFilterBuilderActiveCount(groups, fields);
  const changed = !!(
    q.trim() ||
    mine ||
    drafts ||
    doctor ||
    from ||
    to ||
    count
  );
  useEffect(() => {
    const abort = new AbortController();
    detailRequest.current?.abort();
    request.current = abort;
    const timer = window.setTimeout(
      () => {
        setBusy(true);
        setError("");
        setPage(null);
        setSelected(null);
        if (scroll.current) scroll.current.scrollTop = 0;
        if (from && to && from > to) {
          setBusy(false);
          setError("종료일은 시작일 이후로 선택해 주세요.");
          return;
        }
        api
          .search(params, abort.signal)
          .then((data) => {
            if (!abort.signal.aborted) setPage(data);
          })
          .catch((e) => {
            if (!abort.signal.aborted) setError(errorMessage(e));
          })
          .finally(() => {
            if (!abort.signal.aborted) setBusy(false);
          });
      },
      q ? 180 : 0,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [api, params, attempt, q, from, to]);
  async function more() {
    if (!page?.nextCursor || busy) return;
    const signal = request.current?.signal;
    setBusy(true);
    setError("");
    try {
      const next = await api.search(
        { ...params, cursor: page.nextCursor },
        signal,
      );
      if (!signal?.aborted)
        setPage({ ...next, items: [...page.items, ...next.items] });
    } catch (e) {
      if (!signal?.aborted) setError(errorMessage(e));
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }
  function reset() {
    setQ("");
    setMine(false);
    setDrafts(false);
    setDoctor("");
    setFrom("");
    setTo("");
    setSort("relevance");
    setGroups(fresh());
  }
  function closeSource() {
    detailRequest.current?.abort();
    setSelected(null);
    requestAnimationFrame(() => opener.current?.focus());
  }
  async function showSource(chart: SearchChart, mode?: CopyMode) {
    opener.current = document.activeElement as HTMLElement;
    detailRequest.current?.abort();
    const abort = new AbortController();
    detailRequest.current = abort;
    try {
      const detail = await api.search({ chartId: chart.id }, abort.signal);
      if (abort.signal.aborted) return;
      const current = detail.items[0];
      if (!current) throw new Error("source_unavailable");
      setSelected(current);
      if (mode) setCopy({ source: current, mode });
    } catch (e) {
      if (!abort.signal.aborted) {
        setSelected(null);
        setNotice(errorMessage(e));
      }
    }
  }
  function copyDone(out: CopyResult | null) {
    setCopy(null);
    setResult(out);
    setNotice(
      out
        ? "선택한 항목을 대상 차트에 적용했습니다."
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
  return (
    <section
      className={styles.workspace}
      style={registering ? { visibility: "hidden" } : undefined}
      aria-label="차트 상세 검색"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !copy && !popup) {
          if (selected) closeSource();
          else onClose();
        }
      }}
    >
      <EmrInstructionTitleBar
        className={styles.header}
        title="차트 상세 검색"
        icon={
          <Button
            autoFocus
            size="icon-sm"
            variant="ghost"
            aria-label="검색 닫기"
            onClick={onClose}
          >
            <ChevronLeftIcon />
          </Button>
        }
        actions={
          <div className={styles.controls}>
            <Pick
              label="정렬"
              value={sort ?? "relevance"}
              options={[
                ["relevance", q ? "정렬 · 관련도순" : "정렬 · 최근순"],
                ["recent", "최근 진료순"],
                ["oldest", "오래된 진료순"],
              ]}
              onChange={(v) => setSort(v as SearchParams["sort"])}
            />
            <Popover
              open={popup === "filter"}
              onOpenChange={(v) => setPopup(v ? "filter" : "")}
            >
              <PopoverTrigger
                render={<EmrTableFilterTrigger activeCount={count} />}
              />
              <PopoverContent className="w-auto max-w-[96vw] p-0">
                <EmrTableFilterBuilder
                  fields={fields}
                  model={groups}
                  onModelChange={setGroups}
                  onClose={() => setPopup("")}
                />
              </PopoverContent>
            </Popover>
            <Pick
              label="진료 담당의"
              value={doctor || "any"}
              options={[
                ["any", "진료 담당의"],
                ...(page?.doctors ?? []).map(
                  (d) => [d.id, d.name] as [string, string],
                ),
                ...(doctor && !page?.doctors?.some((d) => d.id === doctor)
                  ? [[doctor, "선택한 담당의"] as [string, string]]
                  : []),
              ]}
              onChange={(v) => setDoctor(v === "any" ? "" : v)}
            />
            <EmrFilterToggle size="sm" pressed={mine} onPressedChange={setMine}>
              내 차트
            </EmrFilterToggle>
            <Popover
              open={popup === "date"}
              onOpenChange={(v) => setPopup(v ? "date" : "")}
            >
              <PopoverTrigger
                render={
                  <Button variant="outline" size="sm">
                    <CalendarIcon />
                    {from || to ? "기간 설정됨" : "진료일"}
                  </Button>
                }
              />
              <PopoverContent>
                <div className={styles.dates}>
                  <label>
                    시작일
                    <Input type="date" value={from} onValueChange={setFrom} />
                  </label>
                  <label>
                    종료일
                    <Input
                      type="date"
                      min={from}
                      value={to}
                      onValueChange={setTo}
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFrom("");
                      setTo("");
                    }}
                  >
                    기간 해제
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <ReceptionSearchInput
              aria-label="차트 검색어"
              placeholder="증상·진단·오더 검색"
              value={q}
              onValueChange={(v) => {
                setQ(v);
                setSort("relevance");
              }}
            />
            <Button
              size="sm"
              variant="outline"
              data-workspace-width-toggle="true"
              aria-pressed={narrow}
              onClick={() => setNarrow(!narrow)}
            >
              <WidthIcon />
              {narrow ? "넓게 보기" : "좁게 보기"}
            </Button>
          </div>
        }
      />
      {count > 0 && (
        <div className={styles.rules} aria-label="적용한 검색 조건">
          {groups.groups
            .flatMap((g) => {
              const applied = g.rules.flatMap((r) =>
                r.applied ? [r.applied] : [],
              );
              return applied.length
                ? [
                    applied
                      .map(
                        (r) =>
                          (fields.find((f) => f.id === r.fieldId)?.label ??
                            "") +
                          " " +
                          r.value,
                      )
                      .join(" " + g.combinator.toUpperCase() + " "),
                  ]
                : [];
            })
            .map((label, i) => (
              <span key={i}>
                {i > 0 && " " + groups.combinator.toUpperCase() + " "}
                <button onClick={() => setPopup("filter")}>{label}</button>
              </span>
            ))}
        </div>
      )}
      <div className={styles.body}>
        <div ref={scroll} className={styles.scroll}>
          <div className={styles.list} data-narrow={narrow}>
            <div className={styles.listhead}>
              <b>
                {changed ? "검색 결과" : "최근 완료 차트"}{" "}
                {page && <small>{page.total}</small>}
              </b>
              {changed && (
                <Button size="sm" variant="ghost" onClick={reset}>
                  초기화
                </Button>
              )}
              <label>
                <Switch
                  size="sm"
                  checked={drafts}
                  onCheckedChange={setDrafts}
                />
                작성 중 차트 포함
              </label>
            </div>
            {error ? (
              <div className={styles.empty} role="alert">
                {error}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={
                    page?.nextCursor
                      ? () => void more()
                      : () => setAttempt((a) => a + 1)
                  }
                >
                  다시 시도
                </Button>
              </div>
            ) : null}
            {page?.items.map((chart) => (
              <ChartRow
                key={chart.id}
                chart={chart}
                active={selected?.id === chart.id}
                query={q}
                onOpen={() => showSource(chart)}
                onCopy={(mode) => void showSource(chart, mode)}
              />
            ))}
            {!busy && !error && page?.total === 0 && (
              <div className={styles.empty}>
                <SearchIcon />
                조건에 맞는 차트가 없습니다.
                {changed && (
                  <Button variant="outline" size="sm" onClick={reset}>
                    검색 조건 초기화
                  </Button>
                )}
              </div>
            )}
            {busy && (
              <p role="status" className={styles.empty}>
                차트를 불러오는 중입니다.
              </p>
            )}
            {page?.nextCursor && (
              <Button
                className="m-4"
                disabled={busy}
                variant="outline"
                onClick={() => void more()}
              >
                더 보기
              </Button>
            )}
          </div>
        </div>
        {selected && (
          <ChartSource
            api={api}
            chart={selected}
            query={q}
            onOpenDocument={() =>
              onViewChart({
                chartId: selected.id,
                encounterId: selected.encounterId,
                patientId: selected.patientId,
                visitAt: selected.visitAt ?? selected.clinicalAt,
              })
            }
            onClose={closeSource}
            onCopy={(mode) => setCopy({ source: selected, mode })}
          />
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
              대상 차트 보기
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setNotice("")}>
            닫기
          </Button>
        </div>
      )}
      {copy && (
        <Transfer
          workspace={entry.workspaceId}
          api={api}
          source={copy.source}
          mode={copy.mode}
          contextId={entry.chartId}
          initial={copy.resume}
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
