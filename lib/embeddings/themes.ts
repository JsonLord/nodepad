import type { EvidenceRecord, Workspace } from "../domain/types"
import { clusterEvidence, type ThemeCluster } from "../themes/clustering"
import { centroid, cosine } from "./similarity"
import { threshold } from "./provider"
export interface SemanticTheme extends ThemeCluster { centroid?: number[] }
export function semanticClusters(evidence: EvidenceRecord[], vectors: Map<string, number[]>, workspace?: Workspace): SemanticTheme[] {
  if (!evidence.length || evidence.some(e => !vectors.has(e.claim))) return clusterEvidence(evidence)
  const sorted = [...evidence].sort((a, b) => a.id.localeCompare(b.id)), clusters: SemanticTheme[] = []
  // Reuse prior theme identities as seeds, with current vectors so model changes are safe.
  for (const node of [...(workspace?.nodes || [])].filter(n => n.kind === "theme" && n.metadata.semantic === true).sort((a, b) => a.id.localeCompare(b.id))) {
    const members = sorted.filter(e => Array.isArray(node.metadata.memberEvidenceIds) && node.metadata.memberEvidenceIds.includes(e.id))
    if (!members.length) continue
    const lexical = clusterEvidence(members)[0]
    clusters.push({ ...lexical, key: String(node.metadata.clusterKey), label: node.title, evidence: [], centroid: centroid(members.map(e => vectors.get(e.claim)!)) })
  }
  for (const item of sorted) {
    let best: SemanticTheme | undefined, score = threshold("THEME", .80)
    for (const cluster of clusters) {
      const next = cosine(vectors.get(item.claim), cluster.centroid)
      if (next !== undefined && next >= score) { best = cluster; score = next }
    }
    if (best) { best.evidence.push(item); best.centroid = centroid(best.evidence.map(e => vectors.get(e.claim)!)) }
    else { const lexical = clusterEvidence([item])[0]; clusters.push({ ...lexical, key: `semantic:${item.id}`, centroid: vectors.get(item.claim) }) }
  }
  return clusters.filter(c => c.evidence.length > 0)
}
