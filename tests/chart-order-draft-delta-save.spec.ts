import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync("src/features/chart/module.tsx", "utf8");
const ast = ts.createSourceFile("chart.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set([
  "saveChartOrderDraftRoute",
  "isChartOrderDraftRowDirty",
  "getChartOrderSetSelectionIntentForDraftRow",
  "getChartOrderDraftCatalogItemId",
]);
const extracted = ast.statements.filter((statement) =>
  ts.isFunctionDeclaration(statement)
    ? statement.name && names.has(statement.name.text)
    : ts.isVariableStatement(statement) && statement.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && names.has(declaration.name.text),
      ),
).map((statement) => statement.getText(ast)).join("\n");
expect(extracted).toContain("async function saveChartOrderDraftRoute");
expect(extracted).toContain("const isChartOrderDraftRowDirty");

const etag = `"${"a".repeat(64)}"`;
type TestRow = ReturnType<typeof individual>;
function individual(id: string, persisted = true) {
  return {
    order: { id, workspaceCatalogItemId: `catalog-${id}`, status: "draft" },
    billingName: id,
    committedBillingName: id,
    quantityInput: "1",
    committedQuantityInput: "1",
    detailInputs: { note: "pinned value" },
    detailSchemaVersion: 1,
    priority: "normal",
    ...(persisted ? {
      runtimeRow: {
        rowType: "individual",
        detailInputs: { note: "pinned value" },
        detailSchemaVersion: 1,
        priority: "normal",
        appliedSnapshot: { sourceMasterRevision: 3, priceKrw: 52004 },
        calculationInputs: {},
      },
    } : {}),
  };
}

async function serialize(rows: unknown[], removedOrderIds: string[] = [], expectedEtag = etag) {
  const requests: { rows: Array<Record<string, unknown>>; removedOrderIds: string[]; expectedEtag: string }[] = [];
  const save = runInNewContext(ts.transpileModule(
    `${extracted}\nglobalThis.save = saveChartOrderDraftRoute;`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText, {
    isChartOrderConfirmedRow: (row: TestRow) => row.order.status === "confirmed",
    getDraftQuantity: (value: string) => Number(value),
    mergeChartOrderRuntimeDetailInputs: ({ detailInputs }: TestRow) => detailInputs,
    readChartOrderSetSelectionIntent: (value: unknown) => value,
    chartOrderExpectedEtagHeader: "If-Match",
    fetch: async (_url: string, options: { body: string }) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ ok: true, etag }) };
    },
  });
  await save({ encounterId: "synthetic-encounter", expectedEtag, rows, removedOrderIds, workspaceId: "synthetic-workspace" });
  return requests;
}

test("adding a new order does not resubmit unchanged old paused or active pins", async () => {
  const oldPaused = individual("paused-old");
  const oldActive = individual("active-old");
  const rows = [oldPaused, oldActive, individual("new", false)];
  const before = JSON.stringify(rows);
  const [request] = await serialize(rows);
  expect(request.rows.map((row) => row.orderId)).toEqual(["new"]);
  expect(request.expectedEtag).toBe(etag);
  expect(JSON.stringify(rows)).toBe(before);
});

for (const change of ["quantity", "detail", "schema", "priority"] as const) {
  test(`an explicitly edited existing ${change} is still submitted`, async () => {
    const row = individual("edited");
    if (change === "quantity") row.quantityInput = "2";
    if (change === "detail") row.detailInputs.note = "explicit edit";
    if (change === "schema") row.detailSchemaVersion = 2;
    if (change === "priority") row.priority = "urgent";
    const [request] = await serialize([individual("untouched"), row]);
    expect(request.rows.map((value) => value.orderId)).toEqual(["edited"]);
  });
}

function setRows() {
  const intent = { items: [{ revisionItemId: "leaf-a", selected: true, quantity: 1 }, { revisionItemId: "leaf-b", selected: true, quantity: 1 }] };
  const parent = {
    ...individual("parent"), setSelectionIntent: intent,
    runtimeRow: { ...individual("parent").runtimeRow!, rowType: "set", sourceSetId: "set-id", sourceSetRevisionId: "set-revision", sourceSetRevisionNo: 1, appliedSnapshot: { selectionIntent: intent }, calculationInputs: {} },
  };
  const children = ["a", "b"].map((suffix) => ({
    ...individual(`child-${suffix}`),
    runtimeRow: { ...individual(`child-${suffix}`).runtimeRow!, rowType: "set_child", parentOrderId: "parent", sourceSetRevisionItemId: `leaf-${suffix}` },
  }));
  return { parent, children };
}

test("unchanged sets are omitted without dropping their rows locally", async () => {
  const { parent, children } = setRows();
  const [request] = await serialize([parent, ...children, individual("new", false)]);
  expect(request.rows.map((row) => row.orderId)).toEqual(["new"]);
});

test("an edited set child submits its parent with all current child inputs", async () => {
  const { parent, children } = setRows();
  children[0].detailInputs.note = "edited child";
  const [request] = await serialize([individual("untouched"), parent, ...children]);
  expect(request.rows.map((row) => row.orderId)).toEqual(["parent"]);
  expect(request.rows[0].childInputs).toEqual(children.map((child, index) => ({
    revisionItemId: `leaf-${index === 0 ? "a" : "b"}`,
    detailInputs: child.detailInputs, detailSchemaVersion: 1, priority: "normal",
  })));
});

test("changed set selection is submitted even when children are unchanged", async () => {
  const { parent, children } = setRows();
  parent.setSelectionIntent = { items: [{ revisionItemId: "leaf-a", selected: true, quantity: 2 }] };
  const [request] = await serialize([parent, ...children]);
  expect(request.rows.map((row) => row.orderId)).toEqual(["parent"]);
});

test("explicit removal remains separate from omitted unchanged rows", async () => {
  const [request] = await serialize([individual("untouched")], ["removed-root"]);
  expect(request.rows).toEqual([]);
  expect(request.removedOrderIds).toEqual(["removed-root"]);
});

test("confirmed rows remain excluded and invalid ETag never sends a request", async () => {
  const row = individual("confirmed");
  row.order.status = "confirmed";
  row.quantityInput = "2";
  expect((await serialize([row]))[0].rows).toEqual([]);
  expect(await serialize([individual("new", false)], [], "invalid")).toEqual([]);
});

test("set instruction-only edits and clearing are persisted without altering child notes", async () => {
  for (const instruction of ["새 공통 지시", ""]) {
    const { parent, children } = setRows();
    const row = { ...parent, order: { ...parent.order, instruction }, runtimeRow: { ...parent.runtimeRow, instruction: "이전 공통 지시" } };
    const [request] = await serialize([row, ...children]);
    expect(request.rows).toHaveLength(1);
    expect(request.rows[0]).toMatchObject({ rowType: "set", orderId: "parent", instruction });
    expect((request.rows[0].childInputs as Array<{ detailInputs: unknown }>).map(child => child.detailInputs)).toEqual(children.map(child => child.detailInputs));
  }
});
