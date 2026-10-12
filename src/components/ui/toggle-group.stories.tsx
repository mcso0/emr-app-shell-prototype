import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { toast } from "sonner";
import { HospitalOperatingHoursEditor } from "@/features/hospital-admin/settings/hospital-operating-hours-editor";
import { createInitialHospitalBasicSettingsDraft } from "@/features/hospital-admin/settings/hospital-basic-settings-model";

import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

type ToggleGroupArgs = Pick<
  ComponentProps<typeof ToggleGroup>,
  "disabled" | "multiple" | "orientation" | "size" | "variant"
>;

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

function ControlledToggleGroup({
  disabled = false,
  multiple = true,
  orientation = "horizontal",
  size = "sm",
  variant = "primary",
}: ToggleGroupArgs) {
  const [value, setValue] = useState<string[]>(
    multiple ? ["월", "화", "수", "목", "금"] : ["월"]
  );

  return (
    <ToggleGroup
      aria-label="운영 요일 예시"
      disabled={disabled}
      multiple={multiple}
      onValueChange={setValue}
      orientation={orientation}
      size={size}
      value={value}
      variant={variant}
    >
      {weekdays.map((day) => (
        <ToggleGroupItem key={day} aria-label={`${day}요일`} value={day}>
          {day}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function OperatingHoursCaller() {
  const [value, setValue] = useState(() => {
    const draft = createInitialHospitalBasicSettingsDraft();
    draft.contact = { phone: "", fax: "", homepage: "", instagram: "", customerGuideMemo: "" };
    return draft;
  });
  return <div className="grid w-full max-w-4xl gap-3">
    <HospitalOperatingHoursEditor value={value} validationIssues={[]} onChange={setValue} />
    <output aria-label="합성 운영 요일 초안">일요일 · {value.weeklyHours.sunday.isOpen ? "운영" : "휴무"}</output>
  </div>;
}

const meta = {
  title: "Design System/UI/ToggleGroup",
  component: ToggleGroup,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "320px" },
      description: {
        component:
          "Controls는 실제 ToggleGroup props의 부분 집합입니다. 선택값은 합성 요일 예제가 로컬로 관리하며 multiple의 초기 선택값은 마운트 시 정해집니다. 호출자는 실제 선택값·변경 처리·저장을 소유합니다. Use ToggleGroup for related pressed controls that may allow one or multiple values. The primitive remains deselectable; use SegmentedControl when one value must always remain selected.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["primary", "ghost", "outline", "default"],
      description:
        "Group visual contract. primary owns its padded surface; outline connects item borders.",
    },
    size: {
      control: "radio",
      options: ["xs", "sm", "md", "default", "lg"],
      description: "Shared Toggle item size contract.",
    },
    multiple: {
      control: "boolean",
      description: "Allows more than one pressed value when true.",
    },
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Requested layout direction. Current main does not forward orientation to Base UI, so vertical keyboard navigation is not guaranteed.",
    },
    disabled: {
      control: "boolean",
      description: "Disables the full group. Not a permission boundary.",
    },
  },
  args: {
    disabled: false,
    multiple: true,
    orientation: "horizontal",
    size: "sm",
    variant: "primary",
  },
  render: (args) => <ControlledToggleGroup key={String(args.multiple)} {...args} />,
} satisfies Meta<ToggleGroupArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Multiple: Story = {
  beforeEach: () => {
    // The real editor emits only success/error toasts. Keep these local and restore them.
    const success = toast.success, error = toast.error;
    toast.success = () => "synthetic-hours-success"; toast.error = () => "synthetic-hours-error";
    return () => { toast.success = success; toast.error = error; };
  },
  render: () => <OperatingHoursCaller />,
  parameters: { controls: { disable: true }, docs: { story: { height: "1300px" }, description: { story: "실제 HospitalOperatingHoursEditor를 렌더합니다. 원본 weekday 값·aria-label·multiple·sm·spacing=1과 주간 일정 변경을 확인합니다. 편집은 로컬 draft에 반영합니다. 원본 토스트 호출은 합성 결과로 대체하고 종료 시 복원합니다. 서버 저장은 실행하지 않습니다." } } },
  play: async ({ canvas }) => {
    const sunday = canvas.getByRole("button", { name: "일요일 운영" });
    const monday = canvas.getByRole("button", { name: "월요일 운영" });
    await expect(sunday).toHaveAttribute("aria-pressed", "false");
    await expect(canvas.getByRole("button", { name: "일요일 운영시간 설정" })).toBeDisabled();
    await userEvent.click(sunday);
    await waitFor(() => { expect(sunday).toHaveAttribute("aria-pressed", "true"); expect(monday).toHaveAttribute("aria-pressed", "true"); expect(canvas.getByLabelText("합성 운영 요일 초안")).toHaveTextContent("일요일 · 운영"); expect(canvas.getByRole("button", { name: "일요일 운영시간 설정" })).toBeEnabled(); });
    await userEvent.keyboard(" ");
    await waitFor(() => { expect(canvas.getByLabelText("합성 운영 요일 초안")).toHaveTextContent("일요일 · 휴무"); expect(within(canvas.getByTestId("hospital-settings-day-sunday")).getByText("휴무일", { selector: '[data-slot="badge"]' })).toBeVisible(); });
  },
};

export const Single: Story = {
  play: async ({ canvas }) => { const monday = canvas.getByRole("button", { name: "월요일" }); const sunday = canvas.getByRole("button", { name: "일요일" }); await userEvent.click(sunday); await waitFor(() => { expect(sunday).toHaveAttribute("aria-pressed", "true"); expect(monday).toHaveAttribute("aria-pressed", "false"); }); await userEvent.click(sunday); await waitFor(() => expect(sunday).toHaveAttribute("aria-pressed", "false")); },
  args: {
    multiple: false,
    variant: "outline",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Single ToggleGroup permits deselection under the existing Base UI contract. Use SegmentedControl for a required single choice.",
      },
    },
  },
};

