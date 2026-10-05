import type { ActorContext, EvidenceRecord, HypothesisRecord, KnowledgeEdgeType, ResearchResult } from "../domain/types"
import type { NodepadStore } from "../persistence/store"
import { newId, stableId } from "../domain/id"
import { scoreHypothesis } from "../scoring/hypothesis"
import { executeSynthesis } from "../synthesis/runner"
import { matchOrCreateHypothesis } from "../hypotheses/matching"
import { exportBrain } from "../brain/export"

export class NodepadService {
  constructor(public store: NodepadStore) {}
  async workspaces() { return this.store.listWorkspaces() }
  async graph(id: string) { const workspace = await this.store.getWorkspace(id); return { nodes: workspace.nodes, edges: workspace.edges } }
  async context(id: string) { const workspace = await this.store.getWorkspace(id); return { id: workspace.id, name: workspace.name, revision: workspace.revision, heartbeat: workspace.heartbeat, backup: workspace.backup } }
  async addEvidence(id: string, input: Partial<EvidenceRecord> & { claim: string }, actor: ActorContext, key?: string) {
    const workspace = await this.store.getWorkspace(id), at = new Date().toISOString()
    const evidenceId = key ? stableId("ev", id, key) : newId("ev"), found = workspace.evidence.find(item => item.id === evidenceId)
    if (found) return found
    const evidence: EvidenceRecord = { ...input, id: evidenceId, workspaceId: id, claim: input.claim,
      sourceType: input.sourceType ?? "user_note", strength: input.strength ?? 3, weight: input.weight ?? 1,
      stale: false, corroboratedBy: input.corroboratedBy ?? [], contradicts: input.contradicts ?? [], ingestedAt: at,
      provenance: { origin: actor.actorType === "human" ? "human" : actor.actorType, actorId: actor.actorId, createdAt: at } }
    workspace.evidence.push(evidence)
    workspace.nodes.push({ id: evidence.id, workspaceId: id, kind: "evidence", title: evidence.claim.slice(0, 100), body: evidence.claim,
      metadata: { sourceType: evidence.sourceType }, provenance: evidence.provenance, createdAt: at, updatedAt: at, version: 1 })
    workspace.events.push({ id: stableId("evt", "evidence.added", evidenceId), type: "evidence.added", workspaceId: id, entityId: evidenceId, at, actor })
    workspace.hypotheses = workspace.hypotheses.map(hypothesis => scoreHypothesis(hypothesis, workspace.evidence))
    await this.store.saveWorkspace(workspace); return evidence
  }
  async createHypothesis(id: string, input: Partial<HypothesisRecord> & { statement: string }, actor: ActorContext, key?: string) {
    const workspace = await this.store.getWorkspace(id), at = new Date().toISOString(), hypothesisId = key ? stableId("hyp", id, key) : newId("hyp")
    const found = workspace.hypotheses.find(item => item.id === hypothesisId); if (found) return found
    let hypothesis: HypothesisRecord = { id: hypothesisId, workspaceId: id, title: input.title ?? input.statement.slice(0, 80), statement: input.statement,
      hypothesisType: input.hypothesisType ?? "proposition", derivedFrom: input.derivedFrom ?? [], supportingEvidence: input.supportingEvidence ?? [],
      contradictingEvidence: input.contradictingEvidence ?? [], dependentAssumptions: input.dependentAssumptions ?? [], alternativeHypotheses: input.alternativeHypotheses ?? [],
      impact: input.impact ?? 50, uncertainty: input.uncertainty ?? 100, novelty: input.novelty ?? 50, strategicImportance: input.strategicImportance ?? 50,
      evidenceScore: 0, confidence: 0, qualification: "unresolved", overlays: ["unresearched"], sourceDiversity: 0, firstPartyWeight: 0,
      behavioralWeight: 0, freshnessScore: 0, status: "active", researchGaps: input.researchGaps ?? ["Independent disconfirming evidence"],
      createdAt: at, updatedAt: at, generation: input.generation ?? { method: actor.actorType } }
    hypothesis = scoreHypothesis(hypothesis, workspace.evidence); workspace.hypotheses.push(hypothesis)
    workspace.nodes.push({ id: hypothesis.id, workspaceId: id, kind: "hypothesis", title: hypothesis.title, body: hypothesis.statement,
      metadata: { hypothesisType: hypothesis.hypothesisType }, provenance: { origin: actor.actorType, actorId: actor.actorId, createdAt: at }, createdAt: at, updatedAt: at, version: 1 })
    workspace.events.push({ id: stableId("evt", "hypothesis.created", hypothesisId), type: "hypothesis.created", workspaceId: id, entityId: hypothesisId, at, actor })
    await this.store.saveWorkspace(workspace); return hypothesis
  }
  async synthesize(id: string, type: string, actor: ActorContext, runId = newId("run")) {
    const workspace = await this.store.getWorkspace(id), execution = await executeSynthesis(workspace, type, runId)
    for (const proposal of execution.proposals) {
      const matched = matchOrCreateHypothesis(workspace, proposal, execution.result.id, runId)
      execution.result.generatedHypotheses = [...new Set([...execution.result.generatedHypotheses, matched.hypothesis.id])]
    }
    workspace.events.push({ id: stableId("evt", "synthesis.generated", execution.result.id), type: "synthesis.generated", workspaceId: id, entityId: execution.result.id, at: new Date().toISOString(), actor, runId })
    await this.store.saveWorkspace(workspace); return execution.result
  }
  async submitResearchResult(id: string, taskId: string, input: Omit<ResearchResult, "id" | "taskId" | "retrievedAt">, actor: ActorContext, key?: string) {
    const workspace = await this.store.getWorkspace(id), at = new Date().toISOString(), task = workspace.researchTasks.find(item => item.id === taskId)
    if (!task) throw new Error(`Research task ${taskId} not found`)
    const resultId = key ? stableId("result", id, key) : stableId("result", taskId, input.providerId, input.url ?? input.title)
    const previous = workspace.researchResults.find(item => item.id === resultId); if (previous) return previous
    const result: ResearchResult = { ...input, id: resultId, taskId, retrievedAt: at }; workspace.researchResults.push(result)
    const evidenceId = stableId("ev", taskId, input.providerId, input.url ?? input.title)
    const evidence: EvidenceRecord = { id: evidenceId, workspaceId: id, claim: `${input.title}: ${input.excerpt}`, sourceType: input.providerId,
      sourceRef: resultId, sourceUrl: input.url, strength: 3, weight: 1, stale: false, corroboratedBy: [], contradicts: [],
      observedAt: input.publishedAt, ingestedAt: at, evidenceType: "stated", provenance: { origin: "research", actorId: input.providerId, sourceRef: taskId, createdAt: at } }
    workspace.evidence.push(evidence)
    const addNode = (nodeId: string, kind: "research_task" | "result" | "evidence", title: string, body: string) => { if (!workspace.nodes.some(node => node.id === nodeId)) workspace.nodes.push({ id: nodeId, workspaceId: id, kind, title, body, metadata: {}, provenance: { origin: "research", actorId: actor.actorId, createdAt: at }, createdAt: at, updatedAt: at, version: 1 }) }
    addNode(task.id, "research_task", task.question, task.question); addNode(result.id, "result", result.title, result.excerpt); addNode(evidence.id, "evidence", evidence.claim.slice(0, 100), evidence.claim)
    const addEdge = (sourceId: string, targetId: string, type: KnowledgeEdgeType) => { const edgeId = stableId("edge", sourceId, type, targetId); if (!workspace.edges.some(edge => edge.id === edgeId)) workspace.edges.push({ id: edgeId, workspaceId: id, sourceId, targetId, type, provenance: { origin: "research", actorId: actor.actorId, createdAt: at }, createdAt: at }) }
    addEdge(task.id, result.id, "produced"); addEdge(result.id, evidence.id, "produced")
    for (const hypothesisId of task.hypothesisIds) { const hypothesis = workspace.hypotheses.find(item => item.id === hypothesisId); if (!hypothesis) continue; const relation = result.relation ?? (task.objective === "support" ? "supports" : task.objective === "disconfirm" ? "contradicts" : "neutral"); if (relation === "supports") { hypothesis.supportingEvidence = [...new Set([...hypothesis.supportingEvidence, evidence.id])]; addEdge(evidence.id, hypothesis.id, "supports") } if (relation === "contradicts") { hypothesis.contradictingEvidence = [...new Set([...hypothesis.contradictingEvidence, evidence.id])]; addEdge(evidence.id, hypothesis.id, "contradicts") } }
    workspace.hypotheses = workspace.hypotheses.map(hypothesis => scoreHypothesis(hypothesis, workspace.evidence)); task.status = "complete"
    workspace.events.push({ id: stableId("evt", "research_task.completed", task.id, result.id), type: "research_task.completed", workspaceId: id, entityId: task.id, at, actor })
    await this.store.saveWorkspace(workspace); return result
  }
  async brain(id: string) { return exportBrain(await this.store.getWorkspace(id)) }
}
