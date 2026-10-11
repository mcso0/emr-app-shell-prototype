import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "@/components/ui/button";

import { EmrTableFilterBuilder } from "./table-filter-builder";
import { createSampleFilterModel, sampleFilterFields, SampleFilterResults } from "./table-filter.stories.fixture";

type TableFilterBuilderArgs = {
  closeVisible: boolean;
  initialCompleteRule: boolean;
  title: string;
};

function TableFilterBuilderExample({
  closeVisible,
  initialCompleteRule,
  title,
}: TableFilterBuilderArgs) {
  const [model, setModel] = useState(() => createSampleFilterModel(initialCompleteRule ? 1 : 0));
  const [open, setOpen] = useState(true);

  return (
    <div className="max-w-[720px]">
      {open ? <div className="rounded-xl border border-border bg-popover shadow-md"><EmrTableFilterBuilder
        fields={sampleFilterFields}
        model={model}
        onModelChange={setModel}
        onClose={closeVisible ? () => setOpen(false) : undefined}
        title={title}
        addFilterLabel="필터 추가"
        clearAllLabel="전체 초기화"
        description="완성된 조건만 자동 적용되며, 그룹 안과 그룹 사이는 선택한 AND/OR로 계산됩니다."
      /></div> : <Button onClick={() => setOpen(true)}>필터 다시 열기</Button>}
      <SampleFilterResults model={model} />
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrTableFilterBuilder",
  component: TableFilterBuilderExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "600px" },
      description: {
        component:
          "Use EmrTableFilterBuilder for advanced table filters where users compose field, operator, and value rules. 사용할 때: a data grid needs explicit multi-rule filtering. 쓰지 말아야 할 때: simple segmented filters, global search, or feature-specific query/persistence logic.",
      },
    },
  },
  argTypes: {
    closeVisible: {
      control: "boolean",
      description: "Whether to show a close affordance.",
    },
    initialCompleteRule: {
      control: "boolean",
      description: "Whether the example starts with one complete synthetic rule.",
    },
    title: {
      control: "text",
      description: "Filter builder title.",
    },
  },
  args: {
    closeVisible: true,
    initialCompleteRule: true,
    title: "필터",
  },
  render: (args) => <TableFilterBuilderExample key={String(args.initialCompleteRule)} {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByLabelText("필터 결과")).toHaveTextContent(args.initialCompleteRule ? "완성된 조건 1개 · 결과 1건" : "완성된 조건 0개 · 결과 3건");
    if (!args.initialCompleteRule) {
      await userEvent.click(canvas.getByRole("combobox", { name: "그룹 1 조건 1 필터 필드" }));
      await userEvent.click(await body.findByRole("option", { name: "상태" }));
    }
    await userEvent.click(canvas.getByRole("combobox", { name: "그룹 1 조건 1 필터 값" }));
    await userEvent.click(await body.findByRole("option", { name: "대기" }));
    await waitFor(() => expect(canvas.getByRole("list", { name: "필터 업무 목록" })).toHaveTextContent("합성 대기 업무"));
    await expect(canvas.queryByText("합성 진행 업무")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "전체 초기화" }));
    await expect(canvas.getByLabelText("필터 결과")).toHaveTextContent("완성된 조건 0개 · 결과 3건");
    if (args.closeVisible) {
      await userEvent.click(canvas.getByRole("button", { name: "필터 닫기" }));
      await expect(canvas.queryByRole("combobox")).not.toBeInTheDocument();
      await userEvent.click(canvas.getByRole("button", { name: "필터 다시 열기" }));
      await expect(canvas.getByRole("combobox", { name: "그룹 1 조건 1 필터 필드" })).toBeVisible();
    }
  },
} satisfies Meta<TableFilterBuilderArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CompleteRule: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: field/operator/value가 완성된 active filter 상태를 보여줄 때. 쓰지 말아야 할 때: 단순 상태 탭이나 검색 input으로 충분한 경우.",
      },
    },
  },
};

export const EmptyDraft: Story = {
  args: {
    initialCompleteRule: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 새 필터 draft를 시작하는 초기 상태. 쓰지 말아야 할 때: 빈 상태를 실제 적용된 filter처럼 보이게 할 때.",
      },
    },
  },
};
