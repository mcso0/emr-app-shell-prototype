import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";

import { StorybookMcpDogfoodSearch } from "./storybook-mcp-dogfood-search";

const meta = {
  title: "Design System/Recipes/Storybook MCP Dogfood",
  component: StorybookMcpDogfoodSearch,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Dogfood recipe for verifying that an agent can query Storybook MCP documentation before composing documented Button, Input, and Badge primitives. This is a synthetic UI recipe, not a production workflow surface.",
      },
    },
  },
  argTypes: {
    initialQuery: {
      control: "text",
      description: "Initial synthetic search text used to demonstrate controlled Input composition.",
    },
    helperText: {
      control: "text",
      description:
        "Visible helper text that keeps the Input accessible without relying on placeholder text as the only label.",
    },
    disabled: {
      control: "boolean",
      description:
        "Disables the recipe controls for visual demonstration only. Permission and security enforcement stay outside Storybook.",
    },
  },
  args: {
    disabled: false,
    helperText: "Storybook MCP 문서를 조회한 뒤 허용된 props만 사용해 구성한 합성 예시입니다.",
    initialQuery: "초코",
  },
  render: (args) => <StorybookMcpDogfoodSearch key={args.initialQuery} {...args} />,
} satisfies Meta<typeof StorybookMcpDogfoodSearch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SearchFormRecipe: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A small MCP dogfood recipe that composes only documented Button, Input, and Badge props. Use this to verify the agent documentation loop before broader Storybook expansion.",
      },
    },
  },
  play: async ({ canvas }) => {
    const input = canvas.getByRole("searchbox", { name: "보호자 또는 환자 검색" });
    await expect(input).toHaveAccessibleDescription("Storybook MCP 문서를 조회한 뒤 허용된 props만 사용해 구성한 합성 예시입니다.");
    await userEvent.clear(input); await userEvent.type(input, "  예약  ");
    await userEvent.click(canvas.getByRole("button", { name: "검색" }));
    await expect(canvas.getByText("검색어: 예약")).toBeVisible();
    await userEvent.clear(input); await userEvent.type(input, "합성 검색{Enter}");
    await expect(canvas.getByText("검색어: 합성 검색")).toBeVisible();
  },
};

export const DisabledRecipe: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByRole("searchbox", { name: "보호자 또는 환자 검색" });
    const button = canvas.getByRole("button", { name: "검색" });
    await expect(input).toBeDisabled(); await expect(button).toBeDisabled();
    button.focus(); await expect(button).not.toHaveFocus(); await userEvent.keyboard("{Enter}");
    await expect(canvas.getByText("검색어: 잠금 상태")).toBeVisible();
  },
  args: {
    disabled: true,
    helperText: "비활성 상태는 시각적 affordance이며 권한 경계가 아닙니다.",
    initialQuery: "잠금 상태",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Disabled recipe state confirms the composition does not treat disabled controls as permission or server-side enforcement.",
      },
    },
  },
};
