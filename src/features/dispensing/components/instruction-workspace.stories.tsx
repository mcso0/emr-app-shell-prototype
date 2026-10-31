import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within, waitFor } from "storybook/test";
import { syntheticInstruction } from "../instruction-fixtures";
import type { InstructionIntent } from "../use-fulfillment-instruction";
import { InstructionActions, InstructionBody } from "./instruction-workspace";

function Example({
  single = false,
  readOnly = false,
  failed = false,
  width = 1100,
}: {
  single?: boolean;
  readOnly?: boolean;
  failed?: boolean;
  width?: number;
}) {
  const [document, setDocument] = useState(() => ({
    ...structuredClone(syntheticInstruction),
    oralInstruction: {
      chartId: "28110000-0000-4000-8000-000000000011", revision: 1,
      instruction: "현재 차트 경구제 전체 지시입니다.\n여러 줄이어도 지시사항을 모두 확인할 수 있어요.",
      history: [], snapshots: [],
    },
    isSet: !single,
    items: single
      ? [structuredClone(syntheticInstruction.items[0])]
      : structuredClone(syntheticInstruction.items),
  }));
  const [error, setError] = useState<string | null>(null);
  const controller = {
    document: readOnly
      ? {
          ...document,
          canUnassign: false,
          canCompleteAll: false,
          canEditInstruction: false,
          items: document.items.map((item) => ({
            ...item,
            canAssign: false,
            canComplete: false,
            canReopen: false,
          })),
        }
      : document,
    assignees: [
      { userId: "synthetic-main", displayName: "담당 A" },
      { userId: "synthetic-sub", displayName: "담당 B" },
    ],
    loading: false,
    busy: false,
    error,
    refresh: () => setError(null),
    mutate: async (intent: InstructionIntent) => {
      if (failed) {
        setError("변경을 저장하지 못했어요. 다시 시도해 주세요.");
        return false;
      }
      setDocument((previous) => ({
        ...previous,
        finalized:
          intent.action === "edit_instruction"
            ? previous.finalized
            : intent.action === "complete_all" ||
              (!previous.isSet && intent.action === "complete"),
        instruction:
          intent.action === "edit_instruction"
            ? intent.instruction
            : previous.instruction,
        items: previous.items.map((item) => {
          if (item.status === "cancelled") return item;
          if (
            intent.action === "complete_all" ||
            (intent.action === "complete" && item.id === intent.itemId)
          )
            return {
              ...item,
              status: "completed",
              canComplete: false,
              canReopen: true,
            };
          if (intent.action === "reopen" && item.id === intent.itemId)
            return {
              ...item,
              status: "in_progress",
              canComplete: true,
              canReopen: false,
            };
          if (intent.action === "assign" && item.id === intent.itemId)
            return {
              ...item,
              assigneeId: intent.assigneeId,
              assigneeName:
                intent.assigneeId === "synthetic-main" ? "담당 A" : "담당 B",
            };
          return item;
        }),
      }));
      return true;
    },
  };
  return (
    <div style={{ width, maxWidth: "100%" }}>
      <div className="flex items-center justify-end gap-2">
        <InstructionActions workspaceId="synthetic-workspace" controller={controller} onChanged={() => {}} />
      </div>
      <InstructionBody
        controller={controller}
        workspaceId="synthetic-workspace"
        onChanged={() => {}}
      />
    </div>
  );
}

const meta = {
  title: "Features/Dispensing/Instruction workspace",
  component: Example,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SetInstruction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "합성 품목 A 완료" }),
    );
    await waitFor(() => expect(body.getByRole("dialog")).toBeVisible());
    await userEvent.click(
      within(body.getByRole("dialog")).getByRole("button", { name: "완료" }),
    );
    await expect(
      canvas.getByRole("button", { name: "합성 품목 A 완료 해제" }),
    ).toBeEnabled();
    await expect(
      canvas.getByRole("button", { name: "조제 완료" }),
    ).toBeEnabled();
    await userEvent.click(
      canvas.getByRole("button", { name: "합성 품목 A 완료 해제" }),
    );
    await expect(
      canvas.getByRole("button", { name: "합성 품목 A 완료" }),
    ).toBeEnabled();
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};
export const SingleInstruction: Story = { args: { single: true } };
export const Compact: Story = { args: { width: 760 } };
export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: "합성 품목 A 완료" }),
    ).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "수정이력" }));
    await waitFor(() =>
      expect(
        within(canvasElement.ownerDocument.body).getByRole("dialog"),
      ).toBeVisible(),
    );
  },
};
export const SaveFailure: Story = {
  args: { failed: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "조제 완료" }));
    const dialog = within(body.getByRole("dialog"));
    await waitFor(() =>
      expect(
        dialog.getByText("미완료 항목 2개도 함께 완료됩니다."),
      ).toBeVisible(),
    );
    await userEvent.click(dialog.getByRole("button", { name: "완료" }));
    await expect(dialog.getByRole("alert")).toBeVisible();
    await userEvent.click(dialog.getByRole("button", { name: "취소" }));
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(
      canvas.getByRole("button", { name: "합성 품목 A 완료" }),
    ).toBeEnabled();
  },
};

