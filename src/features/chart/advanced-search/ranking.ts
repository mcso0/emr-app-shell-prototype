import {
  filterRowsByEmrTableFilterBuilder,
  type EmrTableFilterBuilderField,
} from "@/components/emr/table-filter-builder-model";
import { getOperatingDateFromIso } from "@/lib/emr-domain/demo-date";
import {
  sectionNames,
  type SearchIndexRow,
  type SearchParams,
  type SearchPage,
} from "./contract";

import { orderSetSpeciesLabels } from "@/features/hospital-admin/order-set-management";

export function speciesLabel(value: string) {
  return Object.hasOwn(orderSetSpeciesLabels, value)
    ? orderSetSpeciesLabels[value as keyof typeof orderSetSpeciesLabels]
    : value;
}

const definitions: EmrTableFilterBuilderField<SearchIndexRow>[] = [
  { id: "patient", label: "동물명", getValue: (c) => c.patient },
  { id: "guardian", label: "보호자명", getValue: (c) => c.guardian },
  {
    id: "species",
    label: "동물종",
    getValue: (c) => [c.species, speciesLabel(c.species)],
  },
  { id: "breed", label: "품종", getValue: (c) => c.breed },
  {
    id: "system",
    label: "진단 계통",
    getValue: (c) => c.diagnoses.map((d) => d.system),
  },
  {
    id: "dx",
    label: "진단명",
    getValue: (c) => c.diagnoses.map((d) => d.name),
  },
  {
    id: "order",
    label: "오더명",
    getValue: (c) => c.orders.map((o) => o.name),
  },
  {
    id: "tests",
    label: "검사 오더 있음",
    getValue: (c) =>
      c.orders
        .map((o) => orderLabel(o.kind))
        .filter((k) => ["임상병리", "영상"].includes(k)),
  },
];
export const fields: EmrTableFilterBuilderField<SearchIndexRow>[] =
  definitions.map((field) => ({
    ...field,
    valueKind:
      field.id === "tests" || field.id === "species" ? "select" : "text",
    options:
      field.id === "tests"
        ? ["임상병리", "영상"].map((v) => ({ value: v, label: v }))
        : field.id === "species"
          ? Object.values(orderSetSpeciesLabels).map((v) => ({
              value: v,
              label: v,
            }))
          : undefined,
  }));
for (const [id, label] of [["visitDate", "진료일"], ["createdDate", "차트 작성일"]]) {
  fields.push({
    id, label, valueKind: "text", valuePlaceholder: "YYYY-MM-DD",
    getValue: row => getOperatingDateFromIso(id === "visitDate" ? row.visitAt : row.createdAt) ?? "",
    operators: ([["on", "같음"], ["from", "이후 (포함)"], ["to", "이전 (포함)"]]).map(([operator, name]) => ({
      id: operator, label: name,
      match(value, date) {
        if (typeof value !== "string" || !value || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
        const parsed = Date.parse(date);
        if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== date) return false;
        return operator === "on" ? value === date : operator === "from" ? value >= date : value <= date;
      }
    }))
  });
}
export function orderLabel(kind: string) {
  return (
    (
      {
        dispensing: "약",
        medication: "약",
        lab: "임상병리",
        clinical_lab: "임상병리",
        external_lab: "임상병리",
        imaging: "영상",
        treatment: "처치",
      } as Record<string, string>
    )[kind] ?? kind
  );
}
export const searchWords = (query = "") => [
  ...new Set(query.toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean)),
];
const absence =
  /^(?:은|는|이|가|을|를|도)?[ \t]*[:：]?[ \t]*(?:\([ \t]*[-−][ \t]*\)|(?:(?:증상|소견|호소|한 적)(?:은|는|이|가)?[ \t]*)?없(?:음|었음|다(?:고)?|었다(?:고)?|었으나|었으며|었고|고|으며|으나|어요|었어요|습니다|었습니다)|안[ \t]*(?:함|했음|했다|합니다|했습니다)|(?:(?:증상|소견)(?:은|는|이|가)?[ \t]*)?(?:하지|관찰되지|확인되지|발견되지|보이지)[ \t]*않(?:음|았음|았다(?:고)?|는다(?:고)?|습니다|았습니다))(?=$|[\s.,·，;:!?/)]|으로|이라고|이며|이고)/u;
