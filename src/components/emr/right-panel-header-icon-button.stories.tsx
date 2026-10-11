import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CdsNavigationChevronsRightIcon } from "@/components/cds-icons/navigation";
import { Button } from "@/components/ui/button";
import { EmrRightPanel, EmrRightPanelBody } from "./right-panel";
import { EmrRightPanelHeader } from "./right-panel-header";
import { EmrRightPanelHeaderIconButton } from "./right-panel-header-icon-button";

type IconButtonArgs = { disabled: boolean };
function HeaderActionExample({ disabled }: IconButtonArgs) {
  const [open, setOpen] = useState(true);
  return <div className="h-64 w-[320px]">
    {open ? <EmrRightPanel className="group/lab-receipt-panel bg-[var(--emr-surface-rightpanel)]" data-testid="receipt-panel"
      header={<EmrRightPanelHeader><div className="relative flex min-w-0 max-w-full items-center">
        <h2 className="min-w-0 truncate text-sm font-semibold">장비 검사 수신함</h2>
        <span className="pointer-events-auto absolute left-full z-10 ml-1 flex w-8 shrink-0">
          <EmrRightPanelHeaderIconButton disabled={disabled} className="opacity-0 text-[var(--emr-text-tertiary)] transition-opacity hover:text-[var(--emr-text-tertiary)] group-hover/lab-receipt-panel:opacity-100 focus-visible:opacity-100" aria-label="장비 검사 수신함 접기" data-workspace-receipt-collapse="true" onClick={() => setOpen(false)}>
            <CdsNavigationChevronsRightIcon className="size-4" />
          </EmrRightPanelHeaderIconButton>
        </span>
      </div></EmrRightPanelHeader>}>
      <EmrRightPanelBody><p className="p-3 text-sm text-muted-foreground">합성 수신 데이터 영역</p></EmrRightPanelBody>
    </EmrRightPanel> : <><p role="status">장비 검사 수신함 접힘</p><Button variant="outline" onClick={() => setOpen(true)}>수신함 다시 열기</Button></>}
  </div>;
}
const meta = {
  title: "Design System/EMR/EmrRightPanelHeaderIconButton", component: HeaderActionExample, tags: ["autodocs"],
  parameters: { docs: { description: { component: "Default uses lab-imaging's actual receipt-panel header composition, chevrons, hover/focus classes and local open state. Receipt body is a bounded synthetic placeholder. Disabled is an explicit native API specimen; actual lab caller does not pass disabled." } } },
  args: { disabled: false }, argTypes: { disabled: { control: "boolean" } },
  render: args => <HeaderActionExample key={String(args.disabled)} {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "장비 검사 수신함 접기" });
    if (args.disabled) {
      await expect(button).toBeDisabled(); button.focus(); await expect(button).not.toHaveFocus();
      await userEvent.keyboard("{Enter}"); await expect(canvas.getByTestId("receipt-panel")).toBeVisible(); return;
    }
    await expect(button).toHaveStyle({ opacity: "0" });
    await userEvent.hover(canvas.getByTestId("receipt-panel"));
    // Synthetic hover preserves event semantics; coordinator checks actual CSS hover with native CUA.
    await expect(button).toHaveClass("group-hover/lab-receipt-panel:opacity-100");
    await userEvent.unhover(canvas.getByTestId("receipt-panel"));
    await userEvent.tab(); await expect(button).toHaveFocus();
    await waitFor(() => expect(button).toHaveStyle({ opacity: "1" }));
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status")).toHaveTextContent("장비 검사 수신함 접힘");
    await userEvent.click(canvas.getByRole("button", { name: "수신함 다시 열기" }));
    await expect(canvas.getByTestId("receipt-panel")).toBeVisible();
  },
} satisfies Meta<IconButtonArgs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
