import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { readSessionWorkspacesState } from "@/features/auth/workspace-session";
import { AuthCallerExample, authApiRequests, completeAuthCallerFixture, INVITE_ACCEPTANCE_RECEIPT_STORAGE_KEY, prepareAuthCallerStory, syntheticAuthWorkspaceId, syntheticInvitationId, syntheticInviteEmail } from "./auth-caller-parity.stories.fixture";

const meta = {
  title: "Features/Auth/Caller Parity",
  component: AuthCallerExample,
  tags: ["autodocs"],
  args: { scenario: "gate" },
  argTypes: { scenario: { control: false, description: "실제 공개 컴포넌트를 고르는 Storybook 전용 설정입니다. 제품 prop이 아닙니다." } },
  parameters: {
    layout: "fullscreen", controls: { disable: true },
    nextjs: { appDirectory: true, navigation: { pathname: `/w/${syntheticAuthWorkspaceId}/home`, query: { story: "synthetic" } } },
    docs: { story: { inline: false, height: "800px" }, description: { component: "실제 AuthGate·WorkspaceOnboarding·InviteAcceptanceScreen·TenantApprovalSurface의 공개 ancestor를 렌더합니다. 기존 mock 인증 provider와 합성 세션·저장소·API 응답을 사용합니다. API 요청과 Next router 호출은 로컬에서 기록합니다. 바꾼 fetch·스토어·저장소 키는 예제 종료 시 복원합니다. iframe은 JavaScript 상태를 나누며 같은 출처의 저장소까지 나누지는 않습니다. 실제 계정·서버 권한·DB·결제·OTP·메시지를 실행하거나 검증한 결과가 아닙니다." } },
  },
  render: args => <AuthCallerExample key={args.scenario} {...args} />,
} satisfies Meta<typeof AuthCallerExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const GateAllowed: Story = {
  beforeEach: () => prepareAuthCallerStory({ access: "active" }),
  parameters: { docs: { description: { story: "실제 AuthGate가 합성 mock 세션의 활성 멤버십을 읽고 자식을 표시합니다. 이 분기는 서버 목록을 요청하지 않습니다. 서버·RLS 권한 검증을 대신하지 않습니다." } } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("heading", { name: "합성 접근 허용 콘텐츠" })).toBeVisible();
    await expect(canvas.queryByTestId("auth-gate-shell-skeleton")).not.toBeInTheDocument();
    await expect(authApiRequests).toHaveLength(0);
  },
};
export const GateSessionRequired: Story = {
  beforeEach: () => prepareAuthCallerStory({ anonymous: true }),
  parameters: { docs: { description: { story: "세션이 없으면 원본 게이트의 Skeleton을 유지하고 로그인 주소를 기록합니다. 합성 자식 화면은 노출되지 않습니다. Next router는 실제 페이지를 이동하지 않습니다." } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("auth-gate-shell-skeleton")).toHaveAttribute("aria-busy", "true");
    await expect(canvas.queryByRole("heading", { name: "합성 접근 허용 콘텐츠" })).not.toBeInTheDocument();
    await waitFor(() => expect(getRouter().replace.mock.calls.some(([href]) => typeof href === "string" && href.startsWith("/login?") && new URL(href, window.location.origin).searchParams.get("reason") === "session_required")).toBe(true));
  },
};
export const GateAccessDenied: Story = {
  beforeEach: () => prepareAuthCallerStory({ access: "inactive" }),
  parameters: { docs: { description: { story: "합성 inactive 멤버십은 활성 접근이 아닙니다. 원본 게이트는 자식 대신 Skeleton을 유지하고 unauthorized 로그인 주소를 기록합니다." } } },
  play: async ({ canvas }) => {
    await waitFor(() => expect(getRouter().replace.mock.calls.some(([href]) => typeof href === "string" && new URL(href, window.location.origin).searchParams.get("reason") === "unauthorized")).toBe(true));
    await expect(canvas.getByTestId("auth-gate-shell-skeleton")).toBeVisible();
    await expect(canvas.queryByRole("heading", { name: "합성 접근 허용 콘텐츠" })).not.toBeInTheDocument();
    await expect(authApiRequests).toHaveLength(0);
  },
};
export const GateReadFailure: Story = {
  beforeEach: () => prepareAuthCallerStory({ access: "unknown", workspaceReadError: true }),
  parameters: { docs: { description: { story: "세션의 워크스페이스 접근 상태가 없으면 원본이 목록을 요청합니다. 로컬 503 응답 뒤에는 자식을 열지 않고 unauthorized 주소를 기록합니다. 오류 상태를 허용 화면으로 바꾸지 않습니다." } } },
  play: async ({ canvas }) => {
    await waitFor(() => { expect(authApiRequests.some(request => request.path === "/api/workspaces" && request.method === "GET")).toBe(true); expect(getRouter().replace.mock.calls.some(([href]) => typeof href === "string" && new URL(href, window.location.origin).searchParams.get("reason") === "unauthorized")).toBe(true); });
    await expect(canvas.getByTestId("auth-gate-shell-skeleton")).toBeVisible();
    await expect(canvas.queryByRole("heading", { name: "합성 접근 허용 콘텐츠" })).not.toBeInTheDocument();
  },
};
export const WorkspaceCreate: Story = {
  args: { scenario: "onboarding" },
  beforeEach: () => prepareAuthCallerStory(),
  parameters: { docs: { description: { story: "실제 병원 생성 폼입니다. 빈 필수값 검사 후 합성 병원·관리자 정보를 입력합니다. POST는 원본 factory가 만든 로컬 응답을 반환합니다. 원본이 세션 저장소에 병원과 멤버십을 추가하고 Next router 주소를 기록하는 것까지 확인합니다." } } },
  play: async ({ canvas }) => {
    const router = getRouter();
    const callsBefore = router.replace.mock.calls.length;
    const urlBefore = window.location.href;
    await userEvent.click(canvas.getByRole("button", { name: "워크스페이스 만들기" }));
    await expect(canvas.getByRole("textbox", { name: "병원/워크스페이스 이름" })).toHaveAttribute("aria-invalid", "true");
    await expect(authApiRequests).toHaveLength(0);
    await userEvent.type(canvas.getByRole("textbox", { name: "병원/워크스페이스 이름" }), "Synthetic New Hospital");
    await userEvent.type(canvas.getByRole("textbox", { name: "대표/관리자 이름" }), "합성 생성자");
    await userEvent.type(canvas.getByRole("textbox", { name: "연락 이메일" }), "synthetic-owner@example.test");
    await userEvent.click(canvas.getByRole("button", { name: "워크스페이스 만들기" }));
    await waitFor(() => {
      expect(router.replace.mock.calls.length).toBe(callsBefore + 1);
      expect(router.replace.mock.calls[callsBefore]?.[0]).toBe("/w/synthetic-new-hospital/home?modulePanel=open&aside=closed");
      const state = readSessionWorkspacesState(window.sessionStorage, window.localStorage);
      if (!state) throw new Error("Created synthetic workspace state is missing.");
      expect(state.currentWorkspaceId).toBe("synthetic-new-hospital");
      expect(state.memberships[0]?.status).toBe("active");
    });
    await expect(authApiRequests.filter(request => request.method === "POST")).toHaveLength(1);
    await expect(window.location.href).toBe(urlBefore);
  },
};
export const WorkspaceCreateRestricted: Story = {
  args: { scenario: "onboarding" },
  beforeEach: () => prepareAuthCallerStory({ role: "vet" }),
  parameters: { docs: { description: { story: "합성 vet 세션에서 원본이 생성 권한 안내를 표시하고 모든 폼 입력과 제출 버튼을 비활성화합니다. 이 로컬 UI 제한은 서버 보안을 뜻하지 않습니다." } } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent("병원 관리자 역할");
    for (const input of canvas.getAllByRole("textbox")) await expect(input).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "워크스페이스 만들기" })).toBeDisabled();
    await expect(authApiRequests).toHaveLength(0);
  },
};
export const TenantApprovalReference: Story = {
  args: { scenario: "tenant" },
  parameters: { docs: { story: { height: "1220px" }, description: { story: "실제 TenantApprovalSurface입니다. 원본의 합성 opsTenantApplications·상태 정책·감사 hook 목록을 표시합니다. 원본은 조회 전용이며 승인 버튼이나 mutation이 없습니다. Storybook에서 새 승인 동작을 만들지 않습니다." } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "CLAiR tenant approvals" })).toBeVisible();
    await expect(canvas.getAllByRole("table")).toHaveLength(2);
    await expect(canvas.getByRole("columnheader", { name: "최초 관리자 초대" })).toBeVisible();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Audit hook points" })).toBeVisible();
  },
};

