import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within, waitFor } from "storybook/test";
import { syntheticInstruction } from "../instruction-fixtures";
import type { InstructionItem } from "@/features/fulfillment/instruction-contract";
import type { InstructionIntent } from "../use-fulfillment-instruction";
import { InstructionActions, InstructionBody, InstructionDocumentOutputMenu } from "./instruction-workspace";

const mixedStatuses: Array<[string, InstructionItem["status"]]> = [
  ["합성 다", "in_progress"],
  ["합성 가", "paused"],
  ["합성 나", "in_progress"],
  ["합성 대기", "requested"],
  ["합성 완료", "completed"],
  ["합성 취소", "cancelled"],
  ["합성 반려", "returned"],
];

function Example({
  single = false,
  readOnly = false,
  failed = false,
  orderEditHold = false,
  busy = false,
  splitRoutes = false,
  queueType = "dispensing",
  displayConditions = false,
  width = 1100,
  onOpenChart,
  onCopyLink,
}: {
  single?: boolean;
  readOnly?: boolean;
  failed?: boolean;
  orderEditHold?: boolean;
  busy?: boolean;
  splitRoutes?: boolean;
  queueType?: typeof syntheticInstruction.queueType;
  displayConditions?: boolean;
  width?: number;
  onOpenChart: () => void;
  onCopyLink: () => void;
}) {
  const [document, setDocument] = useState(() => ({
    ...structuredClone(syntheticInstruction),
    queueType,
    pauseReason: orderEditHold ? ("order_edit" as const) : undefined,
    oralInstruction: queueType === "dispensing" ? {
      chartId: "28110000-0000-4000-8000-000000000011", revision: 1,
      instruction: "현재 차트 경구제 전체 지시입니다.\n여러 줄이어도 지시사항을 모두 확인할 수 있어요.",
      history: [], snapshots: [],
    } : undefined,
    isSet: !single,
    items: displayConditions ? [
      ...mixedStatuses.map(([name, status], index) => {
        const id = `synthetic-filter-${index}`;
        return { ...structuredClone(syntheticInstruction.items[0]), id, orderId: id, taskId: id, name, status };
      }),
      { ...structuredClone(syntheticInstruction.items[0]), name: "합성 수정" },
    ] : structuredClone(single ? syntheticInstruction.items.slice(0, 1) : syntheticInstruction.items)
      .map((item, index) => splitRoutes && index === 1 ? {
        ...item, plan: { ...item.plan, detailInputs: { ...item.plan.detailInputs as object, route: "topical" } },
      } : item),
    changes: splitRoutes ? [
      ...syntheticInstruction.changes,
      {
        ...syntheticInstruction.changes[0],
        id: "synthetic-internal-change",
        orderId: syntheticInstruction.items[1].orderId,
        before: { calculationOutputs: { internalValue: 1 } },
        after: { calculationOutputs: { internalValue: 2 } },
      },
    ] : syntheticInstruction.changes,
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
    busy,
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
        changes: intent.action === "edit_instruction" ? [
          ...previous.changes,
          {
            id: "synthetic-common-instruction-change",
            orderId: previous.rootOrderId,
            createdAt: "2026-10-27T02:00:00Z",
            actorName: "합성 수의사",
            changeType: "amendment",
            before: { instruction: previous.instruction },
            after: { instruction: intent.instruction },
          },
        ] : previous.changes,
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
        <InstructionActions inDocumentToolbar workspaceId="synthetic-workspace" controller={controller} onChanged={() => {}} />
        <InstructionDocumentOutputMenu workspaceId="synthetic-workspace" controller={controller} onChanged={() => {}} onOpenChart={onOpenChart} onCopyLink={onCopyLink} />
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
  args: { onOpenChart: fn(), onCopyLink: fn() },
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
      canvas.getByRole("button", { name: "합성 품목 A 완료" }),
    ).toBeDisabled();
    const completion = within(canvas.getByRole("group", { name: "조제 완료 보조 작업" }));
    await expect(completion.getByRole("button", { name: "조제 완료" })).toBeEnabled();
    await userEvent.click(completion.getByRole("button", { name: "업무 상태 변경" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "완료 항목 다시 진행" }));
    const reopen = within(await body.findByRole("dialog", { name: "진행 중으로 변경할까요?" }));
    await userEvent.click(reopen.getByRole("radio", { name: "합성 품목 A" }));
    await userEvent.click(reopen.getByRole("button", { name: "진행 중으로 변경" }));
    await expect(canvas.getByRole("button", { name: "합성 품목 A 완료" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "합성 완료 품목 완료" })).toBeDisabled();
    await waitFor(() =>
      expect(body.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};
export const SingleInstruction: Story = {
  args: { single: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "필터" }));
    const emptyGroup = await body.findByRole("menuitemradio", { name: "취소된 오더" });
    const count = within(emptyGroup).getByText("0", { exact: true });
    await waitFor(() => expect(count).toBeVisible());
    await userEvent.click(emptyGroup);
    await expect(canvas.queryByRole("cell", { name: "합성 품목 A" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "필터 초기화" }));
    await expect(canvas.getByRole("button", { name: "필터" })).toHaveFocus();
    await expect(canvas.getByRole("cell", { name: "합성 품목 A" })).toBeVisible();
  },
};
export const Compact: Story = {
  args: { width: 760 },
  play: async ({ args, canvasElement }) => {
    const more = within(canvasElement).getByRole("button", { name: "문서 추가 작업" });
    const body = within(canvasElement.ownerDocument.body);
    more.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await body.findByRole("menuitem", { name: "오더 차트로 이동" }));
    await expect(args.onOpenChart).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(getComputedStyle(more).pointerEvents).not.toBe("none"));
    await userEvent.click(more);
    await userEvent.click(await body.findByRole("menuitem", { name: "지시서 링크 복사" }));
    await expect(args.onCopyLink).toHaveBeenCalledTimes(1);
  },
};
export const TreatmentWithHistory: Story = { args: { queueType: "treatment" } };
const testFilterAndSort: NonNullable<Story["play"]> = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const body = within(canvasElement.ownerDocument.body);
  const clickMenuOption = async (name: string) => {
    const option = await body.findByRole("menuitemradio", { name });
    await waitFor(() => expect(option).toHaveStyle({ pointerEvents: "auto" }));
    await userEvent.click(option);
  };
  const visibleNames = () => Array.from(canvasElement.querySelectorAll(".fd-name"), (cell) => cell.textContent);
  const original = ["합성 다", "합성 가", "합성 나"];
  const groups = [
    ["추가된 오더", ["합성 대기"]],
    ["수정된 오더", ["합성 수정"]],
    ["기존 오더", original],
    ["완료 오더", ["합성 완료"]],
    ["취소된 오더", ["합성 취소", "합성 반려"]],
  ] as const;
  const allNames = groups.flatMap(([, names]) => [...names]);
  await expect(visibleNames()).toEqual(allNames);
  await expect(canvas.queryByRole("button", { name: "필터 해제" })).not.toBeInTheDocument();

  const filter = canvas.getByRole("button", { name: "필터" });
  filter.focus();
  await userEvent.keyboard("{Enter}");
  const options = await body.findAllByRole("menuitemradio");
  await expect(options).toHaveLength(5);
  for (const [index, [label, names]] of groups.entries()) {
    await expect(options[index]).toHaveAccessibleName(label);
    await expect(options[index]).toHaveAttribute("aria-checked", "false");
    const count = within(options[index]).getByText(String(names.length), { exact: true });
    await waitFor(() => expect(count).toBeVisible());
  }
  await userEvent.keyboard("{Escape}");

  for (const [label, names] of groups) {
    await userEvent.click(canvas.getByRole("button", { name: /^필터(?:,|$)/ }));
    await clickMenuOption(label);
    await expect(canvas.getByRole("button", { name: `필터, ${label}, 조건 1개 적용 중` })).toBeVisible();
    await expect(visibleNames()).toEqual(names);
    const headings = canvasElement.querySelectorAll(".fd-section-heading");
    await expect(headings).toHaveLength(1);
    await expect(within(headings[0] as HTMLElement).getByText(label, { exact: true })).toBeVisible();
  }
  await expect(canvas.getByText("1/8 작업완료")).toBeVisible();

  await userEvent.click(canvas.getByRole("button", { name: /^필터,/ }));
  await clickMenuOption("기존 오더");
  const activeFilter = canvas.getByRole("button", { name: "필터, 기존 오더, 조건 1개 적용 중" });

  for (const [label, order] of [
    ["오더명 오름차순", ["합성 가", "합성 나", "합성 다"]],
    ["오더명 내림차순", ["합성 다", "합성 나", "합성 가"]],
    ["기본순", original],
  ] as const) {
    await userEvent.click(canvas.getByRole("button", { name: /^정렬,/ }));
    await clickMenuOption(label);
    await expect(canvas.getByRole("button", { name: `정렬, ${label}` })).toHaveTextContent(
      label === "기본순" ? "정렬" : label
    );
    await waitFor(() => expect(visibleNames()).toEqual(order));
  }
  await userEvent.click(activeFilter);
  const selectedGroup = await body.findByRole("menuitemradio", { name: "기존 오더", checked: true });
  await expect(selectedGroup).toHaveAttribute("aria-checked", "true");
  await userEvent.keyboard("{Escape}");

  const clearFilter = canvas.getByRole("button", { name: "필터 해제" });
  await expect(clearFilter).toBeVisible();
  clearFilter.focus();
  await userEvent.keyboard("{Enter}");
  await expect(visibleNames()).toEqual(allNames);
  await expect(canvas.getByRole("button", { name: /^필터$/ })).toHaveFocus();
  await expect(clearFilter).not.toBeInTheDocument();
};

