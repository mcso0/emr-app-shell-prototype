---
id: DOCS-META-gitbook-structure-rules
status: deprecated
area: docs-restructure
doc_type: operating_rule
related_work:
  - DEN-252
  - DEN-256
  - DEN-257
supersedes: []
superseded_by: []
last_updated: 2026-06-11
---

# GitBook Structure Rules

> Inactive/deprecated: GitBook is no longer the active reader path. Preserve this document for history and for a future explicit GitBook revival only. The active reader model is repo `docs/` as source of truth plus the internal `/prd` product-doc viewer.

Use these rules only if 승욱 explicitly revives GitBook navigation or asks to inspect the historical GitBook setup. For current reader changes, update `docs/index.md`, relevant area READMEs, and the `/prd` viewer registry instead.

## Roles

| Surface | Role |
| --- | --- |
| `docs/` | Canonical source of truth for product, design, engineering, work, and completion records. |
| `/prd` app route | Active internal read-only product-doc viewer over curated `docs/product/` Markdown. |
| GitBook | Inactive/deprecated readable portal history. Do not edit GitBook copies as source. |
| `docs/SUMMARY.md` | Legacy GitBook sidebar compatibility map, not active navigation. |
| `docs/index.md` | Human-facing docs portal entry point. |
| Area `README.md` files | Second-level navigation for each docs area. |
| `docs/agent-start-here.md` | Compact Codex startup guide. |
| `docs/engineering/current-status.md` | Current MVP status, scope, and recommended-work summary. |

## Sidebar Rules

- Keep `docs/SUMMARY.md` curated and short enough to scan.
- Link current, high-signal source docs from the sidebar.
- Do not list every child document in the sidebar; use area README files for deeper navigation.
- Keep `Start Here`, operating rules, current product/design/engineering references, work entry points, and history entry points visible.
- Keep `archive/`, `completed/`, compatibility stubs, and long history docs out of the main reading path unless they are intentionally needed.
- When adding a new sidebar entry, verify that the linked document is current, canonical, and useful to a human reader.

## Area README Rules

Each major area README should act as a local index. Keep it concise and include:

- what belongs in the area
- current canonical documents
- subfolder roles
- where new documents should go
- what is historical, moved, compatibility-only, or not source of truth
- relevant approval or verification boundaries

Primary area README files:

- `docs/product/README.md`
- `docs/design/README.md`
- `docs/engineering/README.md`
- `docs/work/README.md`
- `docs/_meta/README.md`
- `docs/completed/README.md`

High-risk or GitBook-exposed subarea README files:

- `docs/product/demo-data/README.md`
- `docs/design/qa/README.md`
- `docs/engineering/data-model/README.md`
- `docs/engineering/operations/README.md`
- `docs/engineering/auth-security/auth-login/README.md`

## Current vs Historical Boundary

- Current guidance belongs in `business/`, `product/`, `design/`, `engineering/`, `work/`, and `_meta/`.
- Finished-work evidence belongs in `completed/`.
- Non-current historical guidance belongs in `archive/`.
- Compatibility stubs may remain at old paths to protect links, but they must point to canonical paths and must not become source-of-truth documents.
- Do not add new source-of-truth documents under `docs/implementation/`.

## Private-First GitBook Boundary

Current GitBook usage is private/internal for easier review by 승욱. Optimize GitBook for fast reading, search, and current-document discovery rather than public marketing, SEO, or external launch documentation.

Private GitBook still needs a reader-boundary check before making sensitive docs prominent:

- real patient, guardian, customer, hospital, payment, identity, or credential data
- secrets, environment variables, tokens, or operational access details
- live Supabase project details, RLS policy claims, migration execution details, or production database assumptions
- production deploy, rollback, monitoring, or incident-response details that should stay internal
- legal, compliance, security certification, or launch-readiness claims that have not been formally approved
- provider, PACS, device, payment, email, KakaoTalk, or third-party integration claims not verified in scope

Use synthetic examples only unless explicit approval says otherwise. Do not claim remote staging, production, live provider integrations, full RLS coverage, or compliance/legal readiness unless the scoped work verified it.

If GitBook is ever changed from private/internal to external-public, create a separate explicit publication review before broad sharing.

Use [GitBook Private Operations Checklist](gitbook-private-operations-checklist.md) before changing GitBook navigation, widening access, sharing private links beyond the current review audience, or considering external-public publication.

Use [GitBook Docs Site Creation Plan](gitbook-docs-site-creation-plan.md) before manually creating or configuring a GitBook docs site for this repo.

## Docs Audit Criteria

Use these criteria when evaluating docs or GitBook structure:

- source-of-truth clarity
- information architecture
- GitBook navigation
- human entry point
- agent entry point
- freshness and drift control
- documentation depth control
- work tracking linkage
- verification gates
- security and privacy boundary
- reader task fit
- duplication control
- naming and lifecycle consistency
- archive hygiene
- RAG and AI readability

## Verification

Run `npm run docs:check` after docs path, link, sidebar, portal, or navigation changes.

If a skill file changes, validate YAML/frontmatter with the available local parser. The system `python3` may not have `PyYAML`; a standard YAML parser such as Ruby's `YAML.safe_load` is an acceptable fallback for syntax validation.
