---
id: ENGINEERING-OPERATIONS-LAUNCH-READINESS-CHECKLIST
status: approved
area: engineering
doc_type: checklist
related_work:
  - DEN-182
supersedes: []
superseded_by: []
last_updated: 2026-05-20
---

# Launch Readiness Checklist

This checklist defines what must be true before CLAiR EMR can move from local-first Product MVP work toward representative pilot or live launch.

Product MVP ready does not mean production launch.

## Pilot Review Readiness

- [ ] Product MVP scope and non-goals are current.
- [ ] Outpatient workflow state model is current.
- [ ] Domain entity map is current.
- [ ] Role/permission source map is current.
- [ ] Mock/live boundary is stated for the work being reviewed.
- [ ] Product MVP QA scenarios pass or blockers are documented.
- [ ] Known open product decisions are listed.

## Security And Data Readiness

- [ ] Active membership and workspace isolation are enforced for scoped protected paths.
- [ ] Cross-workspace denial regressions pass for relevant mutations.
- [ ] Persistence/data security checklist passes for scoped workflows.
- [ ] No real data is used in development/demo evidence.
- [ ] No secrets appear in repo, docs, Linear, screenshots, or reports.
- [ ] Audit events exist or are planned for critical transitions.

## Remote/Production Approval Gates

Explicit approval is required before:

- remote Supabase link, SQL, migration push, dashboard mutation, or staging secrets
- production deploy or customer-facing environment switch
- real email delivery
- payment/subscription provider setup
- real data import or entry
- role/permission policy change

Approval must name environment, operation, configuration source, verification plan, and rollback/stop condition.

## Operational Readiness

- [ ] Owner and reviewer are named for launch/pilot event.
- [ ] Smoke test path is documented.
- [ ] Rollback or stop condition is documented.
- [ ] Monitoring/log redaction expectations are documented before production.
- [ ] Support path for login/workspace/invite failures is documented.

## Related Docs

- [Product MVP Scope](../../product/roadmap/product-mvp-scope.md)
- [Product MVP QA Scenario Pack](../testing/product-mvp-qa-scenario-pack.md)
- [Persistence And Data Security Checklist](../auth-security/persistence-data-security-checklist.md)
- [SaaS Launch Approval Gates](../auth-security/auth-login/saas-launch-approval-gates.md)
- [MVP Pilot Readiness Criteria](../auth-security/auth-login/mvp-pilot-readiness-criteria.md)

