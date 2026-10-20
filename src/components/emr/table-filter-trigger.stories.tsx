import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ComponentProps } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { EmrTableFilterTrigger } from "./table-filter-trigger";
import { EmrTableFilterBuilder } from "./table-filter-builder";
import { getEmrTableFilterBuilderActiveCount } from "./table-filter-builder-model";
import { createSampleFilterModel, sampleFilterFields, SampleFilterResults } from "./table-filter.stories.fixture";

function TriggerExample({ activeCount, ...args }: ComponentProps<typeof EmrTableFilterTrigger>) {
  const [model, setModel] = useState(() => createSampleFilterModel(activeCount));
  const [open, setOpen] = useState(false);
  return <div className="max-w-2xl">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<EmrTableFilterTrigger {...args} activeCount={getEmrTableFilterBuilderActiveCount(model, sampleFilterFields)} />} />
      <PopoverContent align="end" className="w-[min(640px,calc(100vw-32px))] gap-0 overflow-visible p-0" initialFocus={false}>
        <EmrTableFilterBuilder fields={sampleFilterFields} model={model} onModelChange={setModel} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
    <SampleFilterResults model={model} />
  </div>;
}

const meta = {
  title: "Design System/EMR/EmrTableFilterTrigger",
  component: EmrTableFilterTrigger,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "800px" },
      description: {
        component:
          "Shared Trigger+Popover+Builder API composition follows CustomerDataTable popup wrappers. The icon follows Button size rules: 12px for sm and 16px for default. Source model helpers derive completed-rule count and filtered rows. Active starts with eight rules in two source-limit-compliant groups. Controls reset local model; this does not reproduce the full customer controller.",
      },
    },
  },
  args: {
    activeCount: 0,
    size: "sm",
  },
  argTypes: { size: { control: "select", options: ["sm", "default"], description: "Button sizes used by table toolbars (sm) and Home (default)." }, activeCount: { control: { type: "number", min: 0, max: 15, step: 1 }, description: "Initial complete synthetic rules; local source model derives the displayed count." }, onClick: { table: { disable: true } } },
  render: (args) => <TriggerExample key={`${args.activeCount}:${args.disabled}`} {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: /필터/ });
    if (args.disabled) {
      await expect(trigger).toBeDisabled(); trigger.focus(); await expect(trigger).not.toHaveFocus();
      await userEvent.keyboard("{Enter}"); await expect(body.queryByRole("combobox")).not.toBeInTheDocument();
      return;
    }
    trigger.focus(); await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    const field = await body.findByRole("combobox", { name: "그룹 1 조건 1 필터 필드" });
    await waitFor(() => expect(field).toBeVisible());
    if (args.activeCount > 0) {
      await userEvent.click(body.getByRole("button", { name: "초기화" }));
      await waitFor(() => expect(canvas.getByLabelText("필터 결과")).toHaveTextContent("완성된 조건 0개 · 결과 3건"));
    }
    await userEvent.click(body.getByRole("button", { name: "필터 닫기" }));
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    await userEvent.click(trigger); await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
} satisfies Meta<typeof EmrTableFilterTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const DefaultSize: Story = {
  args: { size: "default" },
  parameters: {
    docs: {
      description: {
        story: "Home uses Button default size, which keeps the filter icon at 16px.",
      },
    },
  },
};

export const Active: Story = {
  args: { activeCount: 8 },
};

export const Disabled: Story = {
  args: { activeCount: 8, disabled: true },
};
