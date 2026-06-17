---
id: ENGINEERING-OPERATIONS-FIXED-STAGING-ALIAS-AUTOMATION
status: approved
area: engineering
doc_type: operating-runbook
related_work:
  - RELEASE-OPS-PR-002
last_updated: 2026-06-16
---

# Fixed Staging Alias Automation

This runbook defines the repo-owned automation that keeps the fixed staging URL pointed at the latest successful `staging` branch Vercel deployment.

## URLs

| Purpose | URL |
| --- | --- |
| Fixed staging URL | `https://emr-app-shell-prototype-staging-mcso0s-projects.vercel.app` |
| Automatic `staging` branch URL | `https://emr-app-shell-prototype-git-staging-mcso0s-projects.vercel.app` |

## Automation

- Workflow: `.github/workflows/fixed-staging-alias.yml`
- Script: `scripts/update-fixed-staging-alias.mjs`
- Trigger: GitHub `deployment_status` success event; the workflow updates the alias only when the deployment SHA matches current `origin/staging`
- Action: inspect the successful Vercel deployment URL, then run `vercel alias set <deployment-url> emr-app-shell-prototype-staging-mcso0s-projects.vercel.app`

The script rejects:

- the fixed staging alias as its own source URL;
- non-Vercel URLs;
- Vercel URLs outside this project naming pattern;
- real alias changes when `VERCEL_TOKEN` is missing.

Manual workflow dispatch defaults to `dry_run: true`, so it can validate the target without moving the alias.

## Required GitHub Secret

Add this in GitHub repository settings under `Settings -> Secrets and variables -> Actions -> Repository secrets`:

| Secret | Required | Value |
| --- | --- | --- |
| `VERCEL_TOKEN` | Yes for real alias updates | A Vercel access token that can inspect deployments and assign aliases in the `mcso0s-projects` scope for project `emr-app-shell-prototype` |

Do not commit the token, print it in logs, paste it into docs/chat, or assign it to a `NEXT_PUBLIC_*` variable.

The workflow hardcodes non-secret public values:

- `FIXED_STAGING_ALIAS=emr-app-shell-prototype-staging-mcso0s-projects.vercel.app`
- `STAGING_BRANCH_ALIAS=emr-app-shell-prototype-git-staging-mcso0s-projects.vercel.app`
- `VERCEL_SCOPE=mcso0s-projects`

## Local Dry Run

Use the branch alias or a generated Ready deployment URL:

```bash
VERCEL_DEPLOYMENT_URL=https://emr-app-shell-prototype-git-staging-mcso0s-projects.vercel.app npm run release:staging-alias:dry-run
```

The dry run validates the URL and prints the Vercel CLI command plan with any token redacted. It does not change the alias.

## Post-Deploy Smoke Checklist

After a `staging` branch deployment completes and the alias workflow runs, verify:

- [ ] Fixed staging URL points to the latest Vercel deployment expected for `staging`.
- [ ] 진료/차트 screen loads at `https://emr-app-shell-prototype-staging-mcso0s-projects.vercel.app/w/workspace-clair-cheongdam/treatment?modulePanel=open&aside=closed&right=closed`.
- [ ] 세션 초기화 button is visible.
- [ ] 진료 대기열 sort/filter/display/search controls show the compact header form: visible `요청순`, filter icon, `M` density button, and search icon.
- [ ] 조제/처치 대기열 sort/filter/display/search controls show the same compact header form.
- [ ] Clicking the search icon opens inline search without showing the old header text as the main UI.
- [ ] Selecting a patient or queue item does not break the main chart, patient context, or dispensing/treatment detail surface.

## Stop Conditions

Stop and report instead of changing the alias when:

- GitHub `CI` or `Secret Scan` is failing or unknown for the source PR/merge;
- the deployment URL is not from the `staging` branch or an approved integration branch;
- the workflow would require exposing a Vercel token or other secret;
- production URLs, production aliases, real data, remote DB mutations, email, payments, or provider side effects are involved.

## References

- Vercel CLI alias docs: <https://vercel.com/docs/cli/alias>
- Vercel Git deployment docs: <https://vercel.com/docs/git>
- Vercel branch domain docs: <https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch>
- GitHub deployment status docs: <https://docs.github.com/actions/deployment/about-deployments/deploying-with-github-actions>
