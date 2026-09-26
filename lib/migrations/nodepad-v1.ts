import type { Entity } from "../domain/entity"
import type { Edge } from "../domain/edge"
import type { TextBlock } from "../nodepad/legacy-types"
import { blocksToWorkGraph } from "../nodepad/legacy-adapter"

export interface MigratedV1Graph {
  version: 2
  workspace: { id: string; name: string }
  entities: Entity[]
  edges: Edge[]
  legacy: {
    collapsedIds: string[]
    ghostNotes: unknown[]
  }
}

/** Non-destructively projects a parsed v1 file into the canonical graph. */
export function migrateNodepadV1(data: {
  version?: number
  project: { id: string; name: string; blocks: TextBlock[]; collapsedIds?: string[]; ghostNotes?: unknown[] }
}): MigratedV1Graph {
  const { entities, edges } = blocksToWorkGraph(data.project.blocks, data.project.id)
  return {
    version: 2,
    workspace: { id: data.project.id, name: data.project.name },
    entities,
    edges,
    legacy: {
      collapsedIds: [...(data.project.collapsedIds ?? [])],
      ghostNotes: [...(data.project.ghostNotes ?? [])],
    },
  }
}
