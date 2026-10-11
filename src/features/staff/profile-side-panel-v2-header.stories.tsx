import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import {
  EditableProfileAvatar,
  PresenceBadge,
  ProfileHeaderActionMenu,
  StatusMessageEditor,
} from "./components/profile-side-panel-v2-header";

/** Fixed staff-profile header specimen with synthetic state and no props. */
function HeaderSpecimen() {
  return (
    <div className="flex w-[348px] flex-col gap-5 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <PresenceBadge state="online" />
        <PresenceBadge state="offline" />
        <PresenceBadge state="unknown" />
      </div>
      <StatusMessageEditor value="진료 중입니다" editable={false} />
    </div>
  );
}

const meta = {
  title: "Features/Staff/Profile Side Panel V2/Header",
  component: HeaderSpecimen,
  tags: ["autodocs"],
  parameters: {
    docs: { story: { inline: false, height: "700px" },
      description: {
        component:
          "직원 프로필의 접속 상태, 상태 메시지, 사진, 메뉴를 확인합니다. HeaderSpecimen 등은 배치와 합성 콜백을 제공하는 예제입니다. 실제 API는 components/profile-side-panel-v2-header.tsx의 PresenceBadge, StatusMessageEditor, EditableProfileAvatar, ProfileHeaderActionMenu를 참고해 주세요. 호출 기능이 조회 결과와 수정 권한을 제공하며, 이 예제는 서버 권한 검증을 대신하지 않습니다.",
      },
    },
  },
} satisfies Meta<typeof HeaderSpecimen>;

export default meta;

type Story = StoryObj<typeof meta>;

async function openMenu(trigger: HTMLElement) {
  await userEvent.click(trigger);
}

export const PresenceStates: Story = {
  parameters: { docs: { description: { story: "온라인, 오프라인, 상태 확인 중 표시를 비교합니다." } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("온라인")).toBeVisible();
    expect(canvas.getByText("오프라인")).toBeVisible();
    expect(canvas.getByText("상태 확인 중")).toBeVisible();
  },
};

function EditableStatusSpecimen() {
  const [value, setValue] = useState("진료 중입니다");
  const [confirmed, setConfirmed] = useState(value);

  return (
    <div className="w-[217px]">
      <StatusMessageEditor
        editable
        value={value}
        onSave={async (nextValue) => {
          setValue(nextValue);
          setConfirmed(nextValue || "비어 있음");
        }}
      />
      <output className="sr-only">저장값: {confirmed}</output>
    </div>
  );
}

export const EditableStatus: Story = {
  parameters: { docs: { description: { story: "상태 메시지를 입력하고 Enter로 합성 저장을 완료하는지 확인합니다." } } },
  render: () => <EditableStatusSpecimen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "상태 메시지 수정" }));
    const input = canvas.getByRole("textbox", { name: "상태 메시지" });
    await userEvent.clear(input);
    await userEvent.type(input, "곧 복귀합니다{Enter}");
    await waitFor(() => {
      expect(canvas.getByText("곧 복귀합니다")).toBeVisible();
      expect(canvas.getByText("저장값: 곧 복귀합니다")).toBeInTheDocument();
    });
  },
};

function FailedStatusSpecimen() {
  const [attempts, setAttempts] = useState(0);

  return (
    <div className="w-[250px]">
      <StatusMessageEditor
        editable
        value="진료 중입니다"
        onSave={async () => {
          setAttempts((current) => current + 1);
          throw new Error("synthetic failure");
        }}
      />
      <output className="sr-only">시도: {attempts}</output>
    </div>
  );
}

export const StatusRollbackAndRetry: Story = {
  parameters: { docs: { description: { story: "저장 실패 후 기존 문구를 유지하고 다시 시도하는지 확인합니다." } } },
  render: () => <FailedStatusSpecimen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "상태 메시지 수정" }));
    const input = canvas.getByRole("textbox", { name: "상태 메시지" });
    await userEvent.clear(input);
    await userEvent.type(input, "저장 실패 예시{Enter}");
    await waitFor(() => expect(canvas.getByRole("alert")).toBeVisible());
    expect(canvas.getByText("진료 중입니다")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(canvas.getByText("시도: 2")).toBeInTheDocument());
  },
};

function AvatarSpecimen() {
  const [result, setResult] = useState("대기");
  const [src, setSrc] = useState<string>();
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  return (
    <div className="flex min-h-40 items-center gap-4">
      <EditableProfileAvatar
        alt="샘플 직원"
        editable
        initials="SU"
        src={src}
        onRemove={async () => { setSrc(undefined); setResult("삭제됨"); }}
        onUpload={async (file) => { setSrc(URL.createObjectURL(file)); setResult(`업로드됨: ${file.name}`); }}
      />
      <output>{result}</output>
    </div>
  );
}

