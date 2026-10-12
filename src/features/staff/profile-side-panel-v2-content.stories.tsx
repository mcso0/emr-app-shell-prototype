import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";

import { Button } from "@/components/ui/button";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { toast } from "sonner";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { PERSONAL_PROFILE_CHANGED_KEY } from "@/features/auth/personal-profile-session";
import { StaffOperationalProfilePanel } from "./staff-operational-profile-drawer";
import { clearWorkspaceStaffPresenceState, getWorkspaceStaffPresenceSnapshot, publishWorkspaceStaffPresenceState } from "./workspace-staff-presence";
import type { StaffOperationalProfile } from "./server-operational-profile-core";
import type { StaffAssignedWorkItem } from "./server-staff-assigned-work-items-core";
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
  href: "/w/storybook-staff-operational-profile/lab?encounterId=95000000-0000-4000-8000-000000000006&orderId=95000000-0000-4000-8000-000000000003&modulePanel=open",
  requestedAtLabel: "오전 10:20 요청",
  status: "in_progress",
  statusLabel: "진행 중",
  subtitle: "혈액 검사",
  title: "합성 업무 항목",
};

/** Fixed staff-profile content specimen with synthetic state and no props. */
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
  beforeEach: installOperationalProfileFixture,
  tags: ["autodocs"],
  parameters: {
    nextjs: { appDirectory: true },
    docs: { story: { inline: false, height: "1150px" },
      description: {
        component:
          "직원 프로필의 일정 요약과 배정 업무를 합성 데이터로 확인합니다. 전체 패널 예제는 실제 StaffOperationalProfilePanel을 렌더링합니다. 프로필·업무 조회, 상태 메시지, 사진, 연락처와 이동 요청을 합성 API·스토리지·클립보드와 Storybook 라우터로 기록하고 정리합니다. 작은 상태 예제는 공개 컴포넌트 비교용입니다.",
      },
    },
  },
} satisfies Meta<typeof ContentSpecimen>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openMenu(trigger: HTMLElement) {
  await userEvent.click(trigger);
}

let staffScenarioSequence = 0;
let staffWorkspaceId = "storybook-staff-operational-profile";
const staffUserId = "95000000-0000-4000-8000-000000000001";
const staffDate = "2026-10-11";
let profileWrites: Array<Record<string, unknown>> = [];
let clipboardWrites: string[] = [];
let avatarUploads: File[] = [];
let avatarUrl: string | undefined;

