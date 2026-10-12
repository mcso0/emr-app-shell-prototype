import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import { AnimalPatientAvatar } from "@/components/emr/animal-patient-avatar";

import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "./avatar";

const syntheticImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#64748b"/><circle cx="20" cy="16" r="7" fill="#fff"/><path d="M7 38a13 13 0 0 1 26 0" fill="#fff"/></svg>')}`;

const meta = {
  title: "Design System/UI/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "작은 대상을 이미지 또는 대체 문자로 구분합니다. Avatar가 크기·모양·이미지 실패 시 대체 표시를 소유합니다. 대상 이름과 상태의 의미는 호출자가 소유합니다. 동물 환자의 상세 표현에는 EmrAnimalPatientAvatar를 사용하세요. 아래 그림은 코드에 포함된 합성 SVG이며 외부 이미지 요청을 보내지 않습니다.",
      },
    },
  },
  args: { size: "default", roundness: "round", role: "img", "aria-label": "합성 사용자" },
  argTypes: {
    size: { control: "radio", options: ["sm", "default", "lg"], description: "Supported avatar size." },
    roundness: { control: "radio", options: ["round", "roundrect"], description: "Circular or rounded-rectangle shape." },
  },
  render: (args) => <Avatar {...args}><AvatarFallback>샘</AvatarFallback></Avatar>,
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fallback: Story = {
  render: () => <AnimalPatientAvatar alt="합성 환자" size="table" src={null} />,
  parameters: { controls: { disable: true }, docs: { description: { story: "실제 환자 테이블의 AnimalPatientAvatar입니다. 원본의 28px 크기·사각 모양·동물 아이콘과 이미지 미등록 설명을 유지합니다." } } },
  play: async ({ canvas }) => { await expect(canvas.getByRole("img", { name: "합성 환자 · 이미지 미등록" })).toHaveAttribute("data-avatar-state", "fallback"); },
};
export const Image: Story = {
  parameters: { docs: { description: { story: "외부 요청 없이 내장 합성 SVG가 로드되는 상태입니다." } } },
  render: (args) => <Avatar {...args}><AvatarImage src={syntheticImage} alt="" /><AvatarFallback>샘</AvatarFallback></Avatar>,
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const image = canvasElement.querySelector<HTMLImageElement>("img");
      expect(image?.complete).toBe(true); expect(image?.naturalWidth).toBeGreaterThan(0);
    });
  },
};
export const ImageFailure: Story = {
  parameters: { docs: { description: { story: "잘못된 내장 이미지의 대체 문자를 확인합니다." } } },
  render: (args) => <Avatar {...args}><AvatarImage src="data:image/png;base64,broken" alt="" /><AvatarFallback>샘</AvatarFallback></Avatar>,
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const fallback = canvasElement.querySelector<HTMLElement>('[data-slot="avatar-fallback"]');
      expect(fallback).toHaveTextContent("샘"); expect(fallback).toBeVisible();
    });
  },
};
export const SizesAndShapes: Story = {
  parameters: { controls: { disable: true }, docs: { description: { story: "Avatar 자체의 세 크기와 두 모양 API를 비교합니다." } } },
  render: () => <div className="flex gap-4">{(["round", "roundrect"] as const).flatMap((roundness) => (["sm", "default", "lg"] as const).map((size) => <Avatar key={`${roundness}-${size}`} roundness={roundness} size={size} role="img" aria-label={`합성 ${roundness} ${size}`}><AvatarFallback>샘</AvatarFallback></Avatar>))}</div>,
};
export const Group: Story = {
  parameters: { controls: { disable: true }, docs: { description: { story: "묶음·추가 인원·상태 배지 API 조합입니다. 현재 제품에 AvatarGroup 호출자는 없으며 실제 접속 상태를 표현하지 않습니다." } } },
  render: () => (
    <AvatarGroup role="group" aria-label="합성 사용자 묶음">
      <Avatar role="img" aria-label="합성 사용자 A"><AvatarFallback>A</AvatarFallback><AvatarBadge aria-label="합성 활성 상태" /></Avatar>
      <Avatar role="img" aria-label="합성 사용자 B"><AvatarFallback>B</AvatarFallback></Avatar>
      <AvatarGroupCount aria-label="추가 합성 사용자 2명">+2</AvatarGroupCount>
    </AvatarGroup>
  ),
};
