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
        <InstructionActions controller={controller} onChanged={() => {}} />
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
    await expect(body.getByRole("dialog")).toBeVisible();
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
    await userEvent.click(canvas.getByRole("button", { name: /^수정$/ }));
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
      canvas.getByText("변경된 공통 지시", { exact: true }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "합성 품목 A 완료 해제" }),
    ).toBeEnabled();
    await expect(
      canvas.getByRole("button", { name: "합성 품목 B 완료 해제" }),
    ).toBeEnabled();
  },
};