function installOperationalProfileFixture() {
  staffWorkspaceId = `storybook-staff-operational-profile-${++staffScenarioSequence}`;
  const installedWorkspaceId = staffWorkspaceId;
  const previousPresence = getWorkspaceStaffPresenceSnapshot(installedWorkspaceId, staffUserId);
  let statusRevision = 0;
  const previousToastIds = new Set(toast.getToasts().map(item => item.id));
  const originalFetch = globalThis.fetch;
  const originalClient = mocked(getBrowserSupabaseClient).getMockImplementation();
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const profileChanged = localStorage.getItem(PERSONAL_PROFILE_CHANGED_KEY);
  profileWrites = []; clipboardWrites = []; avatarUploads = []; avatarUrl = undefined;
  const profile: StaffOperationalProfile = { displayName: "합성 직원", initials: "SU", membershipStatus: "active", jobPositionLabel: "수의사", department: "일반 진료", email: "synthetic@example.com", phone: "010-0000-0000", statusMessage: "진료 중입니다", statusMessageUpdatedAt: "2026-10-11T00:00:00Z" };
  const item: StaffAssignedWorkItem = { id: "95000000-0000-4000-8000-000000000002", orderId: "95000000-0000-4000-8000-000000000003", title: sampleWorkItem.title, category: "lab", categoryLabel: "임상병리", queueType: "lab", requestedAt: "2026-10-11T01:20:00Z", operatingDate: staffDate, status: "in_progress", statusLabel: "진행 중", href: `/w/${staffWorkspaceId}/lab?encounterId=95000000-0000-4000-8000-000000000006&orderId=95000000-0000-4000-8000-000000000003&modulePanel=open` };
  const nextCursor = btoa(JSON.stringify({ id: item.id, requestedAt: item.requestedAt })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  const scheduleHref = `/w/${staffWorkspaceId}/hospital-admin?modulePanel=open&section=schedule&weekStart=2026-10-05`;
  mocked(getBrowserSupabaseClient).mockReturnValue({ storage: { from: (bucket: string) => ({ uploadToSignedUrl: async (path: string, token: string, file: File, options: { upsert: boolean }) => {
    if (bucket !== "profile-avatars" || path !== "synthetic-avatar.png" || token !== "synthetic-token" || options.upsert) throw new Error("Synthetic avatar upload contract mismatch");
    avatarUploads.push(file); return { data: { path }, error: null };
  } }) } } as unknown as NonNullable<ReturnType<typeof getBrowserSupabaseClient>>);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { clipboardWrites.push(value); } } });
  publishWorkspaceStaffPresenceState(staffWorkspaceId, { [staffUserId]: [{ user_id: staffUserId, presence_ref: "synthetic-presence" }] });
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (!url.pathname.startsWith("/api/")) return originalFetch(input, init);
    if (url.pathname === `/api/workspaces/${staffWorkspaceId}/staff/${staffUserId}/operational-profile` && !init?.method) return Response.json({ ok: true, profile, capabilities: { canEditAvatar: true, canEditStatusMessage: true, canManageMember: false, manageMemberHref: null, scheduleHref }, currentWork: { date: staffDate, detailLabel: "제1진료실", startMinutes: 540, endMinutes: 1080, state: "working", source: "schedule" }, availability: { event: { date: "2026-10-18", kind: "off" }, returnShift: { date: "2026-10-20", startMinutes: 540, endMinutes: 1080, kind: "clinical", locationLabel: "제1진료실", workLabel: "진료" } } });
    if (url.pathname === `/api/workspaces/${staffWorkspaceId}/staff/${staffUserId}/work-items`) return Response.json({ ok: true, items: url.searchParams.has("cursor") ? [{ ...item, id: "95000000-0000-4000-8000-000000000004", title: "완료된 합성 업무", operatingDate: "2026-10-10", requestedAt: "2026-10-10T01:20:00Z", status: "completed", statusLabel: "완료" }] : [item], nextCursor: url.searchParams.has("cursor") ? null : nextCursor, timezone: "Asia/Seoul" });
    if (url.pathname === `/api/workspaces/${staffWorkspaceId}/members/me/status-message` && init?.method === "PATCH") {
      const command = JSON.parse(String(init.body)); profileWrites.push(command);
      if (command.expectedUpdatedAt !== (profile.statusMessageUpdatedAt ?? null)) throw new Error("Synthetic status message revision mismatch");
      const message = String(command.message).trim();
      profile.statusMessage = message || undefined; profile.statusMessageUpdatedAt = message ? new Date(Date.UTC(2026, 9, 11, 0, ++statusRevision)).toISOString() : undefined;
      return Response.json({ ok: true, message: profile.statusMessage ?? null, updatedAt: profile.statusMessageUpdatedAt ?? null });
    }
    if (url.pathname === "/api/users/me/avatar") {
      if (init?.method === "DELETE") { profile.avatarUrl = undefined; return Response.json({ ok: true, avatarUrl: null }); }
      const command = JSON.parse(String(init?.body)); profileWrites.push(command);
      if (command.action === "prepare") return Response.json({ ok: true, maxBytes: 5 * 1024 * 1024, objectPath: "synthetic-avatar.png", uploadId: "95000000-0000-4000-8000-000000000005", uploadToken: "synthetic-token" });
      if (command.action === "finalize" && avatarUrl) { profile.avatarUrl = avatarUrl; return Response.json({ ok: true, avatarUrl, cleanupPending: false }); }
      if (command.action === "discard") return Response.json({ ok: true });
    }
    throw new Error(`Unexpected API ${url.pathname}`);
  };
  return () => {
    globalThis.fetch = originalFetch; mocked(getBrowserSupabaseClient).mockImplementation(originalClient ?? (() => null));
    if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor); else Reflect.deleteProperty(navigator, "clipboard");
    if (profileChanged === null) localStorage.removeItem(PERSONAL_PROFILE_CHANGED_KEY); else localStorage.setItem(PERSONAL_PROFILE_CHANGED_KEY, profileChanged);
    if (previousPresence === "unknown") clearWorkspaceStaffPresenceState(installedWorkspaceId);
    else publishWorkspaceStaffPresenceState(installedWorkspaceId, { [staffUserId]: previousPresence === "online" ? [{ user_id: staffUserId, presence_ref: "restored-synthetic-presence" }] : [] });
    for (const item of toast.getToasts()) if (!previousToastIds.has(item.id)) toast.dismiss(item.id);
  };
}

