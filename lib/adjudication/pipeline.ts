import { createHash } from "node:crypto"
import type { ActorContext, EvidenceAdjudication, EvidenceRecord, HypothesisRecord, ResearchResult, ResearchTask, Workspace } from "../domain/types"
import { stableId } from "../domain/id"
import { getEnvLlmConfig } from "../ai/openai-provider"
import { scoreHypothesis } from "../scoring/hypothesis"
import { createSemanticLayer, type SemanticLayer } from "../embeddings"
import { embeddingConfig } from "../embeddings/provider"
import { relevancePrefilter } from "../embeddings/relevance"
import { percentage, roleModel, safeReasoningText } from "../ai/reasoning"
import type { AdjudicationInput, EvidenceAdjudicator } from "./provider"
import { ADJUDICATION_VERSION, OpenAiEvidenceAdjudicator, uncertain, adjudicationSchema } from "./openai"
export function applyAdjudication(w: Workspace, record: EvidenceAdjudication, now = Date.now(), actor: ActorContext = { actorType: "system", actorId: "evidence-adjudicator" }) {
  w.adjudications ??= []
  if (w.adjudications.some(r => r.id === record.id)) return
  w.adjudications.push(record)
  const h = w.hypotheses.find(h => h.id === record.hypothesisId)
  if (!h || !w.evidence.some(e => e.id === record.evidenceId)) return
  const accepted = record.status === "completed" && record.relevance >= percentage("MIN_RELEVANCE", 60) && record.confidence >= percentage("MIN_CONFIDENCE", 65) && record.relation !== "uncertain"
  if (!accepted) return
  const before = { evidenceScore: h.evidenceScore, confidence: h.confidence, qualification: h.qualification, supportingEvidence: [...h.supportingEvidence], contradictingEvidence: [...h.contradictingEvidence] }
  h.supportingEvidence = h.supportingEvidence.filter(id => id !== record.evidenceId)
  h.contradictingEvidence = h.contradictingEvidence.filter(id => id !== record.evidenceId)
  if (record.relation === "supports") h.supportingEvidence.push(record.evidenceId)
  else if (record.relation === "contradicts") h.contradictingEvidence.push(record.evidenceId)
  w.edges = w.edges.filter(e => !(e.sourceId === record.evidenceId && e.targetId === h.id && ["supports", "contradicts"].includes(e.type)))
  if (record.relation === "supports" || record.relation === "contradicts") w.edges.push({ id: stableId("edge", record.evidenceId, record.relation, h.id), workspaceId: w.id, sourceId: record.evidenceId, targetId: h.id, type: record.relation === "supports" ? "supports" : "contradicts", createdAt: record.createdAt,
    provenance: { origin: "system", actorId: actor.actorId, runId: record.runId, createdAt: record.createdAt, adjudicationId: record.id } })
  Object.assign(h, scoreHypothesis(h, w.evidence, now))
  const after = { evidenceScore: h.evidenceScore, confidence: h.confidence, qualification: h.qualification, supportingEvidence: [...h.supportingEvidence], contradictingEvidence: [...h.contradictingEvidence] }
  w.events.push({ id: stableId("evt", "hypothesis.qualification_changed", record.id), type: "hypothesis.qualification_changed", workspaceId: w.id, entityId: h.id, at: new Date(now).toISOString(), actor, runId: record.runId, before,
    after: { ...after, evidenceIds: [record.evidenceId], adjudicationIds: [record.id], relation: record.relation, rationale: record.rationale, relationChange: { before: before.supportingEvidence.includes(record.evidenceId) ? "supports" : before.contradictingEvidence.includes(record.evidenceId) ? "contradicts" : "none", after: record.relation } }, causedBy: [record.evidenceId, record.id] })
}
export async function adjudicateEvidence(w: Workspace, h: HypothesisRecord, evidence: EvidenceRecord, options: { result?: ResearchResult; task?: ResearchTask; runId: string; layer?: SemanticLayer; adjudicator?: EvidenceAdjudicator; now?: number }) {
  const inputHash = createHash("sha256").update(JSON.stringify([h.statement, h.strategicImportance, evidence.claim, evidence.sourceType, evidence.evidenceType, options.result?.title, options.result?.excerpt, options.task?.objective, getEnvLlmConfig().baseUrl, ADJUDICATION_VERSION, roleModel("adjudication"), roleModel("escalation"), embeddingConfig(), percentage("MIN_RELEVANCE",60), percentage("MIN_CONFIDENCE",65), percentage("ESCALATE_BELOW",70), percentage("ESCALATE_MIN_IMPORTANCE",70)])).digest("hex")
  const prior = w.adjudications?.findLast(a => a.hypothesisId === h.id && a.evidenceId === evidence.id)
  if (prior && prior.inputHash === inputHash && (!prior.fallback || prior.runId === options.runId)) return prior
  const relevance = await relevancePrefilter(evidence.claim, h.statement, options.layer ?? createSemanticLayer())
  const input: AdjudicationInput = { hypothesis: h, evidence, researchResult: options.result, task: options.task, semanticRelevance: relevance.score, runId: options.runId, inputHash }
  let record: EvidenceAdjudication
  if (!relevance.shouldAdjudicate) record = uncertain(input, "low_relevance")
  else {
    try { record = await (options.adjudicator ?? new OpenAiEvidenceAdjudicator()).adjudicate(input) } catch { record = uncertain(input) }
  }
  try {
    const interpreted = adjudicationSchema.parse({ relevance: record.relevance, relation: record.relation, directness: record.directness, confidence: record.confidence, rationale: safeReasoningText(record.rationale) })
    // Bind server-owned identity/provenance; injected providers cannot point to other entities.
    record = { ...uncertain(input), ...interpreted, provider: safeReasoningText(record.provider).slice(0,200), model: safeReasoningText(record.model).slice(0,200), status: record.status, fallback: record.fallback, escalated: record.escalated, attempts: record.attempts?.slice(0,2).map(a=>({model:safeReasoningText(a.model).slice(0,200),provider:safeReasoningText(a.provider).slice(0,200),confidence:a.confidence,outcome:a.outcome.slice(0,100)})) }
  } catch { record = uncertain(input) }
  if (options.result) options.result.metadata = { ...options.result.metadata, semanticRelevance: { ...(options.result.metadata?.semanticRelevance as object || {}), [h.id]: relevance.score ?? null } }
  applyAdjudication(w, record, options.now)
  return record
}
export function explicitAdjudication(w: Workspace, h: HypothesisRecord, evidence: EvidenceRecord, relation: EvidenceAdjudication["relation"], actor: ActorContext) {
  if (!["supports","contradicts","neutral","uncertain"].includes(relation)) throw new Error("invalid_evidence_relation")
  const input: AdjudicationInput = { hypothesis: h, evidence, runId: actor.correlationId || stableId("run", evidence.id), inputHash: stableId("explicit", evidence.id, h.id, relation) }
  const record = { ...uncertain(input), status: "completed" as const, relation, relevance: 100, confidence: 100, directness: "direct" as const, provider: "explicit-assertion", model: "", rationale: safeReasoningText(`Explicit ${actor.actorType} assertion by ${actor.actorId}; not inferred from research objective.`).slice(0,2000), fallback: false }
  applyAdjudication(w, record, Date.now(), actor)
  return record
}