function ordinary(text: string, word: string, words: string[]) {
  for (
    let at = text.indexOf(word);
    at >= 0;
    at = text.indexOf(word, at + word.length)
  ) {
    const tail = text.slice(at + word.length);
    const singlePeer =
      /^(?:[ \t]*[·ㆍ][ \t]*|[ \t]+및[ \t]+)([가-힣a-z]+)[ \t]+/u.exec(tail);
    const cue =
      absence.exec(tail)?.[0] ??
      (singlePeer && absence.exec(tail.slice(singlePeer[0].length))?.[0]);
    if (
      !cue ||
      words.some((w) => /^(없|않|안|\([-−]\))/.test(w) && cue.includes(w))
    )
      return true;
  }
  return false;
}
export function evidence(chart: SearchIndexRow, words: string[]) {
  const matches: {
    label: string;
    text: string;
    score: number;
    negative: boolean;
  }[] = [];
  const covered = new Set<string>(),
    positive = new Set<string>();
  const add = (
    label: string,
    value: string,
    priority: number,
    exact = priority,
  ) => {
    const text = value.toLocaleLowerCase();
    const found = words.filter((w) => text.includes(w));
    if (!found.length) return;
    found.forEach((w) => covered.add(w));
    const normal = found.filter((w) => ordinary(text, w, words));
    normal.forEach((w) => positive.add(w));
    matches.push({
      label,
      text: value,
      score: text === words.join(" ") ? exact : priority,
      negative: !normal.length,
    });
  };
  chart.diagnoses.forEach((d) => add("진단", d.name, 84, 120));
  chart.orders.forEach((o) => add("오더", o.name, 83, 120));
  add("방문 목적", chart.purpose, 80);
  add("주호소", chart.complaint, 77);
  chart.paragraphs.forEach((p) =>
    add(
      p.section ? sectionNames[p.section] : "자유 기록",
      p.text,
      p.section === "subjective" || p.section === "objective" ? 73 : 59,
    ),
  );
  matches.sort(
    (a, b) => Number(a.negative) - Number(b.negative) || b.score - a.score,
  );
  return {
    included: covered.size === words.length,
    negative: positive.size < words.length,
    score: matches[0]?.score ?? 0,
    matches,
  };
}
export function searchPage<T extends SearchIndexRow>(
  charts: T[],
  params: SearchParams,
  actor: string,
): SearchPage<T> {
  const words = searchWords(params.query);
  const filtered = params.groups
    ? filterRowsByEmrTableFilterBuilder<T>(charts, params.groups, fields)
    : charts;
  const hits = filtered.flatMap((chart) => {
    const date =
      params.from || params.to
        ? (getOperatingDateFromIso(chart.clinicalAt) ?? "")
        : "";
    if (
      chart.id === params.excludeId ||
      (params.chartId && chart.id !== params.chartId) ||
      (params.targets && !chart.editable) ||
      (!params.chartId &&
        !params.targets &&
        !params.includeDrafts &&
        !["signed", "amended"].includes(chart.status)) ||
      (params.mine && chart.authorId !== actor && (params.targets || chart.doctorId !== actor)) ||
      (params.doctor &&
        ![chart.doctorId, chart.doctor].includes(params.doctor)) ||
      (params.from && date < params.from) ||
      (params.to && date > params.to)
    )
      return [];
    const hit = evidence(chart, words);
    return hit.included ? [{ chart, ...hit }] : [];
  });
  hits.sort((a, b) => {
    if (params.targets) {
      const mine =
        Number(b.chart.authorId === actor) - Number(a.chart.authorId === actor);
      if (mine) return mine;
    }
    if (!params.sort || params.sort === "relevance") {
      const relevance =
        Number(a.negative) - Number(b.negative) || b.score - a.score;
      if (relevance) return relevance;
    }
    const date =
      Date.parse(a.chart.clinicalAt) - Date.parse(b.chart.clinicalAt);
    return (
      (params.sort === "oldest" ? date : -date) ||
      a.chart.id.localeCompare(b.chart.id)
    );
  });
  const index = params.cursor
    ? hits.findIndex((h) => h.chart.id === params.cursor) + 1
    : 0;
  if (params.cursor && !index) throw new Error("invalid_cursor");
  const items = hits.slice(index, index + 25).map((x) => x.chart);
  const doctors = Array.from(
    new Map(
      charts.flatMap((c) =>
        c.doctorId && c.doctor
          ? [[c.doctorId, { id: c.doctorId, name: c.doctor }] as const]
          : [],
      ),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return {
    items,
    doctors,
    total: hits.length,
    nextCursor: index + items.length < hits.length ? items.at(-1)!.id : null,
  };
}
