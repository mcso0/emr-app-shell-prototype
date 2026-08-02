import { expect, test, type Page } from "@playwright/test";

import { PREPARED_EMPTY_CLINIC_WORKSPACE_ID } from "../src/lib/emr-domain/demo-workspaces";

const mainContentHeaderSelector =
  '[data-slot="emr-main-content-header"]';

type HeaderHeightMode = "fixed" | "adaptive";

async function expectMainContentHeader({
  height,
  mode,
  page,
}: {
  height: number;
  mode: HeaderHeightMode;
  page: Page;
}) {
  const workspace = page.getByTestId("workspace-main-content");
  const header = workspace.locator(mainContentHeaderSelector);

  await expect(header).toHaveCount(1);
  await expect(header).toHaveAttribute("data-height-mode", mode);
  await expect
    .poll(async () => {
      const box = await header.boundingBox();
      return box?.height ?? 0;
    })
    .toBe(height);
}

test("main-content header applies the fixed and adaptive viewport-height contract", async ({
  page,
}) => {
  const cases = [
    {
      adaptiveHeight: 44,
      viewport: { height: 800, width: 1440 },
    },
    {
      adaptiveHeight: 44,
      viewport: { height: 1079, width: 1440 },
    },
    {
      adaptiveHeight: 56,
      viewport: { height: 1080, width: 1440 },
    },
    {
      adaptiveHeight: 56,
      viewport: { height: 800, width: 1023 },
    },
    {
      adaptiveHeight: 56,
      viewport: { height: 1080, width: 1920 },
    },
  ] as const;

  for (const { adaptiveHeight, viewport } of cases) {
    await page.setViewportSize(viewport);
    await page.goto("/w/clair-demo/home?modulePanel=open");
    await expectMainContentHeader({ height: 56, mode: "fixed", page });

    await page.goto("/w/clair-demo/customer?modulePanel=open");
    await expectMainContentHeader({
      height: adaptiveHeight,
      mode: "adaptive",
      page,
    });
  }
});

test("top-level modules use the intended main-content header ownership", async ({
  page,
}) => {
  await page.setViewportSize({ height: 1080, width: 1920 });

  const modules: Array<{
    mode: HeaderHeightMode;
    moduleId: string;
  }> = [
    { mode: "fixed", moduleId: "home" },
    { mode: "fixed", moduleId: "treatment" },
    { mode: "fixed", moduleId: "lab" },
    { mode: "fixed", moduleId: "imaging" },
    { mode: "fixed", moduleId: "dispensing" },
    { mode: "adaptive", moduleId: "orders" },
    { mode: "fixed", moduleId: "billing" },
    { mode: "fixed", moduleId: "inpatient" },
    { mode: "adaptive", moduleId: "customer" },
  ];

  for (const { mode, moduleId } of modules) {
    await page.goto(`/w/clair-demo/${moduleId}?modulePanel=open`);
    await expectMainContentHeader({ height: 56, mode, page });
  }
});

test("all hospital-admin and customer pages use one compact adaptive header", async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 1440 });

  const hospitalSections = [
    "orders",
    "members",
    "audit",
    "settings",
    "settings-contact",
    "settings-hours",
    "schedule",
    "roles",
    "vitals",
    "space-time",
  ] as const;

  for (const section of hospitalSections) {
    await page.goto(
      `/w/clair-demo/orders?modulePanel=open&section=${section}`,
    );
    await expectMainContentHeader({
      height: 44,
      mode: "adaptive",
      page,
    });
  }

  await page.goto("/w/clair-demo/customer?modulePanel=open");
  for (const mode of ["patient", "guardian", "deleted"] as const) {
    await page.getByTestId(`customer-side-panel-${mode}`).click();
    await expectMainContentHeader({
      height: 44,
      mode: "adaptive",
      page,
    });
  }
});

test("clinical modules preserve a 56px header with no selected context", async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 1440 });

  for (const moduleId of [
    "treatment",
    "lab",
    "imaging",
    "dispensing",
    "billing",
  ] as const) {
    await page.goto(
      `/w/${PREPARED_EMPTY_CLINIC_WORKSPACE_ID}/${moduleId}?modulePanel=open&aside=closed&right=closed`,
    );
    await expectMainContentHeader({ height: 56, mode: "fixed", page });
  }
});

test("clinical modules preserve a 56px header with selected context", async ({
  page,
}) => {
  await page.setViewportSize({ height: 800, width: 1440 });
  const selectedContextQuery =
    "scenario=kong-vomit&patientId=patient-kong&encounterId=encounter-kong-260501&labResultId=lab-result-kong-cbc&imagingStudyId=imaging-kong-abdomen&invoiceId=invoice-kong-260501&modulePanel=open&aside=closed&right=closed";

  for (const moduleId of [
    "treatment",
    "lab",
    "imaging",
    "dispensing",
    "billing",
  ] as const) {
    await page.goto(`/w/clair-demo/${moduleId}?${selectedContextQuery}`);
    await expectMainContentHeader({ height: 56, mode: "fixed", page });
  }
});
