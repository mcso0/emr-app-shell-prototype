import { expect, test } from "@playwright/test";
import { exampleChart } from "../src/features/chart/advanced-search/search.stories.fixture";
import {
  hasSameDiagnosis,
  orderDescription,
  representativeMedia,
} from "../src/features/chart/advanced-search/contract";
import {
  evidence,
  searchPage,
  speciesLabel,
} from "../src/features/chart/advanced-search/ranking";
import { createInitialEmrTableFilterBuilderModel } from "../src/components/emr/table-filter-builder-model";
const actor = "vet-a";
const cases = [
  exampleChart("mixed", {
    purpose: "구토 없음",
    clinicalAt: "2026-11-11T06:00:00Z",
  }),
  exampleChart("negative", {
    purpose: "정기 검진",
    paragraphs: [
      {
        id: "1",
        section: "subjective",
        scope: "기본 SOAP",
        text: "구토는 없었음.",
      },
    ],
  }),
  exampleChart("partial", { orders: [] }),
  exampleChart("draft", { status: "draft", editable: true }),
  exampleChart("colleague", {
    status: "autosaved",
    editable: true,
    authorId: "vet-b",
  }),
];
test("모든 단어가 한 차트에 있고 부정 표현만 있으면 관련도순 뒤에 둔다", () => {
  const ids = (q: string) =>
    searchPage(cases, { query: q }, actor).items.map((c) => c.id);
  expect(ids("구토 초음파")).toEqual(["mixed", "negative"]);
  expect(ids("초음파 구토 구토")).toEqual(ids("구토 초음파"));
  expect(
    searchPage(cases, { query: "구토 초음파", sort: "recent" }, actor).items[0]
      .id,
  ).toBe("negative");
  expect(
    searchPage(cases, { targets: true }, actor).items.map((c) => c.id),
  ).toEqual(["draft", "colleague"]);
});
test("같은 진단명은 확진·의심·감별과 관계없이 최근 진료부터 보여준다", () => {
  const charts = ["confirmed", "differential", "suspected"].map((kind, i) =>
    exampleChart(kind, {
      clinicalAt: `2026-11-${10 + i}T09:00:00Z`,
      diagnoses: [{ id: kind, catalogId: null, name: "췌장염", kind, primary: true, system: "소화기" }],
    }),
  );
  expect(searchPage(charts, { query: "췌장염" }, actor).items.map((c) => c.id))
    .toEqual(["suspected", "differential", "confirmed"]);
});

test("병원 날짜·진료 담당자·필터를 함께 적용하고 동일시각 결과를 한 번씩만 반환한다", () => {
  const charts = Array.from({ length: 35 }, (_v, i) =>
    exampleChart(String(i).padStart(2, "0"), {
      clinicalAt: "2026-11-16T15:02:00Z",
    }),
  );
  const groups = createInitialEmrTableFilterBuilderModel("filter");
  const rule = { fieldId: "species", operatorId: "is", value: "고양이" };
  groups.groups[0].rules[0] = { id: "species", ...rule, applied: rule };
  const params = {
    groups,
    mine: true,
    doctor: "vet-b",
    from: "2026-11-17",
    to: "2026-11-17",
  };
  const first = searchPage(charts, params, actor);
  const next = searchPage(
    charts,
    { ...params, cursor: first.nextCursor },
    actor,
  );
  expect(first.total).toBe(35);
  expect(new Set([...first.items, ...next.items].map((c) => c.id)).size).toBe(
    35,
  );
  expect(next.nextCursor).toBeNull();
  expect(searchPage(charts, { ...params, to: "2026-11-16" }, actor).total).toBe(
    0,
  );
  expect(searchPage(charts, { ...params, doctor: "vet-a" }, actor).total).toBe(
    0,
  );
});
test("대표 첨부는 이름·설명 중 첫 일치로 고르고 첨부 단독 일치는 결과를 만들지 않는다", () => {
  const media = ["사진", "실시간 영상", "정지 영상"].map((name, i) => ({
    id: String(i),
    name,
    caption: i === 1 ? "복부 초음파" : "",
    url: "/fixture/" + i,
    video: i === 1,
  }));
  expect(representativeMedia(media, "구토 초음파")).toBe(1);
  expect(representativeMedia(media, "영상")).toBe(1);
  expect(representativeMedia(media, "식욕")).toBe(0);
  expect(representativeMedia(media, "")).toBe(0);
  expect(
    searchPage([exampleChart("s", { media })], { query: "정지 영상" }, actor)
      .total,
  ).toBe(0);
});

