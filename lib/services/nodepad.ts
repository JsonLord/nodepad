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
  async context(id: string) { const workspace = await this.store.getWorkspace(id); const githubConfigured=Boolean(process.env.NODEPAD_GITHUB_TOKEN&&process.env.NODEPAD_GITHUB_REPOSITORY),enabled=process.env.NODEPAD_GITHUB_SYNC==="true",mode=githubConfigured?"github":process.env.NODEPAD_BACKUP_REPO?"local":"none";const status=!enabled?"backup_disabled":mode==="github"?(workspace.backup?.status??"github_connected"):mode==="local"?(workspace.backup?.status??"local_backup_only"):"github_not_configured";return { id: workspace.id, name: workspace.name, revision: workspace.revision, heartbeat: workspace.heartbeat, backup: {...workspace.backup,mode,status} } }
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
  async queryGraph(id: string, query: { nodeId?: string; kind?: string; depth?: number; qualification?: string; important?: boolean; stale?: boolean; contested?: boolean } = {}) {
    const w = await this.store.getWorkspace(id), depth = Math.min(3, Math.max(0, query.depth ?? 1)), selected = new Set<string>()
    if (query.nodeId) { selected.add(query.nodeId); let frontier = [query.nodeId]; for (let d=0; d<depth; d++) { const next:string[]=[]; for(const edge of w.edges) if(frontier.includes(edge.sourceId)||frontier.includes(edge.targetId)){const id=frontier.includes(edge.sourceId)?edge.targetId:edge.sourceId;if(!selected.has(id)){selected.add(id);next.push(id)}} frontier=next } }
    else for(const node of w.nodes) if(!query.kind||node.kind===query.kind)selected.add(node.id)
    const hypotheses=w.hypotheses.filter(h=>(!query.qualification||h.qualification===query.qualification)&&(!query.important||h.strategicImportance>=70)&&(!query.stale||h.overlays.includes("stale"))&&(!query.contested||h.overlays.includes("contested")))
    for(const h of hypotheses)selected.add(h.id)
    return { nodes:w.nodes.filter(n=>selected.has(n.id)), edges:w.edges.filter(e=>selected.has(e.sourceId)&&selected.has(e.targetId)), hypotheses, revision:w.revision }
  }
  async researchTasks(id:string, filter:{status?:string;hypothesisId?:string;objective?:string;minPriority?:number}={}) { const w=await this.store.getWorkspace(id); return w.researchTasks.filter(t=>(!filter.status||t.status===filter.status)&&(!filter.hypothesisId||t.hypothesisIds.includes(filter.hypothesisId))&&(!filter.objective||t.objective===filter.objective)&&(filter.minPriority===undefined||t.priority>=filter.minPriority)) }
  async createResearchTask(id:string,input:Partial<import("../domain/types").ResearchTask>&{question:string;objective:import("../domain/types").ResearchTask["objective"]},actor:ActorContext,key?:string,expectedRevision?:number){const w=await this.store.getWorkspace(id);if(expectedRevision!==undefined&&w.revision!==expectedRevision)throw new Error(`revision_conflict:${w.revision}`);const taskId=key?stableId("task",id,key):newId("task"),existing=w.researchTasks.find(t=>t.id===taskId);if(existing)return existing;const task:import("../domain/types").ResearchTask={id:taskId,workspaceId:id,hypothesisIds:input.hypothesisIds??[],question:input.question,objective:input.objective,preferredSources:input.preferredSources??["hacker-news","github","web"],requiredSourceDiversity:input.requiredSourceDiversity??1,maxCostClass:input.maxCostClass??"free",status:"queued",priority:input.priority??50,attempts:0,maxAttempts:input.maxAttempts??3,createdBy:actor.actorId,revision:1};w.researchTasks.push(task);w.events.push({id:stableId("evt","research_task.queued",taskId),type:"research_task.queued",workspaceId:id,entityId:taskId,at:new Date().toISOString(),actor});await this.store.saveWorkspace(w);return task}
  async claimResearchTask(id:string,taskId:string,actor:ActorContext,ttlMs=300000){const owner=`claim:${actor.actorId}:${taskId}`;if(!await this.store.acquireLease(id,owner,10000))throw new Error("workspace_busy");try{const w=await this.store.getWorkspace(id),task=w.researchTasks.find(t=>t.id===taskId);if(!task)throw new Error("task_not_found");if(task.status!=="queued"&&!(task.status==="claimed"&&Date.parse(task.claimExpiresAt??"")<=Date.now()))throw new Error("task_already_claimed");task.status="claimed";task.claimedBy=actor.actorId;task.claimExpiresAt=new Date(Date.now()+Math.min(ttlMs,3600000)).toISOString();task.revision=(task.revision??0)+1;w.events.push({id:stableId("evt","research_task.claimed",taskId,actor.actorId),type:"research_task.claimed",workspaceId:id,entityId:taskId,at:new Date().toISOString(),actor,after:{claimExpiresAt:task.claimExpiresAt}});await this.store.saveWorkspace(w);return task}finally{await this.store.releaseLease(id,owner)}}
  async recordAgentEvent(id:string,input:{type:string;entityId?:string;after?:unknown},actor:ActorContext,key?:string,expectedRevision?:number){if(actor.actorType!=="agent"&&actor.actorType!=="system")throw new Error("agent_or_system_actor_required");const allowed=new Set(["agent.task_started","agent.evidence_submitted","agent.artifact_created","agent.handoff","agent.task_completed"]);if(!allowed.has(input.type))throw new Error("invalid_agent_event");const w=await this.store.getWorkspace(id);if(expectedRevision!==undefined&&w.revision!==expectedRevision)throw new Error(`revision_conflict:${w.revision}`);const event={id:key?stableId("evt",id,key):newId("evt"),type:input.type,workspaceId:id,entityId:input.entityId,at:new Date().toISOString(),actor,after:input.after};if(!w.events.some(e=>e.id===event.id))w.events.push(event);await this.store.saveWorkspace(w);return event}
  async portfolio(){return Promise.all((await this.store.listWorkspaces()).map(async w=>({workspaceId:w.id,name:w.name,qualifiedHypotheses:w.hypotheses.filter(h=>["qualified","strongly_qualified"].includes(h.qualification)).length,strongestQualification:w.hypotheses.sort((a,b)=>b.evidenceScore-a.evidenceScore)[0]?.qualification??"unresolved",unresolvedHighPriority:w.hypotheses.filter(h=>h.strategicImportance>=70&&h.confidence<70).length,brainKnowledge:w.brain.promotedIds.length,activeResearchTasks:w.researchTasks.filter(t=>["queued","claimed","running"].includes(t.status)).length,recentWorldModelChanges:w.syntheses.filter(x=>x.synthesisType==="S130").slice(-3).map(x=>x.statement),lastHeartbeat:w.heartbeat?.completedAt})))}
  async brain(id: string) { return exportBrain(await this.store.getWorkspace(id)) }
}
