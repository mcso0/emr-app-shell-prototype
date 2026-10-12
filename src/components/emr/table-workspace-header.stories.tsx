import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import { ActualCustomerTable, customerCallerParameters, prepareCustomerCaller, verifyCustomerHeader } from "./customer-caller.stories.fixture";

type HeaderArgs = { countLoading: boolean; title: string };
const meta = {
  title: "Design System/EMR/EmrTableWorkspaceHeader",
  component: ActualCustomerTable,
  tags: ["autodocs"],
  beforeEach: prepareCustomerCaller,
  parameters: {
    ...customerCallerParameters,
    layout: "fullscreen",
    docs: { story: { inline: false, height: "740px" }, description: { component: "Actual exported CustomerDataTable renders CustomerListHeader→EmrTableWorkspaceHeader. Source owns title/count/search/filter/density/column and registration menus. Synthetic domain rows use actual customer factories. Query/layout/fetch/toasts restore after each isolated story; API requests fail locally and the registered Kakao mock prevents external provider activity. Existing OrderWorkspace ID is retained; its displayed name identifies the actual caller." } },
  },
  args: { countLoading: false, title: "동물" },
  argTypes: { countLoading: { control: "boolean", description: "Initial source read: loading with no rows. Populated background refresh does not show skeletons." }, title: { control: "text" } },
  render: args => <ActualCustomerTable title={args.title} loading={args.countLoading} />,
} satisfies Meta<HeaderArgs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OrderWorkspace: Story = { name: "Customer caller", play: async ({ canvasElement }) => verifyCustomerHeader(canvasElement) };
export const CountLoading: Story = {
  args: { countLoading: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByTestId("customer-page-header-count-skeleton")).toBeVisible();
    await expect(canvasElement.querySelectorAll('[data-emr-data-table-skeleton-row="true"]').length).toBeGreaterThan(0);
    await expect(within(canvasElement).queryByTestId("header-customer-row-header-patient-a")).not.toBeInTheDocument();
  },
};
