import type { SearchChart, SearchParams, Section } from "./advanced-search/contract";
import { searchPage } from "./advanced-search/ranking";
import type { DemoHistoryItem } from "./demo-history-contract";

const sections: Record<keyof DemoHistoryItem["soap"], Section> = {
  S: "subjective", O: "objective", A: "assessment", P: "plan",
};
const noItems: DemoHistoryItem[] = [];

export function toDemoChart(item: DemoHistoryItem): SearchChart {
  return {
    id: item.id, patientId: item.patientId, encounterId: "", version: "",
    patient: item.patient, guardian: "", author: "", authorId: "", doctor: "", doctorId: null,
    species: item.species, breed: "", age: null, clinicalAt: item.visitAt, visitAt: item.visitAt,
    purpose: item.title, complaint: "", status: "demo_history", editable: false, media: [],
    paragraphs: (Object.keys(sections) as (keyof typeof sections)[]).map((key) => ({
      id: item.id + "-" + key, section: sections[key], scope: "기본 SOAP", text: item.soap[key],
    })),
    diagnoses: item.diagnosis ? [{
      id: item.id + "-diagnosis", name: item.diagnosis.name, kind: item.diagnosis.kind,
      primary: true, catalogId: null, system: "",
    }] : [],
    orders: item.orders.map(o => ({
      id: item.id + "-" + o.catalogId, name: o.name, catalogId: o.catalogId,
      kind: o.module === "lab" ? "clinical_lab" : o.module,
      available: null, price: null, quantity: 1, inputs: {},
    })),
  };
}

export function filterDemoHistory(items: DemoHistoryItem[], params: SearchParams) {
  // Archived records cannot be my charts, attributed to a doctor, or editable targets.
  if (!items.length || params.mine || params.doctor || params.targets || params.chartId) return noItems;
  const byId = new Map(items.map(i => [i.id, i]));
  return searchPage(items.map(toDemoChart), {
    ...params, cursor: null, includeDrafts: true,
  }, "").items.flatMap(c => {
    const item = byId.get(c.id);
    return item ? [item] : [];
  });
}