export const CommonInstruction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "조제 완료" }));
    await userEvent.click(
      within(body.getByRole("dialog")).getByRole("button", { name: "완료" }),
    );
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await userEvent.click(canvas.getByRole("button", { name: /합성 조제 세트 더 보기/ }));
    await userEvent.click(await body.findByRole("menuitem", { name: "세트 공통 지시 수정" }));
    const dialog = within(body.getByRole("dialog"));
    await userEvent.clear(dialog.getByRole("textbox", { name: "공통 지시" }));
    await userEvent.type(
      dialog.getByRole("textbox", { name: "공통 지시" }),
      "변경된 공통 지시",
    );
    await userEvent.click(dialog.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(
      canvas.getAllByText("변경된 공통 지시", { exact: true })[0],
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "합성 품목 A 완료 해제" }),
    ).toBeEnabled();
    await expect(
      canvas.getByRole("button", { name: "합성 품목 B 완료 해제" }),
    ).toBeEnabled();
  },
};

export const OralInstructionVisibility: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("complementary", { name: "경구제 전체 지시사항" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "경구제 전체 지시사항 숨기기" }));
    await expect(canvas.queryByRole("complementary")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "경구제 전체 지시사항 보기" }));
    await expect(canvas.getByRole("complementary")).toHaveTextContent("현재 차트 경구제 전체 지시입니다.");
  },
};

let executionReads: string[] = [];
export const ExecutionHistoryInRow: Story = {
  name: "Execution history in menu",
  beforeEach: () => {
    const original = globalThis.fetch;
    executionReads = [];
    globalThis.fetch = async (input, init) => {
      const path = String(input);
      if (!path.endsWith('/synthetic-item-a/execution')) return original(input, init);
      executionReads.push(path);
      return Response.json({ ok: true, context: {
        workspaceId: "synthetic-row-history", workItemId: "synthetic-item-a",
        taskId: "28150000-0000-4000-8000-000000000001", orderId: "28140000-0000-4000-8000-000000000001", encounterId: "28120000-0000-4000-8000-000000000001",
        attemptNo: 1, clinicalOrderType: "dispensing", workItemRevision: 1,
        status: "completed", isCurrentAttempt: true, resultRequired: true,
        canRecord: false, planSnapshot: {}, planSha256: "a".repeat(64), results: [],
      } });
    };
    return () => { globalThis.fetch = original; };
  },
  render: () => <InstructionBody workspaceId="synthetic-row-history" onChanged={() => {}} controller={{
    document: { ...structuredClone(syntheticInstruction), canEditInstruction: false,
      items: syntheticInstruction.items.map((item, index) => ({ ...item, resultRequired: false, hasResult: index === 0, canComplete: false, canReopen: false, canAssign: false })) },
    assignees: [], loading: false, busy: false, error: null, refresh: () => {},
    mutate: async () => { throw new Error("History-only access must not mutate work"); },
  }} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
    await expect(canvas.queryByRole("button", { name: "합성 품목 A 수행기록·이력" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "합성 조제 세트 더 보기" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "수행기록" }));
    await userEvent.click(within(body.getByRole("dialog", { name: "수행기록" })).getByRole("button", { name: "합성 품목 A" }));
    await waitFor(() => expect(body.getByText("조회 전용입니다. 수행기록을 변경할 수 없습니다.")).toBeVisible());
    await expect(executionReads).toEqual(["/api/workspaces/synthetic-row-history/fulfillment/work-items/synthetic-item-a/execution"]);
  },
};


export const LongInstructionRows: Story = {
  render: () => <div style={{ width: 760, maxWidth: "100%" }}><InstructionBody workspaceId="synthetic-long-instructions" onChanged={() => {}} controller={{
    document: { ...structuredClone(syntheticInstruction), canEditInstruction: false,
      instruction: "세트 공통 지시의 첫 번째 줄입니다.\n세트 공통 지시의 두 번째 줄입니다.",
      items: syntheticInstruction.items.map(item => ({ ...item,
        name: "긴 이름의 합성 오더 품목 ".repeat(5), instruction: "개별 지시의 첫 번째 줄입니다.\n개별 지시의 두 번째 줄입니다.",
        canComplete: false, canReopen: false, canAssign: false })) },
    assignees: [], loading: false, busy: false, error: null, refresh: () => {}, mutate: async () => false,
  }} /></div>,
};
