import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  AnimalPatientAvatar,
  type AnimalPatientAvatarProps,
} from "./animal-patient-avatar";

const meta = {
  title: "Design System/EMR/AnimalPatientAvatar",
  component: AnimalPatientAvatar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "동물 환자 전용 정사각형 프로필 컴포넌트입니다. 이미지 저장이나 등록 흐름을 소유하지 않으며, 전달된 URL의 성공·로딩·오류·미등록 상태만 일관되게 표현합니다.",
      },
    },
  },
  argTypes: {
    size: { control: "inline-radio", options: ["table", "sm", "md", "lg"] },
    state: { control: "inline-radio", options: ["ready", "loading", "error"] },
    src: { control: "text" },
  },
  args: {
    alt: "샘플 동물 환자 프로필",
    size: "lg",
    state: "ready",
    src: "/avatars/patient-avatar-choco.png",
  },
  render: (args) => <AnimalPatientAvatar {...args} />,
} satisfies Meta<AnimalPatientAvatarProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Image: Story = {};

export const Fallback: Story = {
  args: { src: null },
};

export const Loading: Story = {
  args: { state: "loading" },
};

export const Error: Story = {
  args: { state: "error" },
};

export const SizeScale: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      <AnimalPatientAvatar alt="테이블 동물 환자 프로필" size="table" />
      <AnimalPatientAvatar alt="소형 동물 환자 프로필" size="sm" />
      <AnimalPatientAvatar alt="중형 동물 환자 프로필" size="md" />
      <AnimalPatientAvatar alt="대형 동물 환자 프로필" size="lg" />
    </div>
  ),
};
