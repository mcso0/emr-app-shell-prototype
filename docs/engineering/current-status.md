# MVP Current Status

Updated: 2026-05-14

이 문서는 EMR SaaS 작업의 현재 상태를 설명하는 단일 시작점이다. 새 작업을 시작하는 Codex나 개발자는 먼저 이 문서를 읽고, 필요한 세부 문서로 이동한다.

## Agent Compact Summary

- Current target: Product MVP.
- This is a session-only frontend prototype for veterinary EMR workflows from reception through billing.
- Live DB/API persistence, live Supabase validation, migrations, RLS, and server-side permission enforcement are not complete.
- Client-only permission gating is not complete security.
- Recommended next work: approve one permission resolver, migration/RLS, or API/server enforcement unit.
- Use concise English for agent-facing plans and handoff notes. Keep user-facing result reviews in Korean unless requested otherwise.

## Current Working Target

초기 문서들은 MVP라는 표현을 사용했고 한동안 Sales Demo Prototype을 우선했지만, 2026-05-02 기준 당장의 작업 목표는 다시 **Product MVP 제작**으로 전환한다.

현재 구현물은 Sales Demo Prototype으로 검증한 외래 흐름을 제품 MVP로 끌어올리는 단계로 본다. 데모 전략 문서는 세일즈 시나리오와 화면 품질 기준으로 유지하되, 가까운 작업 우선순위는 로그인/권한, API/DB boundary 통합, persistence, audit/service catalog 통합처럼 실제 운영 제품으로 가는 기반 작업을 우선한다.

MVP 전환 목표:

- 사용자가 로그인한 뒤 워크스페이스에 진입한다.
- 역할/권한 기반 UX를 mock foundation에서 시작해 실제 auth provider와 DB/API session으로 교체 가능한 경계로 만든다.
- 접수부터 수납까지 이어지는 외래 흐름은 유지하되, demo-only 설명보다 제품 동작과 데이터 경계를 우선한다.
- Sales Demo golden path는 회귀 테스트와 대표 fixture로 보존한다.

2026-05-02 기준 **Sales Demo Wave 2는 완료되어 `main`에 병합**되어 있다. 완료 범위와 검증 결과는 `docs/archive/sales-demo/sales-demo-wave2-closeout.md`를 기준으로 확인한다.

## Foundation 진행 현황

PR7 UI 정렬과 별도로 진행한 A/B/C/D foundation 작업이 `main`에 통합되어 있다.

