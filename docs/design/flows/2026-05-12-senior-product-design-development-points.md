---
status: "draft"
area: "design"
doc_type: "flow"
created: "2026-05-12"
source_docs:
  - "docs/agent-start-here.md"
  - "docs/engineering/current-status.md"
  - "docs/design/system/DESIGN.md"
  - "docs/design/qa/2026-05-10-ui-consistency-audit.md"
  - "docs/product/prd/clair-emr-saas-prd.md"
  - "docs/product/features/home/home-v1-epic-plan.md"
related_work: []
updated: "2026-05-12"
---

# Senior Product Design Development Points

This note captures a research-backed design direction for evolving CLAiR EMR from a broad session-only MVP prototype into a sharper operational product experience.

It is not an implementation work item. Use it as design input when shaping future Home, workflow, chart, reception, billing, and design-system PRs.

## Executive Direction

CLAiR EMR is past the point where the highest-value design work is simply adding more screens. The prototype already demonstrates the broad outpatient path from `접수/예약` through `수납`. The next product-design opportunity is to make the system better at helping each role answer three operational questions:

- What is the safest next action?
- What context proves this action is ready?
- What downstream work is blocked if this action is delayed or wrong?

The product should evolve from "an EMR with many useful workspaces" into "an operational system that helps the hospital finish today's care safely, continuously, and with less memory work."

## Research Inputs

The direction draws from established product-design methods:

- IDEO design thinking: balance human desirability, technical feasibility, and business viability.
- Nielsen Norman Group UX mapping: use empathy maps, customer journey maps, experience maps, and service blueprints to understand user goals and handoffs.
- Nielsen Norman Group usability heuristics: prioritize real-world language, user control, consistency, and error prevention.
- Figma design critique practice: use critique to unblock problems, raise quality, improve consistency, and share context, not to make roadmap decisions.
- Atlassian / Marty Cagan product discovery framing: validate value, usability, feasibility, and strategic fit before committing to build.
- Intercom Jobs-to-be-Done: study the real job and the workaround behavior, not only direct feature requests.
- Teresa Torres Opportunity Solution Tree: connect desired outcomes to opportunities, solutions, and assumption tests.
- Julie Zhuo product-design framing: start with the people problem, evidence that it is real, and the success signal that proves the solution worked.
- Airbnb storyboarding: map the real-world end-to-end experience frame by frame, then improve each product, policy, support, and communication touchpoint.
- Ryan Singer / Shape Up: combine problem, appetite, solution outline, risks, and no-gos before committing delivery time.
- Linear Method: keep specs brief, scope issues small, mix feature and quality work, and measure progress through actual design/code diff.
- Google Ventures design sprint practice: reduce broad uncertainty into a few critical moments, prototype them with enough realism, then test with likely users.
- Healthcare/EHR safety research: treat information overload, workflow mismatch, unclear state, and error-prone data entry as patient-safety and staff-trust risks.

Reference links:

- https://designthinking.ideo.com/
- https://www.nngroup.com/articles/ux-mapping-cheat-sheet/
- https://www.nngroup.com/articles/ten-usability-heuristics/
- https://www.figma.com/blog/design-critiques-at-figma/
- https://www.atlassian.com/agile/product-management/discovery
- https://www.intercom.com/resources/books/intercom-jobs-to-be-done
- https://www.producttalk.org/opportunity-solution-tree/
- https://www.producttalk.org/roles-in-a-product-trio/
- https://www.intercom.com/blog/accidentally-invented-job-stories/
- https://www.intercom.com/blog/how-we-design-at-intercom/
- https://www.intercom.com/blog/intercom-product-principles/
- https://www.nngroup.com/articles/customer-journey-mapping/
- https://www.nngroup.com/articles/service-blueprints-definition/
- https://stvp.stanford.edu/av/how-facebook-designer-thinks-entire-talk
- https://future.com/product-thinking/
- https://techcrunch.com/2012/07/18/airbnb-brian-chesky-snow-white/
- https://techcrunch.com/2017/08/07/airbnbs-director-of-experience-design-on-using-stories-to-design/
- https://basecamp.com/shapeup/1.1-chapter-02
- https://linear.app/method/introduction
- https://designsprintkit.withgoogle.com/
- https://www.gv.com/news/learn-more-faster
- https://www.svpg.com/four-big-risks/
- https://www.producttalk.org/glossary-discovery-continuous-discovery/
- https://psnet.ahrq.gov/primer/electronic-health-records
- https://www.nature.com/articles/s41746-025-02243-4
- https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2729805
- https://www.nist.gov/publications/technical-basis-user-interface-design-health-it

