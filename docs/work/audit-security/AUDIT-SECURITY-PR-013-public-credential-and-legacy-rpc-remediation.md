---
id: AUDIT-SECURITY-PR-013
status: human_review
area: audit-security
priority: P0
target_pr: 995
owner: Codex
updated: 2026-10-17
---

# Public Credential And Legacy RPC Remediation

## Goal

Close published fixed authentication credentials and the legacy laboratory getter permission bypass with minimal changes, while preserving normal authentication and permitted laboratory reads.

## Approved Scope

- Direct user approval on 2026-10-17 authorizes PR #988 exact-head merge, then the reported critical fixes in order.
- Inspect only aggregate account/session and schema metadata needed to identify affected synthetic seed accounts.
- Rotate or disable exposed synthetic credentials and revoke affected sessions on the currently connected project; preserve unaffected personal accounts and clinical records.
- Remove fixed credential provisioning from migrations, seeds and replay snippets; prevent reintroduction and document the supported local credential setup.
- Add and apply a forward migration revoking direct client execution of the legacy laboratory getter while preserving permitted wrapper calls.
- Verify denied and allowed paths without returning private result data or printing credentials.

## Out Of Scope

- Usage/cost investigation and remediation: explicitly paused by the user on 2026-10-17.
- Storage quotas, CAPTCHA rollout, dependency upgrades, history rewrite, other security findings and broad policy changes.
- Real patient/guardian/billing data changes, outbound email, paid upgrades or provider changes.
- Automatic main merge of a new, unreviewed candidate; retain the exact-candidate release gate.

## Done Criteria

- Published passwords no longer authenticate affected seed identities; affected sessions cannot refresh. Account recovery/legitimate access impact is explicit.
- Fresh seed/replay cannot recreate a published fixed password or overwrite an existing valid password with a default.
- Authenticated clients cannot execute the legacy getter directly; the current getter's lab:view and workspace checks remain intact.
- Focused security and compatibility tests, local secret/docs gates and exact-candidate CI pass.
- Remote operations, source changes, verification limits and any remaining main approval are distinguished.

## Sources And Verification

- Existing public credential and legacy-getter findings from the 2026-10-17 security review.
- `docs/engineering/auth-security/auth-login/workspace-auth-local-validation-and-seed.md`
- `.agents/skills/release-deployment-ops/SKILL.md`
- Source fixtures and lab/auth contract tests, hosted aggregate metadata, rollback-only authorization checks and function ACL verification.

## Progress

- PR #988 merged at `8350ae7991653baa98b98813b2195e59908bedad`; main push Release Check passed and its Production deployment reached Ready.
- The user changed the current synthetic administrator password in the app. Live aggregate comparison then found 27 other accounts still matching a published credential.
- Applied `20261017060638_rotate_published_demo_credentials.sql` through the Supabase migration tool. Published-credential matches, old demo sessions and old demo refresh tokens are now all zero. The administrator and personal credential fingerprints are unchanged.
- Applied `20261017060654_revoke_legacy_lab_result_getter.sql`. Effective legacy EXECUTE is false for anon/authenticated/service_role; authenticated EXECUTE remains true for the current getter. Current and owner-compatibility function bodies are unchanged.
- Hosted rollback-only checks deny explicit/null-selector legacy calls and allow the current getter with a synthetic missing selector, without returning clinical records.
- Independent candidate review identified a first-apply session-cleanup gap after manual password changes and a Docker readiness race. Both were reproduced and corrected. The isolated SQL harness now covers that first-apply branch and preserves post-migration sessions on replay using applied migration history.
- Local checks passed: focused Playwright contracts (17), local bootstrap tests (2), secret scanner self-tests, isolated PostgreSQL security/compatibility harness, docs, lint, typecheck and production build. The build retains an existing file-tracing warning in the documentation reader.
- Source changes remove fixed password provisioning from all five SQL copies, preserve existing passwords on replay, restrict optional developer bootstrap to localhost, and detect SQL literal passwords in the existing secret gate. No new dependency or application UI change.
- Source PR #995 is prepared; exact-candidate remote CI and Preview are recorded in its checks. New main/Production merge requires its own exact-candidate approval; PR #988 approval does not cover a changed candidate.

## Verification Limits And Follow-Up

- Old refresh/session records were removed. Already-issued access JWTs can remain valid until their configured expiry; no global token policy was changed.
- The current administrator must sign in again with the password they changed privately. Codex did not read that password; a fresh credentialed browser login is a user-side check.
- Other synthetic accounts no longer support the published password. Restore individual access only with privately chosen credentials when needed; do not add a shared public fallback.
- Historical Git commits and private migration history are not rewritten. The exposed value is invalidated instead.
- Usage/cost work remains explicitly paused.
