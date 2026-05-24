---
id: DOCS-AUDIT-2026-05-23-gitbook-docs-structure
status: approved
area: docs-restructure
doc_type: closeout
related_work: []
supersedes: []
superseded_by: []
last_updated: 2026-05-23
---

# GitBook Docs Structure Audit

## Summary

The CLAiR EMR docs system is directionally strong: repo `docs/` is the source of truth, GitBook is a curated portal, startup docs are short, and link validation is automated. The main risk is not broken navigation; it is operational drift from a large document set, many Human Review work items, mixed frontmatter coverage, and compatibility stubs that can still appear in searches.

## External Benchmarks

- GitBook recommends information architecture around real workflows, predictable labels, links, and maintainable structure.
- GitBook page guidance recommends avoiding more than three nesting levels in navigation and using `SUMMARY.md` link titles when Git Sync is used.
- Docs-as-code practice treats docs as versioned, reviewed, tested plain-text artifacts tied to issue tracking and code review.
- Diataxis-style documentation separates learning, task, reference, and concept material so readers can find the right kind of answer.
- Google developer docs guidance prioritizes project-specific style first, then clarity and consistency.
- Accessible docs guidance favors semantic headings, clear links, readable tables, and concise navigable structure.

## Observed Metrics

| Metric | Result |
| --- | --- |
| Markdown files under `docs/` | 513 |
| HTML files under `docs/` | 243 |
| Markdown plus HTML files under `docs/` | 756 |
| GitBook sidebar links in `docs/SUMMARY.md` | 53 |
| Markdown files with frontmatter at file start | 262 / 513 |
| Work index status distribution | 48 `done`, 109 `human_review` |
| Internal docs link check | `npm run docs:check` passed, 799 docs/agent markdown files checked |

## Scorecard

| Criterion | Score | Evidence | Risk |
| --- | ---: | --- | --- |
| Source of truth clarity | 8 | `docs/index.md`, `docs/README.md`, and `docs/SUMMARY.md` clearly say repo `docs/` is canonical and GitBook is a portal. | Compatibility paths can still show up in search and confuse readers. |
| Information architecture | 8 | Top-level areas map well to business, product, design, engineering, work, completed, and archive. | Legacy root folders and `implementation/` remain as stubs. |
| GitBook navigation | 8 | Sidebar is curated and shallow with Start Here, Operating Rules, Product, Design, Engineering, Work, and history sections. | Some high-value current docs may be hidden from sidebar if not linked through area READMEs. |
| Human entry point | 8 | `docs/index.md` gives current model, core sources, and GitBook reading rules. | It can become stale unless docs sync checks it when source docs move. |
| Agent entry point | 9 | `docs/agent-start-here.md`, `current-status.md`, and `agent-rag-map.md` reduce token waste and point agents to current docs. | Agents can still over-read completed/archive docs if work items point too broadly. |
| Freshness and drift control | 6 | `current-status.md` is compact and current, and `docs:check` catches broken links. | Work index has many Human Review items, and source/work/completed status can diverge without regular reconciliation. |
| Documentation depth control | 8 | `_meta/documentation-depth-rules.md` gives strong guidance against over-documenting small changes. | Enforcement is human/agent discipline, not automated. |
| Work tracking linkage | 7 | Work index links PR-sized items; completed docs exist by area. | 109 Human Review entries create ambiguity about accepted vs still-awaiting-review state. |
| Verification gates | 8 | `npm run docs:check` is present and currently passes. | External link checks and frontmatter/lifecycle validation are not part of the local gate. |
| Security and privacy boundary | 8 | Current status and operating rules warn against live Supabase, real data, production, and sensitive claims. | Public GitBook exposure of detailed auth/security docs still needs deliberate review before publishing broadly. |
| Reader task fit | 7 | Start Here and area split support human and agent workflows. | Diataxis-style task/reference/concept separation is implicit, not explicit in sidebar labels. |
| Duplication control | 6 | Moved stubs protect links and point to canonical paths. | Duplicate-looking legacy paths and root-level moved files add search noise. |
| Naming and style consistency | 7 | Area names, status names, and closeout patterns are mostly consistent. | Mixed Korean/English legacy filenames and partial frontmatter coverage reduce machine consistency. |
| Archive hygiene | 8 | Archive and completed docs are preserved but kept out of the main reading path. | Completed HTML volume is high and may dominate raw search results. |
| RAG and AI readability | 7 | Markdown, clear headings, compact status docs, and RAG map help retrieval. | Partial frontmatter and many historical records make recency/currentness harder to infer mechanically. |

