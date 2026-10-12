import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { expect, userEvent, waitFor } from "storybook/test";
import { MOCK_AUTH_STORAGE_KEY } from "@/features/auth/mock-session";
import { useMockAuthStore } from "@/features/auth/session-store";
import { LoginCallerExample, loginRequests, prepareLoginCallerStory, syntheticLoginEmail, syntheticLoginNext, syntheticOtpNext } from "./login-caller-parity.stories.fixture";

const meta = {
  title: "Features/Auth/Login Caller Parity",
  component: LoginCallerExample,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
    nextjs: { appDirectory: true, navigation: { pathname: "/login", query: { next: syntheticLoginNext } } },
    docs: { story: { inline: false, height: "1040px" }, description: { component: "실제 LoginForm과 WorkspaceEntrySplashProvider입니다. 기존 mock provider만 사용합니다. 입력·역할·브라우저 저장·오류·초대 인증 요청은 합성 값과 로컬 응답으로 확인합니다. Next 이동은 기록만 남기며 실제 계정이나 이메일을 만들지 않습니다. 화면을 먼저 해제한 뒤 시작된 mock 로그인 이동이 끝나면 스토어와 저장소를 복원합니다." } },
  },
  beforeEach: () => prepareLoginCallerStory(),
} satisfies Meta<typeof LoginCallerExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ValidationAndVisibility: Story = {
  play: async ({ canvas }) => {
    const email = canvas.getByRole("textbox", { name: "이메일" });
    const password = canvas.getByLabelText("비밀번호", { exact: true });
    const submit = canvas.getByRole("button", { name: "로그인" });
    await userEvent.click(submit);
    await expect(email).toHaveFocus();
    await expect(canvas.getByRole("button", { name: "인증번호로 로그인" })).toBeDisabled();
    await expect(canvas.getByRole("link", { name: "비밀번호 찾기" })).toHaveAttribute("href", "/reset-password");
    await userEvent.type(email, "synthetic-invalid");
    await userEvent.click(submit);
    await waitFor(() => { expect(canvas.getByText("올바른 이메일 주소를 입력해 주세요.")).toBeVisible(); expect(canvas.getByText("비밀번호를 입력해 주세요.")).toBeVisible(); });
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(email);
    await userEvent.type(email, syntheticLoginEmail);
    await userEvent.type(password, "SyntheticLogin1!");
    await userEvent.click(canvas.getByRole("button", { name: "비밀번호 보기" }));
    await expect(password).toHaveAttribute("type", "text");
    await expect(canvas.getByRole("button", { name: "비밀번호 숨기기" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: "비밀번호 숨기기" }));
    await expect(password).toHaveAttribute("type", "password");
    await expect(useMockAuthStore.getState().session).toBeNull();
    await expect(loginRequests).toHaveLength(0);
  },
};

export const MockRoleAndPersistence: Story = {
  parameters: { docs: { description: { story: "원본의 개발용 mock 역할·저장 옵션입니다. 병원 관리자와 브라우저 저장을 선택한 뒤 실제 mock session 저장과 요청 경로를 확인합니다. 로그인 성공 뒤 원본 Splash가 나타납니다. 임의의 운영 계정이나 권한 승인을 뜻하지 않습니다." } } },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "병원 관리자 역할 선택" }));
    await expect(canvas.getByRole("button", { name: "병원 관리자 역할 선택" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("radio", { name: /브라우저에 유지/ }));
    await expect(canvas.getByRole("radio", { name: /브라우저에 유지/ })).toBeChecked();
    await userEvent.type(canvas.getByRole("textbox", { name: "이메일" }), syntheticLoginEmail);
    await userEvent.type(canvas.getByLabelText("비밀번호", { exact: true }), "SyntheticLogin1!");
    const router = getRouter();
    const before = router.replace.mock.calls.length;
    await userEvent.click(canvas.getByRole("button", { name: "로그인" }));
    await waitFor(() => {
      expect(useMockAuthStore.getState().session).toMatchObject({ role: "hospital_admin", storageMode: "local" });
      expect(JSON.parse(window.localStorage.getItem(MOCK_AUTH_STORAGE_KEY) ?? "null")).toMatchObject({ role: "hospital_admin", storageMode: "local" });
      expect(window.sessionStorage.getItem(MOCK_AUTH_STORAGE_KEY)).toBeNull();
      expect(router.replace.mock.calls[before]?.[0]).toBe(syntheticLoginNext);
    });
    await expect(canvas.getByTestId("login-workspace-entry-loading")).toBeVisible();
    await expect(loginRequests).toHaveLength(0);
  },
};

