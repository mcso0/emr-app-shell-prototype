import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmrRequiredIndicator } from "./required-indicator";
import { EmrRegistrationFieldRow } from "./registration-dialog";
function RequiredFields() {
  const [saved, setSaved] = useState(false);
  return <form className="grid w-[480px] max-w-full gap-3" onSubmit={event => { event.preventDefault(); setSaved(true); }}>
    <EmrRegistrationFieldRow label="보호자명" required controlId="required-guardian-name"><Input id="required-guardian-name" name="name" required /></EmrRegistrationFieldRow>
    <EmrRegistrationFieldRow label="대표 전화" required controlId="required-phone"><Input id="required-phone" name="phone" required type="tel" /></EmrRegistrationFieldRow>
    <Button type="submit" className="w-fit">합성 입력 확인</Button>
    {saved ? <p role="status">필수 항목 입력됨</p> : null}
  </form>;
}
const meta = {
  title: "Design System/EMR/EmrRequiredIndicator", component: EmrRequiredIndicator, tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { description: { component: "Actual EmrRegistrationFieldRow owns labels and the decorative marker. Native required belongs to each associated Input. The form completion is local and does not register a person." } } },
} satisfies Meta<typeof EmrRequiredIndicator>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => <RequiredFields />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByRole("textbox", { name: "보호자명" });
    await expect(name).toBeRequired(); await expect(canvas.getByRole("textbox", { name: "대표 전화" })).toBeRequired();
    await expect(canvasElement.querySelectorAll('[data-slot="emr-required-indicator"][aria-hidden="true"]')).toHaveLength(2);
    await userEvent.click(canvas.getByText("보호자명")); await expect(name).toHaveFocus();
    await userEvent.click(canvas.getByRole("button", { name: "합성 입력 확인" })); await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
    await userEvent.type(name, "합성 보호자"); await userEvent.type(canvas.getByRole("textbox", { name: "대표 전화" }), "000-0000-0000");
    await userEvent.click(canvas.getByRole("button", { name: "합성 입력 확인" })); await expect(canvas.getByRole("status")).toHaveTextContent("필수 항목 입력됨");
  },
};
