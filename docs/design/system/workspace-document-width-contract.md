---
status: active
updated: 2026-10-03
related_work: APP-SHELL-PR-002
---

# Workspace Document Width and Internal Panels

Approved research: [Korean report](../../completed/design/2026-09-29-workspace-width-proposal/report.html).
Implementation approval: 승욱, 2026-09-29, “오케이 순서대로 진행해보자.”

## Approved adoptions

- `WorkspaceFrame` owns the outer profile slot. Opt-in `WorkspaceDocumentLayout` owns the patient-header-underneath toolbar and `[history | document | reference]` row.
- First adoption is 임상검사: narrow document cap 1120 CSS px, history 280, receipt 336, protected center column 880 including 32 horizontal padding.
- Second adoption approved on 2026-09-30: 진료/차트 uses the researched 1040px cap and existing 280px history panel. No right reference panel is added. Its 48px action bar spans the toolbar; SOAP/Assessment/History and Plan/Order remain in the document. Waiting/preconsultation and empty/loading states retain their existing actions.
- Third adoption approved on 2026-09-30: 조제/처치 uses the researched 1120px cap and existing 280px execution history. Instruction title/actions span the toolbar; instruction information, filters and execution tables remain in the document. The existing order-detail drawer remains in the workspace drawer slot. No new right reference panel is added.
- Fourth adoption approved on 2026-09-30: 영상 report uses a 1120px cap (revised from the initial 1280px pilot on 2026-10-03), existing 280px history and 336px summary/attachments inside the work surface. Report title, PACS placeholder, width, summary and reading-status actions span the toolbar. Patient context remains above it and the outer profile retains its slot. Actual PACS/viewer integration does not exist in the current module and is not created by this adoption.
- Fifth adoption approved on 2026-09-30: 수납 uses the researched 1120px cap, existing 280px guardian ledger and 336px payment summary inside the work surface. Title, assignment, width and summary controls span the toolbar. Invoice information, selected checkout totals, line quantities and status actions remain in the document; existing financial actions remain in the summary with its fixed footer and nested preflight dialogs.
- Module registry `documentLayout` opts into this contract. Other module layouts and default panel policies remain unchanged.
- Reuse existing feature panels and semantic tokens. Do not change result matching, saving, confirmation, data, permissions or API contracts.

## Width and state

- All opted-in document layouts (임상검사, 차트, 조제/처치, 영상, 수납) start wide on first entry and full reload. Wide uses available document space. A manual narrow/wide choice remains respected during module navigation in the current session.
- For 차트, 임상검사, 조제/처치 and 수납, show the width button only when unrestricted document space exceeds the cap. 영상 keeps the same button visible when space is insufficient; it is disabled but keyboard-focusable and explains `현재 공간에서는 두 보기의 폭이 같습니다.` in a hover/focus tooltip. Disabled activation does not change the retained width preference. Measure the center container after shell, profile, inline panels, padding and scrollbar; never use viewport 1600 as the threshold or the restricted document width as the measurement.
- Keep the preference when the button hides. UI preference is scoped by workspace and module in the session store; no database or new durable storage is introduced.
- Keep the Content component and its fields mounted across width and panel presentation changes. Keep existing panel URL states separate from width preference.
- Opt-in layout-only URL updates use Next.js-integrated native `history.replaceState` so panel changes do not trigger server navigation or race a later close. Feature navigation and non-opt-in modules retain their existing routing.
- Explicit width toggles use actual numeric endpoints, 180ms ease-out and no scale/fade. Resize and reference-panel changes are immediate except for Lab receipt pointer toggles; history and Lab receipt toggles use the slide contract below. Reduced motion removes movement transitions.

## Panels and accessibility