function FullPanelSpecimen() {
  const [open, setOpen] = useState(true);
  return <div className="h-[1105px] w-[380px] overflow-x-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-border-strong)]" data-testid="profile-v2-panel-specimen">
    {open ? <StaffOperationalProfilePanel actorUserId={staffUserId} date={staffDate} todayDate={staffDate} userId={staffUserId} workspaceId={staffWorkspaceId} onClose={() => setOpen(false)} /> : <Button onClick={() => setOpen(true)}>합성 직원 프로필 다시 열기</Button>}
  </div>;
}

export const FullPanelProfileSpecimen: Story = {
  parameters: { docs: { description: { story: "실제 직원 운영 패널의 상태 메시지와 사진 저장, 연락처 복사, 닫기를 합성 응답으로 확인합니다." } } },
  render: () => <FullPanelSpecimen />,
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByText("합성 직원");
    await userEvent.click(canvas.getByRole("button", { name: "상태 메시지 수정" }));
    await userEvent.clear(canvas.getByRole("textbox", { name: "상태 메시지" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "상태 메시지" }), "합성 저장 메시지{Enter}");
    await waitFor(() => expect(canvas.getByRole("button", { name: "상태 메시지 수정" })).toHaveTextContent("합성 저장 메시지"));
    await expect(profileWrites[0]).toMatchObject({ message: "합성 저장 메시지", expectedUpdatedAt: "2026-10-11T00:00:00Z" });
    await userEvent.click(canvas.getByRole("button", { name: "상태 메시지 수정" }));
    await userEvent.clear(canvas.getByRole("textbox", { name: "상태 메시지" })); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.getByRole("button", { name: "상태 메시지 수정" })).toHaveTextContent("상태메세지 추가하기..."));
    await expect(profileWrites[1]).toMatchObject({ message: "", expectedUpdatedAt: "2026-10-11T00:01:00.000Z" });
    await userEvent.click(canvas.getByRole("button", { name: "상태 메시지 수정" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "상태 메시지" }), "합성 다시 저장{Enter}");
    await waitFor(() => expect(canvas.getByRole("button", { name: "상태 메시지 수정" })).toHaveTextContent("합성 다시 저장"));
    await expect(profileWrites[2]).toMatchObject({ message: "합성 다시 저장", expectedUpdatedAt: null });
    await openMenu(canvas.getByRole("button", { name: "프로필 작업 더보기" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "연락처 복사" }));
    await waitFor(() => expect(clipboardWrites).toEqual(["synthetic@example.com\n010-0000-0000"]));
    await openMenu(canvas.getByRole("button", { name: "프로필 이미지 메뉴 열기" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "프로필 이미지 업로드" }));
    const dialog = within(await body.findByRole("dialog"));
    const imageCanvas = document.createElement("canvas"); imageCanvas.width = 512; imageCanvas.height = 512;
    const context = imageCanvas.getContext("2d"); if (!context) throw new Error("Synthetic image context unavailable");
    context.fillStyle = "#64748b"; context.fillRect(0, 0, 512, 512); avatarUrl = imageCanvas.toDataURL("image/png");
    const blob = await new Promise<Blob>((resolve, reject) => imageCanvas.toBlob(value => value ? resolve(value) : reject(new Error("Synthetic image encoding failed")), "image/png"));
    await userEvent.upload(dialog.getByLabelText("프로필 이미지 선택"), new File([blob], "synthetic-avatar.png", { type: "image/png" }));
    await userEvent.click(dialog.getByRole("button", { name: "업로드" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(canvas.getByRole("img", { name: "합성 직원" })).toHaveAttribute("src", avatarUrl));
    await expect(avatarUploads).toHaveLength(1);
    await openMenu(canvas.getByRole("button", { name: "프로필 이미지 메뉴 열기" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "프로필 이미지 제거" }));
    await waitFor(() => expect(canvas.queryByRole("img", { name: "합성 직원" })).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "직원 운영 프로필 닫기" }));
    await expect(canvas.getByRole("button", { name: "합성 직원 프로필 다시 열기" })).toBeVisible();
  },
};

