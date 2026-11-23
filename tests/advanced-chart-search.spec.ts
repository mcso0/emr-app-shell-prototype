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
  const dialog = page.getByRole("region",{name:"선택한 첨부 미리보기"});

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
  await page.getByRole("button", { name: "검색", exact: true }).click();
  const query = page.getByRole("textbox", { name: "차트 검색어" });
  await query.fill("구토 초음파");
  await expect(
    page.getByRole("button", { name: /차트 원본 열기$/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "모카 차트 원본 열기" }).click();
  await page.getByRole("complementary", { name: "차트 원본" }).getByRole("button", { name: "식후 반복되는 구토 복사" }).click();
  await page.getByRole("menuitem", {name:"기존 차트에 복사"}).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /두부/ }).click();
  await dialog.getByRole("button", { name: "가져올 항목 선택" }).click();
  await dialog.getByRole("checkbox", { name: /어제 저녁부터/ }).click();
  await dialog.getByRole("button", { name: "변경 내용 확인" }).click();
  await dialog.getByRole("button", { name: "두부 차트에 적용" }).click();
  await page.getByRole("button", { name: "두부 차트 보기" }).click();
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

test("내 차트 includes the attending veterinarian while transfer targets keep authorship", () => {
  const rows = [
    exampleChart("author", {authorId:actor, doctorId:"other"}),
    exampleChart("attending", {authorId:"other", doctorId:actor}),
    exampleChart("both", {authorId:actor, doctorId:actor}),
    exampleChart("neither", {authorId:"other", doctorId:"other"}),
  ];
  expect(searchPage(rows,{mine:true},actor).items.map(c=>c.id).sort()).toEqual(["attending","author","both"]);
  expect(searchPage(rows.map(c=>({...c,editable:true,status:"draft"})),{mine:true,targets:true},actor).items.map(c=>c.id).sort()).toEqual(["author","both"]);
});

test("patient drawer keeps its frame, scopes records and actions, and separates bulk selection", async ({page})=>{
  await page.setViewportSize({width:1600,height:1000});
  await page.goto("/review/chart-search");
  const results=page.getByRole("region",{name:"차트 검색 결과"});
  const first=results.locator("[data-chart-id]").first(),second=results.locator("[data-chart-id]").nth(1);
  await first.hover();
  await first.getByRole("checkbox",{name:/차트 선택$/}).click();
  await expect(page.getByRole("complementary",{name:"차트 원본"})).toHaveCount(0);
  await first.getByRole("button",{name:/차트 원본 열기/}).click();
  const drawer=page.getByRole("complementary",{name:"차트 원본"});
  await expect(drawer.locator("[data-history-chart-id]")).not.toHaveCount(0);
  const panel=await drawer.elementHandle();
  await drawer.getByRole("button",{name:"환자 차트 이력 검색 열기"}).click();
  await drawer.getByRole("searchbox").fill("없는-차트");
  await expect(drawer.getByText("조건에 맞는 차트가 없습니다")).toBeVisible();
  await second.getByRole("button",{name:/차트 원본 열기/}).click();
  await expect(drawer.getByRole("searchbox")).toHaveCount(0);
  expect(await panel!.evaluate(el=>el.isConnected)).toBe(true);
  await expect(first.getByRole("checkbox",{name:/차트 선택$/})).toBeChecked();
  await expect(second.getByRole("checkbox",{name:/차트 선택$/})).not.toBeChecked();
  const row=drawer.locator("[data-history-chart-id]").filter({has:page.locator("[aria-expanded=true][aria-controls]")}).first();
  const star=row.getByRole("button",{name:/즐겨찾기 추가/});
  await star.click();
  await expect(row.getByRole("button",{name:/즐겨찾기 해제/})).toHaveAttribute("aria-pressed","true");
  await drawer.getByRole("button",{name:"차트 원본 닫기"}).click();
  await page.reload();
  await expect(results.getByRole("button",{name:/즐겨찾기/})).toHaveCount(0);
  await second.getByRole("button",{name:/차트 원본 열기/}).click();
  await expect(drawer.getByRole("button",{name:/즐겨찾기 해제/})).toHaveAttribute("aria-pressed","true");
});