- API boundary selectors는 mock domain을 나중에 API/DB로 교체하기 위한 read repository와 selector layer를 제공한다.
- Service catalog/role seed는 수가/서비스 항목과 `front_desk`, `vet`, `nurse`, `billing_admin`, `hospital_admin` 역할 seed를 제공한다.
- Audit log foundation은 status transition, profile edit, SOAP save, order status change, billing action event builder와 fixture를 제공한다.
- Auth mock foundation은 `/login` 역할 선택, sessionStorage/localStorage mock session, logout utility, shell 역할 표시, permission helper를 제공한다.
- 2026-05-03 기준 auth UI는 `useAuthClient()` boundary를 통해 mock session을 사용하며, 로그인 pending/error 상태가 회귀 테스트에 추가되었다.
- 2026-05-03 기준 Supabase provider adapter가 `useAuthClient()` boundary 뒤에 추가되었다. env 미설정 또는 `NEXT_PUBLIC_AUTH_MODE=mock`에서는 mock/local demo fallback을 유지한다.
- 2026-05-03 기준 접수/예약 Product MVP 보강 첫 단위로 현장 접수 form 입력값이 session-only encounter/queue 생성에 반영되며, 담당의 미지정 현장 접수도 진료대기 상태로 사이드 패널과 day calendar에서 확인된다.
- 2026-05-04 기준 접수/예약 운영 UI가 조제/처치 side panel 기준에 맞춰 보강되었고, 신규 동물/보호자 등록 dialog는 같은 작은 shadcn 기반 modal 구조로 정리되었다.
- 2026-05-05 기준 접수/예약 toolbar의 `진료 접수`는 선택된 대기열 환자의 접수 정보를 여는 drawer가 아니라 신규 접수를 만드는 dialog로 동작하며, 접수 대상 환자는 dialog 안에서 새로 선택한다.
- 2026-05-05 기준 접수/예약 side panel은 대기 중심으로 시작하고, calendar card는 동물명/내원 목적 위계, 목적 icon label, 담당 수의사 accent bar, 현재 시각 label, 대기시간 신호등 pill을 사용한다.
- 2026-05-05 기준 신규 동물/보호자 등록은 보호자 검색 popover, 확장된 동물 종류/성별 선택, 품종 autocomplete, session-only 개인정보/마케팅 동의 기록, tablet signing mock, 휴대전화 중복 보호자 차단을 포함한다.
- 2026-05-05 기준 접수/예약 toolbar의 `환자 등록`/`보호자 등록`은 `환자/보호자 등록`으로 통합되었고, 케이스 선택 후 신규 보호자+환자 또는 기존 보호자+신규 환자를 등록하는 branch-first session-only flow를 제공한다. 등록 완료 후 자동 접수로 이동하지 않고 toast action으로 환자 상세 또는 진료 접수를 선택한다. 진료 접수 dialog는 환자 prefill, 재진 자동 체크, 방문 목적 chip, 카카오톡 발송 simulation을 포함한다.
- 2026-05-05 기준 작은 확인 modal은 `EmrConfirmDialogContent` 공통 컴포넌트를 사용한다. 접수/예약의 등록 취소 확인과 임상병리검사의 검사결과 붙여넣기 확인이 이 패턴을 공유한다.
- 2026-05-05 기준 side panel의 접힘 가능한 status group scaffold는 `EmrSidePanelCollapsibleGroup` 공통 컴포넌트를 사용한다. 조제/처치 order queue와 임상병리검사 order queue가 같은 header, accent bar, count, chevron rotation, collapse motion을 공유한다.
- 2026-05-05 기준 임상병리검사 화면은 조제/처치형 shell 구조를 사용한다. 검사 대기열, 환자 정보 인포바, 기본 열림 임상병리검사 이력 aside, 값 기반 정상범위 chart와 색상 판정 badge가 있는 임상병리검사 결과지, 검사결과 종합소견 입력, 우측 장비결과내역 패널로 구성된다. 임상병리검사 side panel은 조제/처치 side panel의 날짜 네비게이터 패턴과 오더별/차트별 목록 전환, 접힘 가능한 상태 그룹을 제공하며, 차트별은 같은 환자 차트에 내려진 임상병리검사 오더를 encounter 단위 카드로 묶어 보여준다. 검사결과 수신내역 right panel은 같은 날짜 네비게이터 패턴과 리스트 header action을 재사용하고, 현재 오더 연결 수신 카드 안에서 애니메이션 검사결과 미리보기 아코디언을 제공한다.
- 2026-05-06 기준 영상검사 화면은 차트/검사와 같은 App Shell 슬롯 구조로 재정렬되었다. 영상 대기열 side panel은 날짜 네비게이터, 오더별/차트별 전환, 접힘 가능한 상태 그룹을 제공하고, 중앙에는 환자 컨텍스트 header, 기본 열림 영상검사 이력 aside, 영상검사 Order 상세 table, PACS mock action, 스터디 판독의견, Imaging Dx/DDx/Impression/Recommendation, 첨부자료가 배치된다. 우측 종합소견 panel은 같은 차트 내 검사/영상 오더, 보호자 공유용 종합 코멘트, 미디어 thumbnail, 첨부 파일 목록, 저장/취소 footer를 제공한다. 레퍼런스 기반 와이어프레임은 `docs/reference/imaging/imaging-workspace-wireframe.html`에 있다.
- 2026-05-05 기준 진료(차트)는 조제/처치 workspace 슬롯 구조를 재사용하도록 재구성되었다. 진료 대기열은 공통 order queue side panel 패턴을 사용하고, patient context bar 아래 차트 이력 aside와 우측 환자 정보 패널(진료 참고, 개인/민감 정보, 부가 정보)을 제공한다. SOAP는 Tiptap 기반 진단계통별 편집기로 동작하며, 진단명 패널은 검색/선택 row action 중심으로 제공한다. 처방/오더 하단에는 오더 현황/금액/action 고정 footer가 있다.
- 2026-05-05 기준 진료(차트)는 SOAP가 여러 개로 늘어나도 처방/오더 영역이 화면 밖으로 밀리지 않도록 SOAP/진단 패널 내부 스크롤과 하단 처방/오더 영역을 분리했다. 차트 정보/SOAP 경계 divider와 SOAP/진단-오더 사이 grab divider를 추가했고, grab divider는 상하 영역 최소 높이를 지키면서 진료 기록/진단명 묶음과 처방/오더 영역 높이를 조절한다. Grab divider는 pointerup/cancel/blur 종료 경로를 처리해 포인터 포커스가 끊겨도 resize 상태가 남지 않는다. 처방/오더 본문은 gray-50 workspace 안에서 그룹 카드 대신 기본 미선택 checkbox를 지원하는 compact table로 표시하고, table header는 gray-50, body는 common white로 구분한다. 진료 기록/진단명/처방오더 header는 gray-400 subtitle을 곁들인 한 줄 title로 압축했고, order action footer는 파란 배경 없이 낮은 레벨의 그림자와 상단 구분선을 사용한다. SOAP 카드 자동저장 상태는 버튼형 badge가 아니라 비상호작용 text로 표시하며, SOAP 첨부 자료 footer는 별도 fill 없이 카드 배경을 이어받는다. 차트이력 aside item은 공통 `EmrListItem` 선택 표현을 사용한다.
- 2026-05-07 기준 진료(차트)는 MVP 안전 UX 보강으로 환자 컨텍스트와 차트 정보에 차트번호/보호자 맥락을 더 명확히 표시하고, SOAP 자동저장 시각을 노출하며, 차트 작성완료와 Order 청구/확정은 현재 환자/차트번호/선택 오더를 확인하는 dialog를 거치도록 했다. 실제 저장, 청구, 오더 확정 상태 변경은 여전히 session-only prototype 범위 밖이다.
- 2026-05-10 기준 진료(차트)의 처방/오더 영역은 shared `Table` primitive와 pill형 `SegmentedControl`을 사용하도록 조정되었다. 오더 테이블은 고정 열 너비, table semantics, common white 본문, 얇은 divider를 유지하며 상단 SOAP/오더 workspace 경계도 hairline으로 분리한다.
- 2026-05-10 기준 진료(차트)는 CHART-PR-004에서 Light Operational Foundation 기준의 visual polish를 적용했다. 차트 root, SOAP, 진단명, 처방/오더 영역은 `--emr-*` alias surface, radius, hairline border를 사용하며, 오더 테이블은 bordered overflow wrapper로 좁은 레이아웃에서도 컬럼이 겹치지 않게 한다. 환자 컨텍스트, chart completion dialog, order confirmation dialog, 데이터/상태 동작은 변경하지 않았다.
- 2026-05-12 기준 진료(차트)의 `차트 이력` 토글은 환자 컨텍스트 바에서 중앙 `진료 차트` 제목 클러스터로 이동했고 hover/focus tooltip은 `과거 이력 보기`로 표시한다. 오른쪽 패널 토글은 right sidebar 아이콘과 `환자 정보` 라벨로 표시해 content aside와 patient information panel의 공간 위계를 분리한다.
- 2026-05-12 기준 임상병리검사, 영상검사, 조제/처치의 content aside 이력 토글도 진료(차트)와 같은 문서 헤더 제목 클러스터로 이동했다. 툴팁과 접근성 라벨은 각각 `임상병리검사 이력`, `영상검사 이력`, 선택 오더 타입에 따른 `조제 이력`/`처치 이력`을 사용한다.
- 2026-05-12 기준 진료(차트)의 진단명 검색 필드는 CHART-PR-005에서 session-only 추천/검색 popover로 보강되었다. 입력 전에는 SOAP/주호소 기반 추천을 보여주고, 키워드 입력 시 한글/영문/동의어 mock catalog를 필터링하며, 사전 선택 또는 자유 입력 진단명을 현재 패널 row에 추가할 수 있다. 확진/중점 표시와 삭제는 현재 세션 UI 상태에만 반영되며 실제 diagnosis catalog API, persistence, 감사 로그, 오더 추천 자동화는 아직 범위 밖이다.
- 2026-05-13 기준 진료(차트)의 SOAP editor는 CHART-PR-006에서 Tiptap 엔진을 유지하되 `주관적`, `객관적`, `평가`, `계획`을 editor 외부 고정 라벨과 개별 rich-text field로 분리했다. Toolbar는 현재 focus된 SOAP field에 대해 undo/redo, bold/italic/underline, bullet/numbered list, link를 적용하며, 링크 입력은 browser prompt 대신 inline popover를 사용한다. 실제 SOAP persistence, autosave semantics, audit logging, template/snippet library는 아직 범위 밖이다.
- 2026-05-13 기준 진료(차트)의 처방/오더 테이블은 CHART-PR-007에서 session-only editable draft table로 보강되었다. `청구서명`과 `수량` cell을 inline으로 수정할 수 있고, 수량 유효성 확인, 행 삭제 확인 dialog, 변경 취소, `Order 업데이트` session commit, draft 기준 금액 재계산을 제공한다. 실제 order/invoice persistence, audit logging, billing workspace 상태 동기화, 서버 검증은 아직 범위 밖이다.
- 2026-05-06 기준 수납 화면은 차트/검사와 같은 App Shell 슬롯 구조로 재정렬되었다. 환자 컨텍스트 header, 중앙 청구서 workspace, 우측 수납 요약/right panel을 제공하며 대기/미납/종료 목록, 보호자 청구 묶음, 합산/해제, 청구 항목 수량 편집, 결제 수단, 청구 확정/미납/수납 완료 session-only 동작은 유지한다. 레퍼런스 기반 와이어프레임은 `docs/reference/billing/billing-workspace-wireframe.html`에 있다.
- 2026-05-06 기준 입원 화면은 placeholder에서 session-only 병동 workspace로 교체되었다. 입원 메뉴는 별도 side panel 없이 중앙 업무판과 우측 상세 패널로 구성하며, 입원 상태/검색 toolbar, 병동 KPI, 강아지/고양이/집중 치료실 grouped table, 주의 tag, 차트/퇴실 action, 우측 입원 상세/퇴실 체크리스트 패널을 제공한다. 공급된 채팅 reference image는 구조/정보 우선순위 참고로만 사용했고, pixel-level alignment 기준 asset은 아직 저장하지 않았다.
- 2026-05-06 기준 병원관리 Order 관리 화면은 placeholder에서 session-only 오더 카탈로그 workspace로 교체되었다. 좌측 module panel은 고객관리와 같은 텍스트 계층 side panel을 재사용하며, `Hospital` 라벨 없이 병원관리 메뉴와 펼쳐진 `Order 관리` 하위 leaf를 보여준다. 선택 leaf(`임상병리 검사`, `처방`, `영상검사` 등)가 본문 page header가 되고, header 탭은 그 leaf 내부의 다음 단계 타입에만 사용한다. 본문은 별도 content aside 없이 dense table로 이어지며, 단일 오더 선택 시 넓은 오른쪽 drawer에서 조회/수정/삭제/저장할 수 있다. Order 세트는 별도 화면/후속 범위로 분리한다.
- 2026-05-06 기준 고객관리 화면은 nav-only action에서 session-only 보호자/동물 master data workspace로 교체되었다. shadcn식 텍스트 side panel, 현재 선택 항목(`동물`/`보호자`) 기준 page header, dense table, 검색, 환자/보호자 등록 진입점, 공통 `patient`/`guardian` drawer type을 제공하며 기존 `reception-patient`/`reception-guardian` drawer URL도 호환한다. 스케줄/발송/서류/CS/진료의뢰는 후속 범위로 side panel 구조만 노출한다. 레퍼런스 기반 와이어프레임은 `docs/reference/customer/customer-management-wireframe.html`에 있다.
- 2026-05-09 HOME-PR-002 기준 홈 기본 화면은 역할별 3-column command dashboard에서 `내 업무` 중심 work-entry surface로 전환되었다. 이 방향은 HOME-PR-003의 kanban work board로 이어졌으며, 기본 홈에서는 병원관리 KPI, 대형 알림 패널, 역할별 위젯 grid를 노출하지 않고 Sales Demo launcher는 `/w/clair-demo/home?view=demo`로 보존한다.
- 2026-05-10 기준 홈 기본 화면은 `홈`/`업무 현황` 순서의 탭으로 조정되었다. 기본 `홈` 탭은 shadcn `Card`, `Table`, `Progress`, `Avatar`와 기존 EMR token/icon을 조합한 운영 대시보드이며, 인사말, 병원 전체 흐름, 운영 현황, 오늘의 할 일, 대기/입원 환자, 병목 분석, 공지/최근 기록을 session-only mock 데이터로 표시한다. `업무 현황` 탭은 기존 kanban-style work board를 유지하며 업무 컬럼 `대기`, `예약`, `진료`, `임상병리검사`, `영상검사`, `조제`, `처치`, `수납`, 우측 `지금 볼 업무` 패널, 상태/담당자/업무 필터를 제공한다. Home은 여전히 claim, 완료, 취소, 수납 완료, 차트/검사 확정 같은 원본 업무 상태 변경 action을 제공하지 않는다.
- 2026-05-12 기준 홈 기본 화면은 역할별 `다음 행동` 가설 시안으로 보강되었다. 프론트 데스크, 수의사, 간호사, 수납 관리자, 병원 관리자 역할 탭별로 우선 처리 업무, 판단 근거, 성공 측정 기준을 더미 데이터로 표시하며, 기존 워크플로우 그래프는 단계별 SLA/지연/미배정 중심의 운영 병목 보드로 교체되었다. 이 변화는 화면 시안 및 session-only mock 범위이며 실제 상태 claim/배정 변경은 아직 구현하지 않는다.
- 2026-05-12 기준 홈의 `업무 현황` 탭은 운영 모드 기반 control surface 시안으로 보강되었다. `전체 흐름`, `내 담당`, `배정 필요`, `지연 해소`, `팀 부하` 모드, 단계별 빠른 이동 strip, 미배정/지연/최다 부하 summary, 선택 업무 상세 패널, 카드별 판단 이유와 목적형 action label을 제공한다. 담당 배정과 메모는 아직 비활성 시안이며 실제 업무 claim/배정 persistence는 구현하지 않는다.
- 2026-05-09 기준 App Shell은 Home처럼 module side panel이 없는 모듈에 진입할 때 `modulePanel=closed` URL/state를 `modulePanel=open`으로 정규화한다. 따라서 접힌 side panel 상태에서 Home으로 이동해도 nav rail의 `사이드 패널 펼치기` 버튼은 노출되지 않으며, 이후 side panel이 있는 모듈로 이동하면 해당 모듈 side panel이 다시 보인다.
- 2026-05-10 기준 PWA install shell이 추가되었다. App Router manifest, install icons, Apple web app metadata, `#E9ECF2` app chrome theme color를 제공하지만 service worker, offline EMR data cache, push notification, background sync는 지원하지 않는다.
- 2026-05-10 기준 Light Operational Foundation 1차가 추가되었다. Linear design reference는 다크모드가 아니라 밝은 EMR 업무 화면을 더 조용하고 정밀한 운영형 SaaS UI로 만드는 참고자료로 번역하며, `src/styles/tokens/emr-foundation.css`의 EMR alias layer와 shared subpanel/list/card/table surface 적용을 제공한다. Generated Clair token output은 직접 수정하지 않는다.
- 2026-05-13 기준 Neutral Command + Semantic Status token direction이 설계 기준으로 추가되었다. shadcn `--primary`는 브랜드 블루가 아니라 command ink로 정의하고, blue는 정보/링크/제한적 브랜드 순간 및 `status-info` 계열로 분리한다. EMR 업무 화면은 surface, line, text, interaction, status alias layer를 통해 고밀도 화면 위계를 관리한다.
- 2026-05-14 기준 Neutral Command + Semantic Status 적용률 보강으로 shared UI/EMR primitives의 status badge, input/select/textarea, segmented control, line tabs, workspace frame, text side panel, patient context bar, content history list, order queue summary, side-panel card/collapsible group, table checkbox, EMR data table warning/selection affordance가 EMR semantic alias를 더 넓게 사용한다. 화면별 직접 색상 정리는 후속 범위로 남긴다.
- 2026-05-14 기준 화면별 직접 색상 정리 첫 단위로 진료(차트) feature screen의 남은 `clair-color-*`, hex, rgba 기반 로컬 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. 접수/예약, 임상병리/영상검사, 환자/보호자 drawer, 홈 kanban 등 다른 feature screen 색상 정리는 후속 범위로 남긴다.
- 2026-05-14 기준 화면별 직접 색상 정리 두 번째 단위로 접수/예약 `src/features/reception/module.tsx`의 수의사 lane palette, 상태/대기 tone, calendar/event card, date picker, toolbar, walk-in dialog, drawer detail 로컬 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. `src/features/reception/profile-drawer.tsx`, 임상병리/영상검사, 홈 kanban 등 다른 feature screen 색상 정리는 후속 범위로 남긴다.
- 2026-05-14 기준 화면별 직접 색상 정리 세 번째 단위로 임상병리 `src/features/lab-imaging/module.tsx`의 lab-specific range에서 판정/상태색, lab queue, 결과지 table, 정상범위 chart, 첨부자료 strip, 검사결과 수신내역 panel의 로컬 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. 같은 파일의 영상검사 전용 range는 다음 feature-screen cleanup 범위로 남긴다.
- 2026-05-10 기준 app shell typography는 `pretendard` 패키지의 self-hosted variable webfont를 기본 sans stack으로 사용한다. Top menu와 app background는 `--clair-color-service-background` fallback을 공유해 standalone/PWA chrome과 일반 브라우저 chrome 간 배경 차이를 줄인다.
- membership/permission enforcement 범위 계획은 완료되었지만 실제 API route, DB client, migration, live Supabase project validation, 서버 권한 enforcement code는 아직 연결하지 않았다.
- MVP 전환 첫 단계로 `/login` 진입과 app shell auth guard를 제품형 mock auth 흐름으로 통합했고, Supabase 연결 전 auth boundary를 추가했다.
- Auth 후속 작업은 `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`를 기준으로 진행한다.

