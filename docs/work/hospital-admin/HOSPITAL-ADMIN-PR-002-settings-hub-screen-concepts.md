---
id: "HOSPITAL-ADMIN-PR-002"
status: "human_review"
area: "hospital-admin"
priority: "P0"
target_pr: "User goal / settings hub planning and screen concepts"
source_docs:
  - "docs/engineering/current-status.md"
  - "docs/product/domain/workspace-hospital-profile.md"
  - "docs/product/domain/workspace-auth-permissions.md"
  - "docs/product/features/hospital-admin/hospital-admin-settings-hub-plan.md"
  - "docs/design/screens/hospital-admin/hospital-admin-settings-hub-ux.md"
dependencies:
  - "HOSPITAL-ADMIN-PR-001"
updated: "2026-07-05"
---

# Hospital Admin Settings Hub Screen Concepts

## Goal

Reframe `병원관리` as the administrator hospital operating settings hub and implement screen-only mock concepts for the priority settings screens.

## Scope

- Document the `병원관리` IA decision and screen responsibilities.
- Remove the top-bar gear button so hospital settings are not duplicated outside `병원관리`.
- Enable static/mock UI screens for:
  - `병원기본설정`
  - `근무표`
  - `역할별 업무 관리`
  - `공간/시간 관리`
  - `바이탈 관리`
- Keep existing `병원구성원 관리`, `감사 로그`, and `Order 관리` behavior available.
- Keep target UI inside the existing `/w/[workspaceId]/orders?modulePanel=open` 병원관리 module.
- Add focused regression coverage that each screen opens from the side panel and top-bar settings is absent.

## Out Of Scope

- DB/API persistence.
- Supabase schema, migrations, RLS, or remote validation.
- Server-side permission enforcement changes.
- Real hospital/customer/patient/staff/payment data.
- Order set, printer, data lab, chart template, equipment, narcotics, or department split implementation.
- Replacing the existing membership management implementation.

## Done When

- Product planning doc defines the IA, audit-log decision, and role-work vs member-management boundary.
- Design/UX doc defines the target flows and screen-only implementation checklist.
- The hospital-admin side panel opens every targeted static screen.
- Disabled future items remain marked as unimplemented.
- Existing Order management screen still opens and keeps its table/drawer behavior.
- Top-bar gear button is removed from the shell.
- Focused TypeScript, ESLint, and Playwright checks pass or known pre-existing blockers are recorded.

## Verification

- Passed: `npx tsc --noEmit`
- Passed: `npx eslint src/features/hospital-admin/module.tsx src/features/hospital-admin/store.ts src/shell/top-menu.tsx src/shell/workspace-tabs-bar.tsx tests/hospital-admin.spec.ts tests/app-shell.spec.ts`
- Passed: `npm run docs:check`
- Passed: `npm run build`
- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/hospital-admin.spec.ts --project=chromium --reporter=line`
- Passed: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3106 npx playwright test tests/app-shell.spec.ts --project=chromium -g "workspace tab chrome follows the 10px shell rhythm" --reporter=line`
- Captured browser screenshots under `output/hospital-admin-*-concept.png`.
- Note: a broad `tests/app-shell.spec.ts` run was abandoned because unrelated dispensing/global command tests and a dev-server SIGTERM made the signal unusable. The focused shell test for the top-bar settings removal passed afterward.

## Handoff Notes

- This PR intentionally ships mock/static UI only. It should not claim live persistence or permission completeness.
- `감사 로그` remains in the IA as a minimal admin review surface because settings, membership, chart, order, and billing changes require audit credibility.
- `역할별 업무 관리` is a role work-profile surface, not a replacement for member invitation or permission-role assignment.
- Result report: `docs/completed/hospital-admin/2026-07-05-hospital-admin-settings-hub-screen-concepts-report.html`.
