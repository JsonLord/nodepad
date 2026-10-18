import type { EvidenceRecord, Workspace } from "../domain/types"
import { stableId } from "../domain/id"
import type { SemanticSimilarity } from "./index"
import { duplicateCompatible } from "./similarity"
import { threshold } from "./provider"
export function dedupeEvidence(workspace: Workspace, similarity?: SemanticSimilarity) {
  const canonical: EvidenceRecord[] = [], replacements = new Map<string, string>(), identities = new Map<string, EvidenceRecord>()
  for (const item of workspace.evidence) {
    const identity = (e: EvidenceRecord) => stableId("evidence-identity", e.sourceId ?? "", e.sourceRef ?? e.sourceUrl ?? "", e.claim.toLowerCase().replace(/\s+/g, " ").trim())
    const key = identity(item)
    const exact = identities.get(key)
    const duplicate = exact ?? (similarity ? canonical.find(e => {
      const score = similarity?.(e.claim, item.claim)
      if (score === undefined || score < threshold("EVIDENCE_DUP", .92) || !duplicateCompatible(e.claim, item.claim)) return false
      const conflict = workspace.hypotheses.some(h => h.supportingEvidence.includes(e.id) && h.contradictingEvidence.includes(item.id) || h.contradictingEvidence.includes(e.id) && h.supportingEvidence.includes(item.id))
      return !conflict
    }) : undefined)
    if (!duplicate) { canonical.push(item); identities.set(key, item); continue }
    identities.set(key, duplicate)
    replacements.set(item.id, duplicate.id)
    duplicate.corroboratedBy = [...new Set([...duplicate.corroboratedBy, item.id, ...item.corroboratedBy])]
    duplicate.aliases = [...new Set([...(duplicate.aliases || []), item.id, ...(item.aliases || [])])]
    // Retain full original records (including all source refs and provenance), not just IDs.
    duplicate.duplicateRecords = [...(duplicate.duplicateRecords || []), ...[item, ...(item.duplicateRecords || [])].map(({ duplicateRecords: _, ...record }) => record)]
  }
  // Keep historical adjudications attached to original IDs; retained aliases resolve them.
  workspace.evidence = canonical
  const map = (ids: string[]) => [...new Set(ids.map(id => replacements.get(id) || id))]
  for (const h of workspace.hypotheses) { h.supportingEvidence = map(h.supportingEvidence); h.contradictingEvidence = map(h.contradictingEvidence); h.derivedFrom = map(h.derivedFrom) }
  for (const s of workspace.syntheses) { s.derivedFrom = map(s.derivedFrom); s.supports = map(s.supports); s.contradicts = map(s.contradicts) }
  for (const node of workspace.nodes) if (replacements.has(node.id)) node.metadata = { ...node.metadata, replacedByEvidenceId: replacements.get(node.id) }
  const edges = new Map<string, Workspace["edges"][number]>()
  for (const edge of workspace.edges) {
    edge.sourceId = replacements.get(edge.sourceId) || edge.sourceId; edge.targetId = replacements.get(edge.targetId) || edge.targetId
    if (edge.sourceId !== edge.targetId) edges.set(`${edge.sourceId}:${edge.type}:${edge.targetId}`, edge)
  }
  workspace.edges = [...edges.values()]
  const results = new Map<string, Workspace["researchResults"][number]>()
  for (const result of workspace.researchResults) results.set(stableId("result-identity", result.taskId, result.providerId, result.url ?? result.title), result)
  workspace.researchResults = [...results.values()]
  return replacements
}
