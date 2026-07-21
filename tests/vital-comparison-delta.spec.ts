import { expect, test } from "@playwright/test";

import {
  buildBloodPressureDelta,
  buildSingleVitalDelta,
} from "../src/features/chart/vital-comparison-delta";

test("single vital deltas expose only direction and display-precision magnitude", () => {
  expect(
    buildSingleVitalDelta({
      current: 6.8,
      previous: 8.4,
      precision: 1,
      label: "체중",
    }),
  ).toEqual({
    accessibleLabel: "체중 변화: 1.6 감소",
    parts: [{ direction: "decrease", value: "1.6" }],
  });
  expect(
    buildSingleVitalDelta({
      current: 39.3,
      previous: 38.4,
      precision: 1,
      label: "체온",
    }),
  ).toEqual({
    accessibleLabel: "체온 변화: 0.9 증가",
    parts: [{ direction: "increase", value: "0.9" }],
  });
});

test("single vital deltas collapse equality, rounded equality, missing values, and invalid numbers", () => {
  for (const input of [
    { current: 20, previous: 20, precision: 0 },
    { current: 38.64, previous: 38.6, precision: 1 },
    { current: undefined, previous: 20, precision: 0 },
    { current: 20, previous: undefined, precision: 0 },
    { current: Number.NaN, previous: 20, precision: 0 },
    { current: 20, previous: Number.POSITIVE_INFINITY, precision: 0 },
  ]) {
    expect(buildSingleVitalDelta({ ...input, label: "호흡수" })).toBeNull();
  }
});

test("blood pressure preserves all systolic and diastolic direction combinations", () => {
  const previous = { systolic: 180, diastolic: 65 };
  const cases = [
    {
      current: { systolic: 190, diastolic: 76 },
      expected: ["increase", "increase"],
    },
    {
      current: { systolic: 190, diastolic: 54 },
      expected: ["increase", "decrease"],
    },
    {
      current: { systolic: 190, diastolic: 65 },
      expected: ["increase", "same"],
    },
    {
      current: { systolic: 170, diastolic: 76 },
      expected: ["decrease", "increase"],
    },
    {
      current: { systolic: 170, diastolic: 54 },
      expected: ["decrease", "decrease"],
    },
    {
      current: { systolic: 170, diastolic: 65 },
      expected: ["decrease", "same"],
    },
    {
      current: { systolic: 180, diastolic: 76 },
      expected: ["same", "increase"],
    },
    {
      current: { systolic: 180, diastolic: 54 },
      expected: ["same", "decrease"],
    },
  ] as const;

  for (const scenario of cases) {
    expect(
      buildBloodPressureDelta({
        current: scenario.current,
        previous,
      })?.parts.map((part) => part.direction),
    ).toEqual(scenario.expected);
  }

  expect(
    buildBloodPressureDelta({
      current: { systolic: 180, diastolic: 65 },
      previous,
    }),
  ).toBeNull();
});

test("blood pressure exposes concise accessible copy in systolic and diastolic order", () => {
  expect(
    buildBloodPressureDelta({
      current: { systolic: 190, diastolic: 76 },
      previous: { systolic: 180, diastolic: 65 },
    }),
  ).toEqual({
    accessibleLabel: "혈압 변화: 수축기 10 증가, 이완기 11 증가",
    parts: [
      { direction: "increase", value: "10" },
      { direction: "increase", value: "11" },
    ],
  });
});

test("blood pressure hides incomplete comparisons", () => {
  expect(
    buildBloodPressureDelta({
      current: { systolic: 180, diastolic: undefined },
      previous: { systolic: 170, diastolic: 65 },
    }),
  ).toBeNull();
  expect(
    buildBloodPressureDelta({
      current: { systolic: 180, diastolic: 65 },
      previous: { systolic: undefined, diastolic: 65 },
    }),
  ).toBeNull();
});
