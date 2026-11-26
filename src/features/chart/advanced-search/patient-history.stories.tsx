import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { cases } from "@/app/review/chart-search/cases";
import { createReviewSession } from "@/app/review/chart-search/review-session";
import { PatientHistory } from "./patient-history";

const source = cases.rows.find((chart) => chart.visitType === "appointment")!;
const session = createReviewSession(() => {});

const meta = {
  title: "Features/Chart/차트 상세 검색/환자 차트 이력",
  component: PatientHistory,
  decorators: [(Story) => <div className="relative h-[680px]"><Story /></div>],
  parameters: { layout: "fullscreen" },
  args: {
    source,
    api: session.api,
    favorites: [source.id],
    onFavorite: fn(),
    onClose: fn(),
    onOpenProfile: fn(),
    onCopy: fn(),
    onViewChart: fn(),
  },
} satisfies Meta<typeof PatientHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VisitHeaders: Story = {
  play: async ({ canvasElement }) => {
    const drawer = within(canvasElement);
    const toggle = drawer.getByRole("button", { name: /13:48 예약.*접기$/ });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(await drawer.findByText("외래", { exact: true })).toBeVisible();
    await expect(drawer.getByText("예약", { exact: true })).toBeVisible();
    await expect(drawer.queryByRole("button", { name: /즐겨찾기/ })).not.toBeInTheDocument();

    const copy = drawer.getByRole("button", { name: "식욕 저하와 무른 변 복사" });
    const more = drawer.getByRole("button", { name: "식욕 저하와 무른 변 더보기" });
    await expect(copy.getBoundingClientRect().right).toBeLessThanOrEqual(
      more.getBoundingClientRect().left,
    );
    copy.focus();
    await userEvent.tab();
    await expect(drawer.getByRole("button", { name: "식욕 저하와 무른 변 차트 보러가기" })).toHaveFocus();
    await userEvent.tab();
    await expect(more).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(body.getByRole("menuitem", { name: "이 차트만 펼치기" })).toBeVisible(),
    );
    await userEvent.keyboard("{Escape}");
  },
};
