---
id: "CUSTOMER-PR-002"
status: "human_review"
area: "customer"
priority: "P0"
target_pr: "User approval / patient and guardian profile side panel"
source_docs:
  - "docs/design/system/patient-guardian-profile-side-panel.md"
  - "docs/work/customer/CUSTOMER-LIVE-PR-004-guardian-profile-persistence.md"
  - "docs/work/customer/CUSTOMER-LIVE-PR-005-patient-profile-persistence.md"
  - "docs/work/customer/CUSTOMER-LIVE-PR-006-relationship-management-persistence.md"
dependencies:
  - "RECEPTION-PR-012"
updated: "2026-07-20"
---

# Patient and Guardian Profile Side Panel

## Goal

Move patient and guardian profiles into the approved 380px non-modal profile hierarchy and enforce admin-only master-data and relationship mutations through UI, API, RLS, and audit boundaries.

## Scope

- Extract the shared structural profile side-panel shell and adopt it in staff, patient, guardian, and the staff Storybook specimen.
- Replace the patient/guardian three-tab drawers with `프로필` and `이력`.
- Add collapsible linked guardian/animal groups and source navigation.
- Move basic-information editing to an admin-only footer.
- Separate patient, guardian, and relationship management permissions from operational `patient:update`.
- Add live patient profile gateway parity, a relationship route and transactional RPC, admin-only RLS, and redacted audit records.
- Keep clinical, test, billing, and consent source records read-only in this profile surface.

## Out Of Scope

- Editing clinical, lab, imaging, billing, or consent source records from the profile.
- Real patient/guardian data import or remote migration application.
- Deployment, commit, push, or PR creation.

## Done When

- Patient/guardian panels are 380px and non-modal with `프로필` and `이력` tabs.
- General users can read but cannot see or invoke master-data/relationship editing.
- Server tests prove the new permissions and workspace isolation.
- RLS and the relationship RPC enforce owner/admin writes and retain at least one guardian.
- Audit rows store redacted changed fields and request/result metadata.
- Focused browser tests, typecheck, docs check, and secret scan pass.

## Verification

- Customer profile server, live permission wiring, relationship, RLS contract, and customer UI suite: `33 passed`.
- Reception patient profile focused flows: `2 passed`.
- Shared staff profile shell keyboard/non-modal regression: `1 passed`.
- `npx tsc --noEmit`, focused ESLint, `npm run docs:check`, and `npm run security:secrets`: passed.
- `npm run build` and `npm run build-storybook`: passed with existing bundle/font warnings only.
- The migration executed against local synthetic Supabase and a second transaction-wrapped replay rolled back successfully. Remote migration application remains out of scope.
