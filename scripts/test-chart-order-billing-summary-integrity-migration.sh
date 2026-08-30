#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
fixture="$repo_dir/tests/sql/chart_order_atomic_confirmation_contract.sql"
migration="$repo_dir/supabase/migrations/20260831010000_chart_order_billing_summary_integrity.sql"
container="${SUPABASE_DB_CONTAINER:-supabase_db_emr-app-shell-prototype}"

awk -v migration="$migration" '
  BEGIN { print "\\set pr019_migration_reapply true" }
  /^-- PR019_MIGRATION_REAPPLY$/ {
    while ((getline line < migration) > 0) print line
    close(migration)
    next
  }
  { print }
' "$fixture" | docker exec -i "$container" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1
