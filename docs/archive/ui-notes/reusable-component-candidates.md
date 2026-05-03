# Reusable Component Candidates

Updated: 2026-05-02

Start with `docs/engineering/current-status.md` before extracting shared UI. PR 1-6 now provide repeated queue/detail/table patterns, but PR7 Figma alignment should happen before broad component extraction.

## Strategy

1. Use existing project components first.
2. If a pattern is missing, build it with project foundation and tokens.
3. Use shadcn only when the project has no equivalent component pattern, preferably through a project wrapper or in combination with existing components.
4. Document candidates before extracting shared components.
5. Extract only after a pattern repeats across at least two screens and its interaction model is stable.
6. Treat the current 조제/처치 screen as a reference only. Do not redesign it during PR 1-6.

## Candidate Inventory

| Candidate | Appears In | Extraction Trigger | Notes |
|---|---|---|---|
| Work queue side panel/list item | 접수/예약, 진료, 임상병리, 영상, 수납 | Repeats across 3+ modules | Dense queue item with status, action, menu, selected state. |
| Status badge/label mapper | All EMR modules | Already domain-level | English enum internally, Korean labels in presentation. |
| Drawer shell | 접수 detail, 환자, 보호자 | PR 3 | Large modal/drawer with header, tab bar, scroll body, sticky footer. |
| Profile header | 환자, 보호자, 진료 | PR 3 | Avatar, name, meta, and quick actions. |
| Read/edit field grid | 환자, 보호자, Order detail | PR 3+ | Read-only and edit mode should share field definitions where practical. |
| Audit footer | Drawers and forms | PR 3 | Registered/updated metadata and change-history link. |
| Latest work shortcut grid | 환자, 보호자 | PR 3 | Quick jump to latest lab, image, dispensing, billing work. |
| CS history table | 환자, 보호자 | PR 3 | Call/response and KakaoTalk history with expandable detail. |
| Calendar toolbar/current-time line/event card | 접수/예약 | PR 2 | Keep reception-specific until reused elsewhere. |
| Result input table | 임상병리 | PR 5 | Result, judgment, reference range, comments. |
| Attachment strip | 임상병리, 영상, 진료 | PR 5 | Thumbnail/file/loading/error states. |
| Rich text/notes editor shell | 진료, 임상병리, 영상 | PR 4/5 | Toolbar plus text area/content region. |
| Invoice line table | 수납 | PR 6 | Editable amount, discount, tax, delete, totals. |
| Payment summary rail | 수납 | PR 6 | Sticky summary/actions panel. |
| Order detail/editor shell | 병원관리 reference | Later | Reference only in PR 1-6. |
| Filter/sort/search toolbar | Most modules | PR 4+ | Search input, filter icon, sort icon, dropdowns. |
| Multi-column operational shell | 진료, 임상병리, 영상, 수납 | PR 4+ | Queue/detail/right-panel layout. |

## Post-PR 1-6 Notes

- Work queue side panels now appear in reception, chart, lab, imaging, and billing. Candidate extraction is valid, but wait until PR7 confirms final density and layout intent.
- Result input table, attachment strip, and invoice line table now have concrete prototype implementations. They should be reviewed against Figma before generalizing.
- Status label mapping is already domain-level via `src/lib/emr-domain/status-labels.ts`; future work should extend the mapper rather than hard-code Korean status text in screens.
- Do not refactor 조제/처치 as part of common component extraction unless a dedicated regression-safe plan explicitly includes it.

## Non-goals

- No global redesign.
- No immediate refactor of 조제/처치.
- No shared abstraction until behavior is stable.
