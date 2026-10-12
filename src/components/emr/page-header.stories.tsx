import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CdsGnbHospitalGnbIcon } from "@/components/cds-icons/gnb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceMembershipManagement } from "@/features/auth/workspace-membership-management";
import { MOCK_AUTH_STORAGE_KEY, type MockAuthSession } from "@/features/auth/mock-session";
import { useMockAuthStore } from "@/features/auth/session-store";
import { createEmptySessionWorkspacesState, createSessionWorkspaceInvitation, SESSION_WORKSPACES_STORAGE_KEY, type WorkspaceInvitationInput } from "@/features/auth/workspace-session";
import { getAuthRuntimeMode } from "@/lib/supabase/config";
import { EmrPageHeader } from "./page-header";

type HeaderArgs = { showActions: boolean; showBadge: boolean; showIcon: boolean; title: string; canManageMembers: boolean };
const workspaceId = "storybook-emr-members";
const fixtureDate = "2026-10-11T00:00:00.000Z";
const requests: WorkspaceInvitationInput[] = [];
let holdSubmission = false;
let releaseSubmission: (() => void) | undefined;
function sessionFor(canManageMembers: boolean): MockAuthSession {
  return { id: "storybook-members-session", role: canManageMembers ? "hospital_admin" : "front_desk", roleLabel: canManageMembers ? "병원관리자" : "원무", storageMode: "session", issuedAt: fixtureDate };
}
function ActualMembersCaller({ canManageMembers }: HeaderArgs) {
  useEffect(() => {
    const session = sessionFor(canManageMembers);
    window.sessionStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(session));
    useMockAuthStore.setState({ hydrated: true, session });
  }, [canManageMembers]);
  return <div className="h-[640px] min-h-0 w-full"><WorkspaceMembershipManagement workspaceId={workspaceId} /></div>;
}
function HeaderApiExample({ title, showActions, showBadge, showIcon }: HeaderArgs) {
  const [receipt, setReceipt] = useState(false);
  return <div className="max-w-3xl rounded-md border border-border bg-background p-4">
    <EmrPageHeader title={title}
      actions={showActions ? <Button size="sm" onClick={() => setReceipt(true)}>표시 확인</Button> : null}
      badge={showBadge ? <Badge variant="secondary">샘플</Badge> : null}
      icon={showIcon ? <CdsGnbHospitalGnbIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null} />
    {receipt ? <p role="status">헤더 작업 선택됨</p> : null}
  </div>;
}
const apiArgs = { canManageMembers: { control: false, table: { disable: true } } } as const;
const callerArgs = Object.fromEntries(["title", "showActions", "showBadge", "showIcon"].map(key => [key, { control: false, table: { disable: true } }]));
const meta = {
  title: "Design System/EMR/EmrPageHeader", component: EmrPageHeader, tags: ["autodocs"],
  args: { title: "병원 구성원", showActions: true, showBadge: false, showIcon: false, canManageMembers: true },
  argTypes: { title: { control: "text" }, showActions: { control: "boolean" }, showBadge: { control: "boolean" }, showIcon: { control: "boolean" }, canManageMembers: { control: "boolean", description: "실제 호출부의 합성 관리자/원무 세션. 서버 권한 검증 사례가 아닙니다." } },
  parameters: { docs: {
      story: { inline: false, height: "760px" }, description: { component: "Default and InviteDenied render exported WorkspaceMembershipManagement, including its real invitation form, validation, pending state and member table. The local fixture restores auth/storage/fetch and never calls a real API. TitleOnly and LongTitle are explicit header API layout specimens." } } },
  beforeEach: ({ args }) => {
    if (getAuthRuntimeMode().authProvider !== "mock") throw new Error("Members caller fixture requires the integration Storybook mock auth environment (NEXT_PUBLIC_AUTH_MODE=mock).");
    const savedAuth = useMockAuthStore.getState();
    const keys = [MOCK_AUTH_STORAGE_KEY, SESSION_WORKSPACES_STORAGE_KEY];
    const savedStorage = [window.sessionStorage, window.localStorage].map(storage => ({ storage, entries: keys.map(key => [key, storage.getItem(key)] as const) }));
    const session = sessionFor(args.canManageMembers);
    for (const storage of [window.sessionStorage, window.localStorage]) for (const key of keys) storage.removeItem(key);
    window.sessionStorage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(session));
    window.sessionStorage.setItem(SESSION_WORKSPACES_STORAGE_KEY, JSON.stringify(createEmptySessionWorkspacesState(fixtureDate)));
    useMockAuthStore.setState({ hydrated: true, session });
    requests.length = 0; holdSubmission = false; releaseSubmission = undefined;
    const pendingInvitations = new Set<string>();
    const observeInvitationSaved = () => {
      const saved = JSON.parse(window.sessionStorage.getItem(SESSION_WORKSPACES_STORAGE_KEY) ?? "null") as { invitations?: Array<{ id: string }> } | null;
      for (const invitation of saved?.invitations ?? []) pendingInvitations.delete(invitation.id);
    };
    window.addEventListener("clair.sessionWorkspaces.v1", observeInvitationSaved);
    const originalFetch = window.fetch;
    const fixtureFetch: typeof fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
      if (!url.pathname.startsWith("/api/")) return originalFetch(input, init);
      if (url.pathname === `/api/workspaces/${workspaceId}/memberships` && (!init?.method || init.method === "GET")) return Response.json({ ok: true, memberships: [], invitations: [] });
      if (url.pathname === `/api/workspaces/${workspaceId}/invitations` && init?.method === "POST") {
        const invitationInput = JSON.parse(String(init.body)) as WorkspaceInvitationInput;
        requests.push(invitationInput);
        const invitation = createSessionWorkspaceInvitation(invitationInput, workspaceId, { sessionId: session.id, storageMode: "session" }, fixtureDate);
        pendingInvitations.add(invitation.id);
        if (holdSubmission) await new Promise<void>(resolve => { releaseSubmission = resolve; });
        return Response.json({ ok: true, invitation });
      }
      return Response.json({ ok: false, error: "storybook-unhandled-api" }, { status: 503 });
    };
    window.fetch = fixtureFetch;
    return async () => {
      releaseSubmission?.(); holdSubmission = false; releaseSubmission = undefined;
      // Actual handleSubmit persists after response.json. Observe its source
      // storage event before restoring even when an interrupted play unmounts.
      await waitFor(() => {
        if (pendingInvitations.size) throw new Error("Awaiting actual invitation persistence before fixture restoration.");
      }, { timeout: 3000 });
      window.removeEventListener("clair.sessionWorkspaces.v1", observeInvitationSaved);
      if (window.fetch === fixtureFetch) window.fetch = originalFetch;
      useMockAuthStore.setState(savedAuth);
      for (const { storage, entries } of savedStorage) for (const [key, value] of entries) {
        if (value === null) storage.removeItem(key); else storage.setItem(key, value);
      }
    };
  },
  render: args => <ActualMembersCaller {...args} />,
} satisfies Meta<HeaderArgs>;
export default meta;
type Story = StoryObj<typeof meta>;
const membersPlay: Story["play"] = async ({ canvasElement, args }) => {
  const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
  const invite = await canvas.findByRole("button", { name: "직원 초대" });
  await expect(canvas.getByRole("heading", { name: "병원 구성원" })).toBeVisible();
  if (!args.canManageMembers) {
    await expect(invite).toBeDisabled(); invite.focus(); await expect(invite).not.toHaveFocus();
    await userEvent.keyboard("{Enter}"); await expect(body.queryByRole("dialog")).not.toBeInTheDocument(); await expect(requests).toHaveLength(0); return;
  }
  await waitFor(() => expect(invite).toBeEnabled()); invite.focus(); await userEvent.keyboard("{Enter}");
  let dialogElement = await body.findByRole("dialog", { name: "직원 초대" });
  await waitFor(() => expect(dialogElement).toBeVisible());
  let dialog = within(dialogElement);
  await expect(dialog.getByLabelText("초대 이메일")).toHaveValue("");
  await expect(dialog.getByRole("radiogroup", { name: "권한 역할" })).toBeVisible();
  await expect(dialog.getByRole("radiogroup", { name: "직무" })).toBeVisible();
  await userEvent.click(dialog.getByRole("button", { name: "초대 만들기" }));
  await expect(await dialog.findByText("초대 이메일을 입력하세요.")).toBeVisible(); await expect(requests).toHaveLength(0);
  await userEvent.click(dialog.getByRole("button", { name: "닫기" }));
  await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  await userEvent.click(invite); dialogElement = await body.findByRole("dialog", { name: "직원 초대" }); await waitFor(() => expect(dialogElement).toBeVisible()); dialog = within(dialogElement);
  await userEvent.type(dialog.getByLabelText("초대 이메일"), "synthetic@example.invalid");
  await userEvent.type(dialog.getByLabelText("직책"), "원무 담당"); await userEvent.type(dialog.getByLabelText("부서"), "원무팀");
  holdSubmission = true;
  try {
    await userEvent.click(dialog.getByRole("button", { name: "초대 만들기" }));
    await waitFor(() => expect(dialog.getByRole("button", { name: "저장 중" })).toBeDisabled());
    await expect(dialog.getByLabelText("초대 이메일")).toBeDisabled();
    await expect(requests).toEqual([expect.objectContaining({ email: "synthetic@example.invalid", permissionRoleKey: "general", jobPositionKey: "front_desk", title: "원무 담당", department: "원무팀" })]);
    releaseSubmission?.(); await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    const invitedRow = await canvas.findByRole("row", { name: /synthetic@example.invalid/ }); await expect(invitedRow).toBeVisible(); await expect(invitedRow).toHaveTextContent("초대 대기");
  } finally { holdSubmission = false; releaseSubmission?.(); releaseSubmission = undefined; }
};
export const Default: Story = { argTypes: callerArgs, play: membersPlay };
export const TitleOnly: Story = {
  args: { title: "간단한 샘플 화면", showActions: false }, argTypes: apiArgs, render: args => <HeaderApiExample {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement); await expect(canvas.getByRole("heading", { name: args.title })).toBeVisible();
    if (args.showActions) { await userEvent.click(canvas.getByRole("button", { name: "표시 확인" })); await expect(canvas.getByRole("status")).toHaveTextContent("헤더 작업 선택됨"); }
    else await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
  parameters: { docs: { description: { story: "Header API specimen. Optional title, icon and badge only; actual members caller stays in Default." } } },
};
export const LongTitle: Story = {
  args: { title: "긴 제목을 가진 샘플 업무 화면의 헤더 표시 확인" }, argTypes: apiArgs,
  render: args => <HeaderApiExample {...args} />, play: TitleOnly.play,
  parameters: { docs: { description: { story: "Long-title API specimen with an operable local action. Actual invitation form is in Default." } } },
};
export const InviteDenied: Story = { args: { canManageMembers: false }, argTypes: callerArgs, play: membersPlay };
