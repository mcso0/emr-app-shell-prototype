import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260831053359_chart_order_mutation_billing_summary.sql",
  "utf8",
);
const sqlReplay = readFileSync(
  "tests/sql/chart_order_mutation_billing_summary_contract.sql",
  "utf8",
);
const confirmationSql = readFileSync(
  "tests/sql/chart_order_atomic_confirmation_contract.sql",
  "utf8",
);
const executionSql = readFileSync(
  "tests/sql/chart_order_revision_attempt_contract.sql",
  "utf8",
);

const mutationFunctions = [
  {
    base:
      "clair_save_chart_order_draft_billing_summary_base(text,text,uuid,jsonb)",
    public: "clair_save_chart_order_draft(text,text,uuid,jsonb)",
  },
  {
    base:
      "clair_confirm_chart_order_candidates_billing_summary_base(text,uuid,uuid,uuid[],text,text)",
    public:
      "clair_confirm_chart_order_candidates(text,uuid,uuid,uuid[],text,text)",
  },
  {
    base:
      "clair_mutate_chart_order_execution_billing_summary_base(text,uuid,uuid,text,text,integer,jsonb,text)",
    public:
      "clair_mutate_chart_order_execution(text,uuid,uuid,text,text,integer,jsonb,text)",
  },
] as const;

test("PR-020 preserves the public mutation signatures and hides every renamed base", () => {
  for (const mutation of mutationFunctions) {
    expect(migration).toContain(`public.${mutation.base}`);
    expect(migration).toContain(`public.${mutation.public}`);
    expect(migration).toContain(
      `revoke all on function public.${mutation.base}\n  from public, anon, authenticated, service_role;`,
    );
    expect(migration).toContain(
      `grant execute on function public.${mutation.public}\n  to authenticated;`,
    );
  }

  expect(migration).not.toMatch(
    /grant execute on function public\.clair_.*billing_summary_base/i,
  );
});

test("PR-020 keeps actor, membership, and action-specific permission checks", () => {
  expect(migration.match(/actor_mismatch/g)).toHaveLength(3);
  expect(
    migration.match(/private\.clair_is_active_workspace_member/g),
  ).toHaveLength(3);
  expect(
    migration.match(/private\.clair_current_user_has_workspace_permission/g),
  ).toHaveLength(6);
  expect(migration).toContain("'chart:update'");
  expect(migration.match(/'chart:view'/g)).toHaveLength(3);
  expect(migration).toContain("then 'billing:issue' else 'order:update' end");
});

test("PR-020 computes the current Summary after each base mutation, including replay", () => {
  const wrapperStarts = [
    migration.indexOf(
      "create or replace function public.clair_save_chart_order_draft(",
    ),
    migration.indexOf(
      "create or replace function public.clair_confirm_chart_order_candidates(",
    ),
    migration.indexOf(
      "create or replace function public.clair_mutate_chart_order_execution(",
    ),
  ];

  for (let index = 0; index < wrapperStarts.length; index += 1) {
    const start = wrapperStarts[index];
    const end = wrapperStarts[index + 1] ?? migration.indexOf(
      "revoke all on function public.clair_save_chart_order_draft(",
      start,
    );
    const wrapper = migration.slice(start, end);
    const baseCall = wrapper.indexOf("_billing_summary_base(");
    const summaryCall = wrapper.indexOf(
      "private.clair_get_chart_order_billing_summary_internal(",
    );

    expect(baseCall).toBeGreaterThan(0);
    expect(summaryCall).toBeGreaterThan(baseCall);
    expect(wrapper).toContain("'billingSummary'");
  }

  expect(
    migration.match(/private\.clair_get_chart_order_billing_summary_internal\(/g),
  ).toHaveLength(3);
});

test("PR-020 migration is directly reapply-safe without widening access", () => {
  expect(migration.match(/to_regprocedure\(/g)).toHaveLength(6);
  expect(migration).toContain("and to_regprocedure(");
  expect(migration).not.toMatch(
    /db_password|SUPABASE_SECRET|real patient|grant all/i,
  );
});

test("PR-020 local replay covers double apply, ACL, and rollback residue", () => {
  expect(
    sqlReplay.match(/PR020_MIGRATION_REAPPLY/g),
  ).toHaveLength(2);
  expect(sqlReplay).toContain("has_function_privilege('authenticated'");
  expect(sqlReplay).toContain("has_function_privilege('anon'");
  expect(sqlReplay).toContain("has_function_privilege('service_role'");
  expect(sqlReplay).toContain("privilege.grantee = 0");
  expect(sqlReplay).toContain(
    "chart_order_mutation_billing_summary_apply_reapply_acl_ok",
  );
  expect(sqlReplay).toContain(
    "chart_order_mutation_billing_summary_permission_boundary_ok",
  );
  expect(sqlReplay).toContain("draft_without_chart_view_accepted");
  expect(sqlReplay).toContain("confirmation_without_chart_view_accepted");
  expect(sqlReplay).toContain("execution_without_chart_view_accepted");
  expect(sqlReplay).toContain("actor_mismatch_accepted");
  expect(sqlReplay).toContain("cross_workspace_mutation_accepted");
  expect(sqlReplay).toContain("rollback;");
  expect(sqlReplay).toContain(
    "chart_order_mutation_billing_summary_rollback_zero_residual_ok",
  );
});

test("PR-020 SQL fixtures compare every mutation and replay Summary to a direct read", () => {
  expect(confirmationSql).toContain(
    "phase4_draft_mutation_summary_mismatch",
  );
  expect(confirmationSql).toContain(
    "phase4_confirmation_mutation_summary_mismatch",
  );
  expect(confirmationSql).toContain(
    "phase4_confirmation_replay_summary_not_current",
  );
  expect(confirmationSql).toContain("not (v_replayed ? 'billingSummary')");
  expect(confirmationSql).toContain(
    "v_confirmed #> '{remainingDraft,etag}'",
  );
  expect(executionSql).toContain("phase5_draft_mutation_summary_mismatch");
  expect(executionSql).toContain(
    "phase5_execution_mutation_summary_mismatch",
  );
  expect(executionSql).toContain(
    "phase5_execution_replay_summary_not_current",
  );
  expect(executionSql).toContain("not (v_replay ? 'billingSummary')");
  expect(executionSql).toContain(
    "95000000-0000-4000-8000-000000000105",
  );
});
