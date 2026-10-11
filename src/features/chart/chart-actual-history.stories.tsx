import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, waitFor } from "storybook/test";
import { isExecutionUuid } from "@/features/fulfillment/execution-result-contract";
import { ChartActualHistory } from "./chart-actual-history";
import { parseChartActualContext, parseChartActualPayload, type ChartActualContext, type ChartActualVersion } from "./chart-actual-contract";

type Scenario = "amendment" | "readonly" | "record" | "read-error";
const id = (index: number) => `99000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const actor = id(3), taskId = id(1);
const date = "2026-10-11T00:00:00Z";
function createFixture(scenario: Scenario) {
  const workspaceId = `storybook-chart-actual-${crypto.randomUUID()}`;
  const context: ChartActualContext = { workspaceId, taskId, orderId: id(2), attemptNo: 1, clinicalOrderType: "system_exam", planSha256: "a".repeat(64), planSnapshot: { findingSummary: "합성 확정 계획" }, canRecord: scenario === "record", canAmend: scenario === "amendment", results: scenario === "record" ? [] : [{ id: id(4), version: 1, previousResultId: null, payload: { findingSummary: "합성 수행 소견" }, performedByUserId: actor, performedAt: date, recordedByUserId: actor, recordedAt: date, amendmentReason: null }] };
  const writes: Array<Record<string, unknown>> = [];
  let readHealthy = scenario !== "read-error", reads = 0, pending = 0;
  let unmount: (() => void) | undefined;
  const install = () => {
    const old = globalThis.fetch;
    const intercept: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return old(input, init);
      if (url.pathname !== `/api/workspaces/${workspaceId}/chart/tasks/${taskId}/actual`) throw new Error("Unexpected synthetic actual-record API");
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      pending++;
      try {
        let response: Response;
        if (method === "GET") {
          reads++;
          if (!readHealthy) { readHealthy = true; response = Response.json({ ok: false }, { status: 503 }); }
          else response = Response.json({ ok: true, context });
        } else if (method === "POST") {
          const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
          const payload = parseChartActualPayload(context.clinicalOrderType, body.payload);
          if (!payload || body.expectedPlanSha256 !== context.planSha256 || !isExecutionUuid(body.commandId) || typeof body.performedAt !== "string" || !Number.isFinite(Date.parse(body.performedAt))) throw new Error("Invalid synthetic actual-record command");
          const previous = context.results.at(-1);
          if (previous ? body.expectedResultVersion !== previous.version || typeof body.amendmentReason !== "string" || !body.amendmentReason.trim() : body.action !== "record" || body.selfPerformed !== true) throw new Error("Synthetic actual-record revision or consent mismatch");
          writes.push(structuredClone(body));
          const version: ChartActualVersion = { id: id(4 + context.results.length), version: context.results.length + 1, previousResultId: previous?.id ?? null, payload, performedByUserId: previous?.performedByUserId ?? actor, performedAt: body.performedAt, recordedByUserId: actor, recordedAt: "2026-10-11T01:00:00Z", amendmentReason: previous ? String(body.amendmentReason) : null };
          context.results.push(version); context.canRecord = false; context.canAmend = scenario !== "readonly";
          if (!parseChartActualContext(context, workspaceId, taskId)) throw new Error("Invalid synthetic actual-record readback");
          response = Response.json({ ok: true, context });
        } else throw new Error("Unexpected synthetic actual-record method");
        const json = response.json.bind(response);
        response.json = async () => { pending++; try { return await json(); } finally { pending--; } };
        return response;
      } finally { pending--; }
    };
    if (!parseChartActualContext(context, workspaceId, taskId)) throw new Error("Invalid synthetic actual-record context");
    globalThis.fetch = intercept;
    return async () => {
      try { unmount?.(); await waitFor(() => { if (pending) throw new Error("Actual-record transport is still settling"); }); }
      finally { if (globalThis.fetch === intercept) globalThis.fetch = old; }
    };
  };
  return { workspaceId, writes, context, install, get reads() { return reads; }, setUnmount: (fn: () => void) => { unmount = fn; } };
}
let fixture: ReturnType<typeof createFixture>;
function Example(args: { scenario: Scenario }) {
  void args;
  const instance = fixture;
  const [mounted, setMounted] = useState(true);
  const [saved, setSaved] = useState(0);
  useEffect(() => { instance.setUnmount(() => flushSync(() => setMounted(false))); }, [instance]);
  return <div className="mx-auto max-w-[600px] p-6"><output aria-label="합성 실제 기록 저장 횟수">{saved}</output>{mounted ? <ChartActualHistory workspaceId={instance.workspaceId} taskId={taskId} onSaved={async () => setSaved(value => value + 1)} /> : null}</div>;
}
const meta = {
  title: "Features/Chart/Actual History", component: Example, tags: ["autodocs"], args: { scenario: "amendment" as Scenario }, argTypes: { scenario: { control: false } },
  parameters: { docs: { story: { inline: false, height: "840px" }, description: { component: "실제 ChartActualHistory에 실제 context parser를 통과하는 합성 system_exam 계획·수행 이력을 제공합니다. 차트 오더 이력에 쓰이는 필드·권한·정정 사유·버전 연결을 그대로 사용합니다. 완료·정정 API는 정확한 workspace/task 경로의 로컬 응답이며 기존 이력을 보존합니다. 실제 환자 수행·청구·감사·DB 권한 검증은 이 예시의 범위에 포함되지 않습니다." } } },
  beforeEach: ({ args }) => { fixture = createFixture(args.scenario); return fixture.install(); },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AmendmentReasonAndSave: Story = { play: async ({ canvas }) => {
  await userEvent.click(await canvas.findByRole("button", { name: "실제 기록 정정" }));
  await expect(canvas.getByRole("textbox", { name: "정정 소견" })).toHaveValue("합성 수행 소견");
  await expect(canvas.getByRole("button", { name: "정정본 저장" })).toBeDisabled();
  await userEvent.type(canvas.getByRole("textbox", { name: "정정 사유" }), "합성 기록 확인");
  await userEvent.click(canvas.getByRole("button", { name: "정정본 저장" }));
  await waitFor(() => expect(canvas.getByText("실제 기록 v2")).toBeVisible());
  await expect(canvas.getByText("실제 기록 v1")).toBeVisible();
  await expect(canvas.getByLabelText("합성 실제 기록 저장 횟수")).toHaveTextContent("1");
  await expect(fixture.writes[0]).toMatchObject({ expectedResultVersion: 1, expectedPlanSha256: fixture.context.planSha256, amendmentReason: "합성 기록 확인", payload: { findingSummary: "합성 수행 소견" } });
  await expect(fixture.context.results[1]).toMatchObject({ previousResultId: id(4), performedByUserId: actor });
} };
export const SelfPerformedRecord: Story = { args: { scenario: "record" }, play: async ({ canvas }) => {
  await userEvent.click(await canvas.findByRole("button", { name: "수행 결과 기록" }));
  await expect(canvas.getByRole("button", { name: "수행 완료" })).toBeDisabled();
  await userEvent.type(canvas.getByRole("textbox", { name: "소견" }), "합성 새 수행 소견");
  fireEvent.change(canvas.getByLabelText("실제 수행 시각"), { target: { value: "2026-10-11T09:30" } });
  await expect(canvas.getByRole("button", { name: "수행 완료" })).toBeDisabled();
  await userEvent.click(canvas.getByRole("switch", { name: "현재 로그인한 내가 실제 수행했고 위 결과가 맞음을 확인" }));
  await userEvent.click(canvas.getByRole("button", { name: "수행 완료" }));
  await waitFor(() => expect(canvas.getByText("실제 기록 v1")).toBeVisible());
  await expect(canvas.getByLabelText("합성 실제 기록 저장 횟수")).toHaveTextContent("1");
  await expect(fixture.writes[0]).toMatchObject({ action: "record", selfPerformed: true, expectedPlanSha256: fixture.context.planSha256, payload: { findingSummary: "합성 새 수행 소견" } });
} };
export const ReadOnly: Story = { args: { scenario: "readonly" }, play: async ({ canvas }) => {
  await expect(await canvas.findByText("실제 기록 v1")).toBeVisible();
  await expect(canvas.getByText("소견: 합성 수행 소견")).toBeVisible();
  await expect(canvas.queryByRole("button", { name: "실제 기록 정정" })).not.toBeInTheDocument();
  await expect(canvas.queryByRole("button", { name: "수행 결과 기록" })).not.toBeInTheDocument();
  await expect(fixture.writes).toHaveLength(0);
} };
export const ReadErrorAndRetry: Story = { args: { scenario: "read-error" }, play: async ({ canvas }) => {
  await expect(await canvas.findByRole("alert")).toHaveTextContent("실제 수행 이력을 불러오지 못했습니다.");
  const reads = fixture.reads;
  await userEvent.click(canvas.getByRole("button", { name: "이력 다시 불러오기" }));
  await expect(await canvas.findByText("실제 기록 v1")).toBeVisible();
  await expect(fixture.reads).toBeGreaterThan(reads); await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
} };
