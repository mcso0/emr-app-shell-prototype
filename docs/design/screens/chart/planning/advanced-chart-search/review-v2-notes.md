# Chart search UI review — 2026-11-22

Local interactive proposal for CHART-PR-042. No app, DB, migration, deployment, or existing prototype change.

Archived files: standalone `review-v2.html` and `figma-list-preview.html` (final mockup, SHA-256 `db88d226e26368987dd876c0efcab88581f6c2087d7c9608290fd2538cc3b4c6`). The `review-v2.tsx`, `review-v2.css` and `build-review-v2.mjs` sources were not archived because they target pre-#1110 shared components and no longer compile; the rebuild steps below are historical. `/private/tmp` evidence paths were local and are not retained.

## Source verification

Fetched `origin/main` on 2026-11-22: `5378ae31cbaa3486b172f2d17f2da7f4f6be17fd` (same as the supplied navigation release).
- `supabase/migrations/20260519090000_reception_domain_schema_foundation.sql:124`: encounter-level `primary_veterinarian_id` exists.
- `supabase/migrations/20261118232000_advanced_chart_search_read.sql:67`: search maps the encounter veterinarian to `doctorId`; chart author is separate (`authorId`).
- Same search migration, line 116: existing `p_mine` filters `soap_notes.author_user_id = auth.uid()`; `p_doctor` filters the encounter's primary veterinarian.
- Search route passes both parameters through. This is source verification, not a live DB query.

## User decisions

- Reuse actual existing design-system components with default sizes; no new sizing scheme.
- Search first, separators between functional groups.
- After initially defining 내 차트 as assigned veterinarian, the user clarified that chart author also counts. Prototype uses `doctor === me || author === me`. `내 담당·작성 차트` is a provisional label.
- List/card switch, multiple selection, primary 내보내기 button, PDF and CSV options.

## Proposal behavior and limits

- Toolbar: search | doctor, mine, date, filter | sort, list/card, width | export.
- Fake records are embedded locally; no Production requests or photos.
- Selected items survive view and sort changes. Changing a search condition clears selection. Select-all covers the current visible synthetic results. These selection rules remain proposals.
- `필터` demonstrates species only. Full rule-builder behavior is outside this review file.
- CSV exports only the selected synthetic summaries. PDF uses the browser print-to-PDF flow for selected summaries; real export content, authorization and auditing remain undefined.
- Copy displays a scope notice; original/copy behavior is not reproduced end-to-end. Card content and selection rules still need human acceptance.
- Existing `index.html` and other pre-existing WIP were preserved.

## Files and verification

- `review-v2.tsx`: React entry importing actual shared UI components.
- `review-v2.css`: proposal layout only.
- `build-review-v2.mjs`: builds standalone `review-v2.html` with installed esbuild/Tailwind.
- Build passed. First browser load exposed a missing environment stub; build was corrected and the page rendered.
- Browser verified visible toolbar controls at 32px height and 14px text; mine includes assigned-only, authored-only and both (3 completed records).
- Two selections persisted when switching list to card; PDF/CSV menu opened.
- CSV downloaded and parsed: header plus exactly two selected synthetic records.
- Query filtering to one result cleared selection and disabled export.
- PDF save was not run. No production behavior or full app regression was tested.

Rebuild: `node docs/design/screens/chart/planning/advanced-chart-search/build-review-v2.mjs`.

## Shared page layout follow-up

User requested the existing common page layout used by customer management, 내 업무 and 원내 현황, not a separate lookalike header.
- Replaced the custom title/toolbar with actual `EmrMainContentHeader` and `EmrTableWorkspaceHeader` imports.
- Shared header owns the 24px title, result count, 320px search field, toolbar arrangement, primary-action divider and 48px side padding. Result content aligns to the same side inset; workspace uses the existing background token.
- Preserved default control sizes and list/card/selection/export proposal behavior.
- Build passed. Browser measured title, search and results at the same left edge. Search filtered to one result; shared clear action restored five; card switch worked.
- Local HTML only. Production and original prototype remain unchanged.

## Width-toggle correction

User clarified: 제목/search/filter header stays full-width; only the area immediately below it narrows (selection controls and results).
Moved the narrow state class to the result container. Browser measured header width unchanged at 1814px and search position/width unchanged; result container changed from 1814px to 1216px and restored to 1814px on 넓게 보기. Build passed. No application changes.

## Shared-component completion and clinical context review

User approved local prototype changes and required existing shared UI components as the default. The mandatory reuse rule is present in repository `AGENTS.md`; application behavior and Production delivery remain outside this prototype task.