export const AvatarUploadMenuAndReset: Story = {
  parameters: { docs: { description: { story: "합성 사진 선택, 메뉴, 초기화 동작을 확인합니다. 실제 업로드는 수행하지 않습니다." } } },
  render: () => <AvatarSpecimen />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await openMenu(canvas.getByRole("button", { name: "프로필 이미지 메뉴 열기" }));
    await waitFor(() => expect(body.getByRole("separator")).toBeInTheDocument());
    await userEvent.click(await body.findByRole("menuitem", { name: "프로필 이미지 업로드" }));
    expect(body.getByRole("heading", { name: "프로필 이미지 업로드" })).toBeInTheDocument();
    const dialog = body.getByRole("dialog");
    expect(dialog).toHaveStyle({ position: "fixed" });
    expect(dialog.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
    const input = body.getByLabelText("프로필 이미지 선택");
    const file = new File([decodeBase64Png()], "avatar.png", {
      type: "image/png",
    });
    await userEvent.upload(input, file);
    await waitFor(() =>
      expect(
        body.getByRole("img", { name: "선택한 프로필 이미지 미리보기" }),
      ).toBeVisible(),
    );
    expect(body.queryByRole("button", { name: "취소" })).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: "선택한 이미지 제거" }));
    expect(
      body.queryByRole("img", { name: "선택한 프로필 이미지 미리보기" }),
    ).not.toBeInTheDocument();
    await userEvent.upload(input, file);
    await userEvent.click(body.getByRole("button", { name: "업로드" }));
    await waitFor(() => expect(canvas.getByText("업로드됨: avatar.png")).toBeVisible());
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(canvas.getByRole("button", { name: "프로필 이미지 메뉴 열기" })).toHaveFocus());

    await openMenu(canvas.getByRole("button", { name: "프로필 이미지 메뉴 열기" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "프로필 이미지 업로드" }));
    expect(
      body.queryByRole("img", { name: "선택한 프로필 이미지 미리보기" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      body.getByRole("button", { name: "프로필 이미지 업로드 닫기" }),
    );
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "프로필 이미지 메뉴 열기" }),
      ).toHaveFocus(),
    );
    await openMenu(canvas.getByRole("button", { name: "프로필 이미지 메뉴 열기" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "프로필 이미지 제거" }));
    await expect(canvas.getByText("삭제됨")).toBeVisible();
  },
};

function decodeBase64Png() {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function HeaderMenuSpecimen({ canManageMember }: { canManageMember: boolean }) {
  const [action, setAction] = useState("없음");
  return (
    <div><ProfileHeaderActionMenu
      canManageMember={canManageMember}
      hasContact
      onCopyContact={() => setAction("연락처 복사")}
      onManageMember={() => setAction("멤버 관리에서 보기")}
      onOpenSchedule={() => setAction("전체 근무표 보기")}
    /><output aria-label="합성 프로필 작업">{action}</output></div>
  );
}

export const HeaderMenuAuthorized: Story = {
  parameters: { docs: { description: { story: "허용된 작업을 프로필 메뉴에 표시하는지 확인합니다." } } },
  render: () => <HeaderMenuSpecimen canManageMember />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "프로필 작업 더보기" });
    expect(trigger.getBoundingClientRect().width).toBe(28);
    expect(trigger.querySelector("svg")!.getBoundingClientRect().width).toBe(16);
    expect(getComputedStyle(trigger).borderRadius).toBe("8px");
    expect(getComputedStyle(trigger).color).toBe("rgb(64, 64, 64)");
    await openMenu(trigger);
    await waitFor(() =>
    expect(body.getByRole("menuitem", { name: "전체 근무표 보기" })).toBeInTheDocument(),
    );
    expect(body.getByRole("menuitem", { name: "연락처 복사" })).toBeInTheDocument();
    expect(body.getByRole("menuitem", { name: "멤버 관리에서 보기" })).toBeInTheDocument();
    expect(body.getAllByRole("menuitem")).toHaveLength(3);
    for (const name of ["전체 근무표 보기", "연락처 복사", "멤버 관리에서 보기"]) {
      if (!body.queryByRole("menu")) await openMenu(trigger);
      await userEvent.click(await body.findByRole("menuitem", { name }));
      await expect(canvas.getByLabelText("합성 프로필 작업")).toHaveTextContent(name);
      await waitFor(() => expect(body.queryByRole("menu")).not.toBeInTheDocument());
    }
  },
};

export const HeaderMenuRestricted: Story = {
  parameters: { docs: { description: { story: "작업 권한이 제한된 예제에서 메뉴 구성이 달라지는지 확인합니다." } } },
  render: () => <HeaderMenuSpecimen canManageMember={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await openMenu(canvas.getByRole("button", { name: "프로필 작업 더보기" }));
    await body.findByRole("menuitem", { name: "전체 근무표 보기" });
    expect(body.queryByRole("menuitem", { name: "멤버 관리에서 보기" })).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("menuitem", { name: "전체 근무표 보기" }));
    await expect(canvas.getByLabelText("합성 프로필 작업")).toHaveTextContent("전체 근무표 보기");
  },
};
