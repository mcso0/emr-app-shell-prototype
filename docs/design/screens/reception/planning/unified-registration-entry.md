---
id: DESIGN-SCREEN-RECEPTION-PLANNING-UNIFIED-REGISTRATION-ENTRY
status: draft
area: design
doc_type: planning
screen: reception
related_feature: PRODUCT-FEATURE-RECEPTION-APPOINTMENT
created: 2026-05-05
last_updated: 2026-07-07
---

# 접수/예약 통합 등록 진입 기획

## Summary

접수/예약 toolbar의 `환자 등록`, `보호자 등록` 두 진입점을 하나의 환자/보호자 master-data 등록 진입점으로 단일화한다. toolbar에서는 드롭다운 메뉴로 등록 케이스를 먼저 고르고, 시스템은 선택한 케이스에 맞춰 보호자/환자 정보를 draft로 받은 뒤 `등록 정보 확인`에서 최종 commit한다.

Recommended label: `환자/보호자 등록`

Rationale: 이 진입점의 목적은 실제 접수 생성이 아니라 환자와 보호자 master data 등록이다. 접수는 기존 `진료 접수` 버튼 또는 등록 성공 toast의 후속 액션으로만 진행한다.

2026-05-05 implementation decision: registration entry points are unified with a branch-first dialog, while the existing `진료 접수` shortcut remains available for staff who already know the patient to check in.

2026-07-05 command entry decision: the global command palette `환자/보호자 등록` action opens the same branch-first registration dialog from any workspace module. It must not only navigate to the reception screen. Registration completion still does not auto-create reception; staff choose the success toast follow-up action when they want to proceed to check-in.

2026-07-07 toolbar entry decision: the reception toolbar `신규 동물/보호자` button is an outline dropdown trigger with a chevron. Its menu uses compact labels, `신규 환자/보호자 등록` and `기존 보호자에 환자 추가`, and each item opens the matching registration branch directly. The first `신규 등록` mode-selection screen remains available for global command entry.

## Proposed Flow

1. Case selection first
   - 접수/예약 toolbar에서 `신규 동물/보호자` dropdown을 열면 `신규 환자/보호자 등록`, `기존 보호자에 환자 추가` 중 하나를 선택한다.
   - toolbar menu selection opens the matching branch directly, without showing the first `신규 등록` mode-selection screen.
   - global command palette에서 `환자/보호자 등록`을 선택하면 기존처럼 `신규 등록` dialog가 열리고, 카드형 radio option으로 `환자/보호자 모두 신규 등록`, `기존 보호자에 신규 환자 등록` 중 하나를 선택한다.
2. Branching
   - 환자/보호자 모두 신규 등록: 보호자 등록 1/2 → 환자 등록 2/2 → 등록 정보 확인 → commit.
   - 기존 보호자에 신규 환자 등록: 기존 보호자 검색/선택 → 환자 등록 → 등록 정보 확인 → commit.
3. Draft and confirmation
   - 최종 확인 전까지 입력값은 component-local draft로만 유지한다.
   - `등록 정보 확인`에서 `등록`을 누를 때만 session store에 보호자/환자를 생성한다.
4. Completion
   - 성공 toast는 `환자 상세 보기`와 `진료 접수` 후속 액션을 제공한다.
   - 등록 완료 후 자동으로 진료 접수로 이동하지 않는다.
5. Cancel behavior
   - 입력값이 있는 상태에서 닫거나 취소하면 이탈 확인 dialog를 보여준다.
   - 확인 전 취소된 draft는 session store에 남기지 않는다.

## Exception And Edge Cases

