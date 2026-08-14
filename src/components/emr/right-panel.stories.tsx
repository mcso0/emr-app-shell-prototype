import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { EmrRightPanelHeader } from "./right-panel-header";
import {
  EmrRightPanel,
  EmrRightPanelBody,
  EmrRightPanelFooter,
  type EmrRightPanelFooterSize,
} from "./right-panel";

type EmrRightPanelStoryArgs = {
  footerSize?: EmrRightPanelFooterSize;
  longBody?: boolean;
};

function EmrRightPanelExample({
  footerSize,
  longBody = false,
}: EmrRightPanelStoryArgs) {
  return (
    <div className="h-[480px] w-[380px] overflow-hidden rounded-lg border border-border">
      <EmrRightPanel
        header={
          <EmrRightPanelHeader className="border-b">
            <h2 className="emr-text-body font-semibold">패널 제목</h2>
          </EmrRightPanelHeader>
        }
      >
        <EmrRightPanelBody>
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid gap-3 p-4">
              {Array.from({ length: longBody ? 24 : 4 }, (_, index) => (
                <div key={index} className="rounded-md border bg-card p-3">
                  본문 항목 {index + 1}
                </div>
              ))}
            </div>
          </ScrollArea>
        </EmrRightPanelBody>
        {footerSize === "compact" ? (
          <EmrRightPanelFooter
            size="compact"
            className="grid grid-cols-2 gap-2 p-3"
          >
            <Button size="sm" variant="outline">
              취소
            </Button>
            <Button size="sm">저장</Button>
          </EmrRightPanelFooter>
        ) : footerSize === "single" ? (
          <EmrRightPanelFooter
            size="single"
            className="flex items-center justify-end gap-2 p-4"
          >
            <Button variant="ghost">취소</Button>
            <Button>저장</Button>
          </EmrRightPanelFooter>
        ) : footerSize === "stacked" ? (
          <EmrRightPanelFooter size="stacked" className="grid gap-2 p-4">
            <Button className="w-full">수납 진행</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary">수납 완료</Button>
              <Button variant="outline">미납 처리</Button>
            </div>
          </EmrRightPanelFooter>
        ) : null}
      </EmrRightPanel>
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrRightPanel",
  component: EmrRightPanelExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use EmrRightPanel for the workspace right-panel interior. It requires a shared header and one fluid body; use a footer only when the workflow has persistent actions. Do not use it for overlay drawers, content asides, or profile-specific panels.",
      },
    },
  },
} satisfies Meta<EmrRightPanelStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoFooter: Story = {};

export const CompactFooter: Story = {
  args: {
    footerSize: "compact",
  },
};

export const SingleFooter: Story = {
  args: {
    footerSize: "single",
  },
};

export const StackedFooter: Story = {
  args: {
    footerSize: "stacked",
  },
};

export const LongBody: Story = {
  args: {
    footerSize: "single",
    longBody: true,
  },
};
