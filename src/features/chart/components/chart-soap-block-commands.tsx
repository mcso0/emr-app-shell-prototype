"use client";

import { ko } from "@blocknote/core/locales";
import {
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";

import {
  CdsCommunicationCameraIcon,
  CdsCommunicationVideoIcon,
} from "@/components/cds-icons/communication-and-media";
import {
  CdsMedicalClipboardPenIcon,
  CdsMedicalScanLineIcon,
} from "@/components/cds-icons/medical-and-domain";

import {
  createDefaultSoapBasicBlockTemplateBlocks,
  createDefaultSoapTemplateBlocks,
  createMusculoskeletalSoapBasicBlockTemplateBlocks,
  createMusculoskeletalSoapTemplateBlocks,
  type ChartSoapBlock,
  type ChartSoapBlockEditorInstance,
  type ChartSoapPartialBlock,
} from "./chart-soap-block-schema";

export type ChartSoapCommandItem = DefaultReactSuggestionItem & {
  id: string;
  shortcut?: string;
};

export type ChartSoapTemplateStructure = "sectioned" | "basic";

export type ChartSoapDisabledCommandItem = {
  id: string;
  title: string;
  reason: string;
  badge: string;
  aliases: string[];
  icon: React.ReactNode;
};

const defaultCommandOrder = [
  ko.slash_menu.paragraph.title,
  ko.slash_menu.heading.title,
  ko.slash_menu.heading_2.title,
  ko.slash_menu.heading_3.title,
  ko.slash_menu.toggle_heading.title,
  ko.slash_menu.toggle_heading_2.title,
  ko.slash_menu.toggle_heading_3.title,
  ko.slash_menu.bullet_list.title,
  ko.slash_menu.numbered_list.title,
  ko.slash_menu.check_list.title,
  ko.slash_menu.quote.title,
  ko.slash_menu.divider.title,
] as const;

const mediaCommandOrder = [
  ko.slash_menu.image.title,
  ko.slash_menu.video.title,
] as const;

const defaultCommandLabels = new Map<string, string>([
  [ko.slash_menu.paragraph.title, "텍스트"],
  [ko.slash_menu.heading.title, "제목 1"],
  [ko.slash_menu.heading_2.title, "제목 2"],
  [ko.slash_menu.heading_3.title, "제목 3"],
  [ko.slash_menu.bullet_list.title, "글머리 목록"],
  [ko.slash_menu.numbered_list.title, "번호 목록"],
  [ko.slash_menu.check_list.title, "체크 목록"],
  [ko.slash_menu.quote.title, "인용"],
  [ko.slash_menu.divider.title, "구분선"],
  [ko.slash_menu.image.title, "이미지 추가"],
  [ko.slash_menu.video.title, "동영상 추가"],
]);

function hasSoapSystem(
  editor: ChartSoapBlockEditorInstance,
  systemLabel: string,
): boolean {
  let found = false;
  editor.forEachBlock((block) => {
    if (
      (block.type === "soapSection" &&
        block.props.systemLabel === systemLabel) ||
      isBasicSoapSectionHeader(block, systemLabel)
    ) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

function isBasicSoapSectionHeader(
  block: ChartSoapBlock,
  systemLabel: string,
): boolean {
  if (block.type !== "paragraph") return false;

  const escapedSystemLabel = systemLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^(S|O|A|P)\\s+.+\\s+${escapedSystemLabel}$`,
  ).test(getBlockPlainText(block).trim());
}

function getBlockPlainText(block: ChartSoapBlock): string {
  if (!Array.isArray(block.content)) return "";

  return block.content
    .flatMap((item) => {
      if ("text" in item && typeof item.text === "string") {
        return item.text;
      }
      if ("content" in item && Array.isArray(item.content)) {
        return item.content.flatMap((child) =>
          "text" in child && typeof child.text === "string" ? child.text : "",
        );
      }
      return "";
    })
    .join("");
}

function insertSoapTemplate(
  editor: ChartSoapBlockEditorInstance,
  blocks: ChartSoapPartialBlock[],
) {
  if (!blocks.length) return;

  const cursorBlock = editor.getTextCursorPosition().block;
  let rootBlock: ChartSoapBlock = cursorBlock;
  let parentBlock = editor.getParentBlock(rootBlock);
  while (parentBlock) {
    rootBlock = parentBlock;
    parentBlock = editor.getParentBlock(rootBlock);
  }

  const cursorHasContent =
    cursorBlock.content === undefined ||
    getBlockPlainText(cursorBlock).trim().length > 0;
  let insertedBlocks: ReturnType<
    ChartSoapBlockEditorInstance["insertBlocks"]
  >;

  if (rootBlock.id === cursorBlock.id) {
    insertedBlocks = cursorHasContent
      ? editor.insertBlocks(blocks, cursorBlock, "after")
      : editor.replaceBlocks([cursorBlock], blocks).insertedBlocks;
  } else {
    if (!cursorHasContent) {
      editor.removeBlocks([cursorBlock]);
    }
    insertedBlocks = editor.insertBlocks(blocks, rootBlock, "after");
  }

  const lastInsertedBlock = insertedBlocks.at(-1);
  if (!lastInsertedBlock) return;
  const editableChild = lastInsertedBlock.children.at(0);
  editor.setTextCursorPosition(editableChild ?? lastInsertedBlock, "end");
}

export function buildSoapCommandItems({
  editor,
  onNotice,
  templateStructure = "sectioned",
}: {
  editor: ChartSoapBlockEditorInstance;
  onNotice: (message: string) => void;
  templateStructure?: ChartSoapTemplateStructure;
}): ChartSoapCommandItem[] {
  const insertTemplate = ({
    blocks,
    systemLabel,
  }: {
    blocks: ChartSoapPartialBlock[];
    systemLabel: string;
  }) => {
    if (hasSoapSystem(editor, systemLabel)) {
      onNotice(`${systemLabel} 템플릿이 이미 문서에 있습니다.`);
      return;
    }

    insertSoapTemplate(editor, blocks);
    onNotice(`${systemLabel} 템플릿을 추가했습니다.`);
  };

  const templateItems: ChartSoapCommandItem[] = [
    {
      id: "template-default-soap",
      title: "기본 SOAP 템플릿",
      subtext: "주관적·객관적·평가·계획 블록을 한 번에 추가합니다.",
      aliases: ["soap", "so", "기본", "주관적", "객관적", "평가", "계획"],
      group: "템플릿",
      icon: <CdsMedicalClipboardPenIcon size={16} />,
      onItemClick: () =>
        insertTemplate({
          blocks:
            templateStructure === "basic"
              ? createDefaultSoapBasicBlockTemplateBlocks()
              : createDefaultSoapTemplateBlocks(),
          systemLabel: "기본 SOAP",
        }),
    },
    {
      id: "template-diagnosis-system",
      title: "진단계통 SOAP 템플릿",
      subtext: "선택한 진단계통에 맞는 SOAP 구조를 추가합니다.",
      aliases: ["진단계통", "근골격", "파행", "관절", "system"],
      group: "템플릿",
      icon: <CdsMedicalScanLineIcon size={16} />,
      onItemClick: () =>
        insertTemplate({
          blocks:
            templateStructure === "basic"
              ? createMusculoskeletalSoapBasicBlockTemplateBlocks()
              : createMusculoskeletalSoapTemplateBlocks(),
          systemLabel: "근골격계",
        }),
    },
  ];

  const itemsByTitle = new Map(
    getDefaultReactSlashMenuItems(editor).map((item) => [item.title, item]),
  );
  const defaultItems = defaultCommandOrder.flatMap((title, index) => {
    const item = itemsByTitle.get(title);
    if (!item) return [];
    return [
      {
        ...item,
        id: `basic-${index}`,
        title: defaultCommandLabels.get(title) ?? item.title,
        aliases: [
          ...(item.aliases ?? []),
          title,
          defaultCommandLabels.get(title) ?? item.title,
        ],
        group: "기본 블록",
        icon: item.icon ? <span aria-hidden="true">{item.icon}</span> : undefined,
      } satisfies ChartSoapCommandItem,
    ];
  });

  const mediaItems = mediaCommandOrder.flatMap((title, index) => {
    const item = itemsByTitle.get(title);
    if (!item) return [];
    return [
      {
        ...item,
        id: `media-${index}`,
        title: defaultCommandLabels.get(title) ?? item.title,
        aliases: [
          ...(item.aliases ?? []),
          title,
          defaultCommandLabels.get(title) ?? item.title,
        ],
        group: "미디어",
        icon:
          title === ko.slash_menu.image.title ? (
            <CdsCommunicationCameraIcon size={16} />
          ) : (
            <CdsCommunicationVideoIcon size={16} />
          ),
      } satisfies ChartSoapCommandItem,
    ];
  });

  return [...templateItems, ...defaultItems, ...mediaItems];
}

export const soapDisabledCommandItems: ChartSoapDisabledCommandItem[] = [
  {
    id: "media-optical",
    title: "광학검사 불러오기",
    reason: "권한이 있는 연결 장치와 검사 결과가 있을 때 사용할 수 있습니다.",
    aliases: ["광학", "검사", "device", "optical"],
    badge: "장치 필요",
    icon: <CdsMedicalScanLineIcon size={16} />,
  },
];
