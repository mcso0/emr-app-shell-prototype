import type { SoapBlockDocument, SoapNote } from "@/types/emr-domain";

export const SOAP_BLOCK_DOCUMENT_SCHEMA_VERSION = 1 as const;
export const SOAP_BLOCK_DOCUMENT_MAX_BYTES = 256 * 1024;
export const SOAP_BLOCK_DOCUMENT_MAX_BLOCKS = 400;
export const SOAP_BLOCK_DOCUMENT_MAX_DEPTH = 4;
export const SOAP_BLOCK_DOCUMENT_MAX_FIELD_LENGTH = 10_000;

export const soapDocumentFieldKinds = [
  "subjective",
  "objective",
  "assessment",
  "plan",
] as const;

export type SoapDocumentFieldKind = (typeof soapDocumentFieldKinds)[number];

export type SoapDocumentProjection = Record<SoapDocumentFieldKind, string>;

export type SoapDocumentValidationError =
  | "invalid_document"
  | "unsupported_schema_version"
  | "document_too_large"
  | "too_many_blocks"
  | "block_depth_exceeded"
  | "duplicate_block_id"
  | "unsupported_block"
  | "invalid_block"
  | "invalid_inline_content"
  | "invalid_link"
  | "duplicate_default_section"
  | "field_too_long";

export type SoapDocumentValidationResult =
  | {
      ok: true;
      document: SoapBlockDocument;
      projection: SoapDocumentProjection;
      blockCount: number;
    }
  | {
      ok: false;
      error: SoapDocumentValidationError;
      field?: SoapDocumentFieldKind;
    };

type UnknownRecord = Record<string, unknown>;

const supportedBlockTypes = new Set([
  "soapSection",
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
  "divider",
]);

const inlineBlockTypes = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
]);

const booleanStyleKeys = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
]);

const colorStyleKeys = new Set(["textColor", "backgroundColor"]);

