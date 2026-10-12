import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import { useState, type ComponentProps } from "react";
import { expect, userEvent } from "storybook/test";

import { Field, FieldDescription, FieldLabel } from "./field";
import { Checkbox } from "./checkbox";

function ControlledCheckbox(args: ComponentProps<typeof Checkbox>) {
  const [checked, setChecked] = useState(Boolean(args.checked ?? args.defaultChecked));
  const [mixed, setMixed] = useState(Boolean(args.indeterminate));
  return <Checkbox {...args} defaultChecked={undefined} checked={checked} indeterminate={mixed}
    onCheckedChange={(next) => { setMixed(false); setChecked(next); }} />;
}
function BillingCheckboxCaller() {
  const [included, setIncluded] = useState(false);
  return <div className="grid justify-items-start gap-3">
    <label className="flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 emr-text-metadata">
    <Checkbox aria-label="타 보호자 청구서 포함" checked={included} onClick={(event) => { event.preventDefault(); setIncluded((current) => !current); }} />
    <span>타 보호자 청구서 포함</span>
    </label>
    <output aria-label="합성 청구서 범위">{included ? "타 보호자 포함" : "현재 보호자만"}</output>
  </div>;
}

const meta = {
  title: "Design System/UI/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Checkbox for independent binary selections, row selection, and consent-like acknowledgements in EMR forms. 사용할 때: each checked state can stand alone. 쓰지 말아야 할 때: mutually exclusive choices, immediate mode toggles, or permission enforcement.",
      },
    },
  },
  argTypes: {
    checked: {
      control: "boolean",
      description: "이 예제에서는 초기 선택값입니다. Control 변경은 예제를 다시 시작하며 이후 클릭은 로컬 값을 바꿉니다.",
    },
    defaultChecked: {
      control: "boolean",
      description: "Initial unchecked/checked state for uncontrolled examples.",
    },
    disabled: {
      control: "boolean",
      description: "Visual unavailable state. Do not treat disabled as a security boundary.",
    },
    indeterminate: {
      control: "boolean",
      description:
        "Mixed selection state for visible table rows or partially selected groups.",
    },
    "aria-invalid": {
      control: "boolean",
      description: "Marks the checkbox as invalid. Pair it with visible field-level error text.",
    },
    onCheckedChange: {
      table: {
        disable: true,
      },
    },
  },
  args: {
    disabled: false,
    "aria-invalid": false,
  },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <BillingCheckboxCaller />,
  play: async ({ canvas }) => {
    const control = canvas.getByRole("checkbox", { name: /^타 보호자 청구서 포함/ });
    await userEvent.click(control); await expect(control).toBeChecked();
    await expect(canvas.getByLabelText("합성 청구서 범위")).toHaveTextContent("타 보호자 포함");
    control.focus(); await userEvent.keyboard(" "); await expect(control).not.toBeChecked();
    await expect(canvas.getByLabelText("합성 청구서 범위")).toHaveTextContent("현재 보호자만");
  },
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "수납 이력의 타 보호자 청구서 포함 설정입니다. 실제 checked와 preventDefault 후 상태 변경 콜백을 유지하며 범위만 로컬 결과로 표시합니다. 실제 청구서는 조회하지 않습니다.",
      },
    },
  },
};

export const Checked: Story = {
  play: async ({ canvas }) => { const control = canvas.getByRole("checkbox"); await expect(control).toBeChecked(); await userEvent.click(control); await expect(control).not.toBeChecked(); },
  args: {
    defaultChecked: true,
  },
  render: (args) => (
    <Field orientation="horizontal">
      <ControlledCheckbox key={`${args.checked}:${args.defaultChecked}:${args.indeterminate}`} id="sample-checkbox-checked" {...args} />
      <FieldLabel htmlFor="sample-checkbox-checked">샘플 확인 완료</FieldLabel>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 사용자가 이미 확인한 독립 상태를 보여줄 때. 쓰지 말아야 할 때: 완료 처리처럼 서버 저장이 필요한 상태를 시각 표시만으로 끝낼 때.",
      },
    },
  },
};

