import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Autocomplete, AutocompleteContent, AutocompleteInput, AutocompleteItem, AutocompleteList } from "./autocomplete";
import { Dialog, DialogTrigger } from "./dialog";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
function Example({ nested = false }: { nested?: boolean }) {
  const [value, setValue] = useState("");
  const control = <div className="grid w-80 gap-2"><Autocomplete value={value} onValueChange={setValue} openOnFocus>
    <AutocompleteInput aria-label="합성 품종" placeholder="추천 선택 또는 직접 입력" />
    <AutocompleteContent><AutocompleteList render={<div aria-label="합성 품종 추천" aria-labelledby="" />}><AutocompleteItem value="합성 추천 가">합성 추천 가</AutocompleteItem><AutocompleteItem value="합성 추천 나">합성 추천 나</AutocompleteItem></AutocompleteList></AutocompleteContent>
  </Autocomplete><output aria-label="입력한 합성 품종">{value || "미입력"}</output></div>;
  return nested ? <Dialog><DialogTrigger>품종 예시 열기</DialogTrigger><EmrDialogShell title="합성 품종 입력" variant="form">{control}</EmrDialogShell></Dialog> : control;
}
const meta = { title: "Design System/UI/Autocomplete", component: Example, tags: ["autodocs"], args: { nested: false }, parameters: { docs: { description: { component: "품종 입력에서 사용하는 UI SDK 자유 텍스트 자동완성입니다. Combobox와 달리 목록에 없는 입력도 유효합니다. SDK가 추천 탐색·선택·팝업을 소유하며 CLAiR 스타일/페이지와 패널 경계를 유지합니다. 합성 값만 사용합니다." } } } } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const KeyboardAndFreeText: Story = { play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body), input = body.getByRole("combobox", { name: "합성 품종" });
  await userEvent.type(input, "추천"); await userEvent.keyboard("{ArrowDown}{Enter}");
  await waitFor(() => expect(input).toHaveValue("합성 추천 가"));
  await userEvent.clear(input); await userEvent.type(input, "목록에 없는 직접 입력"); await userEvent.keyboard("{Escape}");
  await expect(input).toHaveValue("목록에 없는 직접 입력");
  await expect(body.getByLabelText("입력한 합성 품종")).toHaveTextContent("목록에 없는 직접 입력");
} };
export const InExistingDialog: Story = { args: { nested: true }, play: async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body); await userEvent.click(body.getByRole("button", { name: "품종 예시 열기" }));
  const input = body.getByRole("combobox", { name: "합성 품종" }); await userEvent.click(input);
  await userEvent.click(await body.findByRole("option", { name: "합성 추천 나" }));
  await expect(input).toHaveValue("합성 추천 나");
  await userEvent.clear(input); await userEvent.type(input, "임의 품종"); await userEvent.keyboard("{Escape}");
  await expect(body.getByRole("dialog")).toBeVisible(); await expect(input).toHaveValue("임의 품종");
} };
