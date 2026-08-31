---
title: "CLAiR 전 카테고리 마스터 오더 실행 프리셋 구현 보고서"
date: "2026-08-31"
work_item: "CLINICAL-MASTER-PR-022"
status: "remote_workspace_rollout_complete_delivery_in_progress"
remote_writes: 19
remote_publish_outcome: "published_release_50_and_workspace_rollout_completed"
clinical_use_allowed: false
---

# CLAiR 전 카테고리 마스터 오더 실행 프리셋 구현 보고서

## 1. 최종 판단

요청한 구현과 대상 워크스페이스의 원격 데이터 반영은 완료됐다. 애플리케이션 코드 배포와 인증 UI smoke가 남아 있다.

- 기존 510개 마스터 오더와 새로 정의한 12개 계통별 신체검사 오더를 합쳐 **522개 오더 모두에 정확히 하나의 현재 실행 프리셋**이 존재한다.
- 최종 게시 입력은 **689개 레코드 / 522개 오더**이며, 고정 산출물 SHA-256은 `1eeb5035d70d5f28035df49d1d32c3689ffe79a4bb28062e5606256802572e0c`이다.
- 마스터 프리셋은 워크스페이스 카탈로그로 복사되고, 병원은 복사본을 수정하거나 `사용 중지`할 수 있다.
- 수정하지 않은 복사본은 새 마스터 개정에 자동 동기화되고, 수정한 복사본은 덮어쓰지 않고 검토 대상으로 남는다.
- 차트에 오더를 추가하면 프리셋 세부값이 초안에 자동 입력된다. 안전하게 추론할 수 없는 필드는 수동 입력 또는 런타임 해석 대상으로 남는다.
- 확정 시점의 유효 세부값은 오더 snapshot으로 고정되며, 이후 마스터·워크스페이스 변경이 과거 확정 기록을 바꾸지 않는다.
- 전용 `system_exam` 타입은 차트에서 완료되며 처치·검사·조제 fulfillment queue로 전달되지 않는다.

publisher의 set-based 2단계 성능 보완과 current-main 상담/billing/Realtime 호환을 격리 DB에서 검증하고 독립 재심사한 뒤, 정확한 원격 후보를 적용했다. release no. 50의 689개 레코드·522개 오더 게시가 25.2초에 완료됐고 같은 입력 재호출은 10.85초에 idempotent하게 끝났다. 세 대상 워크스페이스는 모두 522개 프리셋 연결과 빈 기본값 0개를 만족한다. 조제 108개는 기존 병원 프로필이 master revision 1에 묶여 있어 새 revision 2로 강제 변경하지 않고 기존 프로필과 일치하는 프리셋을 보존한 채 검토 유예했으며, 나머지 414개는 현재 release를 채택했다. 외부 통제 워크스페이스의 catalog·update·lab·notification·audit 변화는 모두 0이다. 모든 프리셋은 `synthetic_unreviewed`, `clinicalUseAllowed=false` 계약을 유지하므로 이번 완료는 임상 승인이나 실제 진료 활성화를 의미하지 않는다.

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

### 6.6 승인된 원격 실행 경과

승인된 대상은 Supabase project `qmerxgzrwaaahpkhjqlc`와 세 workspace `clair-demo`, `workspace-clair-cheongdam`, `workspace-clinical-master-pilot-v1`이었다. `clair-foreign-demo`는 negative control로 유지했다. 이때 사용한 과거 원격 실행 후보 commit은 `1c75aa04079bcdda36e50bfcc9ce0bf4350f4494`였고, 게시 입력은 689 records / 522 orders, semantic SHA-256 `1eeb5035d70d5f28035df49d1d32c3689ffe79a4bb28062e5606256802572e0c`였다. 이 과거 승인은 뒤에서 설명하는 현재-main 성능 후보에 재사용되지 않는다.

- PR-022 migration 6개는 원격에 적용됐다. migration history에는 runtime transport가 동일 statement SHA-256으로 두 행 기록되어 총 7개 history row가 보인다. 독립 검토는 이 중복이 동일한 `CREATE OR REPLACE` 계약이고 별도 DML이 없음을 확인해 history repair 없이 유지하도록 승인했다.
- foundation readback은 current/version preset `108/108`, compatibility backfill audit `324`, foreign catalog `0`이었다.
- 게시 직전 eligible order는 510, stable-key SHA-256은 `2197c142243464c7d14ffc1ae921106ed609084fb960fd4eba2c309f6fe80164`, lineage SHA-256은 `b4d56f15dfcf53e867db2e022f6e7c742c2354b507eb4a88feb981b351b039bb`였다.
- 청담의 전체 `orders` hash 변동은 확정 기록이 아니라 `draft`, revision 0, 빈 confirmed snapshot인 한 행의 동시 변경으로 좁혀졌다. 확정 14건의 immutable fingerprint `7164b275604d4b233e14bb1e18b30d02b4811bc9b24df0ec14d38a25430d39b0`와 fulfillment fingerprint는 그대로였다. actor audit가 없어 이를 특정 사용자의 autosave로 단정하지는 않았다.
- 첫 게시 호출은 1,982,060-byte 원본 JSON으로 실행되어 2026-08-31 09:50:56 UTC에 524가 발생했다. 이후 readback은 release 0, current/version `108/108`, eligible 510, active publish 0으로 완전 rollback을 증명했다.
- 독립 검토가 공백만 제거한 1,443,553-byte 동일 semantic JSON의 단 한 번 재시도를 승인했다. 재시도 직전 release 0, current/version `108/108`, eligible 510, 위 확정/fulfillment/catalog/foreign gate가 모두 통과했다.
- 첫 원격 packet의 두 번째이자 당시 마지막 게시 호출도 2026-08-31 10:04:13 UTC에 524로 끝났다. 직후 Supabase SQL readback, CLI login role, security/performance advisor가 모두 `Connection terminated due to connection timeout`을 반환해 결과를 임시로 unknown으로 차단했다.
- 연결 회복 뒤 2026-08-31 10:19:53 UTC의 단일 권위 쿼리는 active publisher backend 0, release 0, incomplete release 0, current/version preset `108/108`, eligible order 510을 반환했다. 따라서 두 번째 publish도 **완전 rollback**으로 확정한다.

