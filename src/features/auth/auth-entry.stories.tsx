import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { LoginForm } from "./login-form";
import { EmailOtpLogin } from "./email-otp-login";
import { FindId } from "./find-id";
import { PasswordRecovery } from "./password-recovery";
import { WorkspaceEntrySplashProvider } from "./workspace-entry-splash-provider";

const meta = {
  title: "Features/Auth/Entry",
  component: LoginForm,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true }, docs: { description: { component: "실제 로그인·OTP·아이디 찾기·비밀번호 찾기 호출자입니다. 인증 클라이언트는 Storybook에서 차단하고 입력 상태와 표시만 검증합니다. 실제 메일·문자·계정 조회는 실행하지 않습니다." } } },
  decorators: [(Story) => <WorkspaceEntrySplashProvider><Story /></WorkspaceEntrySplashProvider>],
} satisfies Meta<typeof LoginForm>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PasswordLogin: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "로그인" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "OTP 로그인" })).toBeEnabled();
    await expect(canvas.getByRole("link", { name: "아이디 찾기" })).toBeVisible();
  },
};
export const ValidPasswordInput: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("이메일"), "demo@example.invalid");
    await userEvent.type(canvas.getByLabelText("비밀번호", { exact: true }), "x");
    await expect(canvas.getByRole("button", { name: "로그인" })).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "비밀번호 보기" }));
    await expect(canvas.getByLabelText("비밀번호", { exact: true })).toHaveAttribute("type", "text");
  },
};
export const InvalidEmail: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("이메일"), "invalid");
    await expect(canvas.getByText("올바른 이메일 주소를 입력해 주세요.")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "로그인" })).toBeDisabled();
  },
};
export const OtpLogin: Story = {
  render: () => <EmailOtpLogin next={null} onVerified={fn()} />,
  play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("button", { name: "인증번호 받기" })).toBeDisabled(); },
};
export const IdVerificationUnavailable: Story = {
  render: () => <FindId />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("휴대전화번호"), "010-0000-0000");
    await expect(canvas.getByRole("button", { name: "인증번호 받기" })).toBeDisabled();
    await expect(canvas.getByRole("status")).toHaveTextContent("본인확인 서비스를 준비");
  },
};
export const PasswordResetRequest: Story = {
  render: () => <PasswordRecovery />,
  play: async ({ canvasElement }) => { await expect(within(canvasElement).getByRole("button", { name: "재설정 메일 요청" })).toBeDisabled(); },
};
export const InvalidPasswordResetLink: Story = { render: () => <PasswordRecovery invalidLink /> };
