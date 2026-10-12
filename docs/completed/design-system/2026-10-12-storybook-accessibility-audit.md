# Storybook 자동 접근성 검사와 차트 테스트 안정화

검사일: 2026-10-12. 로컬 합성 데이터만 사용했다. 커밋·푸시·배포는 하지 않았다.

## 결과

차트 바이탈 테스트의 첫 실행 실패를 수정했다. 확인창 DOM이 생긴 직후 열림 애니메이션의 투명한 상태를 검사하던 것이 원인이었다. 같은 문구의 가시성 assertion을 `waitFor`로 감쌌다. 고정 sleep, 재시도 옵션, assertion 삭제는 추가하지 않았다. 제품 코드와 애니메이션은 그대로다.

바이탈 예제 7개를 새 Vitest 프로세스로 10회 실행해 **70/70 통과**했다. 저장 전 요청 0건, PATCH 대상/버전, null 값 저장, 과거 작성자·측정 시각·원본 기록 보존 검증을 유지했다. 타입 검사, 해당 파일 ESLint와 정적 Storybook 빌드도 통과했다.

**접근성은 통과 상태가 아니다.** 초기 예제 705개를 모두 정상 렌더한 뒤 axe-core 4.11.3으로 검사했다. 이 중 629개에서 한 가지 이상의 지적이 나왔다. 일반 페이지 맥락 규칙 3개(`main`, `h1`, `region`)를 제외하면 242개에서 내부 검토 대상이 남는다. 이는 서로 다른 버그 수가 아니다. 같은 공용 컴포넌트가 여러 예제에 반복된다. [규칙별 원시 집계와 전체 예제 목록](2026-10-12-storybook-accessibility-audit.json)을 함께 보관했다.

## 우선 수정 대상

| 우선순위 | 확인된 문제와 영향 | 근거 및 수정 방향 |
| --- | --- | --- |
| P1 | 통합 검색 결과가 `listbox` 안의 일반 버튼으로 렌더된다. 보조기술에 옵션·선택 상태를 올바르게 전달하지 못한다. | 필터 결과를 연 추가 검사에서 `aria-required-children: critical`. `src/shell/global-command-palette.tsx:550`, `:643`. 입력·결과·활성 항목 관계를 함께 맞추고 방향키·실행·필터 계약을 유지한다. |
| P1 | SOAP 실제 `role=textbox` 노드에 접근 가능한 이름이 없다. 일부 차트 아이콘 버튼과 검사 첨부 파일 입력도 이름이 없다. | `aria-input-field-name`, `button-name`, `label`. `chart-soap-live-block-editor.tsx:254`의 바깥 `BlockNoteView` 라벨이 내부 편집 노드로 전달되지 않는다. `chart-figma-workspace.tsx:219`의 라벨은 wrapper span에만 있고 안쪽 disabled 버튼에는 없다. `lab-imaging/components/lab-result-phase2.tsx:299`의 sr-only 파일 input에도 라벨이 없다. 실제 상호작용 노드에 이름을 전달한다. |
| P2 | 업무 선택 카드의 버튼 역할 안에 메뉴 버튼이 중첩된다. | `nested-interactive`. `src/components/emr/side-panel-card.tsx:51`, `task-queue-card.tsx:104`. 차트·조제 실제 caller도 같은 구조다. 선택 영역과 메뉴를 형제 컨트롤로 분리하되 클릭·Enter·Space 동작은 유지한다. |
| P2 | 빈 상태 제목 등 일부 보조 텍스트의 대비가 부족하다. | 예: `#858585`/흰색, 14px, 3.69:1; 검사 기준 4.5:1. `src/components/emr/empty-state.tsx:324`. 토큰 또는 컴포넌트 범위를 정해 대비를 조정하고 모든 사용 화면을 재검사한다. |
| P2 | 테이블 너비 조절 버튼이 8×24px이며 인접 버튼과의 여유도 부족하다. | `target-size`. `src/components/emr/table-primitives.tsx:293`. 실제 고객 테이블 예제에서 확인했다. 시각적 구분선과 드래그/키보드 조절 계약을 유지하면서 유효 클릭 영역을 넓힌다. |
| P2 | 필터 안내 span의 `aria-label`, 진단 검색의 presentation 역할과 `aria-expanded`가 역할 규칙에 맞지 않는다. | `aria-prohibited-attr`, `aria-allowed-attr`. `table-filter-builder.tsx:397`, `src/features/chart/module.tsx:14908`. 단순 속성 제거로 끝내지 말고 실제 안내/입력 컨트롤의 의미와 상태 전달을 맞춘다. |
| P2 | Command 빈 결과에서 listbox의 필수 자식 역할 검사가 실패한다. | `design-system-ui-command--empty-results`에서 확인. 공유 Command/cmdk 빈 상태 문제이며 WorkspaceSwitcher·PRD에도 동일 구성이 있다. 해당 실제 caller의 빈 상태는 추가 재현이 필요하다. |
| P2 | 초대 화면의 설명 목록 구조, 일부 스크롤 영역, 빈 표 머리글, 로딩 제목과 제목 단계에도 지적이 있다. | 아래 집계와 JSON의 대표 selector를 기준으로 개별 확인한다. 단독 예제와 실제 페이지의 제목/랜드마크 맥락을 구분한다. |