export const InviteNewAccountRetry: Story = {
  args: { scenario: "invite-new" },
  beforeEach: () => prepareAuthCallerStory({ anonymous: true, acceptRetry: true }),
  parameters: { docs: { story: { height: "880px" }, description: { story: "실제 초대 수락 폼의 새 비밀번호·확인 검사, 로컬 수락 실패·재시도, 합성 멤버십의 세션 저장을 확인합니다. 입력 문자열은 예제 전용입니다. mock provider 분기에서 실제 가입·비밀번호 저장·OTP를 호출하지 않습니다. POST는 합성 응답이며 Next router는 주소만 기록합니다." } } },
  play: async ({ canvas }) => {
    const router = getRouter();
    const callsBefore = router.replace.mock.calls.length;
    const password = canvas.getByLabelText("새 비밀번호", { exact: true });
    const confirm = canvas.getByLabelText("비밀번호 확인", { exact: true });
    await expect(canvas.getByRole("button", { name: "워크스페이스로 이동" })).toBeDisabled();
    await userEvent.type(password, "short");
    await userEvent.tab();
    await expect(canvas.getByText("비밀번호는 8자 이상으로 설정해 주세요.")).toBeVisible();
    await userEvent.clear(password);
    await userEvent.type(password, "SyntheticOnly1!");
    await userEvent.type(confirm, "MismatchOnly1!");
    await userEvent.tab();
    await expect(canvas.getByText("비밀번호 확인이 일치하지 않습니다.")).toBeVisible();
    await userEvent.clear(confirm);
    await userEvent.type(confirm, "SyntheticOnly1!");
    await userEvent.click(canvas.getByRole("button", { name: "워크스페이스로 이동" }));
    await canvas.findByText("초대 수락 상태를 확인해 주세요.");
    await waitFor(() => expect(canvas.getByRole("button", { name: "워크스페이스로 이동" })).toBeEnabled());
    await userEvent.click(canvas.getByRole("button", { name: "워크스페이스로 이동" }));
    await waitFor(() => {
      expect(router.replace.mock.calls.length).toBe(callsBefore + 1);
      expect(router.replace.mock.calls[callsBefore]?.[0]).toBe(`/w/${syntheticAuthWorkspaceId}/reception?modulePanel=open&aside=closed`);
      const state = readSessionWorkspacesState(window.sessionStorage, window.localStorage);
      expect(state?.currentWorkspaceId).toBe(syntheticAuthWorkspaceId);
      expect(state?.memberships.some(member => member.email === syntheticInviteEmail && member.roles.includes("vet") && member.status === "active")).toBe(true);
    });
    const requests = authApiRequests.filter(request => request.path.endsWith(`/${syntheticInvitationId}/accept`));
    await expect(requests).toHaveLength(2);
    await expect(requests.map(request => request.body)).toEqual([{ accountMode: "new" }, { accountMode: "new" }]);
  },
};