test("같은 환자 이력을 함께 펼치고, 선택한 원본에서만 복사를 시작한다", async ({page})=>{
  await page.goto("/review/chart-search");
  await page.getByRole("button",{name:"보리 차트 원본 열기"}).first().click();
  const drawer=page.getByRole("complementary",{name:"차트 원본"});
  const records=drawer.locator("[data-history-chart-id]");
  await expect(records).toHaveCount(2);
  const collapsed=records.locator("button[aria-controls][aria-expanded=false]");
  await collapsed.focus();
  await page.keyboard.press("Enter");
  await expect(records.locator("button[aria-controls][aria-expanded=true]")).toHaveCount(2);
  const last=records.last();
  await last.getByRole("button",{name:/즐겨찾기 추가/}).click();
  await expect(last.locator("button[aria-controls]")).toHaveAttribute("aria-expanded","true");
  await last.getByRole("button",{name:/ 복사$/,exact:false}).filter({hasNotText:"전체 복사"}).click();
  await page.getByRole("menuitem",{name:"기존 차트에 복사"}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("결과의 전문과 배지를 확인해도 목록과 카드의 썸네일 위치가 유지된다", async ({page}) => {
  await page.setViewportSize({width: 1387,height: 868});
  await page.goto("/review/chart-search");
  const results = page.getByRole("region",{name:"차트 검색 결과"});
  const first = results.locator("[data-chart-id]").first();
  const media = first.locator("[data-media]");
  await expect(first.getByText("최근 수정")).toBeVisible();
  await expect(first.getByText("2026.11.19")).toBeVisible();
  const other = results.locator("[data-chart-id]").nth(1);
  await expect(other.getByText("표시할 부가 정보가 없습니다")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const narrow of [false, true, false]) {
    if (narrow) await page.getByRole("button", { name: "좁게 보기", exact: true }).click();
    else if (await page.getByRole("button", { name: "넓게 보기", exact: true }).count())
      await page.getByRole("button", { name: "넓게 보기", exact: true }).click();
    const tops = await first.locator("dt").evaluateAll(rows => rows.map(row => row.getBoundingClientRect().top));
    for (const index of [1, 2, 4, 5]) expect(tops[index] - tops[index - 1]).toBeCloseTo(26, 0);
  }
  const square = await media.boundingBox();
  expect(square).not.toBeNull();
  expect(square!.width).toBeCloseTo(square!.height, 0);
  expect((await other.locator("[data-media]").boundingBox())!.width).toBeCloseTo(square!.width, 0);
  const more = first.getByRole("button",{name:"전체 오더 외 2건"});
  await more.click();
  const reader = page.getByRole("dialog",{name:"전체 오더"});
  await expect(reader.getByText("이전 검사 패널")).toBeVisible();
  expect(await media.boundingBox()).toEqual(square);
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await first.getByRole("button",{name:/부가 정보 \+/}).click();
  await expect(page.getByRole("dialog",{name:"부가 정보"}).getByText("원외검사 최종 결과 1건")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("카드 보기").click();
  for (const width of [1625, 1387, 1280, 390]) {
    await page.setViewportSize({width,height:868});
    await expect(results).toHaveAttribute("data-view","card");
    const rect = await media.boundingBox();
    expect(rect!.width / rect!.height).toBeCloseTo(16/9, 1);
    expect(await first.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const labels = first.locator("dt");
    await expect(labels).toHaveCount(6);
    const tops = await labels.evaluateAll(rows => rows.map(row => row.getBoundingClientRect().top));
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i] - tops[i - 1]).toBeCloseTo(32, 0);
    }
    const footer = first.locator("footer");
    expect(await footer.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await more.click();
  await expect(page.getByRole("dialog",{name:"전체 오더"})).toBeVisible();
  await page.getByRole("button",{name:"닫기",exact:true}).click();
  await expect(more).toBeFocused();
});
