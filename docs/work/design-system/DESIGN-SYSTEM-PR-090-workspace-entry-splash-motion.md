# DESIGN-SYSTEM-PR-090 Workspace Entry Splash Motion

- Status: implemented
- Area: design-system / auth / app-shell
- Priority: P1
- Source: User request / supplied Figma reference and motion video
- Updated: 2026-08-08
- Closeout: `docs/completed/design-system/2026-08-08-workspace-entry-splash-motion-report.html`

## Goal

로그인 성공 뒤 워크스페이스 셸이 준비될 때까지 표시되는 스플래시를 재사용 가능한 컴포넌트로 만들고, 로딩 완료가 pulse 중간에 도착해도 로고가 `opacity 1 / scale 1` 상태로 복귀한 뒤 자연스럽게 종료되도록 한다.

## Source Contract

- 배경: `#FFFFFF`
- 로고: 화면 중앙, `#C7CCD1`, 128px 아이콘 슬롯, `transform-origin: center center`
- 진입: 600ms, `opacity 0 → 1`, `scale 0.85 → 1`, ease-out
- pulse: 한 방향 800ms, `opacity 1 ↔ 0.5`, `scale 1 ↔ 0.92`, ease-in-out
- 종료: 현재 pulse가 full 상태로 돌아온 뒤 overlay만 180ms ease-out
- reduced motion: pulse 없이 full 상태로 유지하고 준비 완료 시 즉시 종료

공유된 Figma node는 구현 시점에 파일에서 조회되지 않아, 사용자가 제공한 motion video와 대화에서 확정한 수치를 구현 기준으로 사용했다.

## Scope Boundary

- 로그인 성공 후 워크스페이스 진입에만 적용한다.
- AuthGate의 세션·권한 확인 스켈레톤과 개별 모듈의 데이터 로딩 UI는 유지한다.
- 워크스페이스 셸 mount를 usable-shell 준비 경계로 사용한다.
- 세션 또는 워크스페이스 접근 실패 시 기존 오류·로그인 화면을 보여주도록 splash를 정상 종료한다.
- Electron/Tauri 같은 native boot window는 현재 저장소 범위에 없으므로 포함하지 않는다.

## Implementation

- `WorkspaceEntryLoadingScreen`을 `ready`와 `onExitComplete`로 제어하는 재사용 가능한 모션 컴포넌트로 변경했다.
- 무한 repeat 대신 800ms down/up leg를 순차 실행해, 준비 신호를 full 경계에서만 반영하도록 했다.
- root provider가 로그인 route와 workspace route 사이에서 splash 상태를 유지한다.
- LoginForm이 시작 신호를, AppShell과 AuthGate 실패 경로가 완료 신호를 소유한다.
- 활성 중인 하위 화면은 `inert`와 `aria-hidden`으로 입력과 보조기술 접근을 차단한다.
- Storybook에 무한 로딩과 full-state 완료 예시를 추가했다.
- 기존 orbit/ring loader 전용 CSS는 사용처와 함께 제거했다.

## Acceptance Criteria

- [x] 흰색 전체 화면과 중앙의 옅은 회색 로고가 표시된다.
- [x] 진입·pulse·scale·opacity 수치가 확정된 motion contract와 일치한다.
- [x] 준비 신호가 pulse 중간에 와도 full 상태로 복귀한 뒤 종료한다.
- [x] 준비 전까지 pulse를 무한 반복한다.
- [x] 종료 시 메인 화면이 이미 렌더된 상태에서 overlay가 180ms fade out한다.
- [x] reduced-motion 사용자는 반복 motion을 보지 않는다.
- [x] 로그인 전용 범위와 기존 AuthGate 스켈레톤을 보존한다.

## Verification

- Focused Playwright motion/auth checks: 6/6 passed
- Full repository ESLint: passed
- Next production build and its TypeScript phase: passed
- Static Storybook build: passed; new story bundle emitted
- Docs links, secret scan, and Korean UX copy checks: passed
- `git diff --check`: passed
- Standalone `npx tsc --noEmit`: blocked by a pre-existing unrelated generic fixture type error in `tests/customer-profile-live-read-projection.spec.ts:94`
- Existing broad billing login case reached the workspace with the splash removed, then failed on an unrelated missing invoice fixture assertion; the dedicated splash browser flow passed.

## Human Review

- 실제 데스크톱 창 크기에서 logo slot과 시각적 중심을 motion video와 나란히 비교한다.
- 로딩을 3초 이상 지연시켜 여러 pulse cycle 뒤에도 full 경계에서 종료하는지 확인한다.
- 운영 앱이 native splash window를 추가할 경우 이 renderer component와 별도 lifecycle로 설계한다.
