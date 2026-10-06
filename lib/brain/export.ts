import type { DomainEvent, HypothesisRecord, Workspace } from "../domain/types"
import { canPromote } from "../scoring/hypothesis"
import { stableId } from "../domain/id"
export interface BrainExport { manifest:{schemaVersion:1;workspaceId:string;generatedAt:string;counts:Record<string,number>}; summary:string; graph:unknown; knowledge:HypothesisRecord[]; hypotheses:HypothesisRecord[]; archive:HypothesisRecord[]; changelog:DomainEvent[] }
export function updateBrain(w: Workspace, runId: string) {
  let promoted = 0, demoted = 0
  const at = new Date().toISOString()
  const record = (event: DomainEvent) => {
    if (!w.brain.changelog.some(item => item.id === event.id)) w.brain.changelog.push(event)
    if (!w.events.some(item => item.id === event.id)) w.events.push(event)
  }
  for (const h of w.hypotheses) {
    const eligible = canPromote(h), was = w.brain.promotedIds.includes(h.id)
    if (eligible && !was) {
      w.brain.promotedIds.push(h.id); h.promoted = true; promoted++
      record({ id: stableId("evt", "brain.promoted", h.id, runId), type: "brain.promoted", workspaceId: w.id, entityId: h.id, at,
        actor: { actorType: "system", actorId: "brain-policy" }, runId, after: { qualification: h.qualification, confidence: h.confidence } })
    } else if (!eligible && was) {
      w.brain.promotedIds = w.brain.promotedIds.filter(id => id !== h.id); h.promoted = false; demoted++
      record({ id: stableId("evt", "brain.demoted", h.id, runId), type: "brain.demoted", workspaceId: w.id, entityId: h.id, at,
        actor: { actorType: "system", actorId: "brain-policy" }, runId, before: { promoted: true }, after: { qualification: h.qualification, confidence: h.confidence } })
    }
  }
  return { promoted, demoted }
}
export function exportBrain(w:Workspace):BrainExport {
 const generatedAt=w.brain.lastExportAt??w.updatedAt,knowledge=w.hypotheses.filter(h=>w.brain.promotedIds.includes(h.id)),archive=w.hypotheses.filter(h=>h.qualification.includes("disqualified")||h.status==="archived"||h.status==="superseded"),hypotheses=w.hypotheses.filter(h=>!knowledge.includes(h)&&!archive.includes(h));const recent=w.events.slice(-200),promoted=recent.filter(e=>e.type==="brain.promoted"),demoted=recent.filter(e=>e.type==="brain.demoted"),changes=recent.filter(e=>e.type==="hypothesis.qualification_changed"),contested=w.hypotheses.filter(h=>h.overlays.includes("contested")),stale=w.hypotheses.filter(h=>h.overlays.includes("stale")),priority=[...w.hypotheses].filter(h=>h.confidence<70).sort((a,b)=>b.strategicImportance-a.strategicImportance).slice(0,5),strongEvidence=[...w.evidence].sort((a,b)=>b.strength*b.weight-a.strength*a.weight).slice(0,5),proposals=w.nodes.filter(n=>n.metadata.proposal===true),opportunities=proposals.filter(n=>["opportunity","new_venture"].includes(String(n.metadata.proposalType))),secondOrder=proposals.filter(n=>["second_order","third_order_consequence"].includes(String(n.metadata.proposalType))),world=w.syntheses.filter(x=>x.synthesisType==="S130").slice(-3)
 const list=(items:string[])=>items.length?items.map(x=>`- ${x}`).join("\n"):"- None"
 const summary=`# ${w.name} brain\n\nGenerated ${generatedAt}. ${knowledge.length} qualified knowledge item(s), ${hypotheses.length} active hypothesis item(s), and ${archive.length} archived negative/historical item(s).\n\n## Newly promoted\n${list(promoted.map(e=>e.entityId??e.id))}\n\n## Newly demoted\n${list(demoted.map(e=>e.entityId??e.id))}\n\n## Qualification changes\n${list(changes.map(e=>`${e.entityId}: ${JSON.stringify(e.before)} → ${JSON.stringify(e.after)}`))}\n\n## Contested hypotheses\n${list(contested.map(h=>h.title))}\n\n## Strongest new evidence\n${list(strongEvidence.map(e=>`[${e.strength}/5] ${e.claim}`))}\n\n## Stale beliefs needing refresh\n${list(stale.map(h=>h.title))}\n\n## Highest-priority unresolved\n${list(priority.map(h=>`${h.title} (importance ${h.strategicImportance}, confidence ${h.confidence})`))}\n\n## Second-order insights\n${list(secondOrder.map(n=>n.title))}\n\n## Opportunities / venture candidates\n${list(opportunities.map(n=>n.title))}\n\n## World-model updates\n${list(world.map(x=>x.statement))}\n\n## Research queue\n- queued: ${w.researchTasks.filter(t=>t.status==="queued").length}\n- claimed/running: ${w.researchTasks.filter(t=>t.status==="claimed"||t.status==="running").length}\n- complete: ${w.researchTasks.filter(t=>t.status==="complete").length}\n`
 return{manifest:{schemaVersion:1,workspaceId:w.id,generatedAt,counts:{knowledge:knowledge.length,hypotheses:hypotheses.length,archive:archive.length}},summary,graph:{nodes:w.nodes,edges:w.edges},knowledge,hypotheses,archive,changelog:w.brain.changelog}
}
