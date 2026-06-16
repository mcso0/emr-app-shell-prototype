import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

type TableStoryArgs = {
  density: "compact" | "standard" | "comfortable";
  layout: "fill" | "scroll";
  minWidth: number;
  showCaption: boolean;
};

const sampleRows = [
  { area: "접수", owner: "샘플 팀", status: "대기", time: "09:10" },
  { area: "진료", owner: "샘플 담당", status: "진행", time: "09:40" },
  { area: "수납", owner: "샘플 데스크", status: "준비", time: "10:05" },
];

function TableExample({ density, layout, minWidth, showCaption }: TableStoryArgs) {
  return (
    <Table density={density} layout={layout} minWidth={layout === "scroll" ? minWidth : undefined}>
      {showCaption ? (
        <TableCaption>합성 업무 흐름만 보여주는 샘플 테이블입니다.</TableCaption>
      ) : null}
      <TableHeader>
        <TableRow>
          <TableHead>영역</TableHead>
          <TableHead>담당</TableHead>
          <TableHead>상태</TableHead>
          <TableHead className="text-right">예정</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sampleRows.map((row) => (
          <TableRow key={row.area}>
            <TableCell className="font-medium">{row.area}</TableCell>
            <TableCell>{row.owner}</TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell className="text-right">{row.time}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>샘플 합계</TableCell>
          <TableCell className="text-right">{sampleRows.length}건</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

const meta = {
  title: "Design System/UI/Table",
  component: TableExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Use Table for structured row and column data that must support scanning, comparison, density, and horizontal overflow. 사용할 때: each row shares the same column contract. 쓰지 말아야 할 때: freeform cards, forms, or queue items whose layout differs per item.",
      },
    },
  },
  argTypes: {
    density: {
      control: "radio",
      options: ["compact", "standard", "comfortable"],
      description: "EMR table density token.",
    },
    layout: {
      control: "radio",
      options: ["fill", "scroll"],
      description: "Whether the table fills the container or keeps a scroll min-width.",
    },
    minWidth: {
      control: { type: "number", min: 480, max: 1200 },
      description: "Minimum table width used when layout is scroll.",
    },
    showCaption: {
      control: "boolean",
      description: "Whether to render a table caption.",
    },
  },
  args: {
    density: "standard",
    layout: "fill",
    minWidth: 720,
    showCaption: true,
  },
  render: (args) => <TableExample {...args} />,
} satisfies Meta<TableStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 같은 column 구조를 가진 업무 목록을 비교할 때. 쓰지 말아야 할 때: 각 항목이 서로 다른 상세 UI를 가져야 하는 카드 목록.",
      },
    },
  },
};

export const Compact: Story = {
  args: {
    density: "compact",
    showCaption: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: dense operational queue에서 더 많은 행을 보여줄 때. 쓰지 말아야 할 때: 행 안의 텍스트가 줄바꿈 없이 잘려 의미를 잃을 때.",
      },
    },
  },
};

export const ScrollLayout: Story = {
  args: {
    layout: "scroll",
    minWidth: 840,
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: column 수가 많아 최소 너비를 유지해야 할 때. 쓰지 말아야 할 때: 작은 표를 불필요하게 가로 스크롤로 숨길 때.",
      },
    },
  },
};

export const EmptyRows: Story = {
  render: (args) => (
    <Table density={args.density} layout={args.layout}>
      <TableHeader>
        <TableRow>
          <TableHead>영역</TableHead>
          <TableHead>상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
            조건에 맞는 샘플 행이 없습니다.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: table 구조는 유지하면서 현재 조건의 행이 없음을 보여줄 때. 쓰지 말아야 할 때: read failure나 permission blocker를 단순 빈 행처럼 표현할 때.",
      },
    },
  },
};
