import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { ExecutionResultDialog } from "./execution-result-dialog";
import { parseExecutionCommand, parseExecutionContext, type ExecutionContext, type ExecutionResultVersion } from "../execution-result-contract";

const workspaceId = "storybook-execution";
const workItemId = "91000000-0000-4000-8000-000000000001";
const userId = "91000000-0000-4000-8000-000000000002";
const baseContext: ExecutionContext = { workspaceId, workItemId, taskId: "91000000-0000-4000-8000-000000000003", orderId: "91000000-0000-4000-8000-000000000004", encounterId: "91000000-0000-4000-8000-000000000005", attemptNo: 1, clinicalOrderType: "dispensing", workItemRevision: 1, status: "in_progress", isCurrentAttempt: true, resultRequired: true, canRecord: true, planSnapshot: { calculationOutputs: { plannedPracticalTotalQuantity: 2, dispenseUnit: "정" } }, planSha256: "a".repeat(64), results: [] };
let writes: Array<Record<string, unknown>> = [];
type Scenario = "ready" | "readonly" | "requested" | "load-error" | "save-error" | "amendment";
function Example(_args: { scenario: Scenario }) {
  void _args;
  const [open, setOpen] = useState(true);const [saved, setSaved] = useState(0);
  return <><button type="button" onClick={() => setOpen(true)}>수행기록 열기</button><output aria-label="합성 수행 저장 횟수">{saved}</output><ExecutionResultDialog workspaceId={workspaceId} workItemId={workItemId} open={open} onOpenChange={setOpen} onSaved={async () => setSaved((count) => count + 1)} /></>;
}
const meta = {
  title: "Features/Fulfillment/Execution Result", component: Example, tags: ["autodocs"], args: { scenario: "ready" as Scenario }, argTypes: { scenario: { control: false } },
  parameters: { docs: { story: { inline: false, height: "820px" }, description: { component: "조제·처치·영상 caller가 사용하는 실제 ExecutionResultDialog입니다. 실제 응답 parser를 통과하는 합성 조제 계획과 수행 이력을 제공합니다. GET/POST는 이 story의 정확한 endpoint에서만 가로채고 종료 시 복원합니다. 실제 수행·정정·청구·감사 저장은 하지 않으며 fixture는 임상 검증 자료가 아닙니다." } } },
  beforeEach: ({ args }) => {
    const original = globalThis.fetch;writes = [];
    const context = structuredClone(baseContext);
    let failRead = args.scenario === "load-error";let failSave = args.scenario === "save-error";
    if (args.scenario === "readonly") context.canRecord = false;
    if (args.scenario === "requested") context.status = "requested";
    if (args.scenario === "amendment") {
      context.status = "completed";
      context.results = [{ id: "92000000-0000-4000-8000-000000000001", version: 1, previousResultId: null, schemaVersion: 1, payload: { preparedQuantity: 2, preparedUnit: "정" }, performedByUserId: userId, recordedByUserId: userId, performedAt: "2026-10-11T00:00:00Z", recordedAt: "2026-10-11T00:00:00Z", varianceReason: null, amendmentReason: null, planSha256: context.planSha256 }];
    }
    if (!parseExecutionContext(context, workspaceId, workItemId)) throw new Error("Invalid synthetic execution context");
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return original(input, init);
      if (url.pathname !== `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}/execution`) throw new Error(`Unexpected API ${url.pathname}`);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (method === "GET") { if (failRead) { failRead = false; return Response.json({ ok: false, error: "request_failed" }, { status: 503 }); } return Response.json({ ok: true, context }); }
      if (method !== "POST") throw new Error(`Unexpected method ${method}`);
      const inputBody = JSON.parse(String(init?.body));writes.push(inputBody);
      const command = parseExecutionCommand(inputBody);if (!command) throw new Error("Invalid emitted execution command");
      if (failSave) { failSave = false; return Response.json({ ok: false, error: "request_failed" }, { status: 503 }); }
      const previous = context.results.at(-1);
      const record: ExecutionResultVersion = { id: `92000000-0000-4000-8000-${String(context.results.length + 1).padStart(12, "0")}`, version: context.results.length + 1, previousResultId: previous?.id ?? null, schemaVersion: 1, payload: command.payload, performedByUserId: userId, recordedByUserId: userId, performedAt: command.performedAt, recordedAt: "2026-10-11T01:00:00Z", varianceReason: command.varianceReason ?? null, amendmentReason: command.amendmentReason ?? null, planSha256: context.planSha256 };
      if (!previous) context.workItemRevision += 1;
      context.results.push(record);context.status = "completed";
      if (!parseExecutionContext(context, workspaceId, workItemId)) throw new Error("Invalid synthetic saved execution context");
      return Response.json({ ok: true, context });
    };
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
async function fill(body: ReturnType<typeof within>) {
  await body.findByLabelText("실제 준비수량 *");
  fireEvent.change(body.getByLabelText("실제 수행 시각 *"), { target: { value: "2026-10-11T09:30" } });
  await userEvent.type(body.getByLabelText("실제 준비수량 *"), "2");await userEvent.type(body.getByLabelText("실제 준비 단위 *"), "정");
}
export const RequiredFieldsAndSave: Story = {
  parameters: { docs: { description: { story: "필수값을 입력하기 전에는 저장할 수 없습니다. 합성 저장 후 readonly 이력과 callback을 확인합니다." } } },
  play: async ({ canvas, canvasElement }) => { const body = within(canvasElement.ownerDocument.body);await expect(await body.findByRole("button", { name: "수행기록 저장 및 완료" })).toBeDisabled();await fill(body);await userEvent.click(body.getByRole("button", { name: "수행기록 저장 및 완료" }));await expect(await body.findByText(/수행기록을 저장했습니다/)).toBeVisible();await expect(canvas.getByLabelText("합성 수행 저장 횟수")).toHaveTextContent("1");await expect(writes[0]).toMatchObject({ expectedRevision: 1, expectedResultVersion: 0, expectedPlanSha256: baseContext.planSha256, payload: { preparedQuantity: 2, preparedUnit: "정" } });await expect(body.getByText(/버전 1/)).toBeVisible(); },
};
export const SaveFailureAndRetry: Story = {
  args: { scenario: "save-error" }, parameters: { docs: { description: { story: "첫 합성 저장이 실패하면 입력을 유지합니다. 같은 commandId로 다시 제출해 합성 이력을 표시합니다." } } },
  play: async ({ canvasElement }) => { const body = within(canvasElement.ownerDocument.body);await fill(body);await userEvent.click(body.getByRole("button", { name: "수행기록 저장 및 완료" }));await expect(await body.findByRole("alert")).toHaveTextContent("입력값을 유지");await expect(body.getByLabelText("실제 준비 단위 *")).toHaveValue("정");await userEvent.click(body.getByRole("button", { name: "수행기록 저장 및 완료" }));await expect(await body.findByText(/수행기록을 저장했습니다/)).toBeVisible();await expect(writes).toHaveLength(2);await expect(writes[1].commandId).toBe(writes[0].commandId); },
};
export const ReadErrorAndReload: Story = { args: { scenario: "load-error" }, parameters: { docs: { description: { story: "조회 오류에서 실제 초기화·재조회 버튼으로 합성 계획을 다시 읽습니다." } } }, play: async ({ canvasElement }) => { const body = within(canvasElement.ownerDocument.body);await userEvent.click(await body.findByRole("button", { name: "입력 초기화 및 최신 기록 불러오기" }));await expect(await body.findByLabelText("실제 준비수량 *")).toBeEnabled(); } };
export const ReadOnly: Story = { args: { scenario: "readonly" }, parameters: { docs: { description: { story: "canRecord=false일 때 실제 화면에 조회 전용 안내가 나오고 쓰기 필드가 없습니다." } } }, play: async ({ canvasElement }) => { const body = within(canvasElement.ownerDocument.body);await body.findByText("조회 전용입니다. 수행기록을 변경할 수 없습니다.");await waitFor(() => expect(body.getByText("조회 전용입니다. 수행기록을 변경할 수 없습니다.")).toBeVisible());await expect(body.queryByRole("button", { name: "수행기록 저장 및 완료" })).not.toBeInTheDocument();await userEvent.click(body.getByRole("button", { name: "닫기" }));await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument()); } };
export const Requested: Story = { args: { scenario: "requested" }, parameters: { docs: { description: { story: "요청 상태는 업무를 먼저 시작하라는 제품 안내를 표시합니다." } } }, play: async ({ canvasElement }) => { const body = within(canvasElement.ownerDocument.body);await waitFor(() => expect(body.getByText("먼저 업무를 시작한 뒤 실제 수행값을 기록해 주세요.")).toBeVisible()); } };
export const AmendmentReason: Story = {
  args: { scenario: "amendment" }, parameters: { docs: { description: { story: "정정은 기존 입력을 불러오며 사유가 필수입니다. 합성 응답은 이전 버전과 새 버전을 모두 유지합니다." } } },
  play: async ({ canvasElement }) => { const body = within(canvasElement.ownerDocument.body);await userEvent.click(await body.findByRole("button", { name: "기록 정정" }));await expect(body.getByLabelText("실제 준비수량 *")).toHaveValue(2);await expect(body.getByRole("button", { name: "정정 저장" })).toBeDisabled();await userEvent.type(body.getByLabelText(/정정 사유/), "합성 기록 확인");await waitFor(() => expect(body.getByRole("button", { name: "정정 저장" })).toBeEnabled());await userEvent.click(body.getByRole("button", { name: "정정 저장" }));await waitFor(() => expect(body.getByText(/버전 2/)).toBeVisible());await expect(body.getByText(/버전 1/)).toBeVisible();await expect(writes[0]).toMatchObject({ expectedResultVersion: 1, amendmentReason: "합성 기록 확인" }); },
};
