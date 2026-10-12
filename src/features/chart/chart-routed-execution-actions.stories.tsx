import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { parseExecutionContext, type ExecutionContext } from "@/features/fulfillment/execution-result-contract";
import { ChartRoutedExecutionActions } from "./chart-routed-execution-actions";
import type { ChartOrderQueueProjection } from "./server-order-execution-read-model-core";

type Scenario = "requested" | "start-error" | "readonly";
const id = (index: number) => `9b000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
function createFixture(scenario: Scenario) {
  const workspaceId = `storybook-chart-routed-${crypto.randomUUID()}`, workItemId = id(1), taskId = id(2);
  const queue: ChartOrderQueueProjection = { workItemId, taskId, orderId: id(3), queueType: "other", destinationModule: "other", queueStatus: scenario === "readonly" ? "completed" : "requested", taskAttemptNo: 1, rowRevision: 1, updatedAt: "2026-10-11T00:00:00Z" };
  const context: ExecutionContext = { workspaceId, workItemId, taskId, orderId: queue.orderId, encounterId: id(4), attemptNo: 1, clinicalOrderType: "other", workItemRevision: 1, status: scenario === "readonly" ? "completed" : "requested", isCurrentAttempt: true, resultRequired: true, canRecord: scenario !== "readonly", planSnapshot: { detailInputs: { taskDescription: "합성 기타 업무 계획" } }, planSha256: "b".repeat(64), results: scenario === "readonly" ? [{ id: id(5), version: 1, previousResultId: null, schemaVersion: 1, payload: { performedActivity: "합성 기타 업무 수행", outcome: "합성 수행 결과" }, performedByUserId: id(6), recordedByUserId: id(6), performedAt: "2026-10-11T00:00:00Z", recordedAt: "2026-10-11T00:00:00Z", varianceReason: null, amendmentReason: null, planSha256: "b".repeat(64) }] : [] };
  const starts: Array<Record<string, unknown>> = [], reads: string[] = [];
  let failStart = scenario === "start-error", pending = 0;
  let unmount: (() => void) | undefined;
  const install = () => {
    const old = globalThis.fetch;
    const intercept: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return old(input, init);
      const path = `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`;
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      pending++;
      try {
        let response: Response;
        if (method === "PATCH" && url.pathname === path) {
          const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
          if (body.action !== "start" || body.expectedRevision !== queue.rowRevision || typeof body.commandId !== "string") throw new Error("Synthetic routed start identity/revision mismatch");
          starts.push(structuredClone(body));
          if (failStart) { failStart = false; response = Response.json({ ok: false }, { status: 503 }); }
          else { queue.queueStatus = "in_progress"; queue.rowRevision = 2; context.status = "in_progress"; context.workItemRevision = 2; response = Response.json({ ok: true }); }
        } else if (method === "GET" && url.pathname === `${path}/execution` && url.searchParams.get("taskId") === taskId) {
          reads.push(`${url.pathname}${url.search}`);
          if (!parseExecutionContext(context, workspaceId, workItemId, taskId)) throw new Error("Invalid synthetic routed execution context");
          response = Response.json({ ok: true, context });
        } else throw new Error("Unexpected synthetic routed API or task selector");
        const json = response.json.bind(response);
        response.json = async () => { pending++; try { return await json(); } finally { pending--; } };
        return response;
      } finally { pending--; }
    };
    if (!parseExecutionContext(context, workspaceId, workItemId, taskId)) throw new Error("Invalid synthetic routed context");
    globalThis.fetch = intercept;
    return async () => { try { unmount?.(); await waitFor(() => { if (pending) throw new Error("Routed transport is still settling"); }); } finally { if (globalThis.fetch === intercept) globalThis.fetch = old; } };
  };
  return { workspaceId, queue, starts, reads, install, setUnmount: (fn: () => void) => { unmount = fn; } };
}
let fixture: ReturnType<typeof createFixture>;
function Example(args: { scenario: Scenario }) {
  void args;
  const instance = fixture;
  const [queue, setQueue] = useState(() => ({ ...instance.queue }));
  const [saved, setSaved] = useState(0), [mounted, setMounted] = useState(true);
  useEffect(() => { instance.setUnmount(() => flushSync(() => setMounted(false))); }, [instance]);
  return <div className="p-6"><output aria-label="합성 차트 수행 새로고침 횟수">{saved}</output>{mounted ? <ChartRoutedExecutionActions workspaceId={instance.workspaceId} queue={queue} taskId={queue.taskId} onSaved={async () => { setQueue({ ...instance.queue }); setSaved(value => value + 1); }} /> : null}</div>;
}
const meta = {
  title: "Features/Chart/Routed Execution Actions", component: Example, tags: ["autodocs"], args: { scenario: "requested" as Scenario }, argTypes: { scenario: { control: false } },
  parameters: { docs: { story: { inline: false, height: "880px" }, description: { component: "ChartOrderTable이 사용하는 실제 ChartRoutedExecutionActions와 ExecutionResultDialog를 연결합니다. 실제 task/work-item 범위의 합성 기타 업무 대기열을 사용합니다. 업무 시작 PATCH는 revision과 commandId를 기록하고 대기열을 갱신합니다. 수행 조회는 실제 parser를 통과합니다. 실제 업무 수행·권한·DB·감사·청구와 수행값 저장은 별도 범위입니다. 수행값 저장·정정 예제는 Fulfillment/Execution Result에 있습니다." } } },
  beforeEach: ({ args }) => { fixture = createFixture(args.scenario); return fixture.install(); },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
async function openResult(element: HTMLElement) {
  const body = within(element.ownerDocument.body);
  const dialog = await body.findByRole("dialog", { name: "실제 수행기록" });
  await waitFor(() => expect(dialog).toBeVisible());
  return { body, dialog: within(dialog) };
}
export const StartAndOpenResult: Story = { play: async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole("button", { name: "수행 시작" }));
  const { body, dialog } = await openResult(canvasElement);
  await waitFor(() => expect(dialog.getByLabelText("실제 수행한 업무 *")).toBeEnabled());
  await expect(fixture.starts[0]).toMatchObject({ action: "start", expectedRevision: 1 });
  await expect(fixture.reads).toHaveLength(1);
  await userEvent.click(dialog.getByRole("button", { name: "닫기" }));
  await waitFor(() => expect(body.queryByRole("dialog", { name: "실제 수행기록" })).not.toBeInTheDocument());
  await expect(canvas.queryByRole("button", { name: "수행 시작" })).not.toBeInTheDocument();
  await expect(canvas.getByLabelText("합성 차트 수행 새로고침 횟수")).toHaveTextContent("1");
} };
export const StartFailureAndRetry: Story = { args: { scenario: "start-error" }, play: async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole("button", { name: "수행 시작" }));
  await expect(await canvas.findByRole("alert")).toHaveTextContent("업무 시작을 확인하지 못했습니다.");
  await expect(within(canvasElement.ownerDocument.body).queryByRole("dialog")).not.toBeInTheDocument();
  await userEvent.click(canvas.getByRole("button", { name: "수행 시작" }));
  const { dialog } = await openResult(canvasElement);
  await expect(fixture.starts).toHaveLength(2); await expect(fixture.starts[1]).toEqual(fixture.starts[0]);
  await waitFor(() => expect(dialog.getByLabelText("실제 수행한 업무 *")).toBeEnabled());
  await userEvent.keyboard("{Escape}");
} };
export const CompletedReadOnlyHistory: Story = { args: { scenario: "readonly" }, play: async ({ canvas, canvasElement }) => {
  await expect(canvas.queryByRole("button", { name: "수행 시작" })).not.toBeInTheDocument();
  const trigger = canvas.getByRole("button", { name: "수행기록·이력" });
  trigger.focus(); await userEvent.keyboard("{Enter}");
  const { body, dialog } = await openResult(canvasElement);
  await waitFor(() => expect(dialog.getByText("조회 전용입니다. 수행기록을 변경할 수 없습니다.")).toBeVisible());
  await expect(dialog.getByText(/합성 기타 업무 수행/)).toBeVisible();
  await expect(dialog.queryByRole("button", { name: "수행기록 저장 및 완료" })).not.toBeInTheDocument();
  await expect(fixture.starts).toHaveLength(0);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(body.queryByRole("dialog", { name: "실제 수행기록" })).not.toBeInTheDocument());
} };