- Patient header spans the work surface. History starts directly beneath it, beside the document title. Lab equipment receipt shares this hierarchy at the right edge and occupies the full work-surface height. The title/actions and body share one mounted document column and adjust together when history or Lab receipt opens or closes. Imaging and billing reference panels retain their below-title position; their top follows the actual toolbar height, including wrapped actions.
- All five opted-in modules use a borderless document toolbar. The common center owns the single 16px horizontal inset; document content adds no second outer inset. Wide clinical panels, result sections, execution tables and billing cards align with their document and the toolbar when internal panels are closed. Narrow visible content uses the full module cap: 차트 1040px, 임상검사/조제·처치/영상/수납 1120px. Card inner padding, existing minimum panel tracks and contained scrolling remain unchanged.
- Profile remains in the outer slot and does not replace the receipt panel.
- If requested inline panels would leave less than 880px for the center, display the latest panel as a modal; close the earlier supplementary panel and preserve central inputs. Never automatically collapse the queue.
- Inline panels do not trap focus or dismiss when Escape closes an unrelated central control. Modal presentation blocks background interaction, supports Escape and backdrop dismissal, and returns focus to the panel trigger.
- If a focused width button becomes unavailable, return focus to the right panel trigger when available, otherwise the history trigger.
- Pointer history toggles slide in from the left in 180ms and back out in 140ms using the existing panel ease-out token. Lab receipt mirrors this motion from/to the right. The document uses translation from its previous visible position to the final layout, without scaling, fading, blurring or animating its width. Reversing a toggle retargets the current visible position.
- Keyboard toggles, reduced motion, initial URL restoration, resize and automatic inline/modal changes settle immediately. Explicit narrow/wide mode remains a separate 180ms width transition.
- Closing history or Lab receipt becomes inert and leaves the accessibility tree immediately; its visible slide completes before Base UI hides the popup. History's stable mounted portal retains group/filter state. Closing from either panel returns focus to its title trigger. Lab receipt retains its existing unmount/reset lifecycle after exit; imaging and billing reference panels keep their immediate hiding and draft lifecycle.
- Preserve table columns and font/density. Contain necessary horizontal scrolling inside tables.
- 차트 clinical panel tracks use the actual workspace container width. At 1180px or below, expanded tracks retain their existing 360px minimum and scroll inside the group; wide documents preserve the original panel proportions. Existing independent collapse, editor autosave and Order pinned-column behavior remain intact.
- 조제/처치 preserves instruction/table mount identity, row selection, columns/density and contained horizontal/vertical scrolling. Existing drawer input survives width and history presentation changes; this verifies local input retention, not a new persisted prescription-edit workflow. Execution history and lifecycle actions retain their existing persistence/permission contracts.
- 영상 keeps reading textareas and summary comment mounted across width/panel presentation changes. Summary dismissal returns focus to its toolbar trigger. The Order detail table memoizes its one-row data array to avoid repeated table-state resets after width, panel or density changes. Reading/comment/attachment persistence and PACS behavior retain their existing boundaries.

- 수납 preserves controlled quantities, calculated/excluded totals, assignment, ledger selection/filters and summary memo/adjustment input across width and presentation changes. Memo/adjustment retention is local screen state, not a new persisted financial-edit workflow. Summary close/reopen retains the existing lifecycle; no new draft persistence is introduced. Checkout preparation uses stable selected invoice IDs and refreshes when amounts/status, selection, payment method or memo change rather than on layout-only renders. Nested financial preflight keeps its own focus/Escape and server permission/amount contracts.

## Verification and extension

Verify 1366/1440/1600/1920/2560, 200% zoom-equivalent layout, inputs and scroll, hidden preference restoration, both panels, profile coexistence, modal focus/Escape, reduced motion, nested receipt confirmation, and unchanged module layouts. Run focused browser regression, lint, typecheck and build.

차트 Order, 조제/처치 drawer and 영상 report/summary adoption use synthetic local inputs. Future diagnostic image viewing must use unrestricted available space without forcing the report cap onto images; no viewer zoom or comparison capability is claimed here. 수납 payment actions are verified with synthetic loopback fixtures only; actual PG/VAT/receipt/refund/settlement integrations remain outside this adoption. The width values remain pilot candidates pending real clinical usability review.


## Current main integration

Release preparation on 2026-09-30 reapplies this layout contract to main `0bca112a`. Keep the latest patient/guardian profile restoration, document output/link controls, author/completion permissions, actual execution dialogs and live/demo guards. The original pilot reports retain historical verification; current release evidence belongs to APP-SHELL-PR-002 and its final integration report. No staging branch or fixed alias is part of the active delivery path.