첫 원격 packet 종료 당시 안전 판정은 **BLOCKED / NEW PERFORMANCE CANDIDATE APPROVAL REQUIRED**였다. 기존 publisher의 세 번째 호출, workspace adoption, migration repair, staging/pg_cron 우회, GitHub PR/merge와 배포를 금지하고 아래 performance migration과 current-main 최종 호환 migration을 별도 candidate로 분리했다. 이 candidate의 이후 승인·적용·rollback 결과는 6.10에 기록한다.

### 6.7 Publisher timeout 원인 조사와 성능 구현

두 524는 payload 전송 크기만의 문제가 아니다. 두 번째 호출은 동일 semantic JSON을 1,443,553 bytes로 줄였어도 같은 120초 timeout에 도달했다. 정확한 510-order / 108-preset 기준선을 별도 Supabase DB에 복원하고 689-record payload를 실행해 함수별 시간을 수집했다.

- 한 publish의 예상 fan-out은 535개 master version, 522개 preset/current projection, 1,070개 review event, 689개 manifest row다.
- 기존 함수는 `clinical_master_canonicalize_payload`를 두 번 호출해 약 1.86초를 사용했다.
- execution-preset 계약 검증은 2,610회, detail schema 생성 체인은 5,220회 호출됐고 각각 누적 약 4.45초와 4.24초였다.
- 약 `522 × 86` profile 반복 탐색은 cumulative publisher의 lab profile 처리에서 발생한다. preset projection trigger가 profile 집합을 탐색한다는 이전 설명은 잘못이므로 정정한다. trigger는 별도로 preset 검증·hash·lock·point lookup·projection을 수행한다.
- `clinical_master_lab_relation_content`는 1,301회, 누적 약 0.49초였다. 이 경로까지 넓게 재작성하지 않아도 우선 병목을 제거하면 60초 gate에 충분한 여유가 생기는지 먼저 검증했다.

새 migration `20260831103000_clinical_master_publisher_performance.sql`은 공개 함수 signature, diagnosis-only dispatch, ACL/RLS, advisory lock, release fingerprint, payload manifest, trigger projection과 단일 transaction 원자성을 유지하면서 측정된 중복만 제거한다.

1. execution-preset 계약 검증이 이미 생성한 detail schema를 입력 검증 helper에 전달해 같은 계약 안에서 schema를 두 번 만들지 않는다.
2. 최신 outer publisher가 canonical payload의 SHA-256을 transaction-local marker로 전달한다.
3. cumulative core는 marker가 전달받은 payload SHA-256과 정확히 같을 때만 두 번째 canonicalization을 생략하고, 직접 호출이나 hash 불일치에는 기존 canonicalization을 그대로 실행한다.
4. diagnosis-only payload와 diagnosis/order 혼합 거부, payload manifest, 결과 JSON과 private ACL은 유지한다.
5. bulk writer나 statement trigger로 범위를 넓히는 재작성은 이번 측정에서 필요하지 않았으므로 하지 않았다. 현재 병목 수정으로 60초 gate를 큰 폭으로 통과했고, 더 큰 구조 변경은 위험 대비 이득이 부족하다.

### 6.8 격리 DB 성능·원자성 결과

동일한 깨끗한 510/108 기준 DB를 각 실행 전 PostgreSQL 재시작으로 buffer-cold 상태로 만들고, 모든 publish를 transaction rollback으로 측정했다.

| 실행 | 1회 | 2회 | 3회 | 중앙값 | 최대 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 기존 publisher | 6.122초 | 5.703초 | 5.646초 | 5.703초 | 6.122초 |
| 성능 candidate | 3.477초 | 3.082초 | 3.136초 | 3.136초 | 3.477초 |

중앙값은 약 **45.0% 단축**됐고 candidate 세 번 모두 60초 gate를 통과했다. canonical payload fingerprint는 모든 실행에서 원격 승인 입력과 같은 `8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0`였다.

격리 persistent publish 결과는 release 1, execution-preset version/current `630/522`, manifest 689, release review event 1,070, unsafe preset 0, current lineage mismatch 0이었다. 즉시 재시도는 같은 release ID와 `idempotent=true`를 반환했고 version/manifest 수가 증가하지 않았다. 1.5초 강제 timeout은 relation 계산 도중 취소됐지만 release, preset, current, manifest 잔여물이 모두 0이었다. unknown payload key, diagnosis/order 혼합, duplicate master key, preset content hash mismatch도 기대한 fail-closed 오류로 거부되고 잔여물을 남기지 않았다.

최종 rollback-only rehearsal은 DB catalog에서 네 private 함수의 owner=`postgres`, `SECURITY DEFINER`, 고정 `search_path`, PUBLIC/`anon`/`authenticated`/`service_role` execute 회수를 직접 확인했다. fixture에 있는 8개 유형과 별도 `external_lab` case를 합친 9개 임상 유형에서 기존·최적화 validator의 valid/invalid 결과가 같음을 검증했고, `clinicalUseAllowed=true`, `clinically_reviewed`, 알 수 없는 detail field를 모두 fail-closed로 거부했다. 비정규 record 순서를 사용한 marker 없음·잘못된 digest 직접 호출은 기존 canonicalization fallback을 타고 동일 fingerprint를 만들었으며 각각 rollback 뒤 잔여물 0이었다. 정확한 digest 경로는 outer publisher로 검증했다. 마지막 보강 실행은 정상 publish와 retry 직후 같은 transaction 안에서 marker/adoption/manifest GUC 3개가 모두 비었음을 확인하고 timeout SQLSTATE를 `57014`로 고정한 뒤 성공했다.

