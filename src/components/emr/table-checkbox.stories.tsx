import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ComponentProps } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { EmrTableHeaderCell, EmrTableSelectionCell, EmrTableSelectionHeaderCell } from "./table-primitives";

import { EmrTableCheckbox } from "./table-checkbox";

function CheckboxExample({ header = false, ...args }: ComponentProps<typeof EmrTableCheckbox> & { header?: boolean }) {
  const [checked, setChecked] = useState(Boolean(args.checked));
  const [mixed, setMixed] = useState(Boolean(args.indeterminate));
  const control = <span className="inline-flex size-6 items-center justify-center" data-row-interactive="true">
    <EmrTableCheckbox {...args} checked={checked} indeterminate={mixed} onCheckedChange={(next) => { setChecked(next); setMixed(false); }} />
  </span>;
  return <div className="max-w-md">
    <Table density="standard" layout="fill">
      <TableHeader><TableRow>{header ? <EmrTableSelectionHeaderCell>{control}</EmrTableSelectionHeaderCell> : <EmrTableSelectionHeaderCell>선택</EmrTableSelectionHeaderCell>}<EmrTableHeaderCell>합성 항목</EmrTableHeaderCell></TableRow></TableHeader>
      <TableBody><TableRow data-state={checked ? "selected" : undefined}><EmrTableSelectionCell>{header ? "—" : control}</EmrTableSelectionCell><TableCell>현재 표시한 행</TableCell></TableRow></TableBody>
    </Table>
    <output aria-label="선택 상태">{mixed ? "일부 선택" : checked ? "선택됨" : "선택 안 됨"}</output>
  </div>;
}

async function verifyCheckbox(canvasElement: HTMLElement) {
  const canvas = within(canvasElement), checkbox = canvas.getByRole("checkbox");
  const before = checkbox.getAttribute("aria-checked");
  checkbox.focus();
  if (checkbox.hasAttribute("disabled") || checkbox.getAttribute("aria-disabled") === "true") {
    await expect(checkbox).toHaveAttribute("aria-disabled", "true");
    await expect(checkbox).toHaveAttribute("tabindex", "-1");
    await userEvent.keyboard(" ");
    await expect(checkbox).toHaveAttribute("aria-checked", before!);
    await userEvent.click(checkbox);
    await expect(checkbox).toHaveAttribute("aria-checked", before!);
    await expect(canvas.getByLabelText("선택 상태")).toHaveTextContent("선택됨");
    return;
  }
  await userEvent.keyboard(" ");
  const next = before === "true" ? "false" : "true";
  await waitFor(() => expect(checkbox).toHaveAttribute("aria-checked", next));
  await expect(canvas.getByLabelText("선택 상태")).toHaveTextContent(next === "true" ? "선택됨" : "선택 안 됨");
}

const meta = {
  title: "Design System/EMR/EmrTableCheckbox",
  component: EmrTableCheckbox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrTableCheckbox as the semantic alias for table selection and compact table boolean states. It reuses the shared Figma-aligned Checkbox visual contract; neutral remains the default, while brand is reserved for an explicitly branded table state such as 주진단. 사용할 때: selection or a boolean state is part of a data grid. 쓰지 말아야 할 때: ordinary form acknowledgements or permission enforcement.",
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
    checkedTone: {
      control: "inline-radio",
      options: ["neutral", "brand"],
      description:
        "Checked-state tone. Neutral is the backwards-compatible default; brand resolves through the project sky/500 token.",
    },
    "aria-label": {
      control: "text",
      description: "Accessible label for row/header selection.",
    },
  },
  args: {
    "aria-label": "샘플 행 선택",
    checkedTone: "neutral",
    disabled: false,
  },
  render: (args) => <CheckboxExample key={`${args.checked}:${args.indeterminate}`} {...args} />,
} satisfies Meta<typeof EmrTableCheckbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RowSelection: Story = {
  play: async ({ canvasElement }) => verifyCheckbox(canvasElement),
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
  render: (args) => <CheckboxExample key={`${args.checked}:${args.indeterminate}`} {...args} header />,
  play: async ({ canvasElement }) => verifyCheckbox(canvasElement),
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
  render: (args) => <CheckboxExample key={`${args.checked}:${args.indeterminate}`} {...args} header />,
  play: async ({ canvasElement }) => verifyCheckbox(canvasElement),
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
  play: async ({ canvasElement }) => verifyCheckbox(canvasElement),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 선택 상태는 보이지만 현재 화면에서 변경할 수 없을 때. 쓰지 말아야 할 때: 권한 검증의 대체 수단.",
      },
    },
  },
};

export const BrandChecked: Story = {
  args: {
    checked: true,
    checkedTone: "brand",
    "aria-label": "샘플 주진단",
  },
  play: async ({ canvasElement }) => verifyCheckbox(canvasElement),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 디자인과 제품 계약이 브랜드 체크 상태를 명시한 진단 표 같은 경우. 일반 행 선택과 확진/종결 상태는 neutral을 유지합니다.",
      },
    },
  },
};