- Replaced the custom source overlay with `Sheet`, `SheetContent`, shared right-panel header/body/footer, and Sheet title/description/close/trigger. Retained Sheet's default 200ms transition; composed a 672px reading panel using an existing width token. Source content remains mounted during exit. Escape closes it and focus returns to the originating chart title.
- Replaced custom notices, workflow status and card surfaces with `EmrInlineAlert`, `EmrStatusBadge`, and `Card`/`CardContent`. Copy menus also use the existing dropdown.
- Used the existing compact `EmrEmptyState` for attachment absence, with a consistent thumbnail slot. No private images or real records were loaded.
- Restored list/card context from the existing structure and implementation specification: visit and creation dates, patient/species/breed/age/guardian, attending veterinarian, author, status, S/O, diagnosis classification and prescription/order names. All records remain synthetic. These are a UI composition proposal, not clinical guidance.
- Added a local loading preview using shared `Skeleton` inside stable page/header frames. `?scenario=loading` simulates 900ms of loading; `&hold=1` holds the state for visual inspection. This is not evidence of Production latency or routing improvement.
- Corrected card row compression discovered during browser review; all five list cards have matching client/scroll heights (262px at the review viewport), so the clinical summaries are not clipped.

Observed verification: standalone build passed; list and card layouts rendered; one selection persisted across view change; PDF/CSV menu opened; source displayed the full synthetic context; Escape closed it and restored focus; no-mine state was centered in both axes and its recovery restored five records; missing-query recovery worked; loading kept the page title visible and resolved to five rows; browser error log was empty. PDF saving, actual copy/export contracts, real routing and Production behavior were not tested in this pass.

Still to verify with the user: original Figma node and annotations were not identified in this pass. Information fields were restored from the repository's approved screen structure/specification; pixel and field parity with that exact Figma source remains unverified. No suitable shared search-result clinical summary component was found, so its information layout is a local composition of existing primitives. The demonstration shell remains a noninteractive context frame.

## Row action follow-up

User requested icon actions matching the shown Figma row: 더보기, 복사, 즐겨찾기. Reused CDS ellipsis/copy/star icons and default 32px icon buttons. Copy opens the existing two-option menu. Favorites toggle locally and survive list/card switches; no server persistence or reload persistence is implemented. More menu contents are not specified; the local preview displays one disabled `메뉴 항목 미정` entry rather than inventing actions. Build and browser toggle/add/remove/view-switch checks passed.

## Figma information block alignment

User supplied Features node `2663:164580` and approved aligning its icon/label/value structure in the local proposal. Read the selected frame and its screenshot through Figma; root and descendant annotation query returned no annotations. This resolves the earlier unknown for this selected information block only, not the entire design.

- Verified source geometry: two columns; left 232px, right flexible; three 24px rows with 4px gaps; 100px icon/label area. Adapted this composition with existing calendar/building/status icons and status badges. The source uses a target glyph for Task; the prototype uses the available shared status check-circle glyph instead.
- Left: 주치의, 진료의, Task 상태. Right: S/O 내용, 진단 내용, Plan 내용. Author stays in chart metadata; orders stay in footer chips. Primary veterinarian, encounter veterinarian, author and task status are separate synthetic fields, not inferred aliases. Production field availability/mapping is not verified.
- Card view stacks the two groups; long preview text ellipsizes while the source drawer keeps full text. Browser verified matching row positions and heights, no card-view horizontal overflow, and full source content.
- More menu proposal: 원본 보기 (connected to the local drawer), 차트로 바로가기, 환자 정보 보기, 차트 링크 복사. The last three are disabled proposal entries until navigation/link behavior is specified and implemented; no fake Production link or data mutation.
- Build and browser checks passed. No app, database, Figma canvas or Production changes.

## Typography, spacing and empty-thumbnail refinement

Compared the selected Figma information block's parent result row. Source: 318x240 media; 8px outer media/content gap plus 24px content inset; title 18px/28px; secondary text and property values 14px/20px; metadata 12px/16px; property rows 24px with 4px gaps; section padding 8px; footer 36px.

Applied those hierarchy/spacing values to the local composition. The top metadata now groups creation date, patient/age, guardian and species/breed. Diagnosis sits below the larger visit-purpose title; visit date and author remain in the footer. Existing icon controls retain their default 32px size. Kept the media slot when empty and replaced the visible absence text with the existing shared image icon inside `EmrEmptyState`; a screen-reader label remains. No image was fetched or substituted.

Build passed. Browser verified 18px/28px title, 318x240 thumbnail, 4px property row gaps and 8px section padding; card client/scroll height matched at 272px. Wide/narrow/card modes had no horizontal overflow, and opening/closing the source still worked. Local prototype only.

