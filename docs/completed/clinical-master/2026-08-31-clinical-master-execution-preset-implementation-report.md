---
title: "CLAiR 전 카테고리 마스터 오더 실행 프리셋 구현 보고서"
date: "2026-08-31"
work_item: "CLINICAL-MASTER-PR-022"
status: "local_candidate_ready_for_human_review"
remote_writes: 0
clinical_use_allowed: false
---

# CLAiR 전 카테고리 마스터 오더 실행 프리셋 구현 보고서

## 1. 최종 판단

요청한 로컬 구현 후보는 완성됐다.

- 기존 510개 마스터 오더와 새로 정의한 12개 계통별 신체검사 오더를 합쳐 **522개 오더 모두에 정확히 하나의 현재 실행 프리셋**이 존재한다.
- 최종 게시 입력은 **689개 레코드 / 522개 오더**이며, 고정 산출물 SHA-256은 `1eeb5035d70d5f28035df49d1d32c3689ffe79a4bb28062e5606256802572e0c`이다.
- 마스터 프리셋은 워크스페이스 카탈로그로 복사되고, 병원은 복사본을 수정하거나 `사용 중지`할 수 있다.
- 수정하지 않은 복사본은 새 마스터 개정에 자동 동기화되고, 수정한 복사본은 덮어쓰지 않고 검토 대상으로 남는다.
- 차트에 오더를 추가하면 프리셋 세부값이 초안에 자동 입력된다. 안전하게 추론할 수 없는 필드는 수동 입력 또는 런타임 해석 대상으로 남는다.
- 확정 시점의 유효 세부값은 오더 snapshot으로 고정되며, 이후 마스터·워크스페이스 변경이 과거 확정 기록을 바꾸지 않는다.
- 전용 `system_exam` 타입은 차트에서 완료되며 처치·검사·조제 fulfillment queue로 전달되지 않는다.

단, 이 결과는 **로컬 구현 및 격리 DB 검증 완료** 상태다. Airtable, 원격 Supabase, GitHub, Vercel, 실제 병원 데이터에는 아무것도 쓰지 않았다. 모든 프리셋은 `synthetic_unreviewed`, `clinicalUseAllowed=false`로 유지되어 임상 승인이나 실제 진료 활성화를 의미하지 않는다.

## 2. 요청을 구현 계약으로 정리한 내용

요청의 핵심은 “마스터에 오더 이름만 두지 말고 세부 기본값까지 보유하고, 워크스페이스로 오더를 가져올 때 그 값도 함께 복사해 바로 사용할 수 있게 하라”였다. 이를 다음 계약으로 구현했다.

1. 마스터는 모든 적용 대상 오더에 버전이 있는 실행 프리셋을 보유한다.
2. 워크스페이스 채택 시 오더와 프리셋 세부값을 함께 복사한다.
3. 워크스페이스 관리자는 복사본을 수정하거나 사용 중지할 수 있다.
4. 사용자가 수정한 값은 다음 마스터 채택에서 자동으로 덮어쓰지 않는다.
5. 차트 초안은 유효 프리셋 값을 자동 입력한다.
6. 환자·담당자·장소처럼 마스터가 알 수 없는 값은 런타임 또는 워크스페이스에서 해석한다.
7. 필수값이 비어 있으면 확정을 막고, 확정된 snapshot은 불변으로 보존한다.

## 3. 사전 조사 결과

### 3.1 코드·데이터 기준선

동결한 입력에서 기존 published normal 마스터 오더는 510개였다.

- 조제 프리셋 완성: 108개
- 일부 검사 프로필만 존재: 86개
- 타입화된 실행 프리셋 없음: 316개
- 전용 계통별 신체검사 카테고리: 없음

기존 조제 프리셋은 버리지 않고 동일한 기본값을 재사용했다. 부족했던 상담·예방, 영상, 임상병리, 처치·수술·치과, 입원, 증명·응급·기타, 조제 보조 품목을 일반 실행 프리셋 계약으로 확장했다. 계통별 신체검사는 12개 독립 identity와 전용 `system_exam` 실행 타입으로 추가했다.

### 3.2 외부 임상정보 조사와 사용 범위

외부 자료는 실제 처방이나 환자별 임상 결정을 만들기 위한 것이 아니라, 현실적인 **구조·필드·단위·운영 용어**를 구성하는 참고로만 사용했다.