## Current Product Reading

CLAiR EMR already covers the outpatient span from reception through billing in a session-only prototype. The next design challenge is less about adding isolated features and more about making hospital staff decisions faster, safer, and more continuous across roles.

Senior product designers would likely frame the core problem this way:

- Can front desk, veterinarians, nurses, billing staff, and hospital managers decide the next action within seconds?
- Does patient, guardian, encounter, order, and invoice context survive screen transitions?
- Are risky actions prevented or clearly reversible?
- Can the mock workflow later map cleanly to live DB/API, role permissions, audit logs, and service catalog boundaries?
- Do repeated tables, panels, buttons, and status signals read as one product language?

## Senior Designer Reasoning Model

Senior product designers would likely avoid starting with "what screen should we add next?" They would first narrow the product problem into a few answerable questions:

1. People problem: which role is under the most time pressure, uncertainty, or handoff risk?
2. Evidence: what behavior proves the problem is real, such as repeated calls, paper notes, duplicate checks, delayed billing, or missed result follow-up?
3. Critical moment: where does the user decide, "I know what to do next" or "I am not sure this is safe"?
4. System boundary: what can be solved in the session-only prototype now, and what must wait for live DB/API, audit, permissions, or RLS?
5. Success signal: what measurable behavior should improve after the design change?

For CLAiR, the strongest answer is likely not a single module. It is the cross-role moment where a patient visit changes ownership: front desk to vet, vet to lab/imaging/nurse, clinical work back to chart, and chart/order context into billing.

## Senior Method Translation

If this were handled by a senior product designer in a mature overseas product org, the work would likely be translated this way:

### Julie Zhuo Lens: Product Thinking Before Interface Thinking

Identify the few decisions that make the product more useful and trusted, not just more complete.

Applied questions:

- Which decisions reduce mental load during a busy outpatient day?
- Which decisions preserve patient, guardian, encounter, order, result, and invoice continuity?
- Which decisions make next action obvious without hiding clinical responsibility?
- Which decisions could cause staff to bypass CLAiR and return to paper, KakaoTalk, verbal handoffs, spreadsheets, or old EMR habits?

CLAiR framing:

> What specific product decisions make each role believe the system knows what needs attention now?

### Intercom / Jobs-to-Be-Done Lens: Study The Workaround

Study the workaround that staff "hire" when CLAiR does not yet support the job.

| Role | Surface job | Deeper job to be done |
|---|---|---|
| Front desk | Register patient / check in | Start the visit without duplicate identity, missing guardian context, or queue confusion. |
| Veterinarian | Write chart / place orders | Make a defensible clinical decision with enough history, evidence, and downstream clarity. |
| Nurse / technician | Execute orders | Know exactly what to do, for whom, by when, and what proves completion. |
| Lab / imaging staff | Enter or attach results | Return evidence to the responsible clinician without losing review state. |
| Billing staff | Take payment | Convert completed clinical work into an accurate, explainable invoice. |
| Hospital manager | Monitor operations | Detect bottlenecks and risk without becoming a passive KPI dashboard. |

The research target is not a generic feature request. It is the moment when staff leave the EMR, write on paper, ask verbally, message someone, or keep state in memory.

### Airbnb Lens: Storyboard The Hospital Day

Map the real-world experience as frames, not pages:

1. Guardian calls or walks in.
2. Desk identifies guardian/patient and creates the encounter.
3. Patient waits, is assigned, or remains unassigned.
4. Veterinarian opens chart and reviews history.
5. SOAP, diagnosis, and orders are created.
6. Nurse, lab, imaging, or dispensing work is executed.
7. Results return to chart and require review.
8. Billing prepares invoice lines and explains cost.
9. Guardian leaves with instructions, documents, and follow-up expectations.
10. Hospital later reviews unresolved work, unpaid cases, or follow-up needs.

