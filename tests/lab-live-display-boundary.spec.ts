import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "@playwright/test";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = readFileSync("src/features/lab-imaging/module.tsx", "utf8");
test("live lab enables persisted result rows even in clair-demo; mock keeps its fixture", () => {
  const start = source.indexOf("export function LabContent(");
  const body = source.slice(start, source.indexOf("  const [savedEntryRevision", start));
  const script = ts.transpileModule(body.replace("export function", "function") +
    '\nreturn effectiveDetail; }\nLabContent({ workspaceId: "clair-demo" })', {}).outputText;
  for (const live of [true, false]) {
    let enabled: boolean | undefined;
    let mockFallback: boolean | undefined;
    const result = runInNewContext(script, {
      isLegacySalesDemoWorkspace: () => true,
      isLiveAuthRuntime: () => live,
      useSearchParams: () => ({}),
      useLabImagingStore: () => undefined,
      useLayoutStore: () => undefined,
      useSelectedOperatingDate: () => ({ selectedDate: "2026-09-07" }),
      useFulfillmentQueue: () => ({ workItems: [{ id: "work", orderId: "order" }] }),
      getLabDetailFromSearchParams: (_a: unknown, _b: unknown, _c: unknown, options: { allowMockFallback: boolean }) => {
        mockFallback = options.allowMockFallback;
        return { detail: { order: { id: "order" }, result: { rows: [{ value: "mock" }] } } };
      },
      useMemo: (fn: () => unknown) => fn(),
      useLabResultSheetCatalogRows: () => ({ rows: [] }),
      usePersistedLabResult: (_a: unknown, _b: unknown, _c: unknown, shouldLoad: boolean) => {
        enabled = shouldLoad;
        return { result: { rows: [{ value: "persisted" }] }, retry: () => undefined };
      },
    });
    assert.equal(enabled, live);
    assert.equal(mockFallback, !live);
    assert.equal(result.result.rows[0].value, live ? "persisted" : "mock");
  }
});

