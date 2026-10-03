import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "@playwright/test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = readFileSync("src/features/lab-imaging/module.tsx", "utf8");
const ast = ts.createSourceFile("module.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const panel = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "LabRightPanel")!;
const panelScript = ts.transpileModule(panel.getText(ast).replace(/^export /, "") + "\nexports.Panel = LabRightPanel; exports;", {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
type Read = { detail: unknown; status: string; retry: () => void };
const passThrough = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
const detail = {
  order: { id: "order-a" },
  result: { rows: [], receivedAt: "2026-10-01T12:00:00Z" },
  allEquipmentReceipts: [{ id: "previous-sensitive-receipt", orderId: "order-a" }],
};

function renderPanel(read: Read) {
  const bindings: Record<string, unknown> = {
    exports: {}, React, LabCurrentDetailContext: {}, useContext: () => read,
    useCurrentLabDetail: () => read,
    useLayoutStore: () => () => undefined,
    useState: (value: unknown) => [value, () => undefined],
    useMemo: (callback: () => unknown) => callback(),
    isLegacySalesDemoWorkspace: () => false,
    formatKoreanOperatingDateLabel: () => "수신 날짜",
    EmrRightPanel: ({ header, children }: { header: React.ReactNode; children: React.ReactNode }) => React.createElement("aside", null, header, children),
    EmrDateNavigator: ({ dateLabel }: { dateLabel: string }) => React.createElement("div", null, "날짜 ", dateLabel),
    EmrListHeader: ({ label, count, headerActions }: { label: string; count: React.ReactNode; headerActions: React.ReactNode }) => React.createElement("div", null, label, " ", count, headerActions),
    EmrListHeaderIconButton: ({ ariaLabel }: { ariaLabel: string }) => React.createElement("button", null, ariaLabel),
    EmrQueueLoadingState: ({ title }: { title: string }) => React.createElement("p", null, title),
    EmrEmptyState: ({ title, primaryAction }: { title: string; primaryAction: React.ReactNode }) => React.createElement("section", null, title, primaryAction),
    LabReceiptCard: ({ receipt }: { receipt: { id: string } }) => React.createElement("p", null, receipt.id),
    Dialog: () => null,
    EmrConfirmDialogContent: () => null,
    Button: "button",
  };
  for (const name of ["EmrRightPanelHeader", "EmrRightPanelHeaderIconButton", "EmrRightPanelBody", "ScrollArea"]) bindings[name] = passThrough;
  for (const name of ["CdsNavigationChevronsRightIcon", "CdsUtilitiesSortIcon", "CdsActionsListFilterIcon", "CdsActionsSearchIcon"]) bindings[name] = () => null;
  const evaluated = runInNewContext(panelScript, bindings);
  return renderToStaticMarkup(React.createElement(evaluated.Panel, { workspaceId: "test-lab" }));
}

test("receipt keeps title, date and tools while only the unresolved list loads", () => {
  const html = renderPanel({ detail: null, status: "loading", retry: () => undefined });
  for (const text of ["장비 검사 수신함", "날짜 -", "검사 결과 -", "장비 검사 수신함 정렬", "장비 검사 수신함 필터", "장비 검사 수신함 검색", "검사 정보를 불러오는 중입니다"]) assert.ok(html.includes(text), text);
  assert.ok(html.includes('aria-busy="true"'));
  assert.ok(!html.includes("현재 오더와 연결된 장비결과가 없습니다"));
});

test("known empty receipt list is immediate during a refresh", () => {
  const html = renderPanel({ detail: { ...detail, allEquipmentReceipts: [] }, status: "loading", retry: () => undefined });
  assert.ok(html.includes("검사 결과 0"));
  assert.ok(html.includes("현재 오더와 연결된 장비결과가 없습니다"));
  assert.ok(!html.includes("검사 정보를 불러오는 중입니다"));
});

for (const status of ["error", "permission_denied"]) {
  test(`receipt ${status} keeps chrome and withholds prior result rows`, () => {
    const html = renderPanel({ detail, status, retry: () => undefined });
    assert.ok(html.includes("장비 검사 수신함"));
    assert.ok(html.includes("검사 결과 -"));
    assert.ok(!html.includes("previous-sensitive-receipt"));
    assert.ok(!html.includes("현재 오더와 연결된 장비결과가 없습니다"));
    assert.equal(html.includes("재시도"), status === "error");
    if (status === "permission_denied") assert.ok(!html.includes("수신 날짜"));
  });
}
