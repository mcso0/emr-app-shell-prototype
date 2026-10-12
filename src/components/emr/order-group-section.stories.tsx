import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ActualInstructionCaller, prepareInstructionCaller, instructionCallerParameters } from "./instruction-caller.stories.fixture";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrOrderGroupSection } from "./order-group-section";

type GroupArgs = { initialCollapsed: boolean; empty: boolean; richTitle: boolean };

function GroupExample({ initialCollapsed, empty, richTitle }: GroupArgs) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [actions, setActions] = useState(0);
  return <EmrOrderGroupSection title={richTitle ? <span>합성 검사</span> : "합성 검사"} label="합성 요청 묶음" count={empty ? 0 : 2} meta={<span className="text-xs">합성 담당</span>} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} actions={<button type="button" onClick={() => setActions((value) => value + 1)}>그룹 작업 <output>{actions}</output></button>}>
    <div data-testid="synthetic-order-content">{empty ? "합성 오더가 없습니다." : "합성 혈액검사 · 합성 영상검사"}</div>
  </EmrOrderGroupSection>;
}

const meta = {
  title: "Design System/EMR/EmrOrderGroupSection",
  component: GroupExample,
  tags: ["autodocs"],
  parameters: { docs: {
      story: { inline: false, height: "800px" }, description: { component: "조제·검사·영상 오더를 제목·건수·작업과 접이식 본문으로 묶는 공통 section입니다. collapsed와 onToggle은 호출자 소유이며 펼침/접힘 애니메이션은 reduced motion을 따릅니다. 문자열이 아닌 title은 토글 접근성 이름에 오더 그룹을 사용합니다. 서버 오더 상태나 권한 모델을 소유하지 않습니다." } } },
  args: { initialCollapsed: false, empty: false, richTitle: false },
  argTypes: {
    initialCollapsed: { control: "boolean", description: "로컬 disclosure의 시작 상태입니다." },
    empty: { control: "boolean", description: "0건과 호출자 소유 빈 본문을 보여줍니다." },
    richTitle: { control: "boolean", description: "ReactNode title의 접근성 이름 fallback을 보여줍니다." },
  },
  render: (args) => <GroupExample key={String(args.initialCollapsed)} {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement), name = args.richTitle ? "오더 그룹" : "합성 검사";
    const toggle = canvas.getByRole("button", { name: `${name} ${args.initialCollapsed ? "펼치기" : "접기"}` });
    await userEvent.click(canvas.getByRole("button", { name: /그룹 작업/ }));
    await expect(canvasElement.querySelector("output")).toHaveTextContent("1");
    await expect(toggle).toHaveAttribute("aria-expanded", String(!args.initialCollapsed));
    toggle.focus(); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", String(args.initialCollapsed)));
    if (args.initialCollapsed) await waitFor(() => expect(canvas.getByTestId("synthetic-order-content")).toBeVisible());
    else await waitFor(() => expect(canvas.queryByTestId("synthetic-order-content")).not.toBeInTheDocument());
  },
} satisfies Meta<GroupArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disclosure: Story = {
  beforeEach: prepareInstructionCaller,
  parameters: { ...instructionCallerParameters, controls: { disable: true }, docs: { description: { story: "Actual exported DispensingContent: source order group title/count/completed metadata/actions and real OrderWorkTable. Unconnected history/filter controls are disabled and marked 준비 중. Korean column labels follow the shared table metadata contract." } } },
  render: () => <ActualInstructionCaller />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole("button", { name: "수액 처치 접기" });
    await expect(canvas.getByRole("table", { name: "조제/처치 section-0 오더 테이블" })).toBeVisible();
    const table = within(canvas.getByRole("table", { name: "조제/처치 section-0 오더 테이블" }));
    for (const label of ["오더명", "상태", "1회 용량", "투여 빈도", "일수", "복용", "회분", "청구 수량", "단위", "처방 총량", "제형", "보관", "복약지도", "담당", "작업여부"]) {
      await expect(table.getByRole("columnheader", { name: new RegExp(label) })).toBeVisible();
    }
    for (const button of canvas.getAllByRole("button", { name: /수정이력조회 \(준비 중\)|필터 1 \(준비 중\)/ })) await expect(button).toBeDisabled();
    toggle.focus(); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.queryByRole("table", { name: "조제/처치 section-0 오더 테이블" })).not.toBeInTheDocument());
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.getByRole("table", { name: "조제/처치 section-1 오더 테이블" })).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.getByRole("table", { name: "조제/처치 section-0 오더 테이블" })).toBeVisible());
  },
};

export const Collapsed: Story = { args: { initialCollapsed: true }, parameters: { docs: { description: { story: "접힌 시작 상태에서도 제목·건수·작업은 유지됩니다." } } } };
export const Empty: Story = { args: { empty: true }, parameters: { docs: { description: { story: "count 0을 생략하지 않으며 빈 결과 설명은 children으로 전달합니다." } } } };
export const RichTitle: Story = { args: { richTitle: true }, parameters: { docs: { description: { story: "ReactNode 제목의 토글 이름은 오더 그룹 접기/펼치기입니다." } } } };