export const InviteExistingAccount: Story = {
  args: { scenario: "invite-existing" },
  beforeEach: () => prepareAuthCallerStory({ anonymous: true }),
  parameters: { docs: { story: { height: "880px" }, description: { story: "실제 기존 계정 초대 화면의 안내·비밀번호 입력·수락 분기를 확인합니다. mock provider가 로컬 수락 응답을 받고 세션 정보를 기록합니다. 실제 계정의 비밀번호나 인증 provider는 사용하지 않습니다." } } },
  play: async ({ canvas }) => {
    const router = getRouter();
    const callsBefore = router.replace.mock.calls.length;
    await expect(canvas.getByText("이미 가입된 이메일입니다.")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "로그인" })).toBeDisabled();
    await userEvent.type(canvas.getByLabelText("비밀번호", { exact: true }), "SyntheticExisting1!");
    await userEvent.click(canvas.getByRole("button", { name: "로그인" }));
    await waitFor(() => {
      expect(router.replace.mock.calls.length).toBe(callsBefore + 1);
      expect(router.replace.mock.calls[callsBefore]?.[0]).toBe(`/w/${syntheticAuthWorkspaceId}/reception?modulePanel=open&aside=closed`);
      expect(authApiRequests.find(request => request.path.endsWith("/accept"))?.body).toEqual({ accountMode: "existing" });
    });
  },
};