Each frame should identify user goal, pressure level, required context, hidden back-office work, likely failure mode, product touchpoint, and non-product touchpoint.

### Teresa Torres Lens: Map Outcome To Assumption Tests

Connect desired outcomes to opportunities, solution options, and assumption tests.

Recommended outcome root:

> Staff can identify and safely complete the next responsible action in an outpatient visit without losing encounter context.

Opportunity branches:

- unclear ownership: work exists but no one knows who owns it
- readiness ambiguity: staff cannot tell whether work can start
- context loss: patient, guardian, encounter, chart, order, result, or invoice context is scattered
- delay invisibility: SLA, waiting, and bottleneck states are not visible early enough
- error risk: wrong patient, duplicate registration, missing order, unreviewed result, or incomplete invoice
- trust gap: client-only mock boundaries do not yet express real auth, audit, and persistence behavior

### Shape Up / Linear Lens: Shape Small Visible Bets

Turn broad ideas into bounded bets with an appetite, solution sketch, risks, explicit no-gos, and a small visible diff.

Good shaped slice:

- "Make role-based next actions traceable from workflow event to Home card to source screen entry."

Poor shaped slice:

- "Improve Home dashboard."

This suggests a simple rule for future design work: do not start with a screen idea unless the target role, operational moment, evidence, risk, and success signal are already clear.

## Product Trio Shaping Lens

Use this note as product/design/engineering shaping input, not only design inspiration.

| Lens | Question | CLAiR application |
|---|---|---|
| Product | Which outcome should improve first? | Chart completion time, order accuracy, billing wait time, unassigned queue reduction, or handoff ambiguity. |
| Design | Which moment is unclear or unsafe? | Wrong-patient selection, unclear owner, missing result follow-up, unexplained invoice line, or role-boundary confusion. |
| Engineering | Which boundary must stay honest? | Session-only state, mock auth, future API/DB replacement, service catalog seed, audit foundation, and permission roadmap. |

This lens prevents two common failures: designing broad polish without a measurable outcome, or implying live persistence and server enforcement before those workstreams are approved.

## Opportunity Map

Target outcome: staff can identify and complete the next safest action for an encounter within seconds.

Opportunity areas:

- Role clarity: staff need to know whether work is theirs, unassigned, blocked, or already owned.
- Encounter continuity: patient, guardian, chart, order, result, and invoice context need to survive navigation.
- Evidence visibility: recommendations, warnings, and priorities need visible reasons, not opaque automation.
- Handoff confidence: downstream roles need readiness, missing information, and owner context.
- Error prevention: risky actions need identifiers at the exact moment of confirmation.
- Operational density: repeated tables, panels, and actions need consistent hierarchy for fast scanning.

Possible solution families:

- Role-based next-action object shared by Home and source queues.
- Encounter timeline or handoff rail shared by chart, lab/imaging, dispensing/treatment, and billing.
- Patient safety strip with allergies, caution notes, recent abnormal results, unpaid balance, or missing guardian consent when relevant.
- Order-to-invoice trace that explains where each billing line came from.
- Unified queue item semantics for priority, SLA, owner, status, blocked reason, and route.
- Design-system foundation for typography, density, buttons, surfaces, tables, and panel roles.

Assumption tests:

- Can users explain why a recommended action is first?
- Can users recover patient and encounter context after changing modules?
- Can billing staff explain an invoice line's clinical source?
- Can nurses tell whether an order is ready, blocked, or already handled?
- Can a veterinarian see what evidence supports a suggested diagnosis or order?

## Design Principles To Carry Forward

### 1. Make Next Action Obvious

Every operational surface should answer three questions without forcing the user to scan the whole system:

- what needs attention now
- why it needs attention
- where to act safely

The Home `다음 행동` pattern should become a reusable decision object that can appear in queues, right panels, patient context surfaces, and handoff summaries.