export const DispensingFilterAndSort: Story = {
  args: { displayConditions: true },
  play: testFilterAndSort,
};

export const TreatmentFilterAndSort: Story = {
  args: { displayConditions: true, queueType: "treatment", width: 760 },
  play: testFilterAndSort,
};

export const HistoryByRoute: Story = {
  args: { splitRoutes: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const oral = canvas.getByRole("button", { name: "합성 품목 A 완료" }).closest<HTMLElement>(".fd-card");
    const topical = canvas.getByRole("button", { name: "합성 품목 B 완료" }).closest<HTMLElement>(".fd-card");
    if (!oral || !topical) throw new Error("Expected separate oral and topical cards");

    await expect(within(topical).queryByRole("button", { name: "수정이력" })).not.toBeInTheDocument();
    await expect(topical.querySelector(".fd-toolbar-divider")).toBeNull();
    await expect(oral.querySelector(".fd-toolbar-divider")).toBeVisible();
    await userEvent.click(within(oral).getByRole("button", { name: "수정이력" }));
    const dialog = await body.findByRole("dialog", { name: "수정 이력" });
    await expect(dialog).toHaveTextContent("1회량: 0.25 → 0.5");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());

    await userEvent.click(within(topical).getByRole("button", { name: "합성 조제 세트 더 보기" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "세트 공통 지시 수정" }));
    const edit = within(await body.findByRole("dialog", { name: "세트 공통 지시 수정" }));
    const instruction = edit.getByRole("textbox", { name: "공통 지시" });
    await userEvent.clear(instruction);
    await userEvent.type(instruction, "변경된 공통 지시");
    await userEvent.click(edit.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());

    await expect(topical.querySelector(".fd-toolbar-divider")).toBeVisible();
    await userEvent.click(within(topical).getByRole("button", { name: "수정이력" }));
    const topicalHistory = await body.findByRole("dialog", { name: "수정 이력" });
    await expect(topicalHistory).toHaveTextContent("세트 공통 지시사항입니다. → 변경된 공통 지시");
    await expect(topicalHistory).not.toHaveTextContent("1회량");
  },
};
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

