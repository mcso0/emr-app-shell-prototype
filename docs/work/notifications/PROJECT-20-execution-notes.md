---
id: "PROJECT-20-EXECUTION-NOTES"
status: "human_review"
area: "notifications"
project: "20 CLAiR EMR Global Notification Center v0"
updated: "2026-06-03"
---

# Project 20 Execution Notes

Use these notes when continuing issues in Linear project `20 CLAiR EMR Global Notification Center v0`.

## Requested Working Mode

- Use `superpowers:using-superpowers` when starting or continuing project issues.
- Use `cso` for security/local-first/data-boundary awareness.
- Use the Product Design router and focused Product Design skills when the issue has design, UX, audit, prototype, or visual QA scope.
- Use subagents for bounded sidecar review, exploration, risk checks, or disjoint implementation work when it materially helps.
- For simple, tightly scoped changes, work directly without unnecessary delegation.

## Project Boundaries

- Keep v0 scoped to synthetic fixtures and local-first state.
- Do not expand into live Supabase, RLS, provider delivery, Kakao/SMS/email, service worker, or production deploy.
- Move completed implementation issues to Human Review, not Done, unless 승욱 explicitly accepts the result.

## Human Review State

As of 2026-06-03, DEN-395 through DEN-407 have implementation or documentation handoffs in Human Review. DEN-408 owns the Korean project closeout report and source-doc update. DEN-409 owns the final human review readiness pass.

Representative verification command for the implemented notification v0 suite:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3333 npx playwright test tests/notification-surfaces.spec.ts tests/notification-toast.spec.ts tests/notification-fixtures.spec.ts tests/app-shell.spec.ts -g "notification"
```
