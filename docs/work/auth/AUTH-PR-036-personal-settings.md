---
id: AUTH-PR-036
status: in_progress
area: auth
priority: P0
last_updated: 2026-09-08
---

# Personal settings

## Goal and authorization

Implement the accepted personal settings design: 프로필 / 계정·보안 / 알림. User approved implementation, commit, push, PR and production delivery on 2026-09-08. Exact release gates remain applicable. Local synthetic schema and boundary verification are in scope; remote migration application requires its concrete reviewed packet. No real identity/password/email or customer-data test mutations are authorized.

## Scope

- Mirror hospital summary settings geometry with shared primitives, preserving `/profile` and safe work return.
- Account name/contact, draft avatar with final-save upload, workspace status (60 code points), partial-save recovery and dirty-navigation protection.
- Current-password verified change and a separate password recovery flow.
- Self-owned workspace notification preferences: four actual producer categories, popup on and sound off defaults. Keep legacy notificationOptIn untouched; a new workspace preference has no inferred mapping from that historically unused account flag.
- Preserve notification inbox, recipient/source eligibility, drawer-only policy and urgent visual delivery. Connect actual transient popup/sound delivery.
- Local schema/RLS and focused UI/security tests, then candidate and release verification.

## Exclusions

Theme, email identity changes, role/permission changes, new event producers, real email sending, and unrelated WIP.

## Sources

- [Existing persistence](AUTH-PR-035-personal-profile-live-persistence.md)
- [Release runbook](../../engineering/operations/production-release-pr-to-main-runbook.md)
- `src/features/hospital-admin/settings/hospital-settings-page.tsx`
- `src/features/notifications/notification-surface-rules.ts`
- Supabase password guide and installed SDK types (`current_password`).

## Done criteria and verification

All three categories persist only their own edits; failed operations retain drafts; foreign workspace/user access fails; urgent visual remains eligible when muted; inbox is unchanged. Verify desktop/mobile geometry, navigation, avatar staging, password errors, reload, preference delivery, local RLS isolation, lint/typecheck/build, secret/docs checks, exact Release Check and Preview. Production remains unverified until delivered under the release runbook.

## Duplicate check and dependencies

AUTH-PR-035 covers previous basic profile persistence and explicitly excludes security workflows. This separately scoped work extends it. New preference schema must be installed before its application is released. Dependencies were installed with the existing lockfile in the isolated delivery worktree; original WIP remains untouched.

## Local implementation evidence (2026-09-08)

- Delivery worktree: `codex/personal-settings-delivery`; original checkout WIP preserved.
- [Owning contract](../../engineering/auth-security/auth-login/personal-settings-contract.md) and route inventory updated.
- Real Next route handlers with loopback synthetic Auth/PostgREST: 10 passed. Includes current-password mismatch/actor mismatch/update failure, successful session clearing, recovery AMR denial/success, preference owner/workspace and inactive-member boundaries, email-request interception and all three categories at 1728, 1440 and 390px (no horizontal overflow).
- Story interactions: 6 profile cases passed; 4 recovery/delivery cases passed after waiting for asynchronous proof readiness. Covers draft avatar, partial save, dirty navigation, failed read, password validation and muted urgent delivery.
- Focused contract/profile/avatar/toast regression: 29 passed.
- Isolated local PostgreSQL schema clone: preference migration and synthetic transactional RLS checks passed (self read/write, other owner/workspace, inactive member, anon and malformed JSON). No existing local or remote database was reset. Security advisor found no new-table findings; 23 inherited clone findings remain outside this change.
- Full lint, TypeScript and initial production build passed; secrets, docs, Korean UX copy and diff whitespace checks passed. Final candidate checks follow after incorporating current main.
- Remote schema application, real provider email/redirect round trip, Preview and production smoke are not yet verified. This is implementation/validation evidence, not human acceptance.