const verifyDisabledCompletion: NonNullable<Story["play"]> = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const group = canvas.getByRole("group", { name: "조제 완료 보조 작업" });
  const complete = within(group).getByRole("button", { name: "조제 완료" });
  const arrow = within(group).getByRole("button", { name: "업무 상태 변경" });
  await expect(complete).toBeDisabled();
  await expect(arrow).toBeDisabled();
  await expect(getComputedStyle(group).backgroundColor).toBe("rgb(245, 245, 245)");
  await expect(getComputedStyle(complete).backgroundColor).toBe(getComputedStyle(arrow).backgroundColor);
  await expect(getComputedStyle(complete).color).toBe(getComputedStyle(arrow).color);
};

export const OrderEditHold: Story = {
  args: { orderEditHold: true },
  play: async (context) => {
    await verifyDisabledCompletion(context);
    await expect(within(context.canvasElement).getByText("수의사가 오더를 수정 중입니다.")).toBeVisible();
  },
};

export const SavingCompletion: Story = {
  args: { busy: true },
  play: verifyDisabledCompletion,
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
    await userEvent.click(canvas.getByRole("button", { name: "문서 추가 작업" }));
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
      canvas.getByRole("button", { name: "합성 품목 A 완료" }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: "합성 품목 B 완료" }),
    ).toBeDisabled();
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
      items: syntheticInstruction.items.map((item, index) => ({
        ...item,
        name: index === 0 ? "긴 이름의 합성 오더 품목 ".repeat(5).trim() : item.name,
        instruction: "개별 지시의 첫 번째 줄입니다.\n개별 지시의 두 번째 줄입니다.",
        plan: {
          ...item.plan,
          detailInputs: {
            ...item.plan.detailInputs as object,
            doseUnit: index === 0 ? "application" : "T",
            totalQuantityUnit: index === 1 ? "synthetic long dispensing unit" : "APPL",
          },
        },
        canComplete: false, canReopen: false, canAssign: false,
      })) },
    assignees: [], loading: false, busy: false, error: null, refresh: () => {}, mutate: async () => false,
  }} /></div>,
};
