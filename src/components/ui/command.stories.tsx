import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { WorkspaceSwitcher } from "@/shell/workspace-switcher";
import { SESSION_WORKSPACES_STORAGE_KEY } from "@/features/auth/workspace-session";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "./command";

type CommandExampleArgs = { initialQuery: string };
function CommandExample({ initialQuery }: CommandExampleArgs) {
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState("");
  return <div className="grid max-w-md gap-3">
    <Command label="합성 작업 검색" className="border border-border">
      <CommandInput aria-label="합성 작업 검색" placeholder="합성 작업 검색" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>조건에 맞는 합성 작업이 없습니다.</CommandEmpty>
        <CommandGroup heading="합성 작업">
          <CommandItem value="reception" keywords={["접수"]} onSelect={setSelected}>접수 보기<CommandShortcut>↵</CommandShortcut></CommandItem>
          <CommandItem value="lab" keywords={["검사"]} onSelect={setSelected}>검사 보기</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="사용할 수 없는 작업"><CommandItem value="unavailable" disabled onSelect={setSelected}>준비 중</CommandItem></CommandGroup>
      </CommandList>
    </Command>
    <output aria-label="합성 작업 선택">{selected || "선택 없음"}</output>
  </div>;
}

const workspaces = ["합성 접수 병원", "합성 검사 병원", "합성 내과 병원", "합성 외과 병원", "합성 야간 병원"].map((displayName, index) => ({
  id: `synthetic-workspace-${index + 1}`, displayName, membershipId: `synthetic-membership-${index + 1}`,
  roles: ["front_desk"], status: "active", logo: { revision: null, url: null },
}));
function WorkspaceCommandCaller() {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0].id);
  const [count, setCount] = useState(0);
  return <div className="grid justify-items-start gap-3">
    <WorkspaceSwitcher workspaceId={workspaceId} userSessionId={null} onSelectWorkspace={(workspace) => { setWorkspaceId(workspace.id); setCount((value) => value + 1); }} />
    <output aria-label="합성 워크스페이스 선택">{workspaceId} · 변경 {count}회</output>
  </div>;
}

const meta = {
  title: "Design System/UI/Command", component: CommandExample, tags: ["autodocs"],
  parameters: { docs: {
      story: { inline: false, height: "500px" }, description: { component: "Default는 실제 WorkspaceSwitcher의 Command·Popover·워크스페이스 검색 조합입니다. 자체 조회에는 합성 GET 응답을 주고 브라우저의 기존 목록과 fetch를 종료 시 복원합니다. 원본이 검색·키보드 탐색·현재 선택·팝업 닫기를 소유합니다. EmptyResults는 cmdk의 빈 결과와 disabled API를 독립 확인합니다. initialQuery는 API 예제의 초기 검색어입니다." } } },
  args: { initialQuery: "" },
  argTypes: { initialQuery: { control: "text", description: "API 예제의 초기 검색어입니다. 변경하면 예제를 다시 시작합니다." } },
  render: (args) => <CommandExample key={args.initialQuery} {...args} />,
} satisfies Meta<CommandExampleArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () => {
    const originalFetch = globalThis.fetch;
    const stores = [window.sessionStorage, window.localStorage];
    const snapshots = stores.map((storage) => storage.getItem(SESSION_WORKSPACES_STORAGE_KEY));
    stores.forEach((storage) => storage.removeItem(SESSION_WORKSPACES_STORAGE_KEY));
    globalThis.fetch = async (input, init) => {
      const inputUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(inputUrl, window.location.href);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (url.origin === window.location.origin && url.pathname === "/api/workspaces" && method.toUpperCase() === "GET") {
        return new Response(JSON.stringify({ ok: true, workspaces }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return originalFetch(input, init);
    };
    return () => {
      globalThis.fetch = originalFetch;
      stores.forEach((storage, index) => { const previous = snapshots[index]; if (previous === null) storage.removeItem(SESSION_WORKSPACES_STORAGE_KEY); else storage.setItem(SESSION_WORKSPACES_STORAGE_KEY, previous); });
    };
  },
  render: () => <WorkspaceCommandCaller />,
  parameters: { controls: { disable: true }, docs: { description: { story: "실제 WorkspaceSwitcher를 렌더합니다. 원본 기준 5개부터 검색을 표시합니다. 현재 항목 선택은 팝업만 닫고, 다른 항목 선택은 로컬 선택 결과를 바꿉니다. 실제 로그인·워크스페이스 전환은 실행하지 않습니다." } } },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "synthetic-workspace-1 워크스페이스 선택" }));
    const current = await page.findByRole("option", { name: /합성 접수 병원/ });
    await expect(current).toHaveAttribute("aria-current", "true");
    await userEvent.click(current);
    await expect(canvas.getByLabelText("합성 워크스페이스 선택")).toHaveTextContent("변경 0회");
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "synthetic-workspace-1 워크스페이스 선택" })).toHaveAttribute("aria-expanded", "false");
      expect(current).not.toBeVisible();
    });
    await userEvent.click(canvas.getByRole("button", { name: "synthetic-workspace-1 워크스페이스 선택" }));
    const search = await page.findByRole("combobox");
    // cmdk's aria-labelledby points at the Root's empty hidden label on current main.
    // Preserve and expose that source gap; do not invent a label in the real caller.
    await expect(search).toHaveAttribute("aria-label", "워크스페이스 검색");
    await expect(search).toHaveAccessibleName("");
    await expect(search).toHaveAttribute("placeholder", "워크스페이스 검색");
    await userEvent.type(search, "합성 검사");
    await waitFor(() => { expect(page.getAllByRole("option")).toHaveLength(1); expect(page.getByRole("option")).toHaveTextContent("합성 검사 병원"); });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(canvas.getByLabelText("합성 워크스페이스 선택")).toHaveTextContent("synthetic-workspace-2 · 변경 1회"));
    await expect(canvas.getByRole("button", { name: "synthetic-workspace-2 워크스페이스 선택" })).toHaveAttribute("aria-expanded", "false");
  },
};
export const EmptyResults: Story = {
  parameters: { docs: { description: { story: "순수 Command API입니다. 없는 검색어의 빈 결과를 표시합니다. 검색어를 지우면 선택과 disabled 상태를 다시 확인할 수 있습니다." } } },
  args: { initialQuery: "없는 합성 항목" },
  play: async ({ canvas }) => {
    await waitFor(() => { expect(canvas.getByText("조건에 맞는 합성 작업이 없습니다.")).toBeVisible(); expect(canvas.queryByRole("option")).not.toBeInTheDocument(); });
    const search = canvas.getByRole("combobox", { name: "합성 작업 검색" });
    await userEvent.clear(search);
    const unavailable = await canvas.findByRole("option", { name: "준비 중" });
    await expect(unavailable).toHaveAttribute("aria-disabled", "true");
    await userEvent.type(search, "검사");
    await waitFor(() => expect(canvas.getAllByRole("option")).toHaveLength(1));
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(canvas.getByLabelText("합성 작업 선택")).toHaveTextContent("lab"));
  },
};
