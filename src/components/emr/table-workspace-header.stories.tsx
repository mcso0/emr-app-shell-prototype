import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent } from "storybook/test";

import { Button } from "@/components/ui/button";

import { EmrTableWorkspaceHeader } from "./table-workspace-header";

type TableWorkspaceHeaderStoryArgs = {
  countLoading: boolean;
  title: string;
};

function TableWorkspaceHeaderExample({
  countLoading,
  title,
}: TableWorkspaceHeaderStoryArgs) {
  const [searchValue, setSearchValue] = useState("");

  return (
    <div className="min-w-[1080px] bg-[#fcfcfc]">
      <EmrTableWorkspaceHeader
        count={3}
        countLoading={countLoading}
        onSearchChange={setSearchValue}
        primaryAction={<Button size="sm">+ Order</Button>}
        searchAriaLabel="오더 검색"
        searchClearAriaLabel="오더 검색어 초기화"
        searchPlaceholder="오더 검색"
        searchValue={searchValue}
        tableControls={
          <>
            <Button size="sm" variant="outline">
              기본 조건
            </Button>
            <Button size="sm" variant="outline">
              필터
            </Button>
          </>
        }
        title={title}
      />
    </div>
  );
}

const meta = {
  title: "Design System/EMR/EmrTableWorkspaceHeader",
  component: TableWorkspaceHeaderExample,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Customer와 Order처럼 제목·건수·검색·테이블 제어·주요 액션을 한 영역에서 제공하는 데이터테이블 워크스페이스 헤더입니다. 설명 문구나 카테고리 탭은 이 컴포넌트가 소유하지 않습니다.",
      },
    },
  },
  args: {
    countLoading: false,
    title: "임상병리 검사",
  },
  render: (args) => <TableWorkspaceHeaderExample {...args} />,
} satisfies Meta<TableWorkspaceHeaderStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OrderWorkspace: Story = {
  play: async ({ canvas }) => {
    const search = canvas.getByRole("textbox", { name: "오더 검색" });
    await userEvent.type(search, "CBC");
    await expect(search).toHaveValue("CBC");
    await userEvent.click(
      canvas.getByRole("button", { name: "오더 검색어 초기화" }),
    );
    await expect(search).toHaveValue("");
  },
};

export const CountLoading: Story = {
  args: {
    countLoading: true,
  },
};
