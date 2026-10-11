import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { InpatientLocationPicker } from "./inpatient-location-picker";
import { parseInpatientLocationMutation, type InpatientLocationConfiguration } from "./inpatient-location-contract";

const workspaceId = "storybook-inpatient";
const locationId = "95000000-0000-4000-8000-000000000001";
let commands: unknown[] = [];
type Args = { scenario: "ready" | "readonly" | "empty" | "read-error" | "conflict"; disabled: boolean; initialValue: string };
function Example(args: Args) {
  const [value, setValue] = useState(args.initialValue);
  return <div className="w-[450px] p-4"><InpatientLocationPicker workspaceId={workspaceId} value={value} disabled={args.disabled} onChange={setValue} /><output aria-label="합성 선택 공간">{value || "미선택"}</output></div>;
}
const meta = {
  title: "Features/Inpatient/Location Picker", component: Example, tags: ["autodocs"],
  args: { scenario: "ready" as Args["scenario"], disabled: false, initialValue: "" },
  argTypes: { scenario: { control: false }, initialValue: { control: "text", description: "초기 ID가 바뀌면 로컬 선택을 다시 초기화합니다." } },
  render: (args) => <Example key={args.initialValue} {...args} />,
  parameters: { docs: { story: { inline: false, height: "760px" }, description: { component: "입원 확정 caller의 실제 InpatientLocationPicker입니다. 실제 parser와 revision 계약을 사용하는 합성 조회·등록·사용 중지 응답을 제공합니다. 모든 요청은 이 예제 endpoint에서 로컬로 처리하고 종료 시 fetch를 복원합니다. 병상 확보·중복 배정·실제 공간 저장은 검증하지 않습니다." } } },
  beforeEach: ({ args }) => {
    const original = globalThis.fetch;commands = [];
    let failRead = args.scenario === "read-error";let conflict = args.scenario === "conflict";
    const configuration: InpatientLocationConfiguration = { workspaceId, canManage: args.scenario !== "readonly", locations: args.scenario === "empty" ? [] : [{ id: locationId, label: "합성 케이지 A", kind: "cage", active: true, rowRevision: 1 }] };
    globalThis.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (!url.pathname.startsWith("/api/")) return original(input, init);
      if (url.pathname !== `/api/workspaces/${workspaceId}/inpatient/locations`) throw new Error(`Unexpected API ${url.pathname}`);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (method === "GET") { if (failRead) { failRead = false;return Response.json({}, { status: 503 }); } return Response.json(configuration); }
      if (method !== "POST") throw new Error(`Unexpected method ${method}`);
      const command = parseInpatientLocationMutation(JSON.parse(String(init?.body)));if (!command) throw new Error("Invalid emitted location command");commands.push(command);
      if (conflict) { conflict = false;return Response.json({}, { status: 409 }); }
      const index = configuration.locations.findIndex((location) => location.id === command.id);
      if (index >= 0 && configuration.locations[index].rowRevision !== command.expectedRevision) return Response.json({}, { status: 409 });
      const location = { id: command.id, label: command.label, kind: command.kind, active: command.active, rowRevision: command.expectedRevision + 1 };
      if (index < 0) configuration.locations.push(location);else configuration.locations[index] = location;
      return Response.json(configuration);
    };
    return () => { globalThis.fetch = original; };
  },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SelectRegisteredLocation: Story = { play: async ({ canvas }) => { const picker = await canvas.findByRole("combobox", { name: "등록된 병동/케이지" });await waitFor(() => expect(picker).toBeEnabled());await userEvent.selectOptions(picker, locationId);await expect(canvas.getByLabelText("합성 선택 공간")).toHaveTextContent(locationId); } };
export const RegisterAndDeactivate: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByText("입원 공간 등록·사용 관리"));
    await userEvent.type(canvas.getByRole("textbox", { name: "새 입원 공간 이름" }), "합성 병동 B");
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "새 입원 공간 종류" }), "ward");
    await userEvent.click(canvas.getByRole("button", { name: "등록" }));
    const picker = canvas.getByRole("combobox", { name: "등록된 병동/케이지" });
    await expect(await canvas.findByRole("option", { name: "합성 병동 B · 병동" })).toBeInTheDocument();
    await expect(commands[0]).toMatchObject({ label: "합성 병동 B", kind: "ward", expectedRevision: 0 });
    await userEvent.selectOptions(picker, locationId);await userEvent.click(canvas.getAllByRole("button", { name: "사용 중지" })[0]);
    await expect(await canvas.findByRole("option", { name: "합성 케이지 A · 케이지 (사용 중지)" })).toBeDisabled();
    await expect(commands[1]).toMatchObject({ id: locationId, active: false, expectedRevision: 1 });
    await userEvent.click(canvas.getByRole("button", { name: "다시 사용" }));
    await expect(await canvas.findByRole("option", { name: "합성 케이지 A · 케이지" })).not.toBeDisabled();
  },
};
export const ReadErrorAndRefresh: Story = { args: { scenario: "read-error" }, play: async ({ canvas }) => { await expect(await canvas.findByRole("alert")).toHaveTextContent("불러오지 못했습니다");await userEvent.click(canvas.getByRole("button", { name: "입원 공간 새로고침" }));await waitFor(() => expect(canvas.getByRole("combobox", { name: "등록된 병동/케이지" })).toBeEnabled()); } };
export const ConflictPreservesInput: Story = { args: { scenario: "conflict" }, play: async ({ canvas }) => { await userEvent.click(await canvas.findByText("입원 공간 등록·사용 관리"));await userEvent.type(canvas.getByRole("textbox", { name: "새 입원 공간 이름" }), "합성 충돌 공간");await userEvent.click(canvas.getByRole("button", { name: "등록" }));await expect(await canvas.findByRole("alert")).toHaveTextContent("새로고침 후 확인");await expect(canvas.getByRole("textbox", { name: "새 입원 공간 이름" })).toHaveValue("합성 충돌 공간"); } };
export const ReadOnly: Story = { args: { scenario: "readonly" }, play: async ({ canvas }) => { await canvas.findByRole("option", { name: "합성 케이지 A · 케이지" });await expect(canvas.queryByText("입원 공간 등록·사용 관리")).not.toBeInTheDocument(); } };
export const Disabled: Story = { args: { disabled: true, initialValue: locationId }, play: async ({ canvas }) => { await expect(canvas.getByRole("combobox", { name: "등록된 병동/케이지" })).toBeDisabled();await expect(canvas.queryByText("입원 공간 등록·사용 관리")).not.toBeInTheDocument(); } };
export const Empty: Story = { args: { scenario: "empty" }, play: async ({ canvas }) => { await expect(await canvas.findByRole("option", { name: "등록된 활성 입원 공간 없음" })).toBeInTheDocument(); } };
