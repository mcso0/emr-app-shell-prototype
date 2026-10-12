import { useState, type ComponentProps, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";

import type { HomeTask } from "../home.types";
import { HomePanelCard } from "./home-panel-card";
import {
  HomeMutedPill,
  HomeNextActionPriorityBadge,
  HomeTaskDecisionBadge,
  HomeTaskDecisionPill,
  HomeTaskStatusBadge,
} from "./home-task-badges";
import { MyWorkPanel } from "./my-work-panel";

const tasks: HomeTask[] = [
  { id: "synthetic-urgent", title: "합성 긴급 진료", kanbanColumn: "chart", sourceLabel: "합성 요청", requestedAt: "2026-10-11T09:00:00+09:00", status: "in_progress", priority: "urgent", domain: "chart", assignment: "assigned", recommendedAction: "합성 요약 확인", actionHref: "#synthetic-chart", actionLabel: "합성 열기" },
  { id: "synthetic-lab", title: "합성 검사 대기", kanbanColumn: "lab", sourceLabel: "합성 검사 큐", requestedAt: "2026-10-11T09:00:00+09:00", dueAt: "2026-10-11T10:30:00+09:00", status: "overdue", priority: "high", domain: "lab", assignment: "roleQueue", roleQueueLabel: "합성 역할 큐", recommendedAction: "합성 검사 요청 검토", actionHref: "#synthetic-lab", actionLabel: "합성 확인" },
  { id: "synthetic-reception", title: "합성 접수 확인", kanbanColumn: "waiting", sourceLabel: "합성 접수", requestedAt: "2026-10-11T09:00:00+09:00", status: "waiting", priority: "normal", domain: "reception", assignment: "assigned", recommendedAction: "합성 접수 상태 확인", actionHref: "#synthetic-reception", actionLabel: "합성 보기" },
];

const badgeTasks: HomeTask[] = [
  ...tasks,
  { ...tasks[2], id: "synthetic-active-badge", title: "합성 일반 진행 상태", status: "in_progress" },
  { ...tasks[2], id: "synthetic-queue-badge", title: "합성 역할 큐 상태", assignment: "roleQueue" },
];

type MyWorkExampleArgs = ComponentProps<typeof MyWorkPanel>;

function MyWorkExample(args: MyWorkExampleArgs) {
  const [filter, setFilter] = useState(args.activeFilter);
  const [domain, setDomain] = useState(args.activeDomain);
  return (
    <MyWorkPanel
      {...args}
      activeFilter={filter}
      activeDomain={domain}
      onFilterChange={(next) => { setFilter(next); args.onFilterChange(next); }}
      onDomainChange={(next) => { setDomain(next); args.onDomainChange(next); }}
    />
  );
}

function LocalLinks({ children }: { children: ReactNode }) {
  const [requested, setRequested] = useState("없음");
  return <div className="max-w-4xl" onClickCapture={event => {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (link) { event.preventDefault(); setRequested(link.getAttribute("href") ?? "없음"); }
  }}>{children}<output className="block p-2 text-xs" aria-label="합성 홈 이동 요청">{requested}</output></div>;
}
const meta = {
  title: "Features/Home/My Work Panel",
  component: MyWorkPanel,
  tags: ["autodocs"],
  parameters: {
    docs: { story: { inline: false, height: "620px" }, description: { component: "기존 MyWorkPanel과 TaskListItem의 독립 갤러리입니다. 현재 HomeContent는 이 패널을 사용하지 않습니다. 패널이 상태·영역 필터와 최대 일곱 행 표시를 소유합니다. 예제가 선택값을 로컬로 제어하며 Controls의 초기값 변경 시 다시 시작합니다. dueToday는 현재 소스에서 dueAt 유무로 판단하므로 실제 날짜 비교를 보장하지 않습니다. 링크 요청은 로컬 output에 기록하며 업무 데이터·저장·권한은 호출자 책임입니다." } },
  },
  args: {
    tasks,
    launchers: [{ id: "synthetic-launcher", label: "합성 접수 큐", href: "#synthetic-launcher", domain: "reception" }],
    activeFilter: "all",
    activeDomain: "all",
    onFilterChange: () => undefined,
    onDomainChange: () => undefined,
  },
  argTypes: {
    tasks: { control: "object", description: "실제 tasks prop에 전달하는 합성 업무입니다." },
    launchers: { control: "object", description: "전체 업무가 비었을 때 표시하는 합성 시작점입니다." },
    activeFilter: { control: "radio", options: ["all", "urgent", "dueToday", "overdue", "roleQueue"], description: "로컬 제어 예제의 초기 업무 필터입니다." },
    activeDomain: { control: "select", options: ["all", "chart", "reception", "lab", "dispensing", "billing", "inpatient"], description: "로컬 제어 예제의 초기 영역 필터입니다." },
    onFilterChange: { control: false, description: "필터 선택 콜백입니다. 예제는 로컬 상태만 바꿉니다." },
    onDomainChange: { control: false, description: "영역 선택 콜백입니다. 예제는 로컬 상태만 바꿉니다." },
  },
  render: (args) => <MyWorkExample key={`${args.activeFilter}:${args.activeDomain}`} {...args} />,
  decorators: [(Story) => <LocalLinks><Story /></LocalLinks>],
} satisfies Meta<typeof MyWorkPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

async function waitForPanelState(condition: () => boolean, message: string) {
  await waitFor(() => { if (!condition()) throw new Error(message); });
}

export const Filters: Story = {
  parameters: { docs: { description: { story: "긴급 필터와 영역 필터를 바꿔 합성 행과 빈 결과가 갱신되는지 확인합니다. TaskListItem의 우선순위·영역·미배정·기한 표시도 포함합니다." } } },
  play: async ({ canvasElement }) => {
    const choose = async (groupLabel: string, label: string) => {
      const group = canvasElement.querySelector(`[role="group"][aria-label="${groupLabel}"]`);
      const button = Array.from(group?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((item) => item.textContent?.trim().startsWith(label));
      if (!button) throw new Error(`Missing ${groupLabel} option ${label}.`);
      await userEvent.click(button);
      return button;
    };
    const urgent = await choose("내 업무 상태 필터", "긴급");
    await waitForPanelState(
      () => urgent.getAttribute("aria-pressed") === "true" && canvasElement.querySelectorAll("article").length === 1 && canvasElement.querySelector("article")?.textContent?.includes("합성 긴급 진료") === true,
      "The urgent filter must show only the synthetic urgent task.",
    );
    await choose("내 업무 영역 필터", "검사");
    await waitForPanelState(
      () => canvasElement.querySelectorAll("article").length === 0 && canvasElement.textContent?.includes("선택한 조건에 맞는 내 업무가 없습니다.") === true,
      "Combining urgent and lab filters must show the empty result state.",
    );
    await choose("내 업무 상태 필터", "전체");
    await waitForPanelState(
      () => canvasElement.querySelectorAll("article").length === 1 && canvasElement.querySelector("article")?.textContent?.includes("합성 검사 대기") === true,
      "Clearing the status filter must retain the chosen lab domain.",
    );
  },
};

export const Empty: Story = {
  args: { tasks: [] },
  parameters: { docs: { description: { story: "전체 업무가 없을 때 필터 대신 합성 시작점 링크를 표시합니다. 링크는 예제 안에서 이동하지 않습니다." } } },
  play: async ({ canvasElement }) => { const link = canvasElement.querySelector("a")!; await userEvent.click(link); await waitFor(() => expect(canvasElement.querySelector('[aria-label="합성 홈 이동 요청"]')).toHaveTextContent("#synthetic-launcher")); },
};

export const NoMatchingTasks: Story = {
  args: { activeDomain: "billing" },
  parameters: { docs: { description: { story: "업무는 있지만 선택한 수납 영역에 결과가 없는 상태입니다. 전체 빈 상태와 다른 문구를 유지합니다." } } },
};

export const SevenItemLimit: Story = {
  args: { tasks: Array.from({ length: 8 }, (_, index) => ({ ...tasks[2], id: `synthetic-row-${index}`, title: `합성 업무 ${index + 1}` })) },
  parameters: { docs: { description: { story: "전체 건수는 8건이며 실제 소스의 slice 제한으로 일곱 행만 표시합니다. 페이지 이동 기능은 없습니다." } } },
  play: async ({ canvasElement }) => {
    if (canvasElement.querySelectorAll("article").length !== 7 || canvasElement.textContent?.includes("합성 업무 8")) {
      throw new Error("MyWorkPanel must retain its seven-row presentation limit.");
    }
  },
};

export const TaskBadgeReference: Story = {
  render: (args) => (
    <div className="grid gap-4">
      <MyWorkExample key={`${args.activeFilter}:${args.activeDomain}`} {...args} />
      <HomePanelCard className="gap-3 p-4">
        <h2 className="text-sm font-semibold">기존 홈 배지 표시 참고</h2>
        {badgeTasks.map((task) => (
          <div key={task.id} className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{task.title}</span>
            <HomeTaskDecisionBadge task={task} label="합성 판단" />
            <HomeTaskStatusBadge task={task} label="합성 상태" />
            <HomeTaskDecisionPill task={task} label="합성 큐" />
          </div>
        ))}
        <div className="flex gap-2">
          <HomeMutedPill label="합성 보조 정보" />
          <HomeNextActionPriorityBadge action={{ id: "synthetic-next", title: "합성 다음 작업", sourceLabel: "합성", priorityLabel: "합성 우선", dueLabel: "기한 없음", evidence: [], actionHref: "#synthetic-next", actionLabel: "합성 보기", tone: "danger" }} />
        </div>
      </HomePanelCard>
    </div>
  ),
  parameters: { docs: { description: { story: "home-task-badges의 기존 export를 패널 아래 표시 참고용으로 묶습니다. 실제 MyWorkPanel의 행은 TaskListItem이며 이 추가 배지 모음을 렌더링하지 않습니다. 현재 제품 레이아웃이나 업무 판단 정책을 제안하는 예제가 아닙니다." } } },
};
