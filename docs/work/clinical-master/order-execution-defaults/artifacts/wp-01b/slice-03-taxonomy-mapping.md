# WP-01B Slice 03 — Frozen 522 taxonomy mapping handoff

Date: 2026-09-06. Status: offline mapping complete; non-applied.
This is not application readiness, clinical-default completeness or full WP-01B completion.

## Scope and acceptance

| Goal | Verified output |
| --- | --- |
| Complete frozen target mapping | 522 unique stable keys and actual master UUID/revision pairs; no unresolved taxonomy decisions |
| Explicit vocabulary | 25 used subcategories (10 new); 18 used lab families (12 new); no catchall assignment |
| Traceable source | Per-row evidence pointers and SHA-256; frozen and freshly observed paths both retained |
| Separate workspace reconciliation | 13 Cheongdam legacy rows, one already master-linked; no name join or proposed delete |
| No clinical or remote mutation | Proposed payload contains only two taxonomy fields; all application/runtime-import flags false |

## Authoritative artifacts

- [Full mapping](./taxonomy-mapping.non-applied.v1.json)
- [Vocabulary and allowed-type matrix](./taxonomy-vocabulary-proposal.v1.json)
- [Vocabulary additions and semantic cautions](./taxonomy-gap-list.v1.json)
- [Read-only identity/revision/path snapshot](./taxonomy-identity.read-only.v1.json)
- [Separate workspace reconciliation](./taxonomy-workspace-reconciliation.non-applied.v1.json)
- [Human HTML report](../../../../../completed/clinical-master/2026-09-06-wp-01b-taxonomy-mapping-report.html)
- [Target design](./slice-03-taxonomy-design.md)

## Evidence boundaries and decisions

Fresh read-only staging queries on 2026-09-06 resolved all 522 immutable identities,
current revisions and paths. They did not re-query clinical type: the preserved
clinical type is explicitly the frozen source value. Twelve system-exam paths
have diverged from the frozen source; both paths are retained, not overwritten.
A new before-image/type/source-projection/customization read is mandatory before
any future application. No DB write, app-source edit, migration, deployment or
live patient/guardian query was performed in this mapping task.

The 86 lab rows use exact reviewed IDs and a deliberate research-purpose to
browsing-family translation. Legacy metabolic is broad synthetic in-house-blood,
not invented CBC/chemistry composition. Existing composite/panel limitations
remain OED-LAB-04 work. The 159 dispensing rows use 108 documented product/profile
routes, 47 saved synthetic preset routes, and four explicit synthetic scope
choices. These are not clinically approved new defaults. Remaining 277 rows use
explicit reviewed ID groups and authored service scope, never runtime matching.

CT interpretation is not CT acquisition. Dental radiography retains its treatment
type; vaccine-named consultation rows and emergency-service other-type rows retain
their existing semantics. These limitations are visible in per-row notes and gaps.
Existing unused UI vocabulary is not deleted or declared unsupported by this
522-only proposal. No clinical-review-pending lifecycle is introduced.

## Reproduce and verify

Run from repository root:

```sh
node scripts/generate-wp01b-taxonomy-mapping.mjs
node scripts/generate-wp01b-taxonomy-mapping.mjs --check
node --test tests/wp01b-taxonomy-mapping.test.mjs
node scripts/render-wp01b-taxonomy-report.mjs
```

Focused mapping suite: 33 tests passed, covering identity, exact-set, duplicate,
revision, path/type preservation, allowed field/pair validation, source drift,
product/profile conflict, missing route and no input mutation. Read-only lab86
and dispensing159 peer checks found no mapping defects. These tests validate the
offline package, not DB constraints, deployed pages or completed clinical values.
Three automated report tests also pass (36 total including mapping): deterministic
522-row rendering, nine anchor/file links and escaping of untrusted order names.
Report checks passed: all 522 rows rendered, nine anchor/file links resolve;
Playwright verified the 86-row lab filter, single platelet-name match, zero-result
state, reset to 522 and next-step navigation. Screenshots inspected at 1440x1000
and 390x844; mobile document width equals 390 (table has its own horizontal scroll).
Only a local static-server favicon 404 occurred; no report script error observed.
`git diff --check` passed. `npm run docs:check` still fails on the two pre-existing
persona-guide references in the old workspace summary and Slice 01 record; this
task introduced no additional broken reference. No app build or authenticated
EMR browser acceptance is claimed for this offline artifact task.

## Next bounded implementation (not started)

1. Inspect actual publisher/adopter contracts; locally add the two nullable taxonomy
   fields to master/workspace storage, serialization, projection and API validation.
2. Include only the required WP-02 two-field baseline/override/clear/conflict merge
   subset. Preserve other clinical fields, permissions, routing, prices and history.
3. Rollback-test modified, cleared, detached, stale, conflicting, retry and foreign
   workspace cases. No inherited-on-read fallback and no half-applied invalid pair.
4. Re-query target before-images and define the scoped remote apply/deploy/rollback
   packet; this mapping file is NOT an authorized SQL input or remote release.
5. Verify authenticated Admin table/detail/save/reopen/category-wide views and
   chart candidate identities before Slice 03 exit and Slice 04 reconciliation.