## Mixed thumbnail examples and 1px result border

User requested an image-off icon with visible `첨부된 이미지가 없습니다` copy, image-present examples, and a 1px result-card border via browser annotation. Reused `EmrEmptyState` with the installed Lucide ImageOff glyph (no new dependency) because the app icon facade has no image-off glyph. Embedded two existing licensed review cat photos from `public/chart-search-review`; retained credits in an accessible shared popover on the local demo header. No private prototype photos were used. Image errors fall back to the same empty state.

Removed Card's additional ring via its layout class and kept its existing 1px token border. Selection uses border color/background rather than another outline. Build passed. Browser verified loaded photos in list/card, visible empty copy, default/selected 1px borders with no visible outline/additional ring, and photo credits. Original prototype, shared UI source and Production remain unchanged.

## Multiple attachments, mixed video and gray-100 background

User approved multiple-image and mixed image/video thumbnail examples, centered video play controls, and gray-100 empty-media backgrounds. Added a two-photo record, a synthetic two-second video plus still-image record, and retained single-image/empty examples. All media is embedded from the existing licensed/synthetic review assets. Controls reuse Button, Badge and CDS play/pause/chevron icons; no existing shared carousel was found. Empty media uses `--clair-color-atomic-gray-100` (#EDF2F7), not the separate neutral-100 token.

Build passed. Browser verified photo navigation 1/2 to 2/2, video playback with advancing currentTime and no media error, explicit pause, switching from video to image, selection of media retained across list/card view switches, and the correct gray-100 computed background. The final view starts paused with a centered play button; no autoplay. Shared component source, original prototype, app and Production remain unchanged.

## Embedded source panel for browsing comparisons

User requested removing the dimmed modal and keeping the source inside chart search so they can continue searching and open successive charts without closing the reader.

- Replaced the modal Sheet with the existing EmrRightPanel composition inside the search body. Header/search controls remain full width; result list and source have independent scrolling. No backdrop or focus trap.
- Clicking result text/body or its keyboard-accessible title opens/replaces the source. Checkbox, menus and media controls keep their own actions. Search and view changes retain the open source; explicit close and Escape within the reader dismiss it.
- Added a current-source row highlight and container-responsive list composition. Also applied the user's pending request for a transparent video-play button with a white icon.
- Build passed. Browser verified body-click source switching, query filtering with the source open, next-chart replacement, list/card switching, checkbox independence, Escape close, no Sheet overlay, no horizontal row overflow at the current desktop viewport, transparent white play control, and no browser error logs.
- User acceptance of panel width and simultaneous browsing remains pending. Small-screen stacked layout is implemented but not visually verified. Production and original index.html were not changed.

## Correction: overlay drawer, preserve list width

User rejected the split panel because it consumed list space and conflicted with narrow mode. Replaced its flex sizing with an absolutely positioned nonmodal drawer anchored inside the search body. It overlays the right side without resizing or recentering results; header/search controls stay accessible. Removed the split-specific padding and responsive stacking. Existing row activation and source replacement remain.

Build passed. Browser measured wide results at x=73/width=1814 both before and after opening. Narrow results settled at x=372/width=1216 with the drawer both closed and open (an immediate measurement during the existing width transition was discarded). Verified searching with the drawer open, changing source from 보리 to 루루 by result body click, clearing search while retaining the source, and no dim overlay. Width/occlusion usability still needs user acceptance; no Production change.

## Annotation correction: full workspace anchor

User explicitly annotated main.workspace, including its title/search/header, as the drawer boundary. Moved the source aside to a direct child of that positioned workspace; it now enters from the right and spans the entire workspace height, rather than starting below the search toolbar. Still no backdrop, list resize or recentering. Toolbar controls under the drawer are occluded while it is open; the left search input remains usable.

Build passed. Browser observed workspace top/bottom 62/1245 and drawer 63/1244 (inside its 1px border), right edges 1888/1887; narrow list remained 1216px. Verified searching with the drawer open and replacing its source by clicking another result. Desktop local prototype only; user acceptance pending.

## ClickUp reference and project row-state alignment

User requested a ClickUp task-details-inspired drawer and correction of list hover/selection to project conventions. Mobbin search was unavailable because the tool required a paid plan. Used and visually inspected ClickUp's official task/sidebar screenshots instead:
- https://help.clickup.com/hc/en-us/articles/29665520762647-Task-layouts (sidebar screenshot attachment 36461629772695)
- https://help.clickup.com/hc/en-us/articles/10552031987735-Intro-to-tasks (task screenshot attachment 41413238301335)

Kept the annotated full-workspace overlay anchor, list width, no-dim interaction and chart replacement. Adapted only the compact toolbar, prominent title, aligned properties and separated content sections: visit purpose is now the main heading; patient context precedes it; status/date/veterinarian/author fields use aligned rows; S/O, diagnosis, Plan and attachments have separate sections. Kept all existing synthetic clinical data and copy actions. Favorite and close use existing default icon buttons. No comments/activity/AI functionality was invented.

Read docs/design/system/table-density-and-grid-ergonomics.md Row State and Action Visibility plus actual globals/table surfaces. Row hover/focus uses --emr-state-hover (4%), selected uses --emr-state-selected (6%), pressed uses --emr-state-active (8%) over the card surface. Removed the black selected border and duplicate title background. Detail target exposes data-state=selected and aria-current independently of bulk checkboxes.

Build passed. Browser observed hovered/focused row at 4%, detail-selected row at 6% with unchanged neutral border, shared favorite updates, checkbox/source independence, search and source replacement, transparent expanded-title background and no console errors. Pressed 8% is implemented from the token but was not separately captured while held. No shared component, app or Production edits. Visual acceptance of the redesigned drawer remains pending.

## Compact drawer attachments

User approved replacing the large always-visible drawer media with a horizontal thumbnail strip. Drawer-only SourceAttachments now shows 96x72 thumbnails, white play glyphs for videos, and an inline large preview only after a thumbnail is chosen. Closing returns focus to its trigger. No attachments renders one line (첨부 없음). Changing charts resets the open attachment. Main search-result media remains unchanged.

Build passed. Browser verified two thumbnails and no initial preview, choosing the second image, closing it, video preview controls with autoplay off, no-attachment text, and resetting preview on source change. Video playback in this newly added inline preview was not exercised; its native controls/pause state were observed. Local prototype only.

## Approved detail polish and light controls on dark media

User approved the six measured detail fixes and light-mode media controls for the annotated dark ultrasound example. Earlier structural critique items were withdrawn at the user's instruction; no toolbar relocation, previous/next-chart navigation, list-density redesign, selection-policy change or Escape rewrite is included.

- Thumbnail strip uses 4px focus clearance with compensating margins; first thumbnail now aligns exactly with the attachment heading (measured 0px difference).
- Patient and guardian metadata both render 20px line height; removed the accidental generic paragraph override effect.
- Grouped the header document icon/label at the existing 6px gap, keeping breadcrumb separator spacing independent.
- ImageOff uses strokeWidth 1.5. No-attachment media uses the approved Gray 100 (#EDF2F7).
- Drawer elevation uses --clair-shadow-lg rather than a custom shadow.
- Dark synthetic video/still assets use a per-asset local light-controls flag: white-alpha-92 navigation/count surfaces with neutral-900 content, white hover surface. Bright photo examples retain dark controls. Play remains a transparent white icon. This prototype does not automatically detect arbitrary-image brightness.

Build passed. Browser measured all six fixes, observed thumbnail keyboard focus without clipping, opened the second image and closed it, navigated dark video/still 1/2 to 2/2 and back, and played the synthetic video to its 2-second end without a media error. Browser error log was empty. Only local review TSX/CSS and generated HTML changed; original index.html, shared components, app and Production remain unchanged.

## Scrollbar stays at the workspace edge

User approved moving the result scrollbar to the right edge while keeping title/search fixed and allowing only result content and selection controls to narrow. Reused the shared ScrollArea around a full-width result viewport; moved width limits and horizontal insets to its inner result document. The result metadata and notices follow the same content width.

Browser verification at 1600x1000: wide and narrow content measured 1516px and 1216px; scrollbar right stayed at x=1589, inside the workspace right border at x=1590. A real 500px wheel scroll moved only the results; the header stayed at y=107. Switching back to wide retained scrollTop=500. Reviewed wide, narrow and scrolled screenshots. Card mode also retained the same scrollbar edge with no horizontal overflow. Empty search feedback filled the available result area, and the browser reported no page errors. Local prototype only; user acceptance remains pending.

## Patient history inside the existing drawer

User canceled the compact-header alternative and approved preserving the existing full-workspace overlay. The briefly generated v3 files were removed before presentation; v2 was unchanged at that point. Before this change, v2 source, CSS, standalone HTML, build script and notes were backed up outside the checkout at `/private/tmp/chart-search-review-before-patient-history-20261122`.

User then supplied two drawer screenshots and clarified that the drawer must show the same patient's other charts, grouped by date with independently expandable cards. The user reviewed the proposed structure and explicitly approved local implementation.

- Replaced the single-chart reader with a patient-history drawer. Patient name/age, guardian, species/breed remain in the fixed header. Existing overlay anchor, width, outer list layout and scrolling are preserved.
- Each synthetic patient has four records across three visit dates, including two records on one day. Records use explicit patient IDs; the selected search chart opens expanded and the others start collapsed. Multiple charts can remain open. Date groups and all-chart expand/collapse actions reuse existing history controls and conventions.
- Reused EmrRightPanel/Header/Body, ScrollArea, EmrContentHistoryGroup, EmrHistoryFilterPopover/Search, Select, Card, Badge, status badges and existing default buttons/icons. No matching shared detailed accordion card existed, so the local composition combines Card with an accessible Button toggle and its linked content.
- Each expanded card shows visit purpose, diagnosis summary, veterinarian/author/date information, S/O, Assessment, Plan and the existing attachment thumbnails. Copy/favorite actions now belong to each chart. Text and section clipboard copying operate on synthetic text. Existing-chart copy and new-chart creation remain scope notices; no record is persisted or created.
- The drawer has independent latest/oldest sorting, date/status filtering and keyword search. These apply only to the current patient's history. Switching patients resets those local controls and replaces the records. The outer search sample remains the original six synthetic seed records (five completed by default).

Verification: standalone build passed; browser checked four patient-scoped records, three date groups, selected-only initial expansion, independent multi-card expansion and keyboard collapse, attachment preview, fixed header during history scrolling, unchanged outer scroll, oldest sorting, keyword/empty recovery, date range validation, draft-status filtering, clipboard contents for the selected historical chart, independent favorites, patient replacement, all-chart expand/collapse, narrow-mode geometry/right-edge scrollbar and Escape/focus return. No page errors or external requests were observed in the main verification run. Visually reviewed 1900x1200 and 1387x866 screenshots with no horizontal history overflow.

Evidence is outside the checkout: `/private/tmp/chart-search-history-verification.json`, `/private/tmp/chart-search-patient-history-final.png`, and `/private/tmp/chart-search-patient-history-compact.png`. No shared application component, original prototype, database, Figma design or Production deployment was changed. Production history completeness, permissions, copy/create behavior and user visual acceptance remain outside this local verification.

## Stable drawer and deployed design-system alignment

User requested keeping the drawer stationary when selecting another patient's result, full-row hover on accordion headers, and alignment/spacing/typography based on deployed main using existing components and tokens.

- Re-fetched main and verified Production's Ready deployment: both point to `5378ae31cbaa3486b172f2d17f2da7f4f6be17fd`. Local shared components, tokens and globals have no differences against that revision. This verifies the design-system source baseline, not authenticated Production visual acceptance. No local Storybook listener was available.
- Kept the outer drawer mounted during patient replacement. Only the patient-scoped contents reset; opening the drawer initially still uses the existing entry animation.
- Accordion headers now use a full-row accessible shared Button with separate sibling action buttons. Hover uses the shared 4% overlay across the full header. The date remains on the shared date-group header; each chart header shows time, visit type and purpose, so collapsed charts can be distinguished without repeating the date.
- Removed custom drawer font sizes, line heights, expanded-card border emphasis and extra date-group padding override. Shared body/section/metadata/compact-title classes and existing spacing tokens now control the hierarchy. Shared Card, status badges, controls, history groups and right-panel composition remain in use.
- Corrected standalone font bundling: embed the same installed Pretendard Variable font and its license notice instead of stripping the import and relying on a system fallback. No font download or new dependency was added.
- Preserved full-workspace overlay position, width preferences, result width and right-edge scrolling. Before-change files are retained at `/private/tmp/chart-search-before-token-alignment-20261122`.

Verification: standalone build passed. Focused browser checks confirmed an identical outer drawer DOM node and zero new entry animations on patient switch, full-header pointer and keyboard toggles, independent favorite action, settled hover at rgba(0,0,0,0.04), loaded Pretendard, shared 14px/20px chart heading/body, and no horizontal overflow at 1387x866. The existing nine-scenario patient-history regression also passed, including search/filter/sort, attachment preview, scoped synthetic copying, scrolling and Escape/focus return. No page errors or external requests were observed. Wide and compact screenshots were visually reviewed.

Evidence: `/private/tmp/chart-search-token-alignment-verification.json`, `/private/tmp/chart-search-token-alignment-wide.png`, `/private/tmp/chart-search-token-alignment-compact.png`, and refreshed `/private/tmp/chart-search-history-verification.json`. Only local review files changed. User acceptance remains pending; application and Production were not modified.