export const FullPanelThreeTabFigmaContract: Story = {
  parameters: { docs: { description: { story: "프로필의 세 탭과 지정된 패널 배치를 확인합니다." } } },
  render: () => <FullPanelSpecimen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("합성 직원");
    const panel = canvas.getByTestId("profile-v2-panel-specimen");
    const avatar = panel.querySelector("[data-slot='avatar']");
    const header = panel.querySelector("header");
    const tabs = canvas.getAllByRole("tab");
    const getActiveTabPanel = () =>
      panel.querySelector<HTMLElement>('[role="tabpanel"]:not([inert])');

    expect(tabs).toHaveLength(3);
    expect(getComputedStyle(panel).width).toBe("380px");
    expect(getComputedStyle(panel).overflowX).toBe("hidden");
    expect(getComputedStyle(getActiveTabPanel()!).overflowX).toBe("hidden");
    expect(header ? getComputedStyle(header).height : "").toBe("150px");
    expect(avatar ? getComputedStyle(avatar).width : "").toBe("84px");
    await userEvent.click(canvas.getByRole("tab", { name: "업무현황" }));
    await waitFor(() => expect(getActiveTabPanel()).not.toBeNull());
    expect(getComputedStyle(getActiveTabPanel()!).overflowX).toBe("hidden");
    expect(await canvas.findByRole("heading", { name: "합성 업무 항목" })).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "일정" }));
    await waitFor(() => expect(getActiveTabPanel()).not.toBeNull());
    expect(getComputedStyle(getActiveTabPanel()!).overflowX).toBe("hidden");
    expect(canvas.getByRole("heading", { name: "일정" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "일정 확인" }));
    await expect(getRouter().push).toHaveBeenCalledWith(`/w/${staffWorkspaceId}/hospital-admin?modulePanel=open&section=schedule&weekStart=2026-10-05`);
    await userEvent.click(canvas.getByRole("tab", { name: "업무현황" }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "합성 업무 항목 더보기" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "업무 보러가기" }));
    await userEvent.click(within(await body.findByRole("dialog")).getByRole("button", { name: "이동" }));
    await expect(getRouter().push).toHaveBeenCalledWith(`/w/${staffWorkspaceId}/lab?encounterId=95000000-0000-4000-8000-000000000006&orderId=95000000-0000-4000-8000-000000000003&modulePanel=open`);
    await userEvent.click(canvas.getByRole("button", { name: "이전 업무 더보기" }));
    await expect(await canvas.findByRole("heading", { name: "완료된 합성 업무" })).toBeVisible();
  },
};

export const AvailabilityReady: Story = {
  parameters: { docs: { description: { story: "휴무와 복귀 예정 문구가 있는 일정 요약을 확인합니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("휴무")).toBeVisible();
    expect(canvas.getByText("7월 20일 복귀")).toBeVisible();
  },
};

function AvailabilityStatesSpecimen() {
  const [failed, setFailed] = useState(true);
  return <div className="grid w-[348px] gap-3"><ProfileAvailabilitySummary state="loading" /><ProfileAvailabilitySummary state="empty" /><ProfileAvailabilitySummary state={failed ? "error" : "ready"} eventLabel="7월 18일 휴무" returnLabel="7월 20일 복귀" onRetry={() => setFailed(false)} /></div>;
}
export const AvailabilityStates: Story = {
  parameters: { docs: { description: { story: "일정 요약의 로딩, 빈 상태와 오류 복구를 비교합니다. 재조회 결과는 합성 상태로 제공합니다." } } },
  render: () => <AvailabilityStatesSpecimen />,
  play: async ({ canvas }) => {
    expect(canvas.getByText("예정된 일정이 없습니다")).toBeVisible();
    expect(canvas.getByRole("alert")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "다시 시도" }));
    await expect(canvas.getByText("7월 20일 복귀")).toBeVisible();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};

export const WorkBadges: Story = {
  parameters: { docs: { description: { story: "업무 종류와 요청, 진행, 완료, 취소 상태의 배지를 비교합니다." } } },
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

function WorkRequestSpecimen({ timeline = false }: { timeline?: boolean }) {
  const [requested, setRequested] = useState<ProfileAssignedWorkItem | null>(null);
  return <div className="w-[348px]">{timeline ? <StaffWorkTimeline groups={[{ dateLabel: "오늘", items: [sampleWorkItem] }, { dateLabel: "7월 15일", items: [{ ...sampleWorkItem, id: "work-synthetic-002", title: "완료된 합성 업무" }] }]} onRequestNavigation={setRequested} /> : <ProfileAssignedWorkCard item={sampleWorkItem} onRequestNavigation={setRequested} />}<output aria-label="합성 업무 이동 요청">{requested?.title ?? "없음"}</output></div>;
}
export const AssignedWorkCard: Story = {
  parameters: { docs: { description: { story: "업무 카드 메뉴의 이동 요청 콜백을 확인합니다. 전체 패널 예제는 확인창과 라우터 요청도 검증합니다." } } },
  render: () => <WorkRequestSpecimen />,
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    expect(canvas.queryByRole("button", { name: "합성 업무 항목" })).not.toBeInTheDocument();
    await openMenu(canvas.getByRole("button", { name: "합성 업무 항목 더보기" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "업무 보러가기" }));
    await expect(canvas.getByLabelText("합성 업무 이동 요청")).toHaveTextContent("합성 업무 항목");
  },
};
export const WorkTimeline: Story = {
  parameters: { docs: { description: { story: "날짜별 타임라인과 각 업무의 이동 요청을 확인합니다." } } },
  render: () => <WorkRequestSpecimen timeline />,
  play: async ({ canvas, canvasElement }) => {
    expect(canvas.getByRole("heading", { name: "오늘" })).toBeVisible();
    expect(canvas.getByRole("heading", { name: "7월 15일" })).toBeVisible();
    expect(canvasElement.querySelectorAll("[data-timeline-line]")).toHaveLength(2);
    await openMenu(canvas.getByRole("button", { name: "완료된 합성 업무 더보기" }));
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "업무 보러가기" }));
    await expect(canvas.getByLabelText("합성 업무 이동 요청")).toHaveTextContent("완료된 합성 업무");
  },
};

