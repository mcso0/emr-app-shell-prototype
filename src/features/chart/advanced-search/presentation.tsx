"use client";

import { errorMessage, type ChartSearchApi } from "./client";
import type { CopyHistoryItem } from "./contract";
import { useEffect, useState } from "react";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { Dialog } from "@/components/ui/dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  DocumentIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
} from "@/components/icons";
import { EmrRightPanelHeader } from "@/components/emr/right-panel-header";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  diagnosisLabels,
  representativeMedia,
  sectionNames,
  type SearchChart,
  type SearchMedia,
} from "./contract";
import { evidence, orderLabel, searchWords, speciesLabel } from "./ranking";
import styles from "./workspace.module.css";

export function Pick({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
    >
      <SelectTrigger size="sm" aria-label={label}>
        {options.find(([key]) => key === value)?.[1] ?? label}
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {options.map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
export const when = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
export const stateText = (s: string) =>
  s === "signed" ? "완료" : s === "amended" ? "정정" : "작성 중";
export const animal = speciesLabel;
export function Highlight({ value, query }: { value: string; query: string }) {
  const words = searchWords(query).sort((a, b) => b.length - a.length);
  const parts = [];
  let cursor = 0;
  const lower = value.toLocaleLowerCase();
  while (cursor < value.length) {
    const matches = words
      .map((word) => ({ word, index: lower.indexOf(word, cursor) }))
      .filter((m) => m.index >= 0)
      .sort((a, b) => a.index - b.index);
    const hit = matches[0];
    if (!hit) break;
    parts.push(
      value.slice(cursor, hit.index),
      <mark key={hit.index}>
        {value.slice(hit.index, hit.index + hit.word.length)}
      </mark>,
    );
    cursor = hit.index + hit.word.length;
  }
  return (
    <>
      {parts}
      {value.slice(cursor)}
    </>
  );
}
function PreviewMedia({
  item,
  controls = false,
}: {
  item: SearchMedia;
  controls?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={styles.placeholder}>미리보기 없음</span>;
  return item.video ? (
    <video
      controls={controls}
      preload="metadata"
      playsInline
      muted={!controls}
      aria-label={item.name}
      src={item.url + "#t=0.1"}
      onError={() => setFailed(true)}
    />
  ) : (
    // Authenticated attachment route needs the current browser session.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.url}
      alt={item.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
export function Thumbnail({
  chart,
  query,
}: {
  chart: SearchChart;
  query: string;
}) {
  const [index, setIndex] = useState(() =>
    representativeMedia(chart.media, query),
  );
  const item = chart.media[index];
  return (
    <div className={styles.thumb}>
      {item ? (
        <>
          <PreviewMedia key={item.id} item={item} />
          <span className={styles.counter}>
            {index + 1}/{chart.media.length}
            {item.video ? " · 동영상" : ""}
          </span>
          {chart.media.length > 1 && (
            <>
              <button
                type="button"
                aria-label="이전 첨부"
                className={styles.previous}
                onClick={() =>
                  setIndex(
                    (index + chart.media.length - 1) % chart.media.length,
                  )
                }
              >
                <ChevronLeftIcon />
              </button>
              <button
                type="button"
                aria-label="다음 첨부"
                className={styles.next}
                onClick={() => setIndex((index + 1) % chart.media.length)}
              >
                <ChevronRightIcon />
              </button>
            </>
          )}
        </>
      ) : (
        <div className={styles.placeholder}>
          <DocumentIcon />
          없음
        </div>
      )}
    </div>
  );
}
function matchingExcerpt(text: string, query: string) {
  const lower = text.toLocaleLowerCase();
  const hits = searchWords(query)
    .map((word) => lower.indexOf(word))
    .filter((index) => index >= 0);
  const start = hits.length ? Math.max(0, Math.min(...hits) - 18) : 0;
  return (
    (start ? "…" : "") +
    text.slice(start, start + 100) +
    (text.length > start + 100 ? "…" : "")
  );
}

export type CopyMode = "existing" | "new";
export function ChartRow({
  chart,
  query,
  active,
  onOpen,
  onCopy,
}: {
  chart: SearchChart;
  query: string;
  active: boolean;
  onOpen: () => void;
  onCopy: (mode: CopyMode) => void;
}) {
  const matches = evidence(chart, searchWords(query)).matches;
  const hit = matches[0];
  const diagnoses = hit?.label === "진단"
    ? [...chart.diagnoses].sort((a, b) => Number(b.name === hit.text) - Number(a.name === hit.text))
    : chart.diagnoses;
  const generic =
    !chart.purpose.trim() ||
    /^(현장 접수|방문|내원|진료|재진|초진)$/.test(chart.purpose.trim());
  const clinicalName = hit?.label === "진단" || hit?.label === "오더";
  const title =
    hit && (generic || clinicalName)
      ? hit.text
      : chart.purpose || chart.complaint || chart.patient + " 진료";
  let context: { label: string; text: string } | undefined = matches.find(
    (match) => match.text !== title && !["오더", "진단"].includes(match.label),
  );
  if (!context && clinicalName) {
    const note = chart.paragraphs.find(
      (p) => p.section === "subjective" || p.section === "objective",
    );
    const fallback = !generic
      ? { label: "방문 목적", text: chart.purpose }
      : chart.complaint
        ? { label: "주호소", text: chart.complaint }
        : note
          ? { label: sectionNames[note.section!], text: note.text }
          : null;
    if (fallback) context = fallback;
  }
  return (
    <article className={styles.row} data-active={active}>
      <Thumbnail
        key={chart.id + query + chart.version}
        chart={chart}
        query={query}
      />
      <button
        className={styles.summary}
        onClick={onOpen}
        aria-label={chart.patient + " 차트 원본 열기"}
      >
        <small>
          {when(chart.clinicalAt)}　·　{stateText(chart.status)}
        </small>
        <strong>
          <Highlight
            value={query.trim() ? matchingExcerpt(title, query) : title}
            query={query}
          />
        </strong>
        {context && (
          <span className={styles.snippet}>
            {context.label}　
            <Highlight
              value={matchingExcerpt(context.text, query)}
              query={query}
            />
          </span>
        )}
        <span>
          {[
            chart.patient,
            animal(chart.species),
            chart.breed,
            chart.age !== null ? chart.age + "세" : "",
            chart.guardian && chart.guardian + " 보호자",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span>
          작성 {chart.author || "미기록"}　·　담당 {chart.doctor || "미배정"}
        </span>
        <span className={styles.chips}>
          {[
            ...diagnoses.map((d) =>
              [diagnosisLabels[d.kind], d.name].filter(Boolean).join(" · "),
            ),
            ...chart.orders.map((o) => o.name),
          ]
            .slice(0, 5)
            .map((n, i) => (
              <em key={i}>
                <Highlight value={n} query={query} />
              </em>
            ))}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              aria-label={chart.patient + " 차트 복사"}
            >
              복사
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onCopy("existing")}>
            기존 차트에 복사
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCopy("new")}>
            새 차트로 만들기
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}
export function ChartSource({
  chart,
  query,
  onClose,
  onCopy,
  api,
  onOpenDocument,
}: {
  onOpenDocument: () => void;
  api: ChartSearchApi;
  chart: SearchChart;
  query: string;
  onClose: () => void;
  onCopy: (mode: CopyMode) => void;
}) {
  const [enlarged, setEnlarged] = useState<SearchMedia | null>(null);
  const highlight = (text: string) => <Highlight value={text} query={query} />;
  return (
    <aside
      className={styles.drawer}
      aria-label="차트 원본"
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        if (enlarged) setEnlarged(null);
        else if (e.currentTarget.contains(e.target as Node)) onClose();
      }}
    >
      <EmrRightPanelHeader className="justify-between border-b">
        <span className="inline-flex items-center gap-2">
          <ClipboardListIcon className="size-4" />
          차트 원본
        </span>
        <div className={styles.controls}>
          <Button size="sm" variant="ghost" onClick={onOpenDocument}>
            진료 차트 열기
          </Button>
          <Button autoFocus variant="ghost" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>
      </EmrRightPanelHeader>
      <div className={styles.detail}>
        <h2>
          {chart.patient} <EmrStatusBadge label={stateText(chart.status)} />
        </h2>
        <p>
          {[animal(chart.species), chart.breed, chart.guardian]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p>
          {when(chart.clinicalAt)}　·　작성 {chart.author}　·　담당{" "}
          {chart.doctor || "미배정"}
        </p>
        <div className={styles.purpose}>
          <small>방문 목적</small>
          <h3>{highlight(chart.purpose || "미기록")}</h3>
          {chart.complaint && <p>주호소　{highlight(chart.complaint)}</p>}
        </div>
        <h3>진료 기록</h3>
        {chart.paragraphs.length ? (
          chart.paragraphs.map((p) => (
            <div className={styles.line} key={p.id}>
              <b>
                {p.section ? sectionNames[p.section] : "자유 기록"}{" "}
                {p.scope && p.scope !== "기본 SOAP" ? p.scope : ""}
              </b>
              <p>{highlight(p.text)}</p>
            </div>
          ))
        ) : (
          <p>기록 없음</p>
        )}
        <h3>진단</h3>
        {chart.diagnoses.length ? (
          chart.diagnoses.map((d) => (
            <p key={d.id}>
              {diagnosisLabels[d.kind]}　{highlight(d.name)}{" "}
              {d.primary && " · 주진단"}
            </p>
          ))
        ) : (
          <p>기록 없음</p>
        )}
        <h3>오더</h3>
        {chart.orders.length ? (
          chart.orders.map((o) => (
            <p key={o.id}>
              {orderLabel(o.kind)}　{highlight(o.name)}
            </p>
          ))
        ) : (
          <p>기록 없음</p>
        )}
        <h3>첨부 자료</h3>
        {chart.media.length ? (
          <div className={styles.gallery}>
            {chart.media.map((m) => (
              <figure key={m.id}>
                <button
                  className={styles.mediaButton}
                  aria-label={m.name + " 확대"}
                  onClick={() => setEnlarged(m)}
                >
                  <PreviewMedia item={m} />
                </button>
                <figcaption>
                  {highlight(m.name)} {highlight(m.caption)}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p>없음</p>
        )}
        {enlarged && (
          <Dialog
            open
            onOpenChange={(v) => {
              if (!v) setEnlarged(null);
            }}
          >
            <EmrDialogShell
              title={enlarged.name}
              description={enlarged.caption || "첨부 원본"}
              variant="wide-form"
            >
              <div className={styles.enlarged}>
                <PreviewMedia item={enlarged} controls />
              </div>
            </EmrDialogShell>
          </Dialog>
        )}
        <CopyHistory key={chart.id} chartId={chart.id} api={api} />
      </div>
      <footer className={styles.footer}>
        <Button variant="outline" onClick={() => onCopy("new")}>
          새 차트로 만들기
        </Button>
        <Button onClick={() => onCopy("existing")}>기존 차트에 복사</Button>
      </footer>
    </aside>
  );
}

export function CopyHistory({
  chartId,
  api,
}: {
  chartId: string;
  api: ChartSearchApi;
}) {
  const [open, setOpen] = useState(false),
    [records, setRecords] = useState<CopyHistoryItem[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    api
      .history(chartId, abort.signal)
      .then((rows) => {
        if (!abort.signal.aborted) setRecords(rows);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(errorMessage(e));
      });
    return () => abort.abort();
  }, [api, chartId, open]);
  return (
    <section>
      <Button
        variant="outline"
        size="sm"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setError("");
        }}
      >
        복사 이력
      </Button>
      {open &&
        (error ? (
          <p role="alert">{error}</p>
        ) : records === null ? (
          <p>불러오는 중</p>
        ) : !records.length ? (
          <p>복사 이력 없음</p>
        ) : (
          records.map((r) => (
            <div className={styles.line} key={r.id}>
              <b>
                {when(r.at)} · 선택 {r.selectedBy} · 적용 {r.actor}
              </b>
              <p>
                원본　{r.source} · {r.sourceId}
              </p>
              {r.changes.map((c, i) => (
                <div key={i}>
                  {c.section
                    ? sectionNames[c.section]
                    : c.originalOrder
                      ? "미확정 오더"
                      : "진단"}
                  　{c.before?.text && <del>{c.before.text}　</del>}
                  {c.after?.text ?? c.after?.diagnosisText ?? c.name}
                </div>
              ))}
            </div>
          ))
        ))}
    </section>
  );
}
