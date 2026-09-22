import type {
  SoapBlockDocument,
  SoapBlockDocumentScope,
  SoapBlockDocumentV2,
  SoapNote,
} from "@/types/emr-domain";

export const SOAP_BLOCK_DOCUMENT_SCHEMA_VERSION = 2 as const;
export const SOAP_BLOCK_DOCUMENT_LEGACY_SCHEMA_VERSION = 1 as const;
export const SOAP_DEFAULT_SCOPE_KEY = "default" as const;
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

// New notes start empty; persisted note content is hydrated separately.
export const defaultSoapWritingPrompts: SoapDocumentProjection = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};

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
  | "duplicate_scope"
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
  "image",
  "video",
  "table",
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
  attachmentScope?: { workspaceId: string; encounterId: string },
): SoapDocumentValidationResult {
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2)) {
    return isRecord(value) && "schemaVersion" in value
      ? { ok: false, error: "unsupported_schema_version" }
      : { ok: false, error: "invalid_document" };
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

  const defaultSections = new Set<SoapDocumentFieldKind>();
  const projectionParts: Record<SoapDocumentFieldKind, string[]> = {
    subjective: [],
    objective: [],
    assessment: [],
    plan: [],
  };
  let blockCount = 0;

  const scopeInputs = getValidatedScopeInputs(value);
  if (!scopeInputs.ok) return scopeInputs.result;

  const visitBlocks = (
    blocks: unknown[],
    depth: number,
    scope: Pick<SoapBlockDocumentScope, "scope" | "systemLabel"> | undefined,
    ids: Set<string>,
    scopeSections: Set<SoapDocumentFieldKind>,
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
      if (!isRecord(props) || !validateBlockProps(type, props, attachmentScope)) {
        return { ok: false, error: "invalid_block" };
      }
      if (!Array.isArray(children)) return { ok: false, error: "invalid_block" };

      let nextProjectionTarget = projectionTarget;
      if (type === "soapSection") {
        if (depth !== 0) return { ok: false, error: "invalid_block" };
        const kind = props.kind as SoapDocumentFieldKind;
        if (
          scope &&
          (props.scope !== scope.scope ||
            (scope.scope === "system" && props.systemLabel !== scope.systemLabel))
        ) {
          return { ok: false, error: "invalid_block" };
        }
        if (scope) {
          if (scopeSections.has(kind)) {
            return scope.scope === "default"
              ? { ok: false, error: "duplicate_default_section", field: kind }
              : { ok: false, error: "invalid_block" };
          }
          scopeSections.add(kind);
        }
        if (props.scope === "default" && (!scope || scope.scope === "default")) {
          if (defaultSections.has(kind)) {
            return { ok: false, error: "duplicate_default_section", field: kind };
          }
          defaultSections.add(kind);
          nextProjectionTarget = kind;
        } else {
          nextProjectionTarget = undefined;
        }
      }

      if (type === "table") {
        const table = validateTableContent(valueBlock.content);
        if (!table.ok) return table;
        if (nextProjectionTarget && table.text) projectionParts[nextProjectionTarget].push(table.text);
      } else if (inlineBlockTypes.has(type)) {
        const inline = validateInlineContent(valueBlock.content);
        if (!inline.ok) return inline;
        if (nextProjectionTarget && inline.text) {
          projectionParts[nextProjectionTarget].push(inline.text);
        }
      } else if (valueBlock.content !== undefined) {
        return { ok: false, error: "invalid_block" };
      }

      if ((type === "image" || type === "video" || type === "table") && children.length > 0) {
        return { ok: false, error: "invalid_block" };
      }
      if ((type === "image" || type === "video" || type === "table") &&
        Object.keys(valueBlock).some((key) => !["id", "type", "props", "children", ...(type === "table" ? ["content"] : [])].includes(key))) {
        return { ok: false, error: "invalid_block" };
      }

      if (children.length > 0) {
        const childResult = visitBlocks(
          children,
          depth + 1,
          scope,
          ids,
          scopeSections,
          nextProjectionTarget,
        );
        if (childResult) return childResult;
      }
    }

    return null;
  };

  for (const scopeInput of scopeInputs.scopes) {
    const blockError = visitBlocks(
      scopeInput.blocks,
      0,
      scopeInput.scope,
      new Set<string>(),
      new Set<SoapDocumentFieldKind>(),
    );
    if (blockError) return blockError;
  }

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

