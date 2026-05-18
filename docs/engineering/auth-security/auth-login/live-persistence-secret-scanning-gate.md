# Live Persistence Secret Scanning Gate

Updated: 2026-05-18
Linear: DEN-95
Project: `02 Workspace & Membership Live Persistence`

## Summary

DEN-95 adds a local and CI secret scan gate for live persistence work.

## Scanner Choice

The repo uses a small project-owned scanner at `scripts/scan-secrets.mjs` instead of adding an external binary. This keeps local and CI verification reproducible without provisioning or network-dependent secret scanning services.

## Covered Patterns

- Tracked `.env*` and `.vercel/.env*` files.
- OpenAI API key-shaped values.
- Stripe secret key-shaped values.
- Supabase access token-shaped values.
- JWT-like secret values, including service role-shaped keys.
- Database URLs with embedded non-placeholder passwords.
- Secret-looking env assignments such as service role, DB password, database URL, JWT secret, and vendor tokens.
- `NEXT_PUBLIC_*` names that include secret authority terms.

Safe placeholders such as `placeholder`, `replace-me`, `${VAR}`, and localhost database examples are allowed.

## CI

`.github/workflows/secret-scan.yml` runs `npm run security:secrets` on pull requests and pushes to `main`.

## Verification

- `node scripts/scan-secrets.mjs --self-test`
- `npm run security:secrets`
- `git ls-files '.env*' '.vercel/.env*' '**/.env*'`

No tracked env files were found.

Remote secret stores, real secret creation, secret rotation, and production deploy settings remain out of scope.
