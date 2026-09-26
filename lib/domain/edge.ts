export const EDGE_ORIGINS = ["user", "system", "import", "microsoft", "hermes", "ai"] as const
export type EdgeOrigin = (typeof EDGE_ORIGINS)[number]

export const INITIAL_EDGE_TYPES = [
  "related_to", "influenced_by", "belongs_to", "child_of", "contributes_to",
  "depends_on", "blocks", "supports", "contradicts", "scheduled_for",
  "application_for", "works_at", "derived_from", "mentioned_in", "next_action_for",
] as const

/** `type` remains open so adding a relationship never requires a schema change. */
export interface Edge {
  id: string
  sourceId: string
  targetId: string
  type: string
  origin: EdgeOrigin
  confidence?: number
  explanation?: string
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}

export function isEdge(value: unknown): value is Edge {
  if (!value || typeof value !== "object") return false
  const edge = value as Partial<Edge>
  return typeof edge.id === "string" && typeof edge.sourceId === "string" &&
    typeof edge.targetId === "string" && typeof edge.type === "string" &&
    EDGE_ORIGINS.includes(edge.origin as EdgeOrigin) &&
    typeof edge.createdAt === "number" && typeof edge.updatedAt === "number"
}