Korean copy: humanize-korean fast run 2026-09-06-009; manual review, grade B;
bundled metrics script missing, no numerical score claimed.

## 한국어 보고서 본문

# 마스터 오더 522개 분류표

2026-09-06 · WP-01B Slice 03 · 비적용 후보

## 이번에 끝낸 일

522개 마스터 오더가 병원관리의 어느 분류에 보여야 하는지 정리했다. 모든 행에 실제 마스터 ID와 현재 버전, 기존 분류 경로, 제안 분류, 근거를 기록했다. 원격 DB는 읽기만 했으며 데이터 적용이나 배포는 하지 않았다.

검사 86개, 조제 159개뿐 아니라 진료·영상·처치·입원·계통검사·기타까지 포함했다. 빠진 오더와 중복은 없고 미결정 분류도 없다. 기존 화면 목록에 없는 세부 분류 10개와 검사군 12개는 새 코드로 제안했다.

## 분류를 정한 기준

조제 108개는 제품 자료에 기록된 투여 경로를, 합성 조제 47개는 저장된 기본값의 경로를 사용했다. 경로가 없던 4개는 외용·주사제 조제·1회 포장·다회 포장이라는 업무 범위를 보고 프로토타입 분류를 명시적으로 작성했다. 이 4개에 약물이나 용량, 투여 경로를 새로 채우지는 않았다.

검사는 앞서 조사한 목적별 분류를 화면 탐색용 검사군으로 연결했다. CBC·혈액화학 외에도 응고·혈액형·혈액도말·췌장·염증·감염병 등을 구분했다. 연구 분류와 화면 분류는 각각 기록했다. 검사 세트 구성과 장비별 정상범위를 이 분류에서 추론하지 않는다.

나머지 오더는 기존에 작성된 업무 범위에 맞춰 분류했다. 이름이 바뀌면 자동으로 분류가 바뀌는 방식이 아니다. 이 파일은 오프라인 작성 결과이며 앱에서 불러와 빈 데이터를 채우는 fallback으로 사용하지 않는다.

## 주의해서 나눈 항목

- CT 영상자료 판독 상담은 촬영이 아니라 영상 판독 상담으로 분류했다.
- 외용·점안·점이·경피·구강점막·조제 포장은 경구나 주사로 몰아넣지 않았다.
- 전악·부분 치과 방사선 검사는 기존 임상 유형이 처치다. 이번에는 치과 분류만 제안했고 업무 전달 경로를 고치지는 않았다.
- 예방접종이라는 이름의 일부 오더는 기존 임상 유형이 진료다. 응급 서비스 24개도 기존 유형이 기타다. 분류표가 이 업무 구조까지 해결한 것은 아니다.
- 합성 기초 혈액검사는 세부 항목이 연결되지 않았다. 넓은 원내 혈액 검사 분류만 작성했으며 CBC나 혈액화학 구성이라고 단정하지 않았다.
- 종합 검사 분류는 검사 세트가 이미 연결됐다는 증거가 아니다. 신장 평가와 다뇨·다음 평가처럼 같은 패널을 쓰더라도 주된 탐색 분류는 다를 수 있다.

## 별도로 남긴 데이터 문제

청담점 병원관리의 기존 미분류 13행은 522개와 섞지 않고 별도 목록으로 기록했다. 1행은 이미 마스터에 연결되어 있고 12행은 연결되어 있지 않다. 이름으로 연결하거나 삭제하는 작업은 하지 않았다.

계통검사 12개는 동결 문서의 경로와 현재 DB 경로가 달랐다. 양쪽 값을 모두 기록했다. 적용 전에는 ID·버전·경로뿐 아니라 임상 유형과 병원 수정값도 다시 읽어야 한다. 이번 원격 조회는 ID·버전·경로 확인에 한정했다.

## 아직 완료되지 않은 일

분류 제안 522개가 준비된 것이지, 전체 마스터 오더의 임상 기본값이 완성된 것은 아니다. 용량·계산값·장비·정상범위·검사 세트·세부 항목은 별도 작업이다. 검수 대기 상태를 추가하거나 오더의 사용 가능 상태를 바꾸지 않았다.

앱 화면, DB 스키마, 원격 오더, 워크스페이스 값은 이번 작업에서 바뀌지 않았다. 사용자가 볼 화면의 완료 검증도 배포 후 별도로 필요하다.

## 다음 작업

다음은 분류를 실제로 저장하고 전달하는 구조를 로컬에서 구현하는 단계다. 마스터와 병원 오더에 세부 분류와 검사군 두 필드를 추가하고 발행·복사·API·수정 검증을 연결한다. 병원이 수정한 두 필드를 보존하는 상속 처리만 함께 구현한다. 전체 기본값 상속 작업을 한꺼번에 진행하지 않는다.

그다음 병원 수정값·명시적 비우기·충돌·재시도·다른 워크스페이스 보호를 검증한다. 이 검증과 적용 전 재조회, 복구 시험이 끝난 뒤 원격 적용과 배포 범위를 정한다. 마지막으로 병원관리 목록·상세·저장 후 재조회·차트 검색이 같은 저장값을 쓰는지 확인한다.
