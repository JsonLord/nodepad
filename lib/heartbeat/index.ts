import type { EvidenceRecord, HeartbeatSummary, HypothesisProposal, KnowledgeEdgeType, Workspace } from "../domain/types"
import type { NodepadStore } from "../persistence/store"
import { stableId } from "../domain/id"
import { scoreHypothesis } from "../scoring/hypothesis"
import { executeSynthesis } from "../synthesis/runner"
import { matchOrCreateHypothesis } from "../hypotheses/matching"
import { garden, proposalsAsNodes } from "../gardener"
import { updateBrain } from "../brain/export"
import { validateWorkspace } from "../validation"
import { backupWorkspace, type BackupRemote } from "../github-sync/backup"
import { defaultProviders, executeResearch, type ResearchProvider } from "../research/providers"

const PHASES = ["ingest", "dedupe", "evidence_quality", "themes", "syntheses", "hypothesis_generation", "hypothesis_matching", "rescore", "gap_planning", "targeted_research", "result_ingestion", "second_rescore", "graph_maintenance", "brain_promotion_demotion", "staleness", "github_backup", "event_summary"]
const SYNTHESIS_IDS = ["S012", "S031", "S038", "S051", "S091", "S121", "S122", "S124", "S127", "S128", "S130"]
const STOP_WORDS = new Set(["the", "and", "that", "this", "with", "from", "have", "users", "user", "into", "when", "where", "their", "they", "for"])
const nowIso = (now: Date) => now.toISOString()

