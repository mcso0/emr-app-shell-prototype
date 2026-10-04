---
type: "Screen Spec"
title: "Lab result sheet: approved visual contract"
description: "Figma annotations, accepted V5 corrections, and code boundaries for the laboratory result sheet."
status: "accepted-design"
tags: [lab, result-sheet, figma, attachments]
related_work: "LAB-PR-004"
updated: "2026-10-04"
---

# Lab Result Sheet — Implementation Reference

This document records the accepted design and the scoped implementation decisions. Read the [execution plan](../../../../work/lab/LAB-PR-004-result-sheet-figma-alignment.md) before changing code. The user subsequently authorized implementation, parent verification, and delivery after the checks pass; see the execution plan for the active scope.

## Sources And Precedence

1. User corrections accepted through V5 and the 2026-09-29 AS-IS → TO-BE follow-up below: existing ghost button; bounded attachment height; distinct card/list upload states; full fill and no gradient at 100%; no staff-notice shadow; transparent default upload surface.
2. [Figma section 28532:118340](https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28532-118340), including annotations. Main specimen: `28532:127712` (`listHeader`, width 1246px).
3. Accepted V5 standalone reconstruction. Its multiple expanded examples demonstrate states; they do not request multiple simultaneously expanded product rows. Report navigation, demo sliders, specimen filenames, percentages, avatars, and toolbar mock actions are not product requirements.
4. Existing data, permission, persistence, and interaction contracts remain authoritative where the design does not define behavior.

The temporary review URL is not a durable source dependency. V5 artifact SHA-256: `d5a02412a46003d34e34c082697055180cf0436aca88e19de61fa74926e4debb`. Reference geometry and accepted corrections are captured below so implementation does not depend on that tunnel remaining online.

## Approved Corrections

| Area | Final rule |
| --- | --- |
| 소견/첨부 entry | Reuse `Button variant="ghost" size="xs"` for `+ 검사소견 및 첨부자료`. Preserve shared hover, focus, disabled, and disclosure semantics. Eligibility still needs an authoritative mapping. |
| Empty attachment | 76px upload surface, transparent by default and gray on hover. Keep the permission-aware read-only empty state. |
| Finding | 76px textarea with 12/16px text, 7px internal padding plus border, and input shadow; preserve controlled `row.note`, maximum length, and automatic result-save behavior. |
| Cards | Grow with content up to two rendered rows, then scroll only the file viewport. |
| List | Grow up to six 32px rows with 4px gaps, then scroll only file rows. Title, tools, and column header remain outside that scrolling area. |
| Overflow cue | Show the bottom fade only when actual overflow exists and more content remains below. Remove it at the bottom and after shrink. |
| Upload rendering | Cards show a spinner in the thumbnail, filename, percentage, and cancel. Lists show an in-row fill plus spinner, filename, percentage, and cancel. |
| List progress | Fill width matches clamped percentage. Fade weakens as progress rises and disappears at 100%; 100% fills the entire inner row. |
| 직원 전달 사항 | Noninteractive read-only content, no shadow. Do not use an input, button, hover treatment, or tab stop. Display only when authoritative content exists. |

These height rules replace the older 144px fixed-height proposal in LAB-PR-003. Its historical implementation/release evidence remains unchanged.

## As-Is → To-Be Map

CHG identifiers match the earlier comparison report. Code observations use the pinned baseline in the execution plan; report line numbers are historical.

| ID | Existing code | Target / implementation boundary |
| --- | --- | --- |
| CHG-001 | Name cell contains an outline `검사 소견 펼치기` button; six columns. | Add a leading 24px disclosure column. Keep a single expanded row, stable row IDs, and keyboard activation. |
| CHG-002 | `LabResultValueControl` renders a coded select or value input. | Eligible narrative-only orders use the existing ghost button in the value cell. **Do not infer eligibility from `text`**; text values and `row.note` are separate fields. |
| CHG-003 | Detail contains finding and attachments, with no staff-notice source. | Optional full-width staff notice above the columns; no shadow. Use the selected order instruction mapped from fulfillment source metadata; omit blank content. |
| CHG-004 | Finding and file viewport are both fixed at 144px. | Apply the approved 76px / two-card-row / six-list-row rules above. |
| CHG-005 | Detail padding/gap 16px; no center divider. | Feature-local spacing, label slots, and a 1px center divider matching the reference below. |
| CHG-006 | Text buttons `카드 / 목록 / ＋ 추가`; hover/focus/touch visibility already exists. | CDS icon controls, selected-view state, and count. Preserve accessible labels and visibility behavior. Bulk download remains disabled; per-file actions stay available. |
| CHG-007 | Cards 105px tall, 64px thumbnail, 8px grid gap. | Match reference card proportions, black-alpha surface, and 10px grid gap. |
| CHG-008 | Filename and actor pill can collide. | Reserve 20px actor space and the gap; single-line filename ellipsis. Existing actor name/fallback only, no invented portrait. |
| CHG-009 | Hover moves content 16px; preview and menu are separate top-right controls. | Reference move 13px, expose time, single menu. Preserve preview/download/delete through existing actions. |
| CHG-010 | List has filename, size, and menu only. | Add file-type icon, column header, uploaded time, and actor from existing attachment fields. |
| CHG-011 | Upload task has no percent; text/character loading state. | Real measured progress, rotating icon, and separate list/card designs. Preserve prepare/upload/finalize/cancel cleanup. |
| CHG-012 | Image or `PDF`/`FILE` text; image failure has no fallback. | Supported image/PDF/other icons and explicit image fallback. Video requires a separate capability decision. |
| CHG-013 | Result title already copies a scoped result link; table has no order-target link. | Table `링크 복사` must restore the relevant result/order and target its table. Reuse existing deep-link contract after checking target restoration. |
| CHG-014 | Result input/select uses 14/20 text. | Local input/select and finding text 12/16 with 0.3px tracking; retain 28px result control height and existing input/validation semantics. Row text stays 14/20. |