- Global command outside reception: if staff run `환자/보호자 등록` from chart, billing, lab, customer, home, or another workspace module, the same `신규 등록` dialog opens over the current module. The command must not end as a route-only jump to reception.
- Command palette handoff: selecting the action closes the command palette before opening registration, so two blocking dialogs are not stacked. Closing the registration dialog returns staff to the module where they started.
- Existing dirty draft: if the registration dialog has unsaved input, closing or cancelling requires the existing dirty-draft confirmation. Re-running the command must not silently discard that draft or create a second registration dialog.
- Missing required values: missing guardian name/mobile phone, patient name/species/breed/age or birth date blocks progression with field-level feedback.
- Invalid date or age: impossible birth dates or inconsistent age/birth-date input block progression until corrected.
- Duplicate guardian phone: a new guardian cannot be created with an existing guardian mobile phone; staff should choose the existing-guardian branch or open the existing guardian detail.
- Existing guardian branch without selection: staff cannot continue or commit until a valid existing guardian is selected.
- Duplicate patient signals: duplicate microchip blocks commit, and duplicate patient name under the same guardian shows a warning before final confirmation.
- Permission or server failure: registration mutation failure, missing permission, inactive user, or workspace membership failure shows a visible error and keeps the draft available for correction or retry.
- Success toast follow-up: registration success does not auto-create reception. `환자 상세 보기` opens the profile context, and `진료 접수` starts a reception drawer for the newly registered patient.
- Module switch during registration: if staff intentionally navigate away or close the dialog with dirty input, the dirty-draft confirmation governs whether the draft is discarded.

## Epic 1: 통합 경로 신규 내원 객체 등록 및 접수

User story: 리셉션 직원은 환자/보호자 등록 케이스를 먼저 선택하고, 시스템 가이드에 따라 보호자·환자 정보를 누락 없이 입력한 뒤 최종 확인에서 안전하게 등록한다.

Acceptance criteria:

- 기존 `환자 등록`, `보호자 등록` 버튼을 제거하고 `환자/보호자 등록` 버튼 하나로 통합한다.
- 전역 command palette의 `환자/보호자 등록` action은 현재 workspace module을 떠나지 않고 동일한 `신규 등록` dialog를 연다.
- 첫 화면에서 `환자/보호자 모두 신규 등록`, `기존 보호자에 신규 환자 등록` 중 하나를 선택한다.
- 신규 보호자 케이스는 보호자 등록 1/2, 환자 등록 2/2, 등록 정보 확인 순서로 진행한다.
- 기존 보호자 케이스는 기존 보호자 검색/선택, 환자 등록, 등록 정보 확인 순서로 진행한다.
- 각 단계 입력 데이터는 다음 단계로 자동 전달되지만 최종 확인 전까지 store에 commit하지 않는다.
- 보호자 성함/연락처, 동물 이름/종류/품종/나이 같은 필수값이 없으면 다음 단계 진행을 막고 field-level feedback을 표시한다.

## Epic 2: 동물 정보 등록 디테일

Goal: 정확한 환자 데이터를 확보하기 위해 동물 정보 입력 편의성을 높인다.

Acceptance criteria:

- 나이(년, 개월) 입력 시 현재 날짜 기준 생년월일을 역산한다.
- 생년월일 입력 시 현재 나이를 자동 계산해 노출한다.
- 주 품종 입력 시 자동완성 리스트를 제공한다.
- `믹스` 토글 활성화 시 종에 따라 `믹스견` 또는 `믹스묘`를 기본 제안한다. 기타 동물은 직접 입력을 유지한다.
- 마이크로칩 번호 입력 시 중복 여부를 확인한다.
- 동일 보호자 아래 동일 동물명 등록 시 경고 문구를 노출한다.

## Epic 3: 스마트 진료 접수 및 알림

Goal: 기존 환자의 재진 여부와 자주 쓰는 방문 목적, 접수 알림을 빠르게 처리한다.

Acceptance criteria:

- 환자의 완료된 진료가 1건 이상이면 `재진` 체크박스를 자동 활성화한다.
- 방문 목적 입력창 하단에 `예방접종`, `구토/설사` 등 자주 쓰는 목적 chip을 배치한다.
- 목적 chip 클릭 시 방문 목적 입력값에 즉시 반영한다.
- 접수 생성 시 `카카오톡 발송`이 체크되어 있으면 보호자에게 접수 확인 메시지 발송을 시뮬레이션한다.
- 접수 완료 후 대기 리스트와 담당의 timeline에 환자 카드가 즉시 생성된다.

