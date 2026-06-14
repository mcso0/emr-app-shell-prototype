# CLAiR Docs IA And Sitemap

Status: draft implementation basis

CLAiR Docs is an internal read-only viewer over curated Markdown in the repo `docs/` tree. The repo remains the source of truth. This sitemap changes the viewer information architecture, not the canonical file locations.

## Goals

- Reorganize the viewer into three top-level areas: `기획`, `디자인`, and `개발`.
- Preserve every currently exposed CLAiR Docs slug.
- Keep existing `/docs?doc=<slug>` and legacy `/prd?doc=<slug>` links compatible.
- Expose design and development docs only through a curated safe reader path.

## Source Areas

| Repo area | Reader role | Default exposure |
| --- | --- | --- |
| `docs/product/` | Product planning source of truth | Included in `기획` |
| `docs/design/` | UX, screen, system, wireframe, and QA guidance | Curated docs only in `디자인` |
| `docs/engineering/` | Architecture, API, testing, and implementation guidance | High-level curated docs only in `개발` |
| `docs/work/` | PR-sized execution tracking | Excluded from default reader |
| `docs/completed/` | Completion evidence and historical closeouts | Excluded from default reader |
| `docs/archive/` | Historical material | Excluded from default reader |
| `docs/_meta/` | Operating rules for agents and docs lifecycle | Excluded from default reader |

## Reader Boundary

Default tabs must not automatically expose auth/security, DB/RLS, launch, operations, completed reports, archive, secrets, real data, provider/payment/email, or production readiness material. Those documents require a separate reader-boundary review before inclusion.

Registry entries must carry these fields:

| Field | Purpose |
| --- | --- |
| `area` | Top-level tab: `planning`, `design`, or `development` |
| `section` | Left-nav section inside the selected tab |
| `order` | Stable sort order inside the section |
| `planningCategory` equivalent | Planning-only first-level IA grouping: product, workflow, feature, domain/policy, current/gap |
| `planningFeature` equivalent | Planning-only second-level feature grouping such as `Auth / 계정 / 권한` or `접수 / 예약` |
| `planningItemKind` equivalent | Planning-only item role such as PRD, feature spec, detail spec, epic index, story index, current state, or gap |
| `audience` | `internal_default`, `internal_review`, or `restricted` |
| `exposure` | `default_tab`, `index_only`, `approval_required`, or `excluded` |
| `sensitivity` | Reader-boundary risk classification |
| `sourceOfTruth` | `canonical`, `evidence`, `historical`, `deprecated`, or `compatibility_stub` |

Only `default_tab` and `index_only` entries are eligible for default nav and search. `approval_required` and `excluded` entries must not appear in default navigation or command search.

## Existing Registry Migration

All existing CLAiR Docs slugs remain valid and move into `기획`.

| Slug | Current group | New tab | New section |
| --- | --- | --- | --- |
| `product-readme` | Start | 기획 | 시작 |
| `product-prd` | Start | 기획 | 시작 |
| `auth-login-onboarding-current-state` | Current State | 기획 | 현재 구현 상태 |
| `role-screen-access-current-state` | Current State | 기획 | 현재 구현 상태 |
| `auth-current-implementation-gap-review` | Current State | 기획 | 현재 구현 상태 |
| `reception-appointment-current-state` | Current State | 기획 | 현재 구현 상태 |
| `saas-operating-map` | Service | 기획 | 서비스 |
| `product-mvp-scope` | Roadmap | 기획 | 로드맵 |
| `outpatient-workflow-state-model` | Domain | 기획 | 도메인 |
| `emr-domain-entity-map` | Domain | 기획 | 도메인 |
| `role-permission-source-map` | Domain | 기획 | 도메인 |
| `workspace-auth-permissions` | Domain | 기획 | 도메인 |
| `workspace-hospital-profile` | Domain | 기획 | 도메인 |
| `order-fulfillment-handoff` | Domain | 기획 | 도메인 |
| `workspace-order-catalog-platform` | Domain | 기획 | 도메인 |
| `features-readme` | Features | 기획 | 기능명세 |
| `auth-foundation-planning-index` | Features | 기획 | 기능명세 |
| `invite-email-delivery-recovery-policy-spec` | Features | 기획 | 기능명세 |
| `clair-internal-operator-recovery-audit-policy-spec` | Features | 기획 | 기능명세 |
| `password-reset-account-recovery-policy-spec` | Features | 기획 | 기능명세 |
| `auth-error-empty-state-ux-spec` | Features | 기획 | 기능명세 |
| `workspace-access-guard-policy-spec` | Features | 기획 | 기능명세 |
| `role-permission-detail-spec` | Features | 기획 | 기능명세 |
| `hospital-admin-member-management-ux-spec` | Features | 기획 | 기능명세 |
| `login-invite-onboarding-spec` | Features | 기획 | 기능명세 |
| `member-role-management-spec` | Features | 기획 | 기능명세 |
| `session-logout-policy-spec` | Features | 기획 | 기능명세 |
| `hospital-profile-onboarding-spec` | Features | 기획 | 기능명세 |
| `reception-appointment-overview` | Features | 기획 | 접수 / 예약 |
| `reception-appointment-users-roles` | Features | 기획 | 접수 / 예약 |
| `reception-appointment-spec` | Features | 기획 | 기능명세 |
| `reception-appointment-epics` | Epics | 기획 | 접수 / 예약 |
| `reception-appointment-epic-appointment-check-in` | Epics | 기획 | 접수 / 예약 |
| `legacy-mvp-feature-spec` | Features | 기획 | 기능명세 |
| `epics-readme` | Epics | 기획 | 에픽 |
| `user-stories-readme` | User Stories | 기획 | 유저 스토리 |
| `decision-log-index` | Decisions | 기획 | 결정 |
| `glossary-readme` | Glossary | 기획 | 글로서리 |
| `user-flows-readme` | User Flows | 기획 | 유저 플로우 |
| `emr-saas-userflow` | User Flows | 기획 | 유저 플로우 |