const forbiddenLinkCharacters =
  /[\u0000-\u0020\u007f-\u009f\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/u;

export function validateAndProjectSoapDocument(
  value: unknown,
): SoapDocumentValidationResult {
  if (!isRecord(value) || value.schemaVersion !== SOAP_BLOCK_DOCUMENT_SCHEMA_VERSION) {
    return isRecord(value) && "schemaVersion" in value
      ? { ok: false, error: "unsupported_schema_version" }
      : { ok: false, error: "invalid_document" };
  }

  if (!Array.isArray(value.blocks) || value.blocks.length === 0) {
    return { ok: false, error: "invalid_document" };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { ok: false, error: "invalid_document" };
  }
  if (new TextEncoder().encode(serialized).byteLength > SOAP_BLOCK_DOCUMENT_MAX_BYTES) {
    return { ok: false, error: "document_too_large" };
  }

  const ids = new Set<string>();
  const defaultSections = new Set<SoapDocumentFieldKind>();
  const projectionParts: Record<SoapDocumentFieldKind, string[]> = {
    subjective: [],
    objective: [],
    assessment: [],
    plan: [],
  };
  let blockCount = 0;

  const visitBlocks = (
    blocks: unknown[],
    depth: number,
    projectionTarget?: SoapDocumentFieldKind,
  ): SoapDocumentValidationResult | null => {
    if (depth > SOAP_BLOCK_DOCUMENT_MAX_DEPTH) {
      return { ok: false, error: "block_depth_exceeded" };
    }

    for (const valueBlock of blocks) {
      blockCount += 1;
      if (blockCount > SOAP_BLOCK_DOCUMENT_MAX_BLOCKS) {
        return { ok: false, error: "too_many_blocks" };
      }
      if (!isRecord(valueBlock)) return { ok: false, error: "invalid_block" };

      const id = valueBlock.id;
      const type = valueBlock.type;
      const props = valueBlock.props;
      const children = valueBlock.children;

      if (
        typeof id !== "string" ||
        !trimSoapBoundaryWhitespace(id) ||
        countUnicodeCodePoints(id) > 200
      ) {
        return { ok: false, error: "invalid_block" };
      }
      if (ids.has(id)) return { ok: false, error: "duplicate_block_id" };
      ids.add(id);

      if (typeof type !== "string" || !supportedBlockTypes.has(type)) {
        return { ok: false, error: "unsupported_block" };
      }
      if (!isRecord(props) || !validateBlockProps(type, props)) {
        return { ok: false, error: "invalid_block" };
      }
      if (!Array.isArray(children)) return { ok: false, error: "invalid_block" };

      let nextProjectionTarget = projectionTarget;
      if (type === "soapSection") {
        if (depth !== 0) return { ok: false, error: "invalid_block" };
        const kind = props.kind as SoapDocumentFieldKind;
        if (props.scope === "default") {
          if (defaultSections.has(kind)) {
            return { ok: false, error: "duplicate_default_section", field: kind };
          }
          defaultSections.add(kind);
          nextProjectionTarget = kind;
        } else {
          nextProjectionTarget = undefined;
        }
      }

      if (inlineBlockTypes.has(type)) {
        const inline = validateInlineContent(valueBlock.content);
        if (!inline.ok) return inline;
        if (nextProjectionTarget && inline.text) {
          projectionParts[nextProjectionTarget].push(inline.text);
        }
      } else if (valueBlock.content !== undefined) {
        return { ok: false, error: "invalid_block" };
      }

      if (children.length > 0) {
        const childResult = visitBlocks(children, depth + 1, nextProjectionTarget);
        if (childResult) return childResult;
      }
    }

    return null;
  };

  const blockError = visitBlocks(value.blocks, 0);
  if (blockError) return blockError;

  const projection = Object.fromEntries(
    soapDocumentFieldKinds.map((field) => [
      field,
      trimSoapBoundaryWhitespace(projectionParts[field].join("\n")),
    ]),
  ) as SoapDocumentProjection;

  for (const field of soapDocumentFieldKinds) {
    if (countUnicodeCodePoints(projection[field]) > SOAP_BLOCK_DOCUMENT_MAX_FIELD_LENGTH) {
      return { ok: false, error: "field_too_long", field };
    }
  }

  return {
    ok: true,
    document: value as SoapBlockDocument,
    projection,
    blockCount,
  };
}

export function createLegacySoapDocumentInput(
  soapNote?: Pick<SoapNote, SoapDocumentFieldKind> | null,
) {
  const sections: Array<{
    kind: SoapDocumentFieldKind;
    label: string;
    value: string;
  }> = [
    {
      kind: "subjective",
      label: "주관적 · 보호자 진술",
      value: soapNote?.subjective ?? "보호자 진술:",
    },
    {
      kind: "objective",
      label: "객관적 · 신체검사 소견",
      value: soapNote?.objective ?? "신체검사 소견:",
    },
    {
      kind: "assessment",
      label: "평가 · 임상 판단",
      value: soapNote?.assessment ?? "평가:",
    },
    {
      kind: "plan",
      label: "계획 · 치료 및 추적",
      value: soapNote?.plan ?? "계획:",
    },
  ];

  return sections.map(({ kind, label, value }) => ({
    type: "soapSection" as const,
    props: {
      kind,
      label,
      systemLabel: "기본 SOAP",
      scope: "default" as const,
    },
    children: [{ type: "paragraph" as const, content: value }],
  }));
}

export function areSoapBlockDocumentsEqual(
  left: SoapBlockDocument,
  right: SoapBlockDocument,
) {
  return JSON.stringify(sortJsonValue(left)) === JSON.stringify(sortJsonValue(right));
}

function validateBlockProps(type: string, props: UnknownRecord) {
  if (type === "soapSection") {
    return (
      soapDocumentFieldKinds.includes(props.kind as SoapDocumentFieldKind) &&
      (props.scope === "default" || props.scope === "system") &&
      isBoundedString(props.label, 1, 100) &&
      isBoundedString(props.systemLabel, 1, 100)
    );
  }

  if (type === "divider") return Object.keys(props).length === 0;
  if (!validateColorProps(props)) return false;
  if (type !== "quote" && !validateTextAlignment(props.textAlignment)) return false;
  if (type === "heading") {
    return (
      typeof props.level === "number" &&
      Number.isInteger(props.level) &&
      props.level >= 1 &&
      props.level <= 6
    );
  }
  if (type === "checkListItem") return typeof props.checked === "boolean";
  if (type === "numberedListItem" && props.start !== undefined) {
    return typeof props.start === "number" && Number.isInteger(props.start);
  }
  return true;
}

function validateColorProps(props: UnknownRecord) {
  return (
    typeof props.backgroundColor === "string" &&
    countUnicodeCodePoints(props.backgroundColor) <= 50 &&
    typeof props.textColor === "string" &&
    countUnicodeCodePoints(props.textColor) <= 50
  );
}

function validateTextAlignment(value: unknown) {
  return typeof value === "string" && ["left", "center", "right", "justify"].includes(value);
}

function validateInlineContent(value: unknown):
  | { ok: true; text: string }
  | { ok: false; error: "invalid_inline_content" | "invalid_link" } {
  if (!Array.isArray(value)) return { ok: false, error: "invalid_inline_content" };

  const parts: string[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.type !== "string") {
      return { ok: false, error: "invalid_inline_content" };
    }

    if (item.type === "text") {
      if (typeof item.text !== "string" || !validateStyles(item.styles)) {
        return { ok: false, error: "invalid_inline_content" };
      }
      parts.push(item.text);
      continue;
    }

    if (item.type === "link") {
      if (!isSafeLink(item.href) || !Array.isArray(item.content)) {
        return { ok: false, error: "invalid_link" };
      }
      for (const linkText of item.content) {
        if (
          !isRecord(linkText) ||
          linkText.type !== "text" ||
          typeof linkText.text !== "string" ||
          !validateStyles(linkText.styles)
        ) {
          return { ok: false, error: "invalid_inline_content" };
        }
        parts.push(linkText.text);
      }
      continue;
    }

    return { ok: false, error: "invalid_inline_content" };
  }

  return { ok: true, text: parts.join("") };
}

function validateStyles(value: unknown) {
  if (!isRecord(value)) return false;

  return Object.entries(value).every(([key, styleValue]) => {
    if (booleanStyleKeys.has(key)) return typeof styleValue === "boolean";
    if (colorStyleKeys.has(key)) {
      return typeof styleValue === "string" && countUnicodeCodePoints(styleValue) <= 50;
    }
    return false;
  });
}

function isSafeLink(value: unknown) {
  if (
    typeof value !== "string" ||
    countUnicodeCodePoints(value) > 2048 ||
    forbiddenLinkCharacters.test(value)
  ) {
    return false;
  }
  return (
    /^https?:\/\/(?:[a-z0-9]|[a-z0-9][a-z0-9.-]*[a-z0-9])(?::[0-9]{1,5})?(?:[/?#].*)?$/i.test(value) ||
    /^mailto:.+$/i.test(value) ||
    /^tel:\+?[0-9().-]+$/i.test(value)
  );
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJsonValue(value[key])]),
  );
}

function isBoundedString(value: unknown, min: number, max: number) {
  return (
    typeof value === "string" &&
    countUnicodeCodePoints(trimSoapBoundaryWhitespace(value)) >= min &&
    countUnicodeCodePoints(value) <= max
  );
}

function countUnicodeCodePoints(value: string) {
  return Array.from(value).length;
}

function trimSoapBoundaryWhitespace(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}
