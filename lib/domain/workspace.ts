import type { Edge } from "./edge"
import type { Entity } from "./entity"

export interface GhostNoteRecord {
  id: string
  text: string
  category: string
  isGenerating: boolean
}

/** Authoritative work graph state for one classic Nodepad project/workspace. */
export interface Workspace {
  id: string
  name: string
  entities: Entity[]
  edges: Edge[]
  collapsedIds: string[]
  ghostNotes: GhostNoteRecord[]
  lastGhostTexts?: string[]
  lastGhostBlockCount?: number
  lastGhostTimestamp?: number
  createdAt?: number
  updatedAt?: number
  /** Server-side optimistic concurrency token. */
  revision?: number
}
