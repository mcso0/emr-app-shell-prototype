# SOAP Editor UX Foundation

2026-05-13 진료(차트) SOAP editor UX를 Tiptap 유지 방향으로 보강했다.

## What Changed

- SOAP 본문을 하나의 editable HTML blob에서 `주관적`, `객관적`, `평가`, `계획` 필드형 editor로 재구성했다.
- SOAP 필드 라벨은 editor 바깥의 고정 UI로 이동해 사용자가 구조 라벨을 지우지 않게 했다.
- SOAP toolbar는 현재 focus된 필드에 대해 undo, redo, bold, italic, underline, bullet list, numbered list, link를 실행한다.
- 링크 입력은 `window.prompt` 대신 inline popover를 사용한다.
- 첨부 자료 action은 rich-text body 밖의 SOAP card action으로 유지했다.
- Structured SOAP editor와 link popover 회귀 테스트를 추가했다.

## Verification

- Passed:
  - `npx tsc --noEmit`
  - `npx eslint src/features/chart/module.tsx tests/chart.spec.ts`
  - `npx playwright test tests/chart.spec.ts --reporter=line` (`14 passed`)
- Browser review:
  - Opened the local CLAiR EMR treatment screen at `/w/clair-demo/treatment?modulePanel=open&aside=closed&right=closed`.
  - Confirmed the SOAP editor renders structured fields for both empty and populated chart states without pushing the order area out of the workspace.

## Notes

- Tiptap remains the editor engine.
- This does not add live persistence, autosave semantics, audit logging, or server validation.
- A future follow-up can add SOAP templates/snippets and keyboard shortcut polish.
