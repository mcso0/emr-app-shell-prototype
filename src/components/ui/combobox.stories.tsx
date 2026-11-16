import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "./combobox";
import { Dialog, DialogTrigger } from "./dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";

function Example({ nested = false }: { nested?: boolean }) {
  const [value, setValue] = useState<string | null>(null);
  const control = <div className="grid w-80 gap-3"><Combobox value={value} onValueChange={setValue}>
    <ComboboxInput aria-label="합성 항목 검색" placeholder="항목 검색" />
    <ComboboxContent><ComboboxList aria-label="합성 검색 결과">
      <ComboboxItem value="first" label="합성 첫 항목">합성 첫 항목</ComboboxItem>
      <ComboboxItem value="unavailable" label="사용 불가" disabled>사용 불가</ComboboxItem>
      <ComboboxItem value="last" label="합성 마지막 항목">합성 마지막 항목</ComboboxItem>
    </ComboboxList></ComboboxContent>
  </Combobox><output aria-label="합성 선택 결과">{value ?? "미선택"}</output></div>;
  return nested ? <Dialog><DialogTrigger>합성 선택 열기</DialogTrigger><EmrDialogShell title="합성 선택" variant="form">{control}</EmrDialogShell></Dialog> : control;
}
const meta = { title: "Design System/UI/Combobox", component: Example, tags: ["autodocs"], args: { nested: false }, parameters: { docs: { description: { component: "UI SDK가 검색·active-descendant·선택·팝업 위치와 닫힘을 소유합니다. CLAiR 입력/옵션 스타일과 page-loading/side-panel 소유자 메타데이터를 유지합니다. 합성 값만 선택하며 서버 조회·저장은 실행하지 않습니다." } } } } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const KeyboardSelection: Story = { play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body), input = body.getByRole("combobox", { name: "합성 항목 검색" });
  await userEvent.click(input); await userEvent.keyboard("{ArrowDown}");
  await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true }));
  await expect(body.getByLabelText("합성 선택 결과")).toHaveTextContent("미선택");
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, isComposing: false, bubbles: true, cancelable: true }));
  await expect(body.getByLabelText("합성 선택 결과")).toHaveTextContent("미선택");
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await waitFor(() => expect(body.getByLabelText("합성 선택 결과")).toHaveTextContent("last"));
  await expect(input).toHaveFocus();
} };
export const InsideExistingDialog: Story = { args: { nested: true }, play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(body.getByRole("button", { name: "합성 선택 열기" }));
  const input = body.getByRole("combobox", { name: "합성 항목 검색" });
  await userEvent.type(input, "마지막");
  await userEvent.click(await body.findByRole("option", { name: "합성 마지막 항목" }));
  await waitFor(() => expect(body.getByLabelText("합성 선택 결과")).toHaveTextContent("last"));
  await userEvent.click(input); await userEvent.keyboard("{ArrowDown}{Escape}");
  await expect(body.getByRole("dialog")).toBeVisible();
  await expect(input).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
} };
