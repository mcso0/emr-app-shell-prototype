import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EditableProfileAvatar,
  PresenceBadge,
  ProfileHeaderActionMenu,
  StatusMessageEditor,
} from "./components/profile-side-panel-v2-header";
import { ProfileAvailabilitySummary } from "./components/profile-side-panel-v2-profile";
import {
  FulfillmentStatusBadge,
  ProfileAssignedWorkCard,
  ProfileWorkStatusTab,
  StaffWorkTimeline,
  WorkCategoryBadge,
  WorkNavigationDialog,
  type ProfileAssignedWorkItem,
} from "./components/profile-side-panel-v2-work";

const sampleWorkItem: ProfileAssignedWorkItem = {
  category: "lab",
  categoryLabel: "검사",
  id: "work-synthetic-001",
  requestedAtLabel: "오전 10:20 요청",
  status: "in_progress",
  statusLabel: "진행 중",
  subtitle: "혈액 검사",
  title: "합성 업무 항목",
};

function ContentSpecimen() {
  return (
    <div className="flex w-[348px] flex-col gap-4 rounded-xl border bg-card p-4">
      <ProfileAvailabilitySummary
        state="ready"
        eventLabel="7월 18일 휴무"
        returnLabel="7월 20일 복귀"
      />
      <div className="flex gap-2">
        <WorkCategoryBadge category="lab">검사</WorkCategoryBadge>
        <FulfillmentStatusBadge status="in_progress">진행 중</FulfillmentStatusBadge>
      </div>
    </div>
  );
}

const meta = {
  title: "Features/Staff/Profile Side Panel V2/Content",
  component: ContentSpecimen,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Profile availability and assigned-work specimens. All displayed rows are synthetic Storybook data; production callers must supply real read-model results.",
      },
    },
  },
} satisfies Meta<typeof ContentSpecimen>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openMenu(trigger: HTMLElement) {
  trigger.click();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

function FullPanelSpecimen({ defaultTab = "profile" }: { defaultTab?: "profile" | "work" }) {
  return (
    <section
      aria-label="직원 운영 프로필 Storybook 예시"
      className="flex h-dvh w-full flex-col overflow-hidden bg-[var(--emr-surface-rightpanel)] max-md:rounded-none max-md:border-0 max-md:shadow-none md:h-[760px] md:w-[var(--emr-profile-panel-width)] md:rounded-[var(--emr-radius-panel)] md:border md:border-[var(--emr-border-strong)] md:shadow-[var(--clair-shadow-xs)]"
      data-testid="profile-v2-panel-specimen"
    >
      <Tabs defaultValue={defaultTab} className="min-h-0 flex-1 gap-0">
        <header className="relative h-[var(--emr-profile-header-height)] shrink-0 border-b border-[var(--emr-border-default)] px-4 pt-3">
          <div className="flex items-start gap-3 pr-16">
            <EditableProfileAvatar alt="합성 직원" editable={false} initials="SU" />
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-lg font-semibold">합성 직원</h2>
                <PresenceBadge state="online" />
              </div>
              <div className="mt-1">
                <StatusMessageEditor editable={false} value="진료 중입니다" />
              </div>
            </div>
          </div>
          <div className="absolute right-3 top-3 flex gap-1">
            <ProfileHeaderActionMenu
              canManageMember={false}
              hasContact
              onCopyContact={() => undefined}
              onManageMember={() => undefined}
              onOpenSchedule={() => undefined}
            />
            <Button type="button" aria-label="프로필 닫기" size="icon-sm" variant="ghost">
              <CloseIcon aria-hidden="true" />
            </Button>
          </div>
          <TabsList
            aria-label="직원 프로필 탭"
            className="absolute bottom-0 left-4 right-4 w-auto"
            variant="line"
          >
            <TabsTrigger value="profile">프로필</TabsTrigger>
            <TabsTrigger value="work">업무 현황</TabsTrigger>
          </TabsList>
        </header>

        <TabsContent value="profile" className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-5">
            <section>
              <h3 className="mb-2 text-sm font-medium text-[var(--emr-text-secondary)]">계정 정보</h3>
              <dl className="grid gap-2 rounded-xl border p-3 text-sm">
                <div className="flex justify-between gap-4"><dt>역할</dt><dd>수의사</dd></div>
                <div className="flex justify-between gap-4"><dt>진료과</dt><dd>일반 진료</dd></div>
                <div className="flex justify-between gap-4"><dt>이메일</dt><dd>synthetic@example.com</dd></div>
                <div className="flex justify-between gap-4"><dt>전화번호</dt><dd>010-0000-0000</dd></div>
              </dl>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-medium text-[var(--emr-text-secondary)]">오늘 근무</h3>
              <div className="rounded-xl border p-3 text-sm">
                <p className="font-medium">09:00–18:00 · 일반 진료</p>
                <p className="mt-1 text-[var(--emr-text-tertiary)]">제1진료실</p>
              </div>
            </section>
            <ProfileAvailabilitySummary
              state="ready"
              eventLabel="7월 18일 휴무"
              returnLabel="7월 20일 복귀"
            />
          </div>
        </TabsContent>
        <TabsContent value="work" className="min-h-0 overflow-y-auto p-4">
          <ProfileWorkStatusTab
            groups={[{ dateLabel: "오늘", items: [sampleWorkItem] }]}
            state="ready"
            onRequestNavigation={() => undefined}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

export const FullPanelProfileSpecimen: Story = {
  render: () => <FullPanelSpecimen />,
};

export const FullPanelTwoTabContract: Story = {
  render: () => <FullPanelSpecimen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = canvas.getByTestId("profile-v2-panel-specimen");
    const avatar = panel.querySelector("[data-slot='avatar']");
    const header = panel.querySelector("header");
    const tabs = canvas.getAllByRole("tab");

    expect(tabs).toHaveLength(2);
    expect(getComputedStyle(panel).width).toBe("380px");
    expect(header ? getComputedStyle(header).height : "").toBe("150px");
    expect(avatar ? getComputedStyle(avatar).width : "").toBe("84px");
    await userEvent.click(canvas.getByRole("tab", { name: "업무 현황" }));
    expect(canvas.getByRole("heading", { name: "합성 업무 항목" })).toBeInTheDocument();
  },
};

export const AvailabilityReady: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("7월 18일 휴무")).toBeVisible();
    expect(canvas.getByText("7월 20일 복귀")).toBeVisible();
  },
};

