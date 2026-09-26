---
status: active
updated: "2026-09-27"
related_work: "DESIGN-SYSTEM-PR-102"
---

# Clinical Instruction Title Header

The selected 조제/처치, 임상병리검사, and 영상검사 document titles use the
진료/차트 title density as their visual reference. This contract applies to the
document title row and its past-history icon, not to the history side panel.

- A single-row title is at least 48px high. Its past-history button is 24px,
  its title is 16px with 24px line height, and its document ID badge is 22px
  high with a 160px display limit. Keep the complete ID in the DOM and title
  attribute when the badge truncates it.
- The left and right control groups use 8px gaps. Supporting and primary
  actions use the existing 28px small control size. When space is narrow, the
  action group may move to a second row and stays right aligned without
  horizontal overflow.
- Keep 수행기록·이력 and the current assignment or status action visible. Keep
  영상검사 PACS visible in the title. Put PDF 다운로드 and 출력하기 in the ghost
  ellipsis menu immediately after the last status action.
- PDF 다운로드 and 출력하기 remain visible but disabled in that menu until the
  document output workflows are implemented. The menu must not expose a
  working download or print action while those workflows are unavailable.
- Preserve the history panel content and behavior, document information
  cards, result tables, filters, patient context, and all data and permission
  boundaries.

Implementation owners: `src/components/emr/instruction-header-stack.tsx` for
shared title geometry and output menu; the dispensing and lab/imaging feature
modules for their existing workflow actions.
