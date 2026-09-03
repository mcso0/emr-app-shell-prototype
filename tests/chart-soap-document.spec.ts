import { expect, test } from "@playwright/test";

import {
  SOAP_BLOCK_DOCUMENT_MAX_BLOCKS,
  areSoapBlockDocumentsEqual,
  buildSystemSoapScopeKey,
  createSoapBlockDocumentV2,
  createLegacySoapDocumentInput,
  getSoapDocumentScope,
  hasMeaningfulSoapScopeContent,
  replaceSoapDocumentScope,
  validateAndProjectSoapDocument,
} from "../src/features/chart/chart-soap-document";

type TestBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content?: Array<Record<string, unknown>>;
  children: TestBlock[];
};

function textBlock(
  id: string,
  text: string,
  type: "paragraph" | "heading" | "bulletListItem" = "paragraph",
): TestBlock {
  return {
    id,
    type,
    props: {
      backgroundColor: "default",
      textColor: "default",
      textAlignment: "left",
      ...(type === "heading" ? { level: 2 } : {}),
    },
    content: [{ type: "text", text, styles: {} }],
    children: [],
  };
}

function section(
  id: string,
  kind: "subjective" | "objective" | "assessment" | "plan",
  childText: string,
  scope: "default" | "system" = "default",
): TestBlock {
  return {
    id,
    type: "soapSection",
    props: {
      kind,
      label: kind,
      systemLabel: scope === "default" ? "기본 SOAP" : "근골격계",
      scope,
    },
    children: [textBlock(`${id}-child`, childText)],
  };
}

function validDocument() {
  return {
    schemaVersion: 1 as const,
    blocks: [
      section("section-s", "subjective", "보호자 진술"),
      section("section-o", "objective", "신체검사 소견"),
      section("section-a", "assessment", "평가"),
      section("section-p", "plan", "계획"),
      section("section-system", "objective", "시스템 전용 소견", "system"),
    ],
  };
}

test("SOAP V1 validates supported blocks and derives only default S/O/A/P projections", () => {
  const result = validateAndProjectSoapDocument(validDocument());

  expect(result).toMatchObject({
    ok: true,
    projection: {
      subjective: "보호자 진술",
      objective: "신체검사 소견",
      assessment: "평가",
      plan: "계획",
    },
    blockCount: 10,
  });
});

test("SOAP V1 preserves visible link text but rejects unsafe link protocols", () => {
  const document = validDocument();
  const subjectiveChild = document.blocks[0]?.children[0];
  if (!subjectiveChild) throw new Error("subjective fixture missing");
  subjectiveChild.content = [
    {
      type: "link",
      href: "https://example.test/chart",
      content: [{ type: "text", text: "참고 링크", styles: { underline: true } }],
    },
  ];

  expect(validateAndProjectSoapDocument(document)).toMatchObject({
    ok: true,
    projection: { subjective: "참고 링크" },
  });

  subjectiveChild.content[0]!.href = "javascript:alert(1)";
  expect(validateAndProjectSoapDocument(document)).toEqual({
    ok: false,
    error: "invalid_link",
  });

  for (const malformedHref of [
    "http://",
    "http:javascript:alert(1)",
    "https://exa mple.test",
    "https://example.test/\u0085hidden",
    "https://example.test/\ufeffhidden",
  ]) {
    subjectiveChild.content[0]!.href = malformedHref;
    expect(validateAndProjectSoapDocument(document)).toEqual({
      ok: false,
      error: "invalid_link",
    });
  }

  for (const safeHref of ["mailto:vet@example.test", "tel:+821012345678"]) {
    subjectiveChild.content[0]!.href = safeHref;
    expect(validateAndProjectSoapDocument(document)).toMatchObject({ ok: true });
  }
});

test("SOAP V1 rejects unsupported versions, blocks, duplicate IDs, and duplicate default sections", () => {
  expect(
    validateAndProjectSoapDocument({ ...validDocument(), schemaVersion: 3 }),
  ).toEqual({ ok: false, error: "unsupported_schema_version" });

  const unsupported = validDocument();
  unsupported.blocks.push({
    id: "image-1",
    type: "image",
    props: {},
    children: [],
  });
  expect(validateAndProjectSoapDocument(unsupported)).toEqual({
    ok: false,
    error: "unsupported_block",
  });

  const duplicateId = validDocument();
  duplicateId.blocks[1]!.id = duplicateId.blocks[0]!.id;
  expect(validateAndProjectSoapDocument(duplicateId)).toEqual({
    ok: false,
    error: "duplicate_block_id",
  });

  const duplicateSection = validDocument();
  duplicateSection.blocks.push(section("section-s-2", "subjective", "중복"));
  expect(validateAndProjectSoapDocument(duplicateSection)).toEqual({
    ok: false,
    error: "duplicate_default_section",
    field: "subjective",
  });
});