export const AvailabilityStates: Story = {
  render: () => (
    <div className="grid w-[348px] gap-3">
      <ProfileAvailabilitySummary state="loading" />
      <ProfileAvailabilitySummary state="empty" />
      <ProfileAvailabilitySummary state="error" onRetry={() => undefined} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("예정된 휴무가 없어요")).toBeVisible();
    expect(canvas.getByRole("alert")).toBeVisible();
    expect(canvas.getByRole("button", { name: "다시 시도" })).toBeVisible();
  },
};

export const WorkBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <WorkCategoryBadge category="lab">검사</WorkCategoryBadge>
      <WorkCategoryBadge category="imaging">영상</WorkCategoryBadge>
      <WorkCategoryBadge category="procedure">처치</WorkCategoryBadge>
      <FulfillmentStatusBadge status="requested">요청됨</FulfillmentStatusBadge>
      <FulfillmentStatusBadge status="in_progress">진행 중</FulfillmentStatusBadge>
      <FulfillmentStatusBadge status="completed">완료</FulfillmentStatusBadge>
      <FulfillmentStatusBadge status="cancelled">취소</FulfillmentStatusBadge>
    </div>
  ),
};

export const AssignedWorkCard: Story = {
  render: () => (
    <div className="w-[348px]">
      <ProfileAssignedWorkCard item={sampleWorkItem} onRequestNavigation={() => undefined} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    expect(canvas.queryByRole("button", { name: "합성 업무 항목" })).not.toBeInTheDocument();
    await openMenu(canvas.getByRole("button", { name: "합성 업무 항목 더보기" }));
    await waitFor(() =>
      expect(body.getByRole("menuitem", { name: "업무 보러가기" })).toBeInTheDocument(),
    );
  },
};

export const WorkTimeline: Story = {
  render: () => (
    <div className="w-[348px]">
      <StaffWorkTimeline
        groups={[
          { dateLabel: "오늘", items: [sampleWorkItem] },
          {
            dateLabel: "7월 15일",
            items: [{ ...sampleWorkItem, id: "work-synthetic-002", title: "완료된 합성 업무" }],
          },
        ]}
        onRequestNavigation={() => undefined}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("heading", { name: "오늘" })).toBeVisible();
    expect(canvas.getByRole("heading", { name: "7월 15일" })).toBeVisible();
    expect(canvasElement.querySelectorAll("[data-timeline-line]")).toHaveLength(2);
  },
};

function WorkStatusSpecimen() {
  const [selected, setSelected] = useState<ProfileAssignedWorkItem | null>(null);
  const [loadedMore, setLoadedMore] = useState(false);

  return (
    <div className="w-[348px]">
      <ProfileWorkStatusTab
        groups={[{ dateLabel: "오늘", items: [sampleWorkItem] }]}
        hasNextPage={!loadedMore}
        state="ready"
        onLoadMore={() => setLoadedMore(true)}
        onRequestNavigation={setSelected}
      />
      <WorkNavigationDialog
        item={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        onConfirm={() => setSelected(null)}
      />
    </div>
  );
}

export const WorkStatusReadyAndNavigation: Story = {
  render: () => <WorkStatusSpecimen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await openMenu(canvas.getByRole("button", { name: "합성 업무 항목 더보기" }));
    await userEvent.click(body.getByRole("menuitem", { name: "업무 보러가기" }));
    expect(body.getByRole("dialog")).toBeInTheDocument();
    expect(body.getByRole("heading", { name: "업무 화면으로 이동할까요?" })).toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "이전 업무 더보기" }));
    expect(canvas.queryByRole("button", { name: "이전 업무 더보기" })).not.toBeInTheDocument();
  },
};

export const WorkStatusStates: Story = {
  render: () => (
    <div className="grid w-[348px] gap-6">
      <ProfileWorkStatusTab groups={[]} state="loading" onRequestNavigation={() => undefined} />
      <ProfileWorkStatusTab groups={[]} state="empty" onRequestNavigation={() => undefined} />
      <ProfileWorkStatusTab
        groups={[]}
        state="error"
        onRetry={() => undefined}
        onRequestNavigation={() => undefined}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("배정된 업무가 없어요")).toBeInTheDocument();
    expect(canvas.getByRole("alert")).toBeInTheDocument();
  },
};
