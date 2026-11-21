import { expect, test } from "@playwright/test";
import { exampleChart } from "../src/features/chart/advanced-search/search.stories.fixture";
import { representativeMedia } from "../src/features/chart/advanced-search/contract";
import { searchPage } from "../src/features/chart/advanced-search/ranking";
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