function ensureNode(workspace: Workspace, id: string, kind: Workspace["nodes"][number]["kind"], title: string, body: string, runId: string, metadata: Record<string, unknown> = {}) {
  if (!workspace.nodes.some(node => node.id === id)) workspace.nodes.push({ id, workspaceId: workspace.id, kind, title, body, metadata,
    provenance: { origin: "system", actorId: "heartbeat", runId, createdAt: new Date().toISOString() }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 })
}
function ensureEdge(workspace: Workspace, sourceId: string, targetId: string, type: KnowledgeEdgeType, runId: string) {
  const id = stableId("edge", sourceId, type, targetId)
  if (!workspace.edges.some(edge => edge.id === id)) workspace.edges.push({ id, workspaceId: workspace.id, sourceId, targetId, type,
    provenance: { origin: "system", actorId: "heartbeat", runId, createdAt: new Date().toISOString() }, createdAt: new Date().toISOString() })
}
function evidenceIdentity(item: EvidenceRecord) {
  return stableId("evidence-identity", item.sourceId ?? "", item.sourceRef ?? item.sourceUrl ?? "", item.claim.toLowerCase().replace(/\s+/g, " ").trim())
}
function dedupe(workspace: Workspace) {
  const canonical = new Map<string, EvidenceRecord>(), replacements = new Map<string, string>()
  for (const item of workspace.evidence) {
    const identity = evidenceIdentity(item), existing = canonical.get(identity)
    if (existing) { replacements.set(item.id, existing.id); existing.corroboratedBy = [...new Set([...existing.corroboratedBy, item.id, ...item.corroboratedBy])] }
    else canonical.set(identity, item)
  }
  workspace.evidence = [...canonical.values()]
  for (const hypothesis of workspace.hypotheses) {
    hypothesis.supportingEvidence = [...new Set(hypothesis.supportingEvidence.map(id => replacements.get(id) ?? id))]
    hypothesis.contradictingEvidence = [...new Set(hypothesis.contradictingEvidence.map(id => replacements.get(id) ?? id))]
  }
  const results = new Map<string, Workspace["researchResults"][number]>()
  for (const result of workspace.researchResults) results.set(stableId("result-identity", result.taskId, result.providerId, result.url ?? result.title), result)
  workspace.researchResults = [...results.values()]
}
function refreshThemes(workspace: Workspace, runId: string) {
  const groups = new Map<string, EvidenceRecord[]>()
  for (const evidence of workspace.evidence) {
    const words = evidence.claim.toLowerCase().match(/[a-z0-9]{4,}/g)?.filter(word => !STOP_WORDS.has(word)) ?? ["uncategorized"]
    const key = [...new Set(words)].sort()[0] ?? "uncategorized"
    groups.set(key, [...(groups.get(key) ?? []), evidence])
    ensureNode(workspace, evidence.id, "evidence", evidence.claim.slice(0, 100), evidence.claim, runId, { strength: evidence.strength })
  }
  for (const [key, evidence] of groups) {
    const id = stableId("theme", workspace.id, key)
    const existing = workspace.nodes.find(node => node.id === id)
    if (existing) { existing.body = `${evidence.length} evidence item(s) about ${key}`; existing.updatedAt = new Date().toISOString() }
    else ensureNode(workspace, id, "theme", `Theme: ${key}`, `${evidence.length} evidence item(s) about ${key}`, runId, { clusterKey: key })
    for (const item of evidence) ensureEdge(workspace, item.id, id, "implies", runId)
  }
}
function appendEvent(workspace: Workspace, type: string, entityId: string, runId: string, before?: unknown, after?: unknown) {
  const id = stableId("evt", type, entityId, runId)
  if (!workspace.events.some(event => event.id === id)) workspace.events.push({ id, type, workspaceId: workspace.id, entityId,
    at: new Date().toISOString(), actor: { actorType: "system", actorId: "heartbeat" }, runId, before, after })
}
function ingestResearchResults(workspace: Workspace, runId: string) {
  let count = 0
  for (const result of workspace.researchResults) {
    const task = workspace.researchTasks.find(item => item.id === result.taskId)
    if (!task) continue
    const evidenceId = stableId("ev", result.taskId, result.providerId, result.url ?? result.title)
    let evidence = workspace.evidence.find(item => item.id === evidenceId)
    if (!evidence) {
      evidence = { id: evidenceId, workspaceId: workspace.id, claim: `${result.title}: ${result.excerpt}`, sourceType: result.providerId,
        sourceRef: result.id, sourceUrl: result.url, strength: 3, weight: 1, stale: false, corroboratedBy: [], contradicts: [],
        observedAt: result.publishedAt, ingestedAt: result.retrievedAt, evidenceType: "stated",
        provenance: { origin: "research", actorId: result.providerId, runId, sourceRef: result.taskId, createdAt: result.retrievedAt } }
      workspace.evidence.push(evidence); count++; appendEvent(workspace, "evidence.added", evidence.id, runId)
    }
    ensureNode(workspace, task.id, "research_task", task.question, task.question, runId, { objective: task.objective })
    ensureNode(workspace, result.id, "result", result.title, result.excerpt, runId, { taskId: task.id, providerId: result.providerId })
    ensureNode(workspace, evidence.id, "evidence", evidence.claim.slice(0, 100), evidence.claim, runId, { taskId: task.id, providerId: result.providerId })
    ensureEdge(workspace, task.id, result.id, "produced", runId); ensureEdge(workspace, result.id, evidence.id, "produced", runId)
    for (const hypothesisId of task.hypothesisIds) {
      const hypothesis = workspace.hypotheses.find(item => item.id === hypothesisId); if (!hypothesis) continue
      const relation = result.relation ?? (task.objective === "support" ? "supports" : task.objective === "disconfirm" ? "contradicts" : "neutral")
      if (relation === "supports") { hypothesis.supportingEvidence = [...new Set([...hypothesis.supportingEvidence, evidence.id])]; ensureEdge(workspace, evidence.id, hypothesis.id, "supports", runId) }
      if (relation === "contradicts") { hypothesis.contradictingEvidence = [...new Set([...hypothesis.contradictingEvidence, evidence.id])]; ensureEdge(workspace, evidence.id, hypothesis.id, "contradicts", runId) }
    }
    task.status = "complete"; appendEvent(workspace, "research_task.completed", task.id, runId)
  }
  return count
}
function updateStaleness(workspace: Workspace, runId: string, now: Date) {
  const maxAgeDays = Number(process.env.NODEPAD_EVIDENCE_STALE_DAYS ?? 365), cutoff = now.getTime() - maxAgeDays * 86400000
  for (const evidence of workspace.evidence) evidence.stale = Date.parse(evidence.observedAt ?? evidence.ingestedAt) < cutoff
  let queued = 0
  for (const hypothesis of workspace.hypotheses) {
    const supporting = hypothesis.supportingEvidence.map(id => workspace.evidence.find(item => item.id === id)).filter(Boolean) as EvidenceRecord[]
    const mostlyStale = supporting.length > 0 && supporting.filter(item => item.stale).length / supporting.length >= .5
    hypothesis.overlays = hypothesis.overlays.filter(item => item !== "stale")
    if (mostlyStale) hypothesis.overlays.push("stale")
    if (mostlyStale && hypothesis.strategicImportance >= 60) {
      const id = stableId("task", hypothesis.id, "refresh", maxAgeDays)
      if (!workspace.researchTasks.some(task => task.id === id)) { workspace.researchTasks.push({ id, workspaceId: workspace.id, hypothesisIds: [hypothesis.id], question: `Refresh evidence for: ${hypothesis.statement}`, objective: "refresh", preferredSources: ["hacker-news", "github", "web"], requiredSourceDiversity: 2, maxCostClass: "free", status: "queued", priority: hypothesis.strategicImportance, attempts: 0, maxAttempts: 3, createdBy: "staleness", runId }); queued++; appendEvent(workspace, "research_task.queued", id, runId) }
    }
  }
  return queued
}

