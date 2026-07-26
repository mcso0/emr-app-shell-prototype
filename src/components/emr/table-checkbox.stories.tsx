import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Field, FieldLabel } from "@/components/ui/field";

import { EmrTableCheckbox } from "./table-checkbox";

const meta = {
  title: "Design System/EMR/EmrTableCheckbox",
  component: EmrTableCheckbox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrTableCheckbox as the semantic alias for table row and header selection. It reuses the shared Figma-aligned Checkbox visual contract without table-only color or disabled overrides. 사용할 때: selection is part of a data grid. 쓰지 말아야 할 때: ordinary form acknowledgements or permission enforcement.",
      },
    },
  },
  argTypes: {
    checked: {
      control: "boolean",
      description: "Controlled checked state for the table checkbox.",
    },
    disabled: {
      control: "boolean",
      description: "Disabled visual state. Not a security boundary.",
    },
    "aria-label": {
      control: "text",
      description: "Accessible label for row/header selection.",
    },
  },
  args: {
    "aria-label": "샘플 행 선택",
    disabled: false,
  },
} satisfies Meta<typeof EmrTableCheckbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RowSelection: Story = {
  render: (args) => (
    <Field orientation="horizontal">
      <EmrTableCheckbox id="sample-table-checkbox-row" {...args} />
      <FieldLabel htmlFor="sample-table-checkbox-row">샘플 행 선택</FieldLabel>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: table row 선택 상태를 보여줄 때. 쓰지 말아야 할 때: table 밖의 일반 form field.",
      },
    },
  },
};

export const HeaderSelection: Story = {
  args: {
    checked: true,
    "aria-label": "샘플 전체 행 선택",
  },
  render: (args) => (
    <Field orientation="horizontal">
      <EmrTableCheckbox id="sample-table-checkbox-header" {...args} />
      <FieldLabel htmlFor="sample-table-checkbox-header">전체 선택 예시</FieldLabel>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 현재 table page나 visible rows 전체 선택. 쓰지 말아야 할 때: 서버 전체 데이터 선택처럼 범위가 모호할 때.",
      },
    },
  },
};

export const HeaderIndeterminate: Story = {
  args: {
    indeterminate: true,
    "aria-label": "샘플 일부 행 선택",
  },
  render: (args) => (
    <Field orientation="horizontal">
      <EmrTableCheckbox
        id="sample-table-checkbox-indeterminate"
        {...args}
      />
      <FieldLabel htmlFor="sample-table-checkbox-indeterminate">
        일부 행 선택 예시
      </FieldLabel>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 현재 visible rows 중 일부만 선택된 header mixed state. aria-label에는 선택 범위를 명시합니다.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    checked: true,
    disabled: true,
  },
  render: (args) => (
    <Field orientation="horizontal">
      <EmrTableCheckbox id="sample-table-checkbox-disabled" {...args} />
      <FieldLabel htmlFor="sample-table-checkbox-disabled">잠긴 샘플 행</FieldLabel>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 선택 상태는 보이지만 현재 화면에서 변경할 수 없을 때. 쓰지 말아야 할 때: 권한 검증의 대체 수단.",
      },
    },
  },
};
