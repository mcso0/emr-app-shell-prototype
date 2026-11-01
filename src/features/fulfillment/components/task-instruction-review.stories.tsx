import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { TaskInstructionReview } from "./task-instruction-review";
import { useTaskInstructionReview } from "../use-task-instruction-review";
import { instructionReviewListSchema, type TaskInstructionReview as Review } from "../task-instruction-review-contract";

const workspace = "synthetic-instruction-review";
const first = "71000000-0000-4000-8000-000000000001";
const second = "71000000-0000-4000-8000-000000000002";
type Scenario = "normal" | "conflict" | "deleted" | "read-failure" | "late-response" | "legacy-history";
function createFixture(scenario: Scenario) {
  let revision = 1, posts = 0, failed = scenario === "read-failure", held = scenario === "late-response";
  let release: (() => void) | undefined;
  const acknowledgements = new Set<string>();
  const review = (taskId: string): Review => ({
    taskId, requiresAcknowledgement: !acknowledgements.has(String(revision)), snapshots: scenario === "legacy-history" ? [{
      phase: "requested", legacy: true, taskId, attemptNo: 1, capturedAt: "2026-10-31T03:00:00Z",
      document: { chartId: "72000000-0000-4000-8000-000000000001", scope: "dispensing", versions: { legacyPO: 1 }, versionKey: "c".repeat(64),
        entries: [{ scope: "dispensing", revision: 1, instruction: "이전 경구제 전용 합성 기록", deleted: false, legacy: true, actorName: "합성 수의사", createdAt: "2026-10-31T02:00:00Z" }] },
    }] : [],
    current: { chartId: "72000000-0000-4000-8000-000000000001", scope: "dispensing", versions: { overall: revision, dispensing: 0 }, versionKey: String(revision).repeat(64),
      entries: [{ scope: "overall", revision, instruction: scenario === "deleted" ? "" : `${taskId === first ? "첫 작업" : "둘째 작업"} 합성 지시 ${revision}`, deleted: scenario === "deleted", actorName: "합성 수의사", createdAt: "2026-11-01T03:00:00Z" }] },
    previous: { chartId: "72000000-0000-4000-8000-000000000001", scope: "dispensing", versions: { overall: 0, dispensing: 0 }, versionKey: "0".repeat(64), entries: [] },
  });
  const install = () => {
    const original = globalThis.fetch;
    const intercept: typeof fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (url.pathname !== `/api/workspaces/${workspace}/fulfillment/instruction-review`) return original(input, init);
      if (init?.method === "POST") {
        posts++;
        const body = JSON.parse(String(init.body));
        if (scenario === "conflict" && posts === 1) { revision++; return Response.json({ ok: false, error: "instruction_version_conflict" }, { status: 409 }); }
        if (body.versionKey !== String(revision).repeat(64)) throw new Error("Fixture received wrong version");
        acknowledgements.add(String(revision));
        return Response.json({ ok: true, reviews: [review(body.taskId)] });
      }
      if (failed) return Response.json({ ok: false }, { status: 503 });
      const ids = (url.searchParams.get("taskIds") ?? "").split(",");
      const reviews = ids.map(review);
      if (held && ids.includes(first)) { held = false; await new Promise<void>(resolve => { release = resolve; }); }
      instructionReviewListSchema.parse(reviews);
      return Response.json({ ok: true, reviews });
    };
    globalThis.fetch = intercept;
    return () => { release?.(); if (globalThis.fetch === intercept) globalThis.fetch = original; };
  };
  return { install, get posts() { return posts; }, advance: () => { revision++; }, recover: () => { failed = false; release?.(); } };
}
let fixture: ReturnType<typeof createFixture>;
function Example({ scenario }: { scenario: Scenario }) {
  const [taskId, setTaskId] = useState(first);
  const [starts, setStarts] = useState(0);
  const controller = useTaskInstructionReview(workspace, [taskId]);
  return <div className="mx-auto max-w-3xl space-y-4 p-6" data-scenario={scenario}>
    <div className="flex gap-3"><button onClick={async () => { if (await controller.check()) setStarts(count => count + 1); }}>수행 시작</button>
      <button onClick={() => { fixture.advance(); window.dispatchEvent(new Event("clair-instructions-changed")); }}>다음 버전</button>
      <button onClick={() => setTaskId(second)}>작업 전환</button>
      <button onClick={() => { fixture.recover(); void controller.refresh(); }}>응답 복구</button></div>
    <output aria-label="합성 시작 횟수">{starts}</output>
    <TaskInstructionReview controller={controller} />
  </div>;
}
const meta = {
  title: "Features/Fulfillment/Task Instruction Review", component: Example, args: { scenario: "normal" as Scenario }, tags: ["autodocs"],
  parameters: { docs: { description: { component: "Actual shared review controller/UI with an isolated synthetic HTTP transport. No real task, acknowledgement, notification or patient data is written." } } },
  beforeEach: ({ args }) => { fixture = createFixture(args.scenario); return fixture.install(); },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ExplicitAcknowledgement: Story = {
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByText("첫 작업 합성 지시 1");
    await userEvent.click(canvas.getByRole("button", { name: "지시사항 숨기기" }));
    await userEvent.click(canvas.getByRole("button", { name: "수행 시작" }));
    await body.findByRole("button", { name: "최신 지시 확인" });
    await userEvent.click(body.getByRole("button", { name: "닫기" }));
    await expect(canvas.getByLabelText("합성 시작 횟수")).toHaveTextContent("0");
    await expect(fixture.posts).toBe(0);
    await userEvent.click(canvas.getByRole("button", { name: "수행 시작" }));
    await userEvent.dblClick(await body.findByRole("button", { name: "최신 지시 확인" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(fixture.posts).toBe(1);
    await userEvent.click(canvas.getByRole("button", { name: "수행 시작" }));
    await expect(canvas.getByLabelText("합성 시작 횟수")).toHaveTextContent("1");
  },
};
export const ChangedWhileAcknowledging: Story = {
  args: { scenario: "conflict" },
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByText("첫 작업 합성 지시 1");
    await userEvent.click(canvas.getByRole("button", { name: "수행 시작" }));
    await userEvent.click(await body.findByRole("button", { name: "최신 지시 확인" }));
    await body.findByText("지시가 다시 변경되었습니다. 최신 내용을 확인해 주세요.");
    await expect(canvas.getByLabelText("합성 시작 횟수")).toHaveTextContent("0");
    await userEvent.click(body.getByRole("button", { name: "최신 지시 확인" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(fixture.posts).toBe(2);
  },
};
export const DeletedInstruction: Story = {
  args: { scenario: "deleted" },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByText("지시 삭제됨");
    await userEvent.click(canvas.getByRole("button", { name: "수행 시작" }));
    await within(canvasElement.ownerDocument.body).findByRole("button", { name: "최신 지시 확인" });
    await expect(canvas.getByLabelText("합성 시작 횟수")).toHaveTextContent("0");
  },
};
export const HiddenVersionReappears: Story = {
  play: async ({ canvas }) => {
    await canvas.findByText("첫 작업 합성 지시 1");
    await userEvent.click(canvas.getByRole("button", { name: "지시사항 숨기기" }));
    await userEvent.click(canvas.getByRole("button", { name: "다음 버전" }));
    await canvas.findByText("첫 작업 합성 지시 2");
    await expect(fixture.posts).toBe(0);
  },
};
export const ReadFailureBlocksStart: Story = {
  args: { scenario: "read-failure" },
  play: async ({ canvas }) => {
    await canvas.findByRole("alert");
    await userEvent.click(canvas.getByRole("button", { name: "수행 시작" }));
    await expect(canvas.getByLabelText("합성 시작 횟수")).toHaveTextContent("0");
    await userEvent.click(canvas.getByRole("button", { name: "응답 복구" }));
    await canvas.findByText("첫 작업 합성 지시 1");
  },
};
export const LateResponseCannotReplaceAnotherTask: Story = {
  args: { scenario: "late-response" },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "작업 전환" }));
    await canvas.findByText("둘째 작업 합성 지시 1");
    await userEvent.click(canvas.getByRole("button", { name: "응답 복구" }));
    await waitFor(() => expect(canvas.queryByText("첫 작업 합성 지시 1")).not.toBeInTheDocument());
    await expect(canvas.getByText("둘째 작업 합성 지시 1")).toBeVisible();
  },
};
export const LegacyPoSnapshot: Story = {
  args: { scenario: "legacy-history" },
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByText("첫 작업 합성 지시 1");
    await userEvent.click(canvas.getByRole("button", { name: "변경 내용 확인" }));
    await userEvent.click(await body.findByText("요청·완료 당시 기록"));
    await waitFor(() => expect(body.getByText("이전 경구제 전용 합성 기록")).toBeVisible());
    await expect(body.getByText(/이전 경구제 기록 · 1회차/)).toBeVisible();
    await expect(fixture.posts).toBe(0);
  },
};