function getValidatedScopeInputs(value: UnknownRecord):
  | {
      ok: true;
      scopes: Array<{
        blocks: unknown[];
        scope?: Pick<SoapBlockDocumentScope, "scope" | "systemLabel">;
      }>;
    }
  | { ok: false; result: SoapDocumentValidationResult } {
  if (value.schemaVersion === SOAP_BLOCK_DOCUMENT_LEGACY_SCHEMA_VERSION) {
    if (!Array.isArray(value.blocks) || value.blocks.length === 0) {
      return { ok: false, result: { ok: false, error: "invalid_document" } };
    }
    return { ok: true, scopes: [{ blocks: value.blocks }] };
  }

  if (!Array.isArray(value.scopes) || value.scopes.length === 0) {
    return { ok: false, result: { ok: false, error: "invalid_document" } };
  }

  const scopeKeys = new Set<string>();
  const systemIds = new Set<string>();
  const scopes: Array<{
    blocks: unknown[];
    scope: Pick<SoapBlockDocumentScope, "scope" | "systemLabel">;
  }> = [];
  let defaultScopeCount = 0;

  for (const item of value.scopes) {
    if (!isRecord(item)) {
      return { ok: false, result: { ok: false, error: "invalid_document" } };
    }
    const scope = item.scope;
    const scopeKey = item.scopeKey;
    const systemId = item.systemId;
    const systemLabel = item.systemLabel;

    if (
      (scope !== "default" && scope !== "system") ||
      typeof scopeKey !== "string" ||
      typeof systemLabel !== "string" ||
      !isBoundedString(scopeKey, 1, 240) ||
      !isBoundedString(systemLabel, 1, 100) ||
      !Array.isArray(item.blocks) ||
      item.blocks.length === 0
    ) {
      return { ok: false, result: { ok: false, error: "invalid_document" } };
    }
    if (scopeKeys.has(scopeKey)) {
      return { ok: false, result: { ok: false, error: "duplicate_scope" } };
    }
    scopeKeys.add(scopeKey);

    if (scope === "default") {
      if (scopeKey !== SOAP_DEFAULT_SCOPE_KEY || systemId !== undefined) {
        return { ok: false, result: { ok: false, error: "invalid_document" } };
      }
      defaultScopeCount += 1;
    } else {
      if (
        typeof systemId !== "string" ||
        !isBoundedString(systemId, 1, 200) ||
        scopeKey !== buildSystemSoapScopeKey(systemId)
      ) {
        return { ok: false, result: { ok: false, error: "invalid_document" } };
      }
      if (systemIds.has(systemId)) {
        return { ok: false, result: { ok: false, error: "duplicate_scope" } };
      }
      systemIds.add(systemId);
    }

    scopes.push({
      blocks: item.blocks,
      scope: { scope, systemLabel },
    });
  }

  if (defaultScopeCount !== 1) {
    return { ok: false, result: { ok: false, error: "invalid_document" } };
  }

  return { ok: true, scopes };
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
      value: soapNote?.subjective ?? defaultSoapWritingPrompts.subjective,
    },
    {
      kind: "objective",
      label: "객관적 · 신체검사 소견",
      value: soapNote?.objective ?? defaultSoapWritingPrompts.objective,
    },
    {
      kind: "assessment",
      label: "평가 · 임상 판단",
      value: soapNote?.assessment ?? defaultSoapWritingPrompts.assessment,
    },
    {
      kind: "plan",
      label: "계획 · 치료 및 추적",
      value: soapNote?.plan ?? defaultSoapWritingPrompts.plan,
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

export type SoapSystemScopeIdentity = {
  systemId: string;
  systemLabel: string;
};

export function buildSystemSoapScopeKey(systemId: string) {
  return `system:${systemId}`;
}

export function createSoapBlockDocumentV2({
  defaultBlocks,
  document,
  systemIdentities = [],
}: {
  defaultBlocks: unknown[];
  document?: SoapBlockDocument | null;
  systemIdentities?: SoapSystemScopeIdentity[];
}): SoapBlockDocumentV2 {
  const identityByLabel = new Map(
    systemIdentities.map((identity) => [identity.systemLabel, identity]),
  );

  if (document?.schemaVersion === 2) {
    const occupiedSystemIds = new Set(
      document.scopes.flatMap((scope) =>
        scope.scope === "system" && scope.systemId ? [scope.systemId] : [],
      ),
    );
    return {
      schemaVersion: 2,
      scopes: document.scopes.map((scope) => {
        if (scope.scope !== "system" || !scope.systemId?.startsWith("legacy-label:")) {
          return scope;
        }
        const identity = identityByLabel.get(scope.systemLabel);
        if (!identity || occupiedSystemIds.has(identity.systemId)) return scope;
        occupiedSystemIds.delete(scope.systemId);
        occupiedSystemIds.add(identity.systemId);
        return {
          ...scope,
          scopeKey: buildSystemSoapScopeKey(identity.systemId),
          systemId: identity.systemId,
          systemLabel: identity.systemLabel,
        };
      }),
    };
  }

  if (!document) {
    return {
      schemaVersion: 2,
      scopes: [createDefaultScope(defaultBlocks)],
    };
  }

  const defaultScopeBlocks: unknown[] = [];
  const systemBlocksByLabel = new Map<string, unknown[]>();

  for (const block of document.blocks) {
    const props = getSoapSectionProps(block);
    if (props?.scope === "system") {
      const blocks = systemBlocksByLabel.get(props.systemLabel) ?? [];
      blocks.push(block);
      systemBlocksByLabel.set(props.systemLabel, blocks);
    } else {
      // V1 root blocks without scope provenance are intentionally kept in the
      // default scope. Assigning them to a diagnosis system would invent data.
      defaultScopeBlocks.push(block);
    }
  }

  const scopes: SoapBlockDocumentScope[] = [
    createDefaultScope(defaultScopeBlocks.length ? defaultScopeBlocks : defaultBlocks),
  ];
  for (const [systemLabel, blocks] of systemBlocksByLabel) {
    const identity = identityByLabel.get(systemLabel);
    const systemId = identity?.systemId ?? buildLegacySoapSystemId(systemLabel);
    scopes.push({
      scopeKey: buildSystemSoapScopeKey(systemId),
      scope: "system",
      systemId,
      systemLabel: identity?.systemLabel ?? systemLabel,
      blocks,
    });
  }

  return { schemaVersion: 2, scopes };
}

export function getSoapDocumentScope(
  document: SoapBlockDocumentV2,
  scopeKey: string,
) {
  return document.scopes.find((scope) => scope.scopeKey === scopeKey);
}

export function replaceSoapDocumentScope({
  blocks,
  document,
  scopeKey,
  systemId,
  systemLabel,
}: {
  blocks: unknown[];
  document: SoapBlockDocumentV2;
  scopeKey: string;
  systemId?: string;
  systemLabel: string;
}): SoapBlockDocumentV2 {
  const scope: SoapBlockDocumentScope =
    scopeKey === SOAP_DEFAULT_SCOPE_KEY
      ? {
          scopeKey: SOAP_DEFAULT_SCOPE_KEY,
          scope: "default",
          systemLabel: "기본 SOAP",
          blocks,
        }
      : {
          scopeKey,
          scope: "system",
          systemId: systemId ?? scopeKey.replace(/^system:/, ""),
          systemLabel,
          blocks,
        };
  const existingIndex = document.scopes.findIndex(
    (candidate) => candidate.scopeKey === scopeKey,
  );
  if (existingIndex < 0) {
    return { ...document, scopes: [...document.scopes, scope] };
  }

  return {
    ...document,
    scopes: document.scopes.map((candidate, index) =>
      index === existingIndex ? scope : candidate,
    ),
  };
}

export function hasMeaningfulSoapScopeContent(scope: SoapBlockDocumentScope) {
  const visit = (blocks: unknown[]): boolean =>
    blocks.some((block) => {
      if (!isRecord(block)) return false;
      if (block.type === "table" && isRecord(block.content) && Array.isArray(block.content.rows) &&
        block.content.rows.some((row) => isRecord(row) && Array.isArray(row.cells) &&
          row.cells.some((cell) => isRecord(cell) && Array.isArray(cell.content) &&
            cell.content.some((inline) => isRecord(inline) && typeof inline.text === "string" && inline.text.trim())))) {
        return true;
      }
      if (
        Array.isArray(block.content) &&
        block.content.some(
          (inline) =>
            isRecord(inline) &&
            ((typeof inline.text === "string" && inline.text.trim().length > 0) ||
              (Array.isArray(inline.content) &&
                inline.content.some(
                  (linkText) =>
                    isRecord(linkText) &&
                    typeof linkText.text === "string" &&
                    linkText.text.trim().length > 0,
                ))),
        )
      ) {
        return true;
      }
      return Array.isArray(block.children) && visit(block.children);
    });

  return visit(scope.blocks);
}

function createDefaultScope(blocks: unknown[]): SoapBlockDocumentScope {
  return {
    scopeKey: SOAP_DEFAULT_SCOPE_KEY,
    scope: "default",
    systemLabel: "기본 SOAP",
    blocks,
  };
}

export function buildLegacySoapSystemId(systemLabel: string) {
  return `legacy-label:${encodeURIComponent(systemLabel)}`;
}

function getSoapSectionProps(block: unknown) {
  if (!isRecord(block) || block.type !== "soapSection" || !isRecord(block.props)) {
    return null;
  }
  const scope = block.props.scope;
  const systemLabel = block.props.systemLabel;
  if (
    (scope !== "default" && scope !== "system") ||
    typeof systemLabel !== "string" ||
    !systemLabel.trim()
  ) {
    return null;
  }
  return { scope, systemLabel } as const;
}

export function areSoapBlockDocumentsEqual(
  left: SoapBlockDocument,
  right: SoapBlockDocument,
) {
  return JSON.stringify(sortJsonValue(left)) === JSON.stringify(sortJsonValue(right));
}

function validateBlockProps(
  type: string,
  props: UnknownRecord,
  attachmentScope?: { workspaceId: string; encounterId: string },
) {
  if (type === "soapSection") {
    return (
      soapDocumentFieldKinds.includes(props.kind as SoapDocumentFieldKind) &&
      (props.scope === "default" || props.scope === "system") &&
      isBoundedString(props.label, 1, 100) &&
      isBoundedString(props.systemLabel, 1, 100)
    );
  }

  if (type === "divider") return Object.keys(props).length === 0;
  if (type === "table") return Object.keys(props).every((key) => key === "textColor") &&
    typeof props.textColor === "string" && countUnicodeCodePoints(props.textColor) <= 50;
  if (type === "image" || type === "video") {
    const reference = parseSoapAttachmentUrl(props.url);
    return (
      reference !== null &&
      Object.keys(props).every((key) =>
        ["backgroundColor", "textAlignment", "name", "url", "caption", "showPreview", "previewWidth"].includes(key)) &&
      (!attachmentScope ||
        (reference.workspaceId === attachmentScope.workspaceId &&
          reference.encounterId === attachmentScope.encounterId)) &&
      typeof props.backgroundColor === "string" &&
      countUnicodeCodePoints(props.backgroundColor) <= 50 &&
      validateTextAlignment(props.textAlignment) &&
      typeof props.name === "string" && countUnicodeCodePoints(props.name) <= 200 &&
      typeof props.caption === "string" && countUnicodeCodePoints(props.caption) <= 1000 &&
      typeof props.showPreview === "boolean" &&
      (props.previewWidth === undefined ||
        (typeof props.previewWidth === "number" &&
          Number.isInteger(props.previewWidth) &&
          props.previewWidth >= 1 && props.previewWidth <= 2000))
    );
  }
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

export function parseSoapAttachmentUrl(value: unknown):
  | { workspaceId: string; encounterId: string; attachmentId: string }
  | null {
  if (typeof value !== "string") return null;
  const match = /^\/api\/workspaces\/([A-Za-z0-9_-]{1,100})\/chart\/soap-attachments\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\?encounterId=([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(value);
  return match
    ? { workspaceId: match[1], attachmentId: match[2], encounterId: match[3] }
    : null;
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

function validateTableContent(value: unknown):
  | { ok: true; text: string }
  | { ok: false; error: "invalid_block" | "invalid_inline_content" | "invalid_link" } {
  if (!isRecord(value) || value.type !== "tableContent" ||
    Object.keys(value).some((key) => !["type", "rows", "columnWidths", "headerRows", "headerCols"].includes(key)) ||
    !Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > 20 ||
    !Array.isArray(value.columnWidths) || value.columnWidths.length < 1 || value.columnWidths.length > 10) {
    return { ok: false, error: "invalid_block" };
  }
  const columns = value.columnWidths.length;
  if (columns * value.rows.length > 100 || value.columnWidths.some((width) =>
    width !== null && (typeof width !== "number" || !Number.isInteger(width) || width < 40 || width > 2000))) {
    return { ok: false, error: "invalid_block" };
  }
  for (const [key, bound] of [["headerRows", value.rows.length], ["headerCols", columns]] as const) {
    const count = value[key];
    if (count !== undefined && (typeof count !== "number" || !Number.isInteger(count) || count < 0 || count > bound)) {
      return { ok: false, error: "invalid_block" };
    }
  }
  const lines: string[] = [];
  for (const row of value.rows) {
    if (!isRecord(row) || Object.keys(row).some((key) => key !== "cells") ||
      !Array.isArray(row.cells) || row.cells.length !== columns) return { ok: false, error: "invalid_block" };
    const cells: string[] = [];
    for (const cell of row.cells) {
      if (!isRecord(cell) || cell.type !== "tableCell" ||
        Object.keys(cell).some((key) => !["type", "content", "props"].includes(key)) ||
        !isRecord(cell.props) ||
        Object.keys(cell.props).some((key) => !["backgroundColor", "textColor", "textAlignment", "colspan", "rowspan"].includes(key)) ||
        typeof cell.props.backgroundColor !== "string" || countUnicodeCodePoints(cell.props.backgroundColor) > 50 ||
        typeof cell.props.textColor !== "string" || countUnicodeCodePoints(cell.props.textColor) > 50 ||
        !validateTextAlignment(cell.props.textAlignment) || cell.props.colspan !== 1 || cell.props.rowspan !== 1) {
        return { ok: false, error: "invalid_block" };
      }
      const inline = validateInlineContent(cell.content);
      if (!inline.ok) return inline;
      cells.push(inline.text);
    }
    lines.push(cells.join("\t"));
  }
  return { ok: true, text: lines.join("\n") };
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