export const MockProviderFailure: Story = {
  parameters: { nextjs: { navigation: { query: { next: syntheticLoginNext, mockProviderError: "1" } } }, docs: { description: { story: "원본이 제공하는 mockProviderError 미리보기입니다. 실제 원본의 150ms 오류 처리 뒤 폼이 다시 활성화되고 세션이 만들어지지 않는지 확인합니다. 타이머나 인증 API를 바꾸지 않습니다." } } },
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("textbox", { name: "이메일" }), syntheticLoginEmail);
    await userEvent.type(canvas.getByLabelText("비밀번호", { exact: true }), "SyntheticLogin1!");
    await userEvent.click(canvas.getByRole("button", { name: "로그인" }));
    await waitFor(() => { expect(canvas.getByText("로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도하세요.")).toBeVisible(); expect(canvas.getByRole("button", { name: "로그인" })).toBeEnabled(); });
    await expect(useMockAuthStore.getState().session).toBeNull();
    await expect(loginRequests).toHaveLength(0);
  },
};

export const InviteOtpRetry: Story = {
  beforeEach: () => prepareLoginCallerStory({ otpRetry: true }),
  parameters: { nextjs: { navigation: { query: { reason: "invite_email_otp", inviteEmail: syntheticLoginEmail, next: syntheticOtpNext } } }, docs: { description: { story: "실제 초대 인증 입력 분기입니다. 첫 로컬 요청은 503이고 재요청은 200입니다. 잘못된 합성 코드와 원본의 데모 코드 00000000을 확인합니다. 실제 메일·OTP provider·비밀번호 변경은 실행하지 않습니다." } } },
  play: async ({ canvas }) => {
    const email = canvas.getByRole("textbox", { name: "이메일" });
    await expect(email).toHaveValue(syntheticLoginEmail);
    await expect(email).toHaveAttribute("readonly");
    await userEvent.click(canvas.getByRole("button", { name: "인증 코드 받기" }));
    await waitFor(() => expect(canvas.getByText("초대 이메일 인증 또는 비밀번호 설정을 진행할 수 없습니다. 초대 링크와 인증 코드를 확인하세요.")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "인증 코드 받기" }));
    await waitFor(() => expect(canvas.getByText("인증 코드를 보냈습니다.")).toBeVisible());
    await expect(loginRequests).toHaveLength(2);
    await expect(loginRequests.map(request => request.body)).toEqual([{ email: syntheticLoginEmail, next: syntheticOtpNext }, { email: syntheticLoginEmail, next: syntheticOtpNext }]);
    const code = canvas.getByRole("textbox", { name: "인증 코드" });
    await userEvent.type(code, "11111111");
    await userEvent.click(canvas.getByRole("button", { name: "인증하고 초대 화면으로 돌아가기" }));
    await waitFor(() => expect(canvas.getByText("초대 이메일 인증 또는 비밀번호 설정을 진행할 수 없습니다. 초대 링크와 인증 코드를 확인하세요.")).toBeVisible());
    await userEvent.clear(code);
    await userEvent.type(code, "00000000");
    const router = getRouter();
    const before = router.replace.mock.calls.length;
    await userEvent.click(canvas.getByRole("button", { name: "인증하고 초대 화면으로 돌아가기" }));
    await waitFor(() => expect(router.replace.mock.calls[before]?.[0]).toBe(syntheticOtpNext));
    await expect(canvas.getByTestId("login-workspace-entry-loading")).toBeVisible();
    await expect(loginRequests).toHaveLength(2);
  },
};