이후 후보를 현재 `origin/main` `00d62a6ea34abf2551a4d0fbf8587bbbb40f8e7f` 위로 안전하게 재배치했다. 이 과정에서 current-main의 후속 billing/Realtime migration이 PR-022 상담 담당자 정규화 wrapper를 덮고, DB writer가 `chart:view`보다 encounter/catalog를 먼저 읽는 두 경계 문제가 드러났다. 최종 호환 migration `20260831120100_clinical_master_consultation_runtime_billing_realtime_compatibility.sql`은 actor·membership·`chart:update`·`chart:view`를 모든 임상 조회보다 먼저 검사하고, 상담 담당자 정규화 → billing summary → Realtime broadcast를 한 함수·transaction에 다시 결합하며, 남은 base writer의 client execute를 회수한다.

소유권 보존 격리 DB 두 개를 새로 만들었다. fresh clone에는 billing-summary → PR-022 6개 → realtime → performance → SOAP block → 최종 호환 migration 순으로, incremental clone에는 현재-main billing-summary → realtime → SOAP block → PR-022 6개 → performance → 최종 호환 migration 순으로 적용했다. 두 DB의 최종 public writer는 동일한 definition MD5 `a85f22b4af1e2cb1e5262b3ce0993a30`, owner `supabase_admin`, `SECURITY DEFINER`, 빈 `search_path`, authenticated-only public execute였고, 네 retained base writer의 authenticated execute는 모두 false였다. 두 DB 모두 rollback-only 호환 rehearsal을 통과했다. 개별 오더와 Order Set child의 spoofed clinician은 encounter 주치의로 치환됐고, 주치의가 없으면 필드가 제거됐으며, billing summary와 Realtime 계약이 유지됐다. update-only custom role의 nonexistent encounter 호출은 row 존재를 읽기 전에 SQLSTATE `42501`로 거부됐다.

최종 fresh clone에서 performance rehearsal은 marker 없음 fallback 3.581초, 잘못된 digest fallback 2.927초, 정상 publish 2.888초, 같은 release ID 재시도 1.296초였고 1.5초 timeout은 SQLSTATE `57014`로 취소됐다. 실행 전후 기준선은 `510 orders / 108 versions / 108 current`, release/manifest 잔여물은 0이었다. 별도 독립 실행도 publish 2.986초, retry 1.327초, timeout `57014`와 같은 무잔여 기준선으로 통과했다. 처음 만든 owner 미보존 진단 clone의 preflight 거부는 migration 결함이 아니라 dump/restore harness의 owner 손실로 분리했다. 두 최종 clone은 migration을 direct SQL로 적용했으므로 `supabase_migrations.schema_migrations`만으로 적용 순서를 증명하지 않으며, 실행 명령 기록과 최종 객체·동적 rehearsal 결과를 근거로 삼는다. 이 warm sample들은 기존 cold restart 3-run benchmark를 대체하지 않으며 원격 성공도 보장하지 않는다.

이 증거는 로컬 성능 candidate의 진행 가능성을 보여주지만 원격 성공을 보장하지는 않는다. 원격에는 부하, gateway, lock과 table bloat 차이가 있으므로 변경 SQL을 exact SHA로 동결해 독립 재심사와 별도 원격 쓰기 승인을 받아야 한다.

### 6.9 로컬 최종 candidate exact SHA packet

아래 SHA는 current-main 재배치와 최종 호환 보완 뒤 전용 worktree 파일의 정확한 내용 hash다. 기능 commit은 `b465608c`, 별도로 승인된 실행 시점 branch-head는 `4549c6fd36b9347e05361b0d63a610ac33dfd10f`, base는 `origin/main` `00d62a6ea34abf2551a4d0fbf8587bbbb40f8e7f`였다. 이 표 자체가 승인은 아니며, 6.10의 별도 승인과 원격 실행 결과가 실제 승인 범위를 기록한다.

| 파일 | SHA-256 |
| --- | --- |
| `20260831103000_clinical_master_publisher_performance.sql` | `aaa9795baf380e16d24973e344e5e3be2bf2b6696ef614326520cc8885b0a495` |
| `clinical-master-execution-preset-release-v1.json` | `834812eaea2afb2fafb93ea3b0a23efb5bc7df54ea3ac8977983683523c4e278` |
| rollback-only performance rehearsal SQL | `746afecaea71f157ecf4f250d9c0b343d7536cf2364c78bf432522d12aacbb03` |
| performance migration static spec | `a21815e3d662b10430432d61f67550d989dd37533046708f467db5b97a2f2427` |
| `20260831120100_clinical_master_consultation_runtime_billing_realtime_compatibility.sql` | `6a952519fb7c762d1f5da931b166b7605ddbb54deff58a567ef98091f44f788f` |
| consultation compatibility rollback-only rehearsal SQL | `744673aef64ff67dae7239a21fb781f8a487d49dedc0951283e9e66fe2083fb7` |
| consultation compatibility static/rehearsal spec | `92e04acdb2f7268654f5df29c680d2bfff92cf98d9fafaadb75717a6d1af6f6e` |

### 6.10 승인된 성능 후보 원격 실행 결과

