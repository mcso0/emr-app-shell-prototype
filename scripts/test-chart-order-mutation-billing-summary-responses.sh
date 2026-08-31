#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
migration="$repo_dir/supabase/migrations/20260831053359_chart_order_mutation_billing_summary.sql"
container="${SUPABASE_DB_CONTAINER:-supabase_db_emr-app-shell-prototype}"

run_fixture() {
  local fixture="$1"
  awk -v migration="$migration" '
    !injected && /^begin;$/ {
      print
      while ((getline line < migration) > 0) print line
      close(migration)
      injected = 1
      next
    }
    { print }
  ' "$fixture" | docker exec -i "$container" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1
}

run_fixture "$repo_dir/tests/sql/chart_order_atomic_confirmation_contract.sql"
run_fixture "$repo_dir/tests/sql/chart_order_revision_attempt_contract.sql"
