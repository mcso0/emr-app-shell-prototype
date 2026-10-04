---
status: active
updated: "2026-10-04"
related_work: "DESIGN-SYSTEM-PR-105"
---

# Clinical Instruction Title Header

The selected 조제/처치, 임상병리검사, and 영상검사 document panes use the
진료/차트 title and content edges as their visual reference. This contract
applies to the title row, past-history icon, and content spacing, not to the
history side panel.

- A single-row title is at least 48px high. Its past-history button is 24px,
  its title is 16px with 24px line height, and its document ID badge is 22px
  high with a 160px display limit. Keep the complete ID in the DOM and title
  attribute when the badge truncates it.
- The left and right control groups use 8px gaps. Supporting and primary
  actions use the existing SM size: 28px height, 12px text and 12px icons.
  Icon-only actions are 28×28px. Text-button widths follow their labels.
  Use the shared 8px radius; keep the joined edges of split buttons square.
  When space is narrow, the
  action group may move to a second row and stays right aligned without
  horizontal overflow.
- Across 진료/차트, 영상검사, 조제, 처치, 임상병리검사, and 수납, order title-right
  actions as: 넓게/좁게 보기, other outline actions, the current primary/status
  action, its attached icon menu, then the existing ellipsis menu.
  영상검사 keeps PACS, 수행기록·이력, and 종합소견 before the lifecycle action.
  수납 keeps 수납 요약 before 담당하기/담당 취소. Chart call and completion
  actions use SM, including both completion-button segments.
  Keep metadata badges separate from this button-sizing contract.
  Preserve state-dependent variants, disabled states, and visibility. Do not
  add a primary action or ellipsis menu where the workflow has none.
- Keep 수행기록·이력 and the current assignment or status action visible. Keep
  영상검사 PACS visible in the title. Put PDF 다운로드 and 출력하기 in the ghost
  ellipsis menu immediately after the last status action.
- PDF 다운로드 and 출력하기 remain visible but disabled in that menu until the
  document output workflows are implemented. The menu must not expose a
  working download or print action while those workflows are unavailable.
- The 48px title row begins at the top edge of the content pane. Its controls
  are inset 16px horizontally, matching the chart action bar. The information
  card begins directly below the title row and is inset 16px on both sides.
  Keep the card at least 72px high and avoid adding another inset to its first
  and last cells.
- Place filters 12px below the information card and align their contents to
  the same 16px line. The scroll content uses a 16px horizontal inset, 16px
  top breathing room, and 16px between result sections. Leave 8px below the
  scroll viewport, matching the chart workspace bottom inset. Content-driven
  card wrapping may increase its height at narrower widths.
- Preserve the history panel content and behavior, information fields, result
  tables, filter interactions, patient context, and all data and permission
  boundaries.

Implementation owners: `src/components/emr/instruction-header-stack.tsx` for
shared title and content inset geometry and output menu; the dispensing and
lab/imaging feature modules for their existing workflow actions and result
content spacing.
