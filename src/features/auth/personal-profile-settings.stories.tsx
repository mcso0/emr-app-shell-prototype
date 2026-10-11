import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { PersonalSettingsForm } from "./personal-profile-settings";
import { defaultNotificationPreferences } from "@/features/notifications/notification-preferences";

const syntheticSession = {
  provider: "supabase" as const,
  role: "supabase" as const,
  id: "supabase-session-91000000-0000-4000-8000-000000000001",
  userId: "91000000-0000-4000-8000-000000000001",
  email: "settings@example.test",
  roleLabel: "설정 검증 계정",
  storageMode: "cookie" as const,
  issuedAt: "2026-09-08T00:00:00Z",
};
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1kAAAAASUVORK5CYII=";
let requests: Array<{ path: string; method: string }> = [];
function installFixtures(failStatusOnce = false, failRead = false) {
  requests = [];
  const original = globalThis.fetch;
  let profile = {
    sessionId: syntheticSession.id,
    displayName: "김예시",
    initials: "김예",
    phone: "010-0000-0000",
    notificationOptIn: false,
    avatarUrl: image,
    updatedAt: "2026-09-08T00:00:00Z",
  };
  let status = "진료 중입니다.";
  let preferences = defaultNotificationPreferences();
  globalThis.fetch = async (input, init) => {
    const path =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!path.includes("/api/")) return original(input, init);
    const method = init?.method ?? "GET";
    requests.push({ path, method });
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (path === "/api/users/me/profile") {
      if (failRead) return Response.json({ ok: false }, { status: 503 });
      if (method === "PATCH") profile = { ...profile, ...body };
      return Response.json({ ok: true, profile });
    }
    if (path.includes("/operational-profile"))
      return Response.json({
        ok: true,
        profile: {
          ...profile,
          membershipStatus: "active",
          department: "진료부",
          jobPositionLabel: "수의사",
          statusMessage: status,
          statusMessageUpdatedAt: "2026-09-08T00:00:00Z",
        },
      });
    if (path.endsWith("/status-message")) {
      if (failStatusOnce) {
        failStatusOnce = false;
        return Response.json({ ok: false }, { status: 500 });
      }
      status = body.message.trim();
      return Response.json({
        ok: true,
        message: status,
        updatedAt: "2026-09-08T01:00:00Z",
      });
    }
    if (path.endsWith("/notification-preferences")) {
      if (method === "PATCH") preferences = body;
      return Response.json({ ok: true, preferences });
    }
    if (path === "/api/users/me/avatar" && method === "DELETE") {
      profile = { ...profile, avatarUrl: "" };
      return Response.json({ ok: true });
    }
    return Response.json(
      { ok: false, message: "검증용 실패 응답입니다." },
      { status: 400 },
    );
  };
  return () => {
    globalThis.fetch = original;
  };
}
const meta = {
  title: "Features/Auth/Personal Settings",
  component: PersonalSettingsForm,
  parameters: { docs: { story: { inline: false, height: "900px" }, description: { component: "개인 정보와 알림 설정의 입력, 변경사항, 저장 안내를 확인합니다. 실제 PersonalSettingsForm은 session, workspaceId, workspaceName, returnHref를 받습니다. syntheticSession과 installFixtures는 예제 데이터 및 응답 설정입니다. 기능이 실제 인증과 저장을 담당하며 이 예제는 합성 API 응답으로 동작합니다." } }, layout: "fullscreen", nextjs: { appDirectory: true } },
  tags: ["autodocs"],
  args: {
    session: syntheticSession,
    workspaceId: "settings-alpha",
    workspaceName: "예시 동물병원",
    returnHref: "/w/settings-alpha/reception?aside=closed",
  },
  beforeEach: () => installFixtures(),
} satisfies Meta<typeof PersonalSettingsForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProfileSave: Story = {
  parameters: { docs: { description: { story: "이름을 바꾸고 합성 저장을 완료하면 변경사항 표시가 사라지는지 확인합니다." } } },
  play: async ({ canvas }) => {
    const name = await canvas.findByLabelText("이름");
    await expect(name).toHaveValue("김예시");
    await userEvent.clear(name);
    await userEvent.type(name, "박예시");
    await userEvent.click(canvas.getByRole("button", { name: "저장" }));
    await expect(
      await canvas.findByText("변경사항을 저장했습니다."),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "저장" }),
    ).not.toBeInTheDocument();
    await expect(requests.filter((item) => item.method === "PATCH")).toEqual([
      { path: "/api/users/me/profile", method: "PATCH" },
    ]);
  },
};
export const DirtyNavigationAndNotificationSave: Story = {
  parameters: { docs: { description: { story: "저장하지 않은 변경사항의 이동 확인과 알림 설정 저장을 확인합니다." } } },
  play: async ({ canvas, canvasElement }) => {
    const name = await canvas.findByLabelText("이름");
    await userEvent.type(name, " 변경");
    await userEvent.click(canvas.getByRole("button", { name: "알림" }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByRole("button", { name: "계속 편집" }),
    );
    await expect(name).toHaveValue("김예시 변경");
    await userEvent.click(canvas.getByRole("button", { name: "알림" }));
    await userEvent.click(
      await body.findByRole("button", { name: "변경사항 되돌리기" }),
    );
    const popup = await canvas.findByRole("switch", { name: "화면 알림" });
    await userEvent.click(popup);
    await userEvent.click(canvas.getByRole("button", { name: "저장" }));
    await expect(
      await canvas.findByText("변경사항을 저장했습니다."),
    ).toBeVisible();
    await expect(popup).not.toBeChecked();
    await expect(
      requests
        .filter((item) => item.method === "PATCH")
        .map((item) => item.path),
    ).toEqual([
      "/api/workspaces/settings-alpha/members/me/notification-preferences",
    ]);
  },
};
export const PartialSaveRetry: Story = {
  parameters: { docs: { description: { story: "일부 합성 저장 요청이 실패했을 때 실패한 부분을 다시 시도하는지 확인합니다." } } },
  beforeEach: () => installFixtures(true),
  play: async ({ canvas }) => {
    const name = await canvas.findByLabelText("이름");
    const status = await canvas.findByLabelText("상태 메시지");
    await expect(status).toBeEnabled();
    await userEvent.type(name, " 수정");
    await userEvent.clear(status);
    await userEvent.type(status, "오후 진료");
    await userEvent.click(canvas.getByRole("button", { name: "저장" }));
    await expect(
      await canvas.findByText(/일부 항목은 저장되었습니다/),
    ).toBeVisible();
    await expect(status).toHaveValue("오후 진료");
    await userEvent.click(canvas.getByRole("button", { name: "저장" }));
    await expect(
      await canvas.findByText("변경사항을 저장했습니다."),
    ).toBeVisible();
    await expect(
      requests.filter(
        (item) =>
          item.path === "/api/users/me/profile" && item.method === "PATCH",
      ),
    ).toHaveLength(1);
    await expect(
      requests.filter((item) => item.path.endsWith("/status-message")),
    ).toHaveLength(2);
  },
};
export const AvatarStagesUntilSave: Story = {
  parameters: { docs: { description: { story: "선택한 사진이 저장 전 초안으로 남는지 확인합니다. 실제 사진 업로드는 검증하지 않습니다." } } },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByLabelText("이름");
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: "프로필 사진 편집" }),
    );
    await userEvent.click(
      await body.findByRole("button", { name: "기본 이미지로 변경" }),
    );
    await userEvent.click(body.getByRole("button", { name: "사진 적용" }));
    await expect(
      requests.filter((item) => item.path.includes("/avatar")),
    ).toHaveLength(0);
    await userEvent.click(canvas.getByRole("button", { name: "되돌리기" }));
    await userEvent.click(
      await body.findByRole("button", { name: "변경사항 되돌리기" }),
    );
    await expect(canvas.getByAltText("프로필 사진")).toBeVisible();
    await expect(
      requests.filter((item) => item.path.includes("/avatar")),
    ).toHaveLength(0);
  },
};
export const PasswordValidationAndClear: Story = {
  parameters: { docs: { description: { story: "비밀번호 입력 검증과 닫기 후 민감 입력 초기화를 확인합니다." } } },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByLabelText("이름");
    await userEvent.click(canvas.getByRole("button", { name: "계정·보안" }));
    await userEvent.click(
      canvas.getByRole("button", { name: "비밀번호 변경" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const dialog = within(await body.findByRole("dialog"));
    await userEvent.type(
      dialog.getByLabelText("현재 비밀번호"),
      "synthetic-old",
    );
    await userEvent.type(
      dialog.getByLabelText("새 비밀번호", { exact: true }),
      "synthetic-new",
    );
    await userEvent.type(dialog.getByLabelText("새 비밀번호 확인"), "mismatch");
    await userEvent.click(
      dialog.getByRole("button", { name: "비밀번호 변경" }),
    );
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "서로 일치하는",
    );
    await expect(
      requests.filter((item) => item.path.endsWith("/password")),
    ).toHaveLength(0);
    await userEvent.click(dialog.getByRole("button", { name: "취소" }));
    await userEvent.click(
      canvas.getByRole("button", { name: "비밀번호 변경" }),
    );
    await expect(await body.findByLabelText("현재 비밀번호")).toHaveValue("");
    await userEvent.keyboard("{Escape}");
  },
};
export const ReadFailure: Story = {
  parameters: { docs: { description: { story: "개인 정보를 읽지 못했을 때의 오류 표시를 확인합니다." } } },
  beforeEach: () => installFixtures(false, true),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "프로필을 불러오지 못했습니다.",
    );
    await expect(canvas.queryByLabelText("이름")).not.toBeInTheDocument();
  },
};
