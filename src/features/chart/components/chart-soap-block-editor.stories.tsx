import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { ChartSoapBlockEditor } from "./chart-soap-block-editor";

const meta = {
  title: "Features/Chart/SOAP/BlockNote prototype",
  component: ChartSoapBlockEditor,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "실제 @blocknote/shadcn 기본 UI에 CLAiR 토큰과 SOAP 템플릿 명령만 추가한 인터랙티브 시안입니다. 네트워크나 임상 데이터 저장은 수행하지 않습니다.",
      },
    },
  },
  decorators: [
    (Story) => (
      <main className="min-h-screen bg-[var(--emr-surface-content-panel)] p-6">
        <Story />
      </main>
    ),
  ],
} satisfies Meta<typeof ChartSoapBlockEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RepresentativeReview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole("region", { name: "BlockNote SOAP 편집기 시안" }),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "문서 JSON 보기" }));
    await expect(
      canvas.getByRole("complementary", { name: "SOAP 문서 JSON" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "빈 문서" }));
    await expect(
      canvas.getByText("빈 문서로 초기화했습니다. / 또는 왼쪽 +로 템플릿을 추가해 보세요."),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "샘플 복원" }));
    await expect(canvas.getByText("기본 SOAP 샘플을 복원했습니다.")).toBeVisible();
  },
};