| 참고 자료 | 적용한 범위 | 적용하지 않은 범위 |
| --- | --- | --- |
| [UCUM](https://ucum.org/) | 기계 단위 코드와 화면 표시 단위를 분리하는 원칙 | 환자별 용량·결과값 자동 결정 |
| [Cornell eClinpath: sample collection](https://eclinpath.com/test-basics/sample-collection-2/) / [chemistry sample](https://eclinpath.com/chemistry/sample-collection-chem/) | 검체 종류, 채취·취급 구조, 검사 프로필 필드 | 병원 장비별 참고범위·판정값 추정 |
| [DICOM WG-25](https://www.dicomstandard.org/activity/wgs/wg-25) | 수의 영상검사의 종·부위·자세 등 구조화 필요성 | PACS·장비 식별자 임의 생성 |
| [AAHA Anesthesia](https://www.aaha.org/resources/2020-aaha-anesthesia-and-monitoring-guidelines-for-dogs-and-cats/) / [Dental](https://www.aaha.org/resources/2019-aaha-dental-care-guidelines-for-dogs-and-cats/) / [Fluid Therapy](https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/) / [Feline Life Stage](https://www.aaha.org/resources/2021-aaha-aafp-feline-life-stage-guidelines/feline-life-stage-home/) | 마취·치과·수액·예방진료에서 필요한 기록 항목과 검토 지점 | 특정 환자에게 적용할 약물·용량·속도 자동 결정 |
| [RECOVER 2024](https://recoverinitiative.org/2024-guidelines/) | 응급·소생 관련 오더의 구조화 및 즉시성 표현 | 실제 CPR 프로토콜을 시스템이 임의 승인 |
| [UK VMD Product Information Database](https://www.vmd.defra.gov.uk/ProductInformationDatabase/) | 약품 정보가 제품·규제 출처와 함께 관리되어야 한다는 원칙 | 국내 허가·병원 재고를 대신하는 제품 사실 생성 |

따라서 조사 기반 값도 모두 합성·미검토 상태다. 실제 병원 사용 전에 수의사 또는 지정 임상 검토자가 별도 승인해야 한다.

## 4. 최종 데이터셋

### 4.1 기존 510개 오더의 작성 카테고리

| 작성 카테고리 | 오더 수 |
| --- | ---: |
| 상담 | 31 |
| 예방진료 | 24 |
| 임상병리검사 | 86 |
| 영상검사 | 30 |
| 조제 | 159 |
| 조제 보조 품목 | 2 |
| 처치 | 45 |
| 수술·마취 | 42 |
| 치과 | 24 |
| 입원 | 30 |
| 증명서 | 13 |
| 응급 | 24 |
| **합계** | **510** |

### 4.2 최종 실행 타입

| 실행 타입 | 현재 프리셋 수 | 동작 |
| --- | ---: | --- |
| `consultation` | 55 | 차트 내 상담·예방 기록, 담당 수의사 런타임 해석 |
| `clinical_lab` | 86 | 검체·검사/패널·채취 지침 기본값 |
| `imaging` | 30 | 부위·자세·검사 지침 기본값 |
| `dispensing` | 159 | 기존 조제 세부 기본값과 호환 transport |
| `treatment` | 111 | 처치·수술·마취·치과 실행 정보 |
| `hospitalization` | 30 | 입원 관련 실행 정보, 병동·케이지는 워크스페이스 해석 |
| `system_exam` | 12 | 계통별 신체검사, 차트 내 완료·queue 미전송 |
| `other` | 39 | 증명·응급·비임상 조제 보조 등 기타 업무 |
| `external_lab` | 0 | 스키마·검증 계약은 지원하지만 동결 입력에 독립 active identity가 없어 임의 생성하지 않음 |
| **합계** | **522** | 510 기존 + 12 계통검사 |

최종 689개 게시 레코드는 오더 522개 외에 clinical action 25, chart group 8, lab panel 18, lab test 72, order category 15, result input type 3, task route 7, specimen type 8, unit 9, species 2를 포함한다.

### 4.3 결정론적 산출물

| 산출물 | 크기 | SHA-256 |
| --- | ---: | --- |
| 기존 오더 실행 프리셋 | 510 | `02c4ad67463545fa502e263fd7681b203b3e866702d23cbf364edbfe6276f6c0` |
| 510개 source entry | 510 | `a3ea174d81325d993aa9cc233d714c4a3eee990392dd7e931f0433bb86c24a25` |
| 510개 입력 lineage | 510 | `e8c5b28660efd3c6c0091a105fcd5e6234010a851f07cc4e16f1da91582b3198` |
| live 전체 lineage | 510 | `b4d56f15dfcf53e867db2e022f6e7c742c2354b507eb4a88feb981b351b039bb` |
| 계통검사 작성 산출물 | 12 | `594241e8d753a9117f18ffc392930f51e01976f6ed19f9f36f341d8f456521c6` |
| 최종 게시 입력 | 689 records / 522 orders | `1eeb5035d70d5f28035df49d1d32c3689ffe79a4bb28062e5606256802572e0c` |

live lineage fixture는 읽기 전용 조회로 확보한 정확한 510개 `{masterKey, currentRevision, currentReleaseId}` 집합이다. 생성기와 release compiler는 이 64자리 SHA를 재계산하고, 한 행의 revision·release identity·artifact hash라도 달라지면 게시 입력 생성을 거부한다.

## 5. 구현 내용

### 5.1 공통 마스터 프리셋

`master.order_execution_presets`와 current pointer를 추가했다. 각 버전은 다음을 보유한다.

- preset identity와 revision
- 대상 master order revision
- clinical order type과 detail schema version
- `defaultDetailInputs`
- 필드별 정책
- 출처·근거·생성 정보
- 현재 publisher가 허용하는 `synthetic_unreviewed` 상태
- `clinicalUseAllowed`
- canonical content hash, source artifact hash, source release lineage

버전 행은 update/delete를 거부하고, unknown field·잘못된 enum·schema 불일치·hash 불일치·동일하거나 낮은 revision을 fail closed 처리한다. 임상 검토 ledger가 별도로 구현되기 전에는 payload가 스스로 `clinically_reviewed`로 승격할 수 없고 `clinicalUseAllowed`도 true가 될 수 없다.

### 5.2 필드 소유권과 값 해석 순서

유효값은 다음 순서로 결정한다.

1. encounter/runtime context
2. workspace override 또는 병원 운영 기본값
3. CLAiR master execution preset
4. chart schema default
5. 안전하게 유도할 수 없는 값의 사용자 직접 입력

필드 정책은 `preset_fixed`, `derived_from_profile`, `schema_default`, `workspace_resolved`, `runtime_resolved`, `required_manual`, `not_applicable`로 고정했다. 예를 들어 영상 부위·자세는 마스터 기본값이 될 수 있지만 실제 장비, 외부기관, 병동·케이지, 가격은 워크스페이스 소유다. 담당 수의사는 actor가 아니라 해당 encounter의 주치의에서 해석한다.

### 5.3 게시·채택 transport

- 기존 publisher payload의 `executionPreset` envelope를 검증하고 immutable master version으로 투영한다.
- 689개 레코드를 payload 범위로 게시한다.
- 정확히 허용된 워크스페이스에만 522개 카탈로그 행과 기본 세부값을 복사한다.
- 같은 입력 재게시·재채택은 idempotent하다.
- 기존 lab dependency가 이번 payload에서 생략되어도 최신 immutable revision pin을 잃지 않는다.
- 임상병리검사 projection의 conflict counter는 실제 insert가 발생했을 때만 증가한다.
- 기존 조제의 nested default와 새 generic default를 양방향 호환한다.

### 5.4 워크스페이스 수정·사용 중지·검토

- 병원관리 오더 drawer에서 타입 스키마에 맞는 일반 세부 기본값을 확인·수정할 수 있다.
- partial edit는 가격·조제·백신 metadata를 SQL null로 지우지 않는다.
- 수정은 CAS revision을 요구하고 stale revision을 SQLSTATE `40001`로 거부한다.
- `사용 중지`는 신규 차트 검색에서 제외하며 과거 snapshot은 유지한다.
- 일반 오더의 pause 감사 이벤트는 `order_catalog.paused` / `pause`로 남는다.
- 사용자가 수정한 행은 `customized`와 변경 필드를 기록한다. 이후 채택은 해당 값을 보존하고 `workspace_master_updates` 검토 행을 만든다.

### 5.5 차트 자동입력과 확정 snapshot

- 개별 오더와 Order Set child 모두 workspace catalog의 유효 기본값을 초안에 복사한다.
- 상담의 `responsibleClinicianId`는 현재 encounter 주치의로 서버와 UI 양쪽에서 해석한다. 주치의가 없으면 임의 actor를 넣지 않고 미완료 상태로 남긴다.
- required field가 빠지거나 unknown field가 포함되면 확정을 막는다.
- 확정 오더, fulfillment source snapshot, billing candidate는 당시 값을 보존한다.
- `system_exam`은 destinationless chart-only 타입이며 fulfillment projection이 들어와도 서버가 버린다.

### 5.6 보안 경계

- master preset 테이블은 RLS enabled이며 client role에 직접 공개하지 않는다.
- private publisher/adopter/project/sync 함수의 `anon`, `authenticated`, `service_role` execute를 명시적으로 회수했다.
- 차트 저장의 내부 base RPC도 직접 실행 권한을 회수하고 공개 wrapper만 `authenticated`가 호출한다.
- catalog writer와 master-update resolver는 TypeScript 선검사나 역할 label에 의존하지 않고 DB에서 canonical `service_catalog:manage` 권한을 다시 확인한다.
- 차트 runtime resolver 조회는 `chart:update` permission preflight가 통과한 뒤에만 실행한다.
- security-definer 함수는 빈 `search_path`, workspace/actor permission, CAS, audit 경계를 유지한다. 324개 compatibility backfill도 정확한 candidate 집합만 변경·감사하고 재실행 시 감사 행을 늘리지 않는다.
- current pointer는 동일 order의 preset identity를 임의로 새 ID/revision 1로 교체하지 못하며, source release와 activated release가 일치해야 한다.
- 임의 임상 타입 mismatch는 거부하고, 확인된 legacy identity 두 종류만 좁게 호환했다.

## 6. 격리 로컬 DB 리허설 결과

리허설은 로컬 Docker Supabase의 전용 DB에서만 수행했다. 원본 로컬 `postgres` DB와 원격 DB는 변경하지 않았다. clone은 `pg_dump --no-owner --no-privileges`로 만들었기 때문에 실제 권한 검증 전 PR-022의 명시적 revoke로 ACL baseline을 정규화했다.

### 6.1 게시

| 항목 | 결과 |
| --- | --- |
| release id | `b705c57b-a379-47c3-bb70-869fb999ba8b` |
| release no | 6 |
| release key | `cm.release.execution-presets.v1.2026-08-31.1` |
| DB source fingerprint | `8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0` |
| scope | `payload` |
| records | 689 |
| 동일 재게시 | 같은 release 반환, `idempotent=true` |

master current는 522개이며 522개 모두 `synthetic_unreviewed`, `clinicalUseAllowed=false`였다. publisher payload hash와 DB current hash 불일치는 0개였다.

### 6.2 채택

정확한 대상은 `clair-demo`, `workspace-clair-cheongdam`, `workspace-clinical-master-pilot-v1` 세 곳이었다.

| 항목 | 각 워크스페이스 결과 |
| --- | ---: |
| 최초 신규 카탈로그 | 414 |
| 기존 행 동기화 | 414 |
| 검토 snapshot | 522 |
| 임상병리 catalog | 86 |
| 생성 lab item | 68 신규 + 1 기존 = 69 유효 |
| 생성 lab link | 278 신규 + 1 기존 = 279 유효 |
| 최종 catalog | 522 |
| 빈 `defaultDetailInputs` | 0 |
| 재채택 신규/동기화/검토/lab item/lab link/알림 | 모두 0 |

negative control인 `clair-foreign-demo`는 catalog 0개를 유지했다.

격리 harness에는 live-only 동결 오더 두 건이 참조하는 기존 immutable lab dependency 5개가 로컬 clone에 없었다. 읽기 전용 live 조회로 정확한 ID·key·revision·관계를 확인한 뒤 로컬 전용 seed로만 보충했다. 그래서 adopter가 새로 만든 수는 item 68/link 278이고, 기존 1개를 합친 최종 유효 수는 69/279다. 원격에는 쓰지 않았다.

### 6.3 사용자 수정 보존

청담 워크스페이스에서 복부 방사선 프로토콜을 `청담 워크스페이스 복부 촬영 프로토콜`로 바꾸고 사용 중지했다. revision은 1 → 2 → 3, customization state는 `customized`가 됐고 변경 필드에 `defaultDetailInputs`, `availabilityStatus`가 기록됐다. `order_catalog.paused` / `pause` 감사 이벤트도 확인했다.

재채택 후에도 두 로컬 수정, revision, paused 상태가 보존됐고 pending review 행이 생성됐다. stale CAS는 `40001`, immutable preset update는 `55000`으로 거부됐다.

### 6.4 재적용·권한·음성 게이트

6개 PR-022 migration을 같은 격리 DB에 다시 적용해 idempotency를 확인했다. foundation backfill 감사 행은 324개에서 증가하지 않았고, legacy adopter/resolver 함수 보존 rename도 재실행에서 중복 rename을 시도하지 않았다.

- 필수 필드에 default도 허용 resolver도 없는 preset: `23514` 거부
- current preset identity를 새 ID/revision 1로 교체: `23514 clinical_master_execution_preset_replacement_required` 거부
- stale catalog revision: `40001 catalog_revision_conflict` 거부
- immutable preset version update: `55000` 거부
- `anon`/`authenticated`의 master 직접 select와 private publisher/adopter/internal writer execute: 거부
- `hospital_admin` 역할을 유지해도 permission assignment에 `service_catalog:manage`가 없으면 master-update `accept_source`와 `dismiss`: 모두 `42501` 거부

### 6.5 과거 실행 데이터 비변경

격리 DB의 `orders`, `order_confirmation_commands`, `order_fulfillment_work_items`, `order_tasks`, `order_billing_candidates`는 리허설 전후 모두 0이었다. 즉, 게시·채택 리허설은 확정 오더·실행·청구 테이블을 생성하거나 수정하지 않았다. snapshot 불변 동작은 집중 테스트로 별도 검증했다.

## 7. 코드 검증 결과

| 검증 | 결과 |
| --- | --- |
| 변경된 전체 spec 정상 서버 실행 | 168 / 171 passed |
| 기능 관련 spec | 전부 통과 |
| 기존 병원관리 header 기하 spec | 3건 실패: 기대 56px / 현재 44px |
| 라우트 실서버 집중 검증 | 3 / 3 passed |
| 최종 clinical-master/security 집중 검증 | 52 / 52 passed |
| TypeScript | `npx tsc --noEmit` 통과 |
| ESLint | `npm run lint` 통과 |
| production build | `npm run build` 통과 |
| 산출물 check mode | 510 / 12 / 522 모두 통과 |
| 문서 링크 | 955개 docs/agent Markdown 검사 통과 |
| diff whitespace | `git diff --check` 통과 |
| secret scan | 3,893 tracked files, 통과 |

변경된 13개 spec을 정상 Next dev server에서 함께 실행한 결과 171건 중 168건이 통과했다. 실패 3건은 이번 diff가 건드리지 않은 기존 main-content header 기대값 56px과 현재 구현 44px의 불일치였다. 프리셋·카탈로그·차트·fulfillment 관련 검증은 모두 통과했고, 서버 없는 정적 설정에서 URL이 없어 실패했던 라우트 3건도 정상 서버 집중 실행에서 3/3 통과했다. 프리셋 구현을 위해 해당 UI 기하나 기존 테스트 기대값을 임의 수정하지 않았다.

빌드는 성공했지만 기존 `next.config.mjs` → PRD viewer import trace가 프로젝트 전체를 NFT trace할 수 있다는 Turbopack 경고 1건은 남아 있다. 이번 프리셋 변경과 무관한 기존 경고다.

### 7.1 독립 보안 재심사

독립 hard-gate 리뷰는 최초 `MUST-FIX`로 live lineage, required-field completeness, preset identity, DB writer permission·backfill audit, synthetic self-promotion 문제를 지적했다. 이를 수정한 뒤 마지막으로 master-update resolver의 canonical permission 우회 가능성까지 추가 발견해 보완했다.

최종 재심사 결론은 **APPROVE**이며 P0/P1은 0건이다. 이 승인은 로컬 구현과 보안 경계에 대한 승인이다. 원격 Supabase 적용, 실제 publish/adoption, 배포 또는 임상 활성화를 승인한 것은 아니다.

## 8. 구현 중 발견해 수정한 결함

1. 임상병리 검체 enum에 조직(`tissue`)이 없어 세포검사 프로필이 거부되던 문제
2. 계통검사 publisher action이 legacy `consultation`으로 분류되던 문제
3. 누적 publisher가 payload에서 생략된 기존 lab dependency revision을 null로 덮던 문제
4. lab adopter가 `ON CONFLICT DO NOTHING` 이후에도 생성 counter를 증가시키던 문제
5. 일반 catalog partial edit에서 nullable price를 `jsonb_set`하면 pricing rule 전체가 SQL null이 되던 문제
6. 비조제 오더 사용 중지 감사 이벤트가 update로만 기록되던 문제
7. private publisher/adopter와 내부 chart draft base RPC에 불필요한 execute 권한이 남을 수 있던 문제
8. live lineage SHA가 잘린 값이었고 실제 510개 집합을 재계산하지 않던 문제
9. DB required-field 검증이 default 또는 허용 resolver의 완전성을 강제하지 않던 문제
10. current preset identity를 새 ID/revision 1로 초기화할 수 있던 문제
11. catalog writer와 master-update resolver가 canonical `service_catalog:manage` 대신 일부 역할 label 경로에 의존하던 문제
12. compatibility backfill의 durable audit ledger와 candidate-only idempotency가 부족하던 문제
13. payload가 임상 검토 증거 없이 `clinically_reviewed`로 자기 승격할 수 있던 문제
14. required `preset_fixed` 필드에 정상 default가 있어도 DB가 거부하던 문제
15. PR-019 current가 rev2로 전진한 뒤 foundation 재적용 projection 검사가 rev1만 기대하던 문제
16. publish/adopt 재적용이 이미 보존된 legacy 함수를 다시 rename하던 문제

각 수정에는 fail-closed 또는 회귀 테스트를 추가했다.

## 9. 변경 범위

- 결정론적 프리셋·계통검사·최종 release compiler 3개
- 동결 fixture와 최종 게시 입력
- generic execution preset foundation, runtime transport, publish/adopt, system exam, publisher, consultation resolver migration 6개
- 병원관리 catalog read/write/UI
- 차트 초안 prefill·runtime resolver·확정 snapshot transport
- fulfillment의 `system_exam` queue 차단
- 타입·도메인 계약과 집중 테스트
- 작업 항목, 구현 보고서, 문서 내비게이션

기존 데모/확정 기록, 원격 데이터, 배포, dependency version은 변경하지 않았다. `npm ci --ignore-scripts`는 검증용 로컬 `node_modules`만 준비했으며 package manifest/lockfile은 수정하지 않았다.

## 10. 남은 외부 승인 게이트

다음은 **아직 수행하지 않았고 별도 명시적 승인이 필요하다**.

1. 후보 diff와 exact SHA에 대한 사람 최종 리뷰
2. 승인된 원격 Supabase 환경에 migration 적용
3. SHA `1eeb5035d70d5f28035df49d1d32c3689ffe79a4bb28062e5606256802572e0c`의 689-record payload 게시
4. 정확히 세 워크스페이스에만 채택하고 before/after/retry fingerprint 확인
5. `clair-foreign-demo` 불변 재확인
6. 인증된 병원관리·차트 브라우저 smoke
7. 임상 검토와 승인된 프리셋만 별도 활성화
8. 커밋·푸시·PR·merge·Ready deployment 및 rollback 증거

원격 실행 중에는 record count, source fingerprint, preset hash, 대상 workspace allowlist 중 하나라도 다르면 즉시 중단해야 한다. 임상 검토 전에는 `clinicalUseAllowed=false`를 유지해야 한다.

## 11. 현재 결론

“마스터에 프리셋 세부값이 있고, 워크스페이스로 함께 복사되며, 병원이 수정·사용 중지하고, 차트 추가 시 자동 입력되고, 확정 후에는 불변으로 남는가?”에 대한 로컬 구현 답은 **예**다.

“지금 원격 병원에서 바로 임상 사용 가능한가?”에 대한 답은 **아니오**다. 기술 후보는 준비됐지만 합성 프리셋의 임상 검토, 원격 적용 승인, 인증 브라우저 검증, 배포 절차가 남아 있다.
