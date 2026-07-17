import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentSource = await readFile(
  new URL("../src/components/emr/animal-patient-avatar.tsx", import.meta.url),
  "utf8",
);
const storySource = await readFile(
  new URL("../src/components/emr/animal-patient-avatar.stories.tsx", import.meta.url),
  "utf8",
);
const screenSource = await readFile(
  new URL("../src/features/chart/preconsultation-context-panel.tsx", import.meta.url),
  "utf8",
);

assert.match(componentSource, /export function AnimalPatientAvatar/);
assert.match(componentSource, /AvatarImage/);
assert.match(componentSource, /AvatarFallback/);
assert.match(componentSource, /data-avatar-state=\{displayState\}/);
assert.match(componentSource, /"sm" \| "md" \| "lg"/);
assert.match(componentSource, /CdsGnbPetGnbIcon/);

for (const story of ["Image", "Fallback", "Loading", "Error", "SizeScale"]) {
  assert.match(storySource, new RegExp(`export const ${story}`));
}

assert.match(
  screenSource,
  /<AnimalPatientAvatar[\s\S]*?alt=\{`\$\{context\.patient\.name\} 동물 환자 프로필`\}/,
  "the preconsultation header must consume the shared animal avatar",
);

console.log("AnimalPatientAvatar contract: ok");