## Reference Geometry And Tokens

Values below describe a **1246px component**, not a fixed page width. Avoid a screenshot-sized implementation. Preserve shared density behavior and use local sizing overrides where supported.

| Surface | Reference |
| --- | --- |
| Outer group | Padding 12px vertical / 16px horizontal, radius 12px, no outer border; toolbar 28px, 12px gap before table. |
| Toolbar | Three outline actions in order: 기본 간격 82px / 수정이력 79px / 링크 복사 82px; height 28px, gap 8px, radius 8px, icon 12px. Save/retry/status and reset/reload overflow remain below the group. |
| Group title | Fold 24px with 14px icon and 6px radius; title 14/20 medium; fold/title gap 8px, title/count gap 6px, count/status gap 8px. Count height 20px, horizontal padding 6px, radius 6px, black-alpha 4%. |
| Table | 1214px surface; padding 4px top / 8px other sides; radius 8px; inner row width 1198px. |
| Columns | Disclosure 24, item 280, result 240, unit 120, range 254, judgment 120, actor 160px. Range remains the flexible column. |
| Header / row | 36px header / 40px default row. Body item/unit inset 14px; other body and header text inset 10px. Result input width 220px; additional result information remains in the item cell. Preserve the existing density selector rather than forcing every density to 40px. |
| Row groups | Header divider 1px; expanded parent has no lower border. Expanded detail has a 1px lower border only when another row follows; final detail has 6px lower corners. Only one row opens at a time. |
| Detail | Padding top 10px / horizontal 24px / bottom 16px; 12px gap between optional staff block and columns. Two 558.5px sections, 17px separator slot, 8px gaps. |
| Detail contents | 28px label slot; 10px content padding. Finding/upload both 76px tall and 538.5px wide at reference size; visible box gap 53px, bottom inset 26px. Center separator 1px black-alpha 6%, inset 8px, 108px tall for an empty detail without staff notice. |
| Staff body | 36px single-line reference height, 8px horizontal inset, 1px border, radius 8px, no shadow. Recommended long-content behavior: wrap and grow without hiding instructions. |
| Card | 127.125 × 106.581px; padding 8px, radius 6px, grid gap 10px. Thumbnail 111.125 × 62.581px, aspect ratio 190:107, radius 3px. |
| Card text / actor | 12/16px, tracking 0.3px; actor 20 × 20px, bottom/right 8px. Shared Avatar has no assumed `xs` API; apply supported local sizing. |
| List | 32px rows, 4px gaps, padding 4px vertical / 8px horizontal. Columns: flexible filename, 72px size, 88px time, 48px actor, 24px menu; 8px gaps. Header 24px with 10/14px text. |
| Typography | Existing Pretendard; row 14/20px, tracking 0.196px; finding/labels/control text 12/16px, tracking 0.3px. |

At reference dimensions, two card rows occupy approximately **223.162px** (`2 × 106.581 + 10`) and six list rows **212px** (`6 × 32 + 5 × 4`). These are **file viewport limits**, excluding labels, tools, padding, and the list header. Header plus 4px separation makes the list content 240px before outer padding.

The 2026-10-04 browser annotation changes only the detail wrapper's horizontal padding from 10px to 24px at every viewport width. Retain the inner 10px content padding, so visible fields sit 34px from the detail edge. Keep the existing `md` detail stacking and attachment container queries; the reference widths above follow from the new inset.

Use existing semantic surface, border, text, focus, and selected tokens. Figma reference colors include `#fafafa`, black-alpha 4% / 8%, and sky `#0080e5`; compare with current CDS mappings before choosing a feature-local treatment. Do not change global tokens, Input, Textarea, Button, Avatar, or EmrDataTable defaults to match one screen.

