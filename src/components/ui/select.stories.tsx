import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

type SelectArgs = ComponentProps<typeof Select> & {
  label: string;
  size: ComponentProps<typeof SelectTrigger>["size"];
  invalid: boolean;
  disabled: boolean;
};

const departmentOptions = [
  { value: "general", label: "일반 진료" },
  { value: "lab", label: "검사" },
  { value: "imaging", label: "영상" },
  { value: "treatment", label: "처치" },
];

function ControlledSelect({
  label,
  size,
  invalid,
  disabled,
  value,
  defaultValue,
  ...args
}: SelectArgs) {
  const [selectedValue, setSelectedValue] = useState(
    value ?? defaultValue ?? "general"
  );

  return (
    <Select
      {...args}
      value={selectedValue}
      onValueChange={(nextValue) => setSelectedValue(nextValue ?? "general")}
    >
      <SelectTrigger
        aria-invalid={invalid}
        aria-label={label}
        className="w-56 bg-card"
        disabled={disabled}
        size={size}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectGroup>
          <SelectLabel>업무 유형</SelectLabel>
          {departmentOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

const meta = {
  title: "Design System/UI/Select",
  component: Select,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Select for compact single-choice form fields and dense operational filters. 사용할 때: one value must be chosen from a bounded list. 쓰지 말아야 할 때: multi-select, free-text search, page navigation, or long uncontrolled taxonomies.",
      },
    },
  },
  argTypes: {
    value: {
      control: "select",
      options: departmentOptions.map((option) => option.value),
      description: "Selected option value. Keep it synced with the consuming form state.",
    },
    label: {
      control: "text",
      description: "Accessible trigger label. Required when no visible label is bound to the select.",
    },
    size: {
      control: "radio",
      options: ["sm", "default", "xl"],
      description: "Trigger height. Use sm in dense toolbars and xl in spacious drawers.",
    },
    invalid: {
      control: "boolean",
      description: "Visual invalid state on the trigger. Pair it with field-level error text.",
    },
    disabled: {
      control: "boolean",
      description: "Visual disabled state for unavailable choices. Not a security boundary.",
    },
    onValueChange: {
      table: {
        disable: true,
      },
    },
  },
  args: {
    disabled: false,
    invalid: false,
    label: "샘플 업무 유형",
    size: "default",
    value: "general",
  },
  render: (args) => <ControlledSelect {...args} />,
} satisfies Meta<SelectArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 짧은 목록에서 하나의 업무 유형을 고를 때. 쓰지 말아야 할 때: 사용자가 직접 값을 입력해야 하는 필드.",
      },
    },
  },
};

export const SmallToolbarFilter: Story = {
  args: {
    label: "샘플 업무 필터",
    size: "sm",
    value: "lab",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 표나 큐 상단의 좁은 필터. 쓰지 말아야 할 때: 주요 form 입력처럼 충분한 터치 면적이 필요한 곳.",
      },
    },
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
    value: "imaging",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 선택값 검증이 실패했고 주변에 오류 문구가 있을 때. 쓰지 말아야 할 때: 오류 설명 없이 빨간 테두리만 표시할 때.",
      },
    },
  },
};

export const WithSections: Story = {
  render: (args) => {
    const [selectedValue, setSelectedValue] = useState(args.value ?? "general");

    return (
      <Select
        {...args}
        value={selectedValue}
        onValueChange={(nextValue) => setSelectedValue(nextValue ?? "general")}
      >
        <SelectTrigger aria-label={args.label} className="w-64 bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start">
          <SelectGroup>
            <SelectLabel>기본 업무</SelectLabel>
            <SelectItem value="general">일반 진료</SelectItem>
            <SelectItem value="treatment">처치</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>지원 업무</SelectLabel>
            <SelectItem value="lab">검사</SelectItem>
            <SelectItem value="imaging">영상</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 짧은 목록을 의미 있는 그룹으로 나누면 스캔이 쉬울 때. 쓰지 말아야 할 때: 그룹이 많아져 검색형 combobox가 더 적합한 경우.",
      },
    },
  },
};
