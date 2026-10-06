import type { EvidenceRecord, KnowledgeEdgeType, Workspace } from "../domain/types"

export interface SynthesisScope { nodeIds?: string[]; hypothesisId?: string; changedSince?: string; maxEvidence?: number; maxDistance?: number }
export interface ScopedEvidence { evidence: EvidenceRecord[]; nodeIds: string[]; supportIds: string[]; contradictionIds: string[] }
const TRAVERSE = new Set<KnowledgeEdgeType>(["supports","contradicts","derived_from","depends_on","applies_to","alternative_to","tests","produced","implies"])
const ageScore = (e: EvidenceRecord) => Math.max(0, 1 - (e.recencyDays ?? Math.max(0, (Date.now() - Date.parse(e.observedAt ?? e.ingestedAt)) / 86400000)) / 730)
export function selectSynthesisContext(workspace: Workspace, scope: SynthesisScope = {}): ScopedEvidence {
  const seeds = new Set(scope.nodeIds ?? []); if (scope.hypothesisId) seeds.add(scope.hypothesisId)
  const distance = new Map<string, number>(); for (const seed of seeds) distance.set(seed, 0)
  const queue = [...seeds], maxDistance = scope.maxDistance ?? 2
  while (queue.length) { const id = queue.shift()!, d = distance.get(id)!; if (d >= maxDistance) continue
    for (const edge of workspace.edges) { if (!TRAVERSE.has(edge.type)) continue; const next = edge.sourceId === id ? edge.targetId : edge.targetId === id ? edge.sourceId : undefined; if (next && !distance.has(next)) { distance.set(next, d + 1); queue.push(next) } }
  }
  const hypothesis = scope.hypothesisId ? workspace.hypotheses.find(h => h.id === scope.hypothesisId) : undefined
  const support = new Set(hypothesis?.supportingEvidence ?? []), contradiction = new Set(hypothesis?.contradictingEvidence ?? [])
  if (scope.hypothesisId) for (const edge of workspace.edges) { if (edge.targetId !== scope.hypothesisId) continue; if (edge.type === "supports") support.add(edge.sourceId); if (edge.type === "contradicts") contradiction.add(edge.sourceId) }
  let candidates = workspace.evidence.filter(e => !seeds.size || distance.has(e.id) || support.has(e.id) || contradiction.has(e.id))
  if (scope.changedSince) candidates = candidates.filter(e => Date.parse(e.ingestedAt) >= Date.parse(scope.changedSince!))
  const sourceSeen = new Set<string>()
  candidates.sort((a,b) => { const rank=(e:EvidenceRecord)=> (distance.has(e.id)?40/(1+distance.get(e.id)!):0)+e.strength*8+ageScore(e)*10+(e.evidenceType==="behavioral"?8:0)+(e.firstParty?6:0)+(sourceSeen.has(e.sourceId??e.sourceType)?0:3); return rank(b)-rank(a) })
  const evidence = candidates.slice(0, Math.max(1, scope.maxEvidence ?? 80)); evidence.forEach(e=>sourceSeen.add(e.sourceId??e.sourceType))
  return { evidence, nodeIds: [...distance.keys()], supportIds: evidence.filter(e=>support.has(e.id)).map(e=>e.id), contradictionIds: evidence.filter(e=>contradiction.has(e.id)).map(e=>e.id) }
}
