import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, mocked, userEvent, waitFor } from "storybook/test";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { PasswordRecovery } from "./password-recovery";

const resetPasswordForEmail = fn(async () => ({ data: {}, error: null }));
const meta = {
  title: "Features/Auth/Password Recovery",
  component: PasswordRecovery,
  beforeEach: () => {
    resetPasswordForEmail.mockClear();
    // This story exercises only the recovery method. The module itself is
    // replaced in preview.tsx, so no real client, cookies, or email is used.
    mocked(getBrowserSupabaseClient).mockReturnValue({
      auth: { resetPasswordForEmail },
    } as unknown as NonNullable<ReturnType<typeof getBrowserSupabaseClient>>);
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) =>
      String(input).endsWith("/password/recovery")
        ? Response.json({ ok: true })
        : original(input, init);
    return () => {
      globalThis.fetch = original;
      mocked(getBrowserSupabaseClient).mockReset();
    };
  },
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    docs: { story: { inline: false, height: "700px" }, description: { component: "비밀번호 재설정 화면의 입력과 안내를 확인합니다. 실제 API는 PasswordRecovery의 update 설정이며, 기본값은 이메일 요청 화면입니다. Storybook에서는 Supabase 클라이언트와 재설정 응답을 합성 응답으로 바꿉니다. 실제 메일을 보내거나 비밀번호를 변경하지 않습니다. 운영 로그인과 복구 링크 검증은 기능 통합 검사에서 확인해 주세요." } },
  },
} satisfies Meta<typeof PasswordRecovery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const EmailRequest: Story = {
  parameters: { docs: { description: { story: "합성 이메일을 입력하고 요청하면 안내 문구를 표시합니다. 메일 전송 대신 Storybook 전용 호출 기록을 확인합니다." } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("로그인 이메일")).toBeRequired();
    await expect(
      canvas.getByRole("button", { name: "재설정 메일 요청" }),
    ).toBeEnabled();
    await userEvent.type(canvas.getByLabelText("로그인 이메일"), "recovery@example.test");
    await userEvent.click(canvas.getByRole("button", { name: "재설정 메일 요청" }));
    await expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "recovery@example.test",
      { redirectTo: new URL("/auth/password-recovery", window.location.origin).href },
    );
    await expect(await canvas.findByRole("status")).toHaveTextContent("가입된 이메일이라면 재설정 안내가 도착합니다.");
  },
};
export const ConfirmationValidation: Story = {
  args: { update: true },
  parameters: { docs: { description: { story: "update를 켜면 새 비밀번호 입력 화면을 표시합니다. 두 값이 다르면 저장 전에 안내합니다. 복구 링크 확인 응답은 합성 데이터입니다." } } },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(
        canvas.getByLabelText("새 비밀번호", { exact: true }),
      ).toBeEnabled(),
    );
    await userEvent.type(
      canvas.getByLabelText("새 비밀번호", { exact: true }),
      "synthetic-new-password",
    );
    await userEvent.type(canvas.getByLabelText("새 비밀번호 확인"), "mismatch");
    await userEvent.click(
      canvas.getByRole("button", { name: "새 비밀번호 저장" }),
    );
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      "서로 일치하는",
    );
  },
};
