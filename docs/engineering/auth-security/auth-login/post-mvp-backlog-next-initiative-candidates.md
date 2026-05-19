---
title: "Post-MVP Backlog And Next Initiative Candidates"
status: "human_review"
updated: "2026-05-20"
source:
  - "DEN-93"
  - "docs/work/audit-security/AUDIT-SECURITY-PR-012-post-mvp-backlog-next-initiative-candidates.md"
---

# Post-MVP Backlog And Next Initiative Candidates

Linear: DEN-93
Project: `05 Audit, Security & MVP Readiness`
Initiative: `CLAiR EMR 제품 MVP 라이브 전환`

## 한 줄 결론

남은 일은 **파일럿 전 안전 게이트**, **파일럿 운영 보강**, **Post-MVP 제품 확장**, **다음 Initiative 후보**로 나누는 것이 맞다.

모든 일을 현재 live transition initiative 안에 계속 넣으면 방향이 흐려진다. 먼저 파일럿 안전 게이트를 닫고, 그 다음 실제 병원 운영에서 돈이 되는 확장 축을 고르는 순서가 좋다.

## 분류 원칙

| 분류 | 의미 | 예시 |
| --- | --- | --- |
| Pilot Gate | remote/live pilot 전에 닫거나 대표가 명시적으로 받아들여야 하는 항목 | RLS validation, audit completeness, production secrets/data handling |
| Pilot Follow-Up | local-first 대표 리뷰는 가능하지만 pilot 품질을 높이는 항목 | role label 정리, denial copy, reset checklist |
| Post-MVP Backlog | 파일럿 판단 뒤에 제품력을 넓히는 항목 | provider integrations, downstream persistence, compliance expansion |
| Next Initiative Candidate | 여러 issue를 묶어 별도 전략 단위로 볼 만한 항목 | Live Safety Closure, Provider Integration, Operations Intelligence |

## Pilot Gate

| Candidate | Why it matters | Suggested handling |
| --- | --- | --- |
| Clinical/billing RLS validation | Remote/live workspace data leakage risk를 줄인다. | Pilot 전 최우선 gate. Local replay/advisor-style evidence를 남긴다. |
| DEN-88 audit completeness gap | Audit claim과 실제 mutation event emission이 맞아야 한다. | Resolve or explicit human acceptance. |
| Production environment/secrets/data handling approval | 실데이터와 service role/password 노출 위험을 막는다. | Separate security approval before remote/live. |

## Pilot Follow-Up

| Candidate | Why it matters | Suggested priority |
| --- | --- | --- |
| Canonical role label cleanup | `hospital_admin`, `vet`, `technician`, `front_desk` 기준을 대표 설명과 화면에서 맞춘다. | High |
| Korean denial copy pass | 권한 차단을 운영자가 이해하기 쉽게 만든다. | High |
| Pilot runbook and reset checklist | 대표/세일즈/QA가 같은 Kong scenario를 반복 실행할 수 있다. | High |
| Tiptap duplicate extension warning cleanup | 차트 QA 로그를 깨끗하게 만든다. | Medium |
| Broad Playwright Node listener warning cleanup | 긴 QA 실행 로그를 더 믿기 쉽게 만든다. | Medium |

## Post-MVP Backlog Groups

### 1. Downstream Clinical Persistence

Scope:

- Lab result persistence.
- Imaging read/report persistence.
- Dispensing and treatment execution persistence.
- Inpatient live persistence.

Why:

- Project 04 made chart/order/billing coherent. A real clinic pilot will soon ask whether downstream departments also survive reload and handoff.

### 2. Provider Integrations

Scope:

- KakaoTalk message provider.
- PACS/device and lab equipment intake.
- Payment provider and PG settlement.
- Email/document delivery.
- Accounting export.

Why:

- These unlock operational value, but each adds vendor reliability, privacy, and support risk.

### 3. Compliance And Audit Expansion

Scope:

- Audit export.
- Retention policy UI.
- Compliance dashboard.
- External log sink.
- Repeated denial/security monitoring.

Why:

- MVP audit is enough for basic review, not yet full compliance operations.

### 4. Operations Intelligence

Scope:

- SLA and bottleneck analytics.
- Queue load and staff utilization.
- Revenue leakage and billing quality reports.
- Pilot KPI dashboard.

Why:

- Helps the representative decide where the product creates management value, not just screen coverage.

### 5. AI Safety And Assisted Workflow

Scope:

- AI-assisted summary drafts.
- Guardrails for synthetic vs real clinical content.
- Human review checkpoints.
- Prompt/data retention policy.

Why:

- AI can add value later, but it should not enter the live pilot until core data boundaries and safety language are stable.

### 6. Data Migration And Demo Operations

Scope:

- Real clinic import tooling.
- Synthetic scenario reset automation.
- Demo dataset versioning.
- Training/pilot seed pack.

Why:

- A pilot needs repeatability first; real migration should wait until scope and risk are accepted.

## Next Initiative Candidates

| Candidate initiative | Goal | First milestone | Priority |
| --- | --- | --- | --- |
| Live Safety Closure | Close remote/live pilot gates without expanding product scope. | RLS replay + audit completeness + env/secrets approval. | 1 |
| Pilot Operations Kit | Make representative demos and first pilot rehearsals repeatable. | Runbook, reset checklist, role label cleanup, denial copy. | 2 |
| Downstream Department Persistence | Extend the live spine beyond chart/order/billing. | Lab/imaging persistence first, then dispensing/treatment. | 3 |
| Provider Integration Readiness | Prepare vendor integration without production rollout surprise. | Provider risk matrix, sandbox contracts, support plan. | 4 |
| Operations Intelligence | Convert workflow data into management insight. | Pilot KPI dashboard and bottleneck reports. | 5 |
| Compliance And Audit Plus | Move from MVP audit review to compliance operations. | Export, retention, external log sink plan. | 6 |
| AI Safety Workbench | Explore assisted workflow with explicit safety gates. | Non-clinical summary drafts and guardrail policy. | 7 |

## Recommended Sequencing

1. Close `Live Safety Closure` before any remote/live pilot.
2. Do `Pilot Operations Kit` before stakeholder-facing repeat demos.
3. Pick either `Downstream Department Persistence` or `Provider Integration Readiness` based on the first pilot hospital's strongest pain.
4. Add `Operations Intelligence` once pilot workflow data is stable.
5. Defer `Compliance And Audit Plus` and `AI Safety Workbench` until pilot learnings clarify the actual buyer pressure.

## Linear Backlog Candidate Titles

These are candidates, not newly started work:

- `Live Safety Closure: clinical/billing RLS replay and advisor review`
- `Live Safety Closure: close DEN-88 audit completeness gap`
- `Pilot Operations Kit: canonical role labels and Korean denial copy`
- `Pilot Operations Kit: repeatable Kong scenario reset checklist`
- `Downstream Persistence: lab and imaging reload-backed state`
- `Downstream Persistence: dispensing and treatment execution state`
- `Provider Readiness: KakaoTalk, PACS/device, PG risk matrix`
- `Operations Intelligence: pilot KPI and bottleneck dashboard`
- `Compliance Plus: audit export and retention policy`
- `AI Safety Workbench: non-clinical assisted summary guardrails`

## Verification

- `npm run docs:check`
- `npm run security:secrets`
