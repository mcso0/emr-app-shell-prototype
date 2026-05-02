# Implementation Docs

작업 전에는 먼저 `docs/implementation/mvp-current-status.md`를 읽는다.

## 문서 역할

| 문서 | 역할 |
|---|---|
| `mvp-current-status.md` | 현재 작업 상태와 Sales Demo Prototype 목표를 설명하는 단일 시작점 |
| `demo-sales-strategy.md` | 잠재 고객 계약 전환을 위한 데모 목적, 시나리오, 우선순위 |
| `mvp-parallel-workstreams.md` | 병렬 작업 브랜치/워크트리 전략과 A/B/C/D 핸드오프 프롬프트 |
| `pr1-pr6-realigned-plan.md` | PR 1-6 구현 순서와 완료 기록 |
| `mvp-gap-analysis.md` | MVP 요구와 현재 구현 사이의 갭 및 다음 우선순위 |
| `mvp-implementation-backlog.md` | Epic/User Story/Implementation Task 백로그 |
| `open-questions.md` | 승인/정보 확인이 필요한 항목 |
| `reference-screen-index.md` | Figma/screenshot reference file index |
| `reusable-component-candidates.md` | 공통화 후보와 추출 기준 |
| `reception-reusable-ui-notes.md` | 접수/예약 관련 UI 재사용 메모 |
| `api-boundary-selectors.md` | mock domain을 API/DB로 교체하기 위한 read repository/selector boundary |
| `api-boundary-integration-guide.md` | read boundary를 feature module에 점진 통합하는 후속 가이드 |

## 작업 시작 체크리스트

- `mvp-current-status.md`를 읽고 현재 완료/제외 범위를 확인한다.
- 데모 품질, 데모 데이터, 세일즈 시나리오와 관련된 작업이면 `demo-sales-strategy.md`를 함께 확인한다.
- 병렬 작업이면 `mvp-parallel-workstreams.md`를 읽고 전용 worktree에서 시작한다.
- 화면 작업이면 `reference-screen-index.md`와 실제 이미지 파일 존재 여부를 확인한다.
- Next.js application code를 쓰기 전 `node_modules/next/dist/docs/`의 관련 문서를 확인한다.
- 조제/처치 화면은 명시 요청 없이는 수정하지 않는다.
- 변경 범위에 맞는 Playwright test와 공통 검증 명령을 선택한다.