위 대표 원인은 기존 소스에서도 확인됐다. 이번 변경은 바이탈 테스트 대기 조건뿐이며 접근성 제품 코드는 수정하지 않았다. axe의 `critical/serious`는 검사 엔진의 심각도이고, 위 P1/P2는 수정 순서를 위한 판단이다.

## 자동 검사 집계

초기 705개 상태만 집계했다. 각 숫자는 해당 규칙이 나온 예제 수와 DOM 노드 수다. 한 예제가 여러 행에 포함될 수 있다.

| 규칙 | 의미 | axe 심각도 | 예제 | 노드 | 해석 |
| --- | --- | --- | ---: | ---: | --- |
| `aria-allowed-attr` | 현재 역할에 허용되지 않는 ARIA 속성 | critical | 5 | 5 | 컴포넌트/예제 내부 검토 대상 |
| `aria-required-children` | 필수 자식 역할 없음 | critical | 6 | 7 | 컴포넌트/예제 내부 검토 대상 |
| `button-name` | 버튼 이름 없음 | critical | 30 | 61 | 컴포넌트/예제 내부 검토 대상 |
| `label` | 폼 입력 라벨 없음 | critical | 21 | 34 | 컴포넌트/예제 내부 검토 대상 |
| `aria-hidden-focus` | 숨김 영역의 포커스 요소 | serious | 3 | 12 | Base UI focus guard 동작 수동 확인 필요 |
| `aria-input-field-name` | 입력 영역 이름 없음 | serious | 31 | 31 | 컴포넌트/예제 내부 검토 대상 |
| `aria-prohibited-attr` | 역할 없는 요소의 ARIA 라벨 | serious | 46 | 88 | 컴포넌트/예제 내부 검토 대상 |
| `color-contrast` | 텍스트 대비 부족 | serious | 139 | 320 | 컴포넌트/예제 내부 검토 대상 |
| `definition-list` | 설명 목록의 잘못된 자식 구조 | serious | 6 | 6 | 컴포넌트/예제 내부 검토 대상 |
| `dlitem` | 설명 항목과 목록 관계 오류 | serious | 6 | 48 | 컴포넌트/예제 내부 검토 대상 |
| `nested-interactive` | 클릭 요소 중첩 | serious | 28 | 65 | 컴포넌트/예제 내부 검토 대상 |
| `scrollable-region-focusable` | 스크롤 영역 키보드 접근 불가 | serious | 3 | 7 | 컴포넌트/예제 내부 검토 대상 |
| `target-size` | 클릭 영역 또는 주변 여유 부족 | serious | 31 | 936 | 컴포넌트/예제 내부 검토 대상 |
| `heading-order` | 제목 단계 건너뜀 | moderate | 22 | 22 | 컴포넌트/예제 내부 검토 대상 |
| `landmark-banner-is-top-level` | 중첩된 header 랜드마크 | moderate | 2 | 2 | 컴포넌트/예제 내부 검토 대상 |
| `landmark-complementary-is-top-level` | 중첩된 aside 랜드마크 | moderate | 18 | 20 | 컴포넌트/예제 내부 검토 대상 |
| `landmark-contentinfo-is-top-level` | 중첩된 footer 랜드마크 | moderate | 2 | 2 | 컴포넌트/예제 내부 검토 대상 |
| `landmark-one-main` | main 영역 없음 | moderate | 544 | 544 | 단독 프레임/실제 페이지 구분 필요 |
| `page-has-heading-one` | h1 없음 | moderate | 512 | 512 | 단독 프레임/실제 페이지 구분 필요 |
| `region` | 랜드마크 밖 콘텐츠 | moderate | 389 | 1100 | 단독 프레임/실제 페이지 구분 필요 |
| `empty-heading` | 빈 제목 | minor | 1 | 1 | 컴포넌트/예제 내부 검토 대상 |
| `empty-table-header` | 빈 표 머리글 | minor | 6 | 6 | 컴포넌트/예제 내부 검토 대상 |

