import type { EmrTableFilterBuilderModel } from "@/components/emr/table-filter-builder-model";

export const sectionNames = {
  subjective: "S · 문진",
  objective: "O · 관찰",
  assessment: "A · 평가",
  plan: "P · 계획",
} as const;
export type Section = keyof typeof sectionNames;
export type SearchParagraph = {
  id: string;
  section: Section | null;
  scope: string;
  replaceable?: boolean;
  text: string;
};
export type SearchDiagnosis = {
  id: string;
  name: string;
  catalogId: string | null;
  kind: string;
  primary: boolean;
  system: string;
};
export type SearchOrder = {
  id: string;
  name: string;
  catalogId: string | null;
  kind: string;
  /** Null when the viewer cannot read the current catalog. */
  available: boolean | null;
  unavailableReason?: "order_set" | "inactive" | "missing" | null;
  price: number | null;
  quantity: number;
  inputs: Record<string, unknown>;
};
export type SearchMedia = {
  id: string;
  name: string;
  caption: string;
  url: string;
  video: boolean;
};
export type SearchChart = {
  visitAt?: string;
  id: string;
  encounterId: string;
  patientId: string;
  patient: string;
  guardian: string;
  species: string;
  breed: string;
  age: number | null;
  clinicalAt: string;
  authorId: string;
  author: string;
  doctorId: string | null;
  doctor: string;
  status: string;
  purpose: string;
  complaint: string;
  editable: boolean;
  version: string;
  paragraphs: SearchParagraph[];
  diagnoses: SearchDiagnosis[];
  orders: SearchOrder[];
  media: SearchMedia[];
};
export type SearchVisit = {
  visitAt?: string;
  purpose?: string;
  id: string;
  patientId: string;
  patient: string;
  guardian: string;
  status: string;
};
export type SearchParams = {
  query?: string;
  includeDrafts?: boolean;
  mine?: boolean;
  doctor?: string;
  from?: string;
  to?: string;
  sort?: "relevance" | "recent" | "oldest";
  groups?: EmrTableFilterBuilderModel;
  cursor?: string | null;
  targets?: boolean;
  chartId?: string;
  excludeId?: string;
};
export type SearchIndexRow = Pick<
  SearchChart,
  | "id"
  | "clinicalAt"
  | "editable"
  | "status"
  | "authorId"
  | "doctorId"
  | "doctor"
  | "purpose"
  | "complaint"
  | "patient"
  | "guardian"
  | "species"
  | "breed"
> & {
  paragraphs: Pick<SearchParagraph, "section" | "text">[];
  diagnoses: Pick<SearchDiagnosis, "name" | "system">[];
  orders: Pick<SearchOrder, "name" | "kind">[];
};
export type SearchPage<T extends SearchIndexRow = SearchChart> = {
  doctors?: { id: string; name: string }[];
  items: T[];
  total: number;
  nextCursor: string | null;
};
export type CopySelection = {
  paragraphs: { id: string; replaceId?: string }[];
  diagnoses: { id: string; kind: string; primary: boolean }[];
  orders: {
    id: string;
    dose?: string;
    frequency?: string;
    days?: string;
    duplicate?: boolean;
    price: number | null;
  }[];
};
export type CopyIntent = {
  requestId: string;
  sourceId: string;
  sourceVersion: string;
  targetId?: string;
  targetVersion?: string;
  encounterId: string;
  patientId: string;
  selection: CopySelection;
  newChart?: boolean;
  pendingId?: string;
};
export type PendingCopy = {
  id: string;
  orderPermissionRequired?: boolean;
  sourceId: string;
  sourceVersion: string;
  encounterId: string;
  patientId: string;
  selection: CopySelection;
};
export type CopyResult = {
  unchanged?: boolean;
  visitAt?: string;
  chartId: string;
  encounterId: string;
  patientId: string;
  requestId: string;
};
export function hasSameDiagnosis(a: SearchDiagnosis, b: SearchDiagnosis) {
  return (
    (!!a.catalogId && a.catalogId === b.catalogId) ||
    a.name.toLowerCase() === b.name.toLowerCase()
  );
}

export function prescriptionUnit(inputs: SearchOrder["inputs"]) {
  const unit = String(inputs.doseUnit ?? "");
  if (!unit || unit.includes("/")) return unit;
  if (inputs.doseBasis === "kg") return unit + "/kg";
  if (inputs.doseBasis === "body_surface_area") return unit + "/m²";
  return unit;
}

export function orderDescription(order: SearchOrder) {
  const { dose, frequency, durationDays } = order.inputs;
  return [
    order.name,
    dose != null &&
      [dose, prescriptionUnit(order.inputs)].filter(Boolean).join(" "),
    medicationFrequencies.find(([v]) => v === frequency)?.[1] ?? frequency,
    durationDays != null && durationDays + "일",
  ]
    .filter(Boolean)
    .join(" · ");
}

export const blankSelection = (): CopySelection => ({
  paragraphs: [],
  diagnoses: [],
  orders: [],
});
export const medicationFrequencies: [string, string][] = [
  ["once", "1회"],
  ["sid", "하루 1회"],
  ["bid", "하루 2회"],
  ["tid", "하루 3회"],
  ["qid", "하루 4회"],
  ["prn", "필요시"],
  ["custom", "직접 지정"],
];

export const diagnosisLabels: Record<string, string> = {
  confirmed: "확진",
  suspected: "의심",
  differential: "감별",
  provisional: "의심",
};

export function representativeMedia(items: SearchMedia[], query: string) {
  const words = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const position = items.findIndex((item) =>
    words.some(
      (word) =>
        item.name.toLowerCase().includes(word) ||
        item.caption.toLowerCase().includes(word),
    ),
  );
  return Math.max(position, 0);
}

export type CopyHistoryItem = {
  id: string;
  at: string;
  actor: string;
  source: string;
  sourceId: string;
  changes: {
    section?: Section;
    before?: { text: string } | null;
    after?: { text?: string; diagnosisText?: string };
    originalOrder?: string;
    name?: string;
  }[];
};
