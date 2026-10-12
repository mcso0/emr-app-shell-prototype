import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";

import { ReceptionEmptyState, ReceptionPanelStateMessage, ReceptionSearchInput } from "./reception-list-search";

function SearchExample(args: ComponentProps<typeof ReceptionSearchInput>) {
  const [value, setValue] = useState(args.value);
  return <div className="grid w-80 gap-3">
    <ReceptionSearchInput {...args} value={value} onValueChange={(next) => { setValue(next); args.onValueChange(next); }} />
    <output aria-label="합성 검색어">{value || "검색어 없음"}</output>
  </div>;
}

const meta = {
  title: "Features/Reception/List Search",
  component: ReceptionSearchInput,
  tags: ["autodocs"],
  args: { "aria-label": "접수 목록 검색", placeholder: "검색어 입력", value: "", onValueChange: () => undefined },
  argTypes: {
    value: { control: "text", description: "호출 기능이 관리하는 검색어입니다." },
    clearLabel: { control: "text", description: "검색어 초기화 버튼의 접근 가능한 이름입니다." },
    onValueChange: { control: false, description: "입력 또는 초기화 후의 검색어를 전달합니다." },
  },
  render: (args) => <SearchExample key={args.value} {...args} />,
  parameters: { docs: { story: { inline: false, height: "460px" }, description: { component: "접수 목록의 검색 입력과 초기화 버튼을 표시합니다. 실제 API는 aria-label, placeholder, value, onValueChange와 선택 배치 props입니다. SearchExample은 검색어만 로컬 상태로 관리합니다. 실제 목록 필터링, 조회와 권한은 호출 기능이 담당합니다. 같은 소스의 ReceptionEmptyState와 ReceptionPanelStateMessage도 별도 표시 예제로 제공합니다." } } },
} satisfies Meta<typeof ReceptionSearchInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  parameters: { docs: { description: { story: "빈 검색어에는 초기화 버튼이 없습니다. 입력 후 로컬 검색어가 바뀌는지 확인합니다." } } },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector("input");
    if (!input || canvasElement.querySelector("button")) throw new Error("빈 검색 입력 상태가 올바르지 않습니다.");
    await userEvent.type(input, "합성 검색");
    await waitFor(() => expect(canvasElement.querySelector("output")).toHaveTextContent("합성 검색"));
  },
};
export const PopulatedAndClear: Story = {
  args: { value: "합성 검색", clearLabel: "접수 검색어 지우기" },
  parameters: { docs: { description: { story: "검색어가 있으면 지정된 이름의 초기화 버튼을 표시합니다. 누르면 입력과 로컬 검색어가 비워집니다." } } },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLButtonElement>('button[aria-label="접수 검색어 지우기"]');
    if (!button) throw new Error("검색어 초기화 버튼이 없습니다.");
    await userEvent.click(button);
    await waitFor(() => { expect(canvasElement.querySelector("input")).toHaveValue(""); expect(canvasElement.querySelector("output")).toHaveTextContent("검색어 없음"); expect(canvasElement.querySelector("button")).not.toBeInTheDocument(); });
  },
};
export const NoResults: Story = {
  argTypes: Object.fromEntries(["value", "aria-label", "placeholder", "clearLabel", "onValueChange", "className", "inputClassName", "clearButtonClassName"].map(key => [key, { control: false }])),
  parameters: { docs: { description: { story: "ReceptionEmptyState에 호출 기능의 제목과 설명을 전달한 예제입니다. 검색 결과 자체를 조회하지 않습니다." } } },
  render: () => <div className="h-80 w-80"><ReceptionEmptyState description="검색어를 바꿔 다시 확인해 주세요.">검색 결과가 없습니다</ReceptionEmptyState></div>,
};
export const PanelMessages: Story = {
  argTypes: Object.fromEntries(["value", "aria-label", "placeholder", "clearLabel", "onValueChange", "className", "inputClassName", "clearButtonClassName"].map(key => [key, { control: false }])),
  parameters: { docs: { description: { story: "ReceptionPanelStateMessage의 muted, warning, danger 안내를 비교합니다. 메시지 선택과 복구 동작은 호출 기능이 담당합니다." } } },
  render: () => <div className="w-80"><ReceptionPanelStateMessage>목록을 확인해 주세요.</ReceptionPanelStateMessage><ReceptionPanelStateMessage tone="warning">일부 항목을 확인하지 못했습니다.</ReceptionPanelStateMessage><ReceptionPanelStateMessage tone="danger">목록을 불러오지 못했습니다.</ReceptionPanelStateMessage></div>,
};
