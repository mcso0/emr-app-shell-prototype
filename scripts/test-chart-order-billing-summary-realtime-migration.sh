#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
fixture="$repo_dir/tests/sql/chart_order_billing_summary_realtime_contract.sql"
pr020_migration="$repo_dir/supabase/migrations/20260831053359_chart_order_mutation_billing_summary.sql"
pr022_migration="$repo_dir/supabase/migrations/20260831073721_chart_order_billing_summary_realtime.sql"
container="${SUPABASE_DB_CONTAINER:-supabase_db_emr-app-shell-prototype}"

awk -v pr020_migration="$pr020_migration" -v pr022_migration="$pr022_migration" '
  /^-- PR020_MIGRATION$/ {
    while ((getline line < pr020_migration) > 0) print line
    close(pr020_migration)
    next
  }
  /^-- PR022_MIGRATION_REAPPLY$/ {
    while ((getline line < pr022_migration) > 0) print line
    close(pr022_migration)
    next
  }
  { print }
' "$fixture" | docker exec -i "$container" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1