### 2. Preserve Encounter Continuity

The product should feel centered on a visit, not on separate screens. Patient, guardian, encounter, order, result, and invoice context should remain visible across module transitions.

A lightweight encounter timeline is the likely next design primitive:

- `접수`
- `진료`
- `오더`
- `임상병리검사`
- `영상검사`
- `조제/처치`
- `수납`

Each step should show current state, owner, blockers, and latest meaningful event. This should remain session-only until persistence and audit boundaries are explicitly scoped.

### 3. Reduce Clinical Cognitive Load

Chart, lab, and imaging surfaces should prioritize interpretation and next action over raw completeness. More data is not automatically better in EMR design.

Important signals:

- chief complaint and visit reason
- prior relevant history
- abnormal or changed results
- pending orders and incomplete results
- diagnosis candidates and evidence
- guardian explanation status
- billing-impacting clinical decisions

### 4. Show Evidence Before Automation

Future AI, recommendation, or automation ideas should first appear as visible evidence and controllable suggestions. A senior designer would avoid hidden automation in a clinical workflow before trust, override, and auditability are designed.

Good early pattern:

- suggested diagnosis or order
- short reason it appears
- source data used
- user accept/edit/dismiss action
- session-only result in the current prototype

### 5. Design For Safe Handoffs

For every transfer of responsibility, the UI should make the handoff contract visible:

- who created the work
- who owns it now
- what makes it ready
- what is missing
- what is blocking downstream roles
- what action would create risk

This should guide queue card design, role-based next actions, patient context bars, and confirmation dialogs.

## Development Points

### 1. Promote Role-Based Next Action To A Product Principle

The Home role-based `다음 행동` hypothesis should become a cross-product pattern, not only a dashboard feature.

Each recommended action should carry:

- task title
- patient or guardian context
- source workflow
- urgency or SLA signal
- evidence explaining why it appears
- one safe route to the source workflow

This keeps the product focused on operational decision-making instead of passive reporting.

Implementation-facing design shape:

- Define a reusable next-action schema before adding more dashboard widgets.
- Render the same action item pattern in Home and at least one source queue.
- Include reason labels such as `담당의 없음`, `대기 30분 초과`, `검사 결과 미확인`, or `청구 미반영`.
- Route users to the exact source record, preserving patient, guardian, and encounter context.

### 2. Model Handoffs With A Service Blueprint

Use service blueprinting to describe the handoff from `접수/예약` to `진료`, `임상병리검사`, `영상검사`, `조제/처치`, and `수납`.

The important design object is not only a queue card. It is the responsibility transfer:

- who created the work
- who owns it now
- what state proves it is ready
- what is still missing
- what delay or risk is visible
- what downstream role is blocked

This should shape future queue ownership, assignment, SLA, and audit UX.

Service blueprint sketch:

| Stage | Frontstage user action | Backstage/system signal | Design risk |
|---|---|---|---|
| Reception | Register visit and assign context | Encounter, patient, guardian, visit reason, doctor assignment | Duplicate patient or unassigned doctor |
| Chart | Record SOAP and create orders | Chart number, diagnosis, order IDs, draft/final state | Order on wrong chart or incomplete evidence |
| Lab/Imaging | Attach or enter results | Result source, linked order, abnormal flags | Result linked to wrong patient or not reviewed |
| Dispensing/Treatment | Complete ordered work | Owner, completion state, medication/treatment detail | Completed work not visible downstream |
| Billing | Confirm invoice and payment | Invoice lines, clinical sources, payment state | Missing, duplicate, or unexplained charge |

Design implication:

- Each module should show the current stage, owner, readiness, blockers, and downstream impact.
- Handoff state should be represented as a first-class UI concept, not inferred from scattered badges.

### 3. Evolve Chart Into A Clinical Decision Cockpit

The chart screen already has SOAP, diagnosis search, and orders. The next step is connecting evidence across the visit:

- chief complaint
- prior history
- lab and imaging results
- diagnosis candidates
- orders and billing impact
- guardian explanation status

Do not jump directly to opaque automation. First design visible evidence, clear user control, and easy override paths.

