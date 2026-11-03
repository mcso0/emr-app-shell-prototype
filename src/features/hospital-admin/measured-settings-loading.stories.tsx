import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import { HospitalBasicInformationLoading } from "./settings/hospital-basic-settings-screen";
import { SpaceManagementLoading } from "./space-management/screen";

function Example({ width = 840, spaces = false }: { width?: number; spaces?: boolean }) {
  return <div style={{ width, maxWidth: "100%" }}>{spaces ? <SpaceManagementLoading /> : <HospitalBasicInformationLoading />}</div>;
}
const meta = { title: "Features/Hospital Admin/Measured Settings Loading", component: Example, tags: ["autodocs"], parameters: { docs: { description: { component: "병원 기본 정보와 공간 목록의 실제 초기 조회 표현입니다. 가상 표시 데이터만 측정하며 로고 업로드, 변경 요청, 공간 편집기는 마운트하지 않습니다." } } } } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
const check: Story["play"] = async ({ canvasElement }) => {
  await waitFor(() => expect(canvasElement.querySelector('[inert]')).not.toBeNull());
  expect(canvasElement.querySelector('input, textarea, [type="file"]')).toBeNull();
  expect(canvasElement.scrollWidth).toBeLessThanOrEqual(canvasElement.clientWidth);
};
export const Hospital: Story = { play: check };
export const Spaces: Story = { args: { spaces: true }, play: check };
export const NarrowHospital: Story = { args: { width: 360 }, play: check };
export const NarrowSpaces: Story = { args: { width: 360, spaces: true }, play: check };
