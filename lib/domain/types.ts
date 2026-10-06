export const KNOWLEDGE_NODE_KINDS = [
  "evidence", "source", "observation", "theme", "problem", "pain", "segment", "persona",
  "job_to_be_done", "assumption", "hypothesis", "counter_hypothesis", "insight", "opportunity",
  "value_proposition", "positioning", "message", "feature", "solution_concept", "pricing_hypothesis",
  "channel_hypothesis", "experiment", "research_task", "result", "metric", "decision", "pivot", "risk",
  "constraint", "brain_knowledge", "entity", "person", "organization", "objection",
] as const
export type KnowledgeNodeKind = typeof KNOWLEDGE_NODE_KINDS[number]

export const KNOWLEDGE_EDGE_TYPES = [
  "supports", "contradicts", "corroborates", "derived_from", "implies", "depends_on", "explains",
  "challenges", "alternative_to", "tests", "produced", "invalidates", "strengthens", "weakens",
  "supersedes", "causes", "blocks", "enables", "measures", "qualified_by", "disqualified_by",
  "mentions", "applies_to", "belongs_to", "precedes",
] as const
export type KnowledgeEdgeType = typeof KNOWLEDGE_EDGE_TYPES[number]
export type Origin = "human" | "system" | "ai" | "agent" | "import" | "research"
export interface ActorContext { actorType: "human" | "agent" | "system"; actorId: string; role?: string; sessionId?: string; agencyTaskId?: string; correlationId?: string }
export interface Provenance { origin: Origin; actorId?: string; runId?: string; confidence?: number; explanation?: string; sourceRef?: string; createdAt: string }
export interface KnowledgeNode { id: string; workspaceId: string; kind: KnowledgeNodeKind; title: string; body?: string; metadata: Record<string, unknown>; provenance: Provenance; createdAt: string; updatedAt: string; version: number }
export interface KnowledgeEdge { id: string; workspaceId: string; sourceId: string; targetId: string; type: KnowledgeEdgeType; provenance: Provenance; createdAt: string }
export interface EvidenceRecord { id: string; workspaceId: string; claim: string; sourceType: string; sourceRef?: string; sourceUrl?: string; sourceId?: string; persona?: string[]; funnelStage?: string; impactType?: string; strength: 1|2|3|4|5; recencyDays?: number; weight: number; stale: boolean; personId?: string|null; accountId?: string|null; corroboratedBy: string[]; contradicts: string[]; observedAt?: string; ingestedAt: string; provenance: Provenance; evidenceType?: "behavioral"|"stated"|"measured"|"synthetic"; firstParty?: boolean; reliability?: number }
export type HypothesisQualification = "strongly_disqualified"|"disqualified"|"leaning_disqualified"|"weakly_disfavored"|"unresolved"|"weak_signal"|"potentially_qualified"|"provisionally_qualified"|"qualified"|"strongly_qualified"
export type HypothesisOverlay = "unresearched"|"contested"|"stale"|"superseded"|"operationalized"
export interface HypothesisRecord { id: string; workspaceId: string; title: string; statement: string; hypothesisType: string; derivedFrom: string[]; supportingEvidence: string[]; contradictingEvidence: string[]; dependentAssumptions: string[]; alternativeHypotheses: string[]; impact: number; uncertainty: number; novelty: number; strategicImportance: number; evidenceScore: number; confidence: number; qualification: HypothesisQualification; overlays: HypothesisOverlay[]; sourceDiversity: number; firstPartyWeight: number; behavioralWeight: number; freshnessScore: number; status: "active"|"stale"|"superseded"|"archived"; researchGaps: string[]; nextResearchAt?: string; lastEvaluatedAt?: string; createdAt: string; updatedAt: string; generation: { method: string; synthesisType?: string; model?: string; runId?: string; generationConfidence?: number }; promoted?: boolean }
export interface SynthesisResult { id: string; synthesisType: string; workspaceId: string; title: string; statement: string; rationale: string; derivedFrom: string[]; supports: string[]; contradicts: string[]; unknowns: string[]; suggestedResearch: string[]; generatedHypotheses: string[]; generationConfidence: number; createdAt: string; runId: string; inputHash: string; status: "draft_ai"|"supported"|"contested"|"stale"|"superseded"|"promoted"; provenance: Provenance }
export interface HypothesisProposal { statement: string; title?: string; hypothesisType: string; derivedFrom: string[]; supportingEvidence?: string[]; contradictingEvidence?: string[]; dependentAssumptions?: string[]; strategicImportance?: number; impact?: number; uncertainty?: number; rationale?: string }
export type EvidenceRelation = "supports" | "contradicts" | "neutral"
export interface ResearchTask { id: string; workspaceId: string; hypothesisIds: string[]; question: string; objective: "support"|"disconfirm"|"discriminate"|"refresh"|"discover"; preferredSources: string[]; requiredSourceDiversity: number; maxCostClass: "local"|"free"|"free_quota"|"paid_optional"; status: "queued"|"claimed"|"running"|"blocked"|"complete"|"failed"|"cancelled"; priority: number; notBefore?: string; attempts: number; maxAttempts: number; createdBy: string; runId?: string; claimedBy?: string; claimExpiresAt?: string; revision?: number }
export interface ResearchResult { id: string; taskId: string; providerId: string; title: string; excerpt: string; url?: string; publishedAt?: string; retrievedAt: string; relation?: EvidenceRelation; hypothesisId?: string; metadata?: Record<string, unknown> }
export interface DomainEvent { id: string; type: string; workspaceId: string; entityId?: string; at: string; actor: ActorContext; runId?: string; before?: unknown; after?: unknown; causedBy?: string[] }
export interface Workspace { schemaVersion: 1; id: string; name: string; revision: number; nodes: KnowledgeNode[]; edges: KnowledgeEdge[]; evidence: EvidenceRecord[]; hypotheses: HypothesisRecord[]; syntheses: SynthesisResult[]; researchTasks: ResearchTask[]; researchResults: ResearchResult[]; events: DomainEvent[]; brain: { promotedIds: string[]; lastExportAt?: string; changelog: DomainEvent[] }; heartbeat?: HeartbeatSummary; backup?: { lastCommitSha?: string; lastBackupAt?: string; status?: string; snapshotHash?: string }; createdAt: string; updatedAt: string }
export interface HeartbeatSummary { runId: string; workspaceId: string; startedAt: string; completedAt?: string; status: "running"|"completed"|"skipped"|"failed"; phases: string[]; newEvidence: number; synthesesGenerated: number; hypothesesChanged: number; researchTasksQueued: number; promoted: number; demoted: number; backupCommitSha?: string; error?: string }
