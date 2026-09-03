import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";

import { createLegacySoapDocumentInput } from "@/features/chart/chart-soap-document";
import type { SoapNote } from "@/types/emr-domain";

export const soapSectionKinds = [
  "subjective",
  "objective",
  "assessment",
  "plan",
] as const;

export type SoapSectionKind = (typeof soapSectionKinds)[number];

const sectionCode: Record<SoapSectionKind, string> = {
  subjective: "S",
  objective: "O",
  assessment: "A",
  plan: "P",
};

const soapSectionBlock = createReactBlockSpec(
  {
    type: "soapSection",
    propSchema: {
      kind: {
        default: "subjective",
        values: soapSectionKinds,
      },
      label: {
        default: "주관적",
      },
      systemLabel: {
        default: "기본 SOAP",
      },
      scope: {
        default: "default",
        values: ["default", "system"] as const,
      },
    },
    content: "none",
  },
  {
    render: ({ block }) => (
      <div
        className="chart-soap-section-marker"
        data-soap-kind={block.props.kind}
        data-soap-system={block.props.systemLabel}
        data-soap-scope={block.props.scope}
        contentEditable={false}
      >
        <span className="chart-soap-section-code" aria-hidden="true">
          {sectionCode[block.props.kind]}
        </span>
        <span className="chart-soap-section-copy">
          <strong>{block.props.label}</strong>
          <span>{block.props.systemLabel}</span>
        </span>
      </div>
    ),
  },
);

export const chartSoapBlockSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    quote: defaultBlockSpecs.quote,
    divider: defaultBlockSpecs.divider,
    image: defaultBlockSpecs.image,
    video: defaultBlockSpecs.video,
    soapSection: soapSectionBlock(),
  },
});

export type ChartSoapBlock = typeof chartSoapBlockSchema.Block;
export type ChartSoapPartialBlock = typeof chartSoapBlockSchema.PartialBlock;
export type ChartSoapBlockEditorInstance =
  typeof chartSoapBlockSchema.BlockNoteEditor;

function createSectionBlock({
  content,
  kind,
  label,
  systemLabel,
  scope,
}: {
  content: string;
  kind: SoapSectionKind;
  label: string;
  systemLabel: string;
  scope: "default" | "system";
}): ChartSoapPartialBlock {
  return {
    type: "soapSection",
    props: {
      kind,
      label,
      systemLabel,
      scope,
    },
    children: [
      {
        type: "paragraph",
        content,
      },
    ],
  };
}

function createBasicSectionBlocks({
  content,
  kind,
  label,
  systemLabel,
}: {
  content: string;
  kind: SoapSectionKind;
  label: string;
  systemLabel: string;
}): ChartSoapPartialBlock[] {
  return [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: `${sectionCode[kind]}  `,
          styles: { bold: true },
        },
        {
          type: "text",
          text: label,
          styles: { bold: true },
        },
        {
          type: "text",
          text: `  ${systemLabel}`,
          styles: {},
        },
      ],
    },
    {
      type: "paragraph",
      content,
    },
  ];
}

export function createDefaultSoapTemplateBlocks(
  withSampleContent = false,
): ChartSoapPartialBlock[] {
  return [
    createSectionBlock({
      content: withSampleContent
        ? "어제 저녁부터 오른쪽 앞다리를 들고 걸어요. 식욕은 평소와 같아요."
        : "",
      kind: "subjective",
      label: "주관적 · 보호자 진술",
      systemLabel: "기본 SOAP",
      scope: "default",
    }),
    createSectionBlock({
      content: withSampleContent
        ? "우측 전지 촉진 시 경미한 통증 반응. 체온 38.6°C, 체중 4.2kg."
        : "",
      kind: "objective",
      label: "객관적 · 신체검사 소견",
      systemLabel: "기본 SOAP",
      scope: "default",
    }),
    createSectionBlock({
      content: withSampleContent
        ? "연부조직 손상 의심. 골절 가능성은 낮으나 영상검사로 배제 필요."
        : "",
      kind: "assessment",
      label: "평가 · 임상 판단",
      systemLabel: "기본 SOAP",
      scope: "default",
    }),
    createSectionBlock({
      content: withSampleContent
        ? "통증 조절 후 3일간 활동 제한. 증상 지속 시 방사선 검사 진행."
        : "",
      kind: "plan",
      label: "계획 · 치료 및 추적",
      systemLabel: "기본 SOAP",
      scope: "default",
    }),
  ];
}

