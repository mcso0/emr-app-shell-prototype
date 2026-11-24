"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ChartSearchApi } from "@/features/chart/advanced-search/client";
import { diagnosisLabels, sectionNames, type SearchChart, type Section } from "@/features/chart/advanced-search/contract";
import { searchPage } from "@/features/chart/advanced-search/ranking";
import { ChartSearchWorkspace } from "@/features/chart/advanced-search/workspace";
import type { CheongdamReviewRecord } from "./contract";

// The private server page passes the fictional records only after authorization.
function createReadOnlyApi(records: readonly CheongdamReviewRecord[]): ChartSearchApi {
  const rows: SearchChart[] = records.map((visit) => ({
    id: visit.id,
    version: visit.id + "-v1",
    encounterId: visit.id + "-encounter",
    patientId: visit.patientId,
    patient: visit.patient,
    guardian: "",
    species: visit.species,
    breed: "",
    age: null,
    clinicalAt: visit.visitAt,
    visitAt: visit.visitAt,
    // Deliberately no live author or practitioner attribution.
    authorId: "",
    author: "",
    doctorId: null,
    doctor: "",
    status: "signed", // Search-contract display state only; no signature is created.
    purpose: visit.title,
    complaint: "",
    editable: false,
    paragraphs: Object.entries(visit.soap).map(([key, value], index) => {
      const section = ({ S: "subjective", O: "objective", A: "assessment", P: "plan" } as const)[key as keyof typeof visit.soap] satisfies Section;
      return { id: visit.id + "-p" + index, section, scope: section, text: value };
    }),
    diagnoses: visit.diagnosis ? [{
      id: visit.id + "-diagnosis",
      name: visit.diagnosis.name,
      kind: visit.diagnosis.kind,
      primary: true,
      system: "",
      catalogId: null,
    }] : [],
    orders: visit.orders.map((order, index) => ({
      id: visit.id + "-o" + index,
      name: order.name,
      catalogId: null,
      kind: order.module === "lab" ? "clinical_lab" : order.module,
      available: null,
      price: null,
      quantity: 1,
      inputs: {},
    })),
    taskStatuses: visit.orders.length ? ["complete"] : [],
    media: [],
  }));

  const unavailable = async (): Promise<never> => { throw new Error("review_read_only"); };

  // Inject the complete adapter; the fixture never calls the real workspace API.
  return {
    async search(params) { return searchPage(rows, params, ""); },
    async patientCharts(patientId) { return { items: rows.filter((x) => x.patientId === patientId), nextCursor: null }; },
    async visits() { return []; },
    async history() { return []; },
    async pending() { return null; },
    apply: unavailable,
    park: unavailable,
    discard: unavailable,
    exportSummaries: unavailable,
  };
}

const date = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" });

export function CheongdamReview({ records }: { records: readonly CheongdamReviewRecord[] }) {
  const api = useMemo(() => createReadOnlyApi(records), [records]);
  const [chartId, setChartId] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const record = chartId ? records.find((item) => item.id === chartId) : undefined;

  return (
    <main className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex min-h-12 flex-wrap items-center gap-3 border-b px-4 py-2 text-sm">
        <strong>청담 시연</strong>
        <span className="text-muted-foreground">가상의 진료 기록 · 읽기 전용 · 실제 저장되지 않음</span>
      </header>
      <div className="relative min-h-0 flex-1" hidden={!!record || !open}>
        <ChartSearchWorkspace
          entry={{ workspaceId: "preview-cheongdam-history" }}
          api={api}
          onClose={() => setOpen(false)}
          onViewChart={({ chartId: id }) => setChartId(id)}
          readOnly
        />
      </div>
      {!open && !record && <Button className="m-4 self-start" onClick={() => setOpen(true)}>차트 검색 열기</Button>}
      {record && (
        <article className="mx-auto grid w-full max-w-3xl gap-5 overflow-auto px-6 py-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{record.patient} · {date.format(new Date(record.visitAt))}</p>
              <h1 className="text-xl font-semibold">{record.title}</h1>
            </div>
            <Button variant="outline" onClick={() => setChartId(null)}>검색 결과로 돌아가기</Button>
          </div>
          {Object.entries(sectionNames).map(([key, label], index) => (
            <section key={key}>
              <h2 className="font-semibold">{label}</h2>
              <p>{record.soap[(["S", "O", "A", "P"] as const)[index]]}</p>
            </section>
          ))}
          {record.diagnosis && (
            <section aria-label="진단">
              <h2 className="font-semibold">진단</h2>
              <p>{record.diagnosis.name} · {diagnosisLabels[record.diagnosis.kind]}</p>
            </section>
          )}
          {!!record.orders.length && (
            <section className="grid gap-2" aria-label="오더 및 결과">
              <h2 className="font-semibold">오더 및 결과</h2>
              {record.orders.map((order) => (
                <div key={order.name} className="rounded-md border p-3">
                  <strong>{order.name}</strong> <span>· 완료</span>
                  {order.interpretation && (
                    <details className="mt-2">
                      <summary>검사 결과 보기</summary>
                      <p className="mt-2">{order.interpretation}</p>
                      <p className="text-sm text-muted-foreground">시연 이력: 결과 입력 → 검사 완료</p>
                    </details>
                  )}
                </div>
              ))}
            </section>
          )}
        </article>
      )}
    </main>
  );
}