Senior designers would likely ask the chart screen to answer four questions quickly:

- What is this patient here for today?
- What prior context changes the decision?
- What did I decide, and on what evidence?
- What will other roles need from this chart?

Candidate MVP slices:

- Add a compact evidence strip inside chart context: visit reason, recent abnormal result, caution note, latest diagnosis, unpaid or consent flag when relevant.
- Extend diagnosis suggestions with visible sources such as `SOAP`, `recent history`, or `mock catalog`.
- Show order downstream impact: which order routes to lab, imaging, dispensing/treatment, and billing.
- Make chart completion dialog explain missing clinical or operational artifacts, not only confirm intent.

### 4. Treat Error Prevention As A Differentiator

For EMR work, error prevention is a product-quality feature.

High-value risk scenarios:

- duplicate reception or wrong patient selection
- order entered on the wrong chart
- lab result reviewed but not reflected in chart
- billing opened before required clinical steps are confirmed
- invoice missing selected orders
- user attempts an action outside their role boundary

Future UX should keep confirmations tied to patient, chart number, order IDs, invoice IDs, and responsible role.

Error-prevention patterns:

- Confirm destructive or high-impact actions with patient, guardian, chart number, and affected objects.
- Prefer inline blocked reasons before modal warnings.
- Make mismatch states visible, such as selected patient not matching current encounter or result order.
- Keep role boundaries explicit while clearly stating that current client-side gates are not complete security.
- Preserve user control with cancel, edit, and review paths before final state transitions.

### 5. Add Encounter Timeline As A Cross-Workflow Spine

The current product has many strong module workspaces. The next design lift is to make those modules feel like one continuous outpatient visit.

Recommended first pass:

- add a compact timeline concept to design docs before code
- define status labels per step
- define which role owns each step
- define blocker and delay states
- define how timeline state maps to existing session-only mock data
- keep live persistence and audit out of scope until approved

This can help future Home, chart, lab, imaging, reception, and billing PRs share the same mental model.

### 6. Reframe Billing As Explanation And Trust

Billing is a front-stage moment with the guardian. The interface should not only calculate totals; it should help staff explain why the invoice is correct.

Potential improvements:

- group invoice lines by clinical source: consultation, lab, imaging, treatment, medication, discount, unpaid balance
- show source order or encounter context for each billable item
- separate internal editing from guardian-facing explanation
- show before/after impact for quantity, discount, merge, split, and unpaid actions
- warn when an invoice includes incomplete, cancelled, or unconfirmed clinical work

### 7. Continue Foundation-First UI Work

The UI consistency audit already points to system-level gaps. Senior designers would likely stabilize the design system before polishing individual screens.

Recommended sequence:

- typography roles
- spacing and density scale
- action hierarchy and button usage
- surface and elevation policy
- table, panel, header, and footer patterns
- then screen-specific polish

This matches CLAiR's bright, quiet, long-session operational product stance.

### 8. Research Workarounds, Not Only Feature Requests

Jobs-to-be-Done research should look at current substitutes:

- paper notes
- KakaoTalk messages
- verbal handoffs
- Excel sheets
- old EMR shortcuts
- reception desk memory
- handwritten treatment boards

The key question is: what job are staff trying to get done when they leave the system or create a workaround?

Interview prompts:

- "Show me the last time you used paper, chat, or memory because the EMR was not enough."
- "What information do you need before handing this patient to the next person?"
- "What mistakes are expensive or embarrassing enough that you double-check them manually?"
- "Which screen do you keep open during peak hours, and why?"
- "When do you stop trusting the system and ask a coworker?"

## Role-Based Job Stories

Use these as design anchors for future workflow shaping.

### Front Desk

When a guardian arrives during a busy period, front desk staff want to confirm whether the guardian and animal already exist, register the correct visit, and assign or queue the case, so the clinical team can start without duplicate records or missing context.

Development focus:

- Faster duplicate detection.
- Clear new vs existing guardian/patient branch.
- Visible doctor assignment state.
- Safe route from registration completion to encounter queue.

### Veterinarian

