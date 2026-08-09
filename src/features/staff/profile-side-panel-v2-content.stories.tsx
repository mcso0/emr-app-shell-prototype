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

function FullPanelSpecimen({ defaultTab = "profile" }: { defaultTab?: "profile" | "work" | "schedule" }) {
  return (
    <section
      aria-label="직원 운영 프로필 Storybook 예시"
      className="flex h-dvh w-full flex-col overscroll-x-none touch-pan-y overflow-hidden bg-[var(--emr-surface-rightpanel)] max-md:rounded-none max-md:border-0 max-md:shadow-none md:h-[1105px] md:w-[var(--emr-profile-panel-width)] md:rounded-[var(--emr-radius-panel)] md:border md:border-[var(--emr-border-strong)] md:shadow-[var(--clair-shadow-xs)]"
      data-testid="profile-v2-panel-specimen"
    >
      <Tabs defaultValue={defaultTab} className="min-h-0 flex-1 gap-0">
        <header className="relative h-[var(--emr-profile-header-height)] shrink-0 border-b border-[var(--emr-border-default)] px-4 pt-4">
          <div className="relative flex h-[var(--emr-profile-avatar-size)] items-start gap-2.5">
            <EditableProfileAvatar alt="합성 직원" editable={false} initials="SU" />
            <div className="flex h-[var(--emr-profile-avatar-size)] min-w-0 flex-1 flex-col gap-1">
              <div className="flex h-7 min-w-0 items-center gap-2 px-1.5">
                <h2 className="truncate text-xl leading-7 font-semibold tracking-[-0.015em]">합성 직원</h2>
                <PresenceBadge state="online" />
              </div>
              <div className="h-[var(--emr-profile-status-control-height)]">
                <StatusMessageEditor editable onSave={async () => undefined} value="" />
              </div>
              <p className="flex h-5 items-center gap-1 px-1.5 text-sm font-medium tracking-[0.014em] text-[var(--emr-text-placeholder)]">
                최근 접속 <span aria-hidden="true">·</span> 방금 전
              </p>
            </div>
            <div className="absolute -top-1.5 -right-1.5 flex gap-2">
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
          </div>
          <TabsList
            aria-label="직원 프로필 탭"
            className="absolute bottom-0 left-4 h-[34px] w-[175px] gap-2 p-0"
            variant="line"
          >
            <TabsTrigger className="h-7 w-[53px] flex-none self-start px-0 after:bottom-[-6px] after:h-px" value="profile">프로필</TabsTrigger>
            <TabsTrigger className="h-7 w-[65px] flex-none self-start px-0 after:bottom-[-6px] after:h-px" value="work">업무현황</TabsTrigger>
            <TabsTrigger className="h-7 w-[41px] flex-none self-start px-0 after:bottom-[-6px] after:h-px" value="schedule">일정</TabsTrigger>
          </TabsList>
        </header>

        <TabsContent value="profile" className="min-h-0 overflow-y-auto overscroll-x-none touch-pan-y p-4">
          <div className="grid gap-4">
            <section className="px-2">
              <h3 className="flex h-8 items-center text-sm font-medium text-[var(--emr-text-secondary)]">오늘 근무 정보</h3>
              <div className="mt-3 flex h-[70px] items-center gap-4 rounded-xl border border-[var(--emr-border-default)] px-4 py-[14px] text-sm">
                <div aria-hidden="true" className="grid size-[42px] shrink-0 overflow-hidden rounded-md border border-[var(--emr-border-default)]">
                  <span className="h-3 bg-[var(--emr-surface-muted)]" />
                  <span className="flex items-center justify-center pb-0.5 text-base leading-4 font-semibold text-[var(--clair-color-atomic-sky-500)]">18</span>
                </div>
                <div className="min-w-0 flex-1"><p className="text-base leading-6 font-medium">09:00 - 18:00</p><p className="truncate text-sm leading-[18px] text-[var(--emr-text-tertiary)]"><span className="text-[var(--clair-color-atomic-sky-500)]">근무 중</span> · 제1진료실</p></div>
              </div>
            </section>
            <div aria-hidden="true" className="mx-2 h-px bg-[var(--emr-border-subtle)]" />
            <section className="px-2">
              <h3 className="flex h-8 items-center text-sm font-medium text-[var(--emr-text-secondary)]">계정 정보</h3>
              <dl className="mt-3 grid gap-3 text-sm">
                <div className="grid h-6 grid-cols-3 items-center gap-3"><dt>역할</dt><dd className="col-span-2 font-medium">수의사</dd></div>
                <div className="grid h-6 grid-cols-3 items-center gap-3"><dt>진료과</dt><dd className="col-span-2 font-medium">일반 진료</dd></div>
                <div className="grid h-6 grid-cols-3 items-center gap-3"><dt>이메일</dt><dd className="col-span-2 font-medium">synthetic@example.com</dd></div>
                <div className="grid h-6 grid-cols-3 items-center gap-3"><dt>전화번호</dt><dd className="col-span-2 font-medium">010-0000-0000</dd></div>
              </dl>
            </section>
            <div aria-hidden="true" className="mx-2 h-px bg-[var(--emr-border-subtle)]" />
            <section className="px-2">
              <h3 className="flex h-8 items-center text-sm font-medium text-[var(--emr-text-secondary)]">다가오는 일정</h3>
              <div className="mt-3">
                <ProfileAvailabilitySummary
                  state="ready"
                  eventLabel="7월 18일 휴무"
                  returnLabel="7월 20일 복귀"
                />
              </div>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="work" className="min-h-0 overflow-y-auto overscroll-x-none touch-pan-y p-4">
          <ProfileWorkStatusTab
            groups={[{ dateLabel: "오늘", items: [sampleWorkItem] }]}
            state="ready"
            onRequestNavigation={() => undefined}
          />
        </TabsContent>
        <TabsContent value="schedule" className="min-h-0 overflow-y-auto overscroll-x-none touch-pan-y p-4">
          <section className="px-2">
            <h3 className="flex h-6 items-center text-sm font-medium text-[var(--emr-text-secondary)]">일정</h3>
            <div className="mt-3 flex min-h-[72px] items-center justify-between gap-3 rounded-xl border px-4 text-sm text-[var(--emr-text-tertiary)]">
              근무 일정은 일정 화면에서 확인할 수 있어요
              <Button size="xs" variant="outline" className="w-[66px] shrink-0 px-0 text-xs">일정 확인</Button>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </section>
  );
}

export const FullPanelProfileSpecimen: Story = {
  render: () => <FullPanelSpecimen />,
};

export const FullPanelThreeTabFigmaContract: Story = {
  render: () => <FullPanelSpecimen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = canvas.getByTestId("profile-v2-panel-specimen");
    const avatar = panel.querySelector("[data-slot='avatar']");
    const header = panel.querySelector("header");
    const tabs = canvas.getAllByRole("tab");

    expect(tabs).toHaveLength(3);
    expect(getComputedStyle(panel).width).toBe("380px");
    expect(header ? getComputedStyle(header).height : "").toBe("150px");
    expect(avatar ? getComputedStyle(avatar).width : "").toBe("84px");
    await userEvent.click(canvas.getByRole("tab", { name: "업무현황" }));
    expect(canvas.getByRole("heading", { name: "합성 업무 항목" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", { name: "일정" }));
    expect(canvas.getByRole("heading", { name: "일정" })).toBeInTheDocument();
  },
};

export const AvailabilityReady: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("휴무")).toBeVisible();
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
    expect(canvas.getByText("예정된 일정이 없습니다")).toBeVisible();
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
