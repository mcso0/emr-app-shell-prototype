# AUTH-PR-036 Live Persistence Secret Scanning Gate

Linear: DEN-95
Status: human_review
Area: auth
Priority: P0
Date: 2026-05-18

## Goal

Add an automated secret scanning gate for live persistence work.

## Scope

- Add a reproducible scanner command.
- Add CI execution for pull requests and pushes to `main`.
- Detect tracked env files and common secret-shaped values.
- Allow safe placeholders and localhost examples.
- Document the scanner boundary and remaining operating risks.

## Out Of Scope

- No real secret creation or storage.
- No remote Supabase, Vercel, Stripe, or OpenAI project changes.
- No secret rotation.
- No production deploy changes.

## Result

Added `scripts/scan-secrets.mjs`, `npm run security:secrets`, and `.github/workflows/secret-scan.yml`.

## Verification

- `node scripts/scan-secrets.mjs --self-test`
- `npm run security:secrets`
- `git ls-files '.env*' '.vercel/.env*' '**/.env*'`
- `npm run docs:check`

Result: passed on 2026-05-18. No tracked env files were found.