When examining a patient, veterinarians want prior history, current complaint, SOAP, diagnosis, and orders in one coherent decision space, so they can make defensible clinical decisions without losing the visit thread.

Development focus:

- Evidence strip and chart history context.
- Diagnosis suggestions with sources.
- Order impact visibility.
- Completion checks tied to missing clinical artifacts.

### Nurse / Lab / Imaging / Treatment Staff

When receiving an order, clinical support staff want to know what is ready, what is blocked, who owns it, and how the result or completion will flow back, so they can process work safely without interrupting the veterinarian.

Development focus:

- Shared queue item semantics.
- Order readiness and blocker labels.
- Result-to-order matching state.
- Completion state visible to downstream billing and chart review.

### Billing Staff

When closing a visit, billing staff want invoice lines to explain their clinical source and completion state, so they can confidently explain the bill and avoid missing or duplicate charges.

Development focus:

- Order-to-invoice trace.
- Missing or duplicate charge warnings.
- Guardian-facing explanation notes.
- Billing confirmation tied to chart/order/invoice identifiers.

### Hospital Manager

When clinic flow slows down, managers want to see bottlenecks by stage, owner, and elapsed time, so they can reassign work or intervene before staff and guardians feel the delay.

Development focus:

- Bottleneck board based on SLA, unassigned work, and blocked states.
- Role/team filter.
- Handoff delay reasons.
- Route from operational summary to exact work item.

## Live-System Replacement Guardrail

This document can describe future product contracts, but it must not imply that the current prototype already has live persistence, RLS, server-side permission enforcement, or audit-backed state mutation.

When shaping any future design from this note, explicitly label:

- session-only state used by the current prototype
- future source of truth candidate: API, DB table, auth/session, service catalog, audit log, or integration
- role that can view, create, update, confirm, cancel, or override the state
- action that should eventually create an audit event
- boundary that must be enforced server-side before the UX is treated as secure

This keeps product design useful for later engineering work while preserving the current MVP mock/live boundary.

## Priority Development Bets

### P0: Encounter Timeline And Role Next Action

Hypothesis: users will move faster and make fewer wrong-context decisions if the app always shows visit state, current owner, blocker, and next safe action.

Prototype scope:

- Home role cards
- queue cards
- patient context bar
- chart and billing right panels

Measure:

- time from login or screen open to first correct action
- wrong patient or wrong encounter confusion during walkthrough
- number of clicks before user identifies current owner and blocker

### P1: Chart, Lab, And Imaging Evidence Surface

Hypothesis: vets can make better decisions with less scanning if SOAP, diagnosis, results, imaging impression, and orders are connected through visible evidence.

Prototype scope:

- chart evidence strip
- diagnosis suggestion reason
- abnormal or changed result emphasis
- result reviewed but not chart-reflected state

Measure:

- ability to explain clinical next step after reviewing the screen
- missed abnormal result during task testing
- perceived confidence and cognitive load after scenario completion

### P1: Billing Explanation Layer

Hypothesis: billing staff can reduce guardian-facing friction if invoice lines are grouped by clinical source and risky edits show clear impact.

Prototype scope:

- invoice grouping by source workflow
- guardian-facing summary mode
- discount/quantity/unpaid before-after review
- incomplete work warning

Measure:

- time to explain invoice in a role-play
- number of billing corrections after review
- staff confidence that invoice matches care delivered

### P2: Safety UX Audit Across High-Risk Actions

Hypothesis: consistent state, confirmation, and recovery patterns will reduce accidental actions and increase trust before live persistence is added.

Prototype scope:

- chart completion
- order confirmation
- result review
- billing confirmation
- patient/guardian registration

Measure:

- user can identify exactly what will change before confirming
- user can cancel or recover from accidental path
- no confirmation dialog lacks patient or encounter context

### P2: Operational Design Language

Hypothesis: repeated screens will feel safer and faster when table, panel, button, typography, status, and confirmation patterns carry consistent operational meaning.

Prototype scope:

- typography role definitions
- action hierarchy mapping
- dense table and panel rules
- status and risk semantics
- confirmation dialog content contract

Measure:

