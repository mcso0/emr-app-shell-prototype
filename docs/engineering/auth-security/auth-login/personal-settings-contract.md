# Personal settings contract

Updated: 2026-09-08. Implementation evidence: [AUTH-PR-036](../../../work/auth/AUTH-PR-036-personal-settings.md). Remote application and production acceptance are separate gates.

## Profile and navigation

`/profile` has 프로필, 계정·보안 and 알림 categories, a 720px content area, 24px headings and shared hospital-settings primitives. Save affects only the current category. Dirty category/return navigation requires confirmation; browser unload warns while drafts remain. Live profile read errors do not fall back to cached identity.

Account name/contact use the existing own-profile API. Avatar dialog confirmation stages a local file; page save performs the existing private signed-upload/finalize handshake. Status message is workspace scoped, limited to 60 Unicode code points and uses the existing optimistic timestamp conflict contract. Independent successful operations remain saved when a later operation fails; failed drafts remain retryable. Profile changes invalidate the session menu and staff profile display; focused staff edits defer refresh until blur. Mock-only sessions cannot claim avatar, status or notification persistence.

## Password and recovery

`POST /api/users/me/password` validates same-origin JSON, authenticates with server `getUser`, and verifies the current password through an isolated non-persisting Supabase client. The verified actor must equal the cookie-session actor. Password update uses the original session so provider MFA/reauthentication policy remains in force. Successful update signs out the local session and returns to login. Provider errors never produce a success claim. This app endpoint does not change Supabase-wide password policy or assert enforcement against direct provider API calls.

The separate `/reset-password` flow requests provider recovery email with `/auth/password-recovery` as its PKCE redirect. The callback exchanges the code and opens `/reset-password/update`. `GET/POST /api/users/me/password/recovery` require a server-validated claim whose subject matches `getUser` and whose recovery AMR is within one hour; an ordinary password-login session is insufficient. Successful reset signs out the local session. Request/update buttons report errors without exposing provider messages. Provider redirect allowlisting and a real email round trip still need deployment-environment verification; no real email or identity test was performed.

## Workspace notification preferences

`GET/PATCH /api/workspaces/[workspaceId]/members/me/notification-preferences` require an active authenticated app user and active membership. The server derives the owner; request bodies cannot select a user or workspace. The new `workspace_notification_preferences` table has a composite membership foreign key, strict category JSON and RLS limited to self-owned active membership. There is no anon access or client delete grant.

A missing row defaults to popup on, sound off and all four supported categories on. Existing workspace rows are retained; the historical account `notificationOptIn` field is unchanged and is not silently mapped to workspace choices. A database read failure is an error, never an invented default.

Supported categories map to existing event producers: `order_recheck_requested`, `clinical_result_completed`, `waiting_over_30m`, `clinical_master_update_available`. Preferences control only transient popup/sound delivery; the inbox and read/archive state are unchanged. Recipient and toast/source policies apply before preferences. Eligible urgent visual alerts bypass mute/category switches; sound remains optional. Drawer-only and inline-first notifications do not become popups. Ordinary initial backlog does not replay; fresh version/bump delivery is deduplicated. Live snapshots retain the 30-second visible-window refresh cadence and direct focus/resume reads. Each window first performs its own authorized GET. Windows with the same origin and server-verified actor, workspace, and login session may then share periodic snapshots through BroadcastChannel and a visible Web Lock holder. Hidden/page-hidden windows release leadership. Unsupported or stalled sharing falls back to direct reads; retry and successful mutations request fresh data. Logout, session changes, and permission denial cancel pending work and discard shared state. Sharing does not authorize writes or change the existing per-window popup/sound delivery policy; no notification payload is persisted in localStorage. Unknown preferences mute ordinary delivery. Browser audio needs a user gesture after sound is enabled.

## Release dependency and verification boundary

Apply only `20260907152816_personal_settings_notification_preferences.sql` to the separately approved remote target before application release. It creates one empty preference table, policies/index and update trigger; it does not backfill or alter clinical data. The table can remain during an application rollback, preserving preferences for a future retry. Do not drop populated preferences as routine rollback.

Local verification uses an isolated schema clone with synthetic RLS fixtures and a loopback fake Auth/PostgREST server driving real Next route handlers. These prove application paths and SQL isolation, not a real provider email round trip or authenticated production smoke. See the work item for exact results and remaining release gates.
