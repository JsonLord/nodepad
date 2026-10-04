Nodepad Continuous Evidence, Synthesis & Hypothesis Brain — Implementation Specification
Repository: `JsonLord/nodepad`  
Target branch: `integration-evals`  
Inspected branch head: `af41c021035624ed9651b2544e56142355f62cf8`  
Merged donor repositories currently present: `product-eval/`, `find-me-saas/`, `founder-skills/`, `venture-analyst/`  
Status: implementation specification  
Primary objective: evolve Nodepad from a spatial AI note canvas plus vendored evaluation repositories into a continuously developing, evidence-grounded reasoning graph that researches, synthesizes, proposes hypotheses, attacks those hypotheses with further research, updates their qualification state, and exports a durable “brain” that later specialist agents from `agency-agents` can read and extend.
---
0. Executive summary
Nodepad should become an Evidence-to-Hypothesis Operating System.
The core loop is:
```text
sources / observations / feedback / analytics / research
                         ↓
                    EVIDENCE
                         ↓
                   SYNTHESIS
             (130+ typed lenses)
                         ↓
             PROPOSED HYPOTHESES
                         ↓
           GAP + CONTRADICTION ANALYSIS
                         ↓
              TARGETED RESEARCH TASKS
                         ↓
                   NEW EVIDENCE
                         ↓
             HYPOTHESIS RE-SCORING
                         ↓
               GRAPH STATE UPDATE
                         ↓
          PROMOTE / CONTEST / DISQUALIFY
                         ↓
                 DEVELOPING BRAIN
                         ↺
```
Nodepad's existing spatial note experience remains important, but the canonical model becomes a typed graph with explicit provenance. AI is allowed to propose interpretations, hypotheses, opportunities, value propositions and experiments, but it is not allowed to silently convert speculation into knowledge.
The four merged repositories should not remain isolated subprojects forever. Their strongest mechanisms should be extracted behind Nodepad-native services:
Product-Eval → evidence contract, evidence quality, themes, contradictions, confidence, decision readiness, design-test loop, calibration.
FindMeSaaS → mechanical validation harness, score recomputation, schema contracts, B2B/B2C lanes, pre-mortem / devil's-advocate discipline.
Founder Skills → assumption map, impact × uncertainty, pressure testing, pretotype design, explicit kill assumptions, pivot logic.
Venture Analyst → free/zero-key research collectors and source-adapter patterns for HN, Reddit, GitHub, web search and trends.
The implementation must preserve provenance to the donor code until replacement behavior is covered by tests.
---
1. Vision
1.1 Product identity
Nodepad becomes:
> **A continuously developing evidence graph that turns research into hypotheses, turns hypotheses into tests, and turns test results into an auditable evolving brain.**
It has five engines:
```text
THINK   → associations, implications, emergent hypotheses, Ghost/Gardener
KNOW    → evidence, provenance, source quality, contradiction, confidence
TEST    → research gaps, RATs, experiments, falsification thresholds
DECIDE  → qualification state, priorities, value propositions, pivots, kill rules
VERIFY  → schemas, arithmetic, graph integrity, source freshness, replayability
```
1.2 Design principles
Evidence and hypothesis are different node classes. Never blur them.
Every non-user-authored conclusion must have provenance.
Contradictory evidence is retained, not smoothed away.
Qualification is continuous, not a one-time verdict.
Confidence and valence are separate. A hypothesis can be strongly disqualified with high confidence.
Synthesis is plural. The same evidence can legitimately produce many different strategic views.
AI proposes; deterministic code scores and validates.
Research is budgeted and rate-limit aware. Continuous does not mean abusive or wasteful.
Everything important is serializable to diff-friendly GitHub files.
Agency agents later operate through stable APIs, not by editing internal files ad hoc.
Human overrides are allowed but always logged.
The graph must be replayable from Git history and event logs.
Brain promotion is conservative. Qualified knowledge and speculative hypotheses are exported separately.
One shared graph, many views. Do not create parallel isolated stores for research, hypotheses, experiments and decisions.
The system should degrade gracefully offline. Existing local Nodepad import/export must continue to work.
---
2. Current branch assessment
At `integration-evals`, the four donor repositories are currently merged safely as top-level directories. The root Nodepad package remains the original Next.js application and does not yet declare workspaces or wire the donor packages into runtime services.
This is desirable for the next step. Treat the donor directories as reference/vendor sources during extraction, not as four applications to execute side-by-side.
2.1 Preserve existing Nodepad strengths
Preserve:
Next.js / React / TypeScript application.
spatial tiling view.
type-based Kanban.
force-directed graph.
AI enrichment.
content classification.
inferred relationships.
Ghost / emergent thesis behavior.
project/workspace separation.
`.nodepad` import/export.
local browser mode during migration.
custom OpenAI-compatible base URL support.
2.2 Do not do these things
Do not rewrite the frontend framework.
Do not copy all donor prompts into the Nodepad prompt context.
Do not run 100+ independent LLM agents per heartbeat.
Do not make GitHub the only runtime datastore.
Do not store GitHub tokens or LLM keys in workspace backups.
Do not allow model output to directly mutate evidence scores without validation.
Do not delete donor directories until parity tests cover extracted behavior.
Do not require paid APIs for the core loop.
---
3. Target repository architecture
Use a gradual extraction architecture. A full npm workspace conversion is optional in this implementation pass; internal modules may live under `lib/` first if that is safer for the current Next.js setup.
Recommended destination:
```text
nodepad/
├── app/
│   └── existing UI + new API routes
├── components/
│   └── existing views + graph status overlays
├── lib/
│   ├── graph/
│   ├── evidence/
│   ├── hypotheses/
│   ├── synthesis/
│   ├── research/
│   ├── scoring/
│   ├── heartbeat/
│   ├── brain/
│   ├── persistence/
│   ├── github-sync/
│   ├── agents/
│   └── validation/
├── worker/
│   └── heartbeat.ts
├── data/                         # gitignored runtime data by default
├── product-eval/                 # donor/reference until extracted
├── find-me-saas/                 # donor/reference until extracted
├── founder-skills/               # donor/reference until extracted
├── venture-analyst/              # donor/reference until extracted
├── docs/
│   ├── DATA_MODEL.md
│   ├── SYNTHESIS_REGISTRY.md
│   ├── HEARTBEAT.md
│   ├── GITHUB_BACKUP.md
│   ├── BRAIN_EXPORT.md
│   └── AGENCY_AGENTS_INTEGRATION.md
└── spec.md
```
---
4. Canonical graph data model
4.1 Node kinds
Keep Nodepad's general-purpose content types for UI/editor semantics, but add a domain semantic kind.
```ts
export type KnowledgeNodeKind =
  | "evidence"
  | "observation"
  | "source"
  | "entity"
  | "person"
  | "organization"
  | "segment"
  | "persona"
  | "job_to_be_done"
  | "pain"
  | "problem"
  | "assumption"
  | "hypothesis"
  | "counter_hypothesis"
  | "insight"
  | "theme"
  | "opportunity"
  | "value_proposition"
  | "positioning"
  | "message"
  | "objection"
  | "feature"
  | "solution_concept"
  | "pricing_hypothesis"
  | "channel_hypothesis"
  | "experiment"
  | "research_task"
  | "result"
  | "metric"
  | "decision"
  | "pivot"
  | "risk"
  | "constraint"
  | "brain_knowledge";
```
4.2 Edge kinds
```ts
export type KnowledgeEdgeType =
  | "supports"
  | "contradicts"
  | "corroborates"
  | "derived_from"
  | "implies"
  | "depends_on"
  | "explains"
  | "challenges"
  | "alternative_to"
  | "tests"
  | "produced"
  | "invalidates"
  | "strengthens"
  | "weakens"
  | "supersedes"
  | "mentions"
  | "applies_to"
  | "belongs_to"
  | "causes"
  | "precedes"
  | "blocks"
  | "enables"
  | "measures"
  | "qualified_by"
  | "disqualified_by";
```
Every inferred edge stores:
```ts
interface EdgeProvenance {
  origin: "human" | "system" | "ai" | "agent" | "import" | "research";
  actorId?: string;
  runId?: string;
  confidence?: number;
  explanation?: string;
  createdAt: string;
}
```
4.3 Evidence record
Preserve Product-Eval's additive data contract and extend it rather than renaming its fields.
```ts
interface EvidenceRecord {
  id: string;
  claim: string;
  sourceType: string;
  sourceRef?: string;
  sourceUrl?: string;
  sourceId?: string;
  persona?: string[];
  funnelStage?: string;
  impactType?: string;
  strength: 1 | 2 | 3 | 4 | 5;
  recencyDays?: number;
  weight: number;
  stale: boolean;
  personId?: string | null;
  accountId?: string | null;
  corroboratedBy: string[];
  contradicts: string[];
  observedAt?: string;
  ingestedAt: string;
  provenance: Provenance;
}
```
4.4 Hypothesis record
```ts
interface HypothesisRecord {
  id: string;
  workspaceId: string;
  title: string;
  statement: string;
  hypothesisType: string;

  derivedFrom: string[];
  supportingEvidence: string[];
  contradictingEvidence: string[];
  dependentAssumptions: string[];
  alternativeHypotheses: string[];

  impact: number;                 // 0..100
  uncertainty: number;            // 0..100
  novelty: number;                // 0..100
  strategicImportance: number;    // 0..100

  evidenceScore: number;          // -100..100
  confidence: number;             // 0..100
  qualification: HypothesisQualification;

  sourceDiversity: number;
  firstPartyWeight: number;
  behavioralWeight: number;
  freshnessScore: number;

  status:
    | "active"
    | "stale"
    | "superseded"
    | "archived";

  researchGaps: string[];
  nextResearchAt?: string;
  lastEvaluatedAt?: string;
  createdAt: string;
  updatedAt: string;

  generation: {
    method: string;
    synthesisType?: string;
    model?: string;
    runId?: string;
    generationConfidence?: number;
  };
}
```
---
5. Hypothesis qualification lifecycle
Do not use a binary validated/not-validated field.
5.1 Evidence score and qualification bands
Store a signed `evidenceScore` from `-100` to `+100`. Display a semantic band first and the exact score second.
Score	Qualification	Meaning
-100..-80	strongly_disqualified	Multiple strong/independent sources or direct behavioral evidence refute it.
-79..-55	disqualified	Evidence materially contradicts the hypothesis.
-54..-30	leaning_disqualified	Contradictory evidence outweighs support, but uncertainty remains.
-29..-10	weakly_disfavored	Mild negative evidence; do not kill yet.
-9..+9	unresolved	Evidence balance insufficient or contradictory.
+10..+29	weak_signal	Some support, low decision readiness.
+30..+49	potentially_qualified	Meaningful evidence exists, but important gaps remain.
+50..+69	provisionally_qualified	Good support from multiple sources; still subject to targeted falsification.
+70..+89	qualified	Strong, diverse evidence supports it.
+90..+100	strongly_qualified	Repeated independent and preferably behavioral/first-party confirmation.
Special overlays:
`unresearched` — hypothesis exists but has no meaningful evidence yet.
`contested` — material high-quality evidence exists on both sides.
`stale` — evidence freshness below policy.
`superseded` — a newer hypothesis/model replaces it.
`operationalized` — the hypothesis has become a working decision/product principle, but still retains its evidence state.
5.2 Confidence is separate
`confidence` measures how confident the system is in the qualification, not whether the hypothesis is positive.
Examples:
evidenceScore `-82`, confidence `91` → confidently false.
evidenceScore `+41`, confidence `34` → potentially promising but poorly established.
evidenceScore `0`, confidence `88`, contested overlay → genuinely mixed evidence.
5.3 Scoring inputs
Start with a deterministic configurable function built from:
support evidence weight.
contradiction evidence weight.
evidence strength 1..5.
recency/freshness.
independent source diversity.
duplicate-source penalty.
first-party data bonus.
behavioral evidence bonus over stated opinion.
direct measurement bonus.
contradiction severity.
sample/account diversity.
known source reliability.
explicit human override only as a separately logged field.
Do not let an LLM directly choose the final qualification band.
5.4 Research priority
For each hypothesis compute:
```text
research_priority =
  strategic_importance
  × uncertainty
  × impact_if_wrong
  × evidence_gap
  × graph_dependency_factor
  × freshness_need
  ÷ expected_research_cost
```
Normalize to 0..100.
`graph_dependency_factor` increases priority when many other hypotheses/decisions depend on the hypothesis.
---
6. Continuous heartbeat
6.1 Requirement
The system must have a durable heartbeat worker. Browser timers alone are insufficient because research and re-evaluation must continue when no tab is open.
Implement:
```bash
npm run heartbeat
```
and optionally:
```bash
npm run dev:all
```
for local development.
The worker may be run as a sidecar/process in production. Also provide a protected API trigger so an external cron/Paperclip workflow can request a heartbeat safely.
6.2 Heartbeat phases
Every heartbeat run gets a stable `runId` and executes idempotently:
Acquire lease — prevent overlapping workers for the same workspace.
Read dirty state — new evidence, changed notes, completed research tasks, stale hypotheses.
Ingest — normalize newly arrived source material.
Deduplicate — semantic/content/source duplication detection.
Evidence-quality pass — strength, recency, source type, identity resolution, contradictions.
Theme refresh — update affected problem/theme clusters only.
Synthesis dispatch — execute eligible synthesis definitions from the registry.
Hypothesis generation — create proposals from new/changed syntheses.
Hypothesis matching — merge semantic duplicates; create `supersedes` or `alternative_to` instead of duplication.
Re-score affected hypotheses — deterministic evidence scoring.
Gap planner — identify evidence needed to move the most valuable hypotheses.
Research scheduler — enqueue targeted research tasks respecting budgets/rate limits.
Research execution — run only tasks due this heartbeat and only through healthy providers.
Result ingestion — convert research results into evidence nodes.
Second re-score — update hypotheses changed by the newly collected evidence.
Graph maintenance — update typed edges, centrality/dependency information and status overlays.
Brain promotion/demotion — evaluate what may enter/leave qualified brain knowledge.
Drift/staleness checks — schedule revisits to old important evidence.
GitHub backup — if canonical state is dirty and commit debounce permits.
Emit events/summary — heartbeat summary for UI, API, Agency Agents, Paperclip/n8n.
Release lease.
6.3 Heartbeat modes
```ts
type HeartbeatMode =
  | "paused"
  | "low"
  | "normal"
  | "research_intense";
```
Suggested defaults:
`low`: synthesis/score frequently, external research at most every 12h.
`normal`: synthesis/score every 15–30m while worker runs; external research due tasks every 2–6h.
`research_intense`: active experiments/research every 1–2h where provider limits allow.
All timings are configuration, not hard-coded assumptions.
6.4 Budget and rate-limit policy
Each research provider declares:
```ts
interface ResearchProviderPolicy {
  id: string;
  costClass: "local" | "free" | "free_quota" | "paid_optional";
  requestsPerWindow?: number;
  windowSeconds?: number;
  concurrency: number;
  minIntervalMs?: number;
  enabled: boolean;
  health: "healthy" | "degraded" | "cooldown" | "disabled";
}
```
Default provider preference:
```text
local/self-hosted
→ free public/no-key
→ free hosted
→ free quota
→ paid optional (never silently)
```
---
7. Research provider layer
Extract provider adapters from Venture Analyst instead of invoking its scripts as an opaque application.
Initial adapters:
Hacker News Algolia stories.
Hacker News comments.
Reddit public endpoints where currently functional and policy-compliant.
GitHub issue search.
GitHub repository search.
DDGS/web search.
Google Trends/trendspyg when healthy.
Add adapter slots for later MCP/capabilities:
Dialog Reddit Research MCP.
Jordan Reddit MCP action layer.
LinkedIn MCP.
Idea Reality MCP.
Jina/Scrapling/Playwright crawler chain.
product analytics/CRM/support connectors.
Agency Agent supplied research packets.
Every provider returns a common `ResearchArtifact` shape and must not directly create qualified knowledge.
---
8. Synthesis engine
8.1 Core idea
A synthesis is a typed transformation over one or more evidence/hypothesis/graph selections.
Do not implement each synthesis as a separate agent process. Implement one registry and one execution engine.
```ts
interface SynthesisDefinition {
  id: string;
  category: string;
  name: string;
  description: string;
  inputKinds: KnowledgeNodeKind[];
  outputKinds: KnowledgeNodeKind[];
  minEvidence?: number;
  requiresIndependentSources?: number;
  freshnessPolicy?: string;
  promptTemplate?: string;
  deterministicPostProcessor?: string;
  generatesHypotheses: boolean;
  heartbeatEligible: boolean;
  priority: number;
}
```
Every synthesis result must carry:
```ts
interface SynthesisResult {
  id: string;
  synthesisType: string;
  workspaceId: string;
  title: string;
  statement: string;
  rationale: string;
  derivedFrom: string[];
  supports?: string[];
  contradicts?: string[];
  unknowns: string[];
  suggestedResearch: string[];
  generatedHypotheses: string[];
  generationConfidence: number;
  createdAt: string;
  runId: string;
}
```
8.2 Eligibility
A synthesis runs when:
one or more of its input nodes changed materially; or
its output is stale; or
a user/agent explicitly requests it; or
a heartbeat policy marks it due.
Use content hashes so unchanged inputs do not trigger repeated LLM calls.
8.3 130 initial synthesis definitions
The registry must ship with at least the following 130 definitions. These may initially share generic generation infrastructure; they do not need 130 custom implementations.
A. Evidence quality & epistemics — S001–S010
S001 Evidence Sufficiency — determine whether the evidence set is sufficient to support any decision at all.
S002 Source Diversity — identify overreliance on one source class/community/account.
S003 Evidence Freshness — identify strategically important stale evidence.
S004 Contradiction Map — surface direct and indirect contradictions across sources.
S005 Corroboration Map — identify independently corroborated claims.
S006 Evidence Blind Spots — identify missing evidence classes needed for confidence.
S007 Anecdote-vs-Behavior Gap — contrast stated complaints/opinions with observed behavior.
S008 First-Party Evidence Gap — identify claims based only on public/secondary evidence.
S009 Source Bias Hypothesis — infer how source selection may distort the apparent conclusion.
S010 Confidence Ceiling — state the highest defensible confidence possible from current evidence.
B. Customer, segment & problem synthesis — S011–S020
S011 Problem Cluster — cluster evidence into underlying problems rather than topics.
S012 Root Cause Candidate — derive plausible root causes for a repeated pain.
S013 Pain Intensity — infer severity and cost of the problem.
S014 Pain Frequency — infer how often the problem occurs.
S015 Pain Urgency — infer forcing functions and time sensitivity.
S016 Segment Split — identify customer segments experiencing meaningfully different versions of the problem.
S017 Persona Role Map — distinguish user, buyer, champion, blocker and administrator.
S018 High-Pain Segment — identify the segment with highest evidenced severity/frequency.
S019 Problem Context — identify contexts/triggers in which the problem becomes salient.
S020 Problem Consequence Chain — map pain → operational effect → business effect → emotional/social effect.
C. Jobs, behavior & adoption — S021–S030
S021 JTBD Statement — derive job-to-be-done candidates from evidence.
S022 Current Workflow — reconstruct how users solve the job today.
S023 Workaround Map — classify manual, software, service, spreadsheet, social and non-consumption workarounds.
S024 Non-Consumption Reason — explain why users do nothing despite a stated pain.
S025 Switching Cost — identify procedural, data, social, contractual and cognitive switching costs.
S026 Behavior Change Burden — estimate how much new behavior adoption requires.
S027 Trigger-to-Action Chain — identify what event causes a user to seek a solution.
S028 Habit/Retention Driver — identify repeated triggers/rewards that could sustain use.
S029 Adoption Blocker — identify friction preventing trial or continued use.
S030 Abandonment Hypothesis — explain why users may stop using an existing/imagined solution.
D. Value proposition, positioning & messaging — S031–S040
S031 Core Value Proposition — derive the most evidence-supported promise.
S032 Avoided-Loss Proposition — frame value as cost/risk/delay avoided.
S033 Gain Proposition — frame value as measurable upside achieved.
S034 Emotional Value Proposition — identify confidence/status/stress/reassurance value.
S035 Persona-Specific Proposition — adapt proposition by user/buyer/champion role.
S036 Positioning Statement — derive category, audience, alternative and differentiated value.
S037 Category Hypothesis — infer which category framing makes the product easiest to understand/buy.
S038 Differentiation Hypothesis — identify differences customers appear to value, not just product differences.
S039 Headline Hypotheses — generate testable landing-page headline variants grounded in customer language.
S040 CTA Hypotheses — derive calls-to-action appropriate to evidence/readiness and customer intent.
E. Product, feature & solution synthesis — S041–S050
S041 Feature Opportunity — derive features directly from evidenced problems.
S042 Feature Anti-Opportunity — identify requested features not justified by evidence.
S043 Minimum Valuable Experience — derive the smallest experience that could deliver the core outcome.
S044 Concierge Version — identify what can be manually delivered before software exists.
S045 Wizard-of-Oz Version — identify which automated-looking behavior can safely be fulfilled manually for testing.
S046 Fake-Door Concept — derive the smallest credible demand probe.
S047 Workflow Integration Point — identify where in the customer's current workflow the product should enter.
S048 Product Boundary — define what the product should explicitly not attempt to solve.
S049 Feature Dependency Graph — derive feature prerequisites and dependent outcomes.
S050 Solution Alternative Set — generate materially different solution approaches to the same problem.
F. Pricing, monetization & economics — S051–S060
S051 Willingness-to-Pay Hypothesis — infer testable WTP ranges and confidence.
S052 Pricing Metric Hypothesis — seat, usage, project, outcome, asset, account, device, etc.
S053 Packaging Hypothesis — identify coherent bundles/tier boundaries.
S054 Freemium Suitability — reason whether free usage creates conversion/distribution value or cost leakage.
S055 Trial Design Hypothesis — infer what a trial must expose to demonstrate value.
S056 Cost-to-Serve Risk — infer expensive workflows or human/service burden.
S057 Gross-Margin Hypothesis — estimate major margin drivers needing validation.
S058 CAC Ceiling Hypothesis — derive maximum tolerable acquisition cost from current economics.
S059 LTV Driver Hypothesis — identify behaviors and business variables most likely to drive lifetime value.
S060 Monetization Failure Mode — identify reasons real demand may fail to become revenue.
G. Competition, alternatives & market structure — S061–S070
S061 Direct Competitor Map — synthesize direct competitors and key evidence.
S062 Indirect Competitor Map — synthesize adjacent products solving the same job differently.
S063 Substitute Map — spreadsheets, services, internal processes, community, doing nothing.
S064 Competitor Complaint Cluster — aggregate repeated negative review/problem themes.
S065 Competitor Strength Cluster — identify incumbent strengths users value and should not be ignored.
S066 Positioning Gap — infer underserved combinations of audience/problem/experience/price/trust.
S067 Incumbent Indifference — identify opportunities too small/awkward for incumbents to prioritize.
S068 Incumbent Response Risk — estimate how easily an incumbent could neutralize the differentiation.
S069 Market Saturation Hypothesis — infer whether competition indicates demand, commoditization or over-supply.
S070 Precedent Failure Lesson — extract lessons from similar products/startups that failed or shut down.
H. Distribution, channel & growth — S071–S080
S071 Channel Fit — rank channels by evidence quality and reachability.
S072 Evidence-Per-Euro Channel — rank channels specifically by validation signal per cost, not scale.
S073 Community Fit — identify communities in which the problem naturally appears.
S074 Search Intent — infer search queries and intent stages indicating active demand.
S075 Content Angle — derive content topics likely to produce useful validation signals.
S076 Outreach Angle — derive conversation openers based on evidenced pains rather than sales copy.
S077 Referral Loop Hypothesis — identify whether use naturally exposes/invites others.
S078 Virality Constraint — identify what prevents organic sharing or collaboration loops.
S079 Distribution Edge — identify founder/company assets that reduce acquisition difficulty.
S080 Channel Failure Mode — identify why an apparently attractive channel may not produce qualified users.
I. Trust, risk, regulatory & feasibility — S081–S090
S081 Trust Barrier — derive why customers may not trust the solution/provider.
S082 Proof Requirement — identify proof, certification, demo or social validation needed for adoption.
S083 Privacy Concern — synthesize data/privacy objections.
S084 Security Concern — synthesize security objections and required assurances.
S085 Regulatory Constraint — identify regulation/licensing/compliance hypotheses requiring validation.
S086 Platform Dependency Risk — detect dependency on APIs/platforms/providers that could invalidate the model.
S087 Technical Feasibility Risk — identify evidence gaps around whether the solution can actually work.
S088 Operational Feasibility Risk — identify human/process scaling constraints.
S089 Reputation Risk — identify trust/reputation failure paths from the proposed behavior.
S090 Abuse/Fraud Risk — derive foreseeable misuse/fraud incentives that affect product viability.
J. Research & experiment design — S091–S100
S091 Riskiest Assumption — select the highest-impact/highest-uncertainty load-bearing assumption.
S092 Cheapest Disconfirming Test — identify the cheapest test capable of proving the hypothesis wrong.
S093 Interview Test — derive Mom-Test-style questions that avoid pitching and leading.
S094 Fake-Door Test — derive audience, message, instrumentation and pass/fail threshold.
S095 Pricing Test — derive behavioral pricing experiment and threshold.
S096 Concierge Test — derive manual test, sample, duration and success/failure threshold.
S097 Instrumentation Gap — identify what product analytics/event tracking is needed to answer a hypothesis.
S098 Source Acquisition Plan — identify which evidence sources can most efficiently close the gap.
S099 Discriminating Experiment — design a test that differentiates between two competing hypotheses.
S100 Replication Test — design an independent repeat/segment/source test for an apparently strong result.
K. Reporting, narrative & communication — S101–S110
S101 Executive Focus Points — identify what a decision-maker report should emphasize.
S102 Evidence Narrative — turn evidence into a chronological/causal story without overstating certainty.
S103 Customer Voice Summary — summarize recurring language, preserving provenance.
S104 Key Quotes/Examples Selection — choose representative examples without cherry-picking.
S105 Decision Memo Focus — identify the facts that should determine build/test/pivot/kill decisions.
S106 Investor Narrative Focus — derive market/problem/proof/risk points relevant to an investor audience.
S107 Sales Narrative Focus — derive pain/proof/outcome points relevant to buyer conversations.
S108 Research Report Focus — identify strongest findings, caveats and next questions.
S109 Dashboard KPI Focus — derive which metrics should be monitored because they resolve current hypotheses.
S110 Unknowns Disclosure — produce the explicit “what we still do not know” section for any report.
L. Strategy, portfolio & decision synthesis — S111–S120
S111 Build/Test/Pivot/Kill Recommendation — deterministic/structured decision backed by evidence state.
S112 Pivot Candidate — generate a one- or two-variable pivot preserving strong dimensions.
S113 Kill Criterion — define evidence that should terminate the idea/hypothesis.
S114 Scale Criterion — define evidence required before allocating more resources.
S115 Venture Mode Fit — infer solo/indie/B2B/venture-scale operating assumptions and mismatches.
S116 Resource Fit — map founder/team assets and constraints to the opportunity.
S117 Portfolio Priority — rank multiple hypotheses/ventures by evidence, upside, cost and uncertainty.
S118 Expected Learning Value — rank actions by expected decision information generated per unit cost/time.
S119 Strategic Dependency — identify hypotheses that gate many downstream decisions.
S120 Opportunity Cost — identify what pursuing this option prevents or delays elsewhere.
M. Emergent / second-order / graph-native synthesis — S121–S130
S121 Cross-Cluster Bridge — find non-obvious connections between evidence clusters (Nodepad Ghost-style).
S122 Second-Order Hypothesis — derive what follows if a first-order hypothesis is true.
S123 Third-Order Business Consequence — derive downstream business implications of a supported second-order effect.
S124 Alternative Explanation — generate plausible explanations for the same observation.
S125 Hidden Common Cause — infer a latent cause that could explain multiple problems at once.
S126 Tension/Paradox — surface evidence pairs that appear true but pull strategy in opposite directions.
S127 Adjacent Opportunity — infer an adjacent product/service opportunity from existing pain/evidence.
S128 New Venture Candidate — identify when multiple evidence clusters imply a distinct venture rather than a feature.
S129 Weak-Signal Emergence — identify low-volume but fast-growing or strategically novel signals.
S130 World-Model Update — synthesize the most important change to the current “brain” caused by new evidence.
8.4 Synthesis status
Each synthesis result receives:
`draft_ai` — generated, not yet validated.
`supported` — adequately traceable to current evidence.
`contested` — significant contradictory evidence.
`stale` — inputs changed/freshness expired.
`superseded` — replaced by newer synthesis.
`promoted` — accepted as a stable graph insight/brain candidate.
---
9. Hypothesis Gardener
Build a background `HypothesisGardener` that runs after synthesis.
It must ask graph-native questions programmatically:
Which strong evidence nodes have no hypothesis explaining them?
Which important hypotheses have no counter-hypothesis?
Which hypotheses depend on the same weak assumption?
Which hypotheses share evidence but make different predictions?
Which qualified hypotheses have not been retested recently?
Which disqualified hypotheses still have dependent decisions/features?
Which high-centrality assumptions are under-researched?
Which value propositions have insufficient evidence?
Which pain clusters have no proposed solution/value proposition?
Which product ideas are based mainly on weak opinion evidence?
Which contradictions can be resolved by one discriminating experiment?
Which segment-specific findings are being incorrectly generalized?
Which weak signals are growing rapidly?
Which graph areas have become stale?
Which evidence changed enough to require a world-model update?
The Gardener may propose nodes and edges, but it must not directly promote brain knowledge.
---
10. Research task lifecycle
```ts
interface ResearchTask {
  id: string;
  workspaceId: string;
  hypothesisIds: string[];
  question: string;
  objective: "support" | "disconfirm" | "discriminate" | "refresh" | "discover";
  preferredSources: string[];
  requiredSourceDiversity: number;
  maxCostClass: "local" | "free" | "free_quota" | "paid_optional";
  status: "queued" | "running" | "blocked" | "complete" | "failed" | "cancelled";
  priority: number;
  notBefore?: string;
  attempts: number;
  maxAttempts: number;
  createdBy: string;
  runId?: string;
}
```
Research results become evidence; they never directly set hypothesis status.
For every important hypothesis, schedule falsification-biased research as well as supportive research.
---
11. Brain model
11.1 Brain layers
Export three explicitly separate layers:
```text
BRAIN
├── knowledge/        strongly/qualified, sufficiently confident propositions
├── hypotheses/       active, unresolved, potentially/provisionally qualified models
└── archive/          disqualified, superseded and historical hypotheses
```
Do not delete disqualified hypotheses; they are valuable negative knowledge.
11.2 Promotion policy
Default promotion to `brain/knowledge` requires configurable thresholds such as:
qualification `qualified` or `strongly_qualified`.
confidence >= 70.
source diversity >= 2 independent source types.
no unresolved high-strength contradiction, unless marked `contested` and intentionally represented as such.
not stale.
provenance complete.
Demotion occurs when new evidence drops a previously promoted proposition below threshold. Demotion must be append-only in the event log and visible in graph history.
11.3 Brain export
Generate:
```text
brain/
├── manifest.json
├── summary.md
├── graph.json
├── knowledge/
│   └── <id>.md
├── hypotheses/
│   └── <id>.md
├── archive/
│   └── <id>.md
├── entities/
│   └── <id>.md
├── decisions/
│   └── <id>.md
└── changelog.ndjson
```
`summary.md` must explain what changed since the previous brain snapshot.
This format is designed to be consumed later by BrainAPI, Agency Agents, RAG/indexers, or other agent memory systems.
---
12. GitHub continuous backup and restore
12.1 Goal
Nodepad workspaces must be continuously serializable into a normal Git repository as human-readable, diffable files. GitHub is a durable mirror/version store, not a secret store.
12.2 Runtime-to-Git layout
Recommended repository layout per workspace:
```text
nodepad-workspaces/
└── <workspace-slug>/
    ├── manifest.json
    ├── context.md
    ├── graph/
    │   ├── nodes/
    │   │   └── <id>.md
    │   ├── edges.ndjson
    │   └── index.json
    ├── evidence/
    │   └── <id>.md
    ├── syntheses/
    │   └── <id>.md
    ├── hypotheses/
    │   └── <id>.md
    ├── experiments/
    │   └── <id>.md
    ├── research/
    │   ├── tasks/
    │   └── results/
    ├── decisions/
    │   └── <id>.md
    ├── brain/
    │   └── ...brain export...
    ├── runs/
    │   └── <run-id>.json
    ├── events/
    │   └── events.ndjson
    └── schema-version.txt
```
12.3 File conventions
Markdown files use YAML front matter for machine fields and body text for human-readable explanation.
High-volume append-only streams use NDJSON.
Index/manifest files use JSON.
Never store tokens, API keys, cookies, OAuth refresh tokens or provider secrets.
Store source URLs/references only when policy permits.
Add a `schemaVersion` to every serialized object/file format.
12.4 GitHub sync adapter
Create a storage adapter interface:
```ts
interface BackupRemote {
  status(): Promise<BackupStatus>;
  pushWorkspace(snapshot: WorkspaceSnapshot): Promise<PushResult>;
  listSnapshots(workspaceId: string): Promise<SnapshotRef[]>;
  restoreWorkspace(workspaceId: string, ref: string): Promise<WorkspaceSnapshot>;
  diffWorkspace(workspaceId: string, fromRef: string, toRef: string): Promise<DiffSummary>;
}
```
Initial implementation: GitHub REST or local git, whichever best fits runtime.
Configuration should support:
```text
NODEPAD_GITHUB_TOKEN
NODEPAD_GITHUB_REPOSITORY=owner/repo
NODEPAD_GITHUB_BRANCH=nodepad-backup
NODEPAD_GITHUB_PATH=nodepad-workspaces
NODEPAD_GITHUB_SYNC=true
```
Do not expose these values to the client bundle.
12.5 Commit policy
Heartbeat checks whether the workspace is dirty. If so:
debounce commits (suggested minimum 10 minutes; configurable).
batch all workspace changes into one commit.
commit only after local state validates.
commit message:
```text
nodepad(<workspace>): heartbeat <run-id> — +12 evidence, 4 hypotheses updated, 1 promoted
```
record resulting commit SHA in local heartbeat history.
never force push automatically.
on non-fast-forward/conflict: stop sync, mark `sync_conflict`, preserve local data, require merge/reconcile or use a new recovery branch.
12.6 Restore
Expose UI/API operations:
restore latest backup.
restore by commit SHA.
restore by tag/snapshot.
preview diff before destructive restore.
restore into a new workspace by default.
explicit “replace current workspace” requires confirmation and creates a pre-restore local snapshot first.
Restore procedure:
Fetch selected ref.
Validate schema/version.
Run migrations into current schema.
Run full graph/data validation.
Materialize into a staging workspace.
Compare counts/hashes.
Activate only after validation succeeds.
Record restore event with source commit SHA.
12.7 Snapshot tags
Allow meaningful milestones to create tags or named snapshot metadata:
`pre-pivot`
`post-customer-interviews`
`qualified-v1`
`pre-major-experiment`
---
13. Persistence layer
Current browser `localStorage` remains supported for legacy/offline mode, but continuous heartbeat requires server-side persistence.
Create a persistence abstraction:
```ts
interface NodepadStore {
  getWorkspace(id: string): Promise<Workspace>;
  saveWorkspace(workspace: Workspace): Promise<void>;
  listNodes(workspaceId: string, filter?: NodeFilter): Promise<KnowledgeNode[]>;
  upsertNode(node: KnowledgeNode): Promise<void>;
  upsertEdge(edge: KnowledgeEdge): Promise<void>;
  appendEvent(event: DomainEvent): Promise<void>;
  acquireLease(workspaceId: string, owner: string, ttlMs: number): Promise<boolean>;
  releaseLease(workspaceId: string, owner: string): Promise<void>;
}
```
For this implementation pass, prefer the simplest durable backend that is safe for the existing repository (e.g. filesystem JSON/Markdown plus indexes or SQLite). Keep the interface backend-neutral so PostgreSQL can be added later.
Legacy `.nodepad` import must migrate old blocks into canonical nodes/edges.
---
14. Graph UX changes
14.1 Visual qualification state
The graph must visually distinguish hypothesis state without relying solely on color. Use a combination of:
badge/icon.
border style.
status label.
optional color.
Examples:
strongly disqualified → strike/stop marker.
disqualified → negative badge.
unresolved → hollow/question badge.
potentially qualified → rising badge.
provisionally qualified → check-outline.
qualified → solid check.
strongly qualified → double check/star.
contested → split/versus badge.
stale → clock badge.
14.2 Graph detail panel
For any hypothesis show:
statement.
qualification band + evidence score.
confidence.
supporting evidence.
contradicting evidence.
source diversity.
assumptions/dependencies.
alternative hypotheses.
evidence gaps.
latest research tasks.
what would disqualify it.
what would qualify it further.
dependent decisions/features/value propositions.
complete history.
14.3 Provenance trace
One click must answer:
> Why does this node exist?
Traverse:
```text
node → synthesis → hypotheses/evidence → original source/result
```
14.4 Heartbeat panel
Add a compact status surface:
last heartbeat.
next heartbeat.
new evidence count.
syntheses generated.
hypotheses created/changed.
hypotheses promoted/demoted/disqualified.
research tasks queued/running/blocked.
GitHub backup status + last commit SHA.
---
15. Validation and tests
Extract ideas from both Product-Eval's conformance checks and FindMeSaaS's validation harness.
Required validators:
```text
validateNode
validateEdge
validateEvidence
validateTheme
validateSynthesis
validateHypothesis
validateExperiment
validateDecision
validateBrainPromotion
validateWorkspace
validateGitSnapshot
validateWorkflowContracts
```
Test invariants:
Every edge endpoint exists.
Every evidence reference resolves.
Every hypothesis score can be recomputed.
Qualification band matches evidence score unless explicit logged override exists.
No `brain_knowledge` node is promoted below configured thresholds.
Contradicting evidence cannot be silently dropped during synthesis.
Research result cannot directly mutate final hypothesis band.
Heartbeat is idempotent for unchanged inputs.
Duplicate heartbeat execution cannot create duplicate hypotheses/evidence.
GitHub serialization → restore → serialization is semantically stable.
Legacy `.nodepad` import retains block text and relationships.
No secret-like configuration is included in Git backup exports.
A stale qualified hypothesis is visibly marked and scheduled for refresh.
A new contradiction can demote previously qualified brain knowledge.
Restore failure leaves current workspace untouched.
Add fixtures covering positive, negative, contested, stale and contradictory hypotheses.
---
16. Agency Agents readiness
Nodepad should be the shared reasoning/evidence substrate; Agency Agents should remain a separate workforce/role repository.
16.1 Stable API surface
Add versioned server service/API interfaces now, even if some routes initially wrap local services:
```text
GET    /api/v1/workspaces
GET    /api/v1/workspaces/:id/graph
GET    /api/v1/workspaces/:id/context

POST   /api/v1/workspaces/:id/evidence
GET    /api/v1/workspaces/:id/evidence

POST   /api/v1/workspaces/:id/hypotheses
GET    /api/v1/workspaces/:id/hypotheses
GET    /api/v1/workspaces/:id/hypotheses/:hypothesisId

POST   /api/v1/workspaces/:id/syntheses/run
POST   /api/v1/workspaces/:id/heartbeat

GET    /api/v1/workspaces/:id/research/tasks
POST   /api/v1/workspaces/:id/research/tasks/:taskId/results

GET    /api/v1/workspaces/:id/brain
POST   /api/v1/workspaces/:id/brain/export

GET    /api/v1/workspaces/:id/events

POST   /api/v1/workspaces/:id/github/backup
POST   /api/v1/workspaces/:id/github/restore
```
16.2 Agent attribution
All agent writes carry:
```ts
interface ActorContext {
  actorType: "human" | "agent" | "system";
  actorId: string;
  role?: string;
  sessionId?: string;
  agencyTaskId?: string;
  correlationId?: string;
}
```
Agents must not spoof human overrides.
16.3 Idempotency and concurrency
Agent-facing mutation endpoints accept an `Idempotency-Key`.
Use optimistic versioning or expected revision fields to prevent silent overwrites.
16.4 Events
Emit domain events suitable for later Agency Agents/Paperclip/n8n consumption:
```text
evidence.added
synthesis.generated
hypothesis.created
hypothesis.updated
hypothesis.qualified
hypothesis.disqualified
hypothesis.contested
hypothesis.stale
research_task.queued
research_task.completed
experiment.ready
brain.promoted
brain.demoted
github.backup_completed
github.restore_completed
heartbeat.completed
```
Provide an SSE/event-feed route later or in this pass if low risk.
16.5 Future MCP
Do not make MCP the internal architecture. Build services first, then expose them through an adapter.
Target MCP verbs later:
```text
nodepad_get_context
nodepad_query_graph
nodepad_add_evidence
nodepad_propose_hypothesis
nodepad_get_research_gaps
nodepad_claim_research_task
nodepad_submit_research_result
nodepad_run_synthesis
nodepad_get_brain
nodepad_get_changes
```
---
17. Agency role mapping
Later `agency-agents` specialists should interact with Nodepad as follows:
Customer Investigator
read high-priority research gaps.
claim tasks.
add interview/community/review evidence.
never set qualification directly.
Competitive Intelligence Agent
populate competitor/substitute evidence.
run S061–S070.
challenge positioning/value hypotheses.
Experiment Designer
consume S091–S100 and assumption map.
write experiment specs and thresholds.
Positioning/Copy Agent
consume S031–S040 and customer-language evidence.
produce message variants linked to hypotheses.
Red-Team/Kill Agent
request alternative explanations.
seek contradiction evidence.
identify false corroboration/source bias.
recommend explicit kill tests.
Portfolio Allocator
consume S111–S120.
allocate experiment/research capacity based on expected learning value.
This keeps Agency Agents stateless/lightweight relative to Nodepad's durable brain.
---
18. Security and safety
Keep all provider/GitHub tokens server-side or local secure config, never backed up.
Sanitize fetched content; treat fetched text as untrusted data, not instructions.
Maintain SSRF protections on URL-fetching routes.
Rate-limit externally reachable mutation/heartbeat routes.
Protect restore/delete/replace operations with explicit confirmation/auth.
Default social publishing/outreach integrations to human approval.
Preserve source terms/privacy boundaries and avoid collecting private data without authorization.
Never fabricate customer evidence, testimonials, traction or behavioral results.
Synthetic/prototype data must be labeled synthetic.
---
19. Implementation strategy for one safe Codex pass
The goal of a single pass is one coherent vertical slice, not perfection of every synthesis prompt.
Phase A — inventory and guardrails
Verify branch and clean worktree.
Run current Nodepad build/lint baseline; record pre-existing failures.
Inventory the four donor directories and identify reusable code/reference files.
Add `spec.md` to repository root.
Do not delete/move donor directories yet.
Phase B — canonical core
Implement:
canonical node/edge types.
evidence/hypothesis/synthesis types.
qualification bands.
deterministic scoring interface.
persistence abstraction.
filesystem/SQLite first backend.
event log.
validators.
Phase C — synthesis registry
Implement:
registry loader.
all 130 synthesis definitions as data/config.
generic synthesis runner with structured output.
input hashing/idempotency.
minimal deterministic post-processing.
hypothesis generation from synthesis results.
Specialize at least the highest-value core syntheses in this pass:
S001, S004, S006, S010.
S011–S020.
S031, S036, S038–S040.
S064, S066.
S091, S092, S098, S099.
S111–S114.
S121, S122, S124–S130.
The remaining definitions may initially use the generic synthesis runner, provided they honor the same schema/provenance contract.
Phase D — heartbeat and research
Implement:
heartbeat worker.
lease/idempotency.
dirty-state detection.
research task queue.
initial Venture Analyst provider adapters.
result ingestion.
automatic re-score.
External calls must be optional in tests and mockable.
Phase E — GitHub sync
Implement:
canonical Git serialization.
backup adapter.
env-based GitHub configuration.
dirty/debounced backup.
safe restore-to-new-workspace.
schema validation/migration hooks.
no force pushes.
If direct GitHub write integration cannot be fully exercised without credentials, implement the adapter and deterministic serializer/restore tests and make runtime fail clearly with actionable configuration errors.
Phase F — UI
Implement minimally invasive UI additions:
hypothesis qualification badges.
graph detail evidence/support/contradiction panels.
heartbeat status.
GitHub backup status.
manual “Run heartbeat” action.
manual “Backup now”.
restore browser/preview if safe; otherwise API/CLI restore plus documented UI follow-up.
Do not redesign the entire Nodepad visual system in this pass.
Phase G — Agency-ready API
Implement stable `/api/v1` service routes for at least:
graph/context read.
evidence write/read.
hypothesis read.
synthesis run.
heartbeat run/status.
research task list/result submit.
brain export.
GitHub backup/restore.
Use shared service functions so a later MCP adapter does not duplicate business logic.
Phase H — tests and documentation
Add:
unit tests for scoring/status bands.
graph integrity tests.
synthesis registry completeness test (`>=130`).
heartbeat idempotency test.
contradiction/demotion test.
brain promotion/demotion test.
serialization round-trip test.
GitHub restore staging/validation test.
legacy `.nodepad` compatibility test.
secret exclusion test.
Update README and add focused docs listed earlier.
---
20. Acceptance criteria
The implementation is acceptable when all of the following are true:
Nodepad still builds and existing classic views remain functional.
Four donor directories remain intact unless an extracted file is proven redundant and deletion is explicitly documented.
Canonical graph supports evidence, hypotheses, syntheses, experiments, results and decisions.
Evidence provenance and contradictions are first-class.
At least 130 synthesis definitions exist in a registry.
A generic runner can execute every registered synthesis through one contract.
Core synthesis definitions have specialized logic/prompts where specified.
New synthesis results can propose hypotheses.
Hypotheses have separate signed evidence score and confidence.
Qualification supports at least the 10 positive/negative bands described above plus contested/stale/unresearched overlays.
New evidence automatically re-scores affected hypotheses.
A strong contradiction can demote a previously qualified hypothesis.
Hypothesis Gardener proposes missing/counter/second-order hypotheses.
Heartbeat can run repeatedly without duplicating unchanged graph state.
Heartbeat can queue targeted research for high-value evidence gaps.
At least HN, GitHub and web research adapters are integrated or cleanly wrapped from Venture Analyst; Reddit/Trends may degrade gracefully if unavailable.
Every research result goes through evidence ingestion before influencing a hypothesis.
Brain export separates knowledge, active hypotheses and disqualified/archive material.
Brain promotion/demotion is deterministic and audited.
Workspace can serialize to diff-friendly GitHub files.
GitHub backup is debounced, non-force-pushing and excludes secrets.
Restore by Git ref/commit is validated in staging before activation.
Serialization→restore round-trip passes tests.
API routes expose shared services without duplicating scoring logic.
Agent writes have actor attribution/idempotency fields.
Existing `.nodepad` import/export remains usable or is migrated with explicit backwards-compatible handling.
Test suite covers graph integrity, scores, registry, heartbeat, brain, backup/restore and secret exclusion.
README documents how to start Nodepad + heartbeat worker and how to configure GitHub backup.
---
21. Recommended configuration
Example `.env.example` additions:
```bash
# Persistence
NODEPAD_DATA_DIR=./data
NODEPAD_STORE=file

# Heartbeat
NODEPAD_HEARTBEAT_ENABLED=true
NODEPAD_HEARTBEAT_INTERVAL_SECONDS=900
NODEPAD_HEARTBEAT_MODE=normal
NODEPAD_RESEARCH_ENABLED=true
NODEPAD_MAX_RESEARCH_TASKS_PER_HEARTBEAT=5
NODEPAD_MAX_COST_CLASS=free

# GitHub backup
NODEPAD_GITHUB_SYNC=false
NODEPAD_GITHUB_REPOSITORY=
NODEPAD_GITHUB_BRANCH=nodepad-backup
NODEPAD_GITHUB_PATH=nodepad-workspaces
NODEPAD_GITHUB_TOKEN=
NODEPAD_GITHUB_MIN_COMMIT_INTERVAL_SECONDS=600

# API
NODEPAD_API_KEY=
```
Paid provider escalation must default to disabled.
---
22. Suggested graph filters/views
Add saved graph filters that later agents can also query:
Qualified brain.
Potentially qualified.
Contested.
Disqualified.
Stale knowledge.
Highest research priority.
High-centrality weak assumptions.
Unresolved contradictions.
New since last heartbeat.
New since last Git backup.
New since last brain snapshot.
Value propositions and their evidence.
Experiments and what they test.
Decisions and their dependency chains.
Agency-agent authored nodes.
---
23. Event-sourced development history
Every important state transition should append a domain event, including old/new values where reasonable.
Example:
```json
{
  "id": "evt_...",
  "type": "hypothesis.qualification_changed",
  "workspaceId": "w1",
  "entityId": "H23",
  "at": "2026-10-04T21:00:00Z",
  "actor": {"type": "system", "id": "heartbeat"},
  "runId": "hb_...",
  "before": {"evidenceScore": 46, "qualification": "potentially_qualified"},
  "after": {"evidenceScore": 71, "qualification": "qualified"},
  "causedBy": ["E91", "E92"]
}
```
This event history is part of the developing brain: it records not only what Nodepad believes now, but how those beliefs evolved.
---
24. Calibration
Preserve Product-Eval's calibration principle: when real outcomes become known, compare prior qualification/confidence to outcomes and tune configurable weights rather than editing history.
Calibration may adjust:
evidence strength weights.
recency decay.
source-type multipliers.
diversity bonus.
behavioral evidence bonus.
qualification thresholds.
Calibration changes must be versioned, documented and applied prospectively/recomputed explicitly.
---
25. Success state
When this work is complete, Nodepad should be able to do the following without Agency Agents yet:
Receive a batch of customer feedback, URLs, notes or research results.
Normalize them into evidence.
Generate multiple typed syntheses from the same evidence.
Propose new hypotheses and counter-hypotheses.
Show why each hypothesis exists.
Calculate current qualification and confidence.
Identify the evidence most likely to change the decision.
Research that gap using free-first providers.
Ingest new evidence and automatically re-evaluate the hypothesis.
Visibly promote, demote, contest or disqualify hypotheses in the graph.
Grow second-order hypotheses and adjacent opportunities from the updated graph.
Promote robust propositions into a separate brain knowledge layer.
Preserve disqualified hypotheses as negative knowledge.
Continuously back up the workspace and brain to GitHub as normal files.
Restore safely from a previous Git commit.
Expose the graph, research tasks, evidence, syntheses and brain through stable APIs.
Later allow Agency Agents to become specialized workers operating on this shared brain rather than each maintaining separate truth.
That is the intended Nodepad vision.
