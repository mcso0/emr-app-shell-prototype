---
id: CUSTOMER-PR-001
status: done
area: customer
priority: P1
target_pr: PR 1
created: 2026-05-06
updated: 2026-05-06
---

# Customer Management Workspace

## Goal

Turn the customer management menu into a guardian/animal master data workspace with a shared patient/guardian drawer available from any module.

## PR-Sized Scope

- Add an HTML wireframe under `docs/reference/customer/` for the customer management workspace.
- Add a `customer` module and route target in the App Shell module registry and nav rail.
- Replace the current nav-only customer action with a real `고객관리` workspace link.
- Build a text navigation side panel for `보호자/동물 관리`, with `동물`, `보호자`, and `삭제된 보호자/동물` entries.
- Add dense animal and guardian tables with session-only search/filtering.
- Reuse the existing patient/guardian registration and profile drawer behavior.
- Support common drawer types `patient` and `guardian`, while preserving existing `reception-patient` and `reception-guardian` compatibility.

## Out Of Scope

- Real DB/API persistence, backend permissions, or live Supabase validation.
- Actual KakaoTalk, SMS, email, document, or referral integrations.
- Full implementation of schedule, outbound message, document, CS-wide, or referral inbox tabs.
- Changes to the current 조제/처치 screen.

## Done Criteria

- `/w/clair-demo/customer` renders a customer management workspace instead of a placeholder.
- The left side panel uses a text navigation list rather than side-panel cards.
- Animal and guardian modes show different table columns and row counts.
- Search filters by animal name, guardian name, phone number, or patient code.
- Clicking an animal row opens the common patient drawer.
- Clicking a guardian row opens the common guardian drawer.
- Common `patient`/`guardian` drawer types work outside reception.

## Source Docs

- `docs/engineering/current-status.md`
- `docs/product/prd/clair-emr-saas-prd.md`
- `docs/product/user-flows/emr-saas-userflow.md`
- `docs/design/reference-screen-index.md`
- `docs/reference/customer/customer-management-wireframe.html`

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/customer.spec.ts tests/reception.spec.ts tests/app-shell.spec.ts --reporter=line`
- Browser visual check for the HTML wireframe and `/w/clair-demo/customer?modulePanel=open&drawer=patient:patient-dubu`.

## Result

- Implemented customer management workspace, nav route, text side panel, animal/guardian tables, and common patient/guardian drawer support.
- Review follow-up: kept `고객관리` grouped with `병원관리` below the clinical workflow divider in the NavRail.
- Review follow-up: extracted the shared page title/action row as `EmrPageHeader` and applied it to the customer content header.
- Review follow-up: corrected the customer content header hierarchy so it shows the selected leaf page (`동물`, `보호자`, or deleted records) and removed the duplicate upper-work tabs from that header.
- Review follow-up: reworked the animal/guardian tables with shadcn Data Table patterns, including row selection, column visibility, row actions, and bottom selection state.
- Review follow-up: removed the redundant `Customer` section label and made customer side-panel groups animated accordions.
- Review follow-up: reused the shared `EmrSubpanelTitle` for the customer side-panel title/collapse header without the order-queue tab group.
- Added focused customer Playwright coverage and updated reception nav/drawer regression coverage.
- Closeout: `docs/completed/customer/customer-management-workspace-closeout.md`
