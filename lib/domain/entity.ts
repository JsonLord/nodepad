export const ENTITY_TYPES = [
  "note", "task", "project", "goal", "job", "application", "event",
  "person", "company", "document", "idea",
] as const

export type EntityType = (typeof ENTITY_TYPES)[number]

/** Canonical work/knowledge record. Runtime agent configuration intentionally lives elsewhere. */
export interface Entity {
  id: string
  type: EntityType
  title: string
  body?: string
  workspaceId?: string
  status?: string
  priority?: string
  createdAt: number
  updatedAt: number
  dueAt?: number
  scheduledStart?: number
  scheduledEnd?: number
  source?: string
  sourceId?: string
  sourceUrl?: string
  metadata?: Record<string, unknown>
}

export function isEntity(value: unknown): value is Entity {
  if (!value || typeof value !== "object") return false
  const entity = value as Partial<Entity>
  return typeof entity.id === "string" &&
    ENTITY_TYPES.includes(entity.type as EntityType) &&
    typeof entity.title === "string" &&
    typeof entity.createdAt === "number" &&
    typeof entity.updatedAt === "number"
}
