---
id: ENGINEERING-DB-PR-001
status: human_review
area: engineering
type: Work Item
title: Supabase Migration History Reconciliation
description: Reconciles remote-only migration versions without executing unrelated pending migrations.
tags:
  - supabase
  - migrations
  - release
---

# ENGINEERING-DB-PR-001 — Supabase Migration History Reconciliation

## Goal

Make every remotely recorded Supabase migration version discoverable in the repository while preserving genuinely pending local migrations as pending.

## Scope

- verify identical SQL before mapping timestamp aliases
- preserve four remote-only SQL migrations in `supabase/migrations`
- add twelve no-op remote-history alias files for byte-normalized identical SQL
- mark only the twelve verified canonical versions as applied in remote history
- document the remaining seventeen genuine pending migrations

## Out Of Scope

- applying the seventeen pending migrations
- changing application data, schema objects, RLS, or functions during history repair
- deleting remote migration records

## Verification

- fresh local Supabase reset/replay
- focused alias and remote-SQL preservation test
- remote migration list reports zero remote-only versions
- remote dry-run identifies only the seventeen genuine pending migrations

## Result

Implemented and handed off for Human Review on 2026-07-12.
