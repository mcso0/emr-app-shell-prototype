import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { PasswordRecovery } from "./password-recovery";
const meta = {
  title: "Features/Auth/Password Recovery",
  component: PasswordRecovery,
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) =>
      String(input).endsWith("/password/recovery")
        ? Response.json({ ok: true })
        : original(input, init);
    return () => {
      globalThis.fetch = original;
    };
  },
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
} satisfies Meta<typeof PasswordRecovery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const EmailRequest: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("로그인 이메일")).toBeRequired();
    await expect(
      canvas.getByRole("button", { name: "재설정 메일 요청" }),
    ).toBeEnabled();
  },
};
export const ConfirmationValidation: Story = {
  args: { update: true },
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