export const InviteExpiredReinvite: Story = {
  args: { scenario: "invite-expired" },
  beforeEach: () => prepareAuthCallerStory({ anonymous: true, reinviteRetry: true }),
  parameters: { docs: { story: { height: "880px" }, description: { story: "실제 만료 상태 화면과 재요청 Dialog입니다. 첫 로컬 응답은 실패하고, 확인 뒤 재요청하면 로컬 성공 Dialog를 표시합니다. 원본의 안내 문구를 유지합니다. 실제 관리자 알림·이메일 전송은 실행하지 않습니다." } } },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole("heading", { name: "초대가 만료되었습니다" })).toBeVisible();
    await expect(canvas.queryByLabelText("새 비밀번호")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "관리자에게 재요청" }));
    const failed = await page.findByRole("dialog", { name: "관리자에게 재요청을 접수하지 못했습니다" });
    await waitFor(() => expect(failed).toBeVisible());
    await userEvent.click(within(failed).getByRole("button", { name: "확인" }));
    await waitFor(() => expect(failed).not.toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "관리자에게 재요청" }));
    const success = await page.findByRole("dialog", { name: "관리자에게 재요청이 접수되었습니다" });
    await waitFor(() => expect(success).toBeVisible());
    await expect(authApiRequests.filter(request => request.path.endsWith("/reinvite-request")).map(request => request.body)).toEqual([{ email: syntheticInviteEmail }, { email: syntheticInviteEmail }]);
    await userEvent.click(within(success).getByRole("button", { name: "확인" }));
    await waitFor(() => expect(success).not.toBeVisible());
  },
};

export const InviteAlreadyAccepted: Story = {
  args: { scenario: "invite-accepted" },
  beforeEach: () => prepareAuthCallerStory({ anonymous: true }),
  parameters: { docs: { story: { height: "880px" }, description: { story: "실제 이미 수락된 초대 상태입니다. 새 비밀번호 폼과 재요청을 표시하지 않고 기존 워크스페이스 주소만 기록합니다. 중복 멤버십을 생성하는 API는 호출하지 않습니다." } } },
  play: async ({ canvas }) => {
    const router = getRouter();
    const callsBefore = router.push.mock.calls.length;
    await expect(canvas.getByRole("heading", { name: "이미 수락된 초대입니다" })).toBeVisible();
    await expect(canvas.queryByLabelText("새 비밀번호")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "관리자에게 재요청" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "워크스페이스로 이동" }));
    await waitFor(() => { expect(router.push.mock.calls.length).toBe(callsBefore + 1); expect(router.push.mock.calls[callsBefore]?.[0]).toBe(`/w/${syntheticAuthWorkspaceId}/reception?modulePanel=open&aside=closed`); });
    await expect(authApiRequests).toHaveLength(0);
  },
};

export const InviteMissing: Story = {
  args: { scenario: "invite-missing" },
  beforeEach: () => prepareAuthCallerStory({ anonymous: true }),
  parameters: { docs: { story: { height: "880px" }, description: { story: "실제 초대 링크가 없는 상태입니다. 수락·재요청 폼을 노출하지 않고 다른 계정 로그인 주소를 기록합니다. 서버 초대 조회는 이 예제에서 실행하지 않습니다." } } },
  play: async ({ canvas }) => {
    const router = getRouter();
    const callsBefore = router.push.mock.calls.length;
    await expect(canvas.getByRole("heading", { name: "초대 링크를 확인할 수 없습니다" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "워크스페이스로 이동" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "관리자에게 재요청" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "다른 계정으로 로그인" }));
    await waitFor(() => { expect(router.push.mock.calls.length).toBe(callsBefore + 1); expect(new URL(String(router.push.mock.calls[callsBefore]?.[0]), window.location.origin).searchParams.get("reason")).toBe("invite_existing_account"); });
    await expect(authApiRequests).toHaveLength(0);
  },
};

