import { useMemo, useState } from "react";
import contract from "./report-contract.json";

const STATUS_LABELS = {
  draft: "초안",
  "decision-needed": "결정 필요",
  proposed: "제안",
  approved: "승인",
  implemented: "구현",
  verified: "검증 완료",
  rejected: "반려",
  stale: "오래된 근거",
  "not-applicable": "해당 없음",
  pass: "통과",
  fail: "실패",
  blocked: "차단",
  "not-run": "미실행",
};

const SOURCE_LABELS = {
  "figma-explicit": "Figma 명시",
  "project-existing": "프로젝트 기존",
  "agent-generated": "에이전트 생성",
  "user-approved": "사용자 승인",
};

const TABS = [
  { id: "changes", label: "수정 명세", icon: "document" },
  { id: "system", label: "컴포넌트 · 토큰", icon: "components" },
  { id: "behavior", label: "상태 · 접근성", icon: "states" },
  { id: "prototype", label: "인터랙티브 시안", icon: "prototype" },
  { id: "implementation", label: "구현 · 검증", icon: "check" },
];

function Icon({ name, size = 18 }) {
  const paths = {
    document: (
      <>
        <path d="M6 2.75h7l4 4V21.25H6z" />
        <path d="M13 2.75v4h4M9 12h5M9 16h5" />
      </>
    ),
    components: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <path d="M14 17.5h7M17.5 14v7" />
      </>
    ),
    states: (
      <>
        <path d="M12 3a9 9 0 1 0 9 9" />
        <path d="M12 7v5l3 2M15 3h6v6" />
      </>
    ),
    prototype: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="m10 9 5 3-5 3z" />
      </>
    ),
    check: (
      <>
        <path d="M4 12.5 9 17l11-11" />
      </>
    ),
    figma: (
      <>
        <circle cx="8.5" cy="5.5" r="3" />
        <circle cx="15.5" cy="5.5" r="3" />
        <circle cx="8.5" cy="12" r="3" />
        <circle cx="15.5" cy="12" r="3" />
        <circle cx="8.5" cy="18.5" r="3" />
      </>
    ),
    repo: (
      <>
        <circle cx="6" cy="5" r="2" />
        <circle cx="18" cy="5" r="2" />
        <circle cx="12" cy="19" r="2" />
        <path d="M6 7v2c0 2 1 3 3 3h6c2 0 3-1 3-3V7M12 17v-5" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3 2.8 20h18.4z" />
        <path d="M12 9v5M12 17.5v.1" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />
        <path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z" />
      </>
    ),
    keyboard: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="3" />
        <path d="M6 9h1M10 9h1M14 9h1M18 9h1M6 13h1M10 13h1M14 13h4M7 16h10" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.document}
    </svg>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`status status--${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function SourceBadge({ source }) {
  if (!source) return null;
  return (
    <span className={`source source--${source}`}>
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ReportHeader({ activeTab, onTabChange }) {
  const { figma, repository } = contract.source;
  return (
    <header className="report-header">
      <div className="header-main shell">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          FIGMA → PROJECT CONTRACT
        </div>
        <div className="title-row">
          <div>
            <h1>{contract.report.title}</h1>
            <p>{contract.summary.goal}</p>
          </div>
          <div className="header-status">
            <StatusBadge status={contract.report.status} />
            <span className="mode-badge">
              {contract.report.mode === "report"
                ? "읽기 전용 보고서"
                : "승인된 구현"}
            </span>
          </div>
        </div>

        <div className="source-strip">
          <a
            className="source-card"
            href={figma.url}
            target="_blank"
            rel="noreferrer"
          >
            <span className="source-card__icon source-card__icon--figma">
              <Icon name="figma" />
            </span>
            <span>
              <small>Figma source</small>
              <strong>{figma.nodeName}</strong>
              <em>
                {figma.nodeId} · {figma.viewport.width}×{figma.viewport.height}
              </em>
            </span>
            <Icon name="arrow" size={16} />
          </a>
          <div className="source-card">
            <span className="source-card__icon">
              <Icon name="repo" />
            </span>
            <span>
              <small>Repository source</small>
              <strong>{repository.feature}</strong>
              <em>{repository.revision.slice(0, 12)}</em>
            </span>
          </div>
          <div className="freshness-card">
            <small>근거 시점</small>
            <strong>{formatDate(contract.report.generatedAt)}</strong>
            <span>Figma와 저장소 변경 시 재검토</span>
          </div>
        </div>
      </div>

      <nav className="tab-bar" aria-label="보고서 섹션">
        <div className="shell tab-list" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              className={activeTab === tab.id ? "tab is-active" : "tab"}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon name={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Metric({ value, label, tone = "neutral" }) {
  return (
    <div className={`metric metric--${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function RecordCard({ item, children, className = "" }) {
  return (
    <article className={`record-card ${className}`} data-record-id={item.id}>
      <div className="record-card__top">
        <span className="record-id">{item.id}</span>
        <StatusBadge status={item.status} />
      </div>
      <h3>{item.title ?? item.name}</h3>
      {item.source && <SourceBadge source={item.source} />}
      {children}
    </article>
  );
}

function EvidenceComparison({ figma, project, recommendation }) {
  return (
    <div className="evidence-comparison">
      <div>
        <small>FIGMA</small>
        <p>{figma}</p>
      </div>
      <div>
        <small>PROJECT</small>
        <p>{project}</p>
      </div>
      <div className="recommendation">
        <small>RECOMMENDATION</small>
        <p>{recommendation}</p>
      </div>
    </div>
  );
}

function ChangesPanel() {
  const decisionCount = contract.conflicts.filter(
    (item) => item.status === "decision-needed",
  ).length;
  const approvalCount = contract.implementation.approvalGates.filter(
    (item) => item.status === "decision-needed",
  ).length;
  return (
    <div className="panel-stack">
      <section className="summary-grid">
        <div className="summary-hero">
          <span className="kicker">IMPLEMENTATION READINESS</span>
          <h2>
            시안을 그대로 구현하기 전에
            <br />
            <em>결정할 것부터 분리했어.</em>
          </h2>
          <p>
            Figma 근거와 현재 프로젝트 계약을 같은 항목에서 비교하고, 승인되지
            않은 공유 변경은 구현 범위에 넣지 않아.
          </p>
          <div className="summary-metrics">
            <Metric value={contract.changes.length} label="변경 명세" />
            <Metric value={decisionCount} label="결정 필요" tone="warning" />
            <Metric value={approvalCount} label="승인 게이트" tone="accent" />
          </div>
        </div>
        <aside className="assumption-card">
          <div className="assumption-card__title">
            <Icon name="warning" />
            <h3>가정과 알려진 공백</h3>
          </div>
          <div>
            <small>ASSUMPTIONS</small>
            <ul>
              {contract.summary.assumptions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <small>KNOWN GAPS</small>
            <ul>
              {contract.summary.knownGaps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      <section>
        <SectionHeading
          eyebrow="01 · CHANGE SPEC"
          title="수정 명세"
          description="각 항목은 Figma 근거, 현재 프로젝트 근거, 권고안과 승인 여부를 함께 가진다."
        />
        <div className="record-grid record-grid--two">
          {contract.changes.map((item) => (
            <RecordCard key={item.id} item={item}>
              <EvidenceComparison
                figma={item.figmaEvidence}
                project={item.projectEvidence}
                recommendation={item.recommendation}
              />
              <div className="record-footer">
                <span>{item.type}</span>
                <strong>
                  {item.approvalRequired
                    ? "승인 후 구현"
                    : "승인 없이 보고 가능"}
                </strong>
              </div>
            </RecordCard>
          ))}
        </div>
      </section>

      <section className="decision-section">
        <SectionHeading
          eyebrow="02 · DECISION QUEUE"
          title="충돌과 결정 큐"
          description="Figma와 프로젝트 계약이 동시에 성립하지 않는 항목이야. 권고안은 제안일 뿐, 최종 선택은 사용자 결정으로 남겨둔다."
        />
        <div className="decision-list">
          {contract.conflicts.map((item) => (
            <article
              className="decision-row"
              key={item.id}
              data-record-id={item.id}
            >
              <div className="decision-index">
                <Icon name="warning" />
                <span>{item.id}</span>
              </div>
              <div className="decision-copy">
                <div>
                  <h3>{item.title}</h3>
                  <StatusBadge status={item.status} />
                </div>
                <div className="contract-sides">
                  <p>
                    <small>FIGMA CONTRACT</small>
                    {item.figmaContract}
                  </p>
                  <p>
                    <small>PROJECT CONTRACT</small>
                    {item.projectContract}
                  </p>
                </div>
                <p className="decision-recommendation">
                  <strong>권고</strong>
                  {item.recommendation}
                </p>
                <ol>
                  {item.options.map((option) => (
                    <li key={option}>{option}</li>
                  ))}
                </ol>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function SystemPanel() {
  return (
    <div className="panel-stack">
      <SectionHeading
        eyebrow="03 · OWNERSHIP MAP"
        title="컴포넌트 구조"
        description="시각적 유사성이 아니라 실제 소비자와 의미 경계를 기준으로 shared, feature, local, primitive를 구분한다."
      />
      <div className="component-map">
        {contract.components.map((item) => (
          <RecordCard
            key={item.id}
            item={item}
            className={`component-card component-card--${item.tier}`}
          >
            <div className="component-name">&lt;{item.name} /&gt;</div>
            <dl className="definition-list">
              <div>
                <dt>소유</dt>
                <dd>{item.tier}</dd>
              </div>
              <div>
                <dt>조치</dt>
                <dd>{item.action}</dd>
              </div>
              <div>
                <dt>경로</dt>
                <dd>{item.owner}</dd>
              </div>
            </dl>
            <div className="tag-row">
              {item.states.map((state) => (
                <span key={state}>{state}</span>
              ))}
            </div>
            <p className="consumer-line">
              <strong>소비자</strong> {item.consumers.join(", ")}
            </p>
          </RecordCard>
        ))}
      </div>

      <section>
        <SectionHeading
          eyebrow="04 · TOKEN TRACE"
          title="토큰 매핑"
          description="Figma 변수에서 의미 토큰, 원시 토큰, 로컬 예외 순으로 추적한다. 공용 값 변경은 영향 소비자를 먼저 확인한다."
        />
        <div className="token-table" role="table" aria-label="토큰 매핑">
          <div className="token-row token-row--head" role="row">
            <span>ID</span>
            <span>의미</span>
            <span>Figma</span>
            <span>Project</span>
            <span>조치</span>
            <span>상태</span>
          </div>
          {contract.tokens.map((item) => (
            <div
              className="token-row"
              role="row"
              key={item.id}
              data-record-id={item.id}
            >
              <span className="record-id">{item.id}</span>
              <strong>{item.title}</strong>
              <code>{item.figmaValue}</code>
              <code>{item.projectValue}</code>
              <span>{item.action}</span>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function BehaviorPanel() {
  return (
    <div className="panel-stack">
      <SectionHeading
        eyebrow="05 · STATE MATRIX"
        title="정적 시안 밖의 상태"
        description="Figma에 보이는 상태와 프로젝트가 책임져야 할 상태를 분리하고, 출처가 없는 동작은 생성 제안으로 표시한다."
      />
      <div className="state-matrix">
        {contract.states.map((item) => (
          <RecordCard key={item.id} item={item} className="state-card">
            <p>{item.behavior}</p>
          </RecordCard>
        ))}
      </div>

      <div className="split-section">
        <section>
          <SectionHeading eyebrow="06 · RESPONSIVE" title="반응형 계약" />
          <div className="compact-list">
            {contract.responsive.map((item) => (
              <RecordCard key={item.id} item={item}>
                <p>{item.behavior}</p>
              </RecordCard>
            ))}
          </div>
        </section>
        <section>
          <SectionHeading eyebrow="07 · ACCESSIBILITY" title="접근성 계약" />
          <div className="compact-list">
            {contract.accessibility.map((item) => (
              <RecordCard key={item.id} item={item}>
                <p>{item.requirement}</p>
              </RecordCard>
            ))}
          </div>
        </section>
      </div>

      <section className="motion-section">
        <SectionHeading
          eyebrow="08 · MOTION"
          title="모션 계약"
          description="Figma가 비어 있어도 생성 제안은 허용한다. 단, 출처와 reduced-motion 대체 동작을 반드시 표시한다."
        />
        {contract.motion.map((item) => (
          <article
            className="motion-card"
            key={item.id}
            data-record-id={item.id}
          >
            <div className="motion-visual">
              <span />
              <span />
              <span />
            </div>
            <div className="motion-copy">
              <div>
                <span className="record-id">{item.id}</span>
                <SourceBadge source={item.source} />
                <StatusBadge status={item.status} />
              </div>
              <h3>{item.title}</h3>
              <p>
                {item.trigger} · {item.library} · {item.duration} ·{" "}
                {item.easing}
              </p>
              <small>
                <Icon name="keyboard" size={15} /> Reduced motion:{" "}
                {item.reducedMotion}
              </small>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function PrototypeContent({ scenario, detailOpen }) {
  if (scenario === "loading") {
    return (
      <div className="demo-body skeleton-view" aria-label="불러오는 중">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (scenario === "empty") {
    return (
      <div className="demo-body feedback-view">
        <div className="feedback-icon">＋</div>
        <h4>아직 등록된 항목이 없어</h4>
        <p>새 항목을 추가하면 이 영역에서 확인할 수 있어.</p>
        <button type="button">항목 추가</button>
      </div>
    );
  }
  if (scenario === "error") {
    return (
      <div className="demo-body feedback-view feedback-view--error">
        <div className="feedback-icon">!</div>
        <h4>정보를 불러오지 못했어</h4>
        <p>잠시 후 다시 시도해줘. 입력한 내용은 유지돼.</p>
        <button type="button">다시 시도</button>
      </div>
    );
  }
  return (
    <div className="demo-body">
      <div className="demo-summary">
        <div>
          <small>오늘의 진행률</small>
          <strong>4 / 6</strong>
          <span>필수 항목 2개 남음</span>
        </div>
        <div className="progress-ring">
          <span>67%</span>
        </div>
      </div>
      <div className="demo-grid">
        <section>
          <small>기본 정보</small>
          <h4>샘플 작업 이름</h4>
          <p>실제 서비스 데이터가 아닌 보고서 구조 확인용 합성 예시야.</p>
          <div className="mini-tags">
            <span>진행 중</span>
            <span>담당자 지정</span>
          </div>
        </section>
        <section>
          <small>다음 작업</small>
          <h4>검토 의견 반영</h4>
          <p>충돌 항목의 사용자 결정을 반영한 뒤 구현 범위를 확정해.</p>
          <button type="button">결정 큐 보기</button>
        </section>
      </div>
      <div
        className={detailOpen ? "demo-details is-open" : "demo-details"}
        aria-hidden={!detailOpen}
      >
        <strong>추가 세부 정보</strong>
        <p>
          이 전환은 Figma에 없는 에이전트 생성 모션 예시이며 reduced
          motion에서는 즉시 열린다.
        </p>
      </div>
    </div>
  );
}

function PrototypePanel() {
  const [scenario, setScenario] = useState("default");
  const [viewport, setViewport] = useState("source");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const scenarios = [
    ["default", "기본"],
    ["loading", "로딩"],
    ["empty", "빈 상태"],
    ["error", "오류"],
  ];
  return (
    <div className="panel-stack">
      <SectionHeading
        eyebrow="09 · INTERACTIVE SPECIMEN"
        title="인터랙티브 시안"
        description="대상 프레임을 먼저 확인하고, 생성된 상태와 모션은 별도 컨트롤로 비교한다."
      />
      <div className="prototype-toolbar" aria-label="시안 설정">
        <div>
          <small>시나리오</small>
          <div className="segmented">
            {scenarios.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={scenario === id ? "is-active" : ""}
                onClick={() => {
                  setScenario(id);
                  setDetailOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <small>뷰포트</small>
          <div className="segmented">
            <button
              type="button"
              className={viewport === "source" ? "is-active" : ""}
              onClick={() => setViewport("source")}
            >
              Figma 원본
            </button>
            <button
              type="button"
              className={viewport === "narrow" ? "is-active" : ""}
              onClick={() => setViewport("narrow")}
            >
              좁은 화면
            </button>
          </div>
        </div>
        <label className="motion-toggle">
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(event) => setReducedMotion(event.target.checked)}
          />
          <span />
          <em>Reduced motion</em>
        </label>
      </div>

      <div
        className={`prototype-stage prototype-stage--${viewport} ${reducedMotion ? "is-reduced" : ""}`}
      >
        <div className="prototype-measure">
          <span>
            {viewport === "source"
              ? `${contract.source.figma.viewport.width} × ${contract.source.figma.viewport.height}`
              : "390 × 844"}
          </span>
          <em>미리보기 배율로 표시</em>
        </div>
        <div className="demo-app">
          <aside className="demo-rail">
            <div className="demo-logo">C</div>
            {[0, 1, 2, 3].map((item) => (
              <span key={item} className={item === 1 ? "is-active" : ""} />
            ))}
          </aside>
          <main>
            <header className="demo-header">
              <div>
                <small>샘플 기능</small>
                <h3>작업 상세</h3>
              </div>
              <div>
                <button type="button" className="ghost-button">
                  공유
                </button>
                <button type="button">저장</button>
              </div>
            </header>
            <PrototypeContent scenario={scenario} detailOpen={detailOpen} />
            {scenario === "default" && (
              <footer className="demo-footer">
                <span>
                  <SourceBadge source="agent-generated" />
                  상세 영역 전환
                </span>
                <button
                  type="button"
                  aria-expanded={detailOpen}
                  onClick={() => setDetailOpen((value) => !value)}
                >
                  {detailOpen ? "상세 닫기" : "상세 보기"}
                </button>
              </footer>
            )}
          </main>
        </div>
      </div>
      <div className="prototype-legend">
        <SourceBadge source="figma-explicit" />
        <span>프레임 근거</span>
        <SourceBadge source="project-existing" />
        <span>기존 계약</span>
        <SourceBadge source="agent-generated" />
        <span>생성 제안</span>
      </div>
    </div>
  );
}

function ImplementationPanel() {
  const verificationSummary = useMemo(() => {
    return contract.verification.checks.reduce(
      (result, item) => ({
        ...result,
        [item.result]: (result[item.result] ?? 0) + 1,
      }),
      {},
    );
  }, []);
  return (
    <div className="panel-stack">
      <SectionHeading
        eyebrow="10 · APPROVAL GATES"
        title="승인이 필요한 변경"
        description="보고서 생성은 읽기 전용이지만, 공용 계약과 실제 코드 변경은 항목 단위 승인을 받아야 한다."
      />
      <div className="approval-list">
        {contract.implementation.approvalGates.map((item) => (
          <RecordCard key={item.id} item={item} className="approval-card">
            <p>{item.reason}</p>
            <div className="tag-row">
              {item.affected.map((affected) => (
                <span key={affected}>{affected}</span>
              ))}
            </div>
          </RecordCard>
        ))}
      </div>

      <section>
        <SectionHeading
          eyebrow="11 · IMPLEMENTATION SLICES"
          title="구현 단위"
          description="승인 범위를 파일과 의존성 단위로 나눠서, 한 항목의 승인이 주변 변경으로 번지지 않게 한다."
        />
        <div className="slice-list">
          {contract.implementation.slices.map((item, index) => (
            <article
              className="slice-row"
              key={item.id}
              data-record-id={item.id}
            >
              <span className="slice-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <span className="record-id">{item.id}</span>
                <h3>{item.title}</h3>
                <code>{item.files.join(" · ")}</code>
                {item.dependsOn.length > 0 && (
                  <p>선행 결정: {item.dependsOn.join(", ")}</p>
                )}
              </div>
              <StatusBadge status={item.status} />
            </article>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="12 · VERIFICATION"
          title="검증 현황"
          action={
            <div className="verification-total">
              <strong>{verificationSummary.pass ?? 0}</strong>
              <span>통과 / {contract.verification.checks.length}</span>
            </div>
          }
        />
        <div className="verification-table">
          {contract.verification.checks.map((item) => (
            <article key={item.id} data-record-id={item.id}>
              <span
                className={`check-indicator check-indicator--${item.result}`}
              >
                {item.result === "pass" ? "✓" : "·"}
              </span>
              <div>
                <span className="record-id">{item.id}</span>
                <h3>{item.name}</h3>
                <code>{item.command}</code>
                <p>{item.evidence}</p>
              </div>
              <StatusBadge status={item.result} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState("changes");
  const panels = {
    changes: <ChangesPanel />,
    system: <SystemPanel />,
    behavior: <BehaviorPanel />,
    prototype: <PrototypePanel />,
    implementation: <ImplementationPanel />,
  };
  return (
    <div className="report-app">
      <ReportHeader activeTab={activeTab} onTabChange={setActiveTab} />
      <main
        className="shell report-main"
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex="0"
      >
        {panels[activeTab]}
      </main>
      <footer className="report-footer shell">
        <span>
          Figma Implementation Report · schema {contract.schemaVersion}
        </span>
        <span>Machine-readable contract embedded in this HTML</span>
      </footer>
    </div>
  );
}
