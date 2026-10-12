import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";
import type { PersistedLabResultState } from "../src/features/lab-imaging/persisted-lab-result-state";
import type { LabResult } from "../src/types/emr-domain";
import { loadPersistedLabResult } from "../src/features/lab-imaging/persisted-lab-result-client";
import { getPersistedLabResultView } from "../src/features/lab-imaging/persisted-lab-result-state";

const scope = { workspaceId: "synthetic-workspace", workItemId: "synthetic-task", orderId: "synthetic-order", encounterId: "synthetic-encounter" };
const key = `${scope.workspaceId}:${scope.workItemId}:${scope.orderId}:${scope.encounterId}`;
const base: LabResult = { id: "placeholder", workspaceId: scope.workspaceId, orderId: scope.orderId, encounterId: scope.encounterId, patientId: "synthetic-patient", resultName: "Synthetic result", status: "pending", rows: [] };
const payload = () => ({ ...scope, ok: true, resultId: "synthetic-saved-result", entryWriteRevision: 2, resultDefinitionSnapshot: { schemaVersion: 1 }, rows: [{ id: "synthetic-row", analyteName: "Synthetic analyte", value: "2", resultValueKind: "numeric", judgment: "normal" }] });
const view = (status: "ready" | "loading" | "error" | "permission_denied" | "empty", value: unknown = payload(), owner = key, enabled = true) => getPersistedLabResultView({ enabled, state: { key: owner, status, payload: value }, key, base, workspaceId: scope.workspaceId, workItemId: scope.workItemId });
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

for (const [status, body, expected] of [
  [200, { ok: true, savedResult: null }, "empty"],
  [200, payload(), "ready"],
  [200, { ok: false }, "error"],
  [500, { ok: true }, "error"],
  [401, payload(), "permission_denied"],
  [403, payload(), "permission_denied"],
] as const) {
  test(`synthetic lab read classifies HTTP ${status} as ${expected} and preserves the scoped request`, async () => {
    const controller = new AbortController();
    let input: RequestInfo | URL | undefined;
    let options: RequestInit | undefined;
    globalThis.fetch = async (url, init) => { input = url; options = init; return new Response(JSON.stringify(body), { status }); };
    expect(await loadPersistedLabResult(scope, controller.signal)).toEqual({ status: expected, payload: body });
    expect(input).toBe(`/api/workspaces/${scope.workspaceId}/lab-imaging/result-entries?workItemId=${scope.workItemId}&orderId=${scope.orderId}`);
    expect(options).toEqual({ cache: "no-store", signal: controller.signal });
  });
}

test("a cancelled delayed result read cannot return an acknowledgement to the old owner", async () => {
  const controller = new AbortController();
  let release!: (response: Response) => void;
  globalThis.fetch = () => new Promise<Response>(resolve => { release = resolve; });
  const pending = loadPersistedLabResult(scope, controller.signal);
  controller.abort();
  release(new Response(JSON.stringify(payload())));
  expect(await pending).toBeNull();
});

test("read failures stay failures for the hook's existing retry path", async () => {
  globalThis.fetch = async () => { throw new Error("synthetic read failure"); };
  await expect(loadPersistedLabResult(scope, new AbortController().signal)).rejects.toThrow("synthetic read failure");
});

test("only same-owner validated results survive loading or retryable errors", () => {
  for (const status of ["ready", "loading", "error"] as const) expect(view(status).result).toMatchObject({ id: "synthetic-saved-result", entryWriteRevision: 2 });
  expect(view("error", payload(), "foreign-owner")).toEqual({ status: "loading", result: null });
  expect(view("ready", payload(), key, false)).toEqual({ status: "idle", result: null });
  for (const status of ["permission_denied", "empty"] as const) expect(view(status)).toEqual({ status, result: null });
});

for (const selector of ["workspaceId", "workItemId", "orderId", "encounterId"] as const) {
  test(`a ready response with foreign ${selector} never displays a result`, () => {
    expect(view("ready", { ...payload(), [selector]: "foreign-scope" })).toEqual({ status: "error", result: null });
  });
}

test("corrupt persisted rows do not become a successful result", () => {
  expect(view("ready", { ...payload(), rows: [] })).toEqual({ status: "error", result: null });
  const saved = payload();
  expect(view("ready", { ...saved, rows: [saved.rows[0], saved.rows[0]] })).toEqual({ status: "error", result: null });
});

test("a cancelled effect preserves the next owner after its read settles but before the consumer resumes", async () => {
  // Execute the actual effect with explicit synthetic lifecycle/state ports.
  // This exercises callback ordering; it does not claim a React/browser mount.
  const file = ts.createSourceFile("hook.ts", readFileSync("src/features/lab-imaging/use-persisted-lab-result.ts", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const effects: ts.Expression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(file) === "useEffect") effects.push(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(file);
  expect(effects).toHaveLength(1);
  const compiled = ts.transpileModule(`export const effect = ${effects[0].getText(file)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  let resolve!: (reply: { status: "ready"; payload: unknown }) => void;
  const pending = new Promise<{ status: "ready"; payload: unknown }>(done => { resolve = done; });
  const nextOwner: PersistedLabResultState = { key: "synthetic-owner-B", status: "ready", payload: { synthetic: "B" } };
  let state: PersistedLabResultState = { key, status: "loading" };
  let requestSignal: AbortSignal | undefined;
  const exports = {} as { effect: () => () => void };
  new Script(compiled).runInNewContext({
    exports, AbortController, enabled: true, ...scope, key,
    loadPersistedLabResult: (requested: typeof scope, signal: AbortSignal) => {
      expect(requested).toEqual(scope);
      requestSignal = signal;
      return pending;
    },
    setState: (update: (previous: PersistedLabResultState) => PersistedLabResultState) => { state = update(state); },
  });
  const cleanup = exports.effect();
  state = nextOwner;
  resolve({ status: "ready", payload: payload() });
  cleanup();
  await Promise.resolve();
  await Promise.resolve();
  expect(requestSignal?.aborted).toBe(true);
  expect(state).toBe(nextOwner);
});
