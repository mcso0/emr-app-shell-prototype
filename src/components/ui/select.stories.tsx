import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ScheduleEditorCallerExample } from "./caller-parity.stories.fixture";
import { Field, FieldError, FieldLabel } from "./field";

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
    <Field className="max-w-sm">
    <FieldLabel>{label}</FieldLabel>
    <Select
      {...args}
      items={departmentOptions}
      value={selectedValue}
      disabled={disabled}
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
    {invalid ? <FieldError>업무 유형을 확인하세요.</FieldError> : null}
    </Field>
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
          "이 스토리는 Select를 로컬 상태로 제어합니다. value Control은 초기 선택값이며 변경하면 예제를 다시 시작합니다. items는 합성 부서 목록입니다. 실제 데이터·권한·저장은 호출자가 소유합니다. Use Select for compact single-choice form fields and dense operational filters. 사용할 때: one value must be chosen from a bounded list. 쓰지 말아야 할 때: multi-select, free-text search, page navigation, or long uncontrolled taxonomies.",
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
      options: ["sm", "default", "lg", "xl"],
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
  render: (args) => <ControlledSelect key={String(args.value)} {...args} />,
} satisfies Meta<SelectArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ScheduleEditorCallerExample />,
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "근무 추가" }));
    const dialog = within(await page.findByRole("dialog", { name: "근무 추가" }));
    const trigger = dialog.getByRole("combobox", { name: "근무 유형" });
    await userEvent.click(trigger);
    await userEvent.click(await page.findByRole("option", { name: "휴무일" }));
    await waitFor(() => expect(trigger).toHaveTextContent("휴무일"));
    await expect(dialog.queryByLabelText("업무")).not.toBeInTheDocument();
    await expect(dialog.queryByLabelText("시작")).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(canvas.getByLabelText("합성 근무 저장 결과")).toHaveTextContent("off · synthetic-vet"));
  },
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "실제 근무 편집기입니다. 유형 변경은 표시 필드와 저장 검증을 함께 바꿉니다. 직원과 저장 결과만 합성 데이터·로컬 콜백으로 대체합니다.",
      },
    },
  },
};

export const SmallToolbarFilter: Story = {
  play: async ({ canvas, canvasElement }) => {
    const trigger = canvas.getByRole("combobox");
    await expect(trigger).toHaveAttribute("data-size", "sm");
    await userEvent.click(trigger);
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("option", { name: "처치" }));
    await waitFor(() => expect(trigger).toHaveTextContent("처치"));
  },
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
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("combobox")).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByRole("alert")).toHaveTextContent("업무 유형을 확인하세요.");
  },
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

function SelectSectionsExample(args: SelectArgs) {
    const { label, size, invalid, disabled, value, ...rootProps } = args;
    const [selectedValue, setSelectedValue] = useState(value ?? "general");

    return (
      <Field className="max-w-sm">
      <FieldLabel>{label}</FieldLabel>
      <Select
        {...rootProps}
        disabled={disabled}
        items={departmentOptions}
        value={selectedValue}
        onValueChange={(nextValue) => setSelectedValue(nextValue ?? "general")}
      >
        <SelectTrigger aria-label={label} size={size} aria-invalid={invalid} disabled={disabled} className="w-64 bg-card">
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
      {invalid ? <FieldError>업무 유형을 확인하세요.</FieldError> : null}
      </Field>
    );
}

export const WithSections: Story = {
  play: async ({ canvas, canvasElement }) => {
    const trigger = canvas.getByRole("combobox");
    await userEvent.click(trigger);
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(page.getByText("기본 업무")).toBeVisible());
    await waitFor(() => expect(page.getByText("지원 업무")).toBeVisible());
    await userEvent.click(page.getByRole("option", { name: "영상" }));
    await waitFor(() => expect(trigger).toHaveTextContent("영상"));
  },
  render: (args) => <SelectSectionsExample key={String(args.value)} {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 짧은 목록을 의미 있는 그룹으로 나누면 스캔이 쉬울 때. 쓰지 말아야 할 때: 그룹이 많아져 검색형 combobox가 더 적합한 경우.",
      },
    },
  },
};