test("SOAP V2 validates isolated default and diagnosis-system scopes while projecting only default", () => {
  const systemId = "c427a4b5-2181-4454-9655-6d2695c6768d";
  const document = {
    schemaVersion: 2 as const,
    scopes: [
      {
        scopeKey: "default",
        scope: "default" as const,
        systemLabel: "기본 SOAP",
        blocks: [section("default-s", "subjective", "기본 전용")],
      },
      {
        scopeKey: buildSystemSoapScopeKey(systemId),
        scope: "system" as const,
        systemId,
        systemLabel: "근골격계",
        blocks: [
          section("musculoskeletal-s", "subjective", "근골격 전용", "system"),
        ],
      },
    ],
  };

  expect(validateAndProjectSoapDocument(document)).toMatchObject({
    ok: true,
    projection: {
      subjective: "기본 전용",
      objective: "",
      assessment: "",
      plan: "",
    },
    blockCount: 4,
  });

  const mismatchedMarker = structuredClone(document);
  mismatchedMarker.scopes[1]!.blocks[0]!.props.systemLabel = "소화기";
  expect(validateAndProjectSoapDocument(mismatchedMarker)).toEqual({
    ok: false,
    error: "invalid_block",
  });
});

test("SOAP V1 upgrade keeps unscoped legacy blocks in default and resolves system identity by ID", () => {
  const unscoped = textBlock("legacy-unscoped", "기존 자유 입력");
  const legacy = validDocument();
  legacy.blocks.push(unscoped);
  const systemId = "c427a4b5-2181-4454-9655-6d2695c6768d";
  const upgraded = createSoapBlockDocumentV2({
    defaultBlocks: [],
    document: legacy,
    systemIdentities: [{ systemId, systemLabel: "근골격계" }],
  });

  expect(upgraded.schemaVersion).toBe(2);
  expect(getSoapDocumentScope(upgraded, "default")?.blocks).toContainEqual(unscoped);
  expect(
    getSoapDocumentScope(upgraded, buildSystemSoapScopeKey(systemId))?.blocks,
  ).toHaveLength(1);
  expect(
    getSoapDocumentScope(upgraded, buildSystemSoapScopeKey(systemId))?.blocks,
  ).not.toContainEqual(unscoped);
});

test("SOAP V2 replaces one scope without changing another and detects meaningful content", () => {
  const systemId = "c427a4b5-2181-4454-9655-6d2695c6768d";
  const initial = createSoapBlockDocumentV2({
    defaultBlocks: [section("default-s", "subjective", "기본 전용")],
  });
  const next = replaceSoapDocumentScope({
    blocks: [section("system-s", "subjective", "근골격 전용", "system")],
    document: initial,
    scopeKey: buildSystemSoapScopeKey(systemId),
    systemId,
    systemLabel: "근골격계",
  });

  expect(getSoapDocumentScope(next, "default")?.blocks).toEqual(
    getSoapDocumentScope(initial, "default")?.blocks,
  );
  const systemScope = getSoapDocumentScope(
    next,
    buildSystemSoapScopeKey(systemId),
  );
  expect(systemScope).toBeTruthy();
  expect(hasMeaningfulSoapScopeContent(systemScope!)).toBe(true);
});

test("SOAP V1 rejects excessive block count, nesting depth, and projected field length", () => {
  const tooManyBlocks = {
    schemaVersion: 1,
    blocks: Array.from(
      { length: SOAP_BLOCK_DOCUMENT_MAX_BLOCKS + 1 },
      (_, index) => textBlock(`paragraph-${index}`, "x"),
    ),
  };
  expect(validateAndProjectSoapDocument(tooManyBlocks)).toEqual({
    ok: false,
    error: "too_many_blocks",
  });

  const tooDeep = validDocument();
  let child = tooDeep.blocks[0]!.children[0]!;
  for (let depth = 0; depth < 4; depth += 1) {
    const nested = textBlock(`nested-${depth}`, "nested");
    child.children = [nested];
    child = nested;
  }
  expect(validateAndProjectSoapDocument(tooDeep)).toEqual({
    ok: false,
    error: "block_depth_exceeded",
  });

  const maxDepth = validDocument();
  let maxDepthChild = maxDepth.blocks[0]!.children[0]!;
  for (let depth = 0; depth < 3; depth += 1) {
    const nested = textBlock(`max-depth-${depth}`, "nested");
    maxDepthChild.children = [nested];
    maxDepthChild = nested;
  }
  expect(validateAndProjectSoapDocument(maxDepth)).toMatchObject({ ok: true });

  const tooLong = validDocument();
  tooLong.blocks[0]!.children[0]!.content![0]!.text = "가".repeat(10_001);
  expect(validateAndProjectSoapDocument(tooLong)).toEqual({
    ok: false,
    error: "field_too_long",
    field: "subjective",
  });
});