- fewer local UI variants for equivalent intent
- faster recognition of primary versus secondary actions
- reduced inconsistency findings in follow-up UI audits

## Shape-Up Pitch Template For These Bets

Use this compact pitch format before turning any priority above into a PR-sized work item:

- Problem: the exact role, moment, and risk being improved.
- Appetite: how much design/implementation effort the bet is worth.
- Solution outline: the smallest workflow change that can prove the direction.
- Rabbit holes: data, permission, integration, or UI complexity that could expand scope.
- No-gos: live DB/API, RLS, server enforcement, external integrations, or automation not explicitly approved.
- Success signal: the observable behavior or test result that proves the bet helped.

Example no-go language:

- Do not implement live Supabase validation, migrations, RLS, or server enforcement as part of a design-only or session-only prototype bet.
- Do not claim client-only role gating is security-complete.
- Do not expand a workflow bet into global dashboard, analytics, or design-system cleanup unless that is the explicit appetite.

## Suggested Validation Plan

Use a small continuous discovery loop instead of a large one-off research phase.

### Weekly Cadence

- 1 short user conversation or workflow walkthrough per week.
- Include at least one product trio member from design/product/engineering perspective.
- Test a concrete scenario, not a broad opinion question.
- Record the observed friction, workaround, quote, and decision impact.
- Promote only repeated or high-risk findings into work items.

### Five Core Test Scenarios

1. Front desk registers a new guardian and patient, then checks the patient in.
2. Vet reviews the waiting patient, writes SOAP, chooses diagnosis, and creates orders.
3. Lab or imaging staff receives the order, records results, and returns interpretation context.
4. Vet reviews returned results and completes chart/order decisions.
5. Billing staff explains, edits, and confirms the guardian invoice.

### Five Risk Moments To Prototype

Use focused prototypes instead of broad screen redesigns.

1. Existing guardian plus new animal registration during reception.
2. Veterinarian creates SOAP, diagnosis, and orders from the same patient context.
3. Lab or imaging staff links an incoming result to the correct active order.
4. Billing staff explains invoice lines that came from chart, lab, imaging, and dispensing/treatment.
5. Hospital manager identifies the most urgent bottleneck and chooses where to intervene.

For each prototype, observe:

- Can the user state the next action without asking?
- Can the user explain why the system recommends or blocks something?
- Does patient/guardian/encounter context remain obvious?
- Does the user trust the source of orders, results, and invoice lines?
- Does the UI prevent a plausible wrong-patient, wrong-order, or missing-charge action?

### Questions To Ask During Testing

- What do you think needs attention now?
- Why do you think this item is urgent?
- Who owns this work at this moment?
- What information are you missing before acting?
- What would you double-check outside the system?
- What mistake would be costly here?
- What would you tell the guardian or another staff member?

### Usability Test Script Outline

Use one role at a time. Do not explain the intended path first.

Setup:

- Give the participant a realistic clinic moment.
- Start them from the relevant module or Home next-action list.
- Ask them to think aloud while completing the task.

Core prompts:

- "What do you think needs attention first?"
- "What tells you this belongs to you?"
- "What information would you verify before continuing?"
- "What feels missing or risky?"
- "How would you explain this handoff or invoice to a coworker or guardian?"

Success signals:

- Participant can identify the right patient and encounter.
- Participant can name the next action and why.
- Participant notices blockers before unsafe action.
- Participant can trace an order/result/invoice line back to its source.
- Participant does not need hidden implementation knowledge to understand status.

## Success Metrics To Consider

Product-level:

- next-action identification time
- handoff ambiguity rate
- wrong-context confusion rate
- task completion time for top workflows
- perceived confidence by role

Safety and quality:

- duplicate reception detection
- incomplete order or invoice warning recognition
- abnormal result follow-up recognition
- chart completion with required context visible
- billing line source traceability

Design-system:

- repeated pattern reuse rate
- inconsistent action hierarchy count
- table/panel/header/footer variant count
- confirmation dialogs with full patient/encounter context

## Suggested Discovery Process

