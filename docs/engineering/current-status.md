# MVP Current Status

Updated: 2026-05-20

이 문서는 EMR SaaS 작업의 현재 상태를 설명하는 단일 시작점이다. 새 작업을 시작하는 Codex나 개발자는 먼저 이 문서를 읽고, 필요한 세부 문서로 이동한다.

## Agent Compact Summary

- Current target: Product MVP.
- This is a session-only frontend prototype for veterinary EMR workflows from reception through billing.
- Live DB/API persistence, live Supabase validation, migrations, RLS, and server-side permission enforcement are not complete.
- Client-only permission gating is not complete security.
- Recommended next work: UX/UI refactor Projects 07, 08, and 09 have completed their remaining issue sequence through DEN-147 and are ready for representative Human Review. Product MVP live transition is not fully complete: Project 06 still has DEN-109/DEN-110, and Project 07 has DEN-103/DEN-104/DEN-111-DEN-117 open.
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
- 2026-05-10 기준 PWA install shell이 추가되었다. App Router manifest, install icons, Apple web app metadata, `#18181B` app chrome theme color와 `#E9ECF2` startup background color를 제공하지만 service worker, offline EMR data cache, push notification, background sync는 지원하지 않는다.
- 2026-05-16 기준 App Shell은 Linear-style logical workspace tabs MVP를 제공한다. 각 탭은 session-only route history를 가지며, nav rail 이동은 active tab history에 push되고 상단 뒤로/앞으로는 active tab 기준으로 동작한다. 새 탭은 Home에서 시작하고 마지막 남은 탭은 닫을 수 없다. 비활성 탭 DOM 유지, 탭별 전역 store 격리, Electron/WebContents, live persistence는 아직 지원하지 않는다.
- 2026-05-10 기준 Light Operational Foundation 1차가 추가되었다. Linear design reference는 다크모드가 아니라 밝은 EMR 업무 화면을 더 조용하고 정밀한 운영형 SaaS UI로 만드는 참고자료로 번역하며, `src/styles/tokens/emr-foundation.css`의 EMR alias layer와 shared subpanel/list/card/table surface 적용을 제공한다. Generated Clair token output은 직접 수정하지 않는다.
- 2026-05-13 기준 Neutral Command + Semantic Status token direction이 설계 기준으로 추가되었다. shadcn `--primary`는 브랜드 블루가 아니라 command ink로 정의하고, blue는 정보/링크/제한적 브랜드 순간 및 `status-info` 계열로 분리한다. EMR 업무 화면은 surface, line, text, interaction, status alias layer를 통해 고밀도 화면 위계를 관리한다.
- 2026-05-14 기준 Neutral Command + Semantic Status 적용률 보강으로 shared UI/EMR primitives의 status badge, input/select/textarea, segmented control, line tabs, workspace frame, text side panel, patient context bar, content history list, order queue summary, side-panel card/collapsible group, table checkbox, EMR data table warning/selection affordance가 EMR semantic alias를 더 넓게 사용한다. 화면별 직접 색상 정리는 후속 범위로 남긴다.
- 2026-05-14 기준 화면별 직접 색상 정리 첫 단위로 진료(차트) feature screen의 남은 `clair-color-*`, hex, rgba 기반 로컬 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. 접수/예약, 임상병리/영상검사, 환자/보호자 drawer, 홈 kanban 등 다른 feature screen 색상 정리는 후속 범위로 남긴다.
- 2026-05-14 기준 화면별 직접 색상 정리 두 번째 단위로 접수/예약 `src/features/reception/module.tsx`의 수의사 lane palette, 상태/대기 tone, calendar/event card, date picker, toolbar, walk-in dialog, drawer detail 로컬 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. `src/features/reception/profile-drawer.tsx`, 임상병리/영상검사, 홈 kanban 등 다른 feature screen 색상 정리는 후속 범위로 남긴다.
- 2026-05-14 기준 화면별 직접 색상 정리 세 번째 단위로 임상병리 `src/features/lab-imaging/module.tsx`의 lab-specific range에서 판정/상태색, lab queue, 결과지 table, 정상범위 chart, 첨부자료 strip, 검사결과 수신내역 panel의 로컬 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. 같은 파일의 영상검사 전용 range는 다음 feature-screen cleanup 범위로 남긴다.
- 2026-05-14 기준 화면별 직접 색상 정리 네 번째 단위로 영상검사 `src/features/lab-imaging/module.tsx`의 imaging-specific range에서 상태 그룹, 영상 대기열, 영상검사 이력 aside, Order 상세 table, 판독 toolbar, 안내 note, media strip, 종합소견 panel의 로컬 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. 다음 feature-screen cleanup 범위는 조제/처치다.
- 2026-05-14 기준 화면별 직접 색상 정리 다섯 번째 단위로 조제/처치 `src/features/dispensing/module.tsx`의 이력 aside divider, 진행/완료 action, order group meta/action divider의 남은 직접 Clair 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. 다음 feature-screen cleanup 범위는 수납이다.
- 2026-05-14 기준 화면별 직접 색상 정리 여섯 번째 단위로 수납 `src/features/billing/module.tsx`의 제목 안내문, 보호자 청구 묶음 card 선택 상태, warning notice, 청구 항목 table header, summary line, right panel note surface의 남은 직접 Clair 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. 다음 feature-screen cleanup 범위는 입원이다.
- 2026-05-14 기준 화면별 직접 색상 정리 일곱 번째 단위로 입원 `src/features/inpatient/module.tsx`의 상태/주의 badge, KPI card tone, 선택 row, 병동 section header, page background, title icon의 남은 직접 Clair 색상과 rgba shadow 사용을 shadcn semantic token과 EMR alias token으로 치환했다. 다음 feature-screen cleanup 범위는 고객관리다.
- 2026-05-20 기준 Project 06 / DEN-131로 입원 현황판 table/status 구조를 표준화했다. `src/features/inpatient/module.tsx`의 병동 table column sizing recipe를 local 상수로 모으고, 상태 badge/주의 tag/요약 card tone을 semantic EMR status tone 이름으로 정리했다. 조밀한 ward board table의 `min-w-[1180px]`와 horizontal overflow는 의도적으로 유지했고, 입원 lifecycle persistence, 퇴실 workflow, 서버 검증, Supabase/DB/RLS는 변경하지 않았다.
- 2026-05-14 기준 화면별 직접 색상 정리 여덟 번째 단위로 고객관리 `src/features/customer/module.tsx`의 업무 badge, table header, 선택 row, workspace background, title icon의 남은 직접 Clair 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. 다음 feature-screen cleanup 범위는 병원관리다.
- 2026-05-14 기준 화면별 직접 색상 정리 아홉 번째 단위로 병원관리 `src/features/hospital-admin/module.tsx`의 Order 관리 side-nav group label, workspace surface, table header/selected row, active status text, drawer labels/static surface/footer/delete action의 남은 직접 Clair 색상과 rgba shadow 사용을 shadcn semantic token과 EMR alias token으로 치환했다. 남은 후속 cleanup 범위는 `src/features/reception/profile-drawer.tsx`, home kanban/workspace, auth/login 등 잔여 화면 audit이다.
- 2026-05-20 기준 Project 06 / DEN-129로 병원관리 처방 카탈로그 table/form 구조를 표준화했다. `src/features/hospital-admin/module.tsx`의 table column sizing recipe를 local 상수로 모으고, drawer field row를 shadcn `Field` 계열로 구성했으며, drawer footer overlap 위험을 제거했다. 세션 전용 mock 동작, DB/API persistence, RLS, 권한 정책, 수가/청구 로직은 변경하지 않았다.
- 2026-05-20 기준 UX/UI refactor Project 07로 login/auth entry, personal profile settings, workspace onboarding, workspace membership management의 form/error/pending/table UI를 표준화했다. `FieldError`, form helper copy, disabled pending states, membership table readability를 보강했으며, mock/session-only auth와 workspace behavior는 유지했다.
- 2026-05-20 기준 UX/UI refactor Project 08로 App Shell/common system audit를 완료했다. Global feedback UI baseline, nav rail chrome, workspace tabs, global command palette class contracts를 정리했고, shell store/history behavior는 변경하지 않았다.
- 2026-05-20 기준 UX/UI refactor Project 09로 visual QA gate 문서를 추가했다. `docs/design/qa/core-workspace-ui-review-checklist.md`, `interaction-accessibility-audit.md`, `responsive-dense-layout-audit.md`, `final-cross-screen-ui-consistency-review.md`가 Projects 07/08/09의 Human Review 기준과 follow-up backlog를 정의한다.
- 2026-05-20 기준 UX/UI refactor Projects 07/08/09 aggregate reports는 `docs/completed/design/2026-05-20-project-07-login-profile-workspace-ui-report.html`, `docs/completed/design/2026-05-20-project-08-app-shell-common-ui-report.html`, `docs/completed/design/2026-05-20-project-09-visual-qa-interaction-gate-report.html`에 있다. Product MVP live transition status report는 `docs/completed/product/2026-05-20-clair-emr-product-mvp-live-transition-status-report.html`에 있으며, 전체 완료가 아니라 남은 issue sequence를 명시한다.
- 2026-05-14 기준 잔여 화면 직접 색상 정리 첫 단위로 `src/features/reception/profile-drawer.tsx`의 공통 환자/보호자 drawer와 등록 dialog에서 label, field legend, search icon, popover row, selected state, duplicate/error/warning/info panel, registration mode card, summary icon, footer surface의 남은 직접 Clair 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. 남은 후속 cleanup 범위는 home kanban/workspace, auth/login 등 잔여 화면 audit이다.
- 2026-05-14 기준 잔여 화면 직접 색상 정리 두 번째 단위로 `src/features/home/**`의 home dashboard, demo launcher, compact widgets, alert/flow panels, task list, kanban workspace tab/filter/summary/detail/card 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. 상태 의미는 danger/urgent, warning/delay, info/selected, neutral surface로 유지했고, 남은 후속 cleanup 범위는 auth/login 등 잔여 화면 audit이다.
- 2026-05-14 기준 잔여 화면 직접 색상 정리 세 번째 단위로 `/login` entry, auth gate loading state, login mock controls, provider error/status panels, top menu workspace selector, auth profile trigger/menu의 직접 Clair/local 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. `/login`, safe `next`, mock session, Supabase adapter boundary, top menu role display, logout 동작은 변경하지 않았다. 남은 후속 cleanup 범위는 broader app shell/secondary chrome audit이다.
- 2026-05-14 기준 잔여 화면 직접 색상 정리 네 번째 단위로 `src/shell/app-shell.tsx`, `src/shell/nav-rail.tsx`, `src/shell/global-command-palette.tsx`의 app shell background, nav rail dark chrome/active/avatar/divider, global command trigger/dialog/kbd/result row 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. Shell navigation, module URL query propagation, side panel collapse behavior, global command search/filter/keyboard behavior는 변경하지 않았다. 남은 후속 cleanup 범위는 shared `src/components/emr/**` secondary component audit이다.
- 2026-05-14 기준 잔여 화면 직접 색상 정리 다섯 번째 단위로 shared `src/components/emr/**` secondary components의 content history, EMR data table, order queue side panel/summary, patient context bar, subpanel에 남은 직접 Clair/local 색상 사용을 shadcn semantic token과 EMR alias token으로 치환했다. Shared component behavior, queue grouping, table selection/editing, session-only mock behavior는 변경하지 않았다. 남은 후속 cleanup 범위는 `src/components/ui/**` wrapper audit, PWA metadata/theme color, generated icon/asset-like files, demo-only visual sample files 등 broad residual audit이다.
- 2026-05-14 기준 잔여 색상 정리 최종 audit로 button gallery hover samples, Excel file icon, chart/order queue status seed data, placeholder demo launcher의 남은 직접 Clair/hex/local palette 사용을 shadcn semantic token과 EMR alias token으로 치환했다. Broad scan의 잔여 직접 색상은 generated token files, PWA manifest/theme/icon metadata, Figma/exported SVG assets, public framework placeholder SVGs, test expected color values로 분류해 화면 색상 debt가 아닌 의도적 예외로 남겼다.
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
- 2026-05-17 기준 workspace auth product scope와 role/permission matrix는 `docs/product/domain/workspace-auth-permissions.md`가 기준이다. Canonical MVP roles는 `hospital_admin`, `vet`, `technician`, `front_desk`이며 기존 seed의 `nurse`/`billing_admin`은 후속 구현에서 alias/role 정책으로 정리해야 한다.
- 2026-05-17 기준 workspace membership data/security plan은 `docs/engineering/auth-security/auth-login/workspace-membership-data-security-plan.md`가 기준이다. MVP role assignment는 additive `roles text[]`이고, personal profile data는 권한 source에서 분리하며, 마지막 active `hospital_admin` 보호는 server transaction/private RPC로 구현해야 한다. Migration SQL, RLS SQL, live Supabase validation은 아직 완료된 것으로 보지 않는다.
- 2026-05-17 기준 DEN-28에서 Next.js security patch를 별도 적용해 `next`와 `eslint-config-next`를 `16.2.6`으로 exact pin했다. `npm audit --audit-level=high`, source-scoped lint, typecheck, build, auth/app-shell Playwright regression이 통과했으며, workspace creation/server enforcement work는 이 패치 위에서 진행한다.
- 2026-05-17 기준 DEN-23에서 `/workspace/new` session-only workspace creation foundation을 추가했다. 생성된 workspace와 creator `hospital_admin` membership은 browser storage contract에 저장되고 새 workspace home으로 진입한다. Live Supabase persistence, migration/RLS, real subscription/payment provider, server-side permission enforcement는 아직 완료된 것으로 보지 않는다.
- 2026-05-17 기준 DEN-24에서 병원관리 module의 `병원구성원 관리`에 session-only invitation and membership status flow를 추가했다. `hospital_admin` mock role은 이메일 초대, 다중 역할 지정, pending invite 재발송/취소/수락 시뮬레이션을 할 수 있고, 비관리자 mock role은 초대/멤버십 변경이 차단된다. Real email delivery, public invite links, Supabase persistence, migration/RLS, seat billing, server enforcement는 아직 완료된 것으로 보지 않는다.
- 2026-05-17 기준 DEN-19에서 server-only workspace permission resolver contract를 추가했다. Canonical MVP roles(`hospital_admin`, `vet`, `technician`, `front_desk`)의 additive permission union, chart view/update boundary, typed denial reasons, and last active `hospital_admin` guard are covered by contract tests. Live Supabase DB adapter, migration/RLS, and API/server action enforcement are still future work.
- 2026-05-17 기준 DEN-25에서 `병원구성원 관리`에 session-only role management UI를 추가했다. Hospital admins can edit active member roles, see effective permission summaries, confirm role changes/deactivation, and are blocked from demoting or deactivating the last active `hospital_admin`. Live DB writes, audit persistence, server action/API enforcement, and DB-level last-admin transaction protection remain future work.
- 2026-05-17 기준 DEN-26에서 `/profile` session-only personal profile settings를 추가했다. Users can edit display name, initials, phone, and notification preference placeholder, while role/permission context remains read-only and authorization still comes from workspace membership/permission sources. Supabase identity profile, email change, password/MFA, and live persistence remain future work.
- 2026-05-17 기준 DEN-21에서 first server-side permission enforcement slice를 추가했다. The role update Route Handler `POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles` calls a server-only enforcement module before allowing role mutation intent. It checks active membership, `role_permission:manage`, canonical role input, and last active `hospital_admin` protection. Its original identity seam was demo-only request header based; DEN-32 replaced the production-shaped path with the verified server session seam. DB writes, migration/RLS, and route-backed UI persistence remain future work.
- 2026-05-18 기준 DEN-29에서 `01 Live Auth & Supabase DB/RLS Foundation`의 실행 모드를 local-first Supabase validation으로 고정했다. Project 01은 로컬 Supabase 검증을 기본 전제로 진행하며, remote Supabase staging/live project 연결, SQL 실행, migration push, secret/service-role key 사용은 별도 대표 승인 없이는 하지 않는다. 기준 문서는 `docs/engineering/auth-security/auth-login/live-supabase-readiness-execution-mode.md`이다.
- 2026-05-18 기준 DEN-30에서 auth/DB/RLS 환경 변수와 secret 처리, verification gate 기준을 고정했다. Browser-safe env는 `NEXT_PUBLIC_AUTH_MODE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`로 제한하고, Playwright 기본 회귀는 `NEXT_PUBLIC_AUTH_MODE=mock`을 유지한다. 기준 문서는 `docs/engineering/auth-security/auth-login/auth-db-env-secret-verification-gates.md`이다.
- 2026-05-18 기준 DEN-31에서 server-only Supabase session reader contract를 추가했다. `readServerSession()`은 browser storage 없이 Supabase server client의 `auth.getClaims()`로 verified user claims를 읽고, mock fallback과 unauthenticated/misconfigured/error 상태를 typed result로 반환한다. Route 전환, DB write, migration/RLS는 아직 범위 밖이다.
- 2026-05-18 기준 DEN-32에서 role update Route Handler의 actor identity source를 verified server session seam으로 전환했다. Authenticated Supabase session은 `sessionUserId`를 사용하고, demo header는 `mock_mode` fallback에서만 허용한다. Missing/invalid Supabase session은 demo header가 있어도 401로 거절된다.
- 2026-05-18 기준 DEN-33에서 auth guard/server session regression을 보강했다. Client `AuthGate`는 계속 `useAuthClient()` 경계에 머물고, role update route identity는 `readServerSession()` 경계에 머무는 것을 테스트로 고정했다. Mock fallback과 Supabase missing-session denial matrix도 auth regression에 추가했다.
- 2026-05-18 기준 DEN-34에서 workspace auth schema foundation migration을 작성했다. `supabase/migrations/20260518023715_workspace_auth_schema_foundation.sql`은 `users`, `workspaces`, `user_profiles`, `user_memberships`, `workspace_invitations`, `permission_policies`와 canonical role/status constraint, workspace indexes, RLS enablement를 포함한다. RLS policy SQL과 remote Supabase 적용은 아직 범위 밖이다.
- 2026-05-18 기준 DEN-35에서 local migration validation 절차와 auth seed contract를 추가했다. `supabase/seed.sql`은 `clair-demo` workspace, deterministic auth users, canonical role memberships, role-scope permission policies를 제공한다. Legacy role compatibility는 `nurse -> technician`, `billing_admin -> hospital_admin`으로 문서화했다. 현재 환경은 Docker가 없어 실제 local DB apply는 실행하지 못했다.
- 2026-05-18 기준 DEN-36에서 마지막 active `hospital_admin` 보호를 위한 DB-level foundation을 추가했다. `private.clair_assert_not_last_active_hospital_admin()` trigger가 direct update/delete를 막고, `private.update_workspace_membership_roles(...)` helper skeleton은 후속 trusted server write 경계로 남긴다. 실제 DB apply는 Docker/local Supabase Postgres가 있는 환경에서 재검증해야 한다.
- 2026-05-18 기준 DEN-37에서 workspace auth table RLS baseline을 추가했다. Private helper `private.clair_is_active_workspace_member()`와 `private.clair_is_workspace_admin()`을 사용해 active member read boundary와 hospital admin write boundary를 분리했다. Clinical/business domain table RLS와 실제 local DB execution test는 아직 후속 범위다.
- 2026-05-18 기준 DEN-38에서 DB-backed permission adapter boundary를 추가했다. DB users/memberships/role permission policy rows를 기존 `WorkspacePermissionAdapter` shape로 변환하고, resolver interface는 유지한다. Server-only wrapper와 testable core를 분리했다.
- 2026-05-18 기준 DEN-39에서 server/RLS cross-workspace denial regression을 추가했다. Server route는 다른 workspace role mutation을 `403 workspace_membership_missing`으로 막고, resolver/RLS tests는 row workspace 기준 active membership만 허용하도록 고정했다.
- 2026-05-18 기준 DEN-40에서 live auth DB/RLS foundation 보안 리뷰를 완료했다. Server session, route identity, schema/RLS SQL, last-admin guard, DB adapter, cross-workspace denial coverage는 Project 01 handoff 가능 수준이지만, actual Supabase migration/RLS execution, live role write persistence, remote staging/live validation은 pilot/live blocker로 남는다.
- 2026-05-18 기준 DEN-41에서 Project 01 closeout과 Project 02 handoff를 작성했다. Project 01은 Human Review 준비 상태이며, Project 02는 승욱의 명시 요청 전 시작하지 않는다. 다음 추천 첫 작업은 actual Docker-backed local Supabase DB/RLS execution gate다.
- 2026-05-18 기준 DEN-94에서 Project 02를 Docker local Supabase DB/RLS execution gate로 시작했다. Local Supabase stack이 실행됐고 Project 01 migrations/seed가 실제 DB에 적용됐다. Actual RLS execution에서 private helper grant 누락을 발견해 `20260518113052_workspace_rls_helper_function_grants.sql` migration으로 수정했으며, admin/member/unknown user read boundary와 last active `hospital_admin` DB guard가 실제 SQL 검증을 통과했다.
- 2026-05-18 기준 DEN-42에서 Project 02 workspace live persistence scope/dependency를 확정했다. Project 02 included scope는 workspace creation, membership-backed workspace selector, invitations, membership status reads, role management server handoff/persistence, personal profile persistence다. Remote Supabase, real data, email delivery, subscription/payment, Project 03+ clinical persistence는 별도 승인 전 제외한다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-live-persistence-scope.md`이다.
- 2026-05-18 기준 DEN-43에서 Project 02 workspace/member mutation server route contract를 확정했다. Protected route는 `readServerSession()` actor identity를 사용하고, demo actor header는 mock mode fallback에서만 허용한다. Workspace/member admin mutations는 active membership과 `role_permission:manage`를 요구하며, profile route는 role/permission/membership authority field를 거부한다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-member-server-route-contract.md`이다.
- 2026-05-18 기준 DEN-44에서 `/workspace/new` workspace creation을 server route-backed flow로 전환했다. `POST /api/workspaces`는 mock fallback에서 기존 session-compatible state를 반환하고, Supabase mode에서는 `public.clair_create_workspace_with_creator(...)` local-first transaction RPC로 workspace와 creator active `hospital_admin` membership을 함께 생성한다. Workspace selector/shell context의 persisted read 전환은 DEN-45 범위다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-creation-live-persistence.md`이다.
- 2026-05-18 기준 DEN-45에서 top menu workspace selector와 shell workspace context를 persisted active membership reader에 연결했다. `GET /api/workspaces`는 mock fallback을 유지하고, Supabase mode에서는 `public.clair_list_active_workspaces_for_current_user()` local-first reader RPC로 active workspace memberships만 반환한다. Invitation create persistence는 DEN-46 범위다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-membership-list-live-read.md`이다.
- 2026-05-18 기준 DEN-46에서 병원관리자 직원 초대 생성을 server route-backed persistence boundary로 전환했다. `POST /api/workspaces/[workspaceId]/invitations`는 `role_permission:manage`를 요구하고, Supabase mode에서는 `public.clair_create_workspace_invitation(...)` local-first transaction RPC로 pending invitation을 저장하며 duplicate pending invitation과 existing active member email을 차단한다. 초대 lifecycle persistence는 DEN-47 범위다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-invitation-create-live-persistence.md`이다.
- 2026-05-18 기준 DEN-47에서 invitation resend/cancel/accept lifecycle을 server route-backed persistence boundary로 전환했다. Resend/cancel은 `role_permission:manage`를 요구하고, Supabase accept는 invited authenticated user email match를 요구하며, `public.clair_accept_workspace_invitation(...)`은 accepted invitation과 active membership creation을 같은 transaction에서 처리한다. Persisted member status read UI는 DEN-48 범위다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-invitation-lifecycle-live-persistence.md`이다.
- 2026-05-18 기준 DEN-48에서 병원구성원 관리 화면을 persisted member/invitation status reader에 연결했다. `GET /api/workspaces/[workspaceId]/memberships`는 workspace admin full status read를 제공하고, Supabase mode에서는 `public.clair_list_workspace_member_statuses(...)`로 active/pending/inactive rows를 반환한다. Role/status write persistence는 DEN-49/DEN-50 범위다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-membership-status-live-read.md`이다.
- 2026-05-18 기준 DEN-49에서 role edit UI confirm path를 server enforcement route에 연결했다. 역할 변경은 `POST /api/workspaces/[workspaceId]/memberships/[membershipId]/roles` 성공 후에만 local fallback state에 반영되며, DB write persistence는 DEN-50 범위로 남겼다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-role-edit-server-enforcement-ui.md`이다.
- 2026-05-18 기준 DEN-50에서 role/status mutation DB write wrapper를 추가했다. Supabase mode role route는 `public.clair_update_workspace_membership_roles(...)`, status route는 `public.clair_update_workspace_membership_status(...)`를 사용하며, 기존 DB trigger가 마지막 active `hospital_admin` demotion/deactivation을 막는다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-role-status-db-persistence.md`이다.
- 2026-05-18 기준 DEN-51에서 role management handoff regression coverage를 추가했다. UI, server route, DB guard coverage가 병원관리자 성공, 비관리자 차단, cross-workspace 차단, 마지막 관리자 보호를 계속 포함하는지 테스트로 고정했다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-role-management-regression-coverage.md`이다.
- 2026-05-18 기준 DEN-52에서 personal profile settings를 persisted server route/DB boundary에 연결했다. `PATCH /api/users/me/profile`은 display name, initials, phone, notification preference만 저장하고, role/permission/membership authority fields는 거부한다. 기준 문서는 `docs/engineering/auth-security/auth-login/personal-profile-live-persistence.md`이다.
- 2026-05-18 기준 DEN-95에서 live persistence secret scanning gate를 추가했다. `npm run security:secrets`는 tracked env file, OpenAI/Stripe/Supabase token-like value, JWT-like secret, DB URL password, secret env assignment, unsafe `NEXT_PUBLIC_*` secret naming을 검사하고 CI pull request gate로도 실행된다. 기준 문서는 `docs/engineering/auth-security/auth-login/live-persistence-secret-scanning-gate.md`이다.
- 2026-05-18 기준 DEN-96에서 workspace/member live API error response와 request telemetry contract를 확정했다. 기준 envelope는 `ok`, `requestId`, stable `error`, `denialReason`, optional `fieldErrors`이며 raw token/password/DB connection/stack trace leak은 금지한다. 기준 문서는 `docs/engineering/auth-security/auth-login/api-error-telemetry-contract.md`이다.
- 2026-05-18 기준 DEN-97에서 workspace/member/profile mutation route-level rate limit boundary를 추가했다. `enforceWorkspaceMutationRateLimit(...)`은 actor + workspace/self + operation + client fingerprint 기준으로 60초 60회를 허용하고 초과 시 `429 rate_limited`와 `Retry-After`를 반환한다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-live-api-rate-limiting.md`이다.
- 2026-05-18 기준 DEN-98에서 Project 02 workspace/member/profile persistence 보안 리뷰를 완료했다. Local-first Human Review handoff blocker는 발견하지 않았고, remote/staging live 전 shared rate limit store, route-wide request id/safe logging helper, Supabase advisors/security-definer RPC review, production log redaction을 follow-up으로 남겼다. 기준 문서는 `docs/engineering/auth-security/auth-login/workspace-persistence-security-review.md`이다.
- 2026-05-18 기준 DEN-53에서 Project 02 closeout과 reception persistence handoff를 작성했다. Project 02는 Human Review 준비 상태이며, 다음 프로젝트는 `docs/engineering/auth-security/auth-login/reception-persistence-workspace-context-handoff.md`의 workspace/user context contract를 기준으로 별도 승인 후 시작한다.
- 2026-05-18 기준 DEN-54에서 승욱 승인 후 Project 03 `Reception & Encounter Persistence`를 local-first 문서 계약 작업으로 시작했다. 현장 접수는 appointment 없이 encounter를 생성하고, 예약 접수는 appointment를 `checked_in`으로 바꾸며 한 개의 linked encounter와 queue row를 transaction 경계에서 생성하는 contract를 확정했다. Remote Supabase, 실데이터, production deploy, 구현 코드는 건드리지 않았다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md`이다.
- 2026-05-19 기준 DEN-55에서 접수 live persistence를 위한 최소 domain schema extension plan을 작성했다. 제안 테이블은 `guardians`, `patients`, `patient_guardians`, `consents`, `appointments`, `appointment_change_logs`, `encounters`, `waiting_queue_entries`이며, workspace scope, identifiers, consent/status fields, mock-to-DB mapping, RLS/server enforcement split, privacy open questions를 정리했다. Migration 구현, UI 변경, remote Supabase, 실데이터는 건드리지 않았다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-domain-schema-extension-plan.md`이다.
- 2026-05-19 기준 DEN-56에서 접수 live persistence를 위한 local-first domain schema migration을 구현했다. `supabase/migrations/20260519090000_reception_domain_schema_foundation.sql`은 `guardians`, `patients`, `patient_guardians`, `consents`, `appointments`, `appointment_change_logs`, `encounters`, `waiting_queue_entries`를 만들고 workspace scope, status checks, duplicate guards, lookup indexes, same-workspace composite foreign keys, updated-at triggers, RLS enablement를 포함한다. `supabase/seed.sql`에는 synthetic reception fixture만 추가했다. Static migration contract, typecheck, secret scan은 통과했지만 Docker daemon이 꺼져 있어 `npx supabase db reset --local`의 실제 SQL runtime replay는 실행하지 못했다. Remote Supabase, production deploy, 실데이터, UI/route wiring은 건드리지 않았다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-domain-schema-migration.md`이다.
- 2026-05-19 기준 DEN-57에서 접수 환자/보호자 DB-backed lookup boundary를 추가했다. `GET /api/workspaces/[workspaceId]/reception/patient-guardian-lookup`은 `readServerSession()`과 mock-mode demo actor header seam을 사용하고, active workspace membership과 `patient:view`를 확인한 뒤 mock fallback 또는 Supabase reader gateway를 사용한다. Walk-in 접수 dialog는 별도 검색어 입력과 loading/empty/error/success 상태를 제공한다. Route/UI/type/secret/doc 검증은 통과했지만 Docker daemon이 꺼져 있어 `npx supabase db reset --local`의 실제 SQL runtime replay는 실행하지 못했다. 신규 환자/보호자 live write, encounter creation, customer management full CRUD, final domain RLS policy SQL, remote Supabase, 실데이터는 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-patient-guardian-lookup.md`이다.
- 2026-05-19 기준 DEN-58에서 접수 최소 환자/보호자 등록 write boundary를 추가했다. `POST /api/workspaces/[workspaceId]/reception/patient-guardian-registration`은 `readServerSession()`, mock-mode demo actor header seam, route-level rate limit, active workspace membership, `reception:create` 권한을 거친 뒤 mock fallback 또는 Supabase writer gateway를 사용한다. Reception 등록 dialog는 최종 `등록`에서 서버 route를 호출하고 성공 응답의 persisted-shaped guardian/patient/link/consent rows를 local profile store에 병합한다. Route/UI/type/secret/doc 검증은 통과했지만 Docker daemon이 꺼져 있어 `npx supabase db reset --local`의 실제 SQL runtime replay는 실행하지 못했다. Encounter creation, appointment check-in, customer management full CRUD, provider integration, final domain RLS policy SQL, remote Supabase, 실데이터는 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-patient-guardian-registration-write.md`이다.
- 2026-05-19 기준 DEN-60에서 현장 접수 encounter creation write boundary를 추가했다. `POST /api/workspaces/[workspaceId]/reception/walk-in-encounters`는 `readServerSession()`, mock-mode demo actor header seam, route-level rate limit, active workspace membership, `reception:create` 권한을 거친 뒤 mock fallback 또는 Supabase writer gateway를 사용한다. Walk-in dialog는 최종 `생성`에서 서버 route를 호출하고 성공 응답의 persisted-shaped encounter와 queue row를 local reception store에 병합한다. Route/UI/type/secret 검증은 통과했지만 Docker daemon이 꺼져 있어 `npx supabase db reset --local`의 실제 SQL runtime replay는 실행하지 못했다. Appointment check-in, persisted queue/calendar read replacement, chart/order/billing/provider persistence, final domain RLS policy SQL, remote Supabase, 실데이터는 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-walk-in-encounter-create.md`이다.
- 2026-05-19 기준 DEN-59에서 예약 접수 appointment check-in transition write boundary를 추가했다. `POST /api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in`은 `readServerSession()`, mock-mode demo actor header seam, route-level rate limit, active workspace membership, `reception:create` 권한을 거친 뒤 mock fallback 또는 Supabase writer gateway를 사용한다. Writer는 appointment를 `checked_in`으로 바꾸고 linked encounter, consultation queue row, appointment change log를 같은 transaction boundary에서 만든다. Route/UI/type 검증은 통과했지만 Docker daemon이 꺼져 있어 `npx supabase db reset --local`의 실제 SQL runtime replay는 실행하지 못했다. Appointment CRUD, no-show automation, provider integration, queue/calendar persisted read replacement, chart/order/billing persistence, final domain RLS policy SQL, remote Supabase, 실데이터는 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-appointment-check-in-transition.md`이다.
- 2026-05-19 기준 DEN-61에서 reception mutation permission hardening을 추가했다. 환자/보호자 등록, 현장 접수 encounter 생성, 예약 check-in은 `src/features/reception/reception-mutation-permissions.ts`의 공통 matrix를 통해 active workspace membership과 `reception:create` 기준을 공유한다. Missing actor, inactive user, cross-workspace membership, inactive membership, role-without-permission denial을 세 mutation 모두에 대해 focused test로 고정했고, UI 권한 오류 copy는 `inactive_user`도 같은 권한 차단으로 안내한다. Role policy 변경, audit persistence, chart/order/billing permission enforcement, remote Supabase, 실데이터는 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-mutation-permission-hardening.md`이다.
- 2026-05-19 기준 DEN-62에서 접수 대기열/side panel persisted read boundary를 추가했다. `GET /api/workspaces/[workspaceId]/reception/queue`는 `readServerSession()`, mock-mode demo actor header seam, active workspace membership, `reception:view`를 확인한 뒤 mock fallback 또는 Supabase reader gateway를 사용한다. Supabase reader는 `public.clair_list_reception_queue(...)` local-first RPC로 waiting queue rows와 linked encounters를 읽고, 화면 store는 성공 응답을 persisted overlay로 병합한다. Calendar persisted read 전환, queue status mutation, chart/order/billing persistence, final domain RLS policy SQL, remote Supabase, 실데이터는 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-queue-read.md`이다.
- 2026-05-19 기준 DEN-63에서 접수 day calendar persisted read boundary를 추가했다. `GET /api/workspaces/[workspaceId]/reception/calendar/day?date=YYYY-MM-DD`는 `readServerSession()`, mock-mode demo actor header seam, active workspace membership, `reception:view`를 확인한 뒤 mock fallback 또는 Supabase reader gateway를 사용한다. Supabase reader는 `public.clair_list_reception_day_calendar(...)` local-first RPC로 appointment-only, checked-in appointment encounter, walk-in encounter rows를 읽고, 화면 store는 성공 응답을 schedule overlay로 병합한다. Appointment CRUD, drag/drop scheduling, no-show automation, queue status mutation, chart/order/billing persistence, final domain RLS policy SQL, remote Supabase, 실데이터는 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-day-calendar-read.md`이다.
- 2026-05-19 기준 DEN-64에서 reception live persistence 전환 중 sales demo와 mock fallback 보존 회귀를 추가했다. Empty persisted queue/calendar overlay가 반환되어도 `kong-vomit` demo context, 콩이 appointment card, side panel 환자 컨텍스트가 유지되는지 테스트로 고정했고, mock/local mode와 Supabase mode의 fallback boundary를 문서화했다. 신규 demo scenario, sales copy 변경, billing/chart persistence, remote Supabase, 실데이터는 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-sales-demo-mock-fallback-preservation.md`이다.
- 2026-05-19 기준 DEN-65에서 reception persistence E2E-style regression coverage를 추가했다. Walk-in create와 appointment check-in은 route mock write 성공 후 reload하여 queue/calendar read로 restored state를 검증하고, 다른 workspace queue/calendar read는 demo actor에 대해 `workspace_membership_missing`으로 차단되는지 확인한다. 실제 DB, remote Supabase, 실데이터는 사용하지 않았고 deterministic persisted-shaped route fixtures만 사용했다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-persistence-regression-coverage.md`이다.
- 2026-05-19 기준 DEN-66에서 chart/order/billing persistence handoff와 reception closeout을 작성했다. Encounter persistence contract는 `encounter.id`, `workspaceId`, patient/guardian/appointment links, `primaryVeterinarianId`, status flow, queue row 의미를 다음 프로젝트의 의존성으로 정리했고, DEN-67을 다음 scope-confirmation issue로 추천했다. Chart/order/billing 구현, issue Done 처리, remote Supabase, 실데이터는 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/reception-chart-order-billing-handoff-closeout.md`이다.
- 2026-05-19 기준 DEN-67에서 Project 04 chart/order/billing persistence 범위와 encounter dependency를 확정했다. Project 04 included scope는 SOAP/chart notes, diagnosis rows, order draft/confirmation/lifecycle, billing invoice candidates, invoice line/status/payment-state persistence, full outpatient regression, audit/security handoff다. `encounter.id`와 `workspaceId`를 모든 clinical/billing read/write의 핵심 계약으로 고정했고, active membership plus domain permission, server-side amount recalculation, mock fallback 보존, remote Supabase/실데이터 금지 범위를 정리했다. 구현, migration, route/UI 변경, remote Supabase, 실데이터는 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/clinical-billing-persistence-scope.md`이다.
- 2026-05-19 기준 DEN-68에서 Project 04 chart/order/billing persistence를 위한 local-first schema foundation migration을 구현했다. `soap_notes`, `diagnosis_catalog`, `diagnoses`, `order_groups`, `orders`, `order_events`, `order_revisions`, `invoices`, `invoice_lines`, `payments`와 service catalog foundation tables를 추가했고, synthetic seed는 DEN-56 encounter에 연결된 SOAP, diagnosis, ready-for-billing order, issued unpaid invoice fixture를 제공한다. Static schema/seed tests와 reception schema suite는 통과했지만 remote Supabase, production deploy, 실데이터는 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/clinical-order-billing-schema-migration.md`이다.
- 2026-05-19 기준 DEN-99에서 포트폴리오용 가상 동물병원 데모 데이터셋 1차 기준을 작성했다. `docs/product/demo-data/`는 VIP동물의료센터 청담점 컨셉, 공개 수의학/EMR 참고자료, 대표 외래 시나리오 5개, 기본 오더 카탈로그, 세트오더/템플릿, 진료/차트 적용 오더, 검사 항목, 약/주사 오더 상세, 오더 가격 규칙, 병원관리 프리셋 reference archive, 진단계통/진단명 샘플, 직원/역할/업무 흐름, seed handoff를 정의한다. Human Review 보강으로 병원관리 Order 관리 테이블에 필요한 표준 Order명, 원내 Order명, 청구서명, 사용여부, 판매가격, 판매단위, 대상, 개별/세트 row type을 추가했고, Order 세트 관리/드로어에 필요한 포함 Order 수, 금액 기준, 세트가격, 청구반영, 케어가이드, 원내지시사항, 스케줄러, 변경이력, 포함 Order row 계약도 demo-data에 추가했다. 검사 항목은 청구 오더와 분리해 결과지 row, 입력방식, 단위, 정렬순서, 삭제 잠금 기준으로 별도 문서화했다. 오더 상세 드로어는 전송/청구반영/케어가이드/원내지시사항/검사항목 연결을 공통 계약으로 정리하고, 약/주사/마약·향정 오더의 조제량 자동계산, 종별 처방기준, 단위 표시, 반올림, 보관방법은 별도 문서로 분리했다. 추가로 세트 전용 금액, 포함오더 합산, 구간 가격, child billing reflection, chart-applied snapshot 규칙을 가격 문서로 분리했고, 진료/차트 Order 크게보기 화면은 encounter-owned applied order row, 확정 상태, 청구 footer 합계, 선택 row 기반 액션으로 별도 문서화했다. 새 Figma reference 관찰은 데이터 후보와 UX/운영 규칙을 나눠 archive에 쌓는 기준을 만들었다. 실제 환자/병원 데이터, 실제 의료 데이터 import, 의료 정확성 보장, remote Supabase, production deploy는 제외했다. 기준 문서는 `docs/product/demo-data/README.md`이다.
- 2026-05-19 기준 DEN-99 Human Review 추가 보강으로 진료 오더 테이블 cell guide를 `chart-order-application-v1.md`에 반영했다. T-code 라벨/색상 토큰, NT 작업상태와 상태 버튼 동작, 오더명 20자 말줄임/툴팁, 마약·향정 compact badge, 장비 전송 실패/재전송, 긴급검사 icon은 future seed fields와 UX 규칙으로 분리했다. 이는 synthetic reference archive이며 실제 장비 연동이나 의료 판단 로직은 구현하지 않았다.
- 2026-05-19 기준 DEN-99 데이터 중심 보강으로 오더 원본 ID, workspace override ID, applied snapshot, 세트 하위 row, 검사 항목 delete-lock derivation, 약품 수량 계산 출처, 가격 계산 순서, chart order task/invoice link, 청구/확정 lifecycle 상태를 명확히 했다. 화면 전용 동작은 추후 화면 구현 note로 분리했고, synthetic demo-data / 업무 흐름 재현용 원칙을 유지했다.
- 2026-05-19 기준 DEN-99 추가 정리로 오더 데이터를 master order, order set, lab test item, chart-applied order, billing/calculation의 5개 family로 나눴다. 임상병리/계통/영상 result-style 오더의 최소 검사 항목 연결, frequency alias 정규화, `totalCount = days * frequencyDailyCount`, 판매단위별 수량 계산, 백신/차수 metadata, 보관/투여경로/복약지도 controlled demo values를 문서화했다.
- 2026-05-19 기준 승욱 결정으로 Order 세트는 병원관리의 개별 Order 관리 테이블과 분리된 별도 Order 세트 관리 surface에서 관리한다. 차트에서 오더를 추가할 때는 개별 오더, 세트, 템플릿을 함께 검색/적용할 수 있지만, admin 편집 데이터 계약은 별도 문서와 별도 seed family로 유지한다.
- 2026-05-19 기준 DEN-99 동물 등록/동물 정보 drawer reference를 `patient-guardian-data-v1.md`로 문서화했다. 동물 등록 필드, 품종/종 fallback, 보호자 관계, 주치의 assignment, 예약/진료/입원/수술/사망/삭제 label source, 알림 수신 동의/거부, soft delete/restore audit, 삭제 잠금, 차트/접수/예약/카카오톡 action target state를 synthetic demo-data로 정리했다. 실제 보호자/동물 데이터, 메시지 provider, hard delete, remote Supabase는 제외했다.
- 2026-05-19 기준 DEN-99 보호자 등록/보호자 정보 drawer reference를 `patient-guardian-data-v1.md`에 추가 보강했다. 보호자 이름/연락처/주소/이메일/현금영수증/식별번호 placeholder/차량번호/메모/내원 경로/동의 row, 휴대폰 정규화와 중복 후보 확인, 보호자-동물 관계 row, 주 보호자 변경, 추가 보호자 연결 삭제, 보호자 soft delete 잠금과 변경이력 metadata를 synthetic demo-data로 정리했다. 실제 보호자 데이터, 메시지 provider, hard delete, remote Supabase는 제외했다.
- 2026-05-19 기준 DEN-100에서 Project 04 `orders`를 DEN-99 chart-applied order 계약에 맞추는 local-first bridge migration을 추가했고 Human Review로 넘겼다. `row_type`, source order/set IDs, set child hierarchy, applied snapshot, price snapshot, calculation inputs/outputs, quantity/price rule source, billing reflection, confirmation status, billing candidate status, task status, invoice line link를 저장할 수 있게 했고, `invoice_lines`에는 chart order snapshot/billing candidate/tax and adjustment reason handoff columns를 보강했다. 병원관리 오더 catalog CRUD, 오더세트 CRUD, 검사 항목 CRUD, 실제 의료 데이터, remote Supabase는 제외했다.
- 2026-05-19 기준 DEN-69에서 SOAP subjective/objective/assessment/plan field save와 autosave metadata를 route-backed local-first persistence로 연결했다. `GET/PATCH /api/workspaces/[workspaceId]/chart/soap-notes`는 server session/mock header seam, active workspace membership, `chart:view`/`chart:update`, encounter workspace scope를 확인하고 mock fallback 또는 local-first Supabase RPC gateway를 사용한다. 차트 SOAP editor는 수동 저장과 autosave 후 reload readback을 지원한다. Diagnosis/order/billing persistence, rich audit UI, remote Supabase, 실데이터는 제외했다.
- 2026-05-19 기준 DEN-70에서 차트 작성완료 상태를 route-backed local-first persistence로 연결했다. `GET/PATCH /api/workspaces/[workspaceId]/chart/completion`은 active workspace membership, `chart:view`/`chart:update`, encounter workspace scope를 확인하고, `chart_completed_at`/`chart_completed_by_user_id`를 저장해 clinical work를 `ready_for_billing` handoff로 넘긴다. `encounters.completed_at`은 invoice/payment 완료 의미와 섞지 않았다. Diagnosis/order/billing sync, remote Supabase, 실데이터는 제외했다.
- 2026-05-19 기준 DEN-71에서 진단명 선택/자유 입력 row를 route-backed local-first persistence로 연결했다. `GET/PATCH /api/workspaces/[workspaceId]/chart/diagnoses`는 server session/mock header seam, active workspace membership, `chart:view`/`chart:update`, encounter workspace scope를 확인하고, catalog-linked/free-text diagnosis row, 확진/감별/의심 type, 중점 표시, row order를 저장한다. Real diagnosis catalog API, order recommendation automation, order/billing sync, remote Supabase, 실데이터는 제외했다.
- 2026-05-19 기준 DEN-72에서 editable order draft table row를 route-backed local-first persistence로 연결했다. `GET/PATCH /api/workspaces/[workspaceId]/chart/order-drafts`는 server session/mock header seam, active workspace membership, `chart:view`/`chart:update`, encounter workspace scope를 확인하고, billing display name과 quantity를 저장한다. Line total은 server unit price snapshot으로 재계산하며, invoice line에 연결되지 않은 omitted draft row는 local-first RPC에서 삭제 가능하게 했다. Order finalization, billing candidate issuance, hospital-admin catalog CRUD, remote Supabase, 실데이터는 제외했다.
- 2026-05-19 기준 DEN-73에서 selected order confirmation/submit action을 route-backed local-first persistence로 연결했다. `GET/PATCH /api/workspaces/[workspaceId]/chart/order-actions`는 active membership, `chart:view`/`chart:update`, encounter/order ownership을 확인하고, `Order 확정`은 confirmation status, actor, timestamp를 저장하며 `Order 청구`는 invoice/payment 확정 없이 billing candidate status와 hook point만 저장한다. External order delivery, invoice finalization, full audit rollout, remote Supabase, 실데이터는 제외했다.
- 2026-05-19 기준 DEN-74에서 최소 order lifecycle status를 route-backed local-first persistence로 연결했다. `GET/PATCH /api/workspaces/[workspaceId]/chart/order-lifecycle`는 active membership, `chart:view`/`chart:update`, encounter/order ownership을 확인하고, `requested`, `re_requested`, `in_progress`, `completed`, `cancelled` 전환을 서버 transition rule로 제한한다. Device/PACS integration, lab/imaging/dispensing result persistence, advanced workflow automation, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-75에서 confirmed chart order를 billing invoice candidate line으로 동기화하는 route-backed local-first persistence를 추가했다. `GET/PATCH /api/workspaces/[workspaceId]/billing/invoice-candidates`는 active membership, `billing:view`/`billing:issue`, encounter/order ownership을 확인하고, 서버 order/invoice snapshot에서 수량·단가·금액을 계산하며 같은 invoice/order pair의 중복 candidate 생성을 막는다. Invoice/payment finalization, discount/refund advanced rules, service catalog admin live conversion, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-76에서 chart와 billing 화면이 같은 persisted order/invoice candidate read source를 보도록 연결했다. 차트 오더 영역은 order action/lifecycle overlay를 함께 읽고, 수납 화면은 DEN-75 invoice candidate reader를 overlay로 병합해 invoice line과 총액을 재계산한다. Payment completion mutation, chart editor changes, external module integration, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-77에서 수납 화면 invoice line edit와 billing confirmation을 route-backed local-first persistence로 연결했다. `GET/PATCH /api/workspaces/[workspaceId]/billing/invoice-lines`는 active membership, `billing:view`/`billing:issue`, invoice/line workspace ownership을 확인하고, 서버에서 line total과 invoice subtotal/total을 다시 계산한다. 청구 확정은 `issued` 상태, actor, timestamp만 저장하며 PG/payment provider, receipt, tax settlement, refund workflow, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-78에서 결제 수단 선택, 미납 처리, 수납 완료 상태를 route-backed local-first persistence로 연결했다. `GET/PATCH /api/workspaces/[workspaceId]/billing/payment-status`는 active membership, `billing:view`/`billing:issue`, invoice workspace ownership을 확인하고, `payment_state`, selected payment method, unpaid reason, paid timestamp, synthetic approved payment row를 저장한다. Local-first RPC는 수납 완료 시 encounter를 `completed`로 마감하지만 PG transaction confirmation, refund provider, accounting settlement, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-79에서 billing mutation 권한과 금액 무결성 regression을 추가했다. `tests/billing-security-regression.spec.ts`는 unauthorized billing mutation denial, approved role success path, client amount tampering attempt에 대한 server-side recalculation, `payment_state` 전환을 고정한다. Payment provider contract, finance/accounting export, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-80에서 핵심 외래 persistence path regression을 추가했다. `tests/outpatient-persistence-regression.spec.ts`는 SOAP save/readback, order confirmation/readback, invoice candidate sync/readback, billing completion/payment-status readback checkpoint를 API-level로 검증한다. Full lab/imaging/dispensing live E2E, performance/load testing, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-81에서 Project 04 audit/security readiness handoff와 clinical billing closeout을 작성했다. `docs/engineering/auth-security/auth-login/clinical-billing-audit-security-handoff.md`는 completed clinical/billing scope, mutation/event hook matrix, known risk, Post-MVP gap, Project 05 시작 기준을 정리한다. 대표 검토용 HTML 보고서는 `docs/completed/clinical-billing/2026-05-20-den-81-project-04-clinical-billing-closeout-report.html`이다. Audit persistence 구현, issue Done 처리, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-82에서 MVP pilot readiness 기준과 blocker/follow-up/Post-MVP 분류 정책을 작성했다. `docs/engineering/auth-security/auth-login/mvp-pilot-readiness-criteria.md`는 auth/workspace, DB/RLS, persistence, audit, QA, demo-data, operations gate를 must-have/should-have/Post-MVP로 나누고 대표 review checklist를 제공한다. 구현, production deploy, provider rollout, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-83에서 live MVP audit event matrix를 작성했다. `docs/engineering/auth-security/auth-login/live-mvp-audit-event-matrix.md`는 workspace/member/profile, reception/encounter, chart/diagnosis, order, billing/payment event contract와 common envelope, sensitive data exclusions, DEN-84+ implementation order를 정의한다. Audit persistence 구현, compliance/legal review, analytics dashboard, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-84에서 live MVP audit log schema와 append helper를 local-first로 구현했다. `audit_events` table migration과 `public.clair_append_audit_event(...)` RPC, `src/features/audit/server-audit-log-persistence-core.ts` helper, focused audit persistence test를 추가했다. Direct client table mutation, audit review UI, external log sink, analytics aggregation, business route event emission, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-85에서 workspace/member, reception, chart, order, billing mutation 경계에 live audit event emission을 연결했다. `src/features/audit/server-mutation-audit-core.ts` wrapper와 route/core integration은 DEN-84 append helper를 사용하며, SOAP/chart full body, raw payload, secret/token, stack/SQL error는 audit payload에서 제외한다. Audit review UI, external export, analytics dashboard, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-86에서 hospital-admin 전용 최소 audit review surface를 추가했다. `GET /api/workspaces/[workspaceId]/audit/events`, `public.clair_list_audit_events(...)`, `src/features/audit/server-audit-event-review-core.ts`, `병원관리 > 감사 로그` 화면은 workspace-scoped audit event의 시간/action/actor/target/safe summary를 보여주고 non-admin 접근을 차단한다. Analytics chart, export/download, retention policy UI, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-87에서 live auth, DB/RLS, workspace boundary threat model을 작성했다. `docs/engineering/auth-security/auth-login/live-auth-db-rls-workspace-threat-model.md`는 cross-workspace leakage, role escalation, demo identity seam misuse, audit payload leakage, audit bypass risk를 기존 mitigation과 residual blocker/follow-up으로 분류한다. 코드 수정, penetration test, external certification, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-88에서 clinical/billing/audit mutation boundary 보안 리뷰를 작성했다. `docs/engineering/auth-security/auth-login/clinical-billing-audit-mutation-security-review.md`는 chart/order/billing permission, amount tampering, unauthorized mutation, audit omission risk를 severity별로 분류한다. 새 High severity local-first route bug는 발견하지 못했고, 남은 핵심 follow-up은 diagnosis/order draft/order lifecycle/invoice candidate/invoice line audit emission completeness와 remote/live 전 clinical/billing domain RLS local replay evidence다. 코드 수정, external provider review, legal compliance certification, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-89에서 full live outpatient workflow reload checkpoint QA를 수행했다. `docs/engineering/auth-security/auth-login/full-live-outpatient-workflow-qa.md`는 login/workspace entry, reception reload, chart reload, order/billing persistence, billing screen, sales demo golden path를 검증했고 workflow health score를 92/100으로 분류했다. Blocker는 발견하지 못했고, follow-up은 Tiptap duplicate extension warning, broad Playwright run listener warning, DEN-88 audit completeness, remote/live Supabase validation gate다. 코드 수정, performance benchmark, external provider QA, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 DEN-90에서 role/workspace boundary and denial UX QA를 수행했다. `docs/engineering/auth-security/auth-login/role-workspace-boundary-denial-ux-qa.md`는 `hospital_admin`, `vet`, `technician`, `front_desk`, multi-role, cross-workspace denial, chart/reception/billing mutation denial, audit admin-only access, mock header boundary를 점검했다. Unauthorized mutation이나 cross-workspace access blocker는 발견하지 못했고, follow-up은 mock UI role label과 canonical MVP role alignment, user-facing denial copy, DEN-88 audit completeness, remote/live RLS validation gate다. 코드 수정, role policy redesign, production monitoring, remote Supabase, 실데이터는 제외했다.
- 2026-05-20 기준 Project 06 / DEN-101에서 고객관리 persistence 범위와 민감정보/고유식별정보 저장 경계를 확정했다. Project 06은 Project 03의 최소 접수 등록 스키마를 확장해 보호자 상세, 동물 상세, 동의/내원경로, 보호자-동물 관계, 주 보호자 변경, soft delete/restore, 고객관리 read surface를 local-first synthetic data로 다룬다. 실제 보호자/동물/병원 데이터, 실제 주민등록번호/현금영수증 식별값 원문, 메시지 provider, remote Supabase, production deploy, hard delete는 제외한다. 기준 문서는 `docs/engineering/auth-security/auth-login/customer-management-persistence-scope.md`이고 다음 이슈는 DEN-102 schema delta plan이다.
- 2026-05-20 기준 Project 06 / DEN-102에서 고객관리 schema delta plan을 작성했다. Project 03의 `guardians`, `patients`, `patient_guardians`, `consents`를 병렬 customer table 없이 확장하고, `guardian_referral_sources`, `guardian_duplicate_overrides`, `patient_staff_assignments`, `customer_profile_change_logs`를 신규 후보로 확정했다. 삭제 잠금은 appointment/encounter/queue/billing/active primary relationship에서 derive하고, hard delete와 실제 고유식별정보/provider payload/remote Supabase는 제외한다. 기준 문서는 `docs/engineering/auth-security/auth-login/customer-management-schema-delta-plan.md`이고 다음 이슈는 DEN-105 migration implementation이다.
- 2026-05-20 기준 Project 06 / DEN-105에서 고객관리 local-first schema migration을 구현했다. `supabase/migrations/20260520140000_customer_management_schema_delta.sql`은 기존 Project 03 `guardians`, `patients`, `patient_guardians`, `consents`를 확장하고 `guardian_referral_sources`, `guardian_duplicate_overrides`, `patient_staff_assignments`, `customer_profile_change_logs`, `customer_profile_deletion_locks` view를 추가한다. `supabase/seed.sql`에는 synthetic customer-management fixture만 추가했다. Focused static migration/reception regression, docs check, secret scan은 통과했다. SQL runtime replay, remote Supabase, production deploy, provider integration, 실데이터, hard delete는 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/customer-management-schema-migration.md`이고 다음 이슈는 DEN-106 guardian profile read/write boundary다.
- 2026-05-20 기준 Project 06 / DEN-106에서 보호자 프로필 read/write persistence boundary를 구현했다. `src/features/customer/server-guardian-profile-core.ts`와 `/api/workspaces/[workspaceId]/customer/guardians/[guardianId]/profile` route는 `patient:view`/`patient:update`, active workspace membership, workspace-scoped guardian access, raw identifier-shaped value rejection을 적용한다. 공통 보호자 drawer 저장 버튼은 이 route를 거쳐 store를 갱신한다. Focused server test, customer UI smoke, typecheck, docs check, secret scan은 통과했다. 보호자 삭제/복구, 관계 변경, 실제 고유식별정보, provider 연동, remote Supabase migration은 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/customer-guardian-profile-persistence.md`이고 다음 이슈는 DEN-107 patient profile read/write boundary다.
- 2026-05-20 기준 Project 06 / DEN-107에서 동물 프로필 read/write persistence boundary를 구현했다. `src/features/customer/server-patient-profile-core.ts`와 `/api/workspaces/[workspaceId]/customer/patients/[patientId]/profile` route는 `patient:view`/`patient:update`, active workspace membership, workspace-scoped patient access, patient profile validation을 적용한다. 공통 환자 drawer 저장 버튼은 이 route를 거쳐 store를 갱신한다. Focused server test, guardian profile regression, customer UI smoke, typecheck는 통과했다. 보호자 관계 변경, 접수/예약/차트 action, 실제 동물 데이터 import, remote Supabase migration은 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/customer-patient-profile-persistence.md`이고 다음 이슈는 DEN-108 relationship management다.
- 2026-05-20 기준 Project 06 / DEN-108에서 보호자-동물 관계 관리 persistence boundary를 구현했다. `src/features/customer/server-patient-guardian-relationship-core.ts`는 existing guardian link, primary guardian transition, relationship-only unlink를 `patient:update` 권한과 active workspace membership 아래 처리한다. Cross-workspace guardian link, duplicate active relationship, primary unlink는 차단한다. Focused relationship server test, typecheck, docs check, secret scan은 통과했다. Guardian/patient master hard delete, duplicate merge, provider 연동, remote Supabase migration은 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/customer-relationship-management-persistence.md`이고 다음 이슈는 DEN-109 soft delete/restore locks다.
- 2026-05-20 기준 Project 06 / DEN-109에서 고객관리 soft delete/restore와 삭제 잠금 persistence boundary를 구현했다. `src/features/customer/server-customer-archive-core.ts`와 `/api/workspaces/[workspaceId]/customer/.../archive` routes는 `patient:view`/`patient:update`, active workspace membership, workspace-scoped access, active/deleted listing, audit hook payload를 제공한다. 동물 삭제는 active appointment/encounter/open invoice에서 잠그고, 보호자 삭제는 primary relationship, active linked patient, open invoice, deposit-like balance/hold에서 잠근다. Focused server test와 typecheck는 통과했다. Hard delete, retention policy finalization, billing provider/refund/deposit integration, remote Supabase migration은 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/customer-soft-delete-restore-persistence.md`이고 다음 이슈는 DEN-110 customer management regression and handoff다.
- 2026-05-20 기준 Project 06 / DEN-110에서 고객관리 persistence focused regression과 handoff를 작성했다. `docs/engineering/auth-security/auth-login/customer-management-persistence-regression-handoff.md`와 `docs/completed/customer/2026-05-20-project-06-customer-management-persistence-report.html`이 Project 06 전체 결과, 검증 묶음, 남은 live-readiness gap을 정리한다. Project 06의 DEN-101, DEN-102, DEN-105, DEN-106, DEN-107, DEN-108, DEN-109, DEN-110은 대표 Human Review 준비 상태다. 다음 이니셔티브 작업은 Project 07 hospital admin order catalog persistence다.
- 2026-05-20 기준 Project 07 / DEN-103-DEN-117에서 병원관리 Order catalog persistence foundation을 완료했다. `supabase/migrations/20260520152000_hospital_admin_order_catalog_persistence.sql`, `src/features/hospital-admin/server-order-catalog-core.ts`, `/api/workspaces/[workspaceId]/hospital-admin/order-catalog`, order set expansion route, lab test item delete-lock route가 개별 오더, 오더 세트, 검사 항목, 약품/백신 metadata, 가격 snapshot을 local-first로 다룬다. Admin read는 paused/inactive를 포함하고 chart search는 active order/set만 반환한다. Focused schema/server regression과 typecheck는 통과했다. UI wiring, remote Supabase runtime replay, final RLS validation, 실병원 데이터 import, 외부 provider 연동, 의료 자문/처방 안전 엔진은 제외했다. 기준 문서는 `docs/engineering/auth-security/auth-login/hospital-admin-order-catalog-regression-handoff.md`와 `docs/completed/hospital-admin/2026-05-20-project-07-order-catalog-persistence-report.html`이다.
- 2026-05-17 기준 DEN-27 CSO security review에서 workspace auth/permission boundary를 검토했다. Profile data is not used as an authorization source, additive multi-role resolution and chart mutation restrictions are covered by tests, and the server enforcement slice is server-only. The highest live-readiness risks are the demo identity header, client-storage role mutation UI, and future DB-level last-admin transaction/RPC protection.
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

다음 작업은 **대표 Human Review**이다. Project 06과 Project 07은 구현과 HTML 보고서가 준비되었고, Done 이동은 승욱 승인 뒤 진행한다.

목표:

- Project 06/07은 local-first 상태이며 remote Supabase, production deploy, 실데이터, 외부 provider 연동은 완료로 주장하지 않는다.
- Project 06 implementation은 synthetic demo-data foundation을 참고해 실제 고유식별정보와 실데이터를 저장하지 않는다.
- DEN-61에서 고정한 active membership과 `reception:create` mutation 기준은 유지한다.
- Mock fallback과 Sales Demo 흐름은 유지한다.
- Project 04는 local-first로 진행한다.
- remote Supabase, 실데이터, production deploy는 별도 승인 전 시작하지 않는다.

구현을 시작하기 전에는 auth foundation 파일, `docs/engineering/auth-security/mvp-auth-transition-roadmap.md`, `docs/engineering/auth-security/auth-login/README.md`, `docs/engineering/auth-security/auth-login/reception-domain-schema-extension-plan.md`, `docs/engineering/auth-security/auth-login/reception-encounter-persistence-contract.md`, `docs/engineering/auth-security/auth-login/workspace-member-server-route-contract.md`, `docs/engineering/auth-security/auth-login/api-error-telemetry-contract.md`, `docs/engineering/auth-security/auth-login/docker-local-supabase-rls-execution-gate.md`, `docs/engineering/auth-security/auth-login/workspace-membership-data-security-plan.md`, Supabase 공식 문서를 함께 확인한다.

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
