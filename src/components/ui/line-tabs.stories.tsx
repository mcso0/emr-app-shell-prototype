import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EmrInstructionFilterTabs } from "@/components/emr/instruction-filter-tabs";

import { LineTabs, type LineTabItem } from "./line-tabs";

const items: Array<LineTabItem<string>> = [
  { value: "all", label: "전체", count: 8 },
  { value: "waiting", label: "대기", count: 3 },
  { value: "unavailable", label: "준비 중", disabled: true },
];
type LineTabsExampleArgs = { value: string; size: "default" | "lg" };
function LineTabsExample({ value, size }: LineTabsExampleArgs) {
  const [selectedValue, setSelectedValue] = useState(value);
  return <LineTabs aria-label="합성 목록 필터" items={items} value={selectedValue} onValueChange={setSelectedValue} size={size} />;
}

function DispensingFilterCaller() {
  const [value, setValue] = useState<"all" | "oral" | "other">("all");
  // Same count/disabled derivation as dispensing/module.tsx:1862-1885.
  const oralRows = ["합성 경구제 A", "합성 경구제 B"];
  const otherRows: string[] = [];
  const oral = oralRows.length, other = otherRows.length, total = oral + other;
  return <div className="grid w-full max-w-lg gap-3">
    <EmrInstructionFilterTabs aria-label="오더 그룹 필터" value={value} onValueChange={setValue}
      items={[{ value: "all", label: "전체", count: total > 0 ? total : undefined, disabled: total === 0 },
        { value: "oral", label: "경구제", count: oral > 0 ? oral : undefined, disabled: oral === 0 },
        { value: "other", label: "기타", count: other > 0 ? other : undefined, disabled: other === 0 }]} />
    <output aria-label="합성 오더 그룹 선택">{value === "all" ? "전체" : value === "oral" ? "경구제" : "기타"}</output>
  </div>;
}

const meta = {
  title: "Design System/UI/LineTabs",
  component: LineTabsExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "목록의 간단한 필터를 밑줄로 표시합니다. role=group과 버튼 aria-pressed를 사용하며 별도 탭 패널이나 탭 화살표 탐색을 제공하지 않습니다. 관련 패널 전환에는 Tabs를 사용하세요. 선택값·합계·업무 동작은 호출자가 소유합니다. 아래 숫자와 선택 동작은 합성 예시입니다.",
      },
    },
  },
  args: { value: "all", size: "lg" },
  argTypes: {
    value: { control: "radio", options: ["all", "waiting"], description: "합성 선택값입니다. Controls 변경 시 예제 상태를 다시 시작합니다." },
    size: { control: "radio", options: ["default", "lg"], description: "Supported filter button size." },
  },
  render: (args) => <LineTabsExample key={args.value} {...args} />,
} satisfies Meta<LineTabsExampleArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <DispensingFilterCaller />,
  parameters: { controls: { disable: true }, docs: { description: { story: "실제 EmrInstructionFilterTabs와 조제 화면의 그룹명·합계·빈 그룹 disabled 계산입니다. 합성 경구제 2건·기타 0건을 제공하며 실제 조제 읽기나 완료는 실행하지 않습니다." } } },
  play: async ({ canvas }) => {
    const group = within(canvas.getByRole("group", { name: "오더 그룹 필터" }));
    const oral = group.getByRole("button", { name: "경구제 2" });
    const other = group.getByRole("button", { name: "기타" });
    await expect(other).toBeDisabled();
    await userEvent.click(oral);
    await waitFor(() => { expect(oral).toHaveAttribute("aria-pressed", "true"); expect(canvas.getByLabelText("합성 오더 그룹 선택")).toHaveTextContent("경구제"); });
    await userEvent.click(other);
    await expect(oral).toHaveAttribute("aria-pressed", "true");
    const all = group.getByRole("button", { name: "전체 2" });
    all.focus(); await userEvent.keyboard(" ");
    await waitFor(() => expect(canvas.getByLabelText("합성 오더 그룹 선택")).toHaveTextContent("전체"));
  },
};
export const Compact: Story = {
  parameters: { docs: { description: { story: "순수 LineTabs API의 default 크기입니다. 합성 선택값·개수·비활성 항목을 유지합니다. role=group이므로 패널이나 화살표 탭 탐색을 제공하지 않습니다." } } },
  args: { size: "default" },
  play: async ({ canvas }) => {
    const target = canvas.getByRole("button", { name: "대기 3" });
    await userEvent.click(target); await waitFor(() => expect(target).toHaveAttribute("aria-pressed", "true"));
    await expect(canvas.getByRole("button", { name: "전체 8" })).toHaveAttribute("aria-pressed", "false");
    await expect(canvas.getByRole("button", { name: "준비 중" })).toBeDisabled();
  },
};