export interface HeartbeatOptions { runId?: string; backup?: BackupRemote; now?: Date; providers?: ResearchProvider[]; synthesisIds?: string[] }
export async function runHeartbeat(store: NodepadStore, workspaceId: string, options: HeartbeatOptions = {}): Promise<HeartbeatSummary> {
  const now = options.now ?? new Date(), startedAt = nowIso(now), runId = options.runId ?? stableId("hb", workspaceId, startedAt.slice(0, 16)), owner = `${process.pid}:${runId}`
  const blank = { runId, workspaceId, startedAt, completedAt: nowIso(now), status: "skipped" as const, phases: [], newEvidence: 0, synthesesGenerated: 0, hypothesesChanged: 0, researchTasksQueued: 0, promoted: 0, demoted: 0 }
  if (!await store.acquireLease(workspaceId, owner, 300000)) return blank
  try {
    const workspace = await store.getWorkspace(workspaceId)
    if (workspace.events.some(event => event.type === "heartbeat.completed" && event.runId === runId)) return blank
    const summary: HeartbeatSummary = { ...blank, status: "running", completedAt: undefined }
    let proposals: Array<{ synthesisId: string; proposal: HypothesisProposal }> = []
    for (const phase of PHASES) {
      summary.phases.push(phase)
      if (phase === "ingest") {
        for (const evidence of workspace.evidence) ensureNode(workspace, evidence.id, "evidence", evidence.claim.slice(0, 100), evidence.claim, runId)
        for (const hypothesis of workspace.hypotheses) ensureNode(workspace, hypothesis.id, "hypothesis", hypothesis.title, hypothesis.statement, runId, { hypothesisType: hypothesis.hypothesisType })
      }
      if (phase === "dedupe") dedupe(workspace)
      if (phase === "themes") refreshThemes(workspace, runId)
      if (phase === "syntheses" && workspace.evidence.length) for (const id of options.synthesisIds ?? SYNTHESIS_IDS) {
        const execution = await executeSynthesis(workspace, id, runId); if (!execution.reused) summary.synthesesGenerated++
        proposals.push(...execution.proposals.map(proposal => ({ synthesisId: execution.result.id, proposal })))
      }
      if (phase === "hypothesis_generation") for (const item of proposals) item.proposal.derivedFrom = [...new Set([...item.proposal.derivedFrom, item.synthesisId])]
      if (phase === "hypothesis_matching") for (const item of proposals) {
        const matched = matchOrCreateHypothesis(workspace, item.proposal, item.synthesisId, runId)
        const synthesis = workspace.syntheses.find(value => value.id === item.synthesisId)!
        synthesis.generatedHypotheses = [...new Set([...synthesis.generatedHypotheses, matched.hypothesis.id])]
      }
      if (phase === "rescore" || phase === "second_rescore") workspace.hypotheses = workspace.hypotheses.map(hypothesis => {
        const before = { evidenceScore: hypothesis.evidenceScore, qualification: hypothesis.qualification }
        const next = scoreHypothesis(hypothesis, workspace.evidence, now.getTime())
        if (next.evidenceScore !== before.evidenceScore || next.qualification !== before.qualification) { summary.hypothesesChanged++; appendEvent(workspace, "hypothesis.qualification_changed", next.id, runId, before, { evidenceScore: next.evidenceScore, qualification: next.qualification }) }
        return next
      })
      if (phase === "gap_planning") for (const hypothesis of workspace.hypotheses.filter(item => item.strategicImportance >= 50 && item.confidence < 70)) {
        const objective = hypothesis.supportingEvidence.length ? "disconfirm" : "support", id = stableId("task", hypothesis.id, objective, hypothesis.statement)
        if (!workspace.researchTasks.some(task => task.id === id)) { workspace.researchTasks.push({ id, workspaceId: workspace.id, hypothesisIds: [hypothesis.id], question: `Find ${objective}ing evidence for: ${hypothesis.statement}`, objective, preferredSources: ["hacker-news", "github", "web"], requiredSourceDiversity: 1, maxCostClass: "free", status: "queued", priority: Math.round(hypothesis.strategicImportance * hypothesis.uncertainty / 100), attempts: 0, maxAttempts: 3, createdBy: "gap-planner", runId }); summary.researchTasksQueued++; appendEvent(workspace, "research_task.queued", id, runId) }
      }
      if (phase === "targeted_research") {
        const limit = Math.max(0, Number(process.env.NODEPAD_MAX_RESEARCH_TASKS_PER_HEARTBEAT ?? 5))
        const due = workspace.researchTasks.filter(task => task.status === "queued" && task.attempts < task.maxAttempts && (!task.notBefore || Date.parse(task.notBefore) <= now.getTime())).sort((a, b) => b.priority - a.priority).slice(0, limit)
        for (const task of due) { task.status = "running"; task.attempts++; const results = await executeResearch(task, options.providers ?? defaultProviders()); for (const result of results) if (!workspace.researchResults.some(item => item.id === result.id)) workspace.researchResults.push(result); task.status = results.length ? "running" : task.attempts >= task.maxAttempts ? "failed" : "queued" }
      }
      if (phase === "result_ingestion") summary.newEvidence += ingestResearchResults(workspace, runId)
      if (phase === "graph_maintenance") { const nodes = proposalsAsNodes(workspace, garden(workspace), runId); for (const node of nodes) if (!workspace.nodes.some(item => item.id === node.id)) workspace.nodes.push(node) }
      if (phase === "brain_promotion_demotion") Object.assign(summary, updateBrain(workspace, runId))
      if (phase === "staleness") {
        summary.researchTasksQueued += updateStaleness(workspace, runId, now)
        workspace.hypotheses = workspace.hypotheses.map(hypothesis => {
          const scored = scoreHypothesis(hypothesis, workspace.evidence, now.getTime())
          const support = scored.supportingEvidence.map(id => workspace.evidence.find(item => item.id === id)).filter(Boolean) as EvidenceRecord[]
          if (support.length && support.filter(item => item.stale).length / support.length >= .5 && !scored.overlays.includes("stale")) scored.overlays.push("stale")
          return scored
        })
        const transitions = updateBrain(workspace, runId); summary.promoted += transitions.promoted; summary.demoted += transitions.demoted
      }
      if (phase === "github_backup" && options.backup) { const result = await backupWorkspace(workspace, options.backup); summary.backupCommitSha = result.commitSha; workspace.backup = { lastCommitSha: result.commitSha, lastBackupAt: nowIso(now), status: result.conflict ? "sync_conflict" : result.skipped ? "clean" : "completed" } }
    }
    const check = validateWorkspace(workspace); if (!check.valid) throw new Error(check.errors.join("; "))
    summary.status = "completed"; summary.completedAt = nowIso(now); workspace.heartbeat = summary
    appendEvent(workspace, "heartbeat.completed", runId, runId, undefined, summary); await store.saveWorkspace(workspace); return summary
  } finally { await store.releaseLease(workspaceId, owner) }
}
