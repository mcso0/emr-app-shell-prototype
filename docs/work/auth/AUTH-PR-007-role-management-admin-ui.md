# AUTH-PR-007 Role Management Admin UI

Status: human_review
Linear: DEN-25
Priority: P0

## Goal

Add a session-only admin UI for inspecting and editing workspace member roles, including effective permission summaries and last active hospital admin protection.

## Source Docs

- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/product/domain/workspace-auth-permissions.md`
- `docs/work/auth/AUTH-PR-006-server-permission-resolver-contract.md`
- Linear `DEN-25`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`

## Scope

- Extend `병원구성원 관리` to show role management actions for active members.
- Show member email, roles, status, effective permission summary, and title/department.
- Allow `hospital_admin` users to edit active member roles in session-only state.
- Support multi-role assignment across canonical roles: `hospital_admin`, `vet`, `technician`, `front_desk`.
- Add role-change confirmation before saving.
- Allow member deactivation with confirmation.
- Block demoting or deactivating the last active `hospital_admin`.
- Add contract helpers for session-only membership role updates and deactivation.
- Add Playwright coverage for role edits, effective permission summaries, last-admin protection, and mutation contract behavior.

## Out of Scope

- Custom roles beyond canonical MVP roles.
- Fine-grained per-user deny rules.
- Real audit log persistence.
- Live database writes.
- API Route Handler, Server Action, or RLS enforcement.

## Done Criteria

- Admin can inspect and modify member roles in the member management UI.
- Multi-role changes persist to browser-backed session workspace state.
- Last active `hospital_admin` protection cannot be bypassed through the UI or session contract helper.
- Non-admin users remain blocked from member mutations.
- Linear `DEN-25` can move to Human Review.

## Verification

```bash
npx playwright test tests/auth.spec.ts --reporter=line
npm run lint -- --ignore-pattern '.worktrees/**'
npx tsc --noEmit
npm run build
npx playwright test tests/auth.spec.ts tests/permission-resolver.spec.ts tests/app-shell.spec.ts --reporter=line
npm run docs:check
```

Results:

- Red: `npx playwright test tests/auth.spec.ts --reporter=line` failed because role edit buttons and membership mutation helpers did not exist.
- Focused role edit tests passed after implementation:
  - `hospital admin can edit active member roles with permission summary`
  - `role management UI blocks last active hospital admin demotion and deactivation`
  - `workspace membership role mutation contract protects the last active hospital admin`
- `npx playwright test tests/auth.spec.ts --reporter=line`: passed, `23 passed`.
- `npm run lint -- --ignore-pattern '.worktrees/**'`: passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npx playwright test tests/auth.spec.ts tests/permission-resolver.spec.ts tests/app-shell.spec.ts --reporter=line`: passed, `59 passed`.
- `npm run docs:check`: passed, `547 docs/agent markdown files` checked.
- Local browser smoke via Playwright against `http://localhost:3000`: role summary rendered and last-admin guard message was visible.

## Notes

- This remains session-only. Role edits and deactivation are persisted to browser storage only.
- The UI uses the existing `병원구성원 관리` entry point instead of adding a new hospital admin section.
- Last-admin protection is implemented in both session contract helpers and UI flows, but live DB transaction/RPC protection remains future work.