## Sales Demo 진행 현황

Sales Demo Prototype 작업은 spine-first 방식으로 진행되었고, Wave 2까지 `main`에 통합되어 있다.

| Area | Status | Result |
|---|---|---|
| Sales Demo Strategy | 완료 | 데모 목표, 대상, 7분 대표 외래 시나리오, 제외 범위 정리 |
| Sales Demo Spine | 완료 | `kong-vomit` scenario registry, 김하늘/콩이 seed data, home launcher, query-based continuity 추가 |
| Wave 2 Reception/Patient | 완료 | 접수 화면과 환자/보호자 drawer에서 김하늘/콩이/구토 내원 맥락 우선 노출 |
| Wave 2 Chart/SOAP/Order | 완료 | 콩이 SOAP, Assessment, order 흐름을 데모 설명 기준으로 강화 |
| Wave 2 Lab/Imaging | 완료 | 콩이 CBC 결과와 복부 영상 판독/종합소견 흐름 강화 |
| Wave 2 Billing | 완료 | 콩이 invoice, 금액, 수납 완료 상태를 sales demo 관점으로 polish |
| Wave 2 Integration | 완료 | shell query 보존, nav rail demo context propagation, golden path Playwright coverage 추가 |

통합 PR:

- [GitHub PR #6](https://github.com/mcso0/emr-app-shell-prototype/pull/6): `feat: add sales demo spine`
- [GitHub PR #7](https://github.com/mcso0/emr-app-shell-prototype/pull/7): `Integrate Wave 2 demo flow`

## 한눈에 보기

현재 MVP는 **주요 외래 업무 흐름을 눌러볼 수 있는 프론트엔드 프로토타입 1차 완성본**이다. 아직 실제 DB/API 연동 제품은 아니지만, 접수에서 진료, 검사/영상, 조제, 수납까지 이어지는 핵심 화면과 연결형 mock 데이터가 구현되어 있다.

완료된 핵심 범위:

- 접수/예약
- 환자/보호자 드로어와 신규 환자 등록
- 진료(차트)
- 임상병리/계통 검사
- 영상검사
- 조제/처치
- 수납
- 입원 1차 화면
- 고객관리 1차 화면
- 역할별 업무 관제 홈 1차 foundation
- `김하늘 / 콩이 / 구토 내원` sales demo golden path
- `/w/clair-demo/home?view=demo` demo launcher와 역할/모듈 quick start
- 주요 화면의 demo query context preservation
- 연결형 EMR mock domain, status label mapper, Playwright 회귀 테스트
- Service catalog, role seed, permission seed foundation
- Audit log event model foundation
- API boundary selectors foundation
- `/login` mock role/session foundation

현재 `main`에는 PR 1-6 구현, A/B/C/D foundation, Sales Demo Spine, Wave 2 demo flow integration이 병합되어 있다. 대표 PR 1-6 병합 PR은 [GitHub PR #2](https://github.com/mcso0/emr-app-shell-prototype/pull/2)이고, 최신 Sales Demo integration PR은 [GitHub PR #7](https://github.com/mcso0/emr-app-shell-prototype/pull/7)이다.

## 목적과 목표

이 MVP의 목적은 동물병원 외래 진료 운영 흐름을 하나의 encounter 중심 프로토타입으로 검증하는 것이다.

MVP 목표:

- 접수/check-in 시 encounter가 만들어지고 이후 업무가 같은 환자/보호자/encounter 맥락을 공유한다.
- 수의사는 차트 화면에서 과거 이력, SOAP, Assessment, Order를 확인할 수 있다.
- 검사/영상/조제/수납은 독립 화면처럼 보이지만 같은 mock 도메인 데이터를 기반으로 연결된다.
- 비개발자도 주요 화면을 열어 업무 흐름과 정보 배치를 검토할 수 있다.

아직 목표가 아닌 것:

- 실제 backend, DB, auth provider, 파일 저장, 외부 연동 완성
- 서버 권한 enforcement 또는 역할별 데이터 제한
- service catalog/role/permission 설정 화면
- 실제 KakaoTalk, Excel, PACS, 장비 수신, 결제 연동
- 병원관리 전체 화면과 입원 화면
- Figma 기준의 정밀 UI QA 완료

## 현재 결과물

구현된 화면:

| 메뉴 | 상태 | 주요 내용 |
|---|---|---|
| 홈 | v1 dashboard + kanban 구현됨 | 기존 `/home` route에서 `홈`/`업무 현황` 탭 제공. 기본 `홈`은 shadcn 카드형 운영 대시보드로 병원 흐름, 운영 지표, 오늘의 할 일, 대기/입원 환자, 병목/공지/최근 기록을 표시하고, `업무 현황`은 전체 업무 kanban board와 우측 `지금 볼 업무` 패널을 유지한다. Sales Demo launcher는 `?view=demo`로 보존 |
| 접수/예약 | 구현됨 | 캘린더, 대기 중심 접수/예약 목록, 상세 드로어, check-in, 신규 진료 접수 dialog, 환자/보호자 등록 branch-first flow, 현장 접수 form 입력값 반영과 진료대기 표시 |
| 고객관리 | 1차 구현됨 | 보호자/동물 master data 목록, shadcn식 텍스트 side panel, 검색, 신규 환자/보호자 등록 진입, 공통 환자/보호자 drawer |
| 환자/보호자 | 구현됨 | 공통 환자/보호자 read/edit 드로어, 관계 관리, CS 이력, 최신내역, 신규 동물/보호자 등록 품질 UX |
| 진료(차트) | 구현됨 | 진료 대기열, 과거 진료 이력, SOAP, Assessment, Assessment History, Order |
| 임상병리/계통 검사 | 구현됨 | 조제/처치형 검사 대기열, 환자 인포바, 기본 열림 임상병리검사 이력, 값 기반 정상범위 chart와 색상 판정 badge 검사결과지, 검사결과 종합소견, 우측 장비결과내역 아코디언, 첨부자료 |
| 영상검사 | 구현됨 | 조제/처치형 영상 대기열, 환자 인포바, 기본 열림 영상검사 이력, 영상검사 Order 상세정보, 판독의견/진단/권고 입력, 우측 종합소견, 미디어/첨부자료 |
| 조제/처치 | 구현됨 | 조제/처치 업무 화면, 오더 그룹, 우측 패널, drawer, content aside 제공 |
| 수납 | 구현됨 | 대기/미납/종료 목록, 환자 컨텍스트 header, 보호자 청구 묶음, 중앙 청구 항목 편집, 합산/해제, 우측 수납 요약/right panel, 결제 수단, 수납 액션 |
| 입원 | 1차 구현됨 | side panel 없는 중앙 업무판, 상태/검색 toolbar, 병동 KPI, 강아지/고양이/집중 치료실 grouped table, 주의 tag, 우측 입원 상세와 퇴실 체크리스트 |
| 병원관리 | Order 관리 1차 구현됨 | 고객관리형 텍스트 side panel, Order 관리 하위 leaf navigation, leaf 내부 header tabs, session-only 오더 카탈로그, 검색/필터/선택, 오더 상세 drawer 조회/수정/삭제/저장 |
| 로그인/auth provider | adapter 추가 | `/login` 역할 선택, sessionStorage/localStorage mock session, auth client boundary, login pending/error UI, logout utility, shell 역할 표시, permission helper, Supabase provider adapter와 env 기반 fallback |

주요 구현 파일은 기능별 `src/features/*`에 있다. 새 작업자는 개별 파일을 보기 전에 이 문서와 관련 implementation 문서를 먼저 확인한다.

비화면/기반 작업:

| 영역 | 상태 | 주요 내용 |
|---|---|---|
| API boundary selectors | 초안 추가 | mock domain을 나중에 API/DB로 교체하기 위한 read repository interface, selector/helper, mock adapter, contract test, 후속 통합 가이드 추가 |
| Service catalog seed | foundation 추가 | 진료, 처방/조제, 처치, 검사, 영상, 수납 invoice line에서 공통 참조할 mock category/item/price seed |
| Role/permission seed | foundation 추가 | `front_desk`, `vet`, `nurse`, `billing_admin`, `hospital_admin` 추천 역할과 권한 seed |
| Catalog lookup helper | foundation 추가 | service item/category/current price/role permission lookup, order/invoice consistency report |
| Audit log foundation | foundation 추가 | status transition, profile edit, SOAP save, order status change, billing action seed와 deterministic append/build helper |
| Auth provider foundation | adapter 추가 | `/login` 역할 선택, sessionStorage/localStorage mock session, `useAuthClient()` boundary, Supabase SSR/browser/server/proxy helper, logout utility, shell 역할 표시, permission helper |
| PWA install shell | 추가됨 | `src/app/manifest.ts`, root app metadata, install icons를 제공한다. Service worker와 offline EMR data support는 포함하지 않는다. |

이 foundation들은 아직 feature module에 통합되지 않았다. 실제 API route, DB client, migration, auth/audit/service catalog 연동, 실제 권한 enforcement도 포함하지 않는다.

## PR 0-6 완료 현황

| PR | 상태 | 결과 |
|---|---|---|
| PR 0 Documentation | 완료 | PRD, Feature Spec, User Flow, DB 구조, backlog, reference index, open questions, reusable candidates 정리 |
| PR 1 Domain Baseline | 완료 | `src/types/emr-domain.ts`, status labels, 연결형 mock dataset, domain baseline test 추가 |
| PR 2 Reception Closeout | 완료 | 접수/예약 실제 화면과 주요 상호작용 구현 |
| PR 3 Patient/Guardian Drawer | 완료 | 환자/보호자 드로어, 신규 환자 등록, session-only 관계 관리 구현 |
| PR 4 Chart | 완료 | 진료(차트) workspace 구현 |
| PR 5 Lab/Image | 완료 | 검사/영상 workspace 구현 |
| PR 6 Billing | 완료 | 수납 workspace 구현 |

## 현재 검증 상태

2026-05-02 기준 `main` 병합 전후로 아래 검증이 통과했다.

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/billing.spec.ts tests/lab-imaging.spec.ts tests/chart.spec.ts tests/reception.spec.ts tests/domain-baseline.spec.ts tests/app-shell.spec.ts --reporter=line`

2026-05-02 기준 foundation 통합 후 아래 추가 검증이 통과했다.

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/api-boundary.spec.ts tests/service-catalog.spec.ts tests/audit-log.spec.ts tests/auth.spec.ts --reporter=line`
- `npx playwright test tests/billing.spec.ts tests/lab-imaging.spec.ts tests/chart.spec.ts tests/reception.spec.ts tests/domain-baseline.spec.ts tests/app-shell.spec.ts --reporter=line`

2026-05-02 기준 Sales Demo Wave 2 통합 후 최신 `main`에서 아래 검증이 통과했다.

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test --reporter=line` (`69 passed`)

2026-05-03 기준 MVP Auth transition sequence 후 아래 검증이 통과했다.

- `npm run lint`
- `rg "mvp-auth-transition-roadmap" docs/implementation`
- `npx tsc --noEmit`
- `npm run build`
- `npx playwright test tests/auth.spec.ts --reporter=line` (`9 passed`)
- `npx playwright test tests/app-shell.spec.ts tests/reception.spec.ts tests/billing.spec.ts tests/chart.spec.ts tests/lab-imaging.spec.ts tests/sales-demo-flow.spec.ts --reporter=line` (`44 passed`)

화면 작업 시 기본적으로 관련 Playwright test를 추가하거나 갱신한다. 업무 화면 파일을 건드리면 해당 화면의 회귀 테스트를 함께 확인한다.

## 작업 시 주의사항

- 작업 시작 전 이 문서를 먼저 읽는다.
- Next.js application code를 쓰기 전에는 `node_modules/next/dist/docs/`의 관련 문서를 확인한다.
- 입원 화면은 2026-05-06에 1차 session-only workspace가 추가되었다.
- 병원관리 전체 화면은 아직 범위 밖이지만, Order 관리는 2026-05-06에 1차 session-only catalog workspace가 추가되었다. Order 세트는 별도 후속 범위다.
- 로그인은 기본 local demo 환경에서 mock session 기반으로 app shell 진입을 보호하고, Supabase env/auth mode가 준비되면 provider session adapter를 사용할 수 있다. 아직 DB/API session과 서버 권한 enforcement는 연결하지 않았다.
- Supabase provider adapter는 추가되었지만 env 미설정 기본값은 mock/local demo fallback이다. live project 검증과 서버 권한 enforcement는 완료된 것으로 보지 않는다.
- Membership/permission enforcement는 plan-only로 완료되었다. migration/RLS/server resolver 구현은 별도 승인 전까지 하지 않는다.
- UI는 Figma나 screenshot을 1:1 복제하지 않고, 프로젝트 foundation, token, 기존 컴포넌트를 우선 사용한다.
- 공통 컴포넌트 추출은 반복 패턴이 안정된 뒤 진행한다. PR7 화면 정렬 전에는 무리하게 공통화하지 않는다.
- prototype 상태는 session-only이다. 새로고침 후 유지되는 persistence를 전제로 만들지 않는다.
- 작업 완료 시에는 이 문서 또는 해당 작업의 기준 문서를 갱신하고, 완료 보고서는 `docs/completed/<workstream>/` 아래에 보관한다.

## Reference Images 상태

현재 `docs/design/assets/reference-screens/*`에는 메뉴별 폴더와 README가 있고, 접수/예약 drawer PNG 캡처 1개가 존재한다. `docs/design/reference-screen-index.md`에는 파일 존재 여부와 용도가 정리되어 있다.

Figma 화면 예시를 기준으로 UI를 정렬하려면 먼저 PR7에서 실제 캡처 파일을 저장해야 한다.

권장 저장 흐름:

1. Figma에서 기능별 화면을 export 또는 screenshot으로 캡처한다.
2. `docs/design/assets/reference-screens/<area>/...png`에 저장한다.
3. `docs/design/reference-screen-index.md`의 파일 존재 여부와 notes를 갱신한다.
4. 구현 화면과 reference image를 비교해 정보 우선순위, 밀도, 간격, 상태 표현을 조정한다.

## 다음 추천 작업

다음 작업은 **permission resolver 또는 migration/RLS 구현 단위 승인**을 추천한다. 기준 문서는 `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`, `docs/engineering/auth-security/auth-login/supabase-auth-mapping.md`, `docs/engineering/auth-security/auth-login/supabase-integration-readiness.md`, `docs/engineering/auth-security/auth-login/membership-permission-enforcement.md`이다.

목표:

- permission resolver, membership/profile migration, RLS policies, app route/server action enforcement 중 하나를 독립적으로 승인한다.
- live Supabase project 또는 local Supabase verification 방식을 먼저 정한다.
- client UI gating만으로 권한 구현 완료처럼 처리하지 않는다.

구현을 시작하기 전에는 auth foundation 파일, `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`, `docs/engineering/auth-security/auth-login/README.md`, `docs/engineering/auth-security/auth-login/supabase-auth-mapping.md`, `docs/engineering/auth-security/auth-login/supabase-integration-readiness.md`, `docs/engineering/data-model/emr-saas-db-structure-spec.ko.md`, Supabase 공식 문서를 함께 확인한다.

## 관련 문서

- 문서 시작점: `docs/agent-start-here.md`
- 엔지니어링 문서 목차: `docs/engineering/README.md`
- MVP Auth 제품화 전환 기준: `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`
- 로그인 구현 작업 패키지: `docs/engineering/auth-security/auth-login/README.md`
- 데모 세일즈 전략: `docs/archive/sales-demo/demo-sales-strategy.md`
- Sales Demo Wave 2 closeout: `docs/archive/sales-demo/sales-demo-wave2-closeout.md`
- 병렬 작업 계획: `docs/archive/implementation-waves/mvp-parallel-workstreams.md`
- PR 1-6 구현 기록: `docs/archive/implementation-waves/pr1-pr6-realigned-plan.md`
- 갭 분석: `docs/engineering/testing/mvp-gap-analysis.md`
- 백로그: `docs/work/legacy-mvp-implementation-backlog.md`
- 확인 필요 항목: `docs/work/open-questions.md`
- 레퍼런스 화면 인덱스: `docs/design/reference-screen-index.md`
- 공통화 후보: `docs/archive/ui-notes/reusable-component-candidates.md`
- API boundary selector 설계: `docs/engineering/api-boundaries/api-boundary-selectors.md`
- API boundary 후속 통합 가이드: `docs/engineering/api-boundaries/api-boundary-integration-guide.md`
- App shell layout contract: `docs/engineering/architecture/app-shell-layout-contract.md`
