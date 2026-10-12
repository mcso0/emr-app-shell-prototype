import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import { ChartOrderBillingDetailAside, ChartOrderFinanceFooter } from "@/features/chart/components/chart-order-finance-footer";
import type { ChartOrderBillingSummary } from "@/features/chart/chart-order-billing-summary-contract";

import { Button } from "./button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Badge } from "./badge";

type CardStoryArgs = {
  description: string;
  footer: string;
  size: "default" | "sm";
  status: string;
  title: string;
};

const summary: ChartOrderBillingSummary = {
  workspaceId: "synthetic-workspace", encounterId: "synthetic-encounter", currency: "KRW", context: null, etag: "synthetic", generatedAt: "2026-10-11T00:00:00Z", invoiceId: null,
  amounts: { confirmed: 20000, draft: 10000, estimatedTotal: 30000, gross: 30000, discount: 0, surcharge: 0, tax: 0, outstanding: 0, paid: 0, requestableTotal: 20000 },
  orderCounts: { total: 2, confirmed: 1, draft: 1, cancelled: 0, recheck: 0, requested: 0, requestable: 1 }, requestableOrderIds: ["synthetic-order"], unfinishedOrders: [],
};
function FinanceCardCaller() {
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState("요청 없음");
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, [open]);
  const props = { canRequestBilling: true, displayState: "authoritative" as const, freshness: "fresh" as const, hasAuthoritativeSummary: true, requesting: false, summary, onRequestBilling: () => setReceipt("합성 청구 이동 요청") };
  return <div className="relative h-[620px] min-w-[860px] overflow-hidden border">
    <div className="absolute inset-x-0 bottom-0"><ChartOrderFinanceFooter {...props} confirmationCounts={{ ready: 1, invalid: 0, confirmed: 1 }} drawerOpen={open}
      saveStatusText="저장됨" accessibilitySummary="선택 오더 0건 · 선택 오더 합계 0원 · 저장됨" onOpenDetails={() => setOpen((value) => !value)} /></div>
    <ChartOrderBillingDetailAside {...props} open={open} onClose={() => setOpen(false)} onRetry={() => setReceipt("합성 재조회 요청")} />
    <output className="block p-4" aria-label="합성 카드 요청">{receipt}</output>
  </div>;
}

function CardExample({
  description,
  footer,
  size,
  status,
  title,
}: CardStoryArgs) {
  const [viewed, setViewed] = useState(false);
  return (
    <Card size={size} className="max-w-md">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Badge variant="secondary">{status}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">샘플 단계</span>
            <span className="font-medium">검토</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">샘플 범위</span>
            <span className="font-medium">현재 화면</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{footer}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setViewed((value) => !value)}>
            샘플 보기
          </Button>
        </div>
      </CardFooter>
      {viewed ? <p role="status" className="px-4 pb-4">합성 상세를 표시했습니다.</p> : null}
    </Card>
  );
}

const meta = {
  title: "Design System/UI/Card",
  component: CardExample,
  tags: ["autodocs"],
  parameters: {
    docs: {
      story: { inline: false, height: "320px" },
      description: {
        component:
          "Controls의 title·description·footer·status는 CardExample의 합성 콘텐츠이며 Card props가 아닙니다. size는 Card에 전달합니다. Card는 표시를, 호출자는 데이터와 버튼 동작을 소유합니다. 샘플 보기 버튼은 이동하지 않습니다. Use Card for a bounded, repeated content item such as a compact summary, task tile, or grouped metadata surface. 사용할 때: one item needs a header, body, and optional action. 쓰지 말아야 할 때: page sections, nested cards, or decorative layout wrappers.",
      },
    },
  },
  argTypes: {
    description: {
      control: "text",
      description: "Short supporting copy under the card title.",
    },
    footer: {
      control: "text",
      description: "Small footer note for the example card.",
    },
    size: {
      control: "radio",
      options: ["default", "sm"],
      description: "Card density. Use sm for compact repeated lists.",
    },
    status: {
      control: "text",
      description: "Synthetic badge text shown in the card action slot.",
    },
    title: {
      control: "text",
      description: "Card title. Keep it scoped to one item.",
    },
  },
  args: {
    description: "한 항목의 상태와 보조 정보를 묶는 합성 예시입니다.",
    footer: "실제 환자, 보호자, 병원, 결제, 신원 정보는 사용하지 않습니다.",
    size: "default",
    status: "샘플",
    title: "샘플 업무 카드",
  },
  render: (args) => <CardExample {...args} />,
} satisfies Meta<CardStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <FinanceCardCaller />,
  play: async ({ canvas, canvasElement }) => {
    const toggle = canvas.getByRole("button", { name: "금액 상세" });
    await userEvent.click(toggle);
    await waitFor(() => expect(canvas.getByRole("complementary", { name: "Plan/Order 금액 상세" })).toBeVisible());
    await expect(canvasElement.querySelectorAll('[data-slot="card"]').length).toBeGreaterThan(0);
    await expect(canvas.getByTestId("chart-order-amount-detail-total-card")).toHaveTextContent("30,000");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.queryByRole("complementary", { name: "Plan/Order 금액 상세" })).not.toBeInTheDocument());
  },
  parameters: {
    controls: { disable: true },
    docs: { story: { height: "700px" },
      description: {
        story:
          "실제 차트 금액 상세의 Card/Content를 ChartOrderBillingDetailAside를 통해 렌더합니다. 승인된 Features/Chart/Order Finance의 SummaryAndDetails는 유지합니다. 금액만 합성이며 상세 토글·Escape와 로컬 요청 콜백을 제공합니다.",
      },
    },
  },
};

export const Small: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "샘플 보기" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("합성 상세를 표시했습니다.");
    await userEvent.click(canvas.getByRole("button", { name: "샘플 보기" }));
    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
  args: {
    description: "밀도 높은 목록에서 쓰는 작은 합성 카드입니다.",
    footer: "좁은 패널 안의 반복 항목 예시입니다.",
    size: "sm",
    status: "작게",
    title: "작은 샘플 카드",
  },
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: side panel이나 dense list에서 item 간 간격을 줄여야 할 때. 쓰지 말아야 할 때: 주요 decision surface를 지나치게 작게 만들 때.",
      },
    },
  },
};

export const ContentOnly: Story = {
  argTypes: { description: { control: false, table: { disable: true } }, status: { control: false, table: { disable: true } } },
  args: {
    description: "",
    footer: "footer 없이 content 중심으로 볼 수 있습니다.",
    status: "요약",
    title: "요약 카드",
  },
  render: (args) => (
    <Card size={args.size} className="max-w-sm">
      <CardContent>
        <div className="text-[15px] font-semibold leading-5">{args.title}</div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {args.footer}
        </p>
      </CardContent>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "사용할 때: 짧은 summary만 필요한 반복 항목. 쓰지 말아야 할 때: 제목, 설명, action hierarchy가 필요한 복잡한 항목.",
      },
    },
  },
};