const ast = ts.createSourceFile(
  "module.tsx",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const selectedNames = new Set([
  "LabResultCommentSection",
  "AttachmentStrip",
  "ImagingReadingSections",
  "ImagingRightPanel",
  "ImagingOrderDetailTable",
  "getSnapshotString",
  "getLiveOrderFromWorkItem",
]);
const selected = ast.statements
  .filter(
    (node) =>
      ts.isFunctionDeclaration(node) &&
      node.name &&
      selectedNames.has(node.name.text),
  )
  .map((node) => node.getText(ast).replace(/^export /, ""))
  .join("\n");
const passThrough = ({ children }: { children?: React.ReactNode }) =>
  React.createElement("div", null, children);
const components = runInNewContext(
  ts.transpileModule(
    selected + "\nexports.components = {" + [...selectedNames].join(",") + "};",
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: {},
    React,
    Badge: passThrough,
    Button: "button",
    Textarea: "textarea",
    CdsActionsPlusIcon: () => null,
    CdsFilesImageIcon: () => null,
    CdsFilesFileIcon: () => null,
    labDemoImageAttachment: {
      id: "demo",
      fileName: "cbc-smear-preview.png",
      mimeType: "image/png",
      previewKind: "image",
    },
    getActionableLabRows: () => [{ analyteName: "WBC" }],
    formatFileSize: () => "1 KB",
    useCurrentImagingDetail: () => ({
      detail: { encounter: { id: "e1" }, study: {}, attachments: [] },
    }),
    useMemo: (callback: () => unknown) => callback(),
    useState: (value: unknown) => [value, () => {}],
    useReactTable: (options: unknown) => options,
    getCoreRowModel: () => () => {},
    EmrOrderGroupSection: passThrough,
    EmrTableDensitySelector: () => null,
    EmrDataTable: ({ table }: { table: {
      data: Record<string, unknown>[];
      columns: { id: string; cell: (props: { row: { original: Record<string, unknown> } }) => React.ReactNode }[];
    } }) => React.createElement("div", null, table.columns.filter(column => ["category", "requestedBy", "radiologist"].includes(column.id))
      .map(column => React.createElement("div", { key: column.id }, column.cell({ row: { original: table.data[0] } })))),
    isLegacySalesDemoWorkspace: () => false,
    isLiveAuthRuntime: () => true,
    EmrRightPanel: passThrough,
    EmrRightPanelHeader: passThrough,
    EmrRightPanelBody: passThrough,
    EmrRightPanelFooter: passThrough,
    ScrollArea: passThrough,
    Table: passThrough,
    TableBody: passThrough,
    ImagingMediaStrip: () => null,
    getLabWorkItems: () => [],
    getImagingWorkItems: () => [],
    getStaffName: () => "fixture-vet",
  },
);

function render(name: string, props: Record<string, unknown>) {
  return renderToStaticMarkup(React.createElement(components[name], props));
}

test("live lab comments expose no unsaved editor or automatic clinical interpretation", () => {
  const html = render("LabResultCommentSection", {
    result: { rows: [] },
    allowDemoContent: false,
  });
  assert.doesNotMatch(html, /textarea|WBC|재평가가 필요/);
  assert.match(html, /저장.*지원하지/);
  assert.match(
    render("LabResultCommentSection", {
      result: { rows: [] },
      allowDemoContent: true,
    }),
    /textarea.*WBC/,
  );
});

test("live attachment boundary retains actual files but rejects demo sample and unsupported add", () => {
  const html = render("AttachmentStrip", {
    attachments: [
      {
        id: "real",
        fileName: "actual-report.pdf",
        mimeType: "application/pdf",
      },
    ],
    showImageExample: true,
    allowDemoContent: false,
  });
  assert.match(html, /actual-report.pdf/);
  assert.doesNotMatch(html, /cbc-smear-preview/);
  assert.match(html, /button[^>]*disabled/);
  assert.match(html, /추가 미지원/);
  assert.match(
    render("AttachmentStrip", {
      attachments: [],
      showImageExample: true,
      allowDemoContent: true,
    }),
    /cbc-smear-preview/,
  );
});

test("live imaging reading and guardian sections show supported actual/history path without mock narratives", () => {
  const reading = render("ImagingReadingSections", {
    study: {},
    allowDemoContent: false,
  });
  const side = render("ImagingRightPanel", { workspaceId: "canonical-demo" });
  for (const html of [reading, side]) {
    assert.doesNotMatch(html, /textarea|위장관염|CBC|종합소견 text/);
    assert.match(html, /수행기록.*이력/);
  }
  assert.match(side, /button[^>]*disabled[^>]*>저장 미지원/);
  assert.match(
    render("ImagingReadingSections", { study: {}, allowDemoContent: true }),
    /위장관염/,
  );
});

test("imaging detail preserves actual modality and never fabricates ultrasound or fixture staff", () => {
  for (const modality of ["CT", "영상", "MRI"]) {
    const html = render("ImagingOrderDetailTable", {
      detail: { study: { modality } }, requesterName: "정보 없음", assigneeName: "담당자 지정됨",
    });
    assert.match(html, new RegExp(modality));
    assert.match(html, /정보 없음.*담당자 지정됨/);
    assert.doesNotMatch(html, /US|fixture-vet|이수지/);
  }
});

test("canonical order naming uses direct snapshot names and preserves request timestamp", () => {
  const base = {
    id: "w1",
    orderId: "o1",
    queueType: "imaging",
    workspaceId: "canonical-demo",
    createdAt: "2026-09-07T00:00:00Z",
  };
  const order = components.getLiveOrderFromWorkItem({
    ...base,
    sourceSnapshot: { effectiveDisplayName: "CT review" },
  });
  assert.equal(order.displayName, "CT review");
  assert.equal(order.requestedAt, base.createdAt);
  assert.equal(order.requestedByUserId, "");
  assert.equal(components.getLiveOrderFromWorkItem({ ...base, requestedByUserId: "actual-vet" }).requestedByUserId, "actual-vet");
  assert.equal(
    components.getLiveOrderFromWorkItem({
      ...base,
      sourceSnapshot: { inHospitalOrderName: "CBC" },
    }).displayName,
    "CBC",
  );
});

test("live boundary is passed to all content surfaces and request header uses request metadata", () => {
  for (const name of ["LabContent", "ImagingContent"]) {
    const node = ast.statements.find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
    );
    assert.ok(node);
    const text = node.getText(ast);
    assert.match(
      text,
      /isLegacySalesDemoWorkspace\(workspaceId\)[\s\S]*isLiveAuthRuntime\(\)/,
    );
    assert.match(text, /allowDemoContent=\{allowDemoContent\}/);
  }
  assert.match(
    source,
    /formatShortDateTime\(displayDetail\.order\?\.requestedAt\)/,
  );
  assert.doesNotMatch(source, /modality === "X-ray" \? "XR" : "US"/);
});
