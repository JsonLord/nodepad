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
export function exportBrain(w:Workspace):BrainExport{const generatedAt=w.brain.lastExportAt??w.updatedAt,knowledge=w.hypotheses.filter(h=>w.brain.promotedIds.includes(h.id)),archive=w.hypotheses.filter(h=>h.qualification.includes("disqualified")||h.status==="archived"||h.status==="superseded"),hypotheses=w.hypotheses.filter(h=>!knowledge.includes(h)&&!archive.includes(h));return{manifest:{schemaVersion:1,workspaceId:w.id,generatedAt,counts:{knowledge:knowledge.length,hypotheses:hypotheses.length,archive:archive.length}},summary:`# ${w.name} brain\n\nGenerated ${generatedAt}. ${knowledge.length} qualified knowledge item(s), ${hypotheses.length} active hypothesis item(s), and ${archive.length} archived negative/historical item(s).\n`,graph:{nodes:w.nodes,edges:w.edges},knowledge,hypotheses,archive,changelog:w.brain.changelog}}