function WorkStatusSpecimen() {
  const [selected, setSelected] = useState<ProfileAssignedWorkItem | null>(null);
  const [loadedMore, setLoadedMore] = useState(false);
  const [navigation, setNavigation] = useState("없음");

  return (
    <div className="w-[348px]">
      <ProfileWorkStatusTab
        groups={[{ dateLabel: "오늘", items: [sampleWorkItem] }, ...(loadedMore ? [{ dateLabel: "7월 15일", items: [{ ...sampleWorkItem, id: "work-synthetic-002", title: "완료된 합성 업무" }] }] : [])]}
        hasNextPage={!loadedMore}
        state="ready"
        onLoadMore={() => setLoadedMore(true)}
        onRequestNavigation={setSelected}
      />
      <WorkNavigationDialog
        item={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        onConfirm={(item) => { setNavigation(item.href ?? "이동 불가"); setSelected(null); }}
      />
      <output aria-label="합성 업무 이동 경로">{navigation}</output>
    </div>
  );
}

export const WorkStatusReadyAndNavigation: Story = {
  parameters: { docs: { description: { story: "업무 이동 확인창의 취소와 이전 업무 더보기 동작을 확인합니다. 실제 경로로 이동하지 않습니다." } } },
  render: () => <WorkStatusSpecimen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "합성 업무 항목 더보기" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "업무 보러가기" }));
    expect(await body.findByRole("dialog")).toBeInTheDocument();
    expect(body.getByRole("heading", { name: "업무 화면으로 이동할까요?" })).toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "이전 업무 더보기" }));
    await waitFor(() => expect(canvas.queryByRole("button", { name: "이전 업무 더보기" })).not.toBeInTheDocument());
    await expect(canvas.getByRole("heading", { name: "완료된 합성 업무" })).toBeVisible();
    await openMenu(canvas.getByRole("button", { name: "합성 업무 항목 더보기" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "업무 보러가기" }));
    await userEvent.click(within(await body.findByRole("dialog")).getByRole("button", { name: "이동" }));
    await expect(canvas.getByLabelText("합성 업무 이동 경로")).toHaveTextContent(sampleWorkItem.href!);
  },
};

function WorkStatusStatesSpecimen() {
  const [failed, setFailed] = useState(true);
  const [requested, setRequested] = useState<ProfileAssignedWorkItem | null>(null);
  return <div className="grid w-[348px] gap-6"><ProfileWorkStatusTab groups={[]} state="loading" onRequestNavigation={setRequested} /><ProfileWorkStatusTab groups={[]} state="empty" onRequestNavigation={setRequested} /><ProfileWorkStatusTab groups={failed ? [] : [{ dateLabel: "오늘", items: [sampleWorkItem] }]} state={failed ? "error" : "ready"} onRetry={() => setFailed(false)} onRequestNavigation={setRequested} /><output aria-label="합성 업무 이동 요청">{requested?.title ?? "없음"}</output></div>;
}
export const WorkStatusStates: Story = {
  parameters: { docs: { description: { story: "업무 목록의 로딩, 빈 상태와 오류 복구를 비교합니다." } } },
  render: () => <WorkStatusStatesSpecimen />,
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("배정된 업무가 없어요")).toBeVisible());
    expect(canvas.getByRole("alert")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(canvas.getByRole("heading", { name: "합성 업무 항목" })).toBeVisible());
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};
