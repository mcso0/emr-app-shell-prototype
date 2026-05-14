# Symphony 사용 가이드

이 가이드는 `emr-app-shell-prototype`에서 Linear 이슈를 Codex/Symphony로 실행하는 운영 절차를 정리한다.

## 기본 개념

- Linear는 작업 지시/상태 관리 화면이다.
- Symphony는 Linear에서 `Ready` 상태인 이슈를 감지한다.
- Symphony는 이슈별 isolated workspace를 만들고 `codex app-server`를 실행한다.
- Codex는 이슈 범위 안에서 작업한 뒤 `Human Review`로 넘긴다.
- 사람은 결과를 보고 `Done` 또는 `Rework`로 결정한다.

## 최초 1회 준비

Linear Personal API key를 만든 뒤 macOS Keychain에 저장한다. 키는 repo에 저장하지 않는다.

```bash
ops/symphony/run-local.sh --save-key
```

프롬프트가 나오면 `lin_api_...`로 시작하는 키 전체를 붙여넣고 Enter를 누른다. 화면에 키가 보이지 않는 것이 정상이다.

키를 잘못 저장했거나 교체해야 하면:

```bash
ops/symphony/run-local.sh --forget-key
ops/symphony/run-local.sh --save-key
```

## 평소 실행

일반 workflow:

```bash
ops/symphony/run-local.sh
```

대시보드:

```text
http://127.0.0.1:4040/
```

보안/CSO 전용 workflow:

```bash
ops/symphony/run-local.sh --security
```

다른 포트를 쓰려면:

```bash
ops/symphony/run-local.sh --port 4041
```

## Linear 운영 루프

1. 이슈를 한국어로 작성한다.
2. 상태명, 라벨명, 파일 경로, 명령어는 원문을 유지한다.
3. 한 번에 하나의 이슈만 `Ready`로 둔다.
4. Symphony 터미널을 켜둔다.
5. 이슈가 `Human Review`로 이동할 때까지 기다린다.
6. 결과를 확인한다.
7. 승인하면 `Done`으로 이동한다.
8. 수정이 필요하면 `Rework`로 이동하고 한국어로 수정 요청 댓글을 남긴다.
9. 다음 이슈를 `Ready`로 이동한다.

## 상태 의미

| 상태 | 의미 | Symphony 동작 |
|---|---|---|
| `Backlog` | 아직 진행하지 않을 아이디어 | 잡지 않음 |
| `Todo` | 준비 전 또는 대기 | 잡지 않음 |
| `Ready` | 에이전트가 잡아도 되는 작업 | 일반 workflow가 잡음 |
| `In Progress` | 진행 중 | 일반 workflow가 이어서 처리 가능 |
| `Human Review` | 사람이 검토할 차례 | 잡지 않음 |
| `Rework` | 수정 요청 | 일반 workflow가 다시 잡음 |
| `Security Review` | 보안 검토 | security workflow만 사용 |
| `Blocked` | 외부 결정/자료 대기 | 잡지 않음 |
| `Done` | 완료 | terminal |
| `Canceled` | 하지 않기로 함 | terminal |

## 이슈 작성 포맷

```md
## 목표

완료해야 하는 결과를 한 문장으로 적는다.

## 배경

- 읽어야 할 문서:
- 관련 파일:
- 관련 work item:
- 주의할 제약:

## 작업 범위

- 포함할 작업 1
- 포함할 작업 2

## 제외 범위

- 이번 이슈에서 하지 않을 작업
- 자동 merge/deploy 여부
- 보안/DB 관련 제외 조건

## 완료 기준

- 사용자 또는 문서 관점의 결과
- 필요한 검증 결과
- `Human Review` handoff

## 검증 방법

```bash
npm run docs:check
```

## 최종 보고에 포함할 내용

- 변경 내용
- 변경 파일
- 검증 결과
- 남은 리스크 또는 blocker
- `Human Review` 준비 여부
```

## 추천 파일럿 순서

1. `DEN-7`: docs closeout dry run, 완료
2. `DEN-8`: QA report dry run
3. `DEN-9`: CSO auth boundary review

`DEN-9`는 일반 workflow가 아니라 `ops/symphony/run-local.sh --security`로 실행한다.

## 주의사항

- API key를 채팅, Linear 댓글, repo 파일에 붙여넣지 않는다.
- Symphony 터미널을 끄면 실행 중인 감시는 멈춘다.
- 첫 pilot 동안은 `agent.max_concurrent_agents: 1`을 유지한다.
- live Supabase migration, RLS, server enforcement, production deploy는 명시적으로 scope 되기 전까지 하지 않는다.
- 보안 이슈는 `team:security`, `type:security-audit`, `cso` 라벨을 쓰고 security workflow로 분리한다.
