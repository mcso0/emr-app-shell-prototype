import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import styles from "@/features/home/components/home-workspace-layout.module.css";
import { cn } from "@/lib/utils";
import { EmrFilterToggle } from "./filter-toggle";
type FilterToggleArgs = ComponentProps<typeof EmrFilterToggle>;
function ControlledFilterToggle({ caller = true, ...args }: FilterToggleArgs & { caller?: boolean }) {
  const [pressed, setPressed] = useState(Boolean(args.pressed));
  return <div className="grid gap-3">
    <EmrFilterToggle {...args}
      className={cn(caller && styles.compactAction, caller && styles.actionButton, args.className)}
      aria-label="완료 포함" title={`완료 포함 · ${pressed ? "켜짐" : "꺼짐"}`}
      pressed={pressed} onPressedChange={setPressed} />
    <output aria-label="로컬 조회 조건">includeCompleted={String(pressed)}</output>
  </div>;
}
const meta = {
  title: "Design System/EMR/EmrFilterToggle", component: EmrFilterToggle, tags: ["autodocs"],
  parameters: { docs: { description: { component: "Off and On preserve HomeKanbanWorkspace's actual 완료 포함 aria-label/title and responsive toolbar classes. Pressing updates a local includeCompleted query receipt; no operations API runs. ButtonSizes and Disabled are explicit native API specimens." } } },
  argTypes: {
    pressed: { control: "boolean" }, size: { control: "inline-radio", options: ["xs", "sm", "default", "lg", "xl"] },
    disabled: { control: "boolean" }, onPressedChange: { table: { disable: true } },
  },
  args: { children: "완료 포함", pressed: false, size: "default", disabled: false },
  render: args => <ControlledFilterToggle key={String(Boolean(args.pressed))} {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement); const toggle = canvas.getByRole("button", { name: "완료 포함" });
    const initial = Boolean(args.pressed);
    await expect(toggle).toHaveAttribute("aria-pressed", String(initial));
    if (args.disabled) {
      await expect(toggle).toBeDisabled(); toggle.focus(); await expect(toggle).not.toHaveFocus(); await userEvent.keyboard("{Enter}");
      await expect(canvas.getByLabelText("로컬 조회 조건")).toHaveTextContent(`includeCompleted=${initial}`); return;
    }
    toggle.focus(); await userEvent.keyboard(" ");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", String(!initial)));
    await expect(toggle).toHaveAttribute("title", `완료 포함 · ${initial ? "꺼짐" : "켜짐"}`);
    await expect(canvas.getByLabelText("로컬 조회 조건")).toHaveTextContent(`includeCompleted=${!initial}`);
    await userEvent.click(toggle); await expect(toggle).toHaveAttribute("aria-pressed", String(initial));
  },
} satisfies Meta<typeof EmrFilterToggle>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Off: Story = {};
export const On: Story = { args: { pressed: true } };
export const ButtonSizes: Story = {
  argTypes: { pressed: { control: false, table: { disable: true } }, size: { control: false, table: { disable: true } } },
  render: args => <div className="flex flex-wrap items-center gap-3">{(["xs", "sm", "default", "lg", "xl"] as const).map(size => <ControlledFilterToggle caller={false} key={size} {...args} pressed size={size} />)}</div>,
  play: async ({ canvasElement, args }) => {
    const toggles = within(canvasElement).getAllByRole("button", { name: "완료 포함" }); await expect(toggles).toHaveLength(5);
    for (const toggle of toggles) {
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      if (args.disabled) await expect(toggle).toBeDisabled();
      else { toggle.focus(); await userEvent.keyboard(" "); await expect(toggle).toHaveAttribute("aria-pressed", "false"); }
    }
  },
};
export const Disabled: Story = { args: { disabled: true } };
