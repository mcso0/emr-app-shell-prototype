---
id: ENGINEERING-DB-PR-003
status: deferred
area: engineering
type: Work Item
title: Reconcile six public table RLS flags after clean replay
description: Investigate missing RLS activation independently of the helper grant.
tags: [supabase, rls, follow-up]
---

# Public Table RLS Replay Gap

## Goal and Evidence

On 2026-10-27, replay of the first 199 migrations from
`aa26f7c424967a627be498a48f47820562a8702b` left these six tables with RLS disabled:

- billing_checkout_sessions
- billing_checkout_session_invoices
- invoice_adjustments
- payment_allocations
- billing_invoice_status_transition_events
- encounter_call_events

The later diagnostic replay retained the same gap. No direct API CRUD grants
existed for these tables under the no-default-grant configuration. This is a
reproducibility/security-layer gap, not evidence of observed data disclosure.
The prior read-only remote inspection reported RLS enabled; that older snapshot
must not be treated as a current remote verification.

## Proposed Scope and Completion

Inspect the June billing checkout and consultation-flow migrations, dependent
SECURITY DEFINER/INVOKER routines, and actual role access. Prepare explicit RLS
activation only after confirming the intended access boundary. Verify authorized
RPCs, direct-access denial, workspace isolation, and catalog parity after fresh
replay. Do not add broad table grants or invent clinical permission policies.

## Authorization and Dependencies

The user requested task recording only. Implementation, remote reads/writes,
production, and policy changes are not authorized by this document. Keep this
separate from [DB-PR-002](ENGINEERING-DB-PR-002-fulfillment-rls-helper-grant.md).
Use [DB-PR-004](ENGINEERING-DB-PR-004-clean-migration-replay.md) for full replay
prerequisites; bounded schema tests may proceed when separately authorized.

## Sources

- [Billing schema](../../../supabase/migrations/20260601093000_billing_guardian_checkout_hardening.sql)
- [Consultation flow](../../../supabase/migrations/20260625103000_chart_consultation_flow_rpc.sql)

No implementation or remote action performed in this task.
