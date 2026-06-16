import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "./field";
import { Radio, RadioGroup } from "./radio-group";

type RadioGroupStoryArgs = {
  defaultValue: string;
  disabled: boolean;
  invalid: boolean;
  orientation: "vertical" | "horizontal";
};

const options = [
  {
    description: "짧고 밀도 높은 합성 목록에 적합합니다.",
    label: "촘촘하게",
    value: "compact",
  },
  {
    description: "일반적인 업무 화면에서 읽기 좋습니다.",
    label: "기본",
    value: "default",
  },
  {
    description: "검토용 화면에서 행간을 더 확보합니다.",
    label: "여유 있게",
    value: "comfortable",
  },
];

function RadioGroupExample({
  defaultValue,
  disabled,
  invalid,
  orientation,
}: RadioGroupStoryArgs) {
  return (
    <RadioGroup
      defaultValue={defaultValue}
      disabled={disabled}
      aria-invalid={invalid}
      className={orientation === "horizontal" ? "flex flex-wrap gap-4" : "max-w-md"}
      aria-label="샘플 밀도 선택"
    >
      {options.map((option) => (
        <Field
          key={option.value}
          orientation="horizontal"
          data-invalid={invalid || undefined}
          className="items-start"
        >
          <Radio value={option.value} id={`sample-radio-${option.value}`} />
          <FieldContent>
            <FieldLabel htmlFor={`sample-radio-${option.value}`}>
              {option.label}
            </FieldLabel>
            <FieldDescription>{option.description}</FieldDescription>
          </FieldContent>
        </Field>
      ))}
    </RadioGroup>
  );
}

const meta = {
  title: "Design System/UI/RadioGroup",
  component: RadioGroupExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use RadioGroup for mutually exclusive choices where all options should be visible. 사용할 때: the user must choose one option from a small set. 쓰지 말아야 할 때: independent multi-select, compact toolbar filters, or hidden command menus.",
      },
    },
  },
  argTypes: {
    defaultValue: {
      control: "radio",
      options: ["compact", "default", "comfortable"],
      description: "Initially selected option for the uncontrolled example.",
    },
    disabled: {
      control: "boolean",
      description: "Disables the whole group visually and functionally. Not a security boundary.",
    },
    invalid: {
      control: "boolean",
      description: "Marks the group as invalid. Pair with visible error copy in app forms.",
    },
    orientation: {
      control: "radio",
      options: ["vertical", "horizontal"],
      description: "Demo layout direction for the visible options.",
    },
  },
  args: {
    defaultValue: "default",
    disabled: false,
    invalid: false,
    orientation: "vertical",
  },
  render: (args) => <RadioGroupExample {...args} />,
} satisfies Meta<RadioGroupStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 작은 선택지 세트에서 하나만 골라야 할 때. 쓰지 말아야 할 때: 옵션이 많아 select나 search가 필요한 경우.",
      },
    },
  },
};

export const Horizontal: Story = {
  args: {
    orientation: "horizontal",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 짧은 label 선택지를 한 줄에서 비교할 때. 쓰지 말아야 할 때: 설명 copy가 길어져 wrap이 심한 경우.",
      },
    },
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 필수 단일 선택이 누락된 form validation. 쓰지 말아야 할 때: 오류 문구 없이 색상만으로 실패를 전달할 때.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: "comfortable",
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 현재 화면에서 선택을 보여주되 변경은 막아야 할 때. 쓰지 말아야 할 때: 권한 또는 서버 검증의 대체 수단.",
      },
    },
  },
};
