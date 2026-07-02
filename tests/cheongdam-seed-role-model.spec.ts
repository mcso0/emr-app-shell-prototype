import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const seedSql = readFileSync("supabase/seed.sql", "utf8");
const cheongdamMasterSeedSql = readFileSync(
  "supabase/snippets/den-468-491_cheongdam_master_seed.sql",
  "utf8"
);

const cheongdamSources = [
  { name: "supabase/seed.sql", sql: seedSql },
  {
    name: "supabase/snippets/den-468-491_cheongdam_master_seed.sql",
    sql: cheongdamMasterSeedSql,
  },
];

const realisticStaffNames = [
  "서지훈",
  "임유진",
  "이수지",
  "송하윤",
  "최유나",
  "김도윤",
  "박서연",
  "정민재",
  "최하린",
  "오지훈",
  "한가연",
  "윤태오",
  "문은서",
  "서재원",
];

const forbiddenRoleLikeNames = [
  "청담 원장",
  "청담 병원관리자",
  "청담 관리자",
  "청담 수의사",
  "청담 테크니션",
  "청담 데스크",
];

test("Cheongdam staff seeds use realistic names without role-like display names", () => {
  for (const source of cheongdamSources) {
    for (const forbiddenName of forbiddenRoleLikeNames) {
      expect(source.sql, `${source.name} should not include ${forbiddenName}`).not.toContain(
        forbiddenName
      );
    }

    for (const staffName of realisticStaffNames) {
      expect(source.sql, `${source.name} should include ${staffName}`).toContain(
        `'${staffName}'`
      );
    }
  }
});

test("Cheongdam seeds assign permission roles and job positions separately", () => {
  for (const source of cheongdamSources) {
    expect(source.sql).toContain("insert into public.workspace_permission_roles");
    expect(source.sql).toContain("insert into public.workspace_job_positions");
    expect(source.sql).toContain(
      "insert into public.workspace_membership_permission_role_assignments"
    );
    expect(source.sql).toContain(
      "insert into public.workspace_membership_job_position_assignments"
    );
    expect(source.sql).toContain("role.role_key = seeded.permission_role_key");
    expect(source.sql).toContain("position.position_key = seeded.job_position_key");

    expect(source.sql).toContain("'owner', '소유자', 'owner'");
    expect(source.sql).toContain("'admin', '관리자', 'admin'");
    expect(source.sql).toContain("'general', '일반', 'standard'");
    expect(source.sql).toContain("'hospital_director', '병원장'");
    expect(source.sql).toContain("'veterinarian', '수의사'");
    expect(source.sql).toContain("'technician', '테크니션'");
    expect(source.sql).toContain("'front_desk', '데스크'");
  }
});

test("Cheongdam seed roster covers MVP jobs without non-default job positions", () => {
  for (const source of cheongdamSources) {
    expect(source.sql).toContain(
      "'49111000-0000-4000-8000-000000000001', 'workspace-clair-cheongdam', 'owner', 'hospital_director'"
    );
    expect(source.sql).toContain(
      "'49111000-0000-4000-8000-000000000002', 'workspace-clair-cheongdam', 'admin', 'front_desk'"
    );
    expect(source.sql).toContain(
      "'49111000-0000-4000-8000-000000000003', 'workspace-clair-cheongdam', 'general', 'veterinarian'"
    );
    expect(source.sql).toContain(
      "'49111000-0000-4000-8000-000000000004', 'workspace-clair-cheongdam', 'general', 'technician'"
    );
    expect(source.sql).toContain(
      "'49111000-0000-4000-8000-000000000005', 'workspace-clair-cheongdam', 'general', 'front_desk'"
    );

    expect(source.sql).not.toMatch(/'cs'\s*,\s*'CS'/i);
    expect(source.sql).not.toContain("'marketer'");
    expect(source.sql).not.toContain("'designer'");
    expect(source.sql).not.toContain("'마케터'");
    expect(source.sql).not.toContain("'디자이너'");
  }
});