export const Variants: Story = {
  play: async ({ canvas }) => { for (const group of canvas.getAllByRole("group", { name: "운영 요일 예시" })) { const sunday = within(group).getByRole("button", { name: "일요일" }); await userEvent.click(sunday); await waitFor(() => expect(sunday).toHaveAttribute("aria-pressed", "true")); } },
  parameters: { controls: { disable: true }, docs: { description: { story: "같은 합성 선택 상태에 primary·ghost·outline 표시를 적용합니다." } } },
  render: () => (
    <div className="grid gap-5">
      {(["primary", "ghost", "outline"] as const).map((variant) => (
        <div key={variant} className="grid gap-2">
          <span className="emr-text-metadata text-muted-foreground">
            {variant}
          </span>
          <ControlledToggleGroup variant={variant} />
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  play: async ({ canvas }) => { for (const group of canvas.getAllByRole("group", { name: "운영 요일 예시" })) { const sunday = within(group).getByRole("button", { name: "일요일" }); await userEvent.click(sunday); await waitFor(() => expect(sunday).toHaveAttribute("aria-pressed", "true")); } },
  parameters: { controls: { disable: true }, docs: { description: { story: "같은 그룹을 xs·sm·md 크기로 비교합니다." } } },
  render: () => (
    <div className="grid gap-4">
      <ControlledToggleGroup size="xs" />
      <ControlledToggleGroup size="sm" />
      <ControlledToggleGroup size="md" />
    </div>
  ),
};

export const Vertical: Story = {
  play: async ({ canvas }) => { const monday = canvas.getByRole("button", { name: "월요일" }); monday.focus(); await userEvent.keyboard("{ArrowDown}"); await expect(monday).toHaveFocus(); await userEvent.keyboard("{ArrowRight}"); await expect(canvas.getByRole("button", { name: "화요일" })).toHaveFocus(); const sunday = canvas.getByRole("button", { name: "일요일" }); await userEvent.click(sunday); await waitFor(() => expect(sunday).toHaveAttribute("aria-pressed", "true")); },
  tags: ["depends_on_unmerged_product_change"],
  parameters: {
    docs: {
      description: {
        story: "현재 main의 수직 요청 예제입니다. wrapper가 orientation을 Base UI에 전달하지 않아 수직 키보드 탐색을 보장하지 않습니다. 이 API 예제의 ArrowDown이 초점을 옮기지 않고 ArrowRight가 옮기는 현재 동작을 검증합니다. 실제 제품에 수직 호출부는 없으므로 화면 회귀를 의미하지 않습니다. 호출자 style의 내부 spacing 덮어쓰기는 별도 원본 API 검토 사항입니다.",
      },
    },
  },
  args: {
    orientation: "vertical",
    variant: "outline",
  },
};

export const Disabled: Story = {
  play: async ({ canvas }) => { const sunday = canvas.getByRole("button", { name: "일요일" }) as HTMLButtonElement; await expect(sunday).toBeDisabled(); sunday.focus(); await expect(sunday).not.toHaveFocus(); await userEvent.keyboard(" "); await expect(sunday).toHaveAttribute("aria-pressed", "false"); await expect(canvas.getByRole("button", { name: "월요일" })).toHaveAttribute("aria-pressed", "true"); },
  parameters: { docs: { description: { story: "전체 그룹을 비활성화합니다. 실제 권한 판단은 호출자와 서버의 책임입니다." } } },
  args: {
    disabled: true,
  },
};
