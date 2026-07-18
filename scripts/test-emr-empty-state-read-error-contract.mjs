import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentSource = await readFile(
  new URL("../src/components/emr/empty-state.tsx", import.meta.url),
  "utf8",
);
const storySource = await readFile(
  new URL("../src/components/emr/empty-state.stories.tsx", import.meta.url),
  "utf8",
);
const contractSource = await readFile(
  new URL("../docs/design/system/empty-info-state-contract.md", import.meta.url),
  "utf8",
);

assert.match(componentSource, /\| "read-error";/, "read-error must be public");
assert.match(componentSource, /CdsAlertsAlertTriangleIcon/, "read-error must reuse the CDS alert icon");
assert.match(
  componentSource,
  /data-empty-state-icon="read-error"/,
  "the default read-error icon must expose a stable contract hook",
);
assert.match(componentSource, /data-kind=\{kind\}/, "the component must expose its registered kind");

assert.match(storySource, /export const ReadErrorRecovery/, "Storybook must document recovery");
assert.match(storySource, /kind="read-error"/, "the story must render the registered state");
assert.match(storySource, /testId="read-error-recovery"/, "the story must expose a QA hook");
assert.match(
  componentSource,
  /data-slot="actions"[\s\S]*?\{secondaryAction\}[\s\S]*?\{primaryAction\}/,
  "the shared action slot must render secondary before primary",
);
assert.match(
  storySource,
  /Expected the secondary recovery action first\./,
  "the Storybook play contract must assert secondary-first order",
);
assert.match(
  storySource,
  /Expected the primary retry action second\./,
  "the Storybook play contract must assert primary-second order",
);

assert.match(contractSource, /Whole-content read-error exception/);
assert.match(contractSource, /EmrEmptyState kind="read-error"/);
assert.match(contractSource, /Keep `EmrInlineAlert` for partial reads/);

console.log("EmrEmptyState read-error contract: ok");