## Implementation Plan

### RECEPTION-PR-004: Unified Registration Entry

- Toolbar에서 `환자 등록`, `보호자 등록` 버튼을 `신규 동물/보호자` 단일 dropdown button으로 교체한다.
- Global command palette의 `환자/보호자 등록` action은 toolbar와 동일한 dialog launcher를 사용한다.
- Toolbar dropdown의 `신규 환자/보호자 등록`, `기존 보호자에 환자 추가`는 통합 등록 dialog의 matching branch를 직접 연다.
- Global command palette entry keeps the first card-radio mode selection screen.
- 선택한 mode에 따라 `신규 보호자 등록 1/2` 또는 `기존 보호자 선택`으로 이동한다.
- 보호자/환자 입력값은 component-local draft로 관리한다.
- `등록 정보 확인`에서만 `addGuardian`, `addPatient`를 호출한다.
- 등록 완료 후 자동 접수로 이동하지 않고 성공 toast action으로 `환자 상세 보기`, `진료 접수`를 제공한다.
- dirty 상태에서 닫기/취소 시 이탈 확인 dialog를 보여준다.
- 나이와 생년월일 양방향 계산 UI를 추가한다.
- 믹스 토글 기본값을 종별로 `믹스견`/`믹스묘`로 제안한다.
- 동일 보호자 아래 동일 동물명 경고를 추가한다.
- 마이크로칩 중복 체크 feedback을 통합 flow 안에서도 일관되게 보여준다.
- 기존 진료 이력 기반 `재진` 자동 체크를 추가한다.
- 방문 목적 chip UI를 진료 접수 방문 목적 하단에 추가한다.
- `카카오톡 발송` 체크가 켜진 접수 생성 시 message send simulation 상태를 남긴다.
- 접수 완료 후 대기 리스트와 day calendar 반영 회귀를 강화한다.

## Decisions

- 최종 확인 전 draft 취소는 session에 아무 것도 남기지 않는다.
- `환자/보호자 등록`과 기존 `진료 접수` 버튼은 둘 다 유지한다.
- 카카오톡 발송은 실제 provider 없이 `MessageDelivery` shape의 session-only simulation 기록만 남긴다.

## Test Plan

- toolbar에 `신규 동물/보호자` dropdown과 `접수/예약` dropdown이 보이고 `신규 접수/등록`은 보이지 않는다.
- `신규 동물/보호자` dropdown menu shows `신규 환자/보호자 등록` and `기존 보호자에 환자 추가`.
- global command palette의 `환자/보호자 등록`을 어느 workspace module에서 실행해도 `신규 등록` dialog가 보이고 단순 reception 이동으로 끝나지 않는다.
- `환자/보호자 모두 신규 등록` branch가 보호자 등록 1/2 → 환자 등록 2/2 → 등록 정보 확인 → 성공 toast로 이어진다.
- `기존 보호자에 신규 환자 등록` branch가 기존 보호자 선택 → 환자 등록 → 등록 정보 확인 → 성공 toast로 이어진다.
- 최종 확인 전 취소 시 보호자/환자가 생성되지 않는다.
- dirty 상태에서 닫기/취소 시 이탈 확인 dialog가 보인다.
- 필수값 누락 시 다음 단계로 이동하지 않는다.
- 권한/서버 실패 시 draft가 유지되고 재시도 가능한 오류 메시지가 보인다.
- global command handoff에서 command palette와 registration dialog가 동시에 열린 채로 겹치지 않는다.
- 동물 나이와 생년월일이 서로 계산된다.
- 동일 보호자 아래 동일 동물명 경고가 보인다.
- 재진 환자는 진료 접수에서 재진 체크가 자동 활성화된다.
- 방문 목적 chip 클릭 시 방문 목적 입력값이 바뀐다.
- 카카오톡 발송 체크 후 접수하면 발송 simulation 상태가 확인된다.
