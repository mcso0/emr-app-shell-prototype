import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ActualInstructionCaller, prepareInstructionCaller, instructionCallerParameters } from "./instruction-caller.stories.fixture";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrInstructionFilterTabs } from "./instruction-filter-tabs";

type FilterValue = "all" | "pending" | "unavailable";
type FilterArgs = { initialValue: FilterValue };

function FilterTabsExample({ initialValue }: FilterArgs) {
  const [value, setValue] = useState(initialValue);
  return <div className="grid gap-3">
    <EmrInstructionFilterTabs aria-label="합성 오더 범위" value={value} onValueChange={setValue} items={[
      { value: "all", label: "전체", count: 3 },
      { value: "pending", label: "대기", count: 0 },
      { value: "unavailable", label: "사용 불가", disabled: true },
    ]} />
    <output>선택 범위: {value}</output>
  </div>;
}

const meta = {
  title: "Design System/EMR/EmrInstructionFilterTabs",
  component: FilterTabsExample,
  tags: ["autodocs"],
  parameters: { docs: {
      story: { inline: false, height: "800px" }, description: { component: "조제·검사 화면의 오더 범위를 고르는 LineTabs 조합입니다. value, items, onValueChange와 aria-label은 호출자 소유입니다. tabpanel 전환이 아닌 button group이며 선택은 aria-pressed로 표현합니다. count 0도 표시합니다. 예시는 합성 로컬 상태만 변경하며 실제 오더 조회를 수행하지 않습니다." } } },
  argTypes: { initialValue: { control: "radio", options: ["all", "pending"], description: "Storybook 로컬 상태의 시작 값입니다. 변경하면 예시를 다시 시작합니다." } },
  args: { initialValue: "all" },
  render: (args) => <FilterTabsExample key={args.initialValue} {...args} />,
} satisfies Meta<FilterArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SelectionAndDisabled: Story = {
  beforeEach: prepareInstructionCaller,
  parameters: { ...instructionCallerParameters, controls: { disable: true }, docs: { description: { story: "Actual exported DispensingContent with synthetic legacy source fixtures. Its source-built groups/counts/disabled filters and table transitions are retained; no operations API runs." } } },
  render: () => <ActualInstructionCaller />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filter = await canvas.findByRole("group", { name: "오더 그룹 필터" });
    const tabs = within(filter), oral = tabs.getByRole("button", { name: /경구제/ }), other = tabs.getByRole("button", { name: /기타/ });
    await expect(tabs.getByRole("button", { name: /전체/ })).toHaveTextContent(/전체\s*4/);
    await expect(oral).toHaveTextContent(/경구제\s*3/);
    await expect(other).toBeEnabled(); await expect(other).toHaveTextContent(/기타\s*1/);
    oral.focus(); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(oral).toHaveAttribute("aria-pressed", "true"));
    await waitFor(() => expect(canvas.getAllByRole("table")).toHaveLength(1));
    await expect(canvas.getByRole("table")).toHaveTextContent("Lactated Ringer's 120ml SC");
    await userEvent.click(other);
    await waitFor(() => expect(canvas.getByRole("table")).toHaveTextContent("Extension line 교체"));
    await userEvent.click(tabs.getByRole("button", { name: /전체/ }));
    await expect(tabs.getByRole("button", { name: /전체/ })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(canvas.getAllByRole("table")).toHaveLength(2));
  },
};

export const EmptyCount: Story = { args: { initialValue: "pending" }, play: async ({ canvasElement }) => { const canvas = within(canvasElement); const pending = canvas.getByRole("button", { name: /대기/ }); await expect(canvas.getByRole("button", { name: "사용 불가" })).toBeDisabled(); await expect(pending).toHaveAttribute("aria-pressed", "true"); await expect(pending).toHaveTextContent("0"); await userEvent.click(canvas.getByRole("button", { name: /전체/ })); await expect(canvas.getByText("선택 범위: all")).toBeVisible(); }, parameters: { docs: { description: { story: "건수가 0인 대기 범위도 선택 상태와 0을 표시합니다. 빈 결과 내용은 호출 기능이 소유합니다." } } } };
