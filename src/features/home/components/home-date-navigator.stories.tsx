import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EmrDateNavigator } from "@/components/emr/subpanel";
import styles from "./home-workspace-layout.module.css";

// Same UTC-noon date offset as HomeKanbanWorkspace's caller, without its URL/API effects.
function offsetDate(date: string, amount: number) {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + amount);
  return day.toISOString().slice(0, 10);
}
function DateExample(args: ComponentProps<typeof EmrDateNavigator>) {
  const [date, setDate] = useState(args.selectedDate!);
  return <div className={args.appearance === "home" ? styles.hospitalTitle : "w-[288px]"}>
    <EmrDateNavigator {...args} selectedDate={date} dateLabel={date}
      className={args.appearance === "home" ? `${styles.dateControl} ${args.className ?? ""}` : args.className}
      todayLabel={date === args.todayDate ? args.todayLabel : undefined}
      onDateChange={(next) => { setDate(next); args.onDateChange?.(next); }}
      onPrevious={() => { setDate((current) => offsetDate(current, -1)); args.onPrevious?.(); }}
      onNext={() => { setDate((current) => offsetDate(current, 1)); args.onNext?.(); }} />
    <output aria-label="합성 선택 날짜" className="sr-only">{date}</output>
  </div>;
}
const meta = {
  title: "Features/Home/Home Date Navigator", component: EmrDateNavigator, tags: ["autodocs"],
  args: { dateLabel: "2026-09-27", selectedDate: "2026-09-27", todayDate: "2026-09-27", todayLabel: "오늘" },
  argTypes: { selectedDate: { control: "text", description: "초기 날짜. YYYY-MM-DD 형식입니다." }, todayDate: { control: "text" },
    onDateChange: { control: false }, onPrevious: { control: false }, onNext: { control: false }, dateLabel: { control: false, description: "선택 날짜에서 계산합니다." } },
  render: (args) => <DateExample key={`${args.selectedDate}:${args.appearance}`} {...args} />,
  parameters: { docs: { description: { component: "HomeKanbanWorkspace의 날짜 이동·오늘 배지·날짜 선택 구성을 사용합니다. 같은 UTC 날짜 계산으로 로컬 선택 날짜를 바꿉니다. 실제 caller의 URL/query 변경과 대시보드 조회는 합성 날짜 output으로 대체합니다. compact는 공통 API 비교이며 현재 홈 caller는 home 모양을 사용합니다." } } },
} satisfies Meta<typeof EmrDateNavigator>;
export default meta;
type Story = StoryObj<typeof meta>;
async function moveAndPick(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "다음 날짜" }));
  await waitFor(() => expect(canvas.getByLabelText("합성 선택 날짜")).toHaveTextContent("2026-09-28"));
  await expect(canvas.queryByText("오늘", { exact: true })).not.toBeInTheDocument();
  await userEvent.click(canvas.getByRole("button", { name: "이전 날짜" }));
  await waitFor(() => expect(canvas.getByLabelText("합성 선택 날짜")).toHaveTextContent("2026-09-27"));
  await expect(canvas.getByText("오늘", { exact: true })).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: /날짜 선택$/ }));
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(await body.findByRole("button", { name: /26\.09\.26 \(토\) 선택$/ }));
  await waitFor(() => expect(canvas.getByLabelText("합성 선택 날짜")).toHaveTextContent("2026-09-26"));
  await userEvent.click(canvas.getByRole("button", { name: /날짜 선택$/ }));
  await userEvent.click(await body.findByRole("button", { name: "오늘로 이동" }));
  await waitFor(() => expect(canvas.getByLabelText("합성 선택 날짜")).toHaveTextContent("2026-09-27"));
}
export const HospitalDateNavigator: Story = {
  args: { appearance: "home", formatSelectedDateLabel: (date) => { const [year, month, day] = date.split("-").map(Number); return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? `${String(year).slice(-2)}년 ${month}월 ${day}일` : date; } },
  parameters: { docs: { description: { story: "실제 홈 제목의 모양과 콜백 구조를 유지하며 이전·다음·날짜 선택·오늘 복귀를 확인합니다." } } },
  play: async ({ canvasElement }) => moveAndPick(canvasElement),
};
export const SidebarDateNavigator: Story = {
  args: { appearance: "compact" },
  parameters: { docs: { description: { story: "공통 compact API 비교입니다. 같은 로컬 날짜 이동과 달력 동작을 확인합니다." } } },
  play: async ({ canvasElement }) => moveAndPick(canvasElement),
};
export const LongDateAndTodayBadge: Story = {
  args: { ...HospitalDateNavigator.args, selectedDate: "2026-11-28", todayDate: "2026-11-28" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvasElement.ownerDocument.fonts.ready;
    const checkGeometry = () => {
      const trigger = canvas.getByRole("button", { name: /날짜 선택$/ });
      const text = trigger.querySelector<HTMLElement>("span.truncate")!;
      expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth);
      const badge = canvas.queryByText("오늘", { exact: true });
      if (badge?.getClientRects().length) expect(text.getBoundingClientRect().right).toBeLessThanOrEqual(badge.getBoundingClientRect().left);
      expect(text.getBoundingClientRect().right).toBeLessThanOrEqual(trigger.getBoundingClientRect().right);
    };
    await waitFor(checkGeometry);
    await userEvent.click(canvas.getByRole("button", { name: "이전 날짜" }));
    await expect(canvas.getByLabelText("합성 선택 날짜")).toHaveTextContent("2026-11-27");
    await waitFor(checkGeometry);
    await userEvent.click(canvas.getByRole("button", { name: "다음 날짜" }));
    const badge = canvas.getByText("오늘", { exact: true });
    if (window.matchMedia("(max-width: 800px)").matches) await expect(badge).not.toBeVisible();
    else await expect(badge).toBeVisible();
    await waitFor(checkGeometry);
  },
};
