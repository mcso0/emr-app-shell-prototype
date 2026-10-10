import type { Meta, StoryObj } from "@storybook/nextjs-vite";

function Overview() {
  return <main className="mx-auto max-w-5xl space-y-6 p-6 text-foreground">
    <h1 className="emr-text-dialog-title font-semibold">CLAiR EMR · UI 역할과 검토 상태</h1>
    <p className="emr-text-body">공통 UI와 기능 화면의 책임을 설명합니다. 실제 데이터·권한·저장은 기능이 담당합니다.</p>
    <section className="space-y-2 rounded-lg border border-border p-4" aria-label="역할과 소유자">
      <h2 className="emr-text-panel-title font-semibold">누가 무엇을 담당하나요?</h2>
      <p className="emr-text-body">소유자는 담당자 이름이 아니라 변경을 책임지는 코드 영역입니다.</p>
      <ul className="list-disc space-y-1 pl-5 emr-text-body">
        <li>기본 UI: 버튼·입력창의 기본 동작과 접근성.</li>
        <li>공통 EMR UI: 업무 표·환자 정보·패널의 공통 표현.</li>
        <li>기능 UI: 실제 데이터·업무 판단·권한·저장·화면별 내용.</li>
        <li>앱 셸: 내비게이션·업무 탭·패널 배치와 본문 폭.</li>
      </ul>
      <p className="emr-text-body">고객 목록 헤더는 공통 헤더에 고객용 문구를 연결합니다. 프로필도 공통 틀과 기능별 내용으로 나뉩니다.</p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Targets the Storybook manager, not a Next.js page. */}
      <p className="emr-text-body"><a className="underline" target="_top" href="/?path=/story/design-system-emr-profile-panel--patient">공통 프로필 틀</a>{" · "}<a className="underline" target="_top" href="/?path=/story/features-customer-patient-guardian-profile-side-panel--patient-information">환자·보호자 프로필 내용</a></p>
      <p className="emr-text-body">역할 분류는 코드를 이해하기 위한 안내입니다. 업무 패턴·화면 템플릿은 Storybook 조립 예제이며, 제품 코드가 반드시 거치는 단계는 아닙니다.</p>
    </section>
    <section className="space-y-2 rounded-lg border border-border p-4" aria-label="검토 상태 읽는 법">
      <h2 className="emr-text-panel-title font-semibold">사용 중·검증 통과·사용자 승인은 서로 다릅니다</h2>
      <p className="emr-text-body">제품 사용: 실제 화면에서 가져다 쓰는지 확인합니다. 자동 검증: 실행한 검사와 통과 범위를 기록합니다. 사용자 승인: 승욱이 확인한 모양과 동작의 범위만 기록합니다.</p>
      <p className="emr-text-body">전체 v1 사용자 승인 여부와 이번 변경의 검증 결과는 별개입니다. 이번 PR은 기존 제품 UI의 역할 설명·프로필 분류·대기열 정보 분리를 담습니다. 이전 v1 기반과 조립 예제 작업은 포함하지 않습니다.</p>
      <p className="emr-text-metadata text-muted-foreground">항목별 상태: component-ownership-rules.md · 이번 실행 결과: CLINICAL-FULFILLMENT-PR-011 작업 기록. 환자 대기열은 업무 규칙용 정보와 카드 표시용 정보를 분리했습니다. 추가 구조 변경은 보류합니다.</p>
    </section>
  </main>;
}

const meta = {
  title: "Design System/Overview",
  component: Overview,
  tags: ["autodocs"],
  args: {},
  parameters: { docs: { description: { component: "Independent UI responsibility and review map. Owner: docs/design/system/component-ownership-rules.md. Product usage, automated checks and human acceptance are separate. No production data or workflow operations." } } },
} satisfies Meta<typeof Overview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Structure: Story = {};
