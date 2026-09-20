import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JsxEmit, transpileModule } from "typescript";
import { isLegacySalesDemoWorkspace } from "../src/lib/emr-domain/demo-workspaces";

const source = readFileSync("src/features/chart/module.tsx", "utf8");
const declarations = (name: string) => {
  const declaration = source.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n\\}(?=\\n|$)`))?.[0];
  if (!declaration) throw new Error(`Missing source function: ${name}`);
  return transpileModule(declaration, { compilerOptions: { jsx: JsxEmit.React } }).outputText;
};
const predicates = [...source.matchAll(/const (?:allowMockFallback|legacySalesDemo) =\s*([\s\S]*?);/g)]
  .map((match) => match[1]);

function runtime(authProvider: "mock" | "supabase") {
  return { getAuthRuntimeMode: () => ({ authProvider }), isLegacySalesDemoWorkspace };
}

test("all chart fallback consumers require the explicit mock runtime", () => {
  expect(predicates).toHaveLength(5);
  for (const workspaceId of ["clair-demo", "workspace-clair-cheongdam", "workspace-clinical-master-pilot-v1"]) {
    for (const authProvider of ["mock", "supabase"] as const) {
      expect(predicates.map((expression) => runInNewContext(expression, { workspaceId, ...runtime(authProvider) })))
        .toEqual(Array(5).fill(workspaceId === "clair-demo" && authProvider === "mock"));
    }
  }
});

function activeBundle({ live, scopeMatches = true, selectedId = "encounter-coco", records = [] }: {
  live: boolean; scopeMatches?: boolean; selectedId?: string; records?: Array<{ id: string }>;
}) {
  const mockReads: string[] = [];
  const result = runInNewContext([
    declarations("getSelectedBundle"), declarations("useActiveChartBundle"),
    'useActiveChartBundle("clair-demo")',
  ].join("\n"), {
    ...runtime(live ? "supabase" : "mock"),
    legacySalesDemoDefaultEncounterId: "encounter-coco",
    useChartStore: (select: (state: unknown) => unknown) => select({ selectedEncounterId: selectedId }),
    useScopedChartLiveQueue: () => ({ queueScopeMatches: scopeMatches, records }),
    getLiveQueueBundle: (id: string, rows: Array<{ id: string }>) => rows.find((row) => row.id === id) ?? null,
    getLiveHandoffBundle: () => null,
    getChartEncounter: (id: string) => { mockReads.push(id); return { id, mock: true }; },
  });
  return { result, mockReads };
}

for (const scopeMatches of [true, false]) {
  test(`live empty/unresolved chart never reads sample bundles (scope=${scopeMatches})`, () => {
    expect(activeBundle({ live: true, scopeMatches })).toEqual({ result: null, mockReads: [] });
  });
}

test("live exact UUID remains selectable and no legacy bundle is read", () => {
  const id = "439cb9c0-94df-482b-8d99-00a4cc4525f7";
  expect(activeBundle({ live: true, selectedId: id, records: [{ id }] }))
    .toEqual({ result: { id }, mockReads: [] });
});

test("mock sales demo retains its existing sample fallback", () => {
  expect(activeBundle({ live: false }).result).toEqual({ id: "encounter-coco", mock: true });
});

test("live chart today uses the actual operating date while preserving explicit selected date", () => {
  for (const authProvider of ["mock", "supabase"] as const) {
    for (const selected of [undefined, "2026-05-30"]) {
      const result = runInNewContext(`${declarations("useChartOperatingDate")}\nuseChartOperatingDate("clair-demo")`, {
        ...runtime(authProvider),
        useSearchParams: () => new URLSearchParams(selected ? `date=${selected}` : ""),
        useEffect: (effect: () => void) => effect(),
        useSelectedOperatingDate: (_workspaceId: string, requestedDate?: string | null) => ({
          selectedDate: requestedDate ?? (authProvider === "supabase" ? "2026-09-07" : "2026-05-01"),
          todayDate: authProvider === "supabase" ? "2026-09-07" : "2026-05-01",
        }),
        useChartStore: (select: (state: unknown) => unknown) => select({
          selectedOperatingDateByWorkspace: {
            "clair-demo": selected ? "2026-04-30" : undefined,
          },
          selectOperatingDate: () => undefined,
        }),
      });
      const expectedToday = authProvider === "supabase" ? "2026-09-07" : "2026-05-01";
      expect(result.todayDate).toBe(expectedToday);
      expect(result.selectedDate).toBe(selected ?? expectedToday);
    }
  }
});

test("shared work queue clock uses live dates at initialization and refresh without changing mock dates", () => {
  const hookSource = readFileSync("src/features/work-queue/use-selected-operating-date.ts", "utf8");
  const hook = hookSource.slice(hookSource.indexOf("export function")).replace("export function", "function");
  for (const authProvider of ["mock", "supabase"] as const) {
    const refreshed: unknown[] = [];
    const result = runInNewContext(`${transpileModule(hook, {}).outputText}\nuseSelectedOperatingDate("clair-demo")`, {
      ...runtime(authProvider),
      getCurrentOperatingDate: () => "2026-09-07",
      getWorkspaceOperatingDate: () => "2026-05-01",
      useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, (next: unknown) => refreshed.push(next)],
      useCallback: (fn: () => void) => { fn(); return fn; },
      useEffect: () => undefined,
    });
    const expectedToday = authProvider === "supabase" ? "2026-09-07" : "2026-05-01";
    expect(refreshed).toEqual([expectedToday]);
    expect(result.todayDate).toBe(expectedToday);
    expect(result.selectedDate).toBe(expectedToday);
  }
});

test("demo scenario synchronization cannot select sample aliases in live auth", () => {
  for (const authProvider of ["mock", "supabase"] as const) {
    const selected: string[] = [];
    runInNewContext(`${declarations("useScenarioEncounterSync")}\nuseScenarioEncounterSync("clair-demo")`, {
      ...runtime(authProvider),
      useSearchParams: () => ({}),
      useRef: (current: unknown) => ({ current }),
      useEffect: (effect: () => void) => effect(),
      useChartStore: (select: (state: unknown) => unknown) => select({
        selectedEncounterId: "", selectEncounter: (id: string) => selected.push(id),
      }),
      useScopedChartLiveQueue: () => ({ records: [], status: "loading" }),
      getDemoScenarioFromParams: () => ({ encounterId: "encounter-coco" }),
      getChartEncounter: () => ({ id: "encounter-coco" }),
    });
    expect(selected).toEqual(authProvider === "mock" ? ["encounter-coco"] : []);
  }
});

for (const fieldValue of [undefined, "00000000-0000-4000-8000-000000000002"]) {
  test(`runtime-owned consultation clinician is not editable (assigned=${Boolean(fieldValue)})`, () => {
    const definition = {
      key: "responsibleClinicianId", label: "담당자", control: "select",
      options: [], validation: {}, valueType: "string", required: true, preConfirmEditable: true,
    };
    for (const name of ["ChartOrderInlineFieldCell", "ChartOrderFieldControl"]) {
      const component = runInNewContext(`${declarations(name)}\n${name}`, {
        React,
        Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => React.createElement("input", props),
        EmrTableCellText: ({ children, fullText }: { children: React.ReactNode; fullText: string }) => React.createElement("span", { title: fullText }, children),
        cn: (...values: Array<string | false>) => values.filter(Boolean).join(" "),
        getChartOrderFieldValue: () => fieldValue,
        isChartOrderConfirmedRow: () => false,
        formatChartOrderFieldValue: () => fieldValue ?? "—",
      });
      const html = renderToStaticMarkup(React.createElement(component, {
        definition, value: fieldValue, disabled: false, writeDisabled: false,
        row: { order: { id: "synthetic", displayName: "초진" }, clinicalOrderType: "consultation" },
        orderName: "초진", onChange: () => undefined,
        onUpdateDetailInput: () => undefined, onFlushDraft: () => undefined,
      }));
      if (name === "ChartOrderFieldControl") expect(html).toContain('readOnly=""');
      else expect(html).not.toContain("<input");
      if (fieldValue) expect(html).toContain(fieldValue);
      else expect(html).toContain("미배정");
    }
  });
}
