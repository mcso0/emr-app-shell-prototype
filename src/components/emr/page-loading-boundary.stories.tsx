import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EmrPageLoadingBoundary, usePageReadiness } from "./page-loading-boundary";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function Page({ pending, scope }: { pending: boolean; scope: string }) {
  usePageReadiness(pending, scope);
  return <><header>환자 정보 바</header><nav aria-label="페이지 탭">지시서 · 이력</nav>
    <label>작성 중 메모<input aria-label="작성 중 메모" defaultValue="보존할 메모" /></label>
    <Popover open><PopoverTrigger>추가 정보</PopoverTrigger><PopoverContent>페이지 보조 정보</PopoverContent></Popover>
  </>;
}
function Example() {
  const [pending, setPending] = useState(true);
  const [scope, setScope] = useState("A");
  return <div className="h-[480px]">
    <div className="flex gap-3">
      <button onClick={() => setPending(false)}>응답 완료</button>
      <button onClick={() => setPending(true)}>백그라운드 갱신</button>
      <button onClick={() => { setScope(scope === "A" ? "B" : "A"); setPending(true); }}>다른 업무</button>
    </div>
    <div className="h-[400px]"><EmrPageLoadingBoundary><Page pending={pending} scope={scope} /></EmrPageLoadingBoundary></div>
  </div>;
}
const meta = { title: "Design System/EMR/PageLoadingBoundary", component: Example, parameters: { layout: "fullscreen" } } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const InitialAndTransition: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId("page-loading-state")).toBeVisible());
    await expect(canvas.getByText("환자 정보 바")).not.toBeVisible();
    await expect(canvas.getByLabelText("작성 중 메모").closest("[inert]")).not.toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "응답 완료" }));
    const input = canvas.getByLabelText("작성 중 메모");
    await expect(input).toBeVisible();
    await userEvent.clear(input); await userEvent.type(input, "수정한 메모");
    await userEvent.click(canvas.getByRole("button", { name: "백그라운드 갱신" }));
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("수정한 메모");
    await userEvent.click(canvas.getByRole("button", { name: "다른 업무" }));
    await expect(input).not.toBeVisible();
    await waitFor(() => expect(canvas.getByRole("status")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "응답 완료" }));
    await expect(input).toHaveValue("수정한 메모");
    await userEvent.click(canvas.getByRole("button", { name: "다른 업무" }));
    await expect(input).not.toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "응답 완료" }));
    await expect(input).toBeVisible();
  },
};
export const PortalVisibility: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "응답 완료" }));
    await waitFor(() => expect(body.getByText("페이지 보조 정보")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "다른 업무" }));
    await expect(body.queryByText("페이지 보조 정보")).not.toBeVisible();
  },
};
