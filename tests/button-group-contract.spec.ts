import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("Figma button group keeps explicit segment edges and divider across chart, lab, and dispensing", () => {
  const buttonGroupSource = readFileSync(
    "src/components/ui/button-group.tsx",
    "utf8",
  );
  const chartSource = readFileSync("src/features/chart/module.tsx", "utf8");
  const dispensingSource = readFileSync(
    "src/features/dispensing/module.tsx",
    "utf8",
  );
  const labImagingSource = readFileSync(
    "src/features/lab-imaging/components/status-action.tsx",
    "utf8",
  );

  expect(buttonGroupSource).toContain('data-slot="button-group"');
  expect(buttonGroupSource).toContain('data-slot="button-group-divider"');
  expect(buttonGroupSource).toContain("rounded-r-none");
  expect(buttonGroupSource).toContain("rounded-l-none");
  expect(buttonGroupSource).toContain("bg-primary-foreground");
  expect(chartSource).toContain("<ButtonGroup");
  expect(chartSource).toContain("CdsNavigationChevronDownIcon");
  expect(dispensingSource).toContain("<ButtonGroup");
  expect(labImagingSource).toContain("<ButtonGroup");
});
