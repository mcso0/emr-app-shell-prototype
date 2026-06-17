import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Field, FieldDescription, FieldLabel } from "./field";
import { Checkbox } from "./checkbox";

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
      description: "Controlled checked state. Use with onCheckedChange in app forms.",
    },
    defaultChecked: {
      control: "boolean",
      description: "Initial unchecked/checked state for uncontrolled examples.",
    },
    disabled: {
      control: "boolean",
      description: "Visual unavailable state. Do not treat disabled as a security boundary.",
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
  render: (args) => (
    <Field orientation="horizontal">
      <Checkbox id="sample-checkbox-default" {...args} />
      <FieldLabel htmlFor="sample-checkbox-default">샘플 항목 선택</FieldLabel>
    </Field>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 한 항목을 선택하거나 제외하는 독립 선택. 쓰지 말아야 할 때: 하나만 골라야 하는 옵션 그룹.",
      },
    },
  },
};

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
  render: (args) => (
    <Field orientation="horizontal">
      <Checkbox id="sample-checkbox-checked" {...args} />
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

export const Invalid: Story = {
  args: {
    "aria-invalid": true,
  },
  render: (args) => (
    <Field orientation="horizontal" data-invalid>
      <Checkbox id="sample-checkbox-invalid" {...args} />
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
  args: {
    checked: true,
    disabled: true,
  },
  render: (args) => (
    <Field orientation="horizontal">
      <Checkbox id="sample-checkbox-disabled" {...args} />
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
