import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrTableFilterBuilder } from "./table-filter-builder";
import {
  createInitialEmrTableFilterBuilderModel,
  type EmrTableFilterBuilderField,
  type EmrTableFilterBuilderModel,
} from "./table-filter-builder-model";

type SampleRow = {
  area: string;
  owner: string;
  status: string;
};

type TableFilterBuilderArgs = {
  closeVisible: boolean;
  initialCompleteRule: boolean;
  title: string;
};

const sampleFields: Array<EmrTableFilterBuilderField<SampleRow>> = [
  {
    id: "status",
    label: "상태",
    options: [
      { label: "대기", value: "waiting" },
      { label: "진행", value: "active" },
      { label: "완료", value: "done" },
    ],
    valuePlaceholder: "상태 선택",
  },
  {
    id: "owner",
    label: "담당",
    valueKind: "text",
    valuePlaceholder: "담당 입력",
  },
];

function getInitialModel(initialCompleteRule: boolean): EmrTableFilterBuilderModel {
  if (!initialCompleteRule) return createInitialEmrTableFilterBuilderModel("sample-filter");

  return {
    combinator: "and",
    id: "sample-filter",
    rules: [
      {
        combinator: "and",
        fieldId: "status",
        id: "sample-filter-rule-1",
        operatorId: "is",
        value: "active",
      },
    ],
  };
}

function TableFilterBuilderExample({
  closeVisible,
  initialCompleteRule,
  title,
}: TableFilterBuilderArgs) {
  const [model, setModel] = useState(() => getInitialModel(initialCompleteRule));

  return (
    <div className="max-w-3xl rounded-lg border border-border bg-popover p-4">
      <EmrTableFilterBuilder
        fields={sampleFields}
        model={model}
        onModelChange={setModel}
        onClose={closeVisible ? () => undefined : undefined}
        title={title}
        addFilterLabel="필터 추가"
        clearAllLabel="전체 초기화"
        description="합성 table filter builder 예시입니다. 완성된 조건만 active filter로 계산합니다."
      />
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrTableFilterBuilder",
  component: TableFilterBuilderExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
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
    title: "샘플 필터",
  },
  render: (args) => <TableFilterBuilderExample {...args} />,
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
