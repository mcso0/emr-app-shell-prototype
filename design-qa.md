**Comparison Target**

- Source visual truth: `/var/folders/ry/c7363zsn6hlbkfymf6gwn9f80000gn/T/codex-clipboard-a119370b-91cb-48f4-a89b-71b067f52546.png`, the browser-annotation decisions in this task, and `/Users/iseung-ug/project/emr-app-shell-prototype/.worktrees/chart-preconsultation-prototype/src/features/chart/prototypes/chart-preconsultation-prototype.tsx`.
- Rendered implementation: `https://emr-app-shell-prototype.vercel.app/w/workspace-clair-cheongdam/treatment?modulePanel=open&aside=closed&encounterId=c2a77246-a738-4ca6-ad59-aa1623318c36`.
- Implementation screenshot: `docs/completed/chart/2026-07-16-chart-preconsultation-staging.png`.
- Combined comparison: `docs/completed/chart/2026-07-16-chart-preconsultation-design-qa-comparison.png`.
- Viewport: implementation 1728 x 1265; source concept normalized to 1265px height for the combined full-view comparison.
- State: authenticated fixed staging and authenticated production, 2026.07.15 queue, waiting patient `구름`, pre-call screen.

**Findings**

- No actionable P0/P1/P2 mismatch remains against the final annotation contract.
- The initial selected concept differs in intentional, user-approved ways: the pre-call legacy context bar is removed, the patient header uses the pet-icon fallback and balanced patient/guardian typography, the visit purpose and reception context are separate sections, and the right summary has no section-title icons.
- Live text and counts differ from the concept because the implementation reads the existing database and deliberately has no UI fixture fallback. This is expected product behavior, not visual drift.

**Required Fidelity Surfaces**

- Fonts and typography: existing CLAiR font stack and neutral foreground tokens are reused. Patient name, guardian name, metadata, section headings, labels, and values follow the final prototype hierarchy without clipping at the desktop verification viewport.
- Spacing and layout rhythm: the content surface stops at 1440px, uses the requested 4/8-based spacing system, keeps the header vertically centered, and separates visit purpose, reception, vitals, history, and the summary rail clearly.
- Colors and visual tokens: existing neutral, border, muted-surface, blue state, and destructive/attention tokens are reused. Visit purpose is a neutral information row rather than an alert treatment.
- Image quality and asset fidelity: the live schema has no patient-photo field, so the approved CLAiR pet icon is used inside the 12px rounded fallback avatar. No placeholder raster or handcrafted SVG was introduced.
- Copy and content: final labels (`환자 정보`, `환자 바이탈`, `과거 진료 이력`, `2026.07.15(오늘)`) match the approved annotation decisions. Database-backed purpose and notes are shown verbatim; missing values are explicit.

**Focused Region Comparison Evidence**

- Header: status/chart tags, square fallback avatar, patient/guardian balance, metadata row, and right-aligned CTAs match the final prototype component contract.
- Main information stack: visit purpose, four-column reception summary, equal-emphasis vital table, and chronological history use the approved grouping and spacing.
- Summary rail: title icons are removed; row icons remain on labels, label/value columns use the approved 1:2 ratio and left alignment, and the pre-call lock notice is absent.

**Primary Interactions Tested**

- Selected both waiting patients (`구름`, `초코`) and confirmed each patient's independent database-backed context.
- Opened the shadcn patient-information Sheet and verified patient, guardian, caution, allergy, and memo sections.
- Selected `1진료실`, called each patient, verified transition to the live chart and post-call patient context bar, then returned each encounter to waiting.
- Repeated the two-patient call/return smoke on production and confirmed the final queue returned to two waiting patients.
- Checked browser errors after the production flows: none. A pre-existing Tiptap duplicate-extension warning appears only after the chart editor mounts and is not part of this preconsultation change.

**Implementation Checklist**

- [x] Desktop pre-call layout matches the final annotation contract.
- [x] Existing CLAiR, shadcn, icon, and token contracts are reused.
- [x] Live DB data and honest missing-data states render without fixture fallbacks.
- [x] Patient Sheet and two-patient call/return flows work on fixed staging and production.
- [x] Browser console has no errors in the verified production flows.

**Follow-up Polish**

- P3: replace terse synthetic seed copy such as numeric visit purposes when the staging dataset is next curated; the UI correctly reflects the current stored values.

final result: passed

---

## 2026-08-02 고급 필터 구현

**Comparison Target**

- Source visual truth: Figma `27896:62420` 필터 버튼 component set, `27898:58705` 고급 필터 state board, 그리고 이번 작업에서 승인된 UX 결정.
- Rendered implementation: `http://localhost:3112/w/clair-demo/customer?modulePanel=open` 및 `http://localhost:3112/w/clair-demo/orders?modulePanel=open`.
- Viewports: 1280px desktop와 390×844 narrow viewport.
- States compared: 선택 없음/있음 trigger, 1개 rule, 같은 group의 복수 rule, 복수 group, AND/OR, info tooltip, 좁은 화면 stack.

**Findings**

- P0/P1/P2 불일치 없음.
- Desktop에서는 첫 번째 group도 왼쪽 combinator 자리만큼 들여써 두 번째 group의 회색 surface와 `x=285`, `width=571`로 정확히 정렬된다.
- 필드 Select menu는 popover 내부에 잘리지 않고 overlay로 표시된다.
- 390px에서는 field/operator/value가 전체 폭 세로 stack으로 전환되며 문서 가로 overflow가 없다.
- Figma 전용 reset 색은 추가하지 않고 기존 CLAiR/EMR danger token을 사용했다. 이는 사용자 승인에 따른 의도적 차이다.

**Primary Interactions Tested**

- 완료 rule만 count에 포함: `0 → 1 → 2`.
- 불완전 편집 중에는 last-valid 적용 결과와 count 유지.
- 그룹 간 AND 결과 2행에서 OR 변경 후 5행으로 증가해 실제 평가 동작 확인.
- 내부 rule 및 외부 group AND/OR 선택, rule/group 추가, 초기화 확인.
- info 버튼 keyboard focus에서 tooltip과 `aria-describedby` 확인.
- 고객관리와 병원관리 Order 양쪽에서 같은 공유 popover가 열림.
- 새 인앱 브라우저 탭에서 console error 0건.

**Verification**

- Targeted ESLint: passed.
- TypeScript `--noEmit`: passed.
- Storybook production build: passed.
- Unified standalone implementation report contract/build tests: passed (74 records, 9 checks).

final result: passed