export const Indeterminate: Story = {
  play: async ({ canvas }) => { const control = canvas.getByRole("checkbox"); await expect(control).toHaveAttribute("aria-checked", "mixed"); await userEvent.click(control); await expect(control).toBeChecked(); },
  args: {
    indeterminate: true,
  },
  render: (args) => (
    <Field orientation="horizontal">
      <ControlledCheckbox key={`${args.checked}:${args.defaultChecked}:${args.indeterminate}`} id="sample-checkbox-indeterminate" {...args} />
      <FieldLabel htmlFor="sample-checkbox-indeterminate">
        일부 항목 선택
      </FieldLabel>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 현재 범위 안에서 일부 항목만 선택된 mixed state. 쓰지 말아야 할 때: 제3의 저장 값으로 취급할 때.",
      },
    },
  },
};

export const Invalid: Story = {
  play: async ({ canvas }) => { const control = canvas.getByRole("checkbox"); await expect(control).toHaveAttribute("aria-invalid", "true"); await userEvent.click(control); await expect(control).toBeChecked(); },
  args: {
    "aria-invalid": true,
  },
  render: (args) => (
    <Field orientation="horizontal" data-invalid>
      <ControlledCheckbox key={`${args.checked}:${args.defaultChecked}:${args.indeterminate}`} id="sample-checkbox-invalid" {...args} />
      <div className="flex flex-col gap-0.5">
        <FieldLabel htmlFor="sample-checkbox-invalid">샘플 동의 확인</FieldLabel>
        <FieldDescription>필수 확인이 필요한 합성 예시입니다.</FieldDescription>
      </div>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 필수 확인이 빠진 form validation. 쓰지 말아야 할 때: 오류 문구 없이 색상만으로 실패를 전달할 때.",
      },
    },
  },
};

export const Disabled: Story = {
  play: async ({ canvas }) => {
    const control = canvas.getByRole("checkbox");
    await expect(control).toHaveAttribute("aria-disabled", "true"); await expect(control).toHaveAttribute("data-disabled");
    control.focus(); await userEvent.keyboard(" "); await expect(control).toBeChecked();
  },
  args: {
    checked: true,
    disabled: true,
  },
  render: (args) => (
    <Field orientation="horizontal">
      <ControlledCheckbox key={`${args.checked}:${args.defaultChecked}:${args.indeterminate}`} id="sample-checkbox-disabled" {...args} />
      <FieldLabel htmlFor="sample-checkbox-disabled">잠긴 샘플 선택</FieldLabel>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 현재 화면에서 수정할 수 없는 선택 상태. 쓰지 말아야 할 때: 권한, 감사, 서버 검증의 대체 수단.",
      },
    },
  },
};

export const FigmaStateMatrix: Story = {
  render: () => (
    <div className="grid grid-cols-[repeat(5,minmax(80px,1fr))] gap-6">
      <StateSample label="기본">
        <ControlledCheckbox aria-label="기본 체크박스" />
      </StateSample>
      <StateSample label="선택">
        <ControlledCheckbox aria-label="선택 체크박스" checked />
      </StateSample>
      <StateSample label="일부 선택">
        <ControlledCheckbox aria-label="일부 선택 체크박스" indeterminate />
      </StateSample>
      <StateSample label="오류">
        <ControlledCheckbox aria-label="오류 체크박스" aria-invalid />
      </StateSample>
      <StateSample label="비활성">
        <ControlledCheckbox aria-label="비활성 체크박스" checked disabled />
      </StateSample>
    </div>
  ),
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "Figma 27814:152534의 기본·선택·indeterminate·invalid·disabled 표면을 한 화면에서 비교합니다. Focus와 invalid-focus는 Tab 키로 확인합니다.",
      },
    },
  },
};

function StateSample({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="flex min-h-20 flex-col items-center justify-center gap-3 rounded-lg border p-4">
      {children}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