test("첨부를 연 직후와 키보드 포커스가 이동한 뒤에도 Esc는 첨부만 닫는다", async ({
  page,
}) => {
  await page.goto("/review/chart-search");
  await page.getByRole("button", { name: "모카 차트 원본 열기" }).click();
  const drawer = page.getByRole("complementary", { name: "차트 원본" });
  const enlarge = drawer.getByRole("button", { name: "복부 초음파 영상 확대" });
  const dialog = page.getByRole("dialog");

  await enlarge.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(drawer).toBeVisible();

  await enlarge.click();
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(drawer).toBeVisible();
});

test("부정 표현과 실제 기록이 함께 있을 때 단어별 문맥과 동물종을 구분한다", () => {
  const check = (text: string) =>
    evidence(
      exampleChart("example", {
        purpose: text,
        paragraphs: [],
        complaint: "",
        orders: [],
      }),
      ["구토"],
    ).negative;
  for (const text of [
    "구토 안 함",
    "구토·설사 없음",
    "구토 및 설사 없음",
    "구토 증상은 발견되지 않음",
  ])
    expect(check(text)).toBe(true);
  expect(check("어제 구토 3회, 오늘 구토 및 설사 없음")).toBe(false);
  expect(check("구토 발생. 설사 없음")).toBe(false);
  expect(speciesLabel("rabbit")).toBe("토끼");
  const diagnosis = {
    id: "qa",
    name: "Example DX",
    catalogId: "qa-dx",
    primary: false,
    kind: "suspected",
    system: "",
  };
  expect(
    hasSameDiagnosis(diagnosis, {
      ...diagnosis,
      catalogId: null,
      name: "example dx",
    }),
  ).toBe(true);
  expect(
    orderDescription({
      id: "qa-rx",
      name: "예시약",
      catalogId: "qa-item",
      kind: "dispensing",
      price: null,
      available: true,
      quantity: 1,
      inputs: {
        dose: 2,
        doseUnit: "mg",
        doseBasis: "kg",
        frequency: "bid",
        durationDays: 3,
      },
    }),
  ).toBe("예시약 · 2 mg/kg · 하루 2회 · 3일");
});

test("복사한 S를 대상 차트에서 고쳐도 원본과 검색어를 유지한다", async ({
  page,
}) => {
  await page.goto("/review/chart-search");
  const query = page.getByRole("textbox", { name: "차트 검색어" });
  await query.fill("구토 초음파");
  await expect(
    page.getByRole("button", { name: /차트 원본 열기$/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "모카 차트 원본 열기" }).click();
  await page
    .getByRole("button", { name: "기존 차트에 복사", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /두부/ }).click();
  await dialog.getByRole("button", { name: "가져올 항목 선택" }).click();
  await dialog.getByRole("checkbox", { name: /어제 저녁부터/ }).click();
  await dialog.getByRole("button", { name: "변경 내용 확인" }).click();
  await dialog.getByRole("button", { name: "두부 차트에 적용" }).click();
  await page.getByRole("button", { name: "대상 차트 보기" }).click();
  await page.getByRole("button", { name: /어제 저녁부터.*수정/ }).click();
  await page
    .getByRole("textbox", { name: "S · 문진 문단 내용" })
    .fill("오늘 보호자가 확인한 내용으로 수정함.");
  await page.getByRole("button", { name: "문단 저장" }).click();
  await expect(
    page.getByText("오늘 보호자가 확인한 내용으로 수정함."),
  ).toBeVisible();
  await page.getByRole("button", { name: "검색 결과로 돌아가기" }).click();
  await expect(query).toHaveValue("구토 초음파");
  const source = page.getByRole("complementary", { name: "차트 원본" });
  await expect(source).toContainText("어제 저녁부터");
  await expect(source).not.toContainText(
    "오늘 보호자가 확인한 내용으로 수정함.",
  );
});