`main`·`h1`·`region` 지적은 모두 제품 오류로 확정하지 않았다. 많은 예제가 전체 페이지가 아닌 컴포넌트 조각이며, 실제 `WorkspaceFrame`은 main, `EmrPageHeader`는 h1을 제공한다. 전체 앱 조합에서 같은 지적이 나온 경우에는 별도로 확인해야 한다. Base UI focus guard의 `aria-hidden-focus`도 단순히 tabindex를 제거하지 말고 실제 포커스 이동을 확인해야 한다.

## 추가 상태 5개

- 과거 바이탈 값 비우기 확인창: 확정 위반 0. 모달 배경 포커스는 `incomplete`.
- 바이탈 저장 후 닫기: 단독 예제의 main/h1 지적만 발생.
- 통합 검색의 수의사 필터 결과: `aria-required-children` 1노드, critical.
- 근무표 저장 대기: 확정 위반 0. 모달 배경 포커스는 `incomplete`.
- 390px 긴 날짜: 단독 예제의 main/h1 지적만 발생.

바이탈의 결과를 전체 차트 접근성 통과로 해석하지 않는다. 전체 차트 예제의 SOAP/버튼 이름 지적은 별도로 남아 있다.

## 수동 확인 항목

axe가 판정을 확정하지 못한 항목을 `incomplete`로 별도 집계했다. 아래 수치를 위반 0으로 처리하지 않았다.

| 규칙 | 예제 | 노드 |
| --- | ---: | ---: |
| `aria-hidden-focus` | 26 | 78 |
| `aria-prohibited-attr` | 93 | 282 |
| `aria-valid-attr-value` | 31 | 46 |
| `bypass` | 373 | 373 |
| `color-contrast` | 172 | 2323 |
| `target-size` | 6 | 6 |
| `th-has-data-cells` | 1 | 1 |

## 검사 방법과 한계

- 현재 프로젝트에는 `addon-a11y`가 설치·설정되어 있지 않다. `run_story_tests({a11y:true})`의 일반 테스트 결과만으로 접근성 검사가 실행됐다고 주장할 수 없다. 이번에는 이미 설치된 axe-core를 별도로 실행했다. 프로젝트 의존성은 바꾸지 않았다.
- 705개 실제 Storybook Canvas의 초기 상태를 밝은 테마, 1440×1000 Chromium에서 검사했다. 실제 args/decorators/loaders/beforeEach를 유지했다. 스캐너 전용 hook으로 play만 중지해 모달이 자동으로 닫히는 것을 방지했다. hook은 설치된 Storybook 내부 API에 의존하므로 업그레이드 시 재확인해야 한다.
- 일치하는 `storyFinished: success`, 비어 있지 않은 렌더, 실제 story viewMode를 요구했다. 폰트 로드를 기다리고 유한 애니메이션은 최대 1초 기다렸다. 무한 로딩 애니메이션의 종료는 기다리지 않았다. iframe 전체 document를 검사해 body portal을 포함했다. Storybook 관리자 화면은 검사하지 않았다.
- 정적 빌드는 통과했다. 별도 정적 미리보기 스캔 시도에서 동적 모듈 로딩 실패가 나와 해당 결과를 제외했다. 최종 705개 검사 증거는 정상 렌더한 개발 Canvas에서 확보했다. 정적 미리보기 실행 안정성은 이 보고서의 통과 항목이 아니다.
- 초기 상태와 위 추가 5개만 검사했다. 모든 메뉴·오류·키보드·스크린리더·테마·화면 폭이나 운영 환경을 검증한 것은 아니다. 자동 검사 결과만으로 WCAG 준수를 선언하지 않는다.
- 이전 작업과 WIP는 유지했다. 원래 checkout은 수정하지 않았다. 로컬 구현·검증 결과이며 사용자 수용이나 원격 전달 완료를 뜻하지 않는다.