Overall score: **7.5 / 10**.

## Strengths

- The source-of-truth model is explicit and healthy: edit repo docs, not GitBook copies.
- `docs/SUMMARY.md` is curated instead of exposing every file.
- Startup docs are compact and aligned with agent token constraints.
- `docs/_meta/` gives unusually clear routing, lifecycle, and depth rules.
- `docs:check` currently passes, so internal link integrity is good.

## Main Risks

1. **Status ambiguity from Human Review volume**
   - 109 work items are marked `human_review`.
   - This may be accurate, but it weakens the work index as a “what is actually next?” board unless representative review state is summarized by project.

2. **Search noise from compatibility and legacy paths**
   - `docs/implementation/`, root moved stubs, `docs/features/`, `docs/prd/`, and `docs/userflow/` exist for compatibility.
   - They are correctly marked as moved, but can still appear in local search or AI retrieval.

3. **Partial lifecycle metadata**
   - Only 262 of 513 markdown files start with frontmatter.
   - This is acceptable for legacy/completed docs, but source-of-truth docs benefit from consistent `status`, `area`, `doc_type`, and `last_updated`.

4. **Sidebar hides depth behind area READMEs**
   - Curated sidebar is good, but readers may miss important current docs if area README pages are not strong indexes.

5. **Security-publication boundary needs a publishing checklist**
   - The docs include auth, security, launch-readiness, and live persistence details.
   - That is fine in repo, but public GitBook publishing should have an explicit sensitive-content review gate.

## Recommended Operating Model

### Tier 1: Start Here

Keep these highly visible:

- `docs/index.md`
- `docs/agent-start-here.md`
- `docs/engineering/current-status.md`
- `docs/work/index.md`
- `docs/work/inbox.md`

### Tier 2: Current Source Docs

Expose only stable current source docs in `docs/SUMMARY.md`, grouped by reader task:

- Product truth: scope, PRD, workflows, domain maps, role/permission maps.
- Design truth: design system, reference screens, QA rules.
- Engineering truth: architecture, mock/live boundary, data model, auth/security, QA scenarios, launch readiness.
- Work truth: index, inbox, open questions.

### Tier 3: Area Indexes

Make each area README a strong local index:

- What belongs here.
- Current canonical docs.
- Recently superseded docs, if relevant.
- Where to go next for product, design, engineering, or work execution.

### Tier 4: Historical Records

Keep completed reports, archive, compatibility stubs, and long histories discoverable but outside the default reading path.

## Suggested Next Improvements

1. Add a docs/GitBook audit checklist to `emr-docs-sync`.
2. Add a small GitBook structure rules source doc under `docs/_meta/` only if 승욱 wants the audit criteria to become durable operating rules.
3. Tighten area READMEs so hidden current docs remain discoverable without bloating `SUMMARY.md`.
4. Add frontmatter opportunistically to current source-of-truth docs when touched.
5. Add a publishing-sensitive-content checklist before broad GitBook publication.
6. Consider a separate work item to reconcile `human_review` board state into project-level summaries.

## Verification

- `npm run docs:check` passed.

## Not Changed

- No GitBook sidebar changes were made.
- No source-of-truth guidance was changed.
- No work item status was changed.
- No compatibility stubs were removed.
