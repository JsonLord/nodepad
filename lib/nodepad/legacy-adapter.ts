import type { Entity, EntityType } from "../domain/entity"
import type { Edge, EdgeOrigin } from "../domain/edge"
import type { ContentType } from "../content-types"
import type { TextBlock } from "./legacy-types"
import { getOutgoingEntityIds } from "../graph/relationships"

const DIRECT_ENTITY_TYPES = new Set(["task", "idea"])

function edgeId(sourceId: string, targetId: string, type: string): string {
  // Deterministic and readable: repeated migrations produce the same edge records.
  return `edge:${encodeURIComponent(sourceId)}:${type}:${encodeURIComponent(targetId)}`
}

export function textBlockToEntity(block: TextBlock, workspaceId?: string): Entity {
  const { influencedBy: _relationships, ...legacy } = block
  const type: EntityType = DIRECT_ENTITY_TYPES.has(block.contentType) ? block.contentType as EntityType : "note"
  return {
    id: block.id,
    type,
    title: block.text.split("\n")[0] || "Untitled",
    body: block.text,
    workspaceId,
    createdAt: block.timestamp,
    updatedAt: block.timestamp,
    metadata: { legacy },
  }
}

export function entityToTextBlock(entity: Entity, edges: readonly Edge[] = []): TextBlock {
  const legacy = (entity.metadata?.legacy ?? {}) as Partial<TextBlock>
  const contentType: ContentType = legacy.contentType ??
    (entity.type === "task" || entity.type === "idea" ? entity.type : "general")
  const influencedBy = getOutgoingEntityIds(entity.id, edges, "influenced_by")
  return {
    ...legacy,
    id: entity.id,
    text: entity.body ?? entity.title,
    timestamp: entity.createdAt,
    contentType,
    ...(influencedBy.length ? { influencedBy } : {}),
  }
}

export function legacyInfluencedByToEdges(
  blocks: readonly TextBlock[],
  origin: EdgeOrigin = "import",
): Edge[] {
  const knownIds = new Set(blocks.map(block => block.id))
  const edges: Edge[] = []
  for (const block of blocks) {
    for (const targetId of new Set(block.influencedBy ?? [])) {
      if (!knownIds.has(targetId) || targetId === block.id) continue
      edges.push({
        id: edgeId(block.id, targetId, "influenced_by"),
        sourceId: block.id,
        targetId,
        type: "influenced_by",
        origin,
        confidence: block.confidence ?? undefined,
        createdAt: block.timestamp,
        updatedAt: block.timestamp,
      })
    }
  }
  return edges
}

export function blocksToWorkGraph(blocks: readonly TextBlock[], workspaceId?: string) {
  return {
    entities: blocks.map(block => textBlockToEntity(block, workspaceId)),
    edges: legacyInfluencedByToEdges(blocks),
  }
}

export function graphToLegacyBlocks(entities: readonly Entity[], edges: readonly Edge[]): TextBlock[] {
  return entities.map(entity => entityToTextBlock(entity, edges))
}

/**
 * Central compatibility mutation boundary. Existing edges keep their provenance;
 * only genuinely new legacy relationships receive `newEdgeOrigin`.
 */
export function replaceGraphFromLegacyBlocks(
  entities: readonly Entity[],
  edges: readonly Edge[],
  blocks: readonly TextBlock[],
  workspaceId?: string,
  newEdgeOrigin: EdgeOrigin = "user",
): { entities: Entity[]; edges: Edge[] } {
  const previousEntities = new Map(entities.map(entity => [entity.id, entity]))
  const nextEntities = blocks.map(block => {
    const converted = textBlockToEntity(block, workspaceId)
    const previous = previousEntities.get(block.id)
    return previous ? { ...converted, createdAt: previous.createdAt, updatedAt: Date.now() } : converted
  })
  const validIds = new Set(nextEntities.map(entity => entity.id))
  const desiredRelationships = legacyInfluencedByToEdges(blocks, newEdgeOrigin)
  const desiredKeys = new Set(desiredRelationships.map(edge => `${edge.sourceId}\0${edge.type}\0${edge.targetId}`))
  const retained = edges.filter(edge =>
    validIds.has(edge.sourceId) && validIds.has(edge.targetId) &&
    (edge.type !== "influenced_by" || desiredKeys.has(`${edge.sourceId}\0${edge.type}\0${edge.targetId}`)),
  )
  const retainedKeys = new Set(retained.map(edge => `${edge.sourceId}\0${edge.type}\0${edge.targetId}`))
  return {
    entities: nextEntities,
    edges: [...retained, ...desiredRelationships.filter(edge => !retainedKeys.has(`${edge.sourceId}\0${edge.type}\0${edge.targetId}`))],
  }
}