승욱의 별도 승인 뒤 candidate commit
`4549c6fd36b9347e05361b0d63a610ac33dfd10f`과 위 exact file SHA packet으로
Supabase project `qmerxgzrwaaahpkhjqlc`에 원격 실행했다.

- publisher 직전 read-only gate는 선행 함수 누락 0, target release 0,
  active publisher/adopter backend 0, master/eligible order `510/510`, execution
  preset version/current `108/108`, compatibility backfill audit `324`였다.
  stable-key SHA-256 `2197c142243464c7d14ffc1ae921106ed609084fb960fd4eba2c309f6fe80164`와
  lineage SHA-256 `b4d56f15dfcf53e867db2e022f6e7c742c2354b507eb4a88feb981b351b039bb`도
  동결값과 같았다.
- performance migration은 history `20260831122808`, consultation runtime
  compatibility migration은 history `20260831122838`로 순서대로 적용됐다.
  적용 뒤 private publisher owner/config/ACL, public writer definition MD5
  `a85f22b4af1e2cb1e5262b3ce0993a30`, authenticated-only public execute,
  retained base writer client execute 회수와 `510/108/108` 기준선을 확인했다.
- exact payload는 file SHA-256
  `834812eaea2afb2fafb93ea3b0a23efb5bc7df54ea3ac8977983683523c4e278`,
  1,982,060 bytes, 689 records / 522 orders였고, 모든 preset이
  `synthetic_unreviewed`, `clinicalUseAllowed=false`였다.
- publisher는 `lock_timeout=5s`, `statement_timeout=60s`의 명시적 transaction에서
  정확히 한 번 호출됐다. 결과는 cumulative publisher line 606 assignment에서
  SQLSTATE `57014` statement timeout이었다.
- 2026-08-31 12:37:27 UTC의 즉시 readback은 target release 0, manifest 0,
  preset version/current `108/108`, master order 510, active backend 0을 반환했다.
  따라서 이 실행은 **완전 rollback**이며 partial release나 채택 가능한 release가 없다.
- 적용 후 read-only advisor는 security `INFO 91 / WARN 187`, performance
  `INFO 402 / WARN 13`을 반환했다. clean advisor 결과를 주장하지 않는다.
  이 중 master release/current preset의 covering-index 경고는 다음 원격 병목
  조사 입력으로 보존하되, 기존 경고와의 delta나 timeout 원인으로 아직 단정하지 않는다.

독립 boundary review의 최종 판정은 **COMPLETE ROLLBACK / SAFE STOP**이다.
두 migration은 권한·호환성 개선으로 유지하지만 publisher 재호출, workspace
adoption, migration/history repair, release/preset 삭제는 실행하지 않는다. 로컬
3초대 성능 결과와 달리 이 후보는 원격 60초 gate를 통과하지 못했으므로, 다음
원격 시도는 원격 전용 병목 조사, 새 performance candidate와 exact SHA, 격리
검증, 독립 재심사, 별도 승인 이후에만 가능하다.

### 6.11 원격 60초 병목 읽기 전용 조사

