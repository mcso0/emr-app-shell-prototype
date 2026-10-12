import { useId, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ActualInstructionCaller, prepareInstructionCaller, instructionCallerParameters } from "./instruction-caller.stories.fixture";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EmrInstructionHeaderStack, EmrInstructionHistoryToggle, EmrInstructionOutputMenu, EmrInstructionTitleBar } from "./instruction-header-stack";

type HeaderArgs = { chartAligned: boolean; resultDivider: boolean; showTitle: boolean; historyDisabled: boolean };
function HeaderStackExample({ chartAligned, resultDivider, showTitle, historyDisabled }: HeaderArgs) {
  const historyId = useId();
  const [historyOpen, setHistoryOpen] = useState(false);
  return <div className="grid max-w-3xl gap-3">
    <EmrInstructionHeaderStack chartAligned={chartAligned} resultDivider={resultDivider} titleBar={showTitle ? <EmrInstructionTitleBar title="합성 조제 지시" badge={<span className="text-xs">합성 초안</span>} actions={<>
      <EmrInstructionHistoryToggle ariaLabelPrefix="합성 이력" controls={historyId} expanded={historyOpen} disabled={historyDisabled} onClick={() => setHistoryOpen((value) => !value)} tooltipLabel="합성 이력 보기" />
      <EmrInstructionOutputMenu />
    </>} /> : null} orderInfo={<div className="rounded border p-3">합성 요청자 · 합성 환자 · 2026-05-01</div>} filters={<div className="text-sm">합성 오더 범위: 전체</div>} />
    <div id={historyId} data-testid="synthetic-instruction-history" hidden={!historyOpen}>합성 이력 내용</div>
  </div>;
}

const meta = {
  title: "Design System/EMR/EmrInstructionHeaderStack",
  component: HeaderStackExample,
  tags: ["autodocs"],
  parameters: { docs: {
      story: { inline: false, height: "800px" }, description: { component: "공통 EMR UI가 지시서 제목·요청 정보·필터 간격을 소유합니다. 조제·검사·영상·입원 기능은 titleBar/orderInfo/filters와 이력 상태를 전달합니다. 문서 toolbar에 제목이 있으면 titleBar=null로 사용합니다. TitleBar, HistoryToggle, OutputMenu를 합성 슬롯으로 조합합니다. 현재 OutputMenu의 PDF 다운로드·출력하기는 runtime에서 비활성이며 출력 기능이 아닙니다." } } },
  args: { chartAligned: true, resultDivider: true, showTitle: true, historyDisabled: false },
  argTypes: {
    chartAligned: { control: "boolean", description: "요청 정보·필터의 chart 정렬 패딩입니다." },
    resultDivider: { control: "boolean", description: "결과 영역 앞 divider 표시입니다." },
    showTitle: { control: "boolean", description: "fixture가 titleBar 슬롯을 제공할지 선택합니다." },
    historyDisabled: { control: "boolean", description: "fixture의 이력 toggle 비활성 상태입니다." },
  },
  render: (args) => <HeaderStackExample {...args} />,
} satisfies Meta<HeaderArgs>;

export default meta;
type Story = StoryObj<typeof meta>;
export const HistoryAndOutputMenu: Story = {
  beforeEach: prepareInstructionCaller,
  parameters: { ...instructionCallerParameters, controls: { disable: true }, docs: { description: { story: "Actual exported DispensingContent with real title bar, five-field info card, order filters, history panel and source-disabled output items. Source owns local table transitions; fetch and clipboard remain restored local fixtures." } } },
  render: () => <ActualInstructionCaller />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
    const history = await canvas.findByRole("button", { name: "처치 이력 패널 열기" });
    history.focus(); await userEvent.keyboard("{Enter}");
    await expect(history).toHaveAttribute("aria-pressed", "true");
    await expect(await canvas.findByText("조제/처치 이력")).toBeVisible();
    await userEvent.click(history); await waitFor(() => expect(canvas.queryByText("조제/처치 이력")).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "문서 추가 작업" }));
    const pdf = await body.findByRole("menuitem", { name: "PDF 다운로드" }), print = body.getByRole("menuitem", { name: "출력하기" });
    await expect(pdf).toHaveAttribute("aria-disabled", "true"); await expect(print).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}"); await waitFor(() => expect(body.queryByRole("menu")).not.toBeInTheDocument());
  },
};
export const DocumentLayout: Story = { argTypes: { historyDisabled: { control: false, table: { disable: true } } }, play: async ({ canvasElement }) => { await expect(canvasElement.querySelector('[data-slot="instruction-header-title-bar"]')).not.toBeInTheDocument(); await expect(canvasElement.querySelector('[data-slot="instruction-header-order-info"]')).toBeVisible(); }, args: { chartAligned: false, showTitle: false, resultDivider: false }, parameters: { docs: { description: { story: "문서 toolbar가 제목을 소유하는 실제 호출 방식처럼 titleBar=null을 전달합니다. 요청 정보와 필터만 남습니다." } } } };
export const HistoryDisabled: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); const history = canvas.getByRole("button", { name: "합성 이력 패널 열기" }); await expect(history).toBeDisabled(); history.focus(); await expect(history).not.toHaveFocus(); await userEvent.keyboard("{Enter}"); await expect(canvas.getByTestId("synthetic-instruction-history")).not.toBeVisible(); }, args: { historyDisabled: true }, parameters: { docs: { description: { story: "이력 toggle의 비활성 상태입니다. 호출 기능의 권한·준비 상태를 표시하며 서버 권한 검증을 대체하지 않습니다." } } } };