## Planning Navigation IA

The planning tab should not be a flat document-type list. It should guide a planner from product context into workflow, feature area, detailed specs, epics, stories, and implementation gaps.

Left navigation uses a three-level shape:

```text
기획
- 제품 전체
  - Product Docs
  - Product PRD
  - Product MVP Scope
  - SaaS Operating Map
  - Feature Specs
  - Epics
  - User Stories
  - Glossary
- 메인 업무 흐름
  - 외래 메인 흐름
    - Outpatient Workflow State Model
    - EMR SaaS User Flow
    - User Flows
- 기능 영역
  - Auth / 계정 / 권한
    - Auth Foundation Planning Index
    - Login Invite Onboarding Spec
    - Member Role Management Spec
    - Session Logout Policy Spec
    - Role Permission Detail Spec
    - Auth Login Onboarding Current State
    - Role Screen Access Current State
    - Auth Current Implementation Gap Review
  - 접수 / 예약
    - Overview
    - Users / Roles
    - Feature Spec
    - Epic Index
    - Current State
  - 오더 / 수행
    - Order Fulfillment Handoff
    - Workspace Order Catalog Platform
  - 병원 관리
    - Hospital Profile Onboarding Spec
    - Hospital Admin Member Management UX Spec
  - 전체 MVP 기능
    - Legacy MVP Feature Spec
- 도메인 / 정책
  - EMR Domain Entity Map
  - Role Permission Source Map
  - Workspace Auth And Permissions
  - Workspace Hospital Profile
  - Decision Log Index
```

Feature packages should expose their package-level documents directly in the left navigation. Do not add a generic related-document table above every planning document.

Epic Index documents are the only planning pages that render a registry-driven shadcn `Card` + `Table` + `Badge` index. Each Epic table row links to a separate Epic detail Markdown document. Epic detail documents should render a parent-link button back to their Epic Index.

Feature-specific epic and user-story planning should use this hierarchy:

```text
기능 영역 > 기능 패키지 > Epic Index > Epic detail > User Stories / Acceptance Criteria / Done Criteria
```

User Story files are optional. For the first implementation pass, user stories live inside the Epic detail document as sections to avoid premature file proliferation.

## New Curated Design Entries

| Slug | New tab | New section | Source |
| --- | --- | --- | --- |
| `design-readme` | 디자인 | 시작 | `docs/design/README.md` |
| `design-system` | 디자인 | 디자인 시스템 | `docs/design/system/DESIGN.md` |
| `reference-screen-index` | 디자인 | 화면 기준 | `docs/design/reference-screen-index.md` |
| `design-flows-readme` | 디자인 | UX Flow | `docs/design/flows/README.md` |
| `reception-appointment-flow` | 디자인 | UX Flow | `docs/design/ux-flows/reception-appointment-flow.md` |
| `design-screens-readme` | 디자인 | 화면 기준 | `docs/design/screens/README.md` |
| `design-qa-readme` | 디자인 | UI QA | `docs/design/qa/README.md` |
| `core-workspace-ui-review-checklist` | 디자인 | UI QA | `docs/design/qa/core-workspace-ui-review-checklist.md` |
| `interaction-accessibility-audit` | 디자인 | UI QA | `docs/design/qa/interaction-accessibility-audit.md` |
| `responsive-dense-layout-audit` | 디자인 | UI QA | `docs/design/qa/responsive-dense-layout-audit.md` |
| `clair-docs-ia-sitemap` | 디자인 | 와이어프레임 | `docs/design/wireframes/clair-docs-ia-sitemap.md` |

## New Curated Development Entries

| Slug | New tab | New section | Source |
| --- | --- | --- | --- |
| `engineering-readme` | 개발 | 시작 | `docs/engineering/README.md` |
| `engineering-current-status` | 개발 | 현재 상태 | `docs/engineering/current-status.md` |
| `app-shell-layout-contract` | 개발 | 아키텍처 | `docs/engineering/architecture/app-shell-layout-contract.md` |
| `mock-live-boundary-map` | 개발 | 아키텍처 | `docs/engineering/architecture/mock-live-boundary-map.md` |
| `api-boundary-integration-guide` | 개발 | API 경계 | `docs/engineering/api-boundaries/api-boundary-integration-guide.md` |
| `api-boundary-selectors` | 개발 | API 경계 | `docs/engineering/api-boundaries/api-boundary-selectors.md` |
| `product-mvp-qa-scenario-pack` | 개발 | 테스트 | `docs/engineering/testing/product-mvp-qa-scenario-pack.md` |
| `mvp-gap-analysis` | 개발 | 테스트 | `docs/engineering/testing/mvp-gap-analysis.md` |

## Implementation Notes

- `/docs` should resolve the active area from the selected doc slug when `doc` is present.
- `/docs?area=design` should open the default design doc.
- `/docs?area=development` should open the default development doc.
- Search should include only default/index reader entries and show area, section, and doc type.
- Direct access to a non-registered path or restricted slug should continue to show the existing not-found state.
