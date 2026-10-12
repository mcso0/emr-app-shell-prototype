import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { Toaster } from "@/components/ui/sonner";
import { FulfillmentWorkLifecycleAction } from "./work-lifecycle-action";
import type { FulfillmentWorkItemStatus } from "../server-fulfillment-work-item-core";
const staff = [{ userId: "synthetic-a", displayName: "합성 담당 A" }, { userId: "synthetic-b", displayName: "합성 담당 B" }];
function Example({ initialStatus = "requested", initialOwner = null, canManage = true, assignmentOnly = false }: {
  initialStatus?: FulfillmentWorkItemStatus; initialOwner?: string | null; canManage?: boolean; assignmentOnly?: boolean;
}) {
  const [owner, setOwner] = useState(initialOwner);
  const [status, setStatus] = useState(initialStatus);
  return <div className="flex items-center gap-2 p-6"><Toaster /><FulfillmentWorkLifecycleAction
    activityLabel={assignmentOnly ? "수납" : "검사"} completeLabel="검사완료" status={status}
    assignedToUserId={owner} assignedToDisplayName={staff.find(x => x.userId === owner)?.displayName}
    canManage={canManage} assignmentOnly={assignmentOnly} loadEligibleAssignees={() => Promise.resolve(staff)}
    onTransition={async (action, options) => {
      if (action === "claim") setOwner(staff[0].userId);
      if (action === "assign" || action === "handoff") setOwner(options?.assignedToUserId ?? null);
      if (action === "unassign") setOwner(null);
      if (action === "start") setStatus("in_progress");
      if (action === "complete") setStatus("completed");
      return true;
    }} /></div>;
}
const meta = { title: "Fulfillment/Current assignee actions", component: Example, parameters: { layout: "centered" } } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unassigned: Story = { play: async ({ canvasElement }) => {
 const canvas = within(canvasElement);
 await userEvent.click(canvas.getByRole("button", { name: "담당하기" }));
 await expect(canvas.findByRole("button", { name: "검사 시작" })).resolves.toBeEnabled();
 await expect(canvas.getByRole("button", { name: /담당자.*변경/ })).toBeEnabled();
} };
export const Assigned: Story = { args: { initialOwner: "synthetic-a" } };
export const OtherOwner: Story = { args: { initialOwner: "synthetic-b", canManage: false }, play: async ({ canvasElement }) => {
 await expect(within(canvasElement).getByRole("button", { name: "검사 시작" })).toBeDisabled();
} };
export const InProgress: Story = { args: { initialOwner: "synthetic-a", initialStatus: "in_progress" } };
export const Billing: Story = { args: { initialOwner: "synthetic-a", assignmentOnly: true } };
