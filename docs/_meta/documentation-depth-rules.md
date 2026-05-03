# Documentation Depth Rules

Use these rules after routing a chat instruction with `docs/_meta/intake-rules.md`.

The goal is to keep durable knowledge discoverable without turning every small implementation detail into repo documentation.

## Depth Levels

| Level | Name | Use when | Record in docs? |
|---|---|---|---|
| 0 | Result review only | A tiny one-off change to one element, typo, label, or implementation detail | No |
| 1 | PR description only | A small change that is understandable from the PR and does not change durable guidance | No docs duplication |
| 2 | Existing work item or PR update | A detail inside an already scoped PR or issue | Update existing work item only when needed for handoff |
| 3 | New PR-sized work item | A standalone unit that should fit one PR | Yes, in `docs/work/` |
| 4 | Source-of-truth doc plus decision or closeout | A product, design, engineering, or business rule changes | Yes, in canonical docs |

## Level 0: Result Review Only

Use for tiny changes that do not create durable planning value.

Examples:

- reduce icon/text gap on one specific button
- fix a typo
- change one label
- adjust one local spacing value

Do not create docs, work items, changelog entries, or closeouts. The commit or PR diff plus the final user result review is enough.

## Level 1: PR Description Only

Use for small changes that should be explained for review but do not need long-term docs.

Examples:

- move a button within one screen
- adjust wording tone on one screen
- make a small UX polish that is not a reusable rule

When GitHub is used, put this in the PR description or PR checklist. Do not duplicate it in `docs/*/changelog.md`.

## Level 2: Existing Work Item Or PR Update

Use for details inside work that is already scoped.

Examples:

- add a small UI tweak to an active reception PR
- update labels while implementing an existing feature work item
- record a minor blocker in the PR thread

Do not create a new work item. Update the existing work item only when the detail changes goal, scope, done criteria, dependencies, or handoff notes.

## Level 3: New PR-sized Work Item

Use when the instruction is independently executable and should fit one PR.

Examples:

- add a new patient registration entry point to reception
- implement one permission resolver unit
- migrate one canonical document set

Create or update a `docs/work/` item with goal, scope, out-of-scope, done criteria, source docs, dependencies, and verification. Link the GitHub PR or issue when one exists.

## Level 4: Source Of Truth Doc Plus Decision Or Closeout

Use when the instruction changes durable guidance.

Examples:

- change a product workflow
- define a design-system rule
- change DB relationships, schema, RLS, or persistence policy
- make an architectural or security decision

Update the canonical source document and create a decision or closeout when needed. Do not rely on a closed PR as the only record for current guidance.

## GitHub Boundary

When GitHub is used:

- GitHub PRs and issues are the primary surface for execution, review, CI, and merge records.
- `docs/` is the primary surface for current guidance, durable decisions, agent handoff, and archive-worthy context.
- If a PR or issue can absorb a Level 1 or Level 2 record, do not duplicate it in docs.
- If a change must remain true after the PR is closed, promote it to Level 3 or Level 4 docs.
- If the user says "기록해줘", "규칙으로 만들자", or "앞으로 이렇게 하자", do not leave it only in GitHub.

## Escalation Rules

- Repeated Level 0 changes across screens or components become at least Level 1.
- A repeated small change that becomes a reusable rule becomes Level 4.
- One-off changes stay low-depth.
- Product, design, engineering, or business source-of-truth changes never stop at PR description only.

