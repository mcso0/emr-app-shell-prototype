---
id: "COMPLETED-HOME-2026-05-09-ROLE-COMMAND-HOME-FOUNDATION"
status: "done"
area: "home"
doc_type: "closeout"
related_work:
  - docs/work/home/HOME-PR-001-role-command-home-foundation.md
completed_at: "2026-05-09"
---

# Role-Based Command Home Foundation Closeout

## Summary

The existing `/w/[workspaceId]/home` route was converted from a Sales Demo launcher default into a role-based hospital command home foundation.

## What Changed

- Added a dedicated `src/features/home/` module with typed home models, role presets, isolated mock data, and reusable command-home components.
- Wired the existing home registry entry to the new `HomeContent`.
- Preserved the previous Sales Demo launcher at `/w/clair-demo/home?view=demo`.
- Added focused Playwright coverage in `tests/home.spec.ts` and updated the sales demo flow to open the preserved demo view.

## Product/UI Result

- Common home sections now show command header, My Work, Hospital Flow, and Alerts & Exceptions.
- Mock auth roles map to role-specific presets for owner, veterinarian, technician, desk, and hospital administrator views.
- The foundation is data-source agnostic and intentionally avoids real mutations, live API calls, realtime sockets, and drag/drop personalization.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/home.spec.ts tests/sales-demo-flow.spec.ts --reporter=line`
- Browser DOM/visible-text check on `/w/clair-demo/home` and `/w/clair-demo/home?view=demo`
- `npx playwright test tests/auth.spec.ts tests/app-shell.spec.ts --reporter=line`

## Notes

No stored home reference screenshot exists under `docs/design/assets/reference-screens/`, so this closeout records structural/product alignment rather than pixel-level alignment.
The in-app browser screenshot capture timed out during QA, but Browser DOM checks confirmed the command home, preserved demo view, and zero console errors.
