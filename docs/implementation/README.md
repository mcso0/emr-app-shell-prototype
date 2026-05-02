# Implementation Docs

작업 전에는 먼저 `docs/implementation/mvp-current-status.md`를 읽는다.

## 문서 역할

| 문서 | 역할 |
|---|---|
| `mvp-current-status.md` | 현재 MVP 상태를 설명하는 단일 시작점 |
| `pr1-pr6-realigned-plan.md` | PR 1-6 구현 순서와 완료 기록 |
| `mvp-gap-analysis.md` | MVP 요구와 현재 구현 사이의 갭 및 다음 우선순위 |
| `mvp-implementation-backlog.md` | Epic/User Story/Implementation Task 백로그 |
| `open-questions.md` | 승인/정보 확인이 필요한 항목 |
| `reference-screen-index.md` | Figma/screenshot reference file index |
| `reusable-component-candidates.md` | 공통화 후보와 추출 기준 |
| `reception-reusable-ui-notes.md` | 접수/예약 관련 UI 재사용 메모 |

## 작업 시작 체크리스트

- `mvp-current-status.md`를 읽고 현재 완료/제외 범위를 확인한다.
- 화면 작업이면 `reference-screen-index.md`와 실제 이미지 파일 존재 여부를 확인한다.
- Next.js application code를 쓰기 전 `node_modules/next/dist/docs/`의 관련 문서를 확인한다.
- 조제/처치 화면은 명시 요청 없이는 수정하지 않는다.
- 변경 범위에 맞는 Playwright test와 공통 검증 명령을 선택한다.