Some Figma examples swap range/actor widths. Use one consistent column grid; do not vary columns by expanded state. At narrow widths, preserve the existing responsive detail stacking and table overflow. Recommended card behavior is four columns where space permits, two on narrow containers, with the two-row cap based on actual layout. Validate rather than shrinking unreadable controls.

Responsive table follow-up approved 2026-10-03: keep the existing design and column definitions. Measure the table viewport's content width, excluding padding. Between 904px and the 1198px preferred column total, distribute shrinkage in proportion to each column's existing `size - minSize`. Keep the 24px disclosure fixed. Below 904px, preserve minimum column widths and scroll inside the table. At 1198px and above, retain the reference widths and existing range-column growth. Document width toggles, shell panels, and window resizing use the same rule; result/finding drafts and disclosure state remain intact. No typography, spacing, wrapping, toolbar, or detail-design change is included.

## Attachment And Upload Behavior

Overall finding layout approved 2026-10-04: retain the `검사결과 종합소견`
card and use equal desktop columns for `종합 소견` and `첨부 자료`, with
the same responsive stacking and center divider as item details. Empty textarea
and upload target are both 128px high. Do not add prototype explanatory subtext.
Keep overall autosave, revision recovery, and read-only controls.

An explicit `rowId: null` identifies an attachment for the whole result;
item attachments keep their existing row IDs. Render each only in its own scope.
Reuse the existing private upload, preview, download, deletion, retry and
cancellation lifecycle. Result/workspace ownership, lab permissions, immutable
file paths, validation and audit remain enforced. Missing or malformed prepare
selectors are rejected instead of being interpreted as overall scope. This
contract needs the overall-attachment migration before application delivery.

- Count ready attachments in `첨부 자료 N`; visible pending/failed tasks also consume layout space, but are not ready files. Cancellation/removal/retry/view changes must recompute overflow.
- File type is derived from validated MIME metadata. Use protected attachment URLs. Image cards use the stored image; PDF cards render the actual first page, fit the entire page into the existing 190:107 thumbnail area and show a PDF/first-page label. The PDF renderer starts when the card enters the visible area and uses the existing private read route; it may read the original PDF up to the existing 20 MiB limit. No server thumbnail storage or conversion is introduced.
- Image/PDF cards distinguish preview loading and read failure from upload states. A failed read keeps the file and type fallback, explains the failure and offers a separate keyboard-accessible retry button. Retry returns focus to the preview control; do not nest retry inside that button. A read-only user can retry a permitted read without receiving edit permissions.
- Lists keep small image thumbnails and PDF/CSV/TXT type icons. Failed image reads expose their state and retry in the existing action menu. CSV/TXT cards retain type icons; content parsing and text thumbnails are outside this follow-up. Full preview, download and deletion use their existing protected actions.
- Card hover and keyboard focus expose time and one 24px menu. Retain existing motion duration as an implementation choice; Figma does not specify timing. Honor reduced motion and expose actions on touch.
- Keep full filename accessible through the existing title/accessibility pattern; keep actor fallback when `uploadedByName` is absent. Do not display raw IDs as a substitute for a name.
- List timestamp uses actual `uploadedAt`; preserve full time access if a relative label is used. Specimen `88 MB` must not bypass existing limits.

| Phase | Visible state | Contract |
| --- | --- | --- |
| Queued / preparing | Distinct waiting/preparing label; no fabricated percentage. | Preserve concurrency two and the existing delayed loading indicator where practical. |
| Transferring | Measured percentage when total bytes are known; spinner and cancel. | Clamp to 0–100. List fill width is `p%`; V5 trailing fade opacity is `1 - p/100`. Card has **no horizontal blue fill**. |
| Transfer 100%, finalizing | Fully filled list with no trailing gradient; still processing. | Proposed copy `파일 확인 중`. Do not declare the attachment ready until finalize succeeds. |
| Ready | Normal attachment card/list row. | Refresh the authoritative attachment collection. |
| Failed | Error, retry, and cancel. | Keep cleanup feedback, avoid success appearance, and reset measured progress for a new attempt. |
| Cancelled | Task removed; cleanup continues as needed. | Preserve pending discard and ready-file deletion when cancellation races with finalize. UI removal alone is not proof of network cancellation. |

The original fixed 383px fill and 88% are specimen values. Do not copy them into runtime logic. If progress cannot be measured, use an indeterminate state honestly and record the fidelity gap; do not silently mark CHG-011 complete.

## Annotation Traceability