1. Define one outcome, such as chart completion time, order accuracy, billing wait time, or unassigned queue reduction.
2. Observe each role during a real outpatient flow, especially peak-time handoffs.
3. Build an opportunity map around unmet needs, pain points, and delays.
4. Generate multiple solution options before choosing a UI pattern.
5. Test the riskiest assumption first with lightweight prototypes or role-based walkthroughs.
6. Run focused design critiques for quality, consistency, and blocked decisions.
7. Promote successful patterns into shared components and design-system rules.

## Candidate Work Sequence

1. Product/design shaping: define encounter timeline states, owners, blockers, and role next-action object.
2. Service blueprint document: define responsibility transfer from reception through billing.
3. `DESIGN-SYSTEM-PR-003`: typography, spacing, and action hierarchy foundation.
4. Home/workflow shaping: promote role-based next actions into a cross-workflow model.
5. Chart shaping: connect SOAP, diagnosis, results, and orders through evidence and safe actions.
6. Lab/imaging shaping: make result interpretation, review state, and chart follow-up visible.
7. Reception plus billing shaping: reduce unassigned, delayed, missing-handoff, and invoice-explanation friction.
8. Queue semantics shaping: align owner, blocker, SLA, and route labels across Home, chart, lab/imaging, dispensing/treatment, and billing.

## Proposed Decision Criteria

When deciding between possible development points, prefer the option that:

- reduces wrong-patient, wrong-chart, wrong-order, or missing-charge risk;
- improves cross-role handoff clarity;
- preserves encounter context across module transitions;
- can be tested in session-only prototype scope;
- creates a reusable product pattern instead of one local screen fix;
- fits the foundation-first design-system roadmap.

## Candidate PR-Sized Shaping Ideas

These are not approved work items yet. Move them to `docs/work/` only after goal, scope, out-of-scope, done criteria, source docs, dependencies, and verification are clear.

### HOME-WORKFLOW-NEXT-ACTION

Goal: define a cross-workflow next-action model that explains why work appears in Home and routes users back to the source workflow.

Included:

- event-to-task mapping draft
- owner, source workflow, urgency, reason, and safe-entry fields
- role queue versus assigned user distinction
- mock-only boundary notes

Excluded:

- live DB/API persistence
- real-time assignment
- source workflow state mutation from Home

### WORKFLOW-HANDOFF-BLUEPRINT

Goal: document responsibility transfer from reception through chart, orders, results, dispensing/treatment, and billing.

Included:

- service blueprint
- failure modes
- owner/readiness/blocker states
- candidate UI artifacts

Excluded:

- code implementation
- backend enforcement
- pixel-level QA

### CHART-ORDER-EVIDENCE-LOOP

Goal: shape a chart experience where SOAP, diagnosis, lab/imaging results, orders, and billing impact remain connected.

Included:

- evidence loop model
- result-review return path
- order readiness and billing impact concept
- error-prevention scenarios

Excluded:

- AI diagnosis automation
- live diagnosis catalog API
- persistence and audit implementation

### DESIGN-SYSTEM-OPERATIONAL-LANGUAGE

Goal: turn the UI consistency audit into reusable operational language for dense EMR screens.

Included:

- typography roles
- action hierarchy
- density scale
- surface/elevation roles
- table, panel, header, and footer pattern guidance

Excluded:

- full screen-by-screen polish
- new visual brand direction
- generated Clair token edits

## Open Questions

- Which role is the first buyer-critical user for MVP validation: front desk, veterinarian, nurse, billing admin, or hospital admin?
- Which outcome should be measured first: next-action identification time, billing wait time, chart completion confidence, or handoff error reduction?
- Should the first shaped bet prioritize the Home next-action model or the encounter state spine underneath it?
- Which real clinic workflow should be observed first: routine vaccination, acute vomiting/diarrhea, imaging-heavy visit, or hospitalization handoff?
- What is the minimum source-of-truth model needed before role next actions can become more than session-only recommendations?

## Out Of Scope For This Note

- Live DB/API persistence.
- Supabase validation, migrations, RLS, or server-side permission enforcement.
- Claiming that client-only role gating is complete security.
- Specific UI code changes.
- Pixel-level visual QA.
