import type { Edge } from "../domain/edge"

export function getConnectedEntityIds(entityId: string, edges: readonly Edge[]): Set<string> {
  const ids = new Set<string>([entityId])
  for (const edge of edges) {
    if (edge.sourceId === entityId) ids.add(edge.targetId)
    if (edge.targetId === entityId) ids.add(edge.sourceId)
  }
  return ids
}

export function getOutgoingEntityIds(entityId: string, edges: readonly Edge[], type?: string): string[] {
  return edges
    .filter(edge => edge.sourceId === entityId && (!type || edge.type === type))
    .map(edge => edge.targetId)
}