| Annotation | Requirement | Relevant node / change |
| --- | --- | --- |
| A01 | Link opens the relevant order table on the relevant lab page. | `I28532:127661;27286:68544` / CHG-013 |
| A02 | Narrative/attachment-only order entry differs from typed/selected result entry. | `I28567:105270;27814:157617` / CHG-002 |
| A03 | Disclosure opens the area below the row. | `I28567:102296;27814:157681;27286:69702` / CHG-001 |
| A04 | Upload surface has a hover state. | `I28567:103095;27814:157617` / CHG-005 |
| A05 | List upload includes rotating loader, filename, percent, cancel, and gradient gauge. | `28533:208855` / CHG-011 |
| A06 | Card upload includes rotating loader, filename, and percent. | `28533:208783` / CHG-011 |
| A07 / A08 | Card/list component variants. | `28533:208299`, `28533:208501` / CHG-007–012 |

## Contract Decisions

Investigation during LAB-PR-004 resolved the existing-field and transport mappings. The remaining capability gaps are explicit below.

| Question | Evidence / recommendation | Resolution required |
| --- | --- | --- |
| Narrative-only eligibility | `resultValueKind` is numeric/text/coded; a text value is not synonymous with `row.note`. | No authoritative predicate exists in the current contracts. CHG-002 remains deferred; retain numeric/coded/text inputs. |
| Staff instruction source | Fulfillment mapping carries `sourceSnapshot.instruction` at work-item/order scope, but `LabResultRow` and phase2 response have no staff-notice field. | Resolved: pass the selected result order instruction into the single expanded detail. Nonblank order-scoped content only; never substitute row note or overall finding. |
| Actual upload progress | The installed storage SDK uses a signed PUT multipart request; the server already obtains its signed URL. | Use a feature-local XHR with the same multipart body and signed URL, exposing measured progress and abort. Preserve server validation, prepare/finalize and cleanup. Synthetic verification does not imply a live storage write. |
| Header download | Existing actions download one file; annotation does not define all/selected/ZIP. | Define scope and behavior before enabling a new bulk action. Keep existing per-file download. |
| Video | Current server allowlist excludes video. | Treat as separate functionality; do not add only a client accept value. |

## Preserved Product Contracts

Keep result save/reload and revision conflicts, numeric/coded/text values, qualifiers, device flags, `instrument_no_result`, clinical range/judgment semantics, retest eligibility, overall finding and history. Their omission from a Figma specimen does not authorize removal. The unavailable `차트에 복사하기` placeholder is omitted from the approved three-action toolbar; chart copying remains an unimplemented capability.

## AS-IS → TO-BE Follow-Up — 2026-09-29

The user approved the detailed HTML comparison and authorized TDD, commit, push, PR, main merge, and production deployment after passing verification. Sources are Figma toolbar [28532:127678](https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28532-127678), table [28532:131185](https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28532-131185), and expanded section [28574:126129](https://www.figma.com/design/UkfxgituFcU2rhYFriAErJ/-CDS.V2--CLAiR-EMR-Design-System-Ver.2?node-id=28574-126129).

The geometry above supersedes the earlier V5 empty-upload height and finding typography. Only the normal-range column absorbs extra width; the lab table reserves no scrollbar gutter when it does not need one. Feature-scoped CSS leaves shared table defaults intact. Existing attachment presentation, transport, permission and persistence contracts remain unchanged.

Keep workspace/result/row isolation, `canEdit`, server permission checks and RPC ownership checks, protected preview/download, deletion confirmation, upload metadata/byte validation, and cleanup. Supported types remain JPEG/PNG/WebP/PDF/CSV/TXT; existing limits are 20MiB PDF and 5MiB for other supported files. This design does not authorize schema, RLS, storage policy, or real-data changes.

## Result Autosave Follow-up — 2026-10-03

User-approved local scope replaces the result footer (`더보기` / `저장`) and
`종합소견 저장` with automatic saving. Results, `row.note`, qualifiers, device
flags and overall findings save after 800ms without edits, or when focus leaves
the input. The three existing table toolbar actions stay available.

- Show `저장 대기 중`, `저장 중`, `저장됨`, validation/permission/conflict errors,
  and `재시도` only for retryable failures. No write on initial loading.
- Serialize writes per workspace/result/channel. Advance revisions only from
  successful responses; retain the same request ID and payload when retrying an
  ambiguous result-entry failure. Newer edits follow the recovered write.
- Keep edited values until authoritative readback confirms the revision. Never
  treat a POST acknowledgement combined with old GET rows as fresh readback.
- Preserve pending/error drafts across module/result switches in session memory.
  Detached failures show a notice; reopening restores the input and retry state.
  Browser unload warns while any lab draft remains unsaved. This is not offline
  durable storage: accepting unload discards session-only failed drafts.
- Preserve existing server permission, workspace, validation, revision and audit
  boundaries. Saving a draft does not complete or approve a result.