test("SOAP V1 counts Unicode code points and uses the SQL boundary-whitespace contract", () => {
  const maxEmojiField = validDocument();
  maxEmojiField.blocks[0]!.children[0]!.content![0]!.text = "😀".repeat(10_000);
  expect(validateAndProjectSoapDocument(maxEmojiField)).toMatchObject({ ok: true });

  const oversizedEmojiField = validDocument();
  oversizedEmojiField.blocks[0]!.children[0]!.content![0]!.text = "😀".repeat(10_001);
  expect(validateAndProjectSoapDocument(oversizedEmojiField)).toEqual({
    ok: false,
    error: "field_too_long",
    field: "subjective",
  });

  const maxEmojiIdAndLabel = validDocument();
  maxEmojiIdAndLabel.blocks[0]!.id = "😀".repeat(200);
  maxEmojiIdAndLabel.blocks[0]!.props.label = "😀".repeat(100);
  expect(validateAndProjectSoapDocument(maxEmojiIdAndLabel)).toMatchObject({ ok: true });

  const oversizedEmojiId = validDocument();
  oversizedEmojiId.blocks[0]!.id = "😀".repeat(201);
  expect(validateAndProjectSoapDocument(oversizedEmojiId)).toEqual({
    ok: false,
    error: "invalid_block",
  });

  const oversizedEmojiLabel = validDocument();
  oversizedEmojiLabel.blocks[0]!.props.label = "😀".repeat(101);
  expect(validateAndProjectSoapDocument(oversizedEmojiLabel)).toEqual({
    ok: false,
    error: "invalid_block",
  });

  const linkPrefix = "https://example.test/";
  const maxEmojiLink = validDocument();
  maxEmojiLink.blocks[0]!.children[0]!.content = [
    {
      type: "link",
      href: `${linkPrefix}${"😀".repeat(2048 - Array.from(linkPrefix).length)}`,
      content: [{ type: "text", text: "링크", styles: {} }],
    },
  ];
  expect(validateAndProjectSoapDocument(maxEmojiLink)).toMatchObject({ ok: true });
  maxEmojiLink.blocks[0]!.children[0]!.content![0]!.href += "😀";
  expect(validateAndProjectSoapDocument(maxEmojiLink)).toEqual({
    ok: false,
    error: "invalid_link",
  });

  const whitespaceBoundary = validDocument();
  whitespaceBoundary.blocks[0]!.children[0]!.content![0]!.text =
    " \t\n\r\f\v\u00a0보호자\u00a0 \t\n\r\f\v";
  expect(validateAndProjectSoapDocument(whitespaceBoundary)).toMatchObject({
    ok: true,
    projection: { subjective: "\u00a0보호자\u00a0" },
  });
});

test("legacy SOAP fields hydrate into the four default BlockNote sections without backfill IDs", () => {
  const blocks = createLegacySoapDocumentInput({
    subjective: "기존 S",
    objective: "기존 O",
    assessment: "기존 A",
    plan: "기존 P",
  });

  expect(blocks).toHaveLength(4);
  expect(blocks.map((block) => block.props)).toEqual([
    expect.objectContaining({ kind: "subjective", scope: "default" }),
    expect.objectContaining({ kind: "objective", scope: "default" }),
    expect.objectContaining({ kind: "assessment", scope: "default" }),
    expect.objectContaining({ kind: "plan", scope: "default" }),
  ]);
  expect(blocks[0]?.children[0]?.content).toBe("기존 S");
  expect(blocks[0]).not.toHaveProperty("id");
});

test("SOAP canonical comparison ignores JSON object key order but not content", () => {
  const left = validDocument();
  const right = JSON.parse(JSON.stringify(left)) as ReturnType<typeof validDocument>;
  right.blocks[0]!.props = {
    scope: "default",
    systemLabel: "기본 SOAP",
    label: "subjective",
    kind: "subjective",
  };

  expect(areSoapBlockDocumentsEqual(left, right)).toBe(true);
  right.blocks[0]!.children[0]!.content![0]!.text = "서버의 다른 내용";
  expect(areSoapBlockDocumentsEqual(left, right)).toBe(false);
});