export const WorkspaceCreateInterrupted: Story = {
  args: { scenario: "onboarding" },
  beforeEach: () => prepareAuthCallerStory({ deferWorkspaceCreate: true }),
  parameters: { docs: { description: { story: "Storybook 정리 검사입니다. 실제 생성 폼의 로컬 POST 응답을 보류한 뒤 화면을 해제합니다. 시작된 원본 작업이 저장소·워크스페이스 이벤트·router 기록까지 끝난 것을 확인한 뒤 기존 저장소와 스토어를 복원합니다. 실행 후 해제 상태가 보이며 실제 병원 생성이나 외부 호출을 뜻하지 않습니다." } } },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("textbox", { name: "병원/워크스페이스 이름" }), "Synthetic Interrupted Hospital");
    await userEvent.type(canvas.getByRole("textbox", { name: "대표/관리자 이름" }), "합성 정리 검사");
    await userEvent.click(canvas.getByRole("button", { name: "워크스페이스 만들기" }));
    await waitFor(() => { expect(authApiRequests.some(request => request.method === "POST")).toBe(true); expect(canvas.getByRole("button", { name: "생성 중" })).toBeDisabled(); });
    await expect(readSessionWorkspacesState(window.sessionStorage, window.localStorage)?.currentWorkspaceId).toBeNull();
    const receipt = await completeAuthCallerFixture();
    await expect(canvas.queryByRole("heading", { name: "워크스페이스 만들기" })).not.toBeInTheDocument();
    await expect(canvas.getByLabelText("합성 인증 화면 해제 결과")).toBeVisible();
    await expect(receipt.unmounted).toBe(true);
    await expect(receipt.drainedRequests).toBe(1);
    await expect(receipt.workspaceEvents).toBeGreaterThan(0);
    await expect(receipt.terminalRoutes).toEqual(["/w/synthetic-interrupted-hospital/home?modulePanel=open&aside=closed"]);
    await expect(receipt.storageRestored).toBe(true);
  },
};

const syntheticPriorInviteReceipt = "synthetic-prior-invite-receipt";
export const InviteReceiptRestoration: Story = {
  args: { scenario: "invite-existing" },
  beforeEach: () => {
    const previousReceipt = window.localStorage.getItem(INVITE_ACCEPTANCE_RECEIPT_STORAGE_KEY);
    window.localStorage.setItem(INVITE_ACCEPTANCE_RECEIPT_STORAGE_KEY, syntheticPriorInviteReceipt);
    const restore = prepareAuthCallerStory({ anonymous: true });
    return async () => {
      await restore();
      if (previousReceipt === null) window.localStorage.removeItem(INVITE_ACCEPTANCE_RECEIPT_STORAGE_KEY);
      else window.localStorage.setItem(INVITE_ACCEPTANCE_RECEIPT_STORAGE_KEY, previousReceipt);
    };
  },
  parameters: { docs: { description: { story: "Storybook 정리 검사입니다. 실제 초대 수락이 로컬 영수증을 기록한 뒤 화면을 해제합니다. 기존 합성 영수증이 복원되는지 확인합니다. 검사 바깥의 저장소 값도 정리 단계에서 복원합니다. 실행 후 해제 상태를 표시하며 실제 계정이나 초대는 만들지 않습니다." } } },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText("비밀번호", { exact: true }), "SyntheticExisting1!");
    await userEvent.click(canvas.getByRole("button", { name: "로그인" }));
    await waitFor(() => {
      const value = window.localStorage.getItem(INVITE_ACCEPTANCE_RECEIPT_STORAGE_KEY);
      expect(JSON.parse(value ?? "null")).toMatchObject({ invitationId: syntheticInvitationId, workspaceId: syntheticAuthWorkspaceId, accountMode: "existing" });
    });
    const receipt = await completeAuthCallerFixture();
    await expect(canvas.getByLabelText("합성 인증 화면 해제 결과")).toBeVisible();
    await expect(receipt.unmounted).toBe(true);
    await expect(receipt.drainedRequests).toBe(1);
    await expect(receipt.storageRestored).toBe(true);
    await expect(window.localStorage.getItem(INVITE_ACCEPTANCE_RECEIPT_STORAGE_KEY)).toBe(syntheticPriorInviteReceipt);
  },
};