원격 DB에는 publisher, adopter, `ANALYZE`, `VACUUM`, index 또는 설정 변경을
실행하지 않았다. 함수 source/catalog, relation/index 통계, 현재 lock과
`EXPLAIN` 예상 plan만 읽었다. 이 방법은 Supabase의
[query optimization](https://supabase.com/docs/guides/database/query-optimization),
[database inspection](https://supabase.com/docs/guides/database/inspect),
[pg_stat_statements](https://supabase.com/docs/guides/database/extensions/pg_stat_statements)
지침을 기준으로 삼았다. writer를 실제 실행하는 `EXPLAIN ANALYZE`는 사용하지
않았다.

#### 확인된 사실

- 설치된 cumulative publisher의 line 605는 689개 owner loop 시작, line 606은
  `v_master_key := btrim(v_record->>'masterKey')`, line 608은
  `master.master_records`의 `FOR UPDATE` point lookup이다. line 606은 느린
  `btrim`의 증거가 아니라 60초 제한이 반복문의 interrupt 지점에서 전달됐다는
  뜻이며, 몇 번째 owner였는지는 오류 context만으로 알 수 없다.
- 이 loop 전에 combined stage 689행 insert와 2,455행 update가 발생했고,
  order stage 522행, test stage 72행, panel stage 18행도 생성 시도가 기록됐다.
  따라서 payload 전송·첫 validation만 하다가 멈춘 것이 아니라 lab dependency와
  durable stage materialization을 지나 owner revision loop에 진입했다.
- 현재 lock은 0, deadlock 누계는 0이었다. 실행 당시 `lock_timeout=5s`보다
  `statement_timeout=60s`의 `57014`가 발생했으므로 장시간 blocking lock이 주원인일
  가능성은 낮다.
- combined stage는 총 3.9MB, order stage 1.4MB, master version table 1.2MB로
  작았고 combined stage의 heap block은 read 70 대 hit 74,252였다. combined
  stage는 `seq_scan=0`, `idx_scan=7,521`이었다. 큰 table scan이나 disk I/O,
  일반적인 bloat만으로 60초를 설명할 증거는 없다.
- `clinical_master_lab_relation_content`의 예상 plan은 4개 release를 순회하면서
  기존 `(release_id, master_key)` index를 사용했고 stage sequential scan을 하지
  않았다. 따라서 `master_key` 단독 index를 추가하자는 가설은 현재 증거로
  반증됐으며 새 migration에 넣지 않는다.
- advisor의 current-preset composite FK, `activated_in_release_id`,
  `published_by_user_id` child-side index 경고는 이번 timeout 이후 단계이거나 parent
  update/delete 검사에 주로 영향을 준다. 이번 60초 원인으로 취급하지 않는다.
- 원격은 `track_functions=none`, `pg_stat_statements.track=top`이라 실패한 함수의
  nested statement별 시간을 사후 복원할 수 없다. 이 설정을 변경하거나 통계를
  reset하지 않았으므로 정확히 어느 owner iteration이 가장 비쌌다는 주장도 하지
  않는다.

#### 로컬 3초 결과의 한계

기존 격리 rehearsal은 exact 689/522 payload의 기능, 원자성, 결과 count와
rollback을 강하게 증명하지만 원격 성능을 재현하는 benchmark는 아니다. 시작
stage/history/TOAST footprint, relation 통계, phase timer, raw run output와 환경
snapshot이 version control에 없고, retry도 첫 publish와 같은 transaction에서
실행됐다. 따라서 3초대 수치는 깨끗한 로컬 DB에서 candidate가 동작한다는 증거로만
유효하며 원격 60초 해결 증거로 다시 사용하지 않는다.

#### 현재 원인 판단

가장 강한 설명은 작은 원격 relation에 대한 index/lock 문제가 아니라, 약 2MB
JSON과 689개 owner를 PL/pgSQL에서 여러 차례 행 단위로 순회하면서 stage relation,
latest version, snapshot 비교와 update를 반복하는 CPU·SPI 비용이다. 특히 line 606
loop는 이미 계산된 stage의 `master_record_id`, `base_content`, `relation_content`,
`effective_revision`을 다시 payload와 helper에서 재구성한다. 이것은 현재 증거에
가장 잘 맞는 **우선 구현 가설**이지만, nested timing 부재 때문에 단일 원인으로
확정하지는 않는다.

#### 새 performance candidate 구현 계획

1. **재현 가능한 benchmark부터 보강한다.** exact payload/file SHA, function
   definition SHA, PostgreSQL 설정, relation/TOAST 크기와 table stats를 각 run의
   JSON/TSV 증거로 남긴다. 기능 rehearsal과 성능 run을 분리하고, baseline과
   candidate를 동일 fresh snapshot에서 ABBA 순서로 최소 3회 비교한다. retry는
   commit 뒤 새 transaction/connection에서 검증한다.
2. **1차 candidate는 owner revision pass만 set-based로 바꾼다.** 이미 만든
   `clinical_master_lab_publish_stage`를 유일한 incoming owner snapshot으로 사용해
   payload 재분해, relation helper 재호출, master record/type/latest-version point
   lookup과 행별 update를 제거한다. stage count·record type·revision 불일치는
   기존처럼 fail closed 처리한다.
3. **effective revision 계산의 반복 subquery를 한 번의 latest-version 집합으로
   합친다.** 같은 stage row마다 `exists`, latest snapshot, latest revision을 반복
   조회하지 않고 release-scoped CTE/join 한 번으로 계산한다. 기존 stage table과
   index를 재사용하며 근거 없는 FK/index migration은 추가하지 않는다.
4. **1차 candidate가 기준을 못 넘을 때만 2차 범위를 연다.** 522 order × 86 profile
   탐색과 version/name/source/review write를 각각 set-based pipeline으로 분리한다.
   한 번에 전체 publisher를 재작성하지 않고, 각 확장의 before/after plan과 semantic
   fingerprint를 별도 증명한다.
5. **성능 합격선을 60초보다 엄격하게 둔다.** remote-footprint 격리 DB에서 exact
   publish 3/3이 권장 15초, 최대 20초 안에 끝나고, baseline 대비 일관된 개선을
   보여야 한다. publish/retry/강제-timeout rollback, `689 / 522`, preset
   `630/522`, manifest 689, review 1,070, release/fingerprint/lineage와 foreign 및
   customization 불변을 모두 다시 검증한다.
6. **보안·원격 게이트는 새로 시작한다.** owner, `SECURITY DEFINER`, 고정
   `search_path`, ACL/RLS, advisory lock, 단일 transaction과 GUC cleanup을 독립
   hard gate로 재심사한다. 그 뒤 새 commit과 migration/rehearsal/payload exact SHA를
   동결하고 별도 원격 쓰기 승인을 받아야 한다.

### 6.12 set-based candidate 구현과 격리 검증

조사에서 정한 1차 범위를 그대로 구현했다. 새 migration
`20260831132225_clinical_master_publisher_set_based_owner_revision.sql`은 설치된
cumulative publisher에 누적된 canonical-digest·omitted-lab patch를 보존하면서,
네 effective-revision pass의 반복 latest-version 조회를 release-scoped CTE로
합치고 두 번째 689-owner PL/pgSQL loop를 combined release stage 기반 단일 update로
교체한다. stage 수·payload/type·latest immutable version·owner current revision이
어긋나면 즉시 실패한다.

함수 재정의 전후에는 owner, `SECURITY DEFINER`, `search_path`, ACL, volatility와
parallel safety를 exact 비교하고 client role의 cumulative 함수 실행 권한을 다시
회수한다. 로컬 적용·재적용은 모두 통과했으며 설치 함수 MD5는
`d8224d2af4841dbf3d3f4ec395084ee7`이었다. owner `postgres`, 고정 search path와
PUBLIC/anon/authenticated/service_role execute 거부도 유지됐다. public runtime row,
workspace adoption, index, 서버 timeout 또는 원격 DB는 변경하지 않았다.

별도 local-only benchmark runner와 rollback SQL probe도 추가했다. runner는
`supabase_db_` Docker 컨테이너, Supabase Postgres image, 정확한 `510/108/108`
template baseline과 candidate marker를 확인한 뒤에만 ownership-preserving 임시 DB를
만든다. baseline/candidate는 동일 template에서 `A-B-B-A` 두 cycle로 각각 4회
측정하고 매 실행 뒤 DB를 삭제한다. raw JSONL에는 fixture·migration SHA, SQL/client
시간, relation/TOAST 크기, table stats, function hash와 PostgreSQL 설정을 남긴다.
committed retry는 첫 publish를 commit한 다음 새 connection에서 재호출한다.

| 격리 검증 | 결과 |
| --- | --- |
| migration 적용 / 동일 migration 재적용 | 통과 / 통과 |
| exact 기능 rehearsal | publish 2.847초, retry 1.378초, forced timeout SQLSTATE `57014` 후 residue 0 |
| release semantic gate | versions 535, manifest 689, review 1,070, presets `630/522`, stage/version mismatch 0, owner/current mismatch 0 |
| ABBA baseline 4회 SQL 중앙값 | 3.051초 |
| ABBA candidate 4회 SQL 중앙값 | 2.926초, 4/4 모두 baseline보다 빠름, 중앙값 4.1% 개선 |
| committed publish / 새 connection retry | 3.048초 / 1.380초, 같은 release, retry `idempotent=true`, count·revision delta 0 |
| 임시 benchmark DB 정리 | `clinical_master_bench_*` 잔여 0 |

기능 rehearsal의 fallback·잘못된 digest·exact publish·retry·강제 timeout 경로도 모두
통과했고, target release의 535개 immutable version이 stage effective revision과
content에 일치함을 직접 검증했다. ABBA 수치는 깨끗한 동일 로컬 template에서의
비교일 뿐 원격 물리 footprint나 gateway 60초를 재현하지 않는다. 절대 시간은
15초/20초 로컬 gate를 만족하지만 개선 폭은 4.1%로 작으므로, 원격 성공을
예측하거나 이전 원격 승인을 재사용하지 않는다.

#### 새 로컬 candidate exact-file SHA packet

| 파일 | SHA-256 |
| --- | --- |
| set-based publisher migration | `5af6ad73b35c511209f6f645b04eb5148992c2f3ea2942deadc74f9cca071840` |
| local-only benchmark runner | `2bb898844884a02ed93487fde81b75c735792c16425ef92b0e2edb3075c125bd` |
| rollback benchmark SQL probe | `975871943b5d4fd7c6f2681f725373dcae645a63370e567fb0e60d695e451129` |
| 강화된 performance rehearsal | `57a1995f41016a98705e9629bced9508b9b31595cd4d6c60aed427179ec224fe` |
| set-based candidate spec | `b936e9f3f7ef1cb37320076cdba2d76e78faf72f7617877a508bfb463a2b320b` |
| performance contract spec | `bd78b6a2b685cfbdd3d7cfbe720d65b21323a01abe71e115a73d906b372794dc` |
| exact 689/522 fixture | `834812eaea2afb2fafb93ea3b0a23efb5bc7df54ea3ac8977983683523c4e278` |

이 표는 원격 적용 전 동결한 로컬 후보 packet의 역사적 기록이다. 이후 독립 재심사와
새 승인 경계를 거쳐 아래 6.13의 정확한 후보가 원격에 적용됐다.

### 6.13 최종 원격 게시와 워크스페이스 rollout

최종 원격 대상은 Supabase project `qmerxgzrwaaahpkhjqlc`와 정확히 세 workspace
`clair-demo`, `workspace-clair-cheongdam`,
`workspace-clinical-master-pilot-v1`이다. `clair-foreign-demo`는 호출하지 않은
negative control로 유지했다.

| 원격 후보 | SHA-256 |
| --- | --- |
| set-based owner revision migration | `5af6ad73b35c511209f6f645b04eb5148992c2f3ea2942deadc74f9cca071840` |
| set-based finalization migration | `7a6a9ffd9a12ea1e25c6b51828f99d9b4270c290e2b92f6f1a522749705d8fab` |
| exact 689/522 payload file | `834812eaea2afb2fafb93ea3b0a23efb5bc7df54ea3ac8977983683523c4e278` |
| guarded workspace rollout packet | `ed17b6bc96b26f01c3791c9a9dbe989cd95f94abedbb8dd035372f4027ce590f` |

두 set-based migration 적용 뒤 함수 owner, `SECURITY DEFINER`, 고정 `search_path`,
ACL과 exact definition hash를 다시 읽어 일치시켰다. 게시 결과는 release id
`647629e9-41fe-4d75-a572-99f34bf428ea`, release no. 50, release key
`cm.release.execution-presets.v1.2026-08-31.1`이며 source fingerprint는
`8b939f7a0c752bb7b8989aca80380e51c1a720a8b98ccb35d1ceb1408648a0f0`이다.
최초 exact publish는 25.2초, commit 뒤 동일 입력 retry는 10.85초에 끝났고 같은
release를 `idempotent=true`로 반환했다. 최종 manifest 689, stage 689, immutable
version 535, review 1,070, preset version/current `630/522`이며 semantic mismatch는
모두 0이다.

workspace adoption 뒤 새 release의 검토 결정을 영속화하는 별도 packet을 만들었다.
조제 108개는 병원 소유 profile이 master order revision 1에 묶여 있고 새 master
current는 revision 2라서, trigger가 `accept_source`를 fail closed로 거부하는 것이
정상이다. 임상 검증이 연기된 현재 범위에서는 이 108개를 강제로 재게시하지 않고
각 workspace의 기존 profile-matched 프리셋을 보존한 채 이번 update를 `dismiss`했다.
나머지 414개는 exact current preset을 `accept_source`했다. packet은 exact target,
release, row count와 expected revision을 잠그며, `BEGIN`/`ROLLBACK` 리허설과 잔여물
0 확인 뒤 독립 검토 High/Medium/Low `0/0/0` 승인을 받고 영속 실행했다.

| 워크스페이스 | catalog / preset 연결 / 빈 기본값 | 활성 / 사용 중지 | 이번 release 결정 | 차트 검색 프리셋 행 |
| --- | --- | --- | --- | --- |
| `clair-demo` | `522 / 522 / 0` | `414 / 0` | accept 414 / dismiss 108 / pending 0 | 522 / 522 prefilled |
| `workspace-clair-cheongdam` | `522 / 522 / 0` | `402 / 12` | accept 414 / dismiss 108 / pending 0 | 510 / 510 prefilled |
| `workspace-clinical-master-pilot-v1` | `522 / 522 / 0` | `412 / 0` | accept 413 / auto 1 / dismiss 108 / pending 0 | 520 / 520 prefilled |

pilot의 차트 검색에서 빠지는 2개는 이번 release 대상이 아닌 오래된 pending-new
catalog 행 두 개다. 청담의 12개 사용 중지 상태도 병원 소유 설정으로 보존했다.
차트 검색 readback은 `lab`, `consultation`, `dispensing`, `hospitalization`, `imaging`,
`other`, `system_exam`, `treatment` 전 카테고리에서 반환 행 수와 prefilled 행 수가
일치했다. target 1,566개 catalog에서 current preset mismatch 0, 보존한 조제
profile/preset mismatch 0, clinical gate mismatch 0이었다. `clair-foreign-demo`의
catalog, master update, lab item/link, notification, audit 변화는 모두 0이다.

## 7. 코드 검증 결과

| 검증 | 결과 |
| --- | --- |
| 변경된 전체 spec 정상 서버 실행 | 179 / 182 passed |
| 기능 관련 spec | 전부 통과 |
| 성능 migration 정적 spec | 6 / 6 passed |
| 관련 publisher 회귀 spec | 24 / 24 passed |
| set-based migration 적용 / 재적용 | PASS / PASS |
| set-based exact 기능 rehearsal | versions 535, manifest 689, review 1,070, presets `630/522`, mismatch/residue 0 |
| set-based ABBA 격리 benchmark | baseline 4 / candidate 4 PASS, candidate 4/4 faster, 중앙값 3.051초 → 2.926초 |
| commit 후 새 connection retry | 3.048초 / 1.380초, same release, `idempotent=true`, no delta |
| 최종 C2 ABBA 재검증 | baseline 중앙값 2.824초 → C2 2.545초, 9.85% 개선 |
| benchmark 원격 Docker guard | SSH/TCP Docker endpoint 실행 전 차단 |
| exact 510/108 DB cold benchmark | candidate 3 / 3 runs under 60s |
| persistent publish / retry | 689 / 522, `630/522`, manifest 689, retry no delta |
| 최종 원격 publish / retry | 25.2초 / 10.85초, release no. 50, `idempotent=true` |
| workspace rollout packet 정적 spec | 3 / 3 passed |
| 원격 rollout semantic readback | target 1,566 rows, current/deferred/clinical mismatch 0, foreign 변화 0 |
| 차트 category prefill readback | demo 522/522, Cheongdam 510/510, pilot 520/520 |
| forced timeout rollback | release/preset/current/manifest residue 0 |
| 기존 병원관리 header 기하 spec | 3건 실패: 기대 56px / 현재 44px |
| 차트 초안 라우트 실서버 검증 | 20 / 20 passed |
| current-main billing/retry 차트 집중 검증 | 4 / 4 passed |
| 최종 호환 migration 정적·rehearsal spec | 7 / 7 passed |
| 독립 resolver·route 재실행 | 27 / 27 passed |
| 최종 clinical-master/security 집중 검증 | 52 / 52 passed |
| TypeScript | `npx tsc --noEmit` 통과 |
| ESLint | `npm run lint` 통과 |
| production build | `npm run build` 통과 |
| 산출물 check mode | 510 / 12 / 522 모두 통과 |
| 문서 링크 | `npm run docs:check` 통과 |
| diff whitespace | `git diff --check` 통과 |
| secret scan | `npm run security:secrets` 통과 |

새 set-based candidate는 기존 publisher 회귀 묶음 24/24, migration 적용·재적용,
exact 기능 rehearsal, ABBA 8-run과 commit 후 새 connection retry를 통과했다. benchmark
runner는 원격 Docker endpoint를 실행 전에 거부하고, 오류가 나도 생성한 임시 DB를
`finally`에서 삭제하도록 보강했다. 최종 C2 재검증에서는 baseline 중앙값 2.824초,
candidate 중앙값 2.545초로 9.85% 개선됐고, commit 뒤 첫 publish/retry도
2.633초/1.375초로 통과했다. 이 로컬 비교와 별개로 exact 원격 게시와 retry가 각각
25.2초/10.85초에 성공해 원격 timeout 경로가 실제로 닫혔음을 확인했다.

최신 `origin/main` 기준 rebase와 최종 호환 migration 보완 뒤 변경된 14개 spec을 정상 Next dev server에서 함께 실행한 결과 182건 중 179건이 통과했다. 실패 3건은 이번 diff가 기대값 줄을 건드리지 않은 기존 main-content header 기대값 56px과 현재 구현 44px의 불일치였다. 프리셋·카탈로그·차트·fulfillment 관련 검증은 모두 통과했다. 별도 정상 서버 검증은 차트 초안 라우트 20/20, current-main billing/retry 차트 4/4로 통과했고, 최종 호환 migration spec은 7/7, 독립 resolver·route 재실행은 27/27이었다. 프리셋 구현을 위해 해당 UI 기하나 기존 테스트 기대값을 임의 수정하지 않았다.

빌드는 성공했지만 기존 `next.config.mjs` → PRD viewer import trace가 프로젝트 전체를 NFT trace할 수 있다는 Turbopack 경고 1건은 남아 있다. 이번 프리셋 변경과 무관한 기존 경고다.

### 7.1 독립 보안 재심사

독립 hard-gate 리뷰는 최초 `MUST-FIX`로 live lineage, required-field completeness, preset identity, DB writer permission·backfill audit, synthetic self-promotion 문제를 지적했다. 이를 수정한 뒤 마지막으로 master-update resolver의 canonical permission 우회 가능성까지 추가 발견해 보완했다.

기존 기능 후보의 최종 재심사 결론은 **APPROVE**이며 P0/P1은 0건이다. 첫 524 뒤 승인된 minified 동일 payload 재시도도 완전 rollback됐다. 재배치 전 성능 candidate의 별도 재심사는 exact file SHA 범위에서 **High 0 / Medium 0 / Low 0, LOCAL APPROVE**였고 관련 publisher spec도 독립 재실행에서 24/24 통과했다.

current-main 재배치 뒤 독립 hard gate는 처음에 **High 0 / Medium 2 / Low 1, LOCAL BLOCK**을 냈다. Medium 두 건은 후속 billing/Realtime wrapper가 상담 담당자 서버 정규화를 덮은 문제와 `chart:view` 검사 전에 encounter 존재를 구분할 수 있던 문제였다. Low 한 건은 문서의 이전 후보 상태였다. 최종 호환 migration, rollback-only rehearsal, 7/7 spec과 두 격리 적용 순서 검증으로 보완한 뒤 exact-file 재심사는 **High 0 / Medium 0 / Low 0, LOCAL APPROVE**로 닫혔다. 독립 정적 resolver·route 재실행도 27/27, `git diff --check`도 통과했다. 이후 C1/C2 원격 후보와 rollout packet도 각각 exact-SHA 독립 검토를 통과했고, 특히 최종 rollout packet은 High/Medium/Low `0/0/0` 판정 뒤에만 영속 실행했다.

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
17. canonical payload를 wrapper와 cumulative core가 두 번 정규화하던 문제
18. execution-preset 계약 검증 한 번 안에서 같은 detail schema를 두 번 생성하던 문제
19. current-main의 후속 billing/Realtime migration이 상담 담당자 서버 정규화 wrapper를 덮던 문제
20. DB writer가 `chart:view`를 확인하기 전에 encounter/catalog를 읽어 존재 여부를 구분할 수 있던 문제

각 수정에는 fail-closed 또는 회귀 테스트를 추가했다.

## 9. 변경 범위

- 결정론적 프리셋·계통검사·최종 release compiler 3개
- 동결 fixture와 최종 게시 입력
- generic execution preset foundation, runtime transport, publish/adopt, system exam, publisher, consultation resolver migration 6개
- publisher performance migration과 current-main 상담/billing/Realtime 최종 호환 migration, 두 rollback-only rehearsal과 집중 회귀 spec
- stage-backed set-based publisher migration, local-only ABBA/committed-retry benchmark runner·SQL probe와 강화 rehearsal/spec
- 병원관리 catalog read/write/UI
- 차트 초안 prefill·runtime resolver·확정 snapshot transport
- fulfillment의 `system_exam` queue 차단
- 타입·도메인 계약과 집중 테스트
- 작업 항목, 구현 보고서, 문서 내비게이션

기존 확정 기록과 fulfillment를 바꾸는 DML, Airtable, dependency version은 변경하지 않았다. 승인된 원격 Supabase에는 PR-022 foundation·performance·compatibility와 최종 set-based migration이 적용됐고, release no. 50 게시와 세 대상 workspace adoption·review resolution까지 완료됐다. 과거 timeout 세 건은 모두 완전 rollback 상태로 남고, 이번 성공 release와 workspace 결과만 영속화됐다. `npm ci --ignore-scripts`는 검증용 로컬 `node_modules`만 준비했으며 package manifest/lockfile은 수정하지 않았다.

## 10. 남은 전달 단계와 임상 경계

1. 최신 `origin/main`에 후보를 재배치하고 전체 집중 검증을 다시 통과시킨다.
2. GitHub PR, 고정 staging, production 순서로 애플리케이션 코드를 전달한다.
3. 배포된 인증 화면에서 병원관리 프리셋 확인·수정·사용 중지와 차트 추가 시 자동입력을 smoke한다.
4. 조제 108개의 master revision 2 채택은 임상/profile 재검증 뒤 별도 작업으로 진행한다. 현재 정상 rev1 profile-matched 값을 강제로 덮지 않는다.
5. 모든 합성 프리셋은 계속 `synthetic_unreviewed`, `clinicalUseAllowed=false`로 유지한다. 임상 검증과 true 전환은 이번 범위 밖이다.

## 11. 현재 결론

“마스터에 프리셋 세부값이 있고, 워크스페이스로 함께 복사되며, 병원이 수정·사용 중지하고, 차트 추가 시 자동 입력되고, 확정 후에는 불변으로 남는가?”에 대한 구현과 원격 데이터 답은 **예**다.

대상 synthetic/demo 워크스페이스 세 곳은 522개 catalog 모두에 비어 있지 않은 프리셋을 보유하고, 사용 중지 설정을 보존하며, 차트 검색에서 활성 행 전부가 prefilled detail을 반환한다. 외부 통제 워크스페이스는 변하지 않았다. 다만 “실제 병원에서 임상 승인된 값으로 바로 사용 가능한가?”에 대한 답은 **아니오**다. 이번 목표는 기능과 합성 데이터 transport 구현까지이며, 임상 검토·조제 revision 2 재승인·`clinicalUseAllowed=true` 전환은 별도 단계다.
