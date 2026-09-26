import type { Edge } from "./edge"
import type { Workspace } from "./workspace"
import type { TextBlock } from "../nodepad/legacy-types"
import { graphToLegacyBlocks, replaceGraphFromLegacyBlocks } from "../nodepad/legacy-adapter"

export function workspaceBlocks(workspace: Workspace): TextBlock[] {
  return graphToLegacyBlocks(workspace.entities, workspace.edges)
}

export function replaceWorkspaceBlocks(
  workspace: Workspace,
  blocks: readonly TextBlock[],
): Workspace {
  const graph = replaceGraphFromLegacyBlocks(workspace.entities, workspace.edges, blocks, workspace.id)
  return { ...workspace, ...graph, updatedAt: Date.now() }
}

export function updateWorkspaceBlocks(
  workspace: Workspace,
  update: (blocks: TextBlock[]) => TextBlock[],
): Workspace {
  return replaceWorkspaceBlocks(workspace, update(workspaceBlocks(workspace)))
}

/** Replace only AI-inferred influenced_by edges emitted for one entity. */
export function replaceAIInfluencedEdges(
  workspace: Workspace,
  sourceId: string,
  targetIds: readonly string[],
  confidence?: number,
): Workspace {
  const validIds = new Set(workspace.entities.map(entity => entity.id))
  const uniqueTargets = [...new Set(targetIds)].filter(id => id !== sourceId && validIds.has(id))
  const retained = workspace.edges.filter(edge =>
    !(edge.sourceId === sourceId && edge.type === "influenced_by" && edge.origin === "ai"),
  )
  const existingKeys = new Set(retained.map(edge => `${edge.sourceId}\0${edge.type}\0${edge.targetId}`))
  const now = Date.now()
  const inferred: Edge[] = uniqueTargets
    .filter(targetId => !existingKeys.has(`${sourceId}\0influenced_by\0${targetId}`))
    .map(targetId => ({
      id: `edge:${encodeURIComponent(sourceId)}:influenced_by:${encodeURIComponent(targetId)}:ai`,
      sourceId,
      targetId,
      type: "influenced_by",
      origin: "ai",
      confidence,
      createdAt: now,
      updatedAt: now,
    }))
  return { ...workspace, edges: [...retained, ...inferred], updatedAt: now }
}