export function createSystemSoapTemplateBlocks(
  systemLabel: string,
): ChartSoapPartialBlock[] {
  return [
    createSectionBlock({
      content: "",
      kind: "subjective",
      label: "주관적 · 보호자 진술",
      systemLabel,
      scope: "system",
    }),
    createSectionBlock({
      content: "",
      kind: "objective",
      label: "객관적 · 신체검사 소견",
      systemLabel,
      scope: "system",
    }),
    createSectionBlock({
      content: "",
      kind: "assessment",
      label: "평가 · 임상 판단",
      systemLabel,
      scope: "system",
    }),
    createSectionBlock({
      content: "",
      kind: "plan",
      label: "계획 · 치료 및 추적",
      systemLabel,
      scope: "system",
    }),
  ];
}

export function createDefaultSoapBasicBlockTemplateBlocks(
  withSampleContent = false,
): ChartSoapPartialBlock[] {
  return [
    ...createBasicSectionBlocks({
      content: withSampleContent
        ? "어제 저녁부터 오른쪽 앞다리를 들고 걸어요. 식욕은 평소와 같아요."
        : "",
      kind: "subjective",
      label: "주관적 · 보호자 진술",
      systemLabel: "기본 SOAP",
    }),
    ...createBasicSectionBlocks({
      content: withSampleContent
        ? "우측 전지 촉진 시 경미한 통증 반응. 체온 38.6°C, 체중 4.2kg."
        : "",
      kind: "objective",
      label: "객관적 · 신체검사 소견",
      systemLabel: "기본 SOAP",
    }),
    ...createBasicSectionBlocks({
      content: withSampleContent
        ? "연부조직 손상 의심. 골절 가능성은 낮으나 영상검사로 배제 필요."
        : "",
      kind: "assessment",
      label: "평가 · 임상 판단",
      systemLabel: "기본 SOAP",
    }),
    ...createBasicSectionBlocks({
      content: withSampleContent
        ? "통증 조절 후 3일간 활동 제한. 증상 지속 시 방사선 검사 진행."
        : "",
      kind: "plan",
      label: "계획 · 치료 및 추적",
      systemLabel: "기본 SOAP",
    }),
  ];
}

export function createMusculoskeletalSoapTemplateBlocks(): ChartSoapPartialBlock[] {
  return [
    createSectionBlock({
      content: "파행 시작 시점, 외상 여부, 통증 양상, 활동 변화",
      kind: "subjective",
      label: "주관적 · 파행 문진",
      systemLabel: "근골격계",
      scope: "system",
    }),
    createSectionBlock({
      content: "보행 평가, 관절 가동 범위, 촉진 통증, 부종 및 좌우 대칭",
      kind: "objective",
      label: "객관적 · 근골격 검사",
      systemLabel: "근골격계",
      scope: "system",
    }),
    createSectionBlock({
      content: "문제 목록과 감별 진단",
      kind: "assessment",
      label: "평가 · 감별 진단",
      systemLabel: "근골격계",
      scope: "system",
    }),
    createSectionBlock({
      content: "영상검사, 통증 조절, 활동 제한 및 재검 계획",
      kind: "plan",
      label: "계획 · 검사 및 처치",
      systemLabel: "근골격계",
      scope: "system",
    }),
  ];
}

export function createMusculoskeletalSoapBasicBlockTemplateBlocks(): ChartSoapPartialBlock[] {
  return [
    ...createBasicSectionBlocks({
      content: "파행 시작 시점, 외상 여부, 통증 양상, 활동 변화",
      kind: "subjective",
      label: "주관적 · 파행 문진",
      systemLabel: "근골격계",
    }),
    ...createBasicSectionBlocks({
      content: "보행 평가, 관절 가동 범위, 촉진 통증, 부종 및 좌우 대칭",
      kind: "objective",
      label: "객관적 · 근골격 검사",
      systemLabel: "근골격계",
    }),
    ...createBasicSectionBlocks({
      content: "문제 목록과 감별 진단",
      kind: "assessment",
      label: "평가 · 감별 진단",
      systemLabel: "근골격계",
    }),
    ...createBasicSectionBlocks({
      content: "영상검사, 통증 조절, 활동 제한 및 재검 계획",
      kind: "plan",
      label: "계획 · 검사 및 처치",
      systemLabel: "근골격계",
    }),
  ];
}

export function createLegacySoapTemplateBlocks(
  soapNote?: Pick<SoapNote, "subjective" | "objective" | "assessment" | "plan"> | null,
): ChartSoapPartialBlock[] {
  return createLegacySoapDocumentInput(soapNote) as ChartSoapPartialBlock[];
}
