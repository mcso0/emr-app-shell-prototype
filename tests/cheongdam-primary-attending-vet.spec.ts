import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const seed = readFileSync("supabase/snippets/den-468-491_cheongdam_master_seed.sql", "utf8");
const update = readFileSync("supabase/snippets/demo-data-pr-003_primary_attending_vet_update.sql", "utf8");

// Cheongdam veterinarians: 이수지 3, 김도윤 6, 박서연 7, 정민재 8, 오지훈 10, 한가연 11.
const veterinarians = new Set([3, 6, 7, 8, 10, 11]);

function seedAssignments() {
  const rows = [
    ...seed.matchAll(
      /\('49121000-0000-4000-8000-0000000000(\d\d)', 'workspace-clair-cheongdam', 'CD-P-.*?'49110000-0000-4000-8000-0000000000(\d\d)', '[a-z_]+', 'CD-KAKAO-/g,
    ),
  ];
  return new Map(rows.map((row) => [Number(row[1]), Number(row[2])]));
}

test("Cheongdam seed patients are spread across the veterinarians", () => {
  const assignments = seedAssignments();
  expect(assignments.size).toBe(25);
  for (const vet of assignments.values()) expect(veterinarians.has(vet)).toBe(true);
  // One shared 주치의 made every chart search card look the same.
  expect(new Set(assignments.values()).size).toBe(veterinarians.size);
});

test("the hosted update snippet carries the same assignments as the seed", () => {
  const pairs = [...update.matchAll(/\((\d+), (\d+)\)/g)].map((pair) => [Number(pair[1]), Number(pair[2])]);
  expect(pairs).toHaveLength(25);
  const assignments = seedAssignments();
  for (const [patient, vet] of pairs) expect(assignments.get(patient), `CD-P-${patient}`).toBe(vet);
  expect(update).toContain("raise exception 'PRIMARY_VET_ROLLBACK");
  expect(update).not.toMatch(/^\s*commit\s*;/im);
});
