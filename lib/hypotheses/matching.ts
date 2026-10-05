import type { HypothesisProposal, HypothesisRecord, KnowledgeEdge, Workspace } from "../domain/types"
import { scoreHypothesis } from "../scoring/hypothesis"
import { stableId } from "../domain/id"

export const normalizeHypothesisText = (value: string) => value
  .toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()

export function hypothesisIdentity(proposal: Pick<HypothesisProposal, "statement" | "hypothesisType">) {
  return stableId("hyp", proposal.hypothesisType, normalizeHypothesisText(proposal.statement))
}

function similarity(a: string, b: string) {
  const left = new Set(normalizeHypothesisText(a).split(" ").filter(Boolean))
  const right = new Set(normalizeHypothesisText(b).split(" ").filter(Boolean))
  const overlap = [...left].filter(word => right.has(word)).length
  return overlap / Math.max(1, new Set([...left, ...right]).size)
}

function edge(workspace: Workspace, sourceId: string, targetId: string, type: KnowledgeEdge["type"], runId: string) {
  const id = stableId("edge", sourceId, type, targetId)
  if (!workspace.edges.some(item => item.id === id)) workspace.edges.push({
    id, workspaceId: workspace.id, sourceId, targetId, type,
    provenance: { origin: "system", actorId: "hypothesis-matcher", runId, createdAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
  })
}

export function matchOrCreateHypothesis(workspace: Workspace, proposal: HypothesisProposal, synthesisId: string, runId: string) {
  const normalized = normalizeHypothesisText(proposal.statement)
  let hypothesis = workspace.hypotheses.find(item =>
    item.id === hypothesisIdentity(proposal) ||
    (item.hypothesisType === proposal.hypothesisType && normalizeHypothesisText(item.statement) === normalized),
  )
  let created = false
  const now = new Date().toISOString()
  if (!hypothesis) {
    hypothesis = {
      id: hypothesisIdentity(proposal), workspaceId: workspace.id,
      title: proposal.title ?? proposal.statement.slice(0, 100), statement: proposal.statement,
      hypothesisType: proposal.hypothesisType, derivedFrom: [...new Set(proposal.derivedFrom)],
      supportingEvidence: [...new Set(proposal.supportingEvidence ?? [])],
      contradictingEvidence: [...new Set(proposal.contradictingEvidence ?? [])],
      dependentAssumptions: [...new Set(proposal.dependentAssumptions ?? [])], alternativeHypotheses: [],
      impact: proposal.impact ?? 50, uncertainty: proposal.uncertainty ?? 70, novelty: 50,
      strategicImportance: proposal.strategicImportance ?? 60, evidenceScore: 0, confidence: 0,
      qualification: "unresolved", overlays: ["unresearched"], sourceDiversity: 0,
      firstPartyWeight: 0, behavioralWeight: 0, freshnessScore: 0, status: "active",
      researchGaps: ["Independent evidence", "Attempted falsification"], createdAt: now, updatedAt: now,
      generation: { method: "synthesis", synthesisType: synthesisId, runId },
    }
    hypothesis = scoreHypothesis(hypothesis, workspace.evidence)
    workspace.hypotheses.push(hypothesis)
    workspace.nodes.push({ id: hypothesis.id, workspaceId: workspace.id, kind: "hypothesis", title: hypothesis.title,
      body: hypothesis.statement, metadata: { hypothesisType: hypothesis.hypothesisType, proposalRationale: proposal.rationale },
      provenance: { origin: "ai", actorId: "synthesis-runner", runId, createdAt: now }, createdAt: now, updatedAt: now, version: 1 })
    workspace.events.push({ id: stableId("evt", "hypothesis.created", hypothesis.id), type: "hypothesis.created",
      workspaceId: workspace.id, entityId: hypothesis.id, at: now, actor: { actorType: "system", actorId: "hypothesis-matcher" }, runId })
    created = true
  } else {
    hypothesis.derivedFrom = [...new Set([...hypothesis.derivedFrom, ...proposal.derivedFrom])]
    hypothesis.supportingEvidence = [...new Set([...hypothesis.supportingEvidence, ...(proposal.supportingEvidence ?? [])])]
    hypothesis.contradictingEvidence = [...new Set([...hypothesis.contradictingEvidence, ...(proposal.contradictingEvidence ?? [])])]
  }
  edge(workspace, synthesisId, hypothesis.id, "implies", runId)
  for (const other of workspace.hypotheses) {
    if (other.id === hypothesis.id || other.hypothesisType !== hypothesis.hypothesisType) continue
    const score = similarity(other.statement, hypothesis.statement)
    if (score >= .75 && other.createdAt < hypothesis.createdAt) edge(workspace, hypothesis.id, other.id, "supersedes", runId)
    else if (score >= .35 && score < .75) {
      edge(workspace, hypothesis.id, other.id, "alternative_to", runId)
      hypothesis.alternativeHypotheses = [...new Set([...hypothesis.alternativeHypotheses, other.id])]
    }
  }
  return { hypothesis, created }
}
