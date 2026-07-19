---
id: ENGINEERING-OPERATIONS-FIXED-STAGING-ALIAS-AUTOMATION
status: approved
area: engineering
doc_type: operating-runbook
related_work:
  - RELEASE-OPS-PR-002
  - RELEASE-OPS-PR-003
last_updated: 2026-07-18
---

# Fixed Staging Alias Automation

This runbook defines the repo-owned manual workflow that points the fixed staging URL at an approved `staging` branch Vercel deployment without spending Actions minutes on every Preview status event.

## URLs

| Purpose | URL |
| --- | --- |
| Fixed staging URL | `https://emr-app-shell-prototype-staging-mcso0s-projects.vercel.app` |
| Automatic `staging` branch URL | `https://emr-app-shell-prototype-git-staging-mcso0s-projects.vercel.app` |

## Automation

- Workflow: `.github/workflows/fixed-staging-alias.yml`
- Script: `scripts/update-fixed-staging-alias.mjs`
- Trigger: manual `workflow_dispatch` from an approved release/integration task
- Action: inspect the successful Vercel deployment URL, then run `vercel alias set <deployment-url> emr-app-shell-prototype-staging-mcso0s-projects.vercel.app`

The script rejects:

- the fixed staging alias as its own source URL;
- non-Vercel URLs;
- Vercel URLs outside this project naming pattern;
- real alias changes when `VERCEL_TOKEN` is missing.

The workflow defaults to `dry_run: true`, so it can validate the target without moving the alias. A release operator must verify the supplied deployment belongs to `staging` before running with `dry_run: false`.

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

After a `staging` branch deployment completes and an approved operator manually runs the alias workflow, verify:

- [ ] Fixed staging URL points to the latest Vercel deployment expected for `staging`.
- [ ] 진료/차트 screen loads at `https://emr-app-shell-prototype-staging-mcso0s-projects.vercel.app/w/workspace-clair-cheongdam/treatment?modulePanel=open&aside=closed`.
- [ ] 세션 초기화 button is visible.
- [ ] 진료 대기열 sort/filter/display/search controls show the compact header form: visible `요청순`, filter icon, `M` density button, and search icon.
- [ ] 조제/처치 대기열 sort/filter/display/search controls show the same compact header form.
- [ ] Clicking the search icon opens inline search without showing the old header text as the main UI.
- [ ] Selecting a patient or queue item does not break the main chart, patient context, or dispensing/treatment detail surface.

## Stop Conditions

Stop and report instead of changing the alias when:

- GitHub `Release Check` or the local secret gate is failing or unknown for the source PR/merge;
- the deployment URL is not from the `staging` branch or an approved integration branch;
- the workflow would require exposing a Vercel token or other secret;
- production URLs, production aliases, real data, remote DB mutations, email, payments, or provider side effects are involved.

## References

- Vercel CLI alias docs: <https://vercel.com/docs/cli/alias>
- Vercel Git deployment docs: <https://vercel.com/docs/git>
- Vercel branch domain docs: <https://vercel.com/docs/domains/working-with-domains/assign-domain-to-a-git-branch>
- GitHub deployment status docs: <https://docs.github.com/actions/deployment/about-deployments/deploying-with-github-actions>
